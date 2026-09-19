import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { detectPhotoType, MAX_PHOTO_BYTES, photoKindFromSegment } from "@/lib/domain/photos";
import { deleteSubscriberPhoto, readSubscriberPhoto, saveSubscriberPhoto } from "@/lib/queries/subscriber-photos";

/*
 * Abonent rasmi - platformada qo'lda kiritiladigan yagona ma'lumot
 * (foydalanuvchi qarori, 2026-09-19; `malumotlar.md` 1-bo'lim):
 *
 *   GET    /api/subscribers/<id>/photos/<subscriber|meter>  - rasm
 *   PUT    ...  tana - rasm baytlari (JPEG / PNG / WebP, 5 MB gacha)
 *   DELETE ...
 *
 * Tur baytlardan aniqlanadi (`detectPhotoType`) - `Content-Type` va fayl
 * nomiga ishonilmaydi, SVG va boshqalar rad etiladi. Autentifikatsiya hali
 * yo'q (`loyiha.md`, keyingi qadamlar) - yuklash va o'chirish ochiq.
 *
 * Javob holatlari: 200 - saqlandi (JSON: url, updatedAt, size); 204 -
 * o'chirildi; 400 / 413 / 415 - so'rov noto'g'ri; 404 - abonent yoki rasm yo'q.
 */

export const runtime = "nodejs";

type Context = RouteContext<"/api/subscribers/[id]/photos/[kind]">;

function reply(status: number, message: string): Response {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

class BodyTooLarge extends Error {}

/**
 * Tanani sanab o'qiydi: chegaradan oshsa o'qish shu zahoti to'xtaydi.
 * `Content-Length` ga tayanilmaydi - u yo'q (chunked) yoki noto'g'ri bo'lishi mumkin.
 */
async function readBody(request: Request, limit: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      throw new BodyTooLarge();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const TOO_LARGE = `Rasm juda katta (ko’pi bilan ${MAX_PHOTO_BYTES / 1024 / 1024} MB)`;

export async function GET(request: NextRequest, ctx: Context): Promise<Response> {
  const { id, kind: segment } = await ctx.params;
  const kind = photoKindFromSegment(segment);
  if (!kind) return reply(404, "Rasm turi noto’g’ri");

  const photo = await readSubscriberPhoto(id, kind);
  if (!photo) return reply(404, "Rasm topilmadi");

  return new Response(photo.data, {
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.size),
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      // `?v=<yangilangan vaqt>` bilan manzil rasm almashganda o'zgaradi - uzoq
      // keshlash xavfsiz. Versiyasiz so'rov har safar qayta tekshiriladi.
      "Cache-Control": request.nextUrl.searchParams.has("v")
        ? "private, max-age=31536000, immutable"
        : "private, no-cache",
    },
  });
}

export async function PUT(request: NextRequest, ctx: Context): Promise<Response> {
  const { id, kind: segment } = await ctx.params;
  const kind = photoKindFromSegment(segment);
  if (!kind) return reply(404, "Rasm turi noto’g’ri");

  // E'lon qilingan hajm katta bo'lsa - tanani o'qimasdan rad etiladi.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PHOTO_BYTES) return reply(413, TOO_LARGE);

  let data: Uint8Array<ArrayBuffer>;
  try {
    data = await readBody(request, MAX_PHOTO_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLarge) return reply(413, TOO_LARGE);
    return reply(400, "So’rov tanasi o’qilmadi");
  }
  if (data.byteLength === 0) return reply(400, "Rasm tanlanmagan");

  const mimeType = detectPhotoType(data);
  if (!mimeType) return reply(415, "Faqat JPG, PNG yoki WebP rasm yuklash mumkin");

  const saved = await saveSubscriberPhoto(id, kind, mimeType, data);
  if (!saved) return reply(404, "Abonent topilmadi");

  revalidatePath(`/subscribers/${id}`);
  return Response.json(saved, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_request: NextRequest, ctx: Context): Promise<Response> {
  const { id, kind: segment } = await ctx.params;
  const kind = photoKindFromSegment(segment);
  if (!kind) return reply(404, "Rasm turi noto’g’ri");

  if (!(await deleteSubscriberPhoto(id, kind))) return reply(404, "Rasm topilmadi");

  revalidatePath(`/subscribers/${id}`);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
