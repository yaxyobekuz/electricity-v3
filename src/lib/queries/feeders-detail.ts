import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getPeriodsUntil, type PeriodInfo } from "@/lib/period";

import type { FeederDetail } from "./entities";
import { listTransformers, type TransformerRow } from "./lists";
import { listRepairs, type RepairList } from "./repairs";
import {
  amount,
  getScopeComparison,
  getScopeSeries,
  transformerScopeWhere,
  uploadsMany,
  type Db,
  type ScopeComparison,
  type ScopeSeriesPoint,
} from "./scope";

/*
 * Fider detal sahifasi (`/feeders/[id]`) uchun barcha ma'lumot - bitta
 * yuklovchi. Har bir son umumiy so'rovlardan (`scope`, `lists`, `repairs`)
 * olinadi; bu faylda faqat sahifaga xos ikki qo'shimcha bor: oylar bo'yicha
 * TP soni (KPI ustunchalari) va xaritadagi tanlangan TP ning o'tgan oydagi
 * foydali oqimi (tultip izohi).
 */

export interface FeederDashboard {
  /** Shu oy va o'tgan oy (`month - 1`) xulosasi - fider qamrovida. */
  comparison: ScopeComparison;
  /** Tanlangan oygacha eng ko'pi 12 davr, eskidan yangiga. */
  series: ScopeSeriesPoint[];
  /**
   * `series` bilan bir xil tartibda: shu fiderdagi TP holatlari soni
   * (`ScopeSummary.counts.transformers` bilan bir xil ta'rif). Transformatorlar
   * shu oyga yuklanmagan bo'lsa - null.
   */
  transformerCounts: (number | null)[];
  /** Fiderning shu oydagi TP lari (fayl tartibida). */
  transformers: TransformerRow[];
  /**
   * Xaritada ajratiladigan TP: fiderdagi foydali oqimi eng katta TP (jadvalning
   * birinchi qatori). Uning koordinatasi yo'q bo'lsa - null (tultip yo'q).
   * `previousUsefulKwh` - o'sha TP ning o'tgan oydagi holati (o'tgan oy davri
   * yoki holati yo'q bo'lsa - null).
   */
  mapFocus: { transformerId: string; previousUsefulKwh: number | null } | null;
  /** Fider TP larining ta'mir sanalari. */
  repairs: RepairList;
}

/**
 * `feeder` - `getFeeder(id, period.id)` natijasi (sahifa va `generateMetadata`
 * bilan umumiy kesh). Davrlar ro'yxati `getPeriodsUntil` dan (u `db` ni
 * olmaydi); qolgan barcha so'rovlar `db` orqali.
 */
export async function getFeederDashboard(
  feeder: Pick<FeederDetail, "id">,
  period: PeriodInfo,
  db: Db = prisma,
): Promise<FeederDashboard> {
  const scope = { kind: "feeder", id: feeder.id } as const;
  const periods = await getPeriodsUntil(period, 12);
  const periodIds = periods.map((item) => item.id);

  const [comparison, series, uploads, countGroups, transformers, repairs] = await Promise.all([
    getScopeComparison(scope, period, db),
    getScopeSeries(scope, periods, db),
    uploadsMany(periodIds, db),
    // `getScopeSummary` dagi TP soni bilan bir xil filtr - faqat davrlar bo'yicha guruhlangan.
    db.transformerSnapshot.groupBy({
      by: ["periodId"],
      where: { periodId: { in: periodIds }, ...transformerScopeWhere(scope) },
      _count: { _all: true },
    }),
    listTransformers(period.id, { feederId: feeder.id }, db),
    listRepairs(period.id, scope, db),
  ]);

  const transformerCounts = periods.map((item) =>
    uploads.get(item.id)?.TRANSFORMERS
      ? (countGroups.find((group) => group.periodId === item.id)?._count._all ?? 0)
      : null,
  );

  // Eng katta foydali oqim - barcha TP lar orasidan (teng bo'lsa fayldagi
  // birinchisi), `TopTransformersCard` ning birinchi qatori bilan bir xil.
  let mapFocus: FeederDashboard["mapFocus"] = null;
  const top = transformers.reduce<TransformerRow | null>(
    (best, row) => (!best || row.usefulKwh > best.usefulKwh ? row : best),
    null,
  );
  if (top && top.lat != null && top.lng != null) {
    const previous = comparison.previousPeriod
      ? await db.transformerSnapshot.findUnique({
          where: {
            periodId_transformerId: { periodId: comparison.previousPeriod.id, transformerId: top.id },
          },
          select: { usefulKwh: true },
        })
      : null;
    mapFocus = { transformerId: top.id, previousUsefulKwh: previous ? amount(previous.usefulKwh) : null };
  }

  return { comparison, series, transformerCounts, transformers, mapFocus, repairs };
}
