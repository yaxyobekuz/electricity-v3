import "server-only";

import type { RepairWork } from "@/components/cards/CompletedWorksCard";
import type { DynamicsMonth } from "@/components/cards/ConsumptionDynamicsCard";
import type { TopBarItem } from "@/components/cards/TopBarsCard";
import type { MapMarker } from "@/components/map/MapCanvas";
import type { AppealStatus, MeterStatus, SubscriberKind, ViolatorType } from "@/generated/prisma";
import {
  APPEAL_STATUS_LABEL,
  APPEAL_STATUS_ORDER,
  METER_STATUS_LABEL,
  METER_STATUS_ORDER,
  SUBSCRIBER_KIND_LABEL,
  SUBSCRIBER_KIND_ORDER,
  VIOLATOR_TYPE_LABEL,
  VIOLATOR_TYPE_ORDER,
} from "@/lib/domain/labels";
import { delta, fractions, lossPercent, share, sum } from "@/lib/domain/metrics";
import {
  count,
  EMPTY,
  energy,
  formatDate,
  money,
  monthName,
  num,
  parseMonthKey,
  percent,
  scaled,
} from "@/lib/format";
import { getPeriodsUntil, type PeriodInfo } from "@/lib/period";
import { scopedHref } from "@/lib/scope-param";

import { getSubstation, getTransformer } from "./entities";
import { listFeeders, listSubstations, listTransformers, type TransformerRow } from "./lists";
import { listRepairs } from "./repairs";
import { getScopeComparison, getScopeSeries, type ScopeSeriesPoint, type ScopeSummary } from "./scope";

/*
 * "Asosiy" sahifa (`/dashboard`, tuman) va podstansiya sahifasi
 * (`/substations/[id]`) uchun bitta yuklovchi. Ikkala sahifa bir xil
 * `HomeView` ni chizadi, farqi faqat qamrovda.
 *
 * Bu yerda yangi formula yo'q: har bir son `scope.ts` / `lists.ts` /
 * `repairs.ts` / `entities.ts` dan olinadi, foiz faqat `lossPercent` /
 * `share` orqali, matn esa `format.ts` orqali. Natija - mijozga uzatsa
 * bo'ladigan oddiy obyekt (ikonka va ranglar `HomeView` da tanlanadi).
 */

export type HomeScope = { kind: "district" } | { kind: "substation"; id: string };

/** Delta qatorining bahosi: yo'qotish va qarz o'sishi - yomon. */
export type HomeTone = "bad" | "good" | "neutral";

export interface HomeTrend {
  text: string;
  direction: "up" | "down" | "flat";
  tone: HomeTone;
}

export interface HomeFlowKpi {
  id: "total" | "useful" | "loss";
  title: string;
  value: string;
  unit: string;
  /** Joriy oyda ma'lumot yo'q bo'lsa izoh ("Podstansiyalar yuklanmagan"). */
  note: string | null;
  /** "O’tgan oy: 2,2 mln kWh"; o'tgan oy bazada yo'q - null. */
  previous: string | null;
  trend: HomeTrend | null;
  bars: number[];
  barsLabel: string;
}

export interface HomeLossRate {
  id: "current" | "previous" | "year";
  value: string;
  unit: string;
  large: boolean;
}

export interface HomeKpiLine {
  id: string;
  text: string;
  /** Ikonka tanlash uchun: abonent turi. */
  kind: SubscriberKind | null;
}

export interface HomeCountKpi {
  value: string;
  unit: string;
  lines: HomeKpiLine[];
  bars: number[];
  barsLabel: string;
}

export interface HomeKpis {
  flows: HomeFlowKpi[];
  lossRates: HomeLossRate[];
  subscribers: HomeCountKpi;
  debt: HomeCountKpi;
}

export interface HomeObjectTile {
  id: "substations" | "subscribers" | "feeders" | "transformers";
  value: string;
  label: string;
  href: string;
}

export interface HomeRepairs {
  /** Transformatorlar shabloni shu oyga yuklangan. */
  uploaded: boolean;
  done: { value: string; href: string };
  planned: { value: string; href: string };
}

export interface HomeViolations {
  uploaded: boolean;
  total: { value: string; href: string };
  types: { id: ViolatorType; label: string; value: string; href: string }[];
  /** Σ "Keltirilgan zarar miqdori (UZS)"; yuklanmagan - null. */
  damage: string | null;
  href: string;
}

