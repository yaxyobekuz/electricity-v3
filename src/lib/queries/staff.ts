import "server-only";

import type { TemplateType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";

import { amount, periodUploads, type Db } from "./scope";

/*
 * Xodimlar faoliyati - tanlangan oy holatlari va yozuvlarida uchragan har bir
 * xodim. Shablonlarda xodim haqida faqat F.I.Sh. bor: lavozim, bo'lim va
 * boshqa ma'lumotlar ko'rsatilmaydi (malumotlar.md 8-bo'lim).
 */

export interface StaffActivityRow {
  id: string;
  name: string;
  /** "Ma'sul xodim" bo'lgan podstansiya holatlari. */
  substations: number;
  /** "Ma'sul xodim" bo'lgan fider holatlari. */
  feeders: number;
  /** "Ma'sul xodim" bo'lgan TP holatlari. */
  transformers: number;
  /** "Biriktirilgan xodim" bo'lgan abonentlar. */
  subscribers: number;
  /** "Ma'sul xodim" bo'lgan qoidabuzarliklar. */
  violations: number;
  /** Shu qoidabuzarliklardagi zarar, so'm. */
  damageUzs: number;
  /** "Ma'sul xodim" bo'lgan murojaatlar. */
  appeals: number;
  /** Shulardan "Muddati buzilgan". */
  appealsOverdue: number;
}

export interface StaffActivity {
  /**
   * Shu oyga yuklangan shablonlar. Yuklanmagan shablon ustunidagi 0 -
   * "ma'lumot yo'q" (sahifa bu ustunni ko'rsatmaydi).
   */
  uploads: Record<TemplateType, boolean>;
  /** Xodim nomi bo'yicha saralangan. */
  rows: StaffActivityRow[];
  /** Ustunlar yig'indisi; `staff` - xodimlar soni. Xodimi ko'rsatilmagan yozuvlar kirmaydi. */
  totals: Omit<StaffActivityRow, "id" | "name"> & { staff: number };
}

export async function listStaffActivity(periodId: string, db: Db = prisma): Promise<StaffActivity> {
  const withStaff = { periodId, staffId: { not: null } };
  const [uploads, substations, feeders, transformers, subscribers, violations, appeals] = await Promise.all([
    periodUploads(periodId, db),
    db.substationSnapshot.groupBy({ by: ["staffId"], where: withStaff, _count: { _all: true } }),
    db.feederSnapshot.groupBy({ by: ["staffId"], where: withStaff, _count: { _all: true } }),
    db.transformerSnapshot.groupBy({ by: ["staffId"], where: withStaff, _count: { _all: true } }),
    db.subscriberSnapshot.groupBy({ by: ["staffId"], where: withStaff, _count: { _all: true } }),
    db.violation.groupBy({
      by: ["staffId"],
      where: withStaff,
      _count: { _all: true },
      _sum: { damageUzs: true },
    }),
    db.appeal.groupBy({ by: ["staffId", "status"], where: withStaff, _count: { _all: true } }),
  ]);

  const activity = new Map<string, Omit<StaffActivityRow, "name">>();
  const entry = (staffId: string | null) => {
    const id = staffId!;
    let row = activity.get(id);
    if (!row) {
      row = {
        id,
        substations: 0,
        feeders: 0,
        transformers: 0,
        subscribers: 0,
        violations: 0,
        damageUzs: 0,
        appeals: 0,
        appealsOverdue: 0,
      };
      activity.set(id, row);
    }
    return row;
  };
  for (const group of substations) entry(group.staffId).substations += group._count._all;
  for (const group of feeders) entry(group.staffId).feeders += group._count._all;
  for (const group of transformers) entry(group.staffId).transformers += group._count._all;
  for (const group of subscribers) entry(group.staffId).subscribers += group._count._all;
  for (const group of violations) {
    const row = entry(group.staffId);
    row.violations += group._count._all;
    row.damageUzs += amount(group._sum.damageUzs);
  }
  for (const group of appeals) {
    const row = entry(group.staffId);
    row.appeals += group._count._all;
    if (group.status === "OVERDUE") row.appealsOverdue += group._count._all;
  }

  const staff = await db.staff.findMany({
    where: { id: { in: [...activity.keys()] } },
    select: { id: true, name: true },
  });
  const names = new Map(staff.map((member) => [member.id, member.name]));

  const rows = [...activity.values()]
    .map((row) => ({ ...row, name: names.get(row.id) ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name, "uz") || a.id.localeCompare(b.id));

  const totals: StaffActivity["totals"] = {
    staff: rows.length,
    substations: 0,
    feeders: 0,
    transformers: 0,
    subscribers: 0,
    violations: 0,
    damageUzs: 0,
    appeals: 0,
    appealsOverdue: 0,
  };
  for (const row of rows) {
    totals.substations += row.substations;
    totals.feeders += row.feeders;
    totals.transformers += row.transformers;
    totals.subscribers += row.subscribers;
    totals.violations += row.violations;
    totals.damageUzs += row.damageUzs;
    totals.appeals += row.appeals;
    totals.appealsOverdue += row.appealsOverdue;
  }
  return { uploads, rows, totals };
}
