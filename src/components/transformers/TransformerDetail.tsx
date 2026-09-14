import {
  ArrowBigDownDash,
  ArrowDown,
  ArrowUp,
  ClockArrowUp,
  Gauge,
  HandCoins,
  PlugZap,
  SquareCheckBig,
  Thermometer,
  UserCheck,
  UserMinus,
  Users,
  Zap,
  ZapOff,
} from "lucide-react";

import { CompletedWorksCard } from "@/components/cards/CompletedWorksCard";
import { ConsumptionDynamicsCard } from "@/components/cards/ConsumptionDynamicsCard";
import { DownloadReportsCard } from "@/components/cards/DownloadReportsCard";
import { InteractiveMapCard, type MapTooltip } from "@/components/cards/InteractiveMapCard";
import { type KpiItem, KpiRow } from "@/components/cards/KpiRow";
import { type LossKind, LossDamageCard } from "@/components/cards/LossDamageCard";
import { type PlannedWork, PlannedWorksCard } from "@/components/cards/PlannedWorksCard";
import { type QuickMetric, QuickMetricsCard } from "@/components/cards/QuickMetricsCard";
import { ResponsibleStaffCard } from "@/components/cards/ResponsibleStaffCard";
import { RingStatsCard, type StatRing } from "@/components/cards/RingStatsCard";
import { type TopRow, TopTransformersCard } from "@/components/cards/TopTransformersCard";
import { ViolationsCard } from "@/components/cards/ViolationsCard";
import { Badge, type BadgeTone, type TableColumn } from "@/components/ui/DataTable";
import { dec, money, num } from "@/lib/data/seed";
import {
  SUBSCRIBER_STATUS_LABEL,
  type SubscriberStatus,
} from "@/lib/data/subscribers";
import { transformerScope } from "@/lib/data/transformer-scope";
import type { Transformer, TransformerStatus } from "@/lib/data/transformers";

/*
 * Maket - fider detal sahifasi (Figma `4029:930`), kartalar ham o'sha. Farqi
 * faqat ma'lumotda: har bir karta shu TP qamrovidagi sonlarni ko'rsatadi
 * (`@/lib/data/transformer-scope`). Bu fayl sonlarni kartalar kutgan matnga
 * aylantiradi va ikonka/rang tanlaydi.
 */

/** Maket "bugun"i avgustda - halqali diagrammalardagi oy nomi. */
const MONTH = "Avgust";

const MAP_ZOOM = 15;
/** Zoom 15 da 1° uzunlik ~23 300px, ya'ni 0,004° ~ 90px. */
const MAP_CENTER_SHIFT = 0.004;

const STATUS_DOT: Record<TransformerStatus, string> = {
  ok: "bg-accent-green",
  warning: "bg-accent-amber",
  critical: "bg-accent-red",
  offline: "bg-ink-soft",
};

const SUBSCRIBER_TONE: Record<SubscriberStatus, BadgeTone> = {
  active: "green",
  debtor: "amber",
  disconnected: "red",
};

const SUBSCRIBER_COLUMNS: TableColumn[] = [
  { key: "code", label: "Shartnoma", grow: 18 },
  { key: "name", label: "Nomi", grow: 26, align: "left" },
  { key: "status", label: "Holat", grow: 15 },
  { key: "usage", label: "Iste’mol", grow: 15 },
  // Manfiy balans ("-1,2 mln so'm") eng uzun katak - kesilmasligi uchun kengroq.
  { key: "balance", label: "Balans", grow: 26 },
];

/** "12,4" - ming kWh da, KPI kartalaridagi maket formati. */
function thousands(kwh: number): string {
  return dec(kwh / 1000);
}

/**
 * Oyma-oy farq qatori. Energiya va qarzdorlik kontekstida o'sish yomon
 * (maketdagi kabi: "ko'p" - qizil, "kam" - yashil).
 */
function delta(current: number, previous: number, format: (value: number) => string) {
  const up = current > previous;
  return {
    deltaIcon: up ? ArrowUp : ArrowDown,
    deltaText: `${format(Math.abs(current - previous))} ga ${up ? "ko’p" : "kam"}`,
    deltaTone: up ? ("bad" as const) : ("good" as const),
  };
}

