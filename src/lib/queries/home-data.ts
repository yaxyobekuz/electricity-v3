import "server-only";

import type { DynamicsMonth } from "@/components/cards/ConsumptionDynamicsCard";
import type { RepairWork } from "@/components/cards/PlannedWorksCard";
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
import { getPeriodsUntil, getYearPeriods, type PeriodInfo } from "@/lib/period";
import { scopedHref, scopeParam } from "@/lib/scope-param";

import { getFeeder, getSubstation, getTransformer } from "./entities";
import { listFeeders, listSubscribers, listSubstations, listTransformers, type TransformerRow } from "./lists";
import { listRepairs } from "./repairs";
import {
  getScopeAppealsYear,
  getScopeComparison,
  getScopeSeries,
  getScopeViolationsYear,
  LOW_READING_KVT,
  type EntityRef,
  type ScopeSeriesPoint,
  type ScopeSummary,
} from "./scope";

/*
 * "Asosiy" sahifa (`/dashboard`, tuman), podstansiya (`/substations/[id]`),
 * fider (`/feeders/[id]`) va TP (`/transformers/[id]`) sahifalari uchun
 * bitta yuklovchi. Hammasi bir xil `HomeView` ni chizadi, farqi faqat
 * qamrovda.
 *
 * Bu yerda yangi formula yo'q: har bir son `scope.ts` / `lists.ts` /
 * `repairs.ts` / `entities.ts` dan olinadi, foiz faqat `lossPercent` /
 * `share` orqali, matn esa `format.ts` orqali. Natija - mijozga uzatsa
 * bo'ladigan oddiy obyekt (ikonka va ranglar `HomeView` da tanlanadi).
 */

export type HomeScope =
  | { kind: "district" }
  | { kind: "substation"; id: string }
  | { kind: "feeder"; id: string }
  | { kind: "transformer"; id: string };

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
  /** "Bu oy: 19,1 ming kWh" - katta son yillik bo'lgani uchun joriy oy alohida. */
  currentMonth: string;
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
  /** `substation` / `feeder` - fider va TP sahifalarida ota obyekt (qiymati - uning nomi). */
  id: "substations" | "substation" | "feeder" | "subscribers" | "feeders" | "transformers";
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
  /** Kartadagi izoh: yil boshidan qamralgan oylar ("Yil boshidan (Yan–Avg)"). */
  caption: string;
  /** Zarar plitkasining izohi - u ham shu yig'indidan. */
  damageLabel: string;
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

/**
 * "Shubhali iste'molchilar" - shablondagi "Hisoblagich ko'rsatgichi"
 * (`SubscriberSnapshot.meterReading`) bo'yicha:
 *
 *   - "0 kVt iste'moldagilar"        - ko'rsatgich aynan 0;
 *   - "50 kVt dan kam iste'moldagilar" - 0 < ko'rsatgich < 50.
 *
 * Ikki guruh kesishmaydi. Katak bo'sh bo'lsa (hisoblagich o'qilmagan)
 * abonent hech qaysi guruhga kirmaydi - o'qilmagan "0 iste'mol" degani
 * emas (`malumotlar.md` 5-bo'lim: yo'q qiymat o'ylab topilmaydi).
 */
export interface HomeSuspicious {
  rows: { id: "zero" | "low"; caption: string; value: string }[];
  /** Ro'yxat yuklanmagan bo'lsa - sabab. */
  note: string | null;
  href: string;
}

/**
 * "O'rtacha ko'rsatgichlar" - yozuvlar maketdagidek ("Yillik / Chorak /
 * Oylik o'rtacha iste'mol"), qiymatlar esa davr YIG'INDILARI (o'rtacha emas:
 * foizlar o'rtachasi olinmaydi, `malumotlar.md` 4.4). Har bir qator -
 * shuncha oyning umumiy oqimi.
 */
