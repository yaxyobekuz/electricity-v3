/*
 * Abonent qarzdorligi va turini (Yuridik / Aholi) qarzdorlik fayllaridan
 * yangilash.
 *
 *   npx tsx scripts/update-debts.ts [--commit] <fayl...>
 *
 * `--commit` bo'lmasa - faqat hisobot chiqaradi, bazaga yozilmaydi.
 *
 * Fayllar "Abonentlar reestri" ko'rinishida (shablonlar.md, Abonentlar).
 * Bu yerdan faqat uchta ustun olinadi:
 *
 *   - "Abonent turi (Yuridik/Aholi)" -> SubscriberSnapshot.kind
 *   - "Qarzdorlik"                   -> SubscriberSnapshot.debtUzs
 *   - "Haqdorlik"                    -> SubscriberSnapshot.creditUzs
 *
 * Qolgan ustunlar (sana, hisoblagich ko'rsatgichi va h.k.) tegilmaydi - ular
 * oddiy import orqali keladi (`scripts/import-files.ts`).
 *
 * Abonent "Shartnoma raqami" bo'yicha topiladi. Bir shartnoma bir nechta
 * hisoblagichda bo'lsa, bazada kalit "<shartnoma>/<hisoblagich>" ko'rinishida
 * (convert-data.ts `disambiguateContracts`) - shuning uchun avval shartnoma,
 * topilmasa shartnoma+hisoblagich bo'yicha qidiriladi.
 *
 * Fayldagi, lekin bazada yo'q abonent QO'SHILADI (Baliqchi yuridik
 * abonentlari). Ularning qatorida "Podstansiya" va "Fider" bo'sh, faqat "TP"
 * raqami bor, shuning uchun TP quyidagicha topiladi:
 *
 *   1. TP raqami bazada aynan bitta bo'lsa - o'sha TP;
 *   2. bir nechta bo'lsa - "Biriktirilgan xodim" ishlaydigan podstansiya(lar)
 *      bo'yicha toraytiriladi (malumotlar.md 4.3d dagi qoidaning o'zi);
 *   3. shundan keyin ham bitta bo'lmasa yoki TP bazada bo'lmasa - abonent
 *      "Podstansiya aniqlanmagan" podstansiyasining shu raqamli TP siga
 *      yoziladi: qarzdorlik tuman yig'indisida to'liq ko'rinadi, lekin
 *      noto'g'ri podstansiyaga yozilmaydi.
 *
 * Qarzdorlik oyma-oy ajratilmagan: fayl bitta holatni beradi va u bazadagi
 * BARCHA davrlarga yoziladi (foydalanuvchi qarori, 2026-09-21).
 */
import { config } from "dotenv";

config();

import ExcelJS from "exceljs";

import { PrismaPg } from "@prisma/adapter-pg";

import type { SubscriberKind } from "@/generated/prisma";
import { PrismaClient } from "@/generated/prisma/client";
import { contractKey, nameKey } from "@/lib/domain/normalize";

const HEADER_ROW = 2;
const COL_CONTRACT = "Shartnoma raqami";
const COL_SERIAL = "Hisoblagich zavod raqami";
const COL_KIND = "Abonent turi (Yuridik/Aholi)";
const COL_DEBT = "Qarzdorlik";
const COL_CREDIT = "Haqdorlik";
const COL_NAME = "FISH";
const COL_TP = "TP";
const COL_STAFF = "Biriktirilgan xodim";
const COL_STATUS = "Holati (Aloqada / Aloqaga chiqmayotgan / Sxemasi o’zgartirilgan)";
const COL_ADDRESS = "Manzil";

/** Podstansiyasi aniqlanmagan TP lar shu podstansiya ostida turadi. */
const UNKNOWN_SUBSTATION = "Podstansiya aniqlanmagan";
const UNKNOWN_FEEDER = "Fider aniqlanmagan";

interface FileRow {
  readonly file: string;
  readonly row: number;
  readonly contract: string;
  readonly key: string;
  readonly serial: string;
  readonly fullName: string;
  readonly transformerName: string;
  readonly staffName: string;
  readonly address: string;
  readonly online: boolean;
  readonly kind: SubscriberKind;
  readonly debtUzs: number;
  readonly creditUzs: number;
}

/** Katak qiymati - matn (formula natijasi va rich text ham). */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return String(value.text);
  }
  return String(value);
}

