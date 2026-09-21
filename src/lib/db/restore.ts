import "server-only";

import { spawn } from "node:child_process";
import { createReadStream, createWriteStream, existsSync, readdirSync } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { createGunzip } from "node:zlib";

import { type DumpFormat, MAX_DUMP_BYTES } from "./restore-types";

/*
 * To'liq bazani boshqa serverdan ko'chirish: `pg_dump` fayli yuklanadi va
 * `pg_restore` / `psql` orqali shu serverning bazasiga tiklanadi.
 *
 * Nima uchun tashqi vosita: dump ichida `COPY` bloklari, `\restrict` kabi
 * psql meta-buyruqlari va dollar-tirnoqlar bor - ularni SQL satrlarga bo'lib
 * bajarib bo'lmaydi. Vositalar PostgreSQL bilan birga o'rnatiladi; PATH da
 * bo'lmasa `.env` dagi `PG_BIN` papkasi ishlatiladi.
 *
 * Har ikkala yo'l ham bitta tranzaksiyada bajariladi: xato bo'lsa baza
 * tegilmagan holda qoladi.
 */

/** Vositalar chiqarishidan saqlanadigan oxirgi belgilar soni. */
const LOG_TAIL = 8000;

const DUMP_MAGIC = "PGDMP";
const GZIP_MAGIC = Buffer.from([0x1f, 0x8b]);

/** Foydalanuvchiga ko'rsatsa bo'ladigan xato (sababi tushunarli yozilgan). */
export class RestoreError extends Error {}

export class DumpTooLarge extends RestoreError {
  constructor() {
    super(`Fayl juda katta (ko’pi bilan ${MAX_DUMP_BYTES / 1024 / 1024 / 1024} GB)`);
  }
}

// ---------------------------------------------------------------------------
// Ulanish
// ---------------------------------------------------------------------------

function databaseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new RestoreError("DATABASE_URL o’rnatilmagan");
  try {
    return new URL(raw);
  } catch {
    throw new RestoreError("DATABASE_URL noto’g’ri formatda");
  }
}

/**
 * Ulanish ma'lumotlari buyruq satrida emas, muhit o'zgaruvchilarida
 * uzatiladi - aks holda parol server jarayonlari ro'yxatida ko'rinib qoladi.
 */
function pgEnv(url: URL): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, PGCLIENTENCODING: "UTF8" };
  if (url.hostname) env.PGHOST = decodeURIComponent(url.hostname).replace(/^\[|\]$/g, "");
  if (url.port) env.PGPORT = url.port;
  if (url.username) env.PGUSER = decodeURIComponent(url.username);
  if (url.password) env.PGPASSWORD = decodeURIComponent(url.password);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (database) env.PGDATABASE = database;
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

/** Prisma manzilidagi `?schema=` (bo'lmasa - `public`). */
function schemaName(url: URL): string {
  return url.searchParams.get("schema") || "public";
}

/** Baza nomi. `pg_restore` uni `PGDATABASE` dan olmaydi - `-d` shart. */
function databaseName(url: URL): string {
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) throw new RestoreError("DATABASE_URL da baza nomi ko’rsatilmagan");
  return name;
}

// ---------------------------------------------------------------------------
// pg_restore / psql ni topish
// ---------------------------------------------------------------------------

function binDirs(): string[] {
  const dirs: string[] = [];
  if (process.env.PG_BIN) dirs.push(process.env.PG_BIN);
  dirs.push(...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean));
  // O'rnatuvchilar PATH ga qo'shmaydigan odatiy joylar.
  const roots =
    process.platform === "win32"
      ? ["C:\\Program Files\\PostgreSQL"]
      : ["/usr/lib/postgresql", "/usr/pgsql", "/opt/homebrew/opt"];
  for (const root of roots) {
    try {
      for (const entry of readdirSync(root)) dirs.push(path.join(root, entry, "bin"));
    } catch {
      // Papka yo'q - e'tiborsiz qoldiriladi.
    }
  }
  if (process.platform === "darwin") {
    dirs.push("/Applications/Postgres.app/Contents/Versions/latest/bin");
  }
  return dirs;
}

