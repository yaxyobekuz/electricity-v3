import "server-only";

import type { SubscriberKind } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { lossPercent, share, sum } from "@/lib/domain/metrics";
import { monthKey } from "@/lib/format";
import { getPeriodsUntil, type PeriodInfo } from "@/lib/period";
import { periodRangeLabel } from "@/lib/reports/period-range";

import { listTransformers } from "./lists";
import { amount, DISTRICT, getScopeSeries, getScopeSummary, type Db, type EntityRef } from "./scope";

/*
 * "Statistika" sahifasi uchun tuman bo'yicha tahlil. Barcha sonlar umumiy
 * so'rovlardan (`getScopeSeries`, `getScopeSummary`, `listTransformers`)
 * yoki shu oylarning `SubstationSnapshot` yig'indilaridan olinadi - tuman
 * oqimi har doim Σ podstansiya holatlari (`malumotlar.md`, 5-bo'lim).
 * Foiz faqat yig'indilardan (`lossPercent` / `share`), o'rtacha olinmaydi.
 */

/** Davr oynasi: tanlangan oy va undan oldingi 0 / 2 / 11 ta davr. */
export type StatisticsWindowId = "month" | "quarter" | "year";

const WINDOW_SIZES: ReadonlyArray<{ id: StatisticsWindowId; size: number }> = [
  { id: "month", size: 1 },
  { id: "quarter", size: 3 },
  { id: "year", size: 12 },
];

/** Dinamika uchun eng ko'pi shuncha davr (yillik oyna bilan bir xil). */
const HISTORY_LIMIT = 12;

/** Eng yomon TP jadvalidagi qatorlar soni. */
const WORST_TRANSFORMERS_LIMIT = 10;

export interface StatisticsEnergy {
  totalKwh: number;
  usefulKwh: number;
  /** Manfiy bo'lishi mumkin. */
  lossKwh: number;
  /** Σ yo'qotish / Σ umumiy oqim; umumiy oqim ≤ 0 bo'lsa - null. */
  lossPercent: number | null;
}

export interface StatisticsSubstationRow extends StatisticsEnergy {
  id: string;
  name: string;
  /** Oynadagi tuman yo'qotishidagi ulushi (%); tuman yo'qotishi ≤ 0 bo'lsa - null. */
  lossShare: number | null;
}

export interface StatisticsWindow {
  id: StatisticsWindowId;
  /** So'ralgan davrlar soni: 1 / 3 / 12. */
  requested: number;
  /** Bazada topilgan davrlar soni (≤ `requested`). */
  periods: number;
  /** Qamralgan oylar: "Sentabr 2026", "Iyul – Sentabr 2026". */
  rangeLabel: string;
  /** Podstansiyalar yuklangan (oqim ma'lumoti bor) davrlar soni. */
  energyPeriods: number;
  /** Σ podstansiya holatlari; oynada oqim ma'lumoti yo'q bo'lsa - null. */
  energy: StatisticsEnergy | null;
  /** Foydali oqimning umumiy oqimdagi ulushi (%). */
  usefulShare: number | null;
  /** Yo'qotish ulushi eng yuqori bo'lgan oy (oynada 2+ oy ma'lumoti bo'lsa). */
  peakLossMonth: { label: string; lossPercent: number } | null;
  /** Podstansiyalar oynadagi yig'indilari, foydali oqim kamayish tartibida. */
  substations: StatisticsSubstationRow[];
}

/** Oylik jadval va grafik nuqtasi (`ScopeSeriesPoint` ning mijozga kerakli qismi). */
export interface StatisticsMonth {
  /** "2026-09" */
  key: string;
  /** "Sentabr 2026" */
  label: string;
  /** "Sen" */
  short: string;
  /** Podstansiyalar shu oyga yuklangan. */
  hasData: boolean;
  totalKwh: number | null;
  usefulKwh: number | null;
  lossKwh: number | null;
  lossPercent: number | null;
  /** Transformatorlar yuklanmagan - null. */
  subscribers: number | null;
  /** Abonentlar ro'yxati yuklanmagan - null. */
  debtUzs: number | null;
  /** Qoidabuzarliklar yuklanmagan - null. */
  violations: number | null;
  /** Murojaatlar yuklanmagan - null. */
  appeals: number | null;
}