/** Pul: bo'sh katak = 0; vergul ham kasr ajratgichi bo'lishi mumkin. */
function amount(text: string): number {
  const cleaned = text.replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) throw new Error(`Son tushunilmadi: “${text}”`);
  return value;
}

/** "Yuridik" / "YURIDIK" / "Aholi" - katta-kichik harf farqsiz. */
function subscriberKind(text: string): SubscriberKind {
  const key = text.trim().toLowerCase();
  if (key === "yuridik") return "LEGAL";
  if (key === "aholi") return "HOUSEHOLD";
  throw new Error(`Abonent turi tushunilmadi: “${text}” (kutilgan: Yuridik / Aholi)`);
}

/**
 * Xodim nomining shu fayldagi ko'rinishlari. Reestrda ikki xil yoziladi:
 * "Toshtemirov Abrorbek" va "0319-AbrorbekToshtemirov (ESB Obiddinov Islomjon)"
 * - ikkinchisida ism familiyadan oldin va bo'shliqsiz.
 */
function staffCandidates(raw: string): string[] {
  const core = raw
    .replace(/^\d{3,4}\s*-\s*/, "")
    .replace(/\(ESB[^)]*\)/gi, " ")
    .replace(/\byuridik\b/gi, " ")
    .replace(/\bF[.,]\s*[^\s,]+,?/gi, " ")
    .trim();
  const first = core.split(/\s+/)[0] ?? "";
  const parts = first.replace(/([a-z'’])([A-Z])/g, "$1|$2").split("|");
  const out = [core];
  if (parts.length === 2) out.unshift(`${parts[1]} ${parts[0]}`, `${parts[0]} ${parts[1]}`);
  return out.filter(Boolean);
}

async function readFile(path: string): Promise<FileRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`${path}: varaq yo'q`);

  const header = sheet.getRow(HEADER_ROW);
  const columns = new Map<string, number>();
  for (let c = 1; c <= sheet.columnCount; c++) {
    const name = cellText(header.getCell(c).value).trim();
    if (name && !columns.has(name)) columns.set(name, c);
  }
  for (const name of [COL_CONTRACT, COL_KIND, COL_DEBT]) {
    if (!columns.has(name)) throw new Error(`${path}: “${name}” ustuni yo'q`);
  }
  const at = (row: ExcelJS.Row, name: string) => {
    const index = columns.get(name);
    return index == null ? "" : cellText(row.getCell(index).value).trim();
  };

  const rows: FileRow[] = [];
  for (let r = HEADER_ROW + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const contract = at(row, COL_CONTRACT);
    if (!contract) continue; // Faqat lokatsiyasi bor "quyruq" qatorlar.
    try {
      rows.push({
        file: path,
        row: r,
        contract,
        key: contractKey(contract),
        serial: at(row, COL_SERIAL),
        fullName: at(row, COL_NAME),
        transformerName: at(row, COL_TP),
        staffName: at(row, COL_STAFF),
        address: at(row, COL_ADDRESS),
        online: at(row, COL_STATUS).trim().toLowerCase() === "aloqada",
        kind: subscriberKind(at(row, COL_KIND)),
        debtUzs: amount(at(row, COL_DEBT)),
        creditUzs: amount(at(row, COL_CREDIT)),
      });
    } catch (error) {
      throw new Error(`${path}, ${r}-qator: ${(error as Error).message}`);
    }
  }
  return rows;
}