export interface HomeAverages {
  rows: { id: "year" | "quarter" | "month"; caption: string; value: string }[];
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
  /** Jadvaldagi nom ustuni sarlavhasi; berilmasa - "Nomi". */
  labelColumn?: string;
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
  /**
   * Boshlang'ich ko'rinish. null - butun tuman (tuman va podstansiya
   * sahifalari); fider sahifasida - uning TP lari, TP sahifasida - shu TP
   * sig'adigan markaz va zoom.
   */
  view: { center: { lat: number; lng: number }; zoom: number } | null;
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
  /** Podstansiya, fider va TP sahifalarida sahifa podstansiyasi tanlangan va qulflangan. */
  lockedSubstationId: string | null;
  /** Fider va TP sahifalarida sahifa fideri tanlangan va qulflangan. */
  lockedFeederId: string | null;
  /**
   * TP sahifasida - shu TP: boshlang'ich tanlov, lekin qulflanmagan (shu
   * fiderdagi boshqa TP ko'rsatkichlarini ko'rib, sahifasiga o'tish mumkin).
   */
  currentTransformerId: string | null;
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
  suspicious: HomeSuspicious;
  averages: HomeAverages;
  quickMetrics: HomeQuickMetric[];
  topBars: HomeTopBars[];
  dynamics: DynamicsMonth[];
  plannedWorks: { uploaded: boolean; works: RepairWork[] };
  /** `DownloadReportsCard` uchun: "month=2026-09" yoki "scope=feeder:<id>&month=2026-09". */
  reportQuery: string;
}

// ---------------------------------------------------------------------------
// Yordamchilar
// ---------------------------------------------------------------------------

const TOP_LIMIT = 6;

/** Diagramma birligi eng katta qiymatga qarab (`scaled` bilan bir xil pog'onalar). */
const UNIT_SCALES = [
  { divisor: 1_000_000_000, prefix: "mlrd " },
  { divisor: 1_000_000, prefix: "mln " },
  { divisor: 1_000, prefix: "ming " },
  { divisor: 1, prefix: "" },
] as const;

/** `unitScale(2_400_000, "kWh")` -> `{ divisor: 1_000_000, unit: "mln kWh" }`. */
function unitScale(peak: number, unit: string): { divisor: number; unit: string } {
  const abs = Math.abs(peak);
  const scale = UNIT_SCALES.find((item) => abs >= item.divisor) ?? UNIT_SCALES[UNIT_SCALES.length - 1];
  return { divisor: scale.divisor, unit: `${scale.prefix}${unit}` };
}

/*
 * Fider xaritasi: bitta TP bo'lsa shu masshtab, bir nechta bo'lsa hammasi
 * sig'adigan eng yaqini. Xarita maydoni ~784x314px, o'ng pastki burchakda
 * 215px lik tultip - markerlar chetga va tultip ostiga tushmasligi uchun
 * hisob kichikroq kadrga (`MAP_VIEW_PX`) qilinadi.
 */
const MAP_SINGLE_ZOOM = 15;
const MAP_MIN_ZOOM = 11;
const MAP_MAX_ZOOM = 16;
const MAP_VIEW_PX = { width: 520, height: 230 };

/** Markerlar hammasi ko'rinadigan markaz va masshtab (Web Mercator, taxminiy). */
function fitView(markers: readonly MapMarker[]): NonNullable<HomeMap["view"]> {
  const lats = markers.map((marker) => marker.lat);
  const lngs = markers.map((marker) => marker.lng);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
  const lngSpan = maxLng - minLng;
  // Kenglik bo'yicha cho'zilish: 1 / cos(lat).
  const latSpan = (maxLat - minLat) / Math.cos((center.lat * Math.PI) / 180);
  if (lngSpan === 0 && latSpan === 0) return { center, zoom: MAP_SINGLE_ZOOM };
  // Zoom z da dunyo kengligi 256 * 2^z px = 360 gradus.
  const fit = (span: number, px: number) => (span > 0 ? Math.log2((px * 360) / (256 * span)) : MAP_MAX_ZOOM);
  const zoom = Math.floor(Math.min(fit(lngSpan, MAP_VIEW_PX.width), fit(latSpan, MAP_VIEW_PX.height)));
  return { center, zoom: Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, zoom)) };
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

/** "2,1 ming kWh" - farq qiymati uchun. */
function kwhText(value: number): string {
  const parts = scaled(value, "kWh");
  return `${parts.value} ${parts.unit}`;
}

/**
 * O'tgan oy bilan farq qatori: mutlaq farq, "ga ko’p" / "ga kam". Foiz
 * o'zgarishi ishlatilmaydi: Yo'qotish kartasida uni yo'qotish ulushining
 * o'zgarishi deb o'qish oson.
 */