export interface StatisticsTransformerRow {
  id: string;
  name: string;
  substation: EntityRef;
  feeder: EntityRef;
  totalKwh: number;
  lossKwh: number;
  lossPercent: number;
  /** Aloqadagi + aloqadan chiqqan abonentlar (TP holatidan). */
  subscribers: number;
}

export interface StatisticsData {
  period: { key: string; label: string; reportDate: string };
  /** Oy, chorak, yil - shu tartibda. */
  windows: StatisticsWindow[];
  /** Tanlangan oygacha eng ko'pi 12 davr, eskidan yangiga. */
  months: StatisticsMonth[];
  /** `months` qamragan oylar: "Iyul – Sentabr 2026". */
  historyLabel: string;
  /** Tanlangan oy holati. */
  current: {
    /** Σ TP holatlari; Transformatorlar yuklanmagan bo'lsa - null. */
    subscribers: { total: number; online: number; offline: number } | null;
    /** Abonentlar ro'yxatidan. */
    subscriberList: {
      uploaded: boolean;
      total: number;
      byKind: Record<SubscriberKind, number>;
      debtUzs: number;
      debtByKind: Record<SubscriberKind, number>;
      debtors: number;
    };
  };
  /**
   * Tanlangan oyda yo'qotish ulushi eng yuqori TP lar (umumiy oqim > 0).
   * Transformatorlar shu oyga yuklanmagan bo'lsa - null.
   */
  worstTransformers: StatisticsTransformerRow[] | null;
  /** Umumiy oqimi > 0 bo'lgan TP lar soni (reyting shulardan). */
  rankedTransformers: number;
  /**
   * O'tgan oy (`month - 1`) oqim ko'rsatkichi - "Oy" oynasidagi izoh uchun.
   * U davr bazada yo'q yoki podstansiyalari yuklanmagan bo'lsa - null.
   */
  previousMonth: StatisticsMonth | null;
}