function resolveTool(name: "psql" | "pg_restore"): string {
  const exe = process.platform === "win32" ? `${name}.exe` : name;
  for (const dir of binDirs()) {
    const full = path.join(dir, exe);
    if (existsSync(full)) return full;
  }
  throw new RestoreError(
    `Serverda “${name}” topilmadi. PostgreSQL klient vositalarini o’rnating ` +
      `yoki .env da PG_BIN=<postgres “bin” papkasi> ko’rsating`,
  );
}

// ---------------------------------------------------------------------------
// Faylni qabul qilish
// ---------------------------------------------------------------------------

export interface Upload {
  /** Vaqtinchalik papka - ish tugagach `discard()` bilan o'chiriladi. */
  dir: string;
  file: string;
  size: number;
}

/** So'rov tanasini vaqtinchalik faylga oqim bilan yozadi (xotiraga olmaydi). */
export async function saveUpload(body: ReadableStream<Uint8Array>): Promise<Upload> {
  const dir = await mkdtemp(path.join(tmpdir(), "elektr-dump-"));
  const file = path.join(dir, "upload.bin");
  let size = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, done) {
      size += chunk.byteLength;
      if (size > MAX_DUMP_BYTES) done(new DumpTooLarge());
      else done(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(body as WebReadableStream<Uint8Array>),
      counter,
      createWriteStream(file),
    );
  } catch (error) {
    await discard(dir);
    throw error;
  }
  return { dir, file, size };
}