function money(value: number): string {
  return value.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const paths = args.filter((arg) => !arg.startsWith("--"));
  if (paths.length === 0) {
    console.error("Fayl ko'rsatilmadi: npx tsx scripts/update-debts.ts [--commit] <fayl...>");
    process.exitCode = 1;
    return;
  }

  const rows: FileRow[] = [];
  for (const path of paths) rows.push(...(await readFile(path)));
  console.log(`Fayllardan o'qildi: ${rows.length} qator (${paths.length} fayl)`);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const subscribers = await prisma.subscriber.findMany({
      select: { id: true, contractKey: true },
    });
    const byKey = new Map(subscribers.map((s) => [s.contractKey, s.id]));

    // Fayl qatori -> abonent. Bir shartnoma bir nechta hisoblagichda bo'lsa,
    // bazadagi kalit "<shartnoma>/<hisoblagich>".
    const target = new Map<string, { kind: SubscriberKind; debtUzs: number; creditUzs: number }>();
    const missing: FileRow[] = [];
    for (const row of rows) {
      const id =
        byKey.get(row.key) ?? (row.serial ? byKey.get(contractKey(`${row.key}/${row.serial}`)) : undefined);
      if (!id) {
        missing.push(row);
        continue;
      }
      target.set(id, { kind: row.kind, debtUzs: row.debtUzs, creditUzs: row.creditUzs });
    }

    const periods = await prisma.period.findMany({ orderBy: { month: "asc" }, select: { id: true, month: true } });
    const snapshots = await prisma.subscriberSnapshot.findMany({
      select: { id: true, subscriberId: true, kind: true, debtUzs: true, creditUzs: true },
    });

    // Mavjud abonentlar: farqi bor holatlar.
    let kindChanged = 0;
    let debtChanged = 0;
    const updates: { id: string; kind: SubscriberKind; debtUzs: number; creditUzs: number }[] = [];
    for (const snapshot of snapshots) {
      const next = target.get(snapshot.subscriberId);
      if (!next) continue;
      const sameKind = snapshot.kind === next.kind;
      // Tiyin aniqligida: Decimal va float taqqoslashda 0,01 dan kichik farq - shovqin.
      const sameDebt =
        Math.abs(Number(snapshot.debtUzs) - next.debtUzs) < 0.005 &&
        Math.abs(Number(snapshot.creditUzs) - next.creditUzs) < 0.005;
      if (sameKind && sameDebt) continue;
      if (!sameKind) kindChanged++;
      if (!sameDebt) debtChanged++;
      updates.push({ id: snapshot.id, ...next });
    }

    /* --- Yangi abonentlar uchun TP ni topish -------------------------------- */

    const transformers = await prisma.transformer.findMany({
      select: { id: true, nameKey: true, substationId: true },
    });
    const tpByName = new Map<string, typeof transformers>();
    for (const tp of transformers) {
      tpByName.set(tp.nameKey, [...(tpByName.get(tp.nameKey) ?? []), tp]);
    }

    const staff = await prisma.staff.findMany({ select: { id: true, nameKey: true } });
    const staffByKey = new Map(staff.map((s) => [s.nameKey, s.id]));
    // Xodim -> u ishlaydigan podstansiyalar (barcha davrlar bo'yicha).
    const staffRows = await prisma.subscriberSnapshot.findMany({
      where: { staffId: { not: null } },
      select: { staffId: true, transformer: { select: { substationId: true } } },
      distinct: ["staffId", "transformerId"],
    });
    const staffSubstations = new Map<string, Set<string>>();
    for (const item of staffRows) {
      if (!item.staffId) continue;
      const set = staffSubstations.get(item.staffId) ?? new Set<string>();
      set.add(item.transformer.substationId);
      staffSubstations.set(item.staffId, set);
    }

    const resolved = new Map<FileRow, string>(); // qator -> transformerId
    const unresolved: FileRow[] = [];
    for (const row of missing) {
      const candidates = tpByName.get(nameKey(row.transformerName)) ?? [];
      let picked = candidates.length === 1 ? candidates[0] : undefined;
      if (!picked && candidates.length > 1) {
        let staffId: string | undefined;
        for (const name of staffCandidates(row.staffName)) {
          staffId = staffByKey.get(nameKey(name));
          if (staffId) break;
        }
        const allowed = staffId ? staffSubstations.get(staffId) : undefined;
        const narrowed = allowed ? candidates.filter((tp) => allowed.has(tp.substationId)) : [];
        if (narrowed.length === 1) picked = narrowed[0];
      }
      if (picked) resolved.set(row, picked.id);
      else unresolved.push(row);
    }

    const unresolvedDebt = unresolved.reduce((sum, row) => sum + row.debtUzs, 0);
    const missingDebt = missing.reduce((sum, row) => sum + row.debtUzs, 0);

    console.log(
      [
        "",
        `Bazadagi abonent: ${subscribers.length} | davr: ${periods.length}` +
          ` (${periods[0]?.month.toISOString().slice(0, 7)} … ${periods.at(-1)?.month.toISOString().slice(0, 7)})`,
        "",
        "Mavjud abonentlar:",
        `   bog'landi: ${rows.length - missing.length} qator`,
        `   yangilanadigan holat: ${updates.length} (turi: ${kindChanged}, qarzdorlik: ${debtChanged})`,
        "",
        `Yangi abonentlar: ${missing.length} ta, qarzdorlik ${money(missingDebt)} so'm`,
        `   TP aniqlandi: ${resolved.size}`,
        `   TP aniqlanmadi: ${unresolved.length} (qarzdorlik ${money(unresolvedDebt)} so'm)` +
          ` -> “${UNKNOWN_SUBSTATION}”`,
        `   har biri ${periods.length} davrga yoziladi:` +
          ` ${missing.length * periods.length} ta yangi holat`,
      ].join("\n"),
    );

    if (!commit) {
      console.log("\n(--commit berilmadi - bazaga yozilmadi)");
      return;
    }

    await prisma.$transaction(
      async (tx) => {
        // 1. Mavjud holatlarni yangilash.
        const CHUNK = 500;
        for (let i = 0; i < updates.length; i += CHUNK) {
          await Promise.all(
            updates.slice(i, i + CHUNK).map((update) =>
              tx.subscriberSnapshot.update({
                where: { id: update.id },
                data: { kind: update.kind, debtUzs: update.debtUzs, creditUzs: update.creditUzs },
              }),
            ),
          );
        }
        console.log(`   yangilandi: ${updates.length} ta holat`);

        // 2. TP si aniqlanmaganlar uchun zaxira podstansiya / fider / TP.
        if (unresolved.length > 0) {
          const substation = await tx.substation.upsert({
            where: { nameKey: nameKey(UNKNOWN_SUBSTATION) },
            create: { name: UNKNOWN_SUBSTATION, nameKey: nameKey(UNKNOWN_SUBSTATION) },
            update: {},
            select: { id: true },
          });
          let feeder = await tx.feeder.findFirst({
            where: { substationId: substation.id, nameKey: nameKey(UNKNOWN_FEEDER) },
            select: { id: true },
          });
          feeder ??= await tx.feeder.create({
            data: { substationId: substation.id, name: UNKNOWN_FEEDER, nameKey: nameKey(UNKNOWN_FEEDER) },
            select: { id: true },
          });
          const names = new Map<string, string>();
          for (const row of unresolved) names.set(nameKey(row.transformerName), row.transformerName);
          await tx.transformer.createMany({
            data: [...names].map(([key, name]) => ({
              substationId: substation.id,
              feederId: feeder.id,
              name,
              nameKey: key,
            })),
            skipDuplicates: true,
          });
          const created = await tx.transformer.findMany({
            where: { feederId: feeder.id },
            select: { id: true, nameKey: true },
          });
          const byNameKey = new Map(created.map((tp) => [tp.nameKey, tp.id]));
          for (const row of unresolved) {
            const id = byNameKey.get(nameKey(row.transformerName));
            if (!id) throw new Error(`TP yaratilmadi: “${row.transformerName}”`);
            resolved.set(row, id);
          }
          console.log(`   “${UNKNOWN_SUBSTATION}” ostida ${names.size} ta TP tayyor`);
        }

        // 3. Yangi abonentlar.
        await tx.subscriber.createMany({
          data: missing.map((row) => ({ contractNumber: row.contract, contractKey: row.key })),
          skipDuplicates: true,
        });
        const keys = missing.map((row) => row.key);
        const inserted = await tx.subscriber.findMany({
          where: { contractKey: { in: keys } },
          select: { id: true, contractKey: true },
        });
        const idByKey = new Map(inserted.map((s) => [s.contractKey, s.id]));
        console.log(`   abonent qo'shildi: ${idByKey.size}`);

        // 4. Har bir davrga holat. Xodim fayldagi nom bo'yicha bog'lanadi.
        const staffIdOf = (row: FileRow) => {
          for (const name of staffCandidates(row.staffName)) {
            const id = staffByKey.get(nameKey(name));
            if (id) return id;
          }
          return null;
        };
        const data = periods.flatMap((period) =>
          missing.map((row) => ({
            periodId: period.id,
            subscriberId: idByKey.get(row.key)!,
            transformerId: resolved.get(row)!,
            rowNumber: row.row,
            fullName: row.fullName,
            kind: row.kind,
            meterStatus: row.online ? ("ONLINE" as const) : ("NOT_RESPONDING" as const),
            staffId: staffIdOf(row),
            address: row.address || null,
            debtUzs: row.debtUzs,
            creditUzs: row.creditUzs,
          })),
        );
        for (let i = 0; i < data.length; i += 2000) {
          await tx.subscriberSnapshot.createMany({ data: data.slice(i, i + 2000), skipDuplicates: true });
        }
        console.log(`   yangi holat: ${data.length}`);
      },
      { timeout: 15 * 60_000, maxWait: 60_000 },
    );

    console.log("\nSaqlandi.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
