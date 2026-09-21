import { revalidatePath } from "next/cache";

import {
  discard,
  DumpTooLarge,
  prepareDump,
  RestoreError,
  restoreDump,
  restoreHint,
  saveUpload,
  type Upload,
} from "@/lib/db/restore";
import { MAX_DUMP_BYTES, type RestoreResult } from "@/lib/db/restore-types";

/*
 * `POST /api/restore` - butun bazani `pg_dump` faylidan tiklaydi.
 *
 * So'rov tanasi - faylning o'zi (multipart emas: dump yuzlab MB bo'ladi,
 * o'rash faqat ortiqcha ish). Fayl nomi `x-dump-name` sarlavhasida,
 * `encodeURIComponent` bilan.
 *
 * Javob doim `RestoreResult` JSON: 200 - tiklandi; 400 / 409 / 413 - so'rov
 * qabul qilinmadi; 500 - tiklash xato bilan tugadi (baza tegilmagan, qarang
 * `src/lib/db/restore.ts`).
 *
 * DIQQAT: amal buzuvchi - bazadagi hozirgi ma'lumotlar dump bilan
 * almashtiriladi. UI da alohida tasdiq so'raladi.
 */

export const runtime = "nodejs";
/** 1 GB baza tiklanishi o'nlab daqiqa olishi mumkin. */
export const maxDuration = 3600;

/** Bir vaqtda ikkita tiklash ishlamasin - ikkinchisi birinchisini buzadi. */
let running = false;

function fail(message: string, status: number, fileName = "", fileSize = 0): Response {
  const result: RestoreResult = {
    ok: false,
    fileName,
    fileSize,
    format: null,
    durationMs: 0,
    message,
    log: "",
  };
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}

function dumpName(request: Request): string {
  const raw = request.headers.get("x-dump-name");
  if (!raw) return "dump";
  try {
    return decodeURIComponent(raw).slice(0, 200);
  } catch {
    return raw.slice(0, 200);
  }
}

export async function POST(request: Request): Promise<Response> {
  const fileName = dumpName(request);

  if (!request.body) return fail("So’rov tanasi yo’q - fayl yuborilmadi", 400, fileName);
  if (Number(request.headers.get("content-length") ?? 0) > MAX_DUMP_BYTES) {
    return fail(`Fayl juda katta (ko’pi bilan ${MAX_DUMP_BYTES / 1024 / 1024 / 1024} GB)`, 413, fileName);
  }
  if (running) {
    return fail("Hozir boshqa tiklash ketmoqda. U tugashini kuting", 409, fileName);
  }

  running = true;
  let upload: Upload | null = null;
  try {
    upload = await saveUpload(request.body);
    if (upload.size === 0) return fail("Fayl bo’sh", 400, fileName);

    const { file, format } = await prepareDump(upload);

    const startedAt = Date.now();
    const { code, log } = await restoreDump(file, format);
    const durationMs = Date.now() - startedAt;

    const hint = code === 0 ? null : restoreHint(log);
    const result: RestoreResult = {
      ok: code === 0,
      fileName,
      fileSize: upload.size,
      format,
      durationMs,
      message:
        code === 0
          ? "Baza dump fayldan to’liq tiklandi"
          : `Tiklash xato bilan tugadi (kod ${code}). Baza o’zgarmadi. ` +
            (hint ?? "Sababi quyidagi xabarda"),
      log,
    };

    if (result.ok) {
      // Barcha sahifalar yangi bazadan o'qisin.
      revalidatePath("/", "layout");
    } else {
      console.error("[restore] vosita xato qaytardi", { code, log });
    }
    return Response.json(result, {
      status: result.ok ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof DumpTooLarge) return fail(error.message, 413, fileName, upload?.size ?? 0);
    if (error instanceof RestoreError) return fail(error.message, 400, fileName, upload?.size ?? 0);
    console.error("[restore] kutilmagan xato", error);
    const detail = error instanceof Error ? error.message : String(error);
    return fail(`Kutilmagan xato: ${detail}`, 500, fileName, upload?.size ?? 0);
  } finally {
    running = false;
    if (upload) await discard(upload.dir);
  }
}
