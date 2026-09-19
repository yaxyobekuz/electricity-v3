import "server-only";

import type { AppealStatus, ViolatorType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";

import { amount, iso, periodUploads, uploadsMany, type Db, type EntityRef } from "./scope";

/*
 * Abonent sahifasi uchun:
 *   - tanlangan oyda shu abonentga bog'langan (`subscriberId`)
 *     qoidabuzarliklar va murojaatlar, hamda ularning oylar bo'yicha soni.
 *     Bog'lash qoidasi - `.claude/docs/malumotlar.md` 3-bo'lim: nom shu oyda
 *     shu TP abonentlari orasida aynan bitta topilgan bo'lsa. Bog'lanmagan
 *     yozuvlar bu yerga tushmaydi (ular faqat matn sifatida ro'yxat
 *     sahifalarida);
 *   - holatning manbasi: yuklangan fayl va `sourceRow` dagi asl yozuvlar
 *     (malumotlar.md 4.3c).
 */

const STAFF_SELECT = { select: { id: true, name: true } } as const;
const TRANSFORMER_SELECT = { select: { id: true, name: true } } as const;

export interface SubscriberViolationRow {
  id: string;
  /** "Sana", ISO. */
  date: string;
  violatorType: ViolatorType;
  damageUzs: number;
  damageKwh: number;
  address: string | null;
  /** TP aniqlanmagan bo'lsa null (malumotlar.md 4.3d). */
  transformer: EntityRef | null;
  staff: EntityRef | null;
}

export interface SubscriberAppealRow {
  id: string;
  /** "Sana", ISO. */
  date: string;
  text: string;
  status: AppealStatus;
  address: string | null;
  /** TP aniqlanmagan bo'lsa null (malumotlar.md 4.3d). */
  transformer: EntityRef | null;
  staff: EntityRef | null;
}

export interface SubscriberRelated {
  violations: {
    /** Qoidabuzarliklar shabloni shu oyga yuklangan ("yo'q" va "yuklanmagan" farqi). */
    uploaded: boolean;
    rows: SubscriberViolationRow[];
  };
  appeals: {
    /** Murojaatlar shabloni shu oyga yuklangan. */
    uploaded: boolean;
    rows: SubscriberAppealRow[];
  };
}

/** Tanlangan oyda abonentga bog'langan qoidabuzarlik va murojaatlar, yangidan eskiga. */
export async function getSubscriberRelated(
  subscriberId: string,
  periodId: string,
  db: Db = prisma,
): Promise<SubscriberRelated> {
  const where = { periodId, subscriberId };
  const orderBy = [{ date: "desc" as const }, { rowNumber: "asc" as const }];
  const [uploads, violations, appeals] = await Promise.all([
    periodUploads(periodId, db),
    db.violation.findMany({
      where,
      orderBy,
      select: {
        id: true,
        date: true,
        violatorType: true,
        damageUzs: true,
        damageKwh: true,
        address: true,
        transformer: TRANSFORMER_SELECT,
        staff: STAFF_SELECT,
      },
    }),
    db.appeal.findMany({
      where,
      orderBy,
      select: {
        id: true,
        date: true,
        text: true,
        status: true,
        address: true,
        transformer: TRANSFORMER_SELECT,
        staff: STAFF_SELECT,
      },
    }),
  ]);

  return {
    violations: {
      uploaded: uploads.VIOLATIONS,
      rows: violations.map((row) => ({
        id: row.id,
        date: row.date.toISOString(),
        violatorType: row.violatorType,
        damageUzs: amount(row.damageUzs),
        damageKwh: amount(row.damageKwh),
        address: row.address,
        transformer: row.transformer,
        staff: row.staff,
      })),
    },
    appeals: {
      uploaded: uploads.APPEALS,
      rows: appeals.map((row) => ({
        id: row.id,
        date: row.date.toISOString(),
        text: row.text,
        status: row.status,
        address: row.address,
        transformer: row.transformer,
        staff: row.staff,
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Oylar bo'yicha sonlar (KPI ustunchalari)
// ---------------------------------------------------------------------------

export interface SubscriberEventPoint {
  periodId: string;
  /** Qoidabuzarliklar shu oyga yuklanmagan bo'lsa - null ("0" emas). */
  violations: number | null;
  /** Murojaatlar shu oyga yuklanmagan bo'lsa - null. */
  appeals: number | null;
}

/** Berilgan davrlar tartibida abonentga bog'langan qoidabuzarlik va murojaatlar soni. */
export async function getSubscriberEventSeries(
  subscriberId: string,
  periodIds: readonly string[],
  db: Db = prisma,
): Promise<SubscriberEventPoint[]> {
  if (periodIds.length === 0) return [];
  const where = { subscriberId, periodId: { in: [...periodIds] } };
  const [uploads, violations, appeals] = await Promise.all([
    uploadsMany(periodIds, db),
    db.violation.groupBy({ by: ["periodId"], where, _count: { _all: true } }),
    db.appeal.groupBy({ by: ["periodId"], where, _count: { _all: true } }),
  ]);
  const countOf = (groups: readonly { periodId: string; _count: { _all: number } }[], periodId: string) =>
    groups.find((group) => group.periodId === periodId)?._count._all ?? 0;
  return periodIds.map((periodId) => {
    const uploaded = uploads.get(periodId);
    return {
      periodId,
      violations: uploaded?.VIOLATIONS ? countOf(violations, periodId) : null,
      appeals: uploaded?.APPEALS ? countOf(appeals, periodId) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Ma'lumot manbasi
// ---------------------------------------------------------------------------

/**
 * Tozalashdan oldingi asl yozuvlar - `"<Ustun> (manba)"` ustunlari
 * (malumotlar.md 4.3c). Ro'yxat ataylab yopiq: `sourceRow` dagi shaxsiy
 * ustunlar (passport, PINFL) sahifaga hech qachon chiqmaydi. `current` -
 * tozalangan qiymat ustuni (teng bo'lsa asl yozuv ko'rsatilmaydi).
 */
const ORIGINAL_FIELDS: readonly { key: string; label: string; current: string | null }[] = [
  { key: "FISH (manba)", label: "FISH", current: "FISH" },
  { key: "Shartnoma raqami (manba)", label: "Shartnoma raqami", current: "Shartnoma raqami" },
  { key: "Podstansiya (manba)", label: "Podstansiya", current: "Podstansiya" },
  { key: "Fider (manba)", label: "Fider", current: "Fider" },
  { key: "TP (manba)", label: "TP", current: "TP" },
  {
    key: "Holati (manba)",
    label: "Holati",
    current: "Holati (Aloqada / Aloqaga chiqmayotgan / Sxemasi o’zgartirilgan)",
  },
  { key: "Biriktirilgan xodim (manba)", label: "Biriktirilgan xodim", current: "Biriktirilgan xodim" },
  { key: "Manzil (manba)", label: "Manzil", current: "Manzil" },
  { key: "Lokatsiya (manba)", label: "Lokatsiya", current: null },
];

/** Konvertatsiya ustunlari: asl fayl va qator, izoh. */
const ORIGIN_KEY = "Manba (fayl, qator)";
const NOTE_KEY = "Eslatma";

export interface SubscriberSource {
  /** Platformaga yuklangan fayl; yuklash yozuvi yo'q bo'lsa - null. */
  upload: { fileName: string; uploadedAt: string | null } | null;
  /** Yuklangan fayldagi Excel qator raqami. */
  rowNumber: number;
  /** Konvertatsiyadan oldingi fayl va qator: "baliqchi/Elektr Abonentlar.xlsx, 3399-qator". */
  origin: string | null;
  /** Konvertatsiya izohi ("Eslatma" ustuni). */
  note: string | null;
  /** Tozalangan qiymatdan farq qiladigan asl yozuvlar. */
  originals: { label: string; value: string }[];
}

/** JSON katak -> matn; bo'sh - null. */
function cellText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

/** Tanlangan oy holatining manbasi; holat yo'q - null. */
export async function getSubscriberSource(
  subscriberId: string,
  periodId: string,
  db: Db = prisma,
): Promise<SubscriberSource | null> {
  const snapshot = await db.subscriberSnapshot.findUnique({
    where: { periodId_subscriberId: { periodId, subscriberId } },
    select: {
      rowNumber: true,
      sourceRow: true,
      importBatch: { select: { fileName: true, createdAt: true } },
    },
  });
  if (!snapshot) return null;

  const row =
    snapshot.sourceRow && typeof snapshot.sourceRow === "object" && !Array.isArray(snapshot.sourceRow)
      ? (snapshot.sourceRow as Record<string, unknown>)
      : {};
  const originals = ORIGINAL_FIELDS.flatMap((field) => {
    const value = cellText(row[field.key]);
    if (value == null) return [];
    if (field.current != null && cellText(row[field.current]) === value) return [];
    return [{ label: field.label, value }];
  });

  return {
    upload: snapshot.importBatch
      ? { fileName: snapshot.importBatch.fileName, uploadedAt: iso(snapshot.importBatch.createdAt) }
      : null,
    rowNumber: snapshot.rowNumber,
    origin: cellText(row[ORIGIN_KEY]),
    note: cellText(row[NOTE_KEY]),
    originals,
  };
}
