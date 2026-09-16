import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ClockAlert,
  Gauge,
  HandCoins,
  MessagesSquare,
  Minus,
  PiggyBank,
  PlugZap,
  UserCheck,
  UserMinus,
  Users,
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
import { SUBSCRIBER_KIND_LABEL, VIOLATOR_TYPE_LABEL, VIOLATOR_TYPE_ORDER } from "@/lib/domain/labels";
import { delta, fractions, share } from "@/lib/domain/metrics";
import { EMPTY, count, energy, formatDate, money, monthName, num, percent, scaled } from "@/lib/format";
import type { PeriodInfo } from "@/lib/period";
import type { TransformerDetail as TransformerEntity } from "@/lib/queries/entities";
import type { RepairRow } from "@/lib/queries/repairs";
import type { ScopeSeriesPoint, ScopeSummary } from "@/lib/queries/scope";
import type { TransformerDetailData, TransformerDetailStats } from "@/lib/queries/transformers-detail";
import { scopedHref, scopeParam } from "@/lib/scope-param";

/*
 * TP detal sahifasi - fider detal sahifasi maketi (Figma `4029:930`), har bir
 * karta shu TP qamrovida. Sonlar `getTransformerDetailData` dan (umumiy
 * so'rovlar), bu fayl ularni kartalar kutgan matnga (`format.ts`) aylantiradi
 * va ikonka/rang tanlaydi. Yangi hisob-kitob yo'q - farq (`delta`), ulush
 * (`share`) va ustunchalar (`fractions`) umumiy funksiyalardan. Shablonda
 * manbasi yo'q ko'rsatkich (yuklama, harorat, holat, soatlik profil) yo'q.
 */

const MAP_ZOOM = 15;
/** Marker tultip ostida qolmasin: zoom 15 da 0,004° (~90px) sharqqa surilgan markaz. */
const MAP_CENTER_SHIFT = 0.004;

/** Qoidabuzar turi bo'yicha zarar halqalari rangi - fider sahifasi bilan bir xil. */
const DAMAGE_COLOR: Record<ViolatorType, string> = {
  LEGAL: "#f4cf3b",
  INDIVIDUAL: "#ff928a",
  INNOCENT: "#55c4ae",
};

const DEBTOR_COLUMNS: TableColumn[] = [
  { key: "contract", label: "Shartnoma", grow: 20 },
  { key: "name", label: "FISH", grow: 36, align: "left" },
  { key: "kind", label: "Turi", grow: 14 },
  { key: "debt", label: "Qarzdorlik", grow: 24 },
];

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

/** "2,1 ming kWh ga" - farq qiymati uchun. */
function kwhDiff(value: number): string {
  const parts = scaled(value, "kWh");
  return `${parts.value} ${parts.unit} ga`;
}

/**
 * O'tgan oy bilan farq qatori. `increaseBad` - o'sishi yomon ko'rsatkich
 * (yo'qotish, qarzdorlik); qolganlari neytral. O'tgan oy qiymati yo'q -
 * qator yo'q.
 */
