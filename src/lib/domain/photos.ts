import type { SubscriberPhotoKind } from "@/generated/prisma";

/*
 * Abonent rasmlari - abonent sahifasidan qo'lda yuklanadi (foydalanuvchi
 * qarori, 2026-09-19; `malumotlar.md` 1-bo'lim). Yuklash oynasi (mijoz) va
 * API (server) bir xil tur va chegaralarni shu yerdan oladi.
 *
 * `import type` - mijoz komponentlariga Prisma runtime tushmaydi.
 */

export const PHOTO_KINDS: readonly SubscriberPhotoKind[] = ["SUBSCRIBER", "METER"];

export const PHOTO_KIND_LABEL: Record<SubscriberPhotoKind, string> = {
  SUBSCRIBER: "Abonent rasmi",
  METER: "Hisoblagich rasmi",
};

/** URL dagi ko'rinishi: `/api/subscribers/<id>/photos/<segment>`. */
const SEGMENT: Record<SubscriberPhotoKind, string> = {
  SUBSCRIBER: "subscriber",
  METER: "meter",
};

/** URL segmenti -> tur; noma'lum segment - null. */
export function photoKindFromSegment(segment: string): SubscriberPhotoKind | null {
  return PHOTO_KINDS.find((kind) => SEGMENT[kind] === segment) ?? null;
}

/**
 * Rasm manzili. `version` (yangilangan vaqt) o'zgarganda manzil ham
 * o'zgaradi - brauzer keshidagi eski rasm ko'rinib qolmaydi.
 */
export function photoUrl(subscriberId: string, kind: SubscriberPhotoKind, version?: string): string {
  const path = `/api/subscribers/${encodeURIComponent(subscriberId)}/photos/${SEGMENT[kind]}`;
  return version ? `${path}?v=${encodeURIComponent(version)}` : path;
}

/**
 * Serverga yuboriladigan fayl chegarasi. Brauzer rasmni yuborishdan oldin
 * kichraytiradi (odatda 0,2-0,6 MB), chegara - kichraytirib bo'lmagan holat uchun.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type PhotoMimeType = (typeof PHOTO_MIME_TYPES)[number];

/** Fayl tanlash oynasi uchun (`<input accept>`). */
export const PHOTO_ACCEPT = PHOTO_MIME_TYPES.join(",");

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/**
 * Tur fayl boshidagi baytlardan aniqlanadi - brauzer yuborgan `Content-Type`
 * yoki fayl nomiga ishonilmaydi. SVG va boshqa turlar qabul qilinmaydi.
 */
export function detectPhotoType(bytes: Uint8Array): PhotoMimeType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  // "RIFF" <4 bayt hajm> "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return "image/webp";
  }
  return null;
}