export interface HomeRing {
  id: string;
  label: string;
  amount: string;
  /** Ulush, % (0..100). */
  arc: number;
}

export interface HomeRingData {
  /** Shablon yuklanmagan bo'lsa - bo'sh holat matni. */
  empty: string | null;
  month: string;
  rings: HomeRing[];
  summary: { label: string; value: string } | null;
}

export interface HomeQuickMetric {
  id: "offline" | "debtors" | "credit" | "appealsInProgress" | "appealsOverdue" | "damageKwh";
  caption: string;
  value: string;
}

export interface HomeTopBars {
  id: string;
  title: string;
  items: TopBarItem[];
  unit: string;
  valueColumn: string;
  labelWidth: number;
  footerLabel: string;
  footerHref: string;
  emptyText: string;
}

export interface HomeMapTooltip {
  title: string;
  label: string;
  caption: string;
  value: string;
  note: string | null;
}

export interface HomeMap {
  markers: MapMarker[];
  selectedId: string | null;
  tooltip: HomeMapTooltip | null;
  href: string;
}

export interface HomeFilterMetrics {
  total: string;
  useful: string;
  loss: string;
}

export interface HomeFilterOption {
  id: string;
  /** Tanlov ro'yxatidagi yozuv (bir xil nomlar ota obyekt bilan ajratiladi). */
  label: string;
  substationId: string;
  feederId: string | null;
  metrics: HomeFilterMetrics;
  href: string;
}

export interface HomeFilter {
  /** Podstansiya sahifasida shu podstansiya tanlangan va qulflangan. */
  lockedSubstationId: string | null;
  substations: HomeFilterOption[];
  feeders: HomeFilterOption[];
  transformers: HomeFilterOption[];
  /** Hech narsa tanlanmaganda - sahifa qamrovining o'z qiymatlari. */
  scopeMetrics: HomeFilterMetrics;
}

export interface HomeData {
  /** "2026-09:substation:<id>" - oy yoki qamrov almashganda mijoz holati (tanlovlar) tiklanadi. */
  stateKey: string;
  kpis: HomeKpis;
  objects: { tiles: HomeObjectTile[]; repairs: HomeRepairs };
  map: HomeMap;
  filter: HomeFilter;
  violations: HomeViolations;
  meters: HomeRingData;
  appeals: HomeRingData;
  quickMetrics: HomeQuickMetric[];
  topBars: HomeTopBars[];
  dynamics: DynamicsMonth[];
  plannedWorks: { uploaded: boolean; works: RepairWork[] };
  /** `DownloadReportsCard` uchun: "month=2026-09" yoki "scope=substation:<id>&month=2026-09". */
  reportQuery: string;
}

// ---------------------------------------------------------------------------
// Yordamchilar
// ---------------------------------------------------------------------------

const TOP_LIMIT = 6;

/** Diagramma birligi eng katta qiymatga qarab (`scaled` bilan bir xil pog'onalar). */
const ENERGY_UNITS = [
  { divisor: 1_000_000, unit: "mln kWh" },
  { divisor: 1_000, unit: "ming kWh" },
  { divisor: 1, unit: "kWh" },
] as const;

function energyUnit(peak: number) {
  const abs = Math.abs(peak);
  return ENERGY_UNITS.find((item) => abs >= item.divisor) ?? ENERGY_UNITS[ENERGY_UNITS.length - 1];
}

/** Yorliq ustuni kengligi: 12px shriftda ~7px belgi (maketdagi 46 / 59 / 66px ga mos). */
function labelWidth(labels: readonly string[]): number {
  const longest = Math.max(0, ...labels.map((label) => label.length));
  return Math.min(150, Math.max(40, longest * 7 + 3));
}

/** Nomi takrorlanadigan obyektlarga ota obyekt nomi qo'shiladi. */
function distinctLabels<T extends { id: string; name: string }>(
  rows: readonly T[],
  parent: (row: T) => string,
): Map<string, string> {
  const seen = new Map<string, number>();
  for (const row of rows) seen.set(row.name, (seen.get(row.name) ?? 0) + 1);
  return new Map(
    rows.map((row) => [row.id, (seen.get(row.name) ?? 0) > 1 ? `${row.name} (${parent(row)})` : row.name]),
  );
}