function trendOf(
  current: number | null | undefined,
  previous: number | null | undefined,
  risingIsBad: boolean,
): HomeTrend | null {
  const change = delta(current, previous);
  if (!change) return null;
  // Ko'rsatilgan aniqlikda solishtiriladi: "0 kWh ga ko’p" chiqmasin.
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
  // Oqim manbasi - qamrov obyektining o'z shabloni (tumanda - Podstansiyalar yig'indisi).
  const energyTemplate =
    scope.kind === "feeder" ? "FEEDERS" : scope.kind === "transformer" ? "TRANSFORMERS" : "SUBSTATIONS";
  const missingEnergy = scope.kind === "district" ? "Podstansiyalar yuklanmagan" : "Ma’lumot yo’q";
  // O'tgan oyda energiya holati yo'q: shablon yuklanmagan yoki obyekt o'sha oyda yo'q.
  const missingBefore = previous?.uploads[energyTemplate] ? "ma’lumot yo’q" : "yuklanmagan";

  const FLOWS = [
    { id: "total", title: "Umumiy oqim", key: "totalKwh", point: (p: ScopeSeriesPoint) => p.totalKwh },
    { id: "useful", title: "Foydali oqim", key: "usefulKwh", point: (p: ScopeSeriesPoint) => p.usefulKwh },
    { id: "loss", title: "Yo’qotish", key: "lossKwh", point: (p: ScopeSeriesPoint) => p.lossKwh },
  ] as const;

  // Qiymati yo'q qatorda son o'rniga KPI qatorlaridagi bilan bir xil izoh (kichik shriftda).
  const missingNow = current.uploads[energyTemplate] ? "ma’lumot yo’q" : "yuklanmagan";

  // Yil boshidan: shu yildagi, ma'lumoti bor oylar.
  const year = new Date(period.month).getUTCFullYear();
  const yearPoints = series.filter(
    (point) => point.hasData && parseMonthKey(point.key)?.getUTCFullYear() === year,
  );

  /*
   * Maketda katta son - YILLIK (yil boshidan yig'indi), ostida joriy va
   * o'tgan oy alohida qatorlarda. Yig'indi faqat ma'lumoti bor oylardan;
   * birorta oy yo'q bo'lsa - joriy oyning o'zi ko'rsatiladi.
   */
  const flows = FLOWS.map((flow): HomeFlowKpi => {
    const value = energyNow ? energyNow[flow.key] : null;
    const before = energyBefore ? energyBefore[flow.key] : null;
    const yearValue = yearPoints.length > 0 ? sum(yearPoints.map(flow.point)) : null;
    /*
     * Millionlarda 2 xona (`energy()` bilan bir xil): tuman bo'yicha Umumiy
     * va Foydali oqim faqat ~2% yo'qotishga farq qiladi, 1 xonada ikkalasi
     * bir xil son bo'lib ko'rinadi.
     */
    const figure = scaled(yearValue, "kWh", Math.abs(yearValue ?? 0) >= 1_000_000 ? 2 : 1);
    return {
      id: flow.id,
      title: flow.title,
      value: figure.value,
      // Maketdagi "ming kWh yillik" - birlikdan keyin davr izohi.
      unit: yearValue != null ? `${figure.unit} yillik` : figure.unit,
      note: energyNow ? null : missingEnergy,
      currentMonth: `Bu oy: ${value != null ? energy(value) : missingNow}`,
      previous: previousPeriod ? `O’tgan oy: ${before != null ? energy(before) : missingBefore}` : null,
      trend: previousPeriod ? trendOf(value, before, flow.id === "loss") : null,
      ...barsOf(series, flow.point),
    };
  });
  const yearPercent = lossPercent(
    sum(yearPoints.map((point) => point.totalKwh)),
    sum(yearPoints.map((point) => point.lossKwh)),
  );

  /*
   * Maketdagi tartib (Figma `4257:169`): birinchi va eng katta - Yillik
   * (yil boshidan), ostida joriy oy va o'tgan oy. Maketdagi uchinchi
   * "Kunlik" tabletkasi yo'q: kunlik ma'lumot manbasi yo'q
   * (`malumotlar.md` 8-bo'lim).
   */
  const lossRates: HomeLossRate[] = [
    yearPoints.length > 0
      ? {
          id: "year",
          value: percent(yearPercent),
          unit: "Yillik",
          large: true,
        }
      : { id: "year", value: missingNow, unit: "Yillik", large: false },
    {
      id: "current",
      value: energyNow ? percent(energyNow.lossPercent) : missingNow,
      unit: monthName(period.month),
      large: false,
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

  // Fider va TP sahifalarida fider bitta - TP nomiga fider nomi qo'shilmaydi.
  const withinFeeder = scope.kind === "feeder" || scope.kind === "transformer";
  return {
    markers,
    selectedId: top?.id ?? null,
    tooltip: top
      ? {
          // TP sahifasida `top` - sahifaning o'z TP si.
          title: scope.kind === "transformer" ? "Transformator" : "Yuqori sarfga ega transformator",
          label: withinFeeder ? top.name : `${top.name} · ${top.feeder.name}`,
          caption: `${monthName(period.month)} oyidagi Foydali oqim`,
          value: energy(top.usefulKwh),
          note,
        }
      : null,
    view: withinFeeder && markers.length > 0 ? fitView(markers) : null,
    href: scope.kind === "district" ? "/map" : `/map?node=${scopeParam(scope)}`,
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
  // Fider / TP sahifasi `getFeeder` / `getTransformer` ni o'zi chaqirgan - `cache` tufayli qayta so'rov yo'q.
  const [feeder, transformer, periods, yearPeriods] = await Promise.all([
    scope.kind === "feeder" ? getFeeder(scope.id, period.id) : Promise.resolve(null),
    scope.kind === "transformer" ? getTransformer(scope.id, period.id) : Promise.resolve(null),
    getPeriodsUntil(period, 12),
    getYearPeriods(period),
  ]);
  // Qamrov obyektining ota obyektlari (plitkalar va filtr qulflari).
  const parentSubstation: EntityRef | null = feeder?.substation ?? transformer?.substation ?? null;
  const parentFeeder: EntityRef | null = transformer?.feeder ?? null;
  const substationId = scope.kind === "substation" ? scope.id : parentSubstation?.id;
  const feederId = scope.kind === "feeder" ? scope.id : parentFeeder?.id;

  const [
    comparison,
    series,
    appealsYear,
    violationsYear,
    substationRows,
    feederRows,
    transformerRows,
    repairs,
    substation,
    debtors,
  ] = await Promise.all([
    getScopeComparison(scope, period),
    getScopeSeries(scope, periods),
    getScopeAppealsYear(scope, yearPeriods),
    getScopeViolationsYear(scope, yearPeriods),
    scope.kind === "district" ? listSubstations(period.id) : Promise.resolve([]),
    // Fider va TP sahifalarida ro'yxatda faqat sahifa fideri (filtr tanlovi uchun).
    listFeeders(period.id, { substationId }).then((rows) =>
      feederId ? rows.filter((row) => row.id === feederId) : rows,
    ),
    // TP sahifasida - shu TP ning fideridagi barcha TP lar (filtr va fider reytinglari).
    listTransformers(period.id, { substationId, feederId }),
    listRepairs(period.id, scope),
    substationId ? getSubstation(substationId, period.id) : Promise.resolve(null),
    // TP ichidagi reyting - eng katta qarzdorlar (`/subscribers?debtors=1` ro'yxatining boshi).
    scope.kind === "transformer"
      ? listSubscribers(period.id, { scope, debtorsOnly: true, sort: "debt", take: TOP_LIMIT })
      : Promise.resolve(null),
  ]);
  const { current, previous, previousPeriod } = comparison;
  const uploads = current.uploads;
  // Xarita va tultip qamrovdagi TP lardan: TP sahifasida - faqat shu TP.
  const scopeTransformers =
    scope.kind === "transformer" ? transformerRows.filter((row) => row.id === scope.id) : transformerRows;

  // Eng ko'p Foydali oqimli TP (teng bo'lsa - fayldagi birinchisi).
  const top = scopeTransformers.reduce<TransformerRow | null>(
    (best, row) => (best == null || row.usefulKwh > best.usefulKwh ? row : best),
    null,
  );
  const topBefore =
    top && previousPeriod ? ((await getTransformer(top.id, previousPeriod.id))?.snapshot ?? null) : null;

  const scoped = (path: string, extra?: Record<string, string>) => scopedHref(path, scope, extra);

  // --- Ob'ektlar ustuni -----------------------------------------------------
  const countValue = (value: number | null) => (value == null ? NOT_UPLOADED : count(value));
  const subscribersTile: HomeObjectTile = {
    id: "subscribers",
    value: countValue(current.subscribers?.total ?? null),
    label: "Abonentlar",
    href: scoped("/subscribers"),
  };
  const feedersTile: HomeObjectTile = {
    id: "feeders",
    value: countValue(current.counts.feeders),
    label: "Fiderlar",
    href: scoped("/feeders"),
  };
  const transformersTile: HomeObjectTile = {
    id: "transformers",
    value: countValue(current.counts.transformers),
    label: "Transformatorlar",
    href: scoped("/transformers"),
  };
  // Ota obyekt plitkasi: qiymati - nomi, "Ochish" - uning sahifasi.
  const parentTile = (id: "substation" | "feeder", ref: EntityRef | null, label: string, path: string) => ({
    id,
    value: ref?.name ?? EMPTY,
    label,
    href: ref ? `${path}/${ref.id}` : path,
  });
  let tiles: HomeObjectTile[];
  switch (scope.kind) {
    case "district":
      tiles = [
        { id: "substations", value: countValue(current.counts.substations), label: "Podstansiyalar", href: "/substations" },
        feedersTile,
        transformersTile,
      ];
      break;
    case "substation":
      tiles = [subscribersTile, feedersTile, transformersTile];
      break;
    case "feeder":
      // "Fiderlar: 1 ta" ma'nosiz - o'rniga ota podstansiya.
      tiles = [parentTile("substation", parentSubstation, "Podstansiya", "/substations"), transformersTile, subscribersTile];
      break;
    case "transformer":
      // "Transformatorlar: 1 ta" ham ma'nosiz - ota podstansiya va fider.
      tiles = [
        parentTile("substation", parentSubstation, "Podstansiya", "/substations"),
        parentTile("feeder", parentFeeder, "Fider", "/feeders"),
        subscribersTile,
      ];
      break;
  }

  // --- Filtratsiya -----------------------------------------------------------
  const feederLabels = distinctLabels(feederRows, (row) => row.substation.name);
  const transformerLabels = distinctLabels(transformerRows, (row) => row.feeder.name);
  const filter: HomeFilter = {
    lockedSubstationId: substationId ?? null,
    lockedFeederId: feederId ?? null,
    currentTransformerId: scope.kind === "transformer" ? scope.id : null,
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
  /*
   * Qoidabuzarliklar - yil boshidan (murojaatlar kartasi bilan bir xil qoida):
   * tanlangan oyning yilida qoidabuzarliklar yuklangan barcha oylar birga
   * sanaladi. Ostidagi "Umumiy keltirilgan zarar" plitkasi ham shu yig'indidan -
   * aks holda ikki plitka bir-biriga zid son ko'rsatardi.
   */
  const violationsMonths = violationsYear.periods.length;
  const violations: HomeViolations = {
    uploaded: violationsMonths > 0,
    total: { value: count(violationsYear.total), href: scoped("/violations") },
    types: VIOLATOR_TYPE_ORDER.map((type) => ({
      id: type,
      label: VIOLATOR_TYPE_LABEL[type],
      value: count(violationsYear.byType[type]),
      href: scoped("/violations", { type }),
    })),
    damage: violationsMonths > 0 ? money(violationsYear.damageUzs) : null,
    caption: "Umumiy aniqlangan holatlar",
    damageLabel: "Umumiy keltirilgan zarar miqdori",
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
  /*
   * Murojaatlar - yil boshidan: tanlangan oyning yilida murojaatlar
   * yuklangan barcha oylar birga sanaladi (bitta oy emas). Yorliqlar
   * maketdagidek qoladi (davr izohi qo'shilmaydi).
   */
  const appealsMonths = appealsYear.periods.length;
  const appeals = ringData(
    month,
    appealsMonths > 0,
    "Murojaatlar yuklanmagan",
    APPEAL_STATUS_ORDER.map((status: AppealStatus) => ({
      id: status,
      label: APPEAL_STATUS_LABEL[status],
      count: appealsYear.byStatus[status],
    })),
    appealsYear.total,
    "Umumiy murojaatlar",
  );

  /*
   * "Shubhali iste'molchilar" - shablondagi "Hisoblagich ko'rsatgichi"
   * bo'yicha (`HomeSuspicious` izohiga qarang). Chegara `LOW_READING_KVT`,
   * sonlar `scope.ts` da bitta joyda hisoblanadi.
   */
  const suspicious: HomeSuspicious = {
    rows: [
      {
        id: "zero" as const,
        caption: "0 kVt iste’moldagilar",
        value: list.uploaded ? count(list.zeroReading) : NOT_UPLOADED,
      },
      {
        id: "low" as const,
        caption: `${LOW_READING_KVT} kVt dan kam iste’moldagilar`,
        value: list.uploaded ? count(list.lowReading) : NOT_UPLOADED,
      },
    ],
    note: list.uploaded ? null : "Abonentlar ro’yxati yuklanmagan",
    href: scoped("/subscribers"),
  };

  /*
   * "O'rtacha ko'rsatgichlar" - qiymatlar aslida davr YIG'INDILARI (foizlar
   * o'rtachasi olinmaydi, `malumotlar.md` 4.4). Maketdagi "Kunlik o'rtacha
   * istemol" va "Yuqori iste'mol vaqti" plitkalari olib tashlandi (kunlik va
   * soatlik ma'lumot manbasi yo'q).
   */
  const windowRow = (id: "year" | "quarter" | "month", size: number, title: string) => {
    const points = series.filter((point) => point.hasData).slice(-size);
    const covered = points.length;
    return {
      id,
      caption: title,
      value: covered > 0 ? energy(sum(points.map((point) => point.totalKwh))) : NOT_UPLOADED,
    };
  };
  const averages: HomeAverages = {
    rows: [
      windowRow("year", 12, "Yillik o’rtacha iste’mol"),
      windowRow("quarter", 3, "Chorak o’rtacha iste’mol"),
      windowRow("month", 1, "Oylik o’rtacha iste’mol"),
    ],
  };

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
    const unit = unitScale(Math.max(0, ...ranked.map((row) => Math.abs(row.usefulKwh))), "kWh");
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

  const feederBars = () =>
    usefulBars(
      "feeders",
      "Eng ko’p sarfga ega fiderlar",
      feederRows,
      (row) => feederLabels.get(row.id) ?? "",
      "Fiderlar sahifasini ochish",
      scoped("/feeders"),
      uploads.FEEDERS ? "Fiderlar yo’q" : "Fiderlar yuklanmagan",
    );
  // TP sahifasida TP reytinglari - uning fideridagi TP lar (qo'shnilar bilan solishtirish).
  const siblings = scope.kind === "transformer";
  const transformersFooter = siblings ? "Fider transformatorlarini ochish" : "Transformatorlar sahifasini ochish";
  const transformersHref =
    siblings && feederId ? scopedHref("/transformers", { kind: "feeder", id: feederId }) : scoped("/transformers");

  const transformerBars = usefulBars(
    "transformers",
    siblings ? "Fiderdagi eng ko’p sarfga ega transformatorlar" : "Eng ko’p sarfga ega transformatorlar",
    transformerRows,
    (row) => transformerLabels.get(row.id) ?? "",
    transformersFooter,
    transformersHref,
    uploads.TRANSFORMERS ? "Transformatorlar yo’q" : "Transformatorlar yuklanmagan",
  );

  // Podstansiya, fider va TP ichida: TP lar o'z yo'qotish ulushi bo'yicha.
  const transformerLossBars = (): HomeTopBars => {
    const ranked = transformerRows
      .filter((row): row is TransformerRow & { lossPercent: number } => row.lossPercent != null)
      .sort((a, b) => b.lossPercent - a.lossPercent)
      .slice(0, TOP_LIMIT);
    const items = ranked.map((row) => ({
      id: row.id,
      label: transformerLabels.get(row.id) ?? row.name,
      value: row.lossPercent,
    }));
    return {
      id: "transformer-loss",
      title: siblings ? "Fiderdagi eng ko’p yo’qotishga ega transformatorlar" : "Eng ko’p yo’qotishga ega transformatorlar",
      items,
      unit: "%",
      valueColumn: "Yo’qotish, %",
      labelWidth: labelWidth(items.map((item) => item.label)),
      footerLabel: transformersFooter,
      footerHref: transformersHref,
      // Ulush faqat umumiy oqim > 0 bo'lsa hisoblanadi (`lossPercent`).
      emptyText: !uploads.TRANSFORMERS
        ? "Transformatorlar yuklanmagan"
        : transformerRows.length === 0
          ? "Transformatorlar yo’q"
          : "Transformatorlarda umumiy oqim 0",
    };
  };

  // Fider ichida: TP lar abonentlarining Σ qarzdorligi bo'yicha (abonentlar ro'yxatidan).
  const transformerDebtBars = (): HomeTopBars => {
    const ranked = transformerRows
      .filter((row): row is TransformerRow & { debtUzs: number } => row.debtUzs != null && row.debtUzs > 0)
      .sort((a, b) => b.debtUzs - a.debtUzs)
      .slice(0, TOP_LIMIT);
    const unit = unitScale(Math.max(0, ...ranked.map((row) => row.debtUzs)), "so’m");
    const items = ranked.map((row) => ({
      id: row.id,
      label: transformerLabels.get(row.id) ?? row.name,
      value: row.debtUzs / unit.divisor,
    }));
    return {
      id: "transformer-debt",
      title: "Eng katta qarzdorlikka ega transformatorlar",
      items,
      unit: unit.unit,
      valueColumn: `Qarzdorlik, ${unit.unit}`,
      labelWidth: labelWidth(items.map((item) => item.label)),
      footerLabel: "Qarzdor abonentlarni ochish",
      footerHref: scoped("/subscribers", { debtors: "1" }),
      emptyText: !list.uploaded
        ? "Abonentlar ro’yxati yuklanmagan"
        : !uploads.TRANSFORMERS
          ? "Transformatorlar yuklanmagan"
          : "Qarzdor abonentlar yo’q",
    };
  };

  // TP ichida: abonentlar qarzdorlik bo'yicha. Yorliq - shartnoma raqami:
  // FISH (o'rtacha ~24 bosh harf) yorliq ustuniga sig'maydi.
  const subscriberDebtBars = (): HomeTopBars => {
    const rows = debtors?.rows ?? [];
    const unit = unitScale(Math.max(0, ...rows.map((row) => row.debtUzs)), "so’m");
    const items = rows.map((row) => ({ id: row.id, label: row.contractNumber, value: row.debtUzs / unit.divisor }));
    return {
      id: "subscriber-debt",
      title: "Eng katta qarzdor abonentlar",
      items,
      unit: unit.unit,
      valueColumn: `Qarzdorlik, ${unit.unit}`,
      labelColumn: "Shartnoma",
      labelWidth: labelWidth(items.map((item) => item.label)),
      footerLabel: "Qarzdor abonentlarni ochish",
      footerHref: scoped("/subscribers", { debtors: "1" }),
      emptyText: list.uploaded ? "Qarzdor abonentlar yo’q" : "Abonentlar ro’yxati yuklanmagan",
    };
  };

  let topBars: HomeTopBars[];
  switch (scope.kind) {
    case "district": {
      const names = new Map(substationRows.map((row) => [row.id, row.name]));
      topBars = [
        usefulBars(
          "substations",
          "Eng ko’p sarfga ega podstansiyalar",
          substationRows,
          (row) => names.get(row.id) ?? "",
          "Podstansiyalar sahifasini ochish",
          "/substations",
          uploads.SUBSTATIONS ? "Podstansiyalar yo’q" : "Podstansiyalar yuklanmagan",
        ),
        feederBars(),
        transformerBars,
      ];
      break;
    }
    case "substation":
      topBars = [transformerLossBars(), feederBars(), transformerBars];
      break;
    case "feeder":
      // Fiderlar reytingi o'rnida (fider bitta) - TP lar qarzdorligi.
      topBars = [transformerLossBars(), transformerDebtBars(), transformerBars];
      break;
    case "transformer":
      // O'rtada - TP ning o'z abonentlari; chetlarida - fiderdagi TP lar.
      topBars = [transformerLossBars(), subscriberDebtBars(), transformerBars];
      break;
  }

  return {
    stateKey: scope.kind === "district" ? period.key : `${period.key}:${scopeParam(scope)}`,
    kpis: buildKpis(period, scope, current, previous, previousPeriod, series),
    objects: {
      tiles,
      repairs: {
        uploaded: uploads.TRANSFORMERS,
        done: { value: count(repairs.counts.done), href: scoped("/works", { done: "1" }) },
        planned: { value: count(repairs.counts.planned), href: scoped("/works", { done: "0" }) },
      },
    },
    map: buildMap(period, scope, scopeTransformers, topBefore?.usefulKwh ?? null, top),
    filter,
    violations,
    meters,
    appeals,
    suspicious,
    averages,
    quickMetrics,
    topBars,
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
      scope.kind === "district" ? `month=${period.key}` : `scope=${scopeParam(scope)}&month=${period.key}`,
  };
}
