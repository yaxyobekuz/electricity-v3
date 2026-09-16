import "server-only";

import type { AppealStatus, ViolatorType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";

import { amount, periodUploads, type Db, type EntityRef } from "./scope";

/*
 * Abonent sahifasi uchun: tanlangan oyda shu abonentga bog'langan
 * (`subscriberId`) qoidabuzarliklar va murojaatlar. Bog'lash qoidasi -
 * `.claude/docs/malumotlar.md` 3-bo'lim: nom shu oyda shu TP abonentlari
 * orasida aynan bitta topilgan bo'lsa. Bog'lanmagan yozuvlar bu yerga
 * tushmaydi (ular faqat matn sifatida ro'yxat sahifalarida).
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
