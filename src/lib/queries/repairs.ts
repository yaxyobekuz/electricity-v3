import "server-only";

import { prisma } from "@/lib/db/prisma";
import { REPAIR_TYPE_LABEL, type RepairType } from "@/lib/domain/labels";

import { transformerScopeWhere, type Db, type EntityRef, type Scope } from "./scope";

/*
 * Ta'mir ishlari - faqat TP holatidagi ikki sana: "Joriy ta'mir sanasi" va
 * "To'la ta'mir sanasi". Holat sanadan: davrning hisobot sanasigacha (u ham
 * kiradi) - "Bajarilgan", keyin - "Rejalashtirilgan" (malumotlar.md 5-bo'lim).
 */

export { REPAIR_TYPE_LABEL, type RepairType };

export interface RepairRow {
  /** `${transformerId}:${type}` */
  id: string;
  transformer: EntityRef;
  feeder: EntityRef;
  substation: EntityRef;
  type: RepairType;
  label: string;
  /** ISO. */
  date: string;
  /** `date <= Period.reportDate`. */
  done: boolean;
  staff: EntityRef | null;
}

export interface RepairList {
  /** Davrning hisobot sanasi (ISO); davr topilmasa - null. */
  reportDate: string | null;
  /** Sana bo'yicha o'sish tartibida. */
  rows: RepairRow[];
  counts: { done: number; planned: number };
}

export async function listRepairs(periodId: string, scope?: Scope, db: Db = prisma): Promise<RepairList> {
  const [period, snapshots] = await Promise.all([
    db.period.findUnique({ where: { id: periodId }, select: { reportDate: true } }),
    db.transformerSnapshot.findMany({
      where: {
        periodId,
        ...transformerScopeWhere(scope),
        OR: [{ currentRepairDate: { not: null } }, { overhaulDate: { not: null } }],
      },
      select: {
        transformerId: true,
        currentRepairDate: true,
        overhaulDate: true,
        staff: { select: { id: true, name: true } },
        transformer: {
          select: {
            name: true,
            feeder: { select: { id: true, name: true } },
            substation: { select: { id: true, name: true } },
          },
        },
      },
    }),
  ]);
  if (!period) return { reportDate: null, rows: [], counts: { done: 0, planned: 0 } };

  const reportTime = period.reportDate.getTime();
  const rows: RepairRow[] = [];
  for (const snap of snapshots) {
    const dates: [RepairType, Date | null][] = [
      ["CURRENT", snap.currentRepairDate],
      ["OVERHAUL", snap.overhaulDate],
    ];
    for (const [type, date] of dates) {
      if (!date) continue;
      rows.push({
        id: `${snap.transformerId}:${type}`,
        transformer: { id: snap.transformerId, name: snap.transformer.name },
        feeder: snap.transformer.feeder,
        substation: snap.transformer.substation,
        type,
        label: REPAIR_TYPE_LABEL[type],
        date: date.toISOString(),
        done: date.getTime() <= reportTime,
        staff: snap.staff,
      });
    }
  }
  rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.transformer.name.localeCompare(b.transformer.name, "uz") ||
      a.id.localeCompare(b.id),
  );

  const done = rows.filter((row) => row.done).length;
  return {
    reportDate: period.reportDate.toISOString(),
    rows,
    counts: { done, planned: rows.length - done },
  };
}
