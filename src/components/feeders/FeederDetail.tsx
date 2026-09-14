import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  CircuitBoard,
  ClockAlert,
  Gauge,
  HandCoins,
  Minus,
  PlugZap,
  UserCheck,
  UserMinus,
  Users,
  Wifi,
  Zap,
  ZapOff,
} from "lucide-react";
import Link from "next/link";

import { CompletedWorksCard, type RepairWork } from "@/components/cards/CompletedWorksCard";
import { ConsumptionDynamicsCard, type DynamicsMonth } from "@/components/cards/ConsumptionDynamicsCard";
import { DebtCard } from "@/components/cards/DebtCard";
import { DownloadReportsCard } from "@/components/cards/DownloadReportsCard";
import { InteractiveMapCard, type MapTooltip } from "@/components/cards/InteractiveMapCard";
import type { KpiTone } from "@/components/cards/KpiCard";
import { type KpiItem, KpiRow } from "@/components/cards/KpiRow";
import { type DamageKind, LossDamageCard } from "@/components/cards/LossDamageCard";
import { PlannedWorksCard } from "@/components/cards/PlannedWorksCard";
import { type QuickMetric, QuickMetricsCard } from "@/components/cards/QuickMetricsCard";
import { ResponsibleStaffCard } from "@/components/cards/ResponsibleStaffCard";
import { type TopRow, TopTransformersCard } from "@/components/cards/TopTransformersCard";
import { ViolationsCard } from "@/components/cards/ViolationsCard";
import type { MapMarker } from "@/components/map/MapCanvas";
import type { TableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import type { ViolatorType } from "@/generated/prisma";
import { VIOLATOR_TYPE_LABEL, VIOLATOR_TYPE_ORDER } from "@/lib/domain/labels";
import { delta, fractions, share } from "@/lib/domain/metrics";
import { EMPTY, count, energy, formatDate, money, monthName, num, percent, scaled } from "@/lib/format";
import type { PeriodInfo } from "@/lib/period";
import type { FeederDetail as FeederEntity } from "@/lib/queries/entities";
import type { FeederDashboard } from "@/lib/queries/feeders-detail";
import type { RepairRow } from "@/lib/queries/repairs";
import type { ScopeSeriesPoint, ScopeSummary } from "@/lib/queries/scope";
import { scopedHref, scopeParam } from "@/lib/scope-param";

/*
 * Maket - fider detal sahifasi (Figma `4029:930`). Har bir karta shu fider
 * qamrovidagi shablon qiymatlarini ko'rsatadi: bu fayl `getFeederDashboard`
 * natijasini kartalar kutgan matnga (`format.ts`) aylantiradi va ikonka/rang
 * tanlaydi. Yangi hisob-kitob yo'q - farq (`delta`), ulush (`share`) va
 * ustunchalar (`fractions`) umumiy funksiyalardan.
 */

export interface FeederDetailData {
  feeder: FeederEntity;
  period: PeriodInfo;
  /** Fiderning tanlangan oyda holati yo'q bo'lsa - null. */
  dashboard: FeederDashboard | null;
}

/** Xarita: bitta TP bo'lsa shu masshtab; bir nechta bo'lsa hammasi sig'adigan eng yaqini. */
const MAP_SINGLE_ZOOM = 15;
const MAP_MIN_ZOOM = 11;
const MAP_MAX_ZOOM = 16;
/** Karta ichidagi xarita maydoni taxminan 455x248px - markerlar chetga tegmasin. */
const MAP_VIEW_PX = { width: 380, height: 180 };

const DAMAGE_COLOR: Record<ViolatorType, string> = {
  LEGAL: "#f4cf3b",
  INDIVIDUAL: "#ff928a",
  INNOCENT: "#55c4ae",
};

const TRANSFORMER_COLUMNS: TableColumn[] = [
  { key: "name", label: "Nomi", grow: 1.2, align: "left" },
  { key: "useful", label: "Foydali oqim, kWh" },
  { key: "loss", label: "Yo’qotish, %" },
];

/** Karta sig'imi: jadvalda ham, grafikda ham ko'pi bilan shuncha TP. */
const TOP_TRANSFORMERS = 10;

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

/** "2,1 ming kWh" - farq qiymati uchun. */
function scaledText(value: number, unit: string): string {
  const parts = scaled(value, unit);
  return `${parts.value} ${parts.unit}`;
}

/**
 * Oldingi oy bilan farq qatori. `kind`: "loss" va "debt" - o'sish yomon,
 * kamayish yaxshi; qolganlari neytral.
 */
function deltaLine(
  current: number | null,
  previous: number | null,
  formatDiff: (value: number) => string,
  kind: "neutral" | "increaseBad",
): Pick<KpiItem, "deltaIcon" | "deltaText" | "deltaTone"> {
  const change = delta(current, previous);
  if (!change) return {};
  // Ko'rsatilgan aniqlikda solishtiriladi: "0 kWh ga ko’p" chiqmasin.
  if (formatDiff(Math.abs(change.diff)) === formatDiff(0)) {
    return { deltaIcon: Minus, deltaText: "O’zgarmagan", deltaTone: "neutral" };
  }
  const up = change.diff > 0;
  const tone: KpiTone = kind === "neutral" ? "neutral" : up ? "bad" : "good";
  return {
    deltaIcon: up ? ArrowUp : ArrowDown,
    deltaText: `${formatDiff(Math.abs(change.diff))} ga ${up ? "ko’p" : "kam"}`,
    deltaTone: tone,
  };
}

/** "O’tgan oy: ..." - o'tgan oy davri bazada bo'lmasa qator yo'q. */
function previousLine(
  hasPreviousPeriod: boolean,
  value: number | null,
  format: (value: number) => string,
  missing: string,
): string | null {
  if (!hasPreviousPeriod) return null;
  return `O’tgan oy: ${value != null ? format(value) : missing}`;
}

const NOT_UPLOADED = "yuklanmagan";
const NO_DATA = "ma’lumot yo’q";

/**
 * O'tgan oy qiymati: shablon yuklanmagan bo'lsa "yuklanmagan"; Fiderlar
 * yuklangan-u, fiderning o'zi o'sha oyda yo'q bo'lsa - "ma’lumot yo’q"
 * (TP soni, abonent va qarz 0 bo'lib chiqadi, lekin bu haqiqiy 0 emas).
 */
function previousValue(
  previous: ScopeSummary | null,
  uploaded: (summary: ScopeSummary) => boolean,
  value: (summary: ScopeSummary) => number | null,
): { value: number | null; missing: string } {
  if (!previous || !uploaded(previous)) return { value: null, missing: NOT_UPLOADED };
  if (previous.uploads.FEEDERS && previous.energy === null) return { value: null, missing: NO_DATA };
  return { value: value(previous), missing: NO_DATA };
}

/** 12 oylik ustunchalar: qiymati yo'q oy - 0 balandlik. */
function barsOf(values: readonly (number | null)[]): Pick<KpiItem, "bars" | "barsLabel"> {
  return {
    bars: fractions(values.map((value) => value ?? 0)),
    barsLabel: `${values.length} oy`,
  };
}

function buildKpis(
  { current, previous, previousPeriod }: FeederDashboard["comparison"],
  series: readonly ScopeSeriesPoint[],
  transformerCounts: readonly (number | null)[],
): KpiItem[] {
  const hasPrevious = previousPeriod !== null;
  const energyOf = (summary: ScopeSummary | null, key: "totalKwh" | "usefulKwh" | "lossKwh") =>
    summary?.energy?.[key] ?? null;
  const kwh = (value: number) => scaledText(value, "kWh");

  const flow = (
    id: string,
    title: string,
    key: "totalKwh" | "usefulKwh" | "lossKwh",
    icon: GlyphIcon,
    tint: string,
    accent: string,
  ): KpiItem => {
    const value = energyOf(current, key);
    const before = previousValue(previous, (summary) => summary.uploads.FEEDERS, (summary) => energyOf(summary, key));
    const parts = scaled(value, "kWh");
    const lossShare = key === "lossKwh" ? current.energy?.lossPercent : undefined;
    return {
      id,
      title,
      value: parts.value,
      unit: lossShare != null ? `${parts.unit} · ${percent(lossShare)}` : parts.unit,
      icon,
      tint,
      accent,
      ...deltaLine(value, before.value, kwh, key === "lossKwh" ? "increaseBad" : "neutral"),
      previous: previousLine(hasPrevious, before.value, energy, before.missing),
      ...barsOf(series.map((point) => point[key])),
    };
  };

  const transformers = current.counts.transformers;
  const previousTransformers = previousValue(
    previous,
    (summary) => summary.uploads.TRANSFORMERS,
    (summary) => summary.counts.transformers,
  );
  const subscribers = current.subscribers;
  const previousSubscribers = previousValue(
    previous,
    (summary) => summary.uploads.TRANSFORMERS,
    (summary) => summary.subscribers?.total ?? null,
  );
  const debt = current.subscriberList.uploaded ? current.subscriberList.debtUzs : null;
  const previousDebt = previousValue(
    previous,
    (summary) => summary.subscriberList.uploaded,
    (summary) => summary.subscriberList.debtUzs,
  );

  return [
    flow("total", "Umumiy oqim", "totalKwh", Zap, "bg-tint-blue", "bg-accent-blue"),
    flow("useful", "Foydali oqim", "usefulKwh", PlugZap, "bg-tint-green", "bg-accent-green"),
    flow("loss", "Yo’qotish", "lossKwh", ZapOff, "bg-tint-red", "bg-accent-red"),
    {
      id: "transformers",
      title: "Transformatorlar",
      value: num(transformers),
      unit: transformers != null ? "ta" : "yuklanmagan",
      icon: CircuitBoard,
      tint: "bg-tint-indigo",
      accent: "bg-accent-indigo",
      ...deltaLine(transformers, previousTransformers.value, (value) => `${num(value)} ta`, "neutral"),
      previous: previousLine(hasPrevious, previousTransformers.value, count, previousTransformers.missing),
      ...barsOf(transformerCounts),
    },
    {
      id: "subscribers",
      title: "Abonentlar",
      value: num(subscribers?.total),
      unit: subscribers ? "ta umumiy" : "yuklanmagan",
      icon: Users,
      tint: "bg-tint-purple",
      accent: "bg-accent-purple",
      ...(subscribers
        ? {
            deltaIcon: UserCheck,
            deltaText: `${num(subscribers.online)} aloqada · ${num(subscribers.offline)} aloqadan chiqqan`,
            deltaTone: "neutral" as const,
          }
        : {}),
      previous: previousLine(hasPrevious, previousSubscribers.value, count, previousSubscribers.missing),
      ...barsOf(series.map((point) => point.subscribers)),
    },
    {
      id: "debt",
      title: "Qarzdorlik",
      value: debt != null ? scaled(debt, "so’m").value : EMPTY,
      unit: debt != null ? scaled(debt, "so’m").unit : "ro’yxat yuklanmagan",
      icon: HandCoins,
      tint: "bg-tint-brown",
      accent: "bg-accent-brown",
      ...deltaLine(debt, previousDebt.value, money, "increaseBad"),
      previous: previousLine(hasPrevious, previousDebt.value, money, previousDebt.missing),
      ...barsOf(series.map((point) => point.debtUzs)),
    },
  ];
}

// ---------------------------------------------------------------------------
// Kartalar
// ---------------------------------------------------------------------------

function buildMonths(series: readonly ScopeSeriesPoint[]): DynamicsMonth[] {
  return series.flatMap((point) =>
    point.hasData
      ? [
          {
            key: point.key,
            label: point.fullLabel,
            billed: point.totalKwh ?? 0,
            consumed: point.usefulKwh ?? 0,
            loss: point.lossKwh ?? 0,
          },
        ]
      : [],
  );
}

function buildTransformerRows(transformers: FeederDashboard["transformers"]): TopRow[] {
  return [...transformers]
    .sort((a, b) => b.usefulKwh - a.usefulKwh)
    .slice(0, TOP_TRANSFORMERS)
    .map((row) => ({
      id: row.id,
      label: row.name,
      value: row.usefulKwh,
      valueText: energy(row.usefulKwh),
      cells: [
        <Link
          key="name"
          href={`/transformers/${row.id}`}
          className="font-medium text-ink transition-colors hover:text-brand hover:underline"
        >
          {row.name}
        </Link>,
        num(row.usefulKwh),
        percent(row.lossPercent),
      ],
    }));
}

/** Markerlar hammasi ko'rinadigan markaz va masshtab (Web Mercator, taxminiy). */
function mapView(markers: readonly MapMarker[]): { center: { lat: number; lng: number }; zoom: number } {
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

function buildMap(dashboard: FeederDashboard) {
  const markers: MapMarker[] = dashboard.transformers.flatMap((row) =>
    row.lat != null && row.lng != null ? [{ id: row.id, lat: row.lat, lng: row.lng, label: row.name, kind: "tp" }] : [],
  );
  const focus = dashboard.mapFocus;
  const top = focus ? dashboard.transformers.find((row) => row.id === focus.transformerId) : undefined;

  let tooltip: MapTooltip | null = null;
  if (focus && top) {
    const parts = scaled(top.usefulKwh, "kWh");
    const change = delta(top.usefulKwh, focus.previousUsefulKwh);
    tooltip = {
      title: "Eng ko’p sarfga ega transformator",
      label: top.name,
      dot: "bg-accent-red",
      caption: "Bu oygi foydali oqim",
      value: parts.value,
      unit: parts.unit,
      note: change
        ? change.diff === 0
          ? "O’tgan oyga nisbatan foydali oqim o’zgarmagan."
          : `O’tgan oyga nisbatan ${scaledText(Math.abs(change.diff), "kWh")} ga ${change.diff > 0 ? "ko’p" : "kam"}.`
        : undefined,
    };
  }

  return { markers, tooltip, selectedId: top?.id ?? null, ...(markers.length > 0 ? mapView(markers) : {}) };
}

function buildQuickMetrics(summary: ScopeSummary): QuickMetric[] {
  const { subscribers, subscriberList, appeals, violations } = summary;
  const notUploaded = "Yuklanmagan";
  return [
    {
      id: "online-share",
      icon: Wifi,
      tile: "bg-[#3b82f6]",
      caption: "Aloqadagi abonentlar ulushi",
      value: subscribers ? percent(share(subscribers.online, subscribers.total)) : notUploaded,
    },
    {
      id: "offline",
      icon: UserMinus,
      tile: "bg-[#ff928a]",
      caption: "Aloqadan chiqqan abonentlar",
      value: subscribers ? count(subscribers.offline) : notUploaded,
    },
    {
      id: "debtors",
      icon: HandCoins,
      tile: "bg-[#ffae4c]",
      caption: "Qarzdor abonentlar",
      value: subscriberList.uploaded ? count(subscriberList.debtors) : notUploaded,
    },
    {
      id: "overdue-appeals",
      icon: ClockAlert,
      tile: "bg-[#8979ff]",
      caption: "Muddati buzilgan murojaatlar",
      value: appeals.uploaded
        ? `${count(appeals.byStatus.OVERDUE)} / ${num(appeals.total)}`
        : notUploaded,
    },
    {
      id: "damage-kwh",
      icon: Gauge,
      tile: "bg-[#2bb7dc]",
      caption: "Qoidabuzarlik zarari (taxminiy)",
      value: violations.uploaded ? energy(violations.damageKwh) : notUploaded,
    },
  ];
}

function toWork(row: RepairRow): RepairWork {
  return { id: row.id, tp: row.transformer.name, work: row.label, date: formatDate(row.date) };
}

// ---------------------------------------------------------------------------
// Sahifa
// ---------------------------------------------------------------------------

/** Yuqori yo'lak: breadcrumb (Fiderlar / podstansiya / fider) va holat sanasi. */
function FeederHeader({ feeder, period }: { feeder: FeederEntity; period: PeriodInfo }) {
  const snapshot = feeder.snapshot;
  const facts = [
    snapshot?.capacityKva != null ? `Quvvati: ${num(snapshot.capacityKva)} kVA` : null,
    snapshot?.address ? `Manzil: ${snapshot.address}` : null,
    `${formatDate(period.reportDate)} holatiga`,
  ].filter((fact): fact is string => fact !== null);

  return (
    <header className="col-span-full flex h-10 min-w-0 items-center justify-between gap-4 rounded-xl bg-surface px-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
        <Link href="/feeders" className="shrink-0 text-ink-muted transition-colors hover:text-brand">
          Fiderlar
        </Link>
        <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-soft" />
        <Link
          href={`/substations/${feeder.substation.id}`}
          className="shrink-0 text-ink-muted transition-colors hover:text-brand"
          title="Podstansiya sahifasi"
        >
          {feeder.substation.name} podstansiyasi
        </Link>
        <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-soft" />
        <h1 className="truncate text-sm font-bold text-ink">{feeder.name} fideri</h1>
      </nav>
      <p className="min-w-0 truncate text-[11px] text-ink-soft" title={facts.join(" · ")}>
        {facts.join(" · ")}
      </p>
    </header>
  );
}

/**
 * Fider detal sahifasi (Figma `4029:930` -> "Main"), `/feeders/[id]`.
 *
 * 18 ustunli grid, 8px oraliq. Maketdagi 4 qator (196 / 298 / 336 / 209)
 * ustiga 40px sarlavha qo'shildi, shuning uchun qatorlar 1064px ish maydoniga
 * sig'ishi uchun ~4,5% ga qisqartirilgan (187 / 285 / 321 / 199); balandroq
 * ekranda mutanosib cho'ziladi.
 */
export function FeederDetail({ data }: { data: FeederDetailData }) {
  const { feeder, period, dashboard } = data;

  if (!dashboard) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <FeederHeader feeder={feeder} period={period} />
        <div className="min-h-0 flex-1 rounded-2xl bg-surface">
          <EmptyState
            variant="inline"
            title={`${feeder.name} fideri uchun ${period.label} oyida ma’lumot yo’q`}
            description="Boshqa oyni tanlang yoki shu oy uchun Fiderlar faylini yuklang."
          />
        </div>
      </div>
    );
  }

  const { comparison, series, transformers } = dashboard;
  const summary = comparison.current;
  const scope = { kind: "feeder", id: feeder.id } as const;
  const month = monthName(period.month);
  const staff = feeder.snapshot?.staff ?? null;
  const map = buildMap(dashboard);

  const damageKinds: DamageKind[] = VIOLATOR_TYPE_ORDER.map((type) => ({
    id: type,
    label: VIOLATOR_TYPE_LABEL[type],
    value: summary.violations.damageUzsByType[type],
    color: DAMAGE_COLOR[type],
  }));

  const done = dashboard.repairs.rows.filter((row) => row.done).reverse().map(toWork);
  const planned = dashboard.repairs.rows.filter((row) => !row.done).map(toWork);

  return (
    <div className="scrollbar-none grid h-full min-h-0 grid-cols-18 grid-rows-[auto_minmax(187px,196fr)_minmax(285px,298fr)_minmax(321px,336fr)_minmax(199px,209fr)] gap-2 overflow-y-auto">
      <FeederHeader feeder={feeder} period={period} />

      {/* 1-qator - KPI kartalari (6 x span-3) */}
      <KpiRow kpis={buildKpis(comparison, series, dashboard.transformerCounts)} />

      {/* 2-qator */}
      <ConsumptionDynamicsCard className="col-span-6" months={buildMonths(series)} />
      <div className="col-span-6 grid min-h-0 grid-rows-[minmax(0,148fr)_minmax(0,142fr)] gap-2">
        <ViolationsCard
          counts={summary.violations.byType}
          damageUzs={summary.violations.damageUzs}
          uploaded={summary.violations.uploaded}
        />
        <ResponsibleStaffCard
          staff={staff ? { name: staff.name } : null}
          caption={`${feeder.name} fideri`}
          footerLabel="Xodim faoliyati"
          footerHref={staff ? `/staff?q=${encodeURIComponent(staff.name)}` : undefined}
        />
      </div>
      <TopTransformersCard
        className="col-span-6"
        title="Eng ko’p sarfga ega transformatorlar"
        columns={TRANSFORMER_COLUMNS}
        rows={buildTransformerRows(transformers)}
        axisWidth={56}
        footerLabel={`Barcha transformatorlar (${num(transformers.length)})`}
        footerHref={summary.uploads.TRANSFORMERS ? scopedHref("/transformers", scope) : undefined}
        emptyText={summary.uploads.TRANSFORMERS ? "Bu fiderda transformator yo’q" : "Transformatorlar yuklanmagan"}
      />

      {/* 3-qator */}
      <DebtCard
        className="col-span-4"
        month={month}
        total={summary.subscriberList.debtUzs}
        household={summary.subscriberList.debtByKind.HOUSEHOLD}
        legal={summary.subscriberList.debtByKind.LEGAL}
        uploaded={summary.subscriberList.uploaded}
      />
      <LossDamageCard
        className="col-span-4"
        title="Keltirilgan zarar"
        kinds={damageKinds}
        total={summary.violations.damageUzs}
        month={month}
        uploaded={summary.violations.uploaded}
      />
      <InteractiveMapCard
        className="col-span-6"
        markers={map.markers}
        tooltip={map.tooltip}
        selectedId={map.selectedId}
        fitDistrict={false}
        center={map.center}
        zoom={map.zoom}
        footerHref={`/map?node=${scopeParam(scope)}`}
      />
      <QuickMetricsCard className="col-span-4" metrics={buildQuickMetrics(summary)} />

      {/* 4-qator */}
      <CompletedWorksCard className="col-span-6" works={done} />
      <PlannedWorksCard className="col-span-8" works={planned} />
      <DownloadReportsCard
        className="col-span-4"
        query={`scope=${scopeParam(scope)}&month=${period.key}`}
      />
    </div>
  );
}
