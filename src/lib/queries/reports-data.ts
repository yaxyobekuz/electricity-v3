import "server-only";

import type { TemplateType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import {
  APPEAL_STATUS_LABEL,
  APPEAL_STATUS_ORDER,
  VIOLATOR_TYPE_LABEL,
  VIOLATOR_TYPE_ORDER,
} from "@/lib/domain/labels";
import { delta, lossPercent, sum } from "@/lib/domain/metrics";
import { count, EMPTY, energy, formatDate, formatDateTime, money, percent } from "@/lib/format";
import type { PeriodInfo } from "@/lib/period";
import { periodRangeLabel } from "@/lib/reports/period-range";
import { asciiSlug } from "@/lib/reports/text";
import {
  MONTHLY_SERIES_TITLE,
  NOT_UPLOADED,
  REPORT_PERIOD_LABEL,
  type ReportPeriod,
  type ReportSeries,
  type ReportSeriesRow,
  type ReportSummaryItem,
  type ReportTone,
  type ReportTransformerRow,
  type ScopeReport,
  YEARLY_SERIES_TITLE,
} from "@/lib/reports/types";

import { getFeeder, getSubstation, getTransformer } from "./entities";
import { listTransformers, listViolations } from "./lists";
import { getScopeComparison, getScopeSeries, type Db, type Scope, type ScopeSummary } from "./scope";

/*
 * `/api/reports` uchun hisobot modeli (`ScopeReport`). Har bir son sahifalar
 * ishlatadigan so'rovlardan olinadi (`getScopeComparison`, `getScopeSeries`,
 * `list*`) - fayldagi qiymat obyekt sahifasidagi qiymat bilan bir xil.
 * Qoidalar: `.claude/docs/malumotlar.md` 5-bo'lim.
 */

/** Tuman nomi - shablonlarda yo'q, platforma bitta tuman uchun. */
export const DISTRICT_NAME = "Baliqchi tumani";

// ---------------------------------------------------------------------------
// Qamrov obyekti
// ---------------------------------------------------------------------------

interface ScopeHeader {
  name: string;
  context: string;
  responsible: string | null;
}

/** Qamrov nomi, ota obyektlari va mas'ul xodimi. Obyekt topilmasa - null. */
async function scopeHeader(scope: Scope, periodId: string, db: Db): Promise<ScopeHeader | null> {
  switch (scope.kind) {
    case "district":
      return { name: DISTRICT_NAME, context: "Tuman bo’yicha yig’ma hisobot", responsible: null };
    case "substation": {
      const row = await getSubstation(scope.id, periodId, db);
      if (!row) return null;
      return {
        name: `${row.name} podstansiyasi`,
        context: DISTRICT_NAME,
        responsible: row.snapshot?.staff?.name ?? null,
      };
    }
    case "feeder": {
      const row = await getFeeder(scope.id, periodId, db);
      if (!row) return null;
      return {
        name: `${row.name} fideri`,
        context: `${DISTRICT_NAME} · ${row.substation.name} podstansiyasi`,
        responsible: row.snapshot?.staff?.name ?? null,
      };
    }
    case "transformer": {
      const row = await getTransformer(scope.id, periodId, db);
      if (!row) return null;
      return {
        name: `${row.name} transformatori`,
        context: `${row.substation.name} podstansiyasi · ${row.feeder.name} fideri`,
        responsible: row.snapshot?.staff?.name ?? null,
      };
    }
  }
}

/** Qamrov obyektining energiya ko'rsatkichlari qaysi shablondan. */
const ENERGY_TEMPLATE: Record<Scope["kind"], TemplateType> = {
  district: "SUBSTATIONS",
  substation: "SUBSTATIONS",
  feeder: "FEEDERS",
  transformer: "TRANSFORMERS",
};

const TEMPLATE_MISSING: Record<TemplateType, string> = {
  SUBSTATIONS: "Podstansiyalar yuklanmagan",
  FEEDERS: "Fiderlar yuklanmagan",
  TRANSFORMERS: "Transformatorlar yuklanmagan",
  SUBSCRIBERS: "Abonentlar ro’yxati yuklanmagan",
  VIOLATIONS: "Qoidabuzarliklar yuklanmagan",
  APPEALS: "Murojaatlar yuklanmagan",
};

// ---------------------------------------------------------------------------
// Umumiy ko'rsatkichlar (6 ta karta)
// ---------------------------------------------------------------------------

const NO_PREVIOUS = "O’tgan oy ma’lumoti yo’q";

function signed(text: string, diff: number): string {
  return diff > 0 ? `+${text}` : text;
}

/** O'sish yomon bo'lgan ko'rsatkich (yo'qotish, qarzdorlik) uchun ohang. */
function toneOf(diff: number, increaseIsBad: boolean): ReportTone {
  if (!increaseIsBad || diff === 0) return "neutral";
  return diff > 0 ? "bad" : "good";
}

interface MetricInput {
  label: string;
  current: number | null;
  previous: number | null;
  /** `current` null bo'lganda izoh. */
  missing: string;
  format: (value: number) => string;
  /** Farq matni; berilmasa - foizdagi o'zgarish (oldingi 0 bo'lsa - `format(diff)`). */
  diffText?: (diff: number) => string;
  /** To'liq izoh matni (farq o'rniga o'tgan oy qiymati). */
  previousHint?: (previous: number) => string;
  increaseIsBad: boolean;
}

function metricItem(input: MetricInput): ReportSummaryItem {
  if (input.current == null) {
    return { label: input.label, value: EMPTY, hint: input.missing, tone: "neutral" };
  }
  const change = delta(input.current, input.previous);
  if (!change || input.previous == null) {
    return { label: input.label, value: input.format(input.current), hint: NO_PREVIOUS, tone: "neutral" };
  }
  let hint: string;
  if (input.previousHint) {
    hint = input.previousHint(input.previous);
  } else {
    const text = input.diffText
      ? input.diffText(change.diff)
      : change.percent != null
        ? signed(percent(change.percent), change.diff)
        : signed(input.format(change.diff), change.diff);
    hint = `O’tgan oyga nisbatan ${text}`;
  }
  return {
    label: input.label,
    value: input.format(input.current),
    hint,
    tone: toneOf(change.diff, input.increaseIsBad),
  };
}

function energyMissing(scope: Scope, summary: ScopeSummary): string {
  const template = ENERGY_TEMPLATE[scope.kind];
  return summary.uploads[template] ? "Shu oyda ma’lumot yo’q" : TEMPLATE_MISSING[template];
}

function buildSummary(scope: Scope, current: ScopeSummary, previous: ScopeSummary | null): ReportSummaryItem[] {
  const missing = energyMissing(scope, current);
  const lossShareMissing = current.energy ? "Umumiy oqim nolga teng" : missing;
  const previousDebt = previous?.subscriberList.uploaded ? previous.subscriberList.debtUzs : null;

  return [
    metricItem({
      label: "Umumiy oqim",
      current: current.energy?.totalKwh ?? null,
      previous: previous?.energy?.totalKwh ?? null,
      missing,
      format: energy,
      increaseIsBad: false,
    }),
    metricItem({
      label: "Foydali oqim",
      current: current.energy?.usefulKwh ?? null,
      previous: previous?.energy?.usefulKwh ?? null,
      missing,
      format: energy,
      increaseIsBad: false,
    }),
    metricItem({
      label: "Yo’qotish",
      current: current.energy?.lossKwh ?? null,
      previous: previous?.energy?.lossKwh ?? null,
      missing,
      format: energy,
      increaseIsBad: true,
    }),
    metricItem({
      label: "Yo’qotish ulushi",
      current: current.energy?.lossPercent ?? null,
      previous: previous?.energy?.lossPercent ?? null,
      missing: lossShareMissing,
      format: (value) => percent(value, 2),
      // Foizning foizdagi o'zgarishi chalkash - o'tgan oy qiymati ko'rsatiladi.
      previousHint: (previousValue) => `O’tgan oy: ${percent(previousValue, 2)}`,
      increaseIsBad: true,
    }),
    metricItem({
      label: "Abonentlar",
      current: current.subscribers?.total ?? null,
      previous: previous?.subscribers?.total ?? null,
      missing: TEMPLATE_MISSING.TRANSFORMERS,
      format: count,
      diffText: (diff) => signed(count(diff), diff),
      increaseIsBad: false,
    }),
    metricItem({
      label: "Qarzdorlik",
      current: current.subscriberList.uploaded ? current.subscriberList.debtUzs : null,
      previous: previousDebt,
      missing: TEMPLATE_MISSING.SUBSCRIBERS,
      format: money,
      diffText: (diff) => signed(money(diff), diff),
      increaseIsBad: true,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Oqim jadvali
// ---------------------------------------------------------------------------

function totalsRow(label: string, rows: readonly ReportSeriesRow[]): ReportSeriesRow {
  const totalKwh = sum(rows.map((row) => row.totalKwh));
  const lossKwh = sum(rows.map((row) => row.lossKwh));
  return {
    label,
    totalKwh,
    usefulKwh: sum(rows.map((row) => row.usefulKwh)),
    lossKwh,
    lossPercent: lossPercent(totalKwh, lossKwh),
  };
}

function seriesRow(label: string, row: { totalKwh: number; usefulKwh: number; lossKwh: number; lossPercent: number | null }): ReportSeriesRow {
  return { label, totalKwh: row.totalKwh, usefulKwh: row.usefulKwh, lossKwh: row.lossKwh, lossPercent: row.lossPercent };
}

const SNAPSHOT_ENERGY = { rowNumber: true, totalKwh: true, usefulKwh: true, lossKwh: true } as const;

/** Holat qatori (Decimal) -> jadval qatori. `energyFields` (lists.ts) bilan bir xil hisob. */
function snapshotRow(
  label: string,
  row: { totalKwh: { toNumber(): number }; usefulKwh: { toNumber(): number }; lossKwh: { toNumber(): number } },
): ReportSeriesRow {
  const totalKwh = row.totalKwh.toNumber();
  const lossKwh = row.lossKwh.toNumber();
  return { label, totalKwh, usefulKwh: row.usefulKwh.toNumber(), lossKwh, lossPercent: lossPercent(totalKwh, lossKwh) };
}

/*
 * Podstansiya va fider qatorlari `listSubstations` / `listFeeders` o'rniga
 * to'g'ridan-to'g'ri holatlardan o'qiladi: ularga faqat oqim kerak, ro'yxat
 * funksiyalaridagi ichma-ich xom SQL bo'laklari (`Prisma.raw` / `Prisma.sql`)
 * esa ishlab turgan dev serverda parametr sifatida yuborilib, sintaksis
 * xatosi bilan tushgan. Manba va tartib bir xil (`*Snapshot`, `rowNumber`),
 * qiymatlar ro'yxat funksiyalari bilan skriptda solishtirilgan.
 */

/** Oylik: qamrovning shu oydagi bola obyektlari (tuman -> podstansiyalar, ...). */
async function monthlySeries(scope: Scope, period: PeriodInfo, summary: ScopeSummary, db: Db): Promise<ReportSeries> {
  const { uploads } = summary;
  switch (scope.kind) {
    case "district": {
      const rows = uploads.SUBSTATIONS
        ? (
            await db.substationSnapshot.findMany({
              where: { periodId: period.id },
              orderBy: { rowNumber: "asc" },
              select: { ...SNAPSHOT_ENERGY, substation: { select: { name: true } } },
            })
          ).map((row) => snapshotRow(row.substation.name, row))
        : null;
      return {
        title: MONTHLY_SERIES_TITLE.district,
        column: "Podstansiya",
        rows,
        totals: rows && rows.length > 0 ? totalsRow("Podstansiyalar jami", rows) : null,
        emptyText: "Shu oyda podstansiya yo’q",
      };
    }
    case "substation": {
      const rows = uploads.FEEDERS
        ? (
            await db.feederSnapshot.findMany({
              where: { periodId: period.id, feeder: { substationId: scope.id } },
              orderBy: { rowNumber: "asc" },
              select: { ...SNAPSHOT_ENERGY, feeder: { select: { name: true } } },
            })
          ).map((row) => snapshotRow(row.feeder.name, row))
        : null;
      return {
        title: MONTHLY_SERIES_TITLE.substation,
        column: "Fider",
        rows,
        totals: rows && rows.length > 0 ? totalsRow("Fiderlar jami", rows) : null,
        emptyText: "Shu oyda podstansiyada fider yo’q",
      };
    }
    case "feeder": {
      const rows = uploads.TRANSFORMERS
        ? (await listTransformers(period.id, { feederId: scope.id }, db)).map((row) => seriesRow(row.name, row))
        : null;
      return {
        title: MONTHLY_SERIES_TITLE.feeder,
        column: "Transformator",
        rows,
        totals: rows && rows.length > 0 ? totalsRow("TP lar jami", rows) : null,
        emptyText: "Shu oyda fiderda TP yo’q",
      };
    }
    case "transformer": {
      const detail = uploads.TRANSFORMERS ? await getTransformer(scope.id, period.id, db) : null;
      const rows = uploads.TRANSFORMERS
        ? detail?.snapshot
          ? [seriesRow(detail.name, detail.snapshot)]
          : []
        : null;
      return {
        title: MONTHLY_SERIES_TITLE.transformer,
        column: "Transformator",
        rows,
        totals: null,
        emptyText: "Shu oyda TP ma’lumoti yo’q",
      };
    }
  }
}

/** Yillik: tanlangan oygacha (u ham) eng ko'pi 12 oy, ma'lumoti bor oylar. */
async function yearlySeries(scope: Scope, history: readonly PeriodInfo[], db: Db): Promise<ReportSeries> {
  const points = await getScopeSeries(scope, history, db);
  const rows = points
    .filter((point) => point.hasData)
    .map((point) =>
      seriesRow(point.fullLabel, {
        totalKwh: point.totalKwh ?? 0,
        usefulKwh: point.usefulKwh ?? 0,
        lossKwh: point.lossKwh ?? 0,
        lossPercent: point.lossPercent,
      }),
    );
  return {
    title: YEARLY_SERIES_TITLE,
    column: "Oy",
    rows,
    totals: rows.length > 1 ? totalsRow(`Jami (${rows.length} oy)`, rows) : null,
    emptyText: NOT_UPLOADED,
  };
}

// ---------------------------------------------------------------------------
// Hisobot
// ---------------------------------------------------------------------------

async function transformerRows(scope: Scope, periodId: string, db: Db): Promise<ReportTransformerRow[]> {
  let filters: { substationId?: string; feederId?: string } = {};
  if (scope.kind === "substation") filters = { substationId: scope.id };
  else if (scope.kind === "feeder") filters = { feederId: scope.id };
  else if (scope.kind === "transformer") {
    // TP qamrovi: uning fideridagi ro'yxat, keyin faqat shu TP (sarlavha bilan bir xil keshli so'rov).
    const detail = await getTransformer(scope.id, periodId, db);
    if (!detail) return [];
    filters = { feederId: detail.feeder.id };
  }
  const rows = await listTransformers(periodId, filters, db);
  return rows
    .filter((row) => scope.kind !== "transformer" || row.id === scope.id)
    .map((row) => ({
      name: row.name,
      substation: row.substation.name,
      feeder: row.feeder.name,
      totalKwh: row.totalKwh,
      usefulKwh: row.usefulKwh,
      lossKwh: row.lossKwh,
      lossPercent: row.lossPercent,
      subscribers: row.onlineSubscribers + row.offlineSubscribers,
    }));
}

async function violationSection(scope: Scope, periodId: string, db: Db): Promise<ScopeReport["violations"]> {
  const list = await listViolations(periodId, { scope }, db);
  if (!list.uploaded) return null;
  const rows = VIOLATOR_TYPE_ORDER.map((type) => {
    const records = list.rows.filter((row) => row.violatorType === type);
    return {
      label: VIOLATOR_TYPE_LABEL[type],
      count: records.length,
      damageUzs: sum(records.map((row) => row.damageUzs)),
      damageKwh: sum(records.map((row) => row.damageKwh)),
    };
  });
  return {
    rows,
    total: {
      label: "Jami",
      count: list.totals.total,
      damageUzs: list.totals.damageUzs,
      damageKwh: list.totals.damageKwh,
    },
  };
}

function appealSection(summary: ScopeSummary): ScopeReport["appeals"] {
  if (!summary.appeals.uploaded) return null;
  return {
    rows: APPEAL_STATUS_ORDER.map((status) => ({
      label: APPEAL_STATUS_LABEL[status],
      count: summary.appeals.byStatus[status],
    })),
    total: { label: "Jami", count: summary.appeals.total },
  };
}

export interface ScopeReportInput {
  scope: Scope;
  reportPeriod: ReportPeriod;
  /** Hisobot oyi. */
  period: PeriodInfo;
  /** Yillik hisobot oylari: `getPeriodsUntil(period, 12)` (eskidan yangiga). */
  history: readonly PeriodInfo[];
  /** Shakllantirish vaqti. */
  now: Date;
}

/** Qamrov bo'yicha hisobot. Qamrov obyekti bazada topilmasa - null (404). */
export async function buildScopeReport(input: ScopeReportInput, db: Db = prisma): Promise<ScopeReport | null> {
  const { scope, reportPeriod, period, history, now } = input;
  const header = await scopeHeader(scope, period.id, db);
  if (!header) return null;

  const comparison = await getScopeComparison(scope, period, db);
  const { current } = comparison;

  const [series, transformers, violations] = await Promise.all([
    reportPeriod === "monthly" ? monthlySeries(scope, period, current, db) : yearlySeries(scope, history, db),
    current.uploads.TRANSFORMERS ? transformerRows(scope, period.id, db) : Promise.resolve(null),
    violationSection(scope, period.id, db),
  ]);

  const title = `${REPORT_PERIOD_LABEL[reportPeriod]} hisobot`;
  const periodLabel =
    reportPeriod === "monthly" ? period.label : periodRangeLabel(history.map((item) => item.month));
  const kindWord = reportPeriod === "monthly" ? "oylik" : "yillik";

  return {
    period: reportPeriod,
    scopeKind: scope.kind,
    title,
    scopeName: header.name,
    scopeContext: header.context,
    monthKey: period.key,
    monthLabel: period.label,
    periodLabel,
    reportDate: formatDate(period.reportDate),
    responsible: header.responsible,
    generatedAt: formatDateTime(now),
    summary: buildSummary(scope, current, comparison.previous),
    series,
    transformers,
    violations,
    appeals: appealSection(current),
    fileName: {
      ascii: `${asciiSlug(header.name)}-${kindWord}-hisobot-${period.key}`,
      unicode: `${header.name} - ${kindWord} hisobot - ${period.key}`,
    },
  };
}