/** Summa va birlik: million so'mdan boshlab "mln", undan kichigi "ming". */
function moneyParts(sum: number): { value: string; unit: string; divisor: number } {
  return sum >= 1_000_000
    ? { value: dec(sum / 1_000_000), unit: "mln so’m", divisor: 1_000_000 }
    : { value: dec(sum / 1000), unit: "ming so’m", divisor: 1000 };
}

/** 1-2-5 qatoridagi eng kichik qadam: `value` dan katta yoki teng. */
function niceStep(value: number): number {
  if (value <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((factor) => factor * base >= value) ?? 10;
  return Number((step * base).toPrecision(6));
}

function tick(value: number): string {
  return String(Number(value.toFixed(2))).replace(".", ",");
}

export function TransformerDetail({ transformer }: { transformer: Transformer }) {
  const scope = transformerScope(transformer);
  const { energy } = scope;

  /* --- 1-qator: KPI --------------------------------------------------- */

  const debtNow = moneyParts(scope.debt);
  const kpis: KpiItem[] = [
    {
      id: "billed",
      title: "Hisoblangan",
      value: thousands(energy.billed),
      unit: "ming kWh",
      icon: Zap,
      ...delta(energy.billed, energy.billedPrev, (value) => `${thousands(value)} ming kWh`),
      previous: `O’tgan oy: ${thousands(energy.billedPrev)} ming kWh`,
      bars: scope.bars.billed,
      barsLabel: "30 kun",
      tint: "bg-tint-blue",
      accent: "bg-accent-blue",
    },
    {
      id: "consumed",
      title: "Iste’mol",
      value: thousands(energy.consumed),
      unit: "ming kWh",
      icon: PlugZap,
      ...delta(energy.consumed, energy.consumedPrev, (value) => `${thousands(value)} ming kWh`),
      previous: `O’tgan oy: ${thousands(energy.consumedPrev)} ming kWh`,
      bars: scope.bars.consumed,
      barsLabel: "30 kun",
      tint: "bg-tint-green",
      accent: "bg-accent-green",
    },
    {
      id: "loss",
      title: "Yo’qotish",
      value: thousands(energy.loss),
      unit: "ming kWh",
      icon: ZapOff,
      ...delta(energy.loss, energy.lossPrev, (value) => `${thousands(value)} ming kWh`),
      previous: `O’tgan oy: ${thousands(energy.lossPrev)} ming kWh`,
      bars: scope.bars.loss,
      barsLabel: "30 kun",
      tint: "bg-tint-red",
      accent: "bg-accent-red",
    },
    {
      id: "subscribers",
      title: "Abonentlar",
      value: num(scope.subscribers.length),
      unit: "ta umumiy",
      icon: Users,
      deltaIcon: scope.offlineMeters > 0 ? UserMinus : UserCheck,
      deltaText:
        scope.offlineMeters > 0 ? `${scope.offlineMeters} ta aloqada emas` : "Hammasi aloqada",
      deltaTone: scope.offlineMeters > 0 ? "bad" : "good",
      previous: `Qarzdor: ${scope.debtors} ta`,
      bars: scope.bars.usage,
      barsLabel: "12 oy",
      tint: "bg-tint-purple",
      accent: "bg-accent-purple",
    },
    {
      id: "load",
      title: "Yuklama",
      value: dec(transformer.loadPercent, 0),
      unit: `% · ${num(transformer.powerKva)} kVA`,
      icon: Gauge,
      deltaIcon: Thermometer,
      deltaText: `Harorat: ${num(transformer.temperature)}°C`,
      deltaTone: transformer.temperature > 75 ? "bad" : "good",
      previous: transformer.loadPercent > 100 ? "Nominaldan oshgan" : `Kuchlanish: ${transformer.voltage}`,
      bars: scope.bars.hourly,
      barsLabel: "24 soat",
      tint: "bg-tint-indigo",
      accent: "bg-accent-indigo",
    },
    {
      id: "debt",
      title: "Qarzdorlik",
      value: debtNow.value,
      unit: debtNow.unit,
      icon: HandCoins,
      ...delta(scope.debt, scope.debtPrev, money),
      previous: `O’tgan oy: ${money(scope.debtPrev)}`,
      bars: scope.bars.debt,
      barsLabel: "12 oy",
      tint: "bg-tint-brown",
      accent: "bg-accent-brown",
    },
  ];

  /* --- 2-qator: abonentlar jadvali ------------------------------------ */

  const subscriberRows: TopRow[] = scope.subscribers.map((item) => ({
    id: item.id,
    label: item.code,
    value: item.monthlyKwh,
    cells: [
      <span key="code" className="font-medium">
        {item.code}
      </span>,
      <span key="name" className="block truncate">
        {item.name}
      </span>,
      <Badge key="status" tone={SUBSCRIBER_TONE[item.status]}>
        {SUBSCRIBER_STATUS_LABEL[item.status]}
      </Badge>,
      `${num(item.monthlyKwh)} kWh`,
      <span key="balance" className={item.balance < 0 ? "font-medium text-accent-red" : undefined}>
        {money(item.balance)}
      </span>,
    ],
  }));

  /* --- 3-qator: qarzdorlik, zarar, xarita, tezkor ko'rsatkichlar ------ */

  const debtUnit = moneyParts(scope.debt);
  const debtStep = niceStep((scope.debt / debtUnit.divisor) * 1.1 / 5);
  const debtRings: StatRing[] = [
    { id: "total", label: "Umumiy", amount: money(scope.debtByKind.total), color: "#3cc3df" },
    { id: "household", label: "Aholi", amount: money(scope.debtByKind.household), color: "#ff928a" },
    { id: "other", label: "Yuridik va budjet", amount: money(scope.debtByKind.other), color: "#8979ff" },
  ].map((ring) => ({
    ...ring,
    arc: scope.debtByKind[ring.id as keyof typeof scope.debtByKind] / debtUnit.divisor,
  }));

  const damageUnit = moneyParts(Math.max(...Object.values(scope.damageByKind)));
  const damageValues = {
    natural: scope.damageByKind.natural / damageUnit.divisor,
    technological: scope.damageByKind.technological / damageUnit.divisor,
    theft: scope.damageByKind.theft / damageUnit.divisor,
  };
  const lossKinds: LossKind[] = [
    { id: "Tabiiy", value: damageValues.natural, amount: dec(damageValues.natural), color: "#55c4ae" },
    {
      id: "Texnologik",
      value: damageValues.technological,
      amount: dec(damageValues.technological),
      color: "#f4cf3b",
    },
    { id: "O’g’irlik", value: damageValues.theft, amount: dec(damageValues.theft), color: "#ff928a" },
  ];
  // Shkala 8 ta teng bo'linmaga bo'linadi - eng kattasi 85% atrofida to'lsin.
  const damageMax = niceStep((Math.max(...lossKinds.map((kind) => kind.value)) * 1.15) / 8) * 8;

  const billedDiff = energy.billed - energy.billedPrev;
  const tooltip: MapTooltip = {
    title: "Transformator holati",
    label: transformer.code,
    dot: STATUS_DOT[transformer.status],
    value: thousands(energy.billed),
    unit: "ming kWh",
    note:
      transformer.status === "offline" ? (
        "Transformator o’chirilgan - abonentlar energiya olmayapti."
      ) : transformer.loadPercent > 100 ? (
        <>
          Yuklama <span className="font-bold">{dec(transformer.loadPercent, 0)}%</span> - nominal
          quvvatdan oshgan, ta’mirlash rejalashtirilgan.
        </>
      ) : transformer.temperature > 75 ? (
        <>
          Chulg&rsquo;am harorati{" "}
          <span className="font-bold">{num(transformer.temperature)}&deg;C</span> - tekshiruv kerak.
        </>
      ) : (
        <>
          Ushbu transformator o&rsquo;tgan oyga nisbatan{" "}
          <span className="font-bold">{thousands(Math.abs(billedDiff))}</span> ming kWh ga{" "}
          {billedDiff > 0 ? "ko’p" : "kam"} energiya iste&rsquo;mol qilmoqda.
        </>
      ),
  };

  const peak = scope.peakHour;
  const quickMetrics: QuickMetric[] = [
    {
      id: "avg-usage",
      icon: Zap,
      tile: "bg-accent-blue",
      caption: "Kunlik o’rtacha iste’mol",
      value: `${num(energy.billed / 30)} kWh`,
    },
    {
      id: "avg-loss",
      icon: ArrowBigDownDash,
      tile: "bg-[#ff928a]",
      caption: "Kunlik o’rtacha yo’qotish",
      value: `${num(energy.loss / 30)} kWh`,
    },
    {
      id: "temperature",
      icon: Thermometer,
      tile: "bg-[#ffae4c]",
      caption: "Chulg’am harorati",
      value: `${num(transformer.temperature)}°C`,
    },
    {
      id: "peak-hours",
      icon: ClockArrowUp,
      tile: "bg-[#8979ff]",
      caption: "Pik yuklama vaqti",
      value: peak >= 0 ? `${peak}:00 - ${peak + 1}:00` : "—",
    },
    {
      id: "last-check",
      icon: SquareCheckBig,
      tile: "bg-[#2bb7dc]",
      caption: "So’nggi ko’rik",
      value: transformer.lastCheck,
    },
  ];

  /* --- 4-qator: ish jurnali ------------------------------------------- */

  const completedWorks = scope.completedWorks.map((item) => ({ ...item, tp: transformer.code }));
  const plannedWorks: PlannedWork[] = scope.plannedWorks.map((item) => ({
    id: item.id,
    tp: transformer.code,
    work: item.work,
    status: item.status ?? "planned",
    date: item.date,
  }));

  return (
    <div className="grid h-full min-h-0 grid-cols-[repeat(18,minmax(0,1fr))] grid-rows-[minmax(196px,196fr)_minmax(298px,298fr)_minmax(336px,336fr)_minmax(209px,209fr)] gap-2 overflow-y-auto scrollbar-none">
      {/* 1-qator - KPI kartalari (6 x span-3) */}
      <KpiRow kpis={kpis} />

      {/* 2-qator */}
      <ConsumptionDynamicsCard className="col-span-6" days={scope.days} />
      <div className="col-span-6 grid min-h-0 grid-rows-[minmax(0,148fr)_minmax(0,142fr)] gap-2">
        <ViolationsCard counts={scope.violationCounts} />
        <ResponsibleStaffCard staff={scope.staff} footerHref="/staff" />
      </div>
      <TopTransformersCard
        className="col-span-6"
        title="Eng ko’p sarfga ega abonentlar"
        columns={SUBSCRIBER_COLUMNS}
        rows={subscriberRows}
        valueSuffix="kWh"
        valueDigits={0}
        axisWidth={72}
        footerHref="/subscribers"
      />

      {/* 3-qator */}
      <RingStatsCard
        className="col-span-4"
        title="Qarzdorlik"
        rings={debtRings}
        max={debtStep * 5}
        tickLabels={Array.from({ length: 6 }, (_, index) => tick(debtStep * index))}
        month={MONTH}
        columns={["Turi", "Summa"]}
      />
      <LossDamageCard
        className="col-span-4"
        kinds={lossKinds}
        max={damageMax}
        unit={damageUnit.unit}
        total={dec(sumValues(damageValues))}
        month={MONTH}
      />
      <InteractiveMapCard
        className="col-span-6"
        markers={[
          { id: transformer.id, lat: transformer.lat, lng: transformer.lng, label: transformer.code },
        ]}
        // Tultip xaritaning o'ng yarmini egallaydi - marker chap tomonda
        // ko'rinishi uchun markaz sharqqa surilgan (zoom 15 da ~90px).
        center={{ lat: transformer.lat, lng: transformer.lng + MAP_CENTER_SHIFT }}
        zoom={MAP_ZOOM}
        selectedId={transformer.id}
        fitDistrict={false}
        tooltip={tooltip}
      />
      <QuickMetricsCard className="col-span-4" metrics={quickMetrics} />

      {/* 4-qator */}
      <CompletedWorksCard className="col-span-6" works={completedWorks} />
      <PlannedWorksCard className="col-span-8" works={plannedWorks} />
      <DownloadReportsCard className="col-span-4" />
    </div>
  );
}

function sumValues(values: Record<string, number>): number {
  return Object.values(values).reduce((total, value) => total + value, 0);
}
