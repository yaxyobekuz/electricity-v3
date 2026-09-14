import { revalidatePath } from "next/cache";

import {
  errorDetail,
  type ImportFileInput,
  type ImportMode,
  type ImportResult,
  MAX_FILE_BYTES,
  MAX_FILES,
  runImport,
} from "@/lib/import";

/*
 * `POST /api/imports` - multipart/form-data:
 *   mode  = "validate" | "commit"
 *   files = 1..6 ta .xlsx
 *
 * Tekshirish rejimi bazaga yozmaydi. Saqlash rejimi fayllarni qayta
 * tekshiradi (server holat saqlamaydi) va bitta tranzaksiyada yozadi.
 * Qoidalar: `.claude/docs/malumotlar.md` 4-bo'lim.
 *
 * Javob holatlari: 200 - natija; 400 / 413 - so'rov noto'g'ri
 * (`message`); 422 - saqlash rad etildi (fayllarda xato); 500 - kutilmagan
 * xato (`message` to'ldirilgan).
 *
 * Hajm: Route Handler so'rov tanasini cheklamaydi (1 MB chegara faqat Server
 * Action'larda) - chegara shu yerda, tana o'qilayotganda sanaladi. Loyihada
 * `proxy.ts` paydo bo'lsa, u tanani `experimental.proxyClientMaxBodySize`
 * (standart 10 MB) gacha buferlaydi - abonentlar fayli uchun shu sozlama
 * oshirilishi kerak.
 */

export const runtime = "nodejs";
/** Katta abonentlar fayli: o'qish + tranzaksiya bir necha daqiqa olishi mumkin. */
export const maxDuration = 900;

/** Butun so'rov tanasi: 6 ta eng katta fayl + multipart sarlavhalari va `mode`. */
const MAX_BODY_BYTES = MAX_FILE_BYTES * MAX_FILES + 1024 * 1024;

function badRequest(message: string, status = 400): Response {
  return Response.json({ message }, { status });
}

const tooLarge = () =>
  badRequest(`Fayllar hajmi juda katta (bir yuklashda ko’pi bilan ${MAX_BODY_BYTES / 1024 / 1024} MB)`, 413);

class BodyTooLarge extends Error {}

/**
 * So'rov tanasini sanab o'qiydi: chegaradan oshsa o'qish shu zahoti to'xtaydi.
 * `Content-Length` sarlavhasiga tayanilmaydi - u yo'q (chunked) yoki noto'g'ri
 * bo'lishi mumkin, `formData()` esa tanani to'liq xotiraga oladi.
 */
async function readForm(request: Request): Promise<FormData> {
  if (!request.body) throw new TypeError("So’rov tanasi yo’q");
  let received = 0;
  const limited = request.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (received > MAX_BODY_BYTES) {
          controller.error(new BodyTooLarge());
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
  const contentType = request.headers.get("content-type") ?? "";
  try {
    return await new Response(limited, { headers: { "content-type": contentType } }).formData();
  } catch (error) {
    // `formData()` oqim xatosini o'z xatosiga o'raydi - sanagich bo'yicha aniqlanadi.
    if (received > MAX_BODY_BYTES) throw new BodyTooLarge();
    throw error;
  }
}

export async function POST(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return badRequest("So’rov multipart/form-data ko’rinishida bo’lishi kerak");
  }
  // E'lon qilingan hajm katta bo'lsa - tanani o'qimasdan rad etiladi.
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return tooLarge();

  let form: FormData;
  try {
    form = await readForm(request);
  } catch (error) {
    if (error instanceof BodyTooLarge) return tooLarge();
    return badRequest("So’rov tanasi o’qilmadi (multipart/form-data buzilgan)");
  }

  const mode = form.get("mode");
  if (mode !== "validate" && mode !== "commit") {
    return badRequest("“mode” maydoni “validate” yoki “commit” bo’lishi kerak");
  }

  const files = form.getAll("files").filter((item): item is File => typeof item !== "string");
  if (files.length === 0) return badRequest("Kamida bitta fayl tanlang");
  if (files.length > MAX_FILES) {
    return badRequest(`Bir yuklashda ko’pi bilan ${MAX_FILES} ta fayl bo’lishi mumkin (tanlangan: ${files.length})`);
  }

  const inputs: ImportFileInput[] = [];
  for (const file of files) {
    // MIME turi brauzerga qarab turlicha keladi - kengaytma tekshiriladi,
    // mazmunni exceljs o'qiy olmasa fayl darajasidagi xato qaytadi.
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return badRequest(`Faqat .xlsx fayllar qabul qilinadi: “${file.name}”`);
    }
    if (file.size === 0) return badRequest(`Fayl bo’sh: “${file.name}”`);
    if (file.size > MAX_FILE_BYTES) {
      return badRequest(
        `Fayl juda katta: “${file.name}” (${Math.round(file.size / 1024 / 1024)} MB, ko’pi bilan ${MAX_FILE_BYTES / 1024 / 1024} MB)`,
        413,
      );
    }
    inputs.push({ name: file.name, data: new Uint8Array(await file.arrayBuffer()) });
  }

  let result: ImportResult;
  try {
    result = await runImport(mode satisfies ImportMode, inputs);
  } catch (error) {
    // Baza bilan aloqa uzilishi va h.k.: javob baribir shartnomadagi JSON ko'rinishida.
    console.error("[import] kutilmagan xato", error);
    const failure: ImportResult = {
      mode,
      valid: false,
      committed: false,
      files: [],
      message: `Kutilmagan xato, hech narsa saqlanmadi: ${errorDetail(error)}`,
    };
    return Response.json(failure, { status: 500, headers: { "Cache-Control": "no-store" } });
  }

  if (result.committed) {
    // Barcha sahifalar yangi ma'lumotni ko'rsin.
    revalidatePath("/", "layout");
  }

  const status = mode === "validate" ? 200 : result.committed ? 200 : result.message ? 500 : 422;
  return Response.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