/** Oynadagi davrlar bo'yicha podstansiyalar yig'indisi. */
async function substationTotals(periodIds: readonly string[], db: Db): Promise<StatisticsSubstationRow[]> {
  if (periodIds.length === 0) return [];
  const groups = await db.substationSnapshot.groupBy({
    by: ["substationId"],
    where: { periodId: { in: [...periodIds] } },
    _sum: { totalKwh: true, usefulKwh: true, lossKwh: true },
  });
  if (groups.length === 0) return [];
  const names = await db.substation.findMany({
    where: { id: { in: groups.map((group) => group.substationId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(names.map((row) => [row.id, row.name]));

  const rows = groups.map((group) => {
    const totalKwh = amount(group._sum.totalKwh);
    const lossKwh = amount(group._sum.lossKwh);
    return {
      id: group.substationId,
      name: nameById.get(group.substationId) ?? "",
      totalKwh,
      usefulKwh: amount(group._sum.usefulKwh),
      lossKwh,
      lossPercent: lossPercent(totalKwh, lossKwh),
    };
  });
  const districtLoss = sum(rows.map((row) => row.lossKwh));
  return rows
    .map((row) => ({ ...row, lossShare: share(row.lossKwh, districtLoss) }))
    .sort((a, b) => b.usefulKwh - a.usefulKwh || a.name.localeCompare(b.name, "uz"));
}

async function buildWindow(
  id: StatisticsWindowId,
  size: number,
  history: readonly PeriodInfo[],
  months: readonly StatisticsMonth[],
  db: Db,
): Promise<StatisticsWindow> {
  const periods = history.slice(-size);
  const points = months.slice(-size).filter((month) => month.hasData);

  const totalKwh = sum(points.map((point) => point.totalKwh));
  const usefulKwh = sum(points.map((point) => point.usefulKwh));
  const lossKwh = sum(points.map((point) => point.lossKwh));
  const energy =
    points.length > 0 ? { totalKwh, usefulKwh, lossKwh, lossPercent: lossPercent(totalKwh, lossKwh) } : null;

  let peakLossMonth: StatisticsWindow["peakLossMonth"] = null;
  if (points.length > 1) {
    for (const point of points) {
      if (point.lossPercent == null) continue;
      if (!peakLossMonth || point.lossPercent > peakLossMonth.lossPercent) {
        peakLossMonth = { label: point.label, lossPercent: point.lossPercent };
      }
    }
  }

  return {
    id,
    requested: size,
    periods: periods.length,
    rangeLabel: periodRangeLabel(periods.map((period) => period.month)),
    energyPeriods: points.length,
    energy,
    usefulShare: energy ? share(energy.usefulKwh, energy.totalKwh) : null,
    peakLossMonth,
    substations: await substationTotals(
      periods.map((period) => period.id),
      db,
    ),
  };
}

/** Tanlangan oy uchun statistika sahifasining barcha ma'lumoti. */
export async function loadStatisticsData(period: PeriodInfo, db: Db = prisma): Promise<StatisticsData> {
  const history = await getPeriodsUntil(period, HISTORY_LIMIT);
  const [series, summary, transformers] = await Promise.all([
    getScopeSeries(DISTRICT, history, db),
    getScopeSummary(period.id, DISTRICT, db),
    listTransformers(period.id, {}, db),
  ]);

  const months: StatisticsMonth[] = series.map((point) => ({
    key: point.key,
    label: point.fullLabel,
    short: point.label,
    hasData: point.hasData,
    totalKwh: point.totalKwh,
    usefulKwh: point.usefulKwh,
    lossKwh: point.lossKwh,
    lossPercent: point.lossPercent,
    subscribers: point.subscribers,
    debtUzs: point.debtUzs,
    violations: point.violations,
    appeals: point.appeals,
  }));

  const windows = await Promise.all(
    WINDOW_SIZES.map((item) => buildWindow(item.id, item.size, history, months, db)),
  );

  const ranked = transformers
    .filter((row): row is typeof row & { lossPercent: number } => row.totalKwh > 0 && row.lossPercent != null)
    .sort((a, b) => b.lossPercent - a.lossPercent || b.lossKwh - a.lossKwh || a.name.localeCompare(b.name, "uz"));

  const { subscriberList } = summary;
  const month = new Date(period.month);
  const previousKey = monthKey(new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1)));
  const previousMonth = months.find((item) => item.key === previousKey && item.hasData) ?? null;

  return {
    period: { key: period.key, label: period.label, reportDate: period.reportDate },
    windows,
    months,
    historyLabel: periodRangeLabel(history.map((item) => item.month)),
    current: {
      subscribers: summary.subscribers,
      subscriberList: {
        uploaded: subscriberList.uploaded,
        total: subscriberList.total,
        byKind: subscriberList.byKind,
        debtUzs: subscriberList.debtUzs,
        debtByKind: subscriberList.debtByKind,
        debtors: subscriberList.debtors,
      },
    },
    worstTransformers: summary.uploads.TRANSFORMERS
      ? ranked.slice(0, WORST_TRANSFORMERS_LIMIT).map((row) => ({
          id: row.id,
          name: row.name,
          substation: row.substation,
          feeder: row.feeder,
          totalKwh: row.totalKwh,
          lossKwh: row.lossKwh,
          lossPercent: row.lossPercent,
          subscribers: row.onlineSubscribers + row.offlineSubscribers,
        }))
      : null,
    rankedTransformers: ranked.length,
    previousMonth,
  };
}