/** "2,1 ming kWh" - farq qiymati uchun (fider va TP sahifalaridagi bilan bir xil). */
function kwhText(value: number): string {
  const parts = scaled(value, "kWh");
  return `${parts.value} ${parts.unit}`;
}

/**
 * O'tgan oy bilan farq qatori - fider va TP sahifalaridagi yozuv: mutlaq farq,
 * "ga ko’p" / "ga kam". Foiz o'zgarishi ishlatilmaydi: Yo'qotish kartasida
 * uni yo'qotish ulushining o'zgarishi deb o'qish oson.
 */
function trendOf(
  current: number | null | undefined,
  previous: number | null | undefined,
  risingIsBad: boolean,
): HomeTrend | null {
  const change = delta(current, previous);
  if (!change) return null;
  // Ko'rsatilgan aniqlikda solishtiriladi (fider sahifasidagi kabi): "0 kWh ga ko’p" chiqmasin.
  if (kwhText(Math.abs(change.diff)) === kwhText(0)) return { text: "O’zgarmagan", direction: "flat", tone: "neutral" };
  const up = change.diff > 0;
  return {
    text: `${kwhText(Math.abs(change.diff))} ga ${up ? "ko’p" : "kam"}`,
    direction: up ? "up" : "down",
    tone: risingIsBad ? (up ? "bad" : "good") : "neutral",
  };
}

function barsOf(series: readonly ScopeSeriesPoint[], pick: (point: ScopeSeriesPoint) => number | null) {
  return {
    bars: fractions(series.map((point) => pick(point) ?? 0)),
    barsLabel: `${series.length} oy`,
  };
}

function energyMetrics(row: { totalKwh: number; usefulKwh: number; lossKwh: number } | null): HomeFilterMetrics {
  return {
    total: row ? energy(row.totalKwh) : EMPTY,
    useful: row ? energy(row.usefulKwh) : EMPTY,
    loss: row ? energy(row.lossKwh) : EMPTY,
  };
}