export async function discard(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

async function head(file: string, bytes: number): Promise<Buffer> {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Oddiy SQL dump izoh sarlavhasi va `SET` buyruqlari bilan boshlanadi. */
function looksLikeSql(sample: Buffer): boolean {
  const text = sample.toString("utf8");
  if (text.includes("PostgreSQL database dump")) return true;
  return /^\s*(--|\/\*|\\restrict|SET\s|BEGIN;|START\s+TRANSACTION|CREATE\s|DROP\s|COPY\s|INSERT\s)/i.test(text);
}

/**
 * Formatni fayl mazmunidan aniqlaydi (kengaytmaga ishonilmaydi). Gzip bo'lsa
 * avval ochiladi - `pg_dump ... | gzip` odatiy usul.
 */
export async function prepareDump(upload: Upload): Promise<{ file: string; format: DumpFormat }> {
  let file = upload.file;
  if ((await head(file, 2)).equals(GZIP_MAGIC)) {
    const unpacked = path.join(upload.dir, "dump.out");
    await pipeline(createReadStream(file), createGunzip(), createWriteStream(unpacked));
    file = unpacked;
  }
  const sample = await head(file, 512);
  if (sample.subarray(0, DUMP_MAGIC.length).toString("ascii") === DUMP_MAGIC) {
    return { file, format: "custom" };
  }
  if (looksLikeSql(sample)) return { file, format: "plain" };
  throw new RestoreError(
    "Fayl pg_dump natijasiga o’xshamaydi. `pg_dump -Fc` arxivi (.dump), " +
      "oddiy SQL (.sql) yoki ularning .gz siqilgani kerak",
  );
}

// ---------------------------------------------------------------------------
// Tiklash
// ---------------------------------------------------------------------------

function run(
  tool: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number; log: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(tool, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let log = "";
    const collect = (chunk: Buffer) => {
      log += chunk.toString("utf8");
      // Xotira o'smasin: faqat oxiri saqlanadi.
      if (log.length > LOG_TAIL * 2) log = log.slice(-LOG_TAIL);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", (error) =>
      reject(new RestoreError(`“${path.basename(tool)}” ishga tushmadi: ${error.message}`)),
    );
    child.on("close", (code) => resolve({ code: code ?? -1, log: log.slice(-LOG_TAIL).trim() }));
  });
}

/**
 * Xato bo'lganda logga qo'shiladigan ma'lumot: qaysi vosita va qaysi server
 * ishlatildi. Versiyalarsiz "unsupported version" kabi xabarlarni tushunib
 * bo'lmaydi.
 */
async function versionNote(tool: string, env: NodeJS.ProcessEnv, dbname: string): Promise<string> {
  const lines: string[] = [];
  const own = await run(tool, ["--version"], env).catch(() => null);
  if (own?.log) lines.push(`vosita: ${own.log} (${tool})`);
  try {
    const server = await run(resolveTool("psql"), ["--dbname", dbname, "-XAtc", "show server_version"], env);
    if (server.code === 0 && server.log) lines.push(`baza serveri: PostgreSQL ${server.log}`);
  } catch {
    // psql topilmasa - versiyasiz qolaveradi.
  }
  return lines.join("\n");
}

/**
 * Tanish xatolar uchun o'zbekcha izoh. Foydalanuvchi ingliz tilidagi
 * `pg_restore` xabaridan nima qilishni bilmaydi.
 */
export function restoreHint(log: string): string | null {
  if (/unsupported version .* in file header/i.test(log)) {
    return (
      "Arxiv yangiroq `pg_dump` bilan olingan - shu serverdagi `pg_restore` uni o’qiy olmaydi. " +
      "Yo serverga bir xil (yoki yangiroq) versiyadagi PostgreSQL klient vositalarini o’rnating, " +
      "yo nusxani oddiy SQL ko’rinishida oling: `pg_dump \"$DATABASE_URL\" --no-owner " +
      "--no-privileges | gzip > baza.sql.gz` - SQL fayl versiyalarga bog’liq emas."
    );
  }
  if (/unrecognized configuration parameter/i.test(log)) {
    return (
      "SQL fayl yangiroq PostgreSQL da olingan va shu serverda yo’q sozlamaga murojaat qilyapti. " +
      "Nusxa olayotganda o’sha `SET ...` satrini olib tashlang (masalan PostgreSQL 17 dan 16 ga: " +
      "`SET transaction_timeout = 0;`)."
    );
  }
  if (/could not read from input file|premature end|corrupt/i.test(log)) {
    return "Fayl to’liq yuklanmagan yoki buzilgan - nusxani qaytadan oling va yana urinib ko’ring.";
  }
  if (/password authentication failed|role .* does not exist/i.test(log)) {
    return "Serverdagi `.env` dagi DATABASE_URL foydalanuvchisi yoki paroli to’g’ri emas.";
  }
  return null;
}

/**
 * Bazani dump holatiga keltiradi. Ikkala yo'l ham `--single-transaction`:
 * xato bo'lsa hammasi bekor qilinadi, baza eski holida qoladi.
 *
 *   custom - `pg_restore --clean --if-exists`: dumpdagi obyektlar avval
 *            o'chiriladi, so'ng qaytadan yaratiladi;
 *   plain  - psql sxemani butunlay tashlab qayta yaratadi (oddiy dumpda
 *            `DROP` buyruqlari bo'lmasligi mumkin), keyin faylni bajaradi.
 */
export async function restoreDump(
  file: string,
  format: DumpFormat,
): Promise<{ code: number; log: string }> {
  const url = databaseUrl();
  const env = pgEnv(url);
  // Faqat baza nomi argument sifatida beriladi; qolgan ulanish ma'lumotlari
  // (jumladan parol) `pgEnv` orqali muhitda ketadi.
  const dbname = databaseName(url);

  const schema = schemaName(url).replace(/"/g, '""');
  const [tool, args] =
    format === "custom"
      ? [
          resolveTool("pg_restore"),
          [
            "--dbname",
            dbname,
            "--single-transaction",
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-privileges",
            "--exit-on-error",
            file,
          ],
        ]
      : [
          resolveTool("psql"),
          [
            "--dbname",
            dbname,
            "--quiet",
            // So'rov natijalari (dump ichidagi `SELECT set_config(...)` kabi)
            // logga tushmasin - xatolar baribir stderr orqali keladi.
            "--output",
            process.platform === "win32" ? "NUL" : "/dev/null",
            "--single-transaction",
            "--set",
            "ON_ERROR_STOP=1",
            "--command",
            // `client_min_messages` - "drop cascades to ..." bildirishlari
            // logni to'ldirib, haqiqiy xatoni ko'rinmas qilib qo'ymasin.
            `SET client_min_messages = warning; DROP SCHEMA IF EXISTS "${schema}" CASCADE; CREATE SCHEMA "${schema}";`,
            "--file",
            file,
          ],
        ];

  const result = await run(tool, args, env);
  if (result.code !== 0) {
    const note = await versionNote(tool, env, dbname);
    if (note) result.log = `${result.log}\n\n${note}`.trim();
  }
  return result;
}
