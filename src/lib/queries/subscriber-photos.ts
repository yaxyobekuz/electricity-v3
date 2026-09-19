import "server-only";

import type { SubscriberPhotoKind } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { type PhotoMimeType, photoUrl } from "@/lib/domain/photos";

import type { Db } from "./scope";

/*
 * Abonent rasmlari (`SubscriberPhoto`): abonent sahifasidan qo'lda yuklanadi,
 * oyga bog'liq emas - abonentda har turdan bitta (`malumotlar.md` 1-bo'lim).
 * Sahifaga faqat manzil va sana boradi, baytlar -
 * `/api/subscribers/<id>/photos/<tur>` orqali.
 */

export interface SubscriberPhotoInfo {
  /** `?v=` bilan: rasm almashsa manzil ham almashadi. */
  url: string;
  /** Oxirgi yuklangan vaqt, ISO. */
  updatedAt: string;
  /** Bayt. */
  size: number;
}

export type SubscriberPhotos = Record<SubscriberPhotoKind, SubscriberPhotoInfo | null>;

function toInfo(subscriberId: string, kind: SubscriberPhotoKind, row: { updatedAt: Date; size: number }): SubscriberPhotoInfo {
  return {
    url: photoUrl(subscriberId, kind, String(row.updatedAt.getTime())),
    updatedAt: row.updatedAt.toISOString(),
    size: row.size,
  };
}

/** Abonentning ikkala rasmi (yo'g'i - null); baytlar olinmaydi. */
export async function getSubscriberPhotos(subscriberId: string, db: Db = prisma): Promise<SubscriberPhotos> {
  const rows = await db.subscriberPhoto.findMany({
    where: { subscriberId },
    select: { kind: true, updatedAt: true, size: true },
  });
  const photos: SubscriberPhotos = { SUBSCRIBER: null, METER: null };
  for (const row of rows) photos[row.kind] = toInfo(subscriberId, row.kind, row);
  return photos;
}

/** Rasm baytlari (API javobi uchun); rasm yo'q - null. */
export function readSubscriberPhoto(subscriberId: string, kind: SubscriberPhotoKind, db: Db = prisma) {
  return db.subscriberPhoto.findUnique({
    where: { subscriberId_kind: { subscriberId, kind } },
    select: { mimeType: true, data: true, size: true },
  });
}

/**
 * Rasmni saqlaydi - shu turdagi eski rasm almashtiriladi. Tur va hajm
 * chaqiruvchida (API) tekshirilgan bo'lishi kerak. Abonent topilmasa - null.
 */
export async function saveSubscriberPhoto(
  subscriberId: string,
  kind: SubscriberPhotoKind,
  mimeType: PhotoMimeType,
  data: Uint8Array<ArrayBuffer>,
  db: Db = prisma,
): Promise<SubscriberPhotoInfo | null> {
  const subscriber = await db.subscriber.findUnique({ where: { id: subscriberId }, select: { id: true } });
  if (!subscriber) return null;
  const row = await db.subscriberPhoto.upsert({
    where: { subscriberId_kind: { subscriberId, kind } },
    create: { subscriberId, kind, mimeType, data, size: data.byteLength },
    update: { mimeType, data, size: data.byteLength },
    select: { updatedAt: true, size: true },
  });
  return toInfo(subscriberId, kind, row);
}

/** O'chirildi - true; o'chiradigan rasm yo'q edi - false. */
export async function deleteSubscriberPhoto(
  subscriberId: string,
  kind: SubscriberPhotoKind,
  db: Db = prisma,
): Promise<boolean> {
  const { count } = await db.subscriberPhoto.deleteMany({ where: { subscriberId, kind } });
  return count > 0;
}