/** "Iyl–Sen" (uzluksiz oylar) yoki "Iyl, Sen" (oraliqda bo'shliq bor). */
function monthsCovered(points: readonly ScopeSeriesPoint[]): string {
  if (points.length === 0) return EMPTY;
  if (points.length === 1) return points[0].label;
  const first = parseMonthKey(points[0].key);
  const last = parseMonthKey(points[points.length - 1].key);
  const span = first && last ? (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth() + 1 : 0;
  return span === points.length
    ? `${points[0].label}–${points[points.length - 1].label}`
    : points.map((point) => point.label).join(", ");
}

/** "517 ta · 20,1%" - ulush hisoblanmasa faqat son. */
function countWithShare(part: number, whole: number): string {
  const ratio = share(part, whole);
  return ratio == null ? count(part) : `${count(part)} · ${percent(ratio)}`;
}

const NOT_UPLOADED = "Yuklanmagan";

// ---------------------------------------------------------------------------
// Kartalar
// ---------------------------------------------------------------------------

function buildKpis(
  period: PeriodInfo,
  scope: HomeScope,
  current: ScopeSummary,
  previous: ScopeSummary | null,
  previousPeriod: PeriodInfo | null,
  series: readonly ScopeSeriesPoint[],
): HomeKpis {
  const energyNow = current.energy;
  const energyBefore = previous?.energy ?? null;
  const missingEnergy = scope.kind === "district" ? "Podstansiyalar yuklanmagan" : "Ma’lumot yo’q";
  // O'tgan oyda energiya holati yo'q: shablon yuklanmagan yoki obyekt o'sha oyda yo'q.
  const missingBefore = previous?.uploads.SUBSTATIONS ? "ma’lumot yo’q" : "yuklanmagan";

  const FLOWS = [
    { id: "total", title: "Umumiy oqim", key: "totalKwh", point: (p: ScopeSeriesPoint) => p.totalKwh },
    { id: "useful", title: "Foydali oqim", key: "usefulKwh", point: (p: ScopeSeriesPoint) => p.usefulKwh },
    { id: "loss", title: "Yo’qotish", key: "lossKwh", point: (p: ScopeSeriesPoint) => p.lossKwh },
  ] as const;

  const flows = FLOWS.map((flow): HomeFlowKpi => {
    const value = energyNow ? energyNow[flow.key] : null;
    const before = energyBefore ? energyBefore[flow.key] : null;
    /*
     * Millionlarda 2 xona (`energy()` bilan bir xil): tuman bo'yicha Umumiy
     * va Foydali oqim faqat ~2% yo'qotishga farq qiladi, 1 xonada ikkalasi
     * bir xil son bo'lib ko'rinadi.
     */
    const figure = scaled(value, "kWh", Math.abs(value ?? 0) >= 1_000_000 ? 2 : 1);
    return {
      id: flow.id,
      title: flow.title,
      value: figure.value,
      unit: figure.unit,
      note: energyNow ? null : missingEnergy,
      previous: previousPeriod ? `O’tgan oy: ${before != null ? energy(before) : missingBefore}` : null,
      trend: previousPeriod ? trendOf(value, before, flow.id === "loss") : null,
      ...barsOf(series, flow.point),
    };
  });

  // Yil boshidan: shu yildagi, ma'lumoti bor oylar - Σ yo'qotish / Σ umumiy oqim.
  const year = new Date(period.month).getUTCFullYear();
  const yearPoints = series.filter(
    (point) => point.hasData && parseMonthKey(point.key)?.getUTCFullYear() === year,
  );
  const yearPercent = lossPercent(
    sum(yearPoints.map((point) => point.totalKwh)),
    sum(yearPoints.map((point) => point.lossKwh)),
  );

  // Qiymati yo'q qatorda son o'rniga KPI qatorlaridagi bilan bir xil izoh (kichik shriftda).
  const missingNow = current.uploads.SUBSTATIONS ? "ma’lumot yo’q" : "yuklanmagan";
  const lossRates: HomeLossRate[] = [
    {
      id: "current",
      value: energyNow ? percent(energyNow.lossPercent) : missingNow,
      unit: monthName(period.month),
      large: energyNow != null,
    },
  ];
  if (previousPeriod) {
    lossRates.push({
      id: "previous",
      value: energyBefore ? percent(energyBefore.lossPercent) : missingBefore,
      unit: `${monthName(previousPeriod.month)} (o’tgan oy)`,
      large: false,
    });
  }
  lossRates.push(
    yearPoints.length > 0
      ? { id: "year", value: percent(yearPercent), unit: `Yil boshidan (${monthsCovered(yearPoints)})`, large: false }
      : { id: "year", value: missingNow, unit: "Yil boshidan", large: false },
  );

  const list = current.subscriberList;
  const subscribers: HomeCountKpi = current.subscribers
    ? {
        value: num(current.subscribers.total),
        unit: "ta umumiy",
        lines: list.uploaded
          ? SUBSCRIBER_KIND_ORDER.map((kind) => ({
              id: kind,
              text: `${num(list.byKind[kind])} ta ${SUBSCRIBER_KIND_LABEL[kind].toLowerCase()}`,
              kind,
            }))
          : [{ id: "missing", text: "Abonentlar ro’yxati yuklanmagan", kind: null }],
        ...barsOf(series, (point) => point.subscribers),
      }
    : {
        value: EMPTY,
        unit: "ta umumiy",
        lines: [{ id: "missing", text: "Transformatorlar yuklanmagan", kind: null }],
        ...barsOf(series, (point) => point.subscribers),
      };

  const debtFigure = scaled(list.uploaded ? list.debtUzs : null, "so’m");
  const debt: HomeCountKpi = {
    value: debtFigure.value,
    unit: debtFigure.unit,
    lines: list.uploaded
      ? SUBSCRIBER_KIND_ORDER.map((kind) => ({
          id: kind,
          text: `${money(list.debtByKind[kind])} ${SUBSCRIBER_KIND_LABEL[kind].toLowerCase()}`,
          kind,
        }))
      : [{ id: "missing", text: "Abonentlar ro’yxati yuklanmagan", kind: null }],
    ...barsOf(series, (point) => point.debtUzs),
  };

  return { flows, lossRates, subscribers, debt };
}

function buildMap(
  period: PeriodInfo,
  scope: HomeScope,
  transformers: readonly TransformerRow[],
  previousUseful: number | null,
  top: TransformerRow | null,
): HomeMap {
  const markers = transformers.flatMap((row): MapMarker[] =>
    row.lat != null && row.lng != null ? [{ id: row.id, lat: row.lat, lng: row.lng, label: row.name, kind: "tp" }] : [],
  );

  let note: string | null = null;
  const change = top ? delta(top.usefulKwh, previousUseful) : null;
  if (change) {
    note =
      Math.abs(change.diff) < 0.005
        ? "Ushbu transformatorning Foydali oqimi o’tgan oyga nisbatan o’zgarmagan."
        : `Ushbu transformatorning Foydali oqimi o’tgan oyga nisbatan ${kwhText(Math.abs(change.diff))} ga ${
            change.diff > 0 ? "ko’p" : "kam"
          }.`;
  }

  return {
    markers,
    selectedId: top?.id ?? null,
    tooltip: top
      ? {
          title: "Yuqori sarfga ega transformator",
          label: `${top.name} · ${top.feeder.name}`,
          caption: `${monthName(period.month)} oyidagi Foydali oqim`,
          value: energy(top.usefulKwh),
          note,
        }
      : null,
    href: scope.kind === "district" ? "/map" : `/map?node=substation:${scope.id}`,
  };
}

function ringData(
  month: string,
  uploaded: boolean,
  empty: string,
  rings: { id: string; label: string; count: number }[],
  total: number,
  summary: string | null,
): HomeRingData {
  return {
    empty: uploaded ? null : empty,
    month,
    rings: rings.map((ring) => ({
      id: ring.id,
      label: ring.label,
      amount: count(ring.count),
      arc: share(ring.count, total) ?? 0,
    })),
    summary: summary ? { label: summary, value: count(total) } : null,
  };
}

// ---------------------------------------------------------------------------
// Yuklovchi
// ---------------------------------------------------------------------------

export async function loadHomeData(period: PeriodInfo, scope: HomeScope): Promise<HomeData> {
  const substationId = scope.kind === "substation" ? scope.id : undefined;
  const periods = await getPeriodsUntil(period, 12);

  const [comparison, series, substationRows, feederRows, transformerRows, repairs, substation] = await Promise.all([
    getScopeComparison(scope, period),
    getScopeSeries(scope, periods),
    scope.kind === "district" ? listSubstations(period.id) : Promise.resolve([]),
    listFeeders(period.id, { substationId }),
    listTransformers(period.id, { substationId }),
    listRepairs(period.id, scope),
    substationId ? getSubstation(substationId, period.id) : Promise.resolve(null),
  ]);
  const { current, previous, previousPeriod } = comparison;
  const uploads = current.uploads;

  // Eng ko'p Foydali oqimli TP (teng bo'lsa - fayldagi birinchisi).
  const top = transformerRows.reduce<TransformerRow | null>(
    (best, row) => (best == null || row.usefulKwh > best.usefulKwh ? row : best),
    null,
  );
  const topBefore =
    top && previousPeriod ? ((await getTransformer(top.id, previousPeriod.id))?.snapshot ?? null) : null;

  const scoped = (path: string, extra?: Record<string, string>) => scopedHref(path, scope, extra);

  // --- Ob'ektlar ustuni -----------------------------------------------------
  const countValue = (value: number | null) => (value == null ? NOT_UPLOADED : count(value));
  const tiles: HomeObjectTile[] = [
    scope.kind === "district"
      ? { id: "substations", value: countValue(current.counts.substations), label: "Podstansiyalar", href: "/substations" }
      : {
          id: "subscribers",
          value: countValue(current.subscribers?.total ?? null),
          label: "Abonentlar",
          href: scoped("/subscribers"),
        },
    { id: "feeders", value: countValue(current.counts.feeders), label: "Fiderlar", href: scoped("/feeders") },
    {
      id: "transformers",
      value: countValue(current.counts.transformers),
      label: "Transformatorlar",
      href: scoped("/transformers"),
    },
  ];

  // --- Filtratsiya -----------------------------------------------------------
  const feederLabels = distinctLabels(feederRows, (row) => row.substation.name);
  const transformerLabels = distinctLabels(transformerRows, (row) => row.feeder.name);
  const filter: HomeFilter = {
    lockedSubstationId: substationId ?? null,
    substations:
      scope.kind === "district"
        ? substationRows.map((row) => ({
            id: row.id,
            label: row.name,
            substationId: row.id,
            feederId: null,
            metrics: energyMetrics(row),
            href: `/substations/${row.id}`,
          }))
        : substation
          ? [
              {
                id: substation.id,
                label: substation.name,
                substationId: substation.id,
                feederId: null,
                metrics: energyMetrics(substation.snapshot),
                href: `/substations/${substation.id}`,
              },
            ]
          : [],
    feeders: feederRows.map((row) => ({
      id: row.id,
      label: feederLabels.get(row.id) ?? row.name,
      substationId: row.substation.id,
      feederId: row.id,
      metrics: energyMetrics(row),
      href: `/feeders/${row.id}`,
    })),
    transformers: transformerRows.map((row) => ({
      id: row.id,
      label: transformerLabels.get(row.id) ?? row.name,
      substationId: row.substation.id,
      feederId: row.feeder.id,
      metrics: energyMetrics(row),
      href: `/transformers/${row.id}`,
    })),
    scopeMetrics: energyMetrics(current.energy),
  };

  // --- Qoidabuzarliklar, hisoblagichlar, murojaatlar -------------------------
  const violations: HomeViolations = {
    uploaded: current.violations.uploaded,
    total: { value: count(current.violations.total), href: scoped("/violations") },
    types: VIOLATOR_TYPE_ORDER.map((type) => ({
      id: type,
      label: VIOLATOR_TYPE_LABEL[type],
      value: count(current.violations.byType[type]),
      href: scoped("/violations", { type }),
    })),
    damage: current.violations.uploaded ? money(current.violations.damageUzs) : null,
    href: scoped("/violations"),
  };

  const month = monthName(period.month);
  const list = current.subscriberList;
  const meters = ringData(
    month,
    list.uploaded,
    "Abonentlar ro’yxati yuklanmagan",
    [
      { id: "total", label: "Umumiy", count: list.total },
      ...METER_STATUS_ORDER.map((status: MeterStatus) => ({
        id: status,
        label: METER_STATUS_LABEL[status],
        count: list.byStatus[status],
      })),
    ],
    list.total,
    null,
  );
  const appeals = ringData(
    month,
    current.appeals.uploaded,
    "Murojaatlar yuklanmagan",
    APPEAL_STATUS_ORDER.map((status: AppealStatus) => ({
      id: status,
      label: APPEAL_STATUS_LABEL[status],
      count: current.appeals.byStatus[status],
    })),
    current.appeals.total,
    "Umumiy murojaatlar",
  );

  // --- Tezkor ko'rsatkichlar (faqat hisoblangan) -----------------------------
  const quickMetrics: HomeQuickMetric[] = [
    {
      id: "offline",
      caption: "Aloqadan chiqqan abonentlar",
      value: current.subscribers
        ? countWithShare(current.subscribers.offline, current.subscribers.total)
        : NOT_UPLOADED,
    },
    {
      id: "debtors",
      caption: "Qarzdor abonentlar",
      value: list.uploaded ? countWithShare(list.debtors, list.total) : NOT_UPLOADED,
    },
    { id: "credit", caption: "Haqdorlik", value: list.uploaded ? money(list.creditUzs) : NOT_UPLOADED },
    {
      id: "appealsInProgress",
      caption: "Jarayondagi murojaatlar",
      value: current.appeals.uploaded ? count(current.appeals.byStatus.IN_PROGRESS) : NOT_UPLOADED,
    },
    {
      id: "appealsOverdue",
      caption: "Muddati buzilgan murojaatlar",
      value: current.appeals.uploaded ? count(current.appeals.byStatus.OVERDUE) : NOT_UPLOADED,
    },
    {
      id: "damageKwh",
      caption: "Taxminiy zarar (kWh)",
      value: current.violations.uploaded ? energy(current.violations.damageKwh) : NOT_UPLOADED,
    },
  ];

  // --- Reytinglar -------------------------------------------------------------
  const usefulBars = (
    id: string,
    title: string,
    rows: readonly { id: string; usefulKwh: number }[],
    labels: (row: { id: string }) => string,
    footerLabel: string,
    footerHref: string,
    emptyText: string,
  ): HomeTopBars => {
    const ranked = [...rows].sort((a, b) => b.usefulKwh - a.usefulKwh).slice(0, TOP_LIMIT);
    const unit = energyUnit(Math.max(0, ...ranked.map((row) => Math.abs(row.usefulKwh))));
    const items = ranked.map((row) => ({ id: row.id, label: labels(row), value: row.usefulKwh / unit.divisor }));
    return {
      id,
      title,
      items,
      unit: unit.unit,
      valueColumn: `Foydali oqim, ${unit.unit}`,
      labelWidth: labelWidth(items.map((item) => item.label)),
      footerLabel,
      footerHref,
      emptyText,
    };
  };

  const feederBars = usefulBars(
    "feeders",
    "Eng ko’p sarfga ega fiderlar",
    feederRows,
    (row) => feederLabels.get(row.id) ?? "",
    "Fiderlar sahifasini ochish",
    scoped("/feeders"),
    uploads.FEEDERS ? "Fiderlar yo’q" : "Fiderlar yuklanmagan",
  );
  const transformerBars = usefulBars(
    "transformers",
    "Eng ko’p sarfga ega transformatorlar",
    transformerRows,
    (row) => transformerLabels.get(row.id) ?? "",
    "Transformatorlar sahifasini ochish",
    scoped("/transformers"),
    uploads.TRANSFORMERS ? "Transformatorlar yo’q" : "Transformatorlar yuklanmagan",
  );

  let firstBars: HomeTopBars;
  if (scope.kind === "district") {
    const names = new Map(substationRows.map((row) => [row.id, row.name]));
    firstBars = usefulBars(
      "substations",
      "Eng ko’p sarfga ega podstansiyalar",
      substationRows,
      (row) => names.get(row.id) ?? "",
      "Podstansiyalar sahifasini ochish",
      "/substations",
      uploads.SUBSTATIONS ? "Podstansiyalar yo’q" : "Podstansiyalar yuklanmagan",
    );
  } else {
    // Podstansiya ichida: TP lar o'z yo'qotish ulushi bo'yicha.
    const ranked = transformerRows
      .filter((row): row is TransformerRow & { lossPercent: number } => row.lossPercent != null)
      .sort((a, b) => b.lossPercent - a.lossPercent)
      .slice(0, TOP_LIMIT);
    const items = ranked.map((row) => ({
      id: row.id,
      label: transformerLabels.get(row.id) ?? row.name,
      value: row.lossPercent,
    }));
    firstBars = {
      id: "transformer-loss",
      title: "Eng ko’p yo’qotishga ega transformatorlar",
      items,
      unit: "%",
      valueColumn: "Yo’qotish, %",
      labelWidth: labelWidth(items.map((item) => item.label)),
      footerLabel: "Transformatorlar sahifasini ochish",
      footerHref: scoped("/transformers"),
      emptyText: uploads.TRANSFORMERS ? "Transformatorlar yo’q" : "Transformatorlar yuklanmagan",
    };
  }

  return {
    stateKey: scope.kind === "district" ? period.key : `${period.key}:substation:${scope.id}`,
    kpis: buildKpis(period, scope, current, previous, previousPeriod, series),
    objects: {
      tiles,
      repairs: {
        uploaded: uploads.TRANSFORMERS,
        done: { value: count(repairs.counts.done), href: scoped("/works", { done: "1" }) },
        planned: { value: count(repairs.counts.planned), href: scoped("/works", { done: "0" }) },
      },
    },
    map: buildMap(period, scope, transformerRows, topBefore?.usefulKwh ?? null, top),
    filter,
    violations,
    meters,
    appeals,
    quickMetrics,
    topBars: [firstBars, feederBars, transformerBars],
    dynamics: series
      .filter((point) => point.hasData)
      .map((point) => ({
        key: point.key,
        label: point.fullLabel,
        billed: point.totalKwh ?? 0,
        consumed: point.usefulKwh ?? 0,
        loss: point.lossKwh ?? 0,
      })),
    plannedWorks: {
      uploaded: uploads.TRANSFORMERS,
      works: repairs.rows
        .filter((row) => !row.done)
        .map((row) => ({
          id: row.id,
          tp: transformerLabels.get(row.transformer.id) ?? row.transformer.name,
          work: row.label,
          date: formatDate(row.date),
        })),
    },
    reportQuery:
      scope.kind === "district" ? `month=${period.key}` : `scope=substation:${scope.id}&month=${period.key}`,
  };
}