function deltaLine(
  current: number | null,
  previous: number | null,
  formatDiff: (value: number) => string,
  kind: "neutral" | "increaseBad",
): Pick<KpiItem, "deltaIcon" | "deltaText" | "deltaTone"> {
  const change = delta(current, previous);
  if (!change) return {};
  // Ko'rsatilgan aniqlikda solishtiriladi (fider sahifasidagi kabi): "0 kWh ko’p" chiqmasin.
  if (formatDiff(Math.abs(change.diff)) === formatDiff(0)) {
    return { deltaIcon: Minus, deltaText: "O’zgarmagan", deltaTone: "neutral" };
  }
  const up = change.diff > 0;
  const tone: KpiTone = kind === "neutral" ? "neutral" : up ? "bad" : "good";
  return {
    deltaIcon: up ? ArrowUp : ArrowDown,
    deltaText: `${formatDiff(Math.abs(change.diff))} ${up ? "ko’p" : "kam"}`,
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

/** 12 oylik ustunchalar: qiymati yo'q oy - 0 balandlik. */
function barsOf(values: readonly (number | null)[]): Pick<KpiItem, "bars" | "barsLabel"> {
  return {
    bars: fractions(values.map((value) => value ?? 0)),
    barsLabel: `${values.length} oy`,
  };
}

function buildKpis(
  { current, previous, previousPeriod }: TransformerDetailStats["comparison"],
  series: readonly ScopeSeriesPoint[],
): KpiItem[] {
  const hasPrevious = previousPeriod !== null;
  /*
   * TP qamrovida energiya - TP ning o'z holati. O'tgan oyda TP holati yo'q
   * bo'lsa (yangi TP) yig'indilar "0" chiqadi - ular bilan solishtirilmaydi.
   */
  const previousTp = previous?.energy ? previous : null;
  const missing = (uploaded: boolean | undefined) => (uploaded ? "ma’lumot yo’q" : "yuklanmagan");

  const flow = (
    id: string,
    title: string,
    key: "totalKwh" | "usefulKwh" | "lossKwh",
    icon: GlyphIcon,
    tint: string,
    accent: string,
  ): KpiItem => {
    const value = current.energy?.[key] ?? null;
    const previousValue = previousTp?.energy?.[key] ?? null;
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
      ...deltaLine(value, previousValue, kwhDiff, key === "lossKwh" ? "increaseBad" : "neutral"),
      previous: previousLine(hasPrevious, previousValue, energy, missing(previous?.uploads.TRANSFORMERS)),
      ...barsOf(series.map((point) => point[key])),
    };
  };

  const subscribers = current.subscribers;
  const previousSubscribers = previousTp?.subscribers?.total ?? null;
  const debt = current.subscriberList.uploaded ? current.subscriberList.debtUzs : null;
  const previousDebt = previousTp?.subscriberList.uploaded ? previousTp.subscriberList.debtUzs : null;
  const appeals = current.appeals.uploaded ? current.appeals.total : null;
  const previousAppeals = previousTp?.appeals.uploaded ? previousTp.appeals.total : null;

  return [
    flow("total", "Umumiy oqim", "totalKwh", Zap, "bg-tint-blue", "bg-accent-blue"),
    flow("useful", "Foydali oqim", "usefulKwh", PlugZap, "bg-tint-green", "bg-accent-green"),
    flow("loss", "Yo’qotish", "lossKwh", ZapOff, "bg-tint-red", "bg-accent-red"),
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
      previous: previousLine(hasPrevious, previousSubscribers, count, missing(previous?.uploads.TRANSFORMERS)),
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
      ...deltaLine(debt, previousDebt, (value) => `${money(value)} ga`, "increaseBad"),
      previous: previousLine(hasPrevious, previousDebt, money, missing(previous?.uploads.SUBSCRIBERS)),
      ...barsOf(series.map((point) => point.debtUzs)),
    },
    {
      id: "appeals",
      title: "Murojaatlar",
      value: num(appeals),
      unit: appeals != null ? "ta" : "yuklanmagan",
      icon: MessagesSquare,
      tint: "bg-tint-indigo",
      accent: "bg-accent-indigo",
      ...deltaLine(appeals, previousAppeals, (value) => `${num(value)} taga`, "neutral"),
      previous: previousLine(hasPrevious, previousAppeals, count, missing(previous?.uploads.APPEALS)),
      ...barsOf(series.map((point) => point.appeals)),
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

function buildDebtorRows(debtors: TransformerDetailStats["debtors"]): TopRow[] {
  return debtors.rows.map((row) => ({
    id: row.id,
    label: row.contractNumber,
    value: row.debtUzs,
    valueText: money(row.debtUzs),
    cells: [
      <Link key="contract" href={`/subscribers/${row.id}`} className="font-medium text-brand hover:underline">
        {row.contractNumber}
      </Link>,
      <Link key="name" href={`/subscribers/${row.id}`} className="block truncate transition-colors hover:text-brand">
        {row.fullName}
      </Link>,
      SUBSCRIBER_KIND_LABEL[row.kind],
      <span key="debt" className="font-medium text-accent-red">
        {money(row.debtUzs)}
      </span>,
    ],
  }));
}

function buildMap(
  transformer: TransformerEntity,
  { current, previous }: TransformerDetailStats["comparison"],
) {
  const snapshot = transformer.snapshot;
  const coordinates =
    snapshot?.lat != null && snapshot.lng != null ? { lat: snapshot.lat, lng: snapshot.lng } : null;
  const markers: MapMarker[] = coordinates
    ? [{ id: transformer.id, ...coordinates, label: transformer.name, kind: "tp" }]
    : [];

  // Koordinata yo'q - xarita butun tumanni ko'rsatadi, tultip hech narsaga ishora qilmasin.
  if (!coordinates) return { markers, tooltip: null, center: undefined, zoom: undefined };

  const total = current.energy?.totalKwh ?? null;
  const parts = scaled(total, "kWh");
  const change = delta(total, previous?.energy?.totalKwh);
  const tooltip: MapTooltip = {
    title: "Transformator",
    label: transformer.name,
    // Tanlangan marker glifi rangi (`#ff383c`, `chipMarker`) - xaritadagi belgi izohi, holat emas.
    dot: "bg-accent-red",
    caption: "Bu oygi umumiy oqim",
    value: parts.value,
    unit: parts.unit,
    note: change
      ? Math.abs(change.diff) < 0.005
        ? "O’tgan oyga nisbatan umumiy oqim o’zgarmagan."
        : `O’tgan oyga nisbatan ${kwhDiff(Math.abs(change.diff))} ${change.diff > 0 ? "ko’p" : "kam"}.`
      : undefined,
  };

  return {
    markers,
    tooltip,
    center: { lat: coordinates.lat, lng: coordinates.lng + MAP_CENTER_SHIFT },
    zoom: MAP_ZOOM,
  };
}

function buildQuickMetrics(summary: ScopeSummary): QuickMetric[] {
  const { subscribers, subscriberList, appeals, violations } = summary;
  const notUploaded = "Yuklanmagan";
  return [
    {
      id: "offline-share",
      icon: UserMinus,
      tile: "bg-[#3b82f6]",
      caption: "Aloqadan chiqqan abonentlar ulushi",
      value: subscribers ? percent(share(subscribers.offline, subscribers.total)) : notUploaded,
    },
    {
      id: "debtors",
      icon: HandCoins,
      tile: "bg-[#ff928a]",
      caption: "Qarzdor abonentlar",
      value: subscriberList.uploaded ? count(subscriberList.debtors) : notUploaded,
    },
    {
      id: "credit",
      icon: PiggyBank,
      tile: "bg-[#ffae4c]",
      caption: "Haqdorlik",
      value: subscriberList.uploaded ? money(subscriberList.creditUzs) : notUploaded,
    },
    {
      id: "overdue-appeals",
      icon: ClockAlert,
      tile: "bg-[#8979ff]",
      caption: "Muddati buzilgan murojaatlar",
      value: appeals.uploaded ? `${count(appeals.byStatus.OVERDUE)} / ${num(appeals.total)}` : notUploaded,
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

/** Yuqori yo'lak: breadcrumb (Transformatorlar / podstansiya / fider / TP) va holat sanasi. */
function TransformerHeader({ transformer, period }: { transformer: TransformerEntity; period: PeriodInfo }) {
  const snapshot = transformer.snapshot;
  const facts = [
    snapshot?.capacityKva != null ? `Quvvati: ${num(snapshot.capacityKva)} kVA` : null,
    snapshot?.address ? `Manzil: ${snapshot.address}` : null,
    `${formatDate(period.reportDate)} holatiga`,
  ].filter((fact): fact is string => fact !== null);
  const crumbClass = "shrink-0 text-ink-muted transition-colors hover:text-brand";

  return (
    <header className="col-span-full flex h-10 min-w-0 items-center justify-between gap-4 rounded-xl bg-surface px-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
        <Link href="/transformers" className={crumbClass}>
          Transformatorlar
        </Link>
        <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-soft" />
        <Link href={`/substations/${transformer.substation.id}`} className={crumbClass} title="Podstansiya sahifasi">
          {transformer.substation.name} podstansiyasi
        </Link>
        <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-soft" />
        <Link href={`/feeders/${transformer.feeder.id}`} className={crumbClass} title="Fider sahifasi">
          {transformer.feeder.name} fideri
        </Link>
        <Icon icon={ChevronRight} size={14} className="shrink-0 text-ink-soft" />
        <h1 className="truncate text-sm font-bold text-ink">{transformer.name}</h1>
      </nav>
      <p className="min-w-0 truncate text-[11px] text-ink-soft" title={facts.join(" · ")}>
        {facts.join(" · ")}
      </p>
    </header>
  );
}

/**
 * TP detal sahifasi, `/transformers/[id]`. Grid va qator balandliklari fider
 * sahifasi (`FeederDetail`) bilan bir xil: 18 ustun, 8px oraliq, sarlavha +
 * 4 qator.
 */
export function TransformerDetail({ data }: { data: TransformerDetailData }) {
  const { transformer, period, stats } = data;

  if (!stats) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <TransformerHeader transformer={transformer} period={period} />
        <div className="min-h-0 flex-1 rounded-2xl bg-surface">
          <EmptyState
            variant="inline"
            title={`${transformer.name} uchun ${period.label} oyida ma’lumot yo’q`}
            description="Boshqa oyni tanlang yoki shu oy uchun Transformatorlar faylini yuklang."
          />
        </div>
      </div>
    );
  }

  const { comparison, series, debtors, repairs } = stats;
  const summary = comparison.current;
  const scope = { kind: "transformer", id: transformer.id } as const;
  const month = monthName(period.month);
  const staff = transformer.snapshot?.staff ?? null;
  const map = buildMap(transformer, comparison);

  const damageKinds: DamageKind[] = VIOLATOR_TYPE_ORDER.map((type) => ({
    id: type,
    label: VIOLATOR_TYPE_LABEL[type],
    value: summary.violations.damageUzsByType[type],
    color: DAMAGE_COLOR[type],
  }));

  // Bajarilganlar - eng yangisi yuqorida; rejalashtirilganlar - eng yaqini yuqorida.
  const done = repairs.rows.filter((row) => row.done).reverse().map(toWork);
  const planned = repairs.rows.filter((row) => !row.done).map(toWork);

  return (
    <div className="scrollbar-none grid h-full min-h-0 grid-cols-18 grid-rows-[auto_minmax(187px,196fr)_minmax(285px,298fr)_minmax(321px,336fr)_minmax(199px,209fr)] gap-2 overflow-y-auto">
      <TransformerHeader transformer={transformer} period={period} />

      {/* 1-qator - KPI kartalari (6 x span-3) */}
      <KpiRow kpis={buildKpis(comparison, series)} />

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
          caption={`${transformer.name} transformatori`}
          footerLabel="Xodim faoliyati"
          footerHref={staff ? `/staff?q=${encodeURIComponent(staff.name)}` : undefined}
        />
      </div>
      <TopTransformersCard
        className="col-span-6"
        title="Eng katta qarzdor abonentlar"
        columns={DEBTOR_COLUMNS}
        rows={buildDebtorRows(debtors)}
        axisWidth={72}
        footerLabel={`Barcha abonentlar (${num(summary.subscriberList.total)})`}
        footerHref={debtors.uploaded ? scopedHref("/subscribers", scope) : undefined}
        emptyText={debtors.uploaded ? "Qarzdor abonentlar yo’q" : "Abonentlar ro’yxati yuklanmagan"}
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
        selectedId={transformer.id}
        fitDistrict={map.markers.length === 0}
        center={map.center}
        zoom={map.zoom}
        footerHref={`/map?node=${scopeParam(scope)}`}
      />
      <QuickMetricsCard className="col-span-4" metrics={buildQuickMetrics(summary)} />

      {/* 4-qator */}
      <CompletedWorksCard className="col-span-6" works={done} />
      <PlannedWorksCard className="col-span-8" works={planned} />
      <DownloadReportsCard className="col-span-4" query={`scope=${scopeParam(scope)}&month=${period.key}`} />
    </div>
  );
}
