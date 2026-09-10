"use client";

import { ResponsiveLine } from "@nivo/line";
import { type RadialBarSerie, ResponsiveRadialBar } from "@nivo/radial-bar";
import { Activity, Gauge, Thermometer, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, SidebarPanel } from "@/components/shell/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/DataTable";
import { CycleSelect } from "@/components/ui/Filters";
import { ProgressBar } from "@/components/ui/InfoGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatRow, type StatTone } from "@/components/ui/StatCard";
import { between, dec, noise, num, pick, TODAY, TODAY_TIME } from "@/lib/data/seed";
import {
  type Transformer,
  TRANSFORMER_STATUS_LABEL,
  type TransformerStatus,
  TRANSFORMERS,
} from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Kuzatuvdagi obyektlar
   --------------------------------------------------------------------------- */

/**
 * Monitoring paneli butun reyestrni emas, dispetcher "kuzatuv"ga qo'ygan
 * sakkizta TP ni ko'rsatadi. Kodlar qo'lda tanlangan: ro'yxatda kritik,
 * ogohlantirish, sog'lom va o'chirilgan holat bir vaqtda ko'rinib tursin.
 */
const WATCHED_CODES = [
  "TP-066",
  "TP-042",
  "TP-114",
  "TP-207",
  "TP-128",
  "TP-063",
  "TP-011",
  "TP-258",
] as const;

/**
 * `find` natijasi `undefined` bo'lishi mumkin, shuning uchun `flatMap` bilan
 * filtrlanadi - bu `!` yoki `as` ishlatmasdan to'g'ri tipni beradi.
 */
const WATCHED: readonly Transformer[] = WATCHED_CODES.flatMap((code) => {
  const found = TRANSFORMERS.find((item) => item.code === code);
  return found ? [found] : [];
});

/** Ro'yxatdagi holat nuqtasining rangi. */
const STATUS_DOT: Record<TransformerStatus, string> = {
  ok: "bg-state-ok",
  warning: "bg-state-warn",
  critical: "bg-state-bad",
  offline: "bg-ink-soft",
};

/** Yuklama chizig'ining rangi - grafikda ham, ProgressBar'da ham bir xil. */
const STATUS_ACCENT: Record<TransformerStatus, string> = {
  ok: "bg-brand",
  warning: "bg-state-warn",
  critical: "bg-state-bad",
  offline: "bg-ink-soft",
};

/** Nivo faqat aniq hex qabul qiladi - tokenlarning qiymatlari takrorlanadi. */
const STATUS_HEX: Record<TransformerStatus, string> = {
  ok: "#007cd2",
  warning: "#d97706",
  critical: "#dc2626",
  offline: "#767676",
};

/* ---------------------------------------------------------------------------
   Telemetriya - TP ma'lumotidan determinlashgan tarzda hisoblanadi
   --------------------------------------------------------------------------- */

/** "TP-066" -> 66: barcha o'lchovlar shu barqaror seed'dan chiqadi. */
function seedOf(tp: Transformer): number {
  return Number.parseInt(tp.code.slice(3), 10) + 7;
}

/** "10/0,4 kV" -> 10: monitoring birlamchi taraf kuchlanishini ko'rsatadi. */
function nominalKv(voltage: string): number {
  const parsed = Number.parseFloat(voltage.split("/")[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 10;
}

/** Sifat indekslari 0..100 oralig'ida bo'lishi shart (halqa shkalasi shunday). */
function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

interface PhaseReading {
  id: string;
  label: string;
  /** Nivo/inline SVG uchun aniq hex. */
  color: string;
  /** ProgressBar uchun token klassi. */
  tone: string;
  /** Faza yuklamasi, nominalga nisbatan foiz. */
  load: number;
  /** Faza toki, A. */
  current: number;
}

const PHASE_META = [
  { id: "a", label: "A fazasi", color: "#3b82f6", tone: "bg-accent-blue" },
  { id: "b", label: "B fazasi", color: "#22c55e", tone: "bg-accent-green" },
  { id: "c", label: "C fazasi", color: "#f59e0b", tone: "bg-accent-amber" },
] as const;

/**
 * Sutkalik yuklama profili (24 qiymat): kechasi past, ertalab va kechqurun
 * cho'qqi. Joriy yuklama 18:00 dagi 1.0 koeffitsiyentga to'g'ri keladi.
 */
const DAY_PROFILE = [
  0.62, 0.58, 0.55, 0.54, 0.57, 0.64, 0.74, 0.86, 0.93, 0.95, 0.92, 0.9, 0.88, 0.86, 0.85,
  0.88, 0.92, 0.97, 1, 0.99, 0.95, 0.87, 0.77, 0.68,
] as const;

/** X o'qi yorliqlari: "00:00" ... "23:00". */
const HOURS = DAY_PROFILE.map((_, index) => `${String(index).padStart(2, "0")}:00`);

interface QualityRing {
  id: string;
  label: string;
  color: string;
  /** 0..100 - qiymat qanchalik katta bo'lsa, sifat shunchalik yaxshi. */
  score: number;
  /** Legendadagi haqiqiy o'lchov: "og’ish +1,4%". */
  reading: string;
}

interface Telemetry {
  loadPercent: number;
  /** Yuklamaning kVA dagi ifodasi - StatCard izohida ko'rsatiladi. */
  loadKva: number;
  nominalKv: number;
  voltageKv: number;
  /** Nominal kuchlanishdan og'ish, foiz. */
  deviation: number;
  currentA: number;
  nominalCurrentA: number;
  temperature: number;
  phases: readonly PhaseReading[];
  /** Fazalar nomutanosibligi, foiz. */
  imbalance: number;
  /** 24 soatlik yuklama, foiz. */
  hourly: readonly number[];
  peak: number;
  average: number;
  quality: readonly QualityRing[];
}

/**
 * Bitta TP ning "jonli" ko'rsatkichlari. Hech qayerda `Math.random` yoki
 * `new Date()` yo'q: server va mijoz bir xil markup chizishi shart, shuning
 * uchun hamma tebranish `seed.ts` dagi `noise` orqali olinadi.
 */
function buildTelemetry(tp: Transformer): Telemetry {
  const seed = seedOf(tp);
  const offline = tp.status === "offline";
  const loadPercent = tp.loadPercent;

  // 0,4 kV tarafdagi nominal tok: I = S / (sqrt(3) * U).
  const nominalCurrentA = (tp.powerKva * 1000) / (Math.sqrt(3) * 400);

  // Fazalar umumiy yuklama atrofida ±11% tebranadi - ideal simmetriya bo'lmaydi.
  const phases: PhaseReading[] = PHASE_META.map((meta, index) => {
    const skew = 1 + (noise(seed * 3.1 + index * 5.7) - 0.5) * 0.22;
    const load = offline ? 0 : Number((loadPercent * skew).toFixed(1));
    return { ...meta, load, current: Math.round((nominalCurrentA * load) / 100) };
  });

  const loads = phases.map((phase) => phase.load);
  const mean = loads.reduce((sum, value) => sum + value, 0) / loads.length;
  // Nomutanosiblik - eng katta va eng kichik faza farqining o'rtachaga nisbati.
  const imbalance =
    mean === 0 ? 0 : ((Math.max(...loads) - Math.min(...loads)) / mean) * 100;

  const nominal = nominalKv(tp.voltage);
  // O'chirilgan TP da kuchlanish yo'q: og'ish -100% deb belgilanadi.
  //
  // Oraliq simmetrik ±6%: me'yoriy chegara ±5% bo'lgani uchun tebranish undan
  // tor bo'lsa (avvalgi -4,1..+5,0%), StatCard dagi "bad" holati hech qachon
  // chiqmasdi - ya'ni indikator o'lik shart bo'lib qolardi.
  const deviation = offline ? -100 : Number(((noise(seed * 7.3) - 0.5) * 12).toFixed(1));
  const voltageKv = offline ? 0 : Number((nominal * (1 + deviation / 100)).toFixed(2));

  const hourly = DAY_PROFILE.map((factor, index) => {
    if (offline) return 0;
    const wobble = 1 + (noise(seed + index * 4.3) - 0.5) * 0.09;
    return Number((loadPercent * factor * wobble).toFixed(1));
  });

  // Garmonik buzilish (THD) 1,8..6,1% oralig'ida - o'nlik uchun 10 ga bo'linadi.
  const thd = offline ? 0 : between(seed * 13.7, 18, 61, 1) / 10;

  const quality: QualityRing[] = [
    {
      id: "level",
      label: "Kuchlanish darajasi",
      color: "#3b82f6",
      score: offline ? 0 : clampScore(100 - Math.abs(deviation) * 7),
      reading: offline
        ? "aloqa yo’q"
        : `og’ish ${deviation >= 0 ? "+" : ""}${dec(deviation)}%`,
    },
    {
      id: "symmetry",
      label: "Faza simmetriyasi",
      color: "#22c55e",
      score: offline ? 0 : clampScore(100 - imbalance * 4.5),
      reading: offline ? "aloqa yo’q" : `nomutanosiblik ${dec(imbalance)}%`,
    },
    {
      id: "harmonics",
      label: "Garmonik tozalik",
      color: "#6155f5",
      score: offline ? 0 : clampScore(100 - thd * 9),
      reading: offline ? "aloqa yo’q" : `THD ${dec(thd)}%`,
    },
  ];

  return {
    loadPercent,
    loadKva: Math.round((tp.powerKva * loadPercent) / 100),
    nominalKv: nominal,
    voltageKv,
    deviation,
    currentA: Math.round(
      phases.reduce((sum, phase) => sum + phase.current, 0) / phases.length,
    ),
    nominalCurrentA: Math.round(nominalCurrentA),
    temperature: tp.temperature,
    phases,
    imbalance,
    hourly,
    peak: Math.max(...hourly),
    average: hourly.reduce((sum, value) => sum + value, 0) / hourly.length,
    quality,
  };
}

/* ---------------------------------------------------------------------------
   Ogohlantirishlar oqimi
   --------------------------------------------------------------------------- */

interface AlertTemplate {
  label: string;
  tone: BadgeTone;
  text: string;
}

/**
 * Xabar matni obyekt holatiga mos bo'lishi kerak: sog'lom TP haqida "yuklama
 * oshdi" degan yozuv chiqsa, panel ishonchsiz ko'rinadi.
 */
const ALERTS_BY_STATUS: Record<TransformerStatus, readonly AlertTemplate[]> = {
  critical: [
    { label: "Kritik", tone: "red", text: "Yuklama nominal quvvatdan oshib ketdi" },
    { label: "Kritik", tone: "red", text: "Chulg’am harorati chegaraviy qiymatga chiqdi" },
    { label: "Ogohlantirish", tone: "amber", text: "Faza nomutanosibligi me’yordan yuqori" },
  ],
  warning: [
    { label: "Ogohlantirish", tone: "amber", text: "Yuklama 90% chegarasidan oshdi" },
    { label: "Ogohlantirish", tone: "amber", text: "Kuchlanish nominal qiymatdan past" },
    { label: "Ma’lumot", tone: "blue", text: "Reaktiv quvvat me’yor chegarasida" },
  ],
  ok: [
    { label: "Ma’lumot", tone: "blue", text: "Rejali o’lchov muvaffaqiyatli yakunlandi" },
    { label: "Bartaraf", tone: "green", text: "Yuklama me’yoriy darajaga qaytdi" },
    { label: "Ma’lumot", tone: "blue", text: "Hisoblagichlar bilan aloqa barqaror" },
  ],
  offline: [
    { label: "Kritik", tone: "red", text: "Obyekt bilan telemetriya aloqasi uzildi" },
    { label: "Ogohlantirish", tone: "amber", text: "So’nggi o’lchov 3 soatdan beri yangilanmadi" },
    { label: "Ma’lumot", tone: "blue", text: "Ta’mirlash brigadasi yo’lga chiqdi" },
  ],
};

interface AlertRow {
  id: string;
  time: string;
  code: string;
  text: string;
  label: string;
  tone: BadgeTone;
  /** Tanlangan TP ga tegishli yozuv ro'yxatda ajratib ko'rsatiladi. */
  current: boolean;
}

/** Maket vaqti ("13:42") daqiqalarda - oqim shundan orqaga suriladi. */
const BASE_MINUTES = (() => {
  const [hours, minutes] = TODAY_TIME.split(":").map(Number);
  return hours * 60 + minutes;
})();

function formatClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  return `${String(hours).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

/**
 * Oqim tanlangan TP dan boshlanadi: juft o'rinlar - o'sha obyekt, toqlari -
 * kuzatuvdagi boshqa TP lar. Shu sabab boshqa obyektga o'tilganda ro'yxat
 * ham to'liq yangilanadi.
 */
function buildAlerts(selected: Transformer): readonly AlertRow[] {
  const seed = seedOf(selected);
  let minutes = BASE_MINUTES;

  return Array.from({ length: 8 }, (_, index) => {
    // Har bir keyingi yozuv oldingisidan 2..26 daqiqa eskiroq.
    minutes -= between(seed + index * 4.7, 2, 26, 1);
    const target = index % 2 === 0 ? selected : pick(seed * 2.3 + index, WATCHED);
    const template = pick(seed + index * 9.1, ALERTS_BY_STATUS[target.status]);

    return {
      id: `${target.id}-${index}`,
      time: formatClock(minutes),
      code: target.code,
      text: template.text,
      label: template.label,
      tone: template.tone,
      current: target.id === selected.id,
    };
  });
}

/* ---------------------------------------------------------------------------
   Kichik qismlar
   --------------------------------------------------------------------------- */

/** Yashil pulsatsiyalanuvchi nuqta - "jonli oqim" indikatori. */
function LiveDot() {
  return (
    <span className="relative flex size-2 shrink-0">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-green opacity-70" />
      <span className="relative inline-flex size-2 rounded-full bg-accent-green" />
    </span>
  );
}

function MonitoringSidebar({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <SidebarPanel
      title="Monitoring"
      footer={
        <div className="shrink-0 rounded-xl bg-canvas p-3">
          <p className="text-[11px] font-semibold text-ink">
            {WATCHED.length} ta obyekt kuzatuvda
          </p>
          <p className="mt-1 text-[10px] leading-tight text-ink-soft">
            Ko&rsquo;rsatkichlar SCADA tizimidan olinadi
          </p>
        </div>
      }
    >
      <div className="flex shrink-0 items-center gap-2 rounded-lg bg-tint-green px-3 py-2">
        <LiveDot />
        <span className="text-[11px] font-semibold text-accent-green">
          Jonli ma&rsquo;lumot
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-ink-soft">{TODAY_TIME}</span>
      </div>

      <nav aria-label="Kuzatuvdagi obyektlar">
        <ul className="flex flex-col gap-1">
          {WATCHED.map((tp) => {
            const active = tp.id === selectedId;
            return (
              <li key={tp.id}>
                <button
                  type="button"
                  onClick={() => onSelect(tp.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full flex-col gap-2 rounded-xl px-3 py-2.5 text-left transition-colors",
                    active ? "bg-canvas" : "hover:bg-canvas/60",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[tp.status])}
                    />
                    <span className="shrink-0 text-sm font-semibold text-ink">
                      {tp.code}
                    </span>
                    <span className="truncate text-[10px] text-ink-soft">
                      {TRANSFORMER_STATUS_LABEL[tp.status]}
                    </span>
                    <span className="ml-auto shrink-0 text-xs font-bold text-ink">
                      {num(tp.loadPercent)}%
                    </span>
                  </span>
                  <ProgressBar value={tp.loadPercent} tone={STATUS_ACCENT[tp.status]} />
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </SidebarPanel>
  );
}

/* ---------------------------------------------------------------------------
   Grafik kartalari
   --------------------------------------------------------------------------- */

/** O'q matnlari 9px - karta past bo'lganda yorliqlar qalashib ketmasin. */
const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 9, fill: "#767676" },
  axis: {
    ticks: { text: { fontFamily: "inherit", fontSize: 9, fill: "#767676" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#e8e8ec", strokeDasharray: "2 2" } },
} as const;

const LINE_MARGIN = { top: 12, right: 16, bottom: 22, left: 34 } as const;

function formatPercentAxis(value: number): string {
  return `${num(value)}%`;
}

function formatPercentValue(value: number): string {
  return `${dec(value)}%`;
}

function LoadChartCard({
  telemetry,
  status,
  className,
}: {
  telemetry: Telemetry;
  status: TransformerStatus;
  className?: string;
}) {
  // Shkala cho'qqidan yuqori tugaydi, ammo doim kamida 100% (nominal chegara)
  // ko'rinadi - aks holda qizil chiziq maydondan tashqarida qolardi.
  const yMax = Math.max(100, Math.ceil((telemetry.peak + 10) / 20) * 20);
  const yTicks = [0, 1, 2, 3, 4].map((step) => (yMax / 4) * step);
  const xTicks = HOURS.filter((_, index) => index % 3 === 0);
  const color = STATUS_HEX[status];

  const data = [
    {
      id: "Yuklama",
      data: telemetry.hourly.map((value, index) => ({ x: HOURS[index], y: value })),
    },
  ];

  return (
    <Card className={className}>
      <CardHeader title="Yuklama grafigi (so&rsquo;nggi 24 soat)">
        <span className="text-[11px] whitespace-nowrap text-ink-soft">
          o&rsquo;rtacha {dec(telemetry.average)}% &middot; cho&rsquo;qqi{" "}
          {dec(telemetry.peak)}%
        </span>
      </CardHeader>

      <CardBody>
        <div className="min-h-0 flex-1">
          <ResponsiveLine
            data={data}
            margin={LINE_MARGIN}
            xScale={{ type: "point" }}
            yScale={{ type: "linear", min: 0, max: yMax, stacked: false }}
            curve="monotoneX"
            colors={[color]}
            lineWidth={2}
            theme={CHART_THEME}
            axisTop={null}
            axisRight={null}
            axisBottom={{ tickSize: 0, tickPadding: 6, tickValues: xTicks }}
            axisLeft={{
              tickSize: 0,
              tickPadding: 6,
              tickValues: yTicks,
              format: formatPercentAxis,
            }}
            enableGridX={false}
            gridYValues={yTicks}
            enableArea
            areaOpacity={0.1}
            areaBaselineValue={0}
            pointSize={4}
            pointColor="#ffffff"
            pointBorderWidth={1.5}
            pointBorderColor={{ from: "seriesColor" }}
            enableCrosshair={false}
            enableTouchCrosshair={false}
            useMesh
            animate={false}
            yFormat={formatPercentValue}
            // Nominal quvvat chegarasi - undan yuqorisi haddan tashqari yuklama.
            markers={[
              {
                axis: "y",
                value: 100,
                legend: "Nominal chegara",
                legendPosition: "bottom-left",
                legendOrientation: "horizontal",
                lineStyle: { stroke: "#ff383c", strokeWidth: 1, strokeDasharray: "4 4" },
                textStyle: { fill: "#767676", fontSize: 9 },
              },
            ]}
            tooltip={({ point }) => (
              <div className="rounded-md bg-surface px-2 py-1 whitespace-nowrap shadow-md">
                <div className="text-[9px] text-ink-soft">{point.data.xFormatted}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-ink-soft">Yuklama</span>
                  <span className="font-semibold">{point.data.yFormatted}</span>
                </div>
              </div>
            )}
          />
        </div>
      </CardBody>
    </Card>
  );
}

/** Nomutanosiblik 10% dan oshsa - qizil, 6% dan oshsa - sariq. */
function imbalanceTone(value: number): string {
  if (value >= 10) return "text-state-bad";
  if (value >= 6) return "text-state-warn";
  return "text-state-ok";
}

function PhasesCard({
  telemetry,
  className,
}: {
  telemetry: Telemetry;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title="Fazalar bo&rsquo;yicha yuklama" />

      <CardBody>
        <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
          {telemetry.phases.map((phase) => (
            <div key={phase.id} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: phase.color }}
                />
                <span className="truncate text-xs font-medium text-ink">{phase.label}</span>
                <span className="ml-auto shrink-0 text-[10px] text-ink-soft">
                  {num(phase.current)} A
                </span>
                <span className="shrink-0 text-sm leading-none font-bold text-ink">
                  {dec(phase.load)}%
                </span>
              </div>
              {/* `h-2.5!` - ProgressBar o'zining `h-1.5` klassini olib yuradi,
                  muhimlik belgisisiz ikkalasi ham amal qilib qolishi mumkin. */}
              <ProgressBar value={phase.load} tone={phase.tone} className="h-2.5!" />
            </div>
          ))}
        </div>

        <div className="mt-3 flex shrink-0 items-center gap-2 rounded-lg bg-canvas px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10px] text-ink-soft">
              Fazalar nomutanosibligi
            </span>
            <span className="block truncate text-[10px] text-ink-soft">
              ruxsat etilgan chegara 10%
            </span>
          </span>
          <span
            className={cn(
              "shrink-0 text-lg leading-none font-bold",
              imbalanceTone(telemetry.imbalance),
            )}
          >
            {dec(telemetry.imbalance)}%
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

function QualityCard({
  telemetry,
  className,
}: {
  telemetry: Telemetry;
  className?: string;
}) {
  const rings = telemetry.quality;

  // Nivo birinchi seriyani eng ichki halqa qilib chizadi - ro'yxat teskari
  // beriladi, shunda birinchi ko'rsatkich tashqi halqada turadi.
  const chartData: RadialBarSerie[] = rings
    .map((ring) => ({ id: ring.id, data: [{ x: "sifat", y: ring.score }] }))
    .reverse();

  const ringColor: Record<string, string> = Object.fromEntries(
    rings.map((ring) => [ring.id, ring.color]),
  );

  const overall = Math.round(
    rings.reduce((sum, ring) => sum + ring.score, 0) / rings.length,
  );

  return (
    <Card className={className}>
      <CardHeader title="Kuchlanish sifati" />

      <CardBody>
        <div className="relative min-h-0 flex-1">
          <ResponsiveRadialBar
            data={chartData}
            maxValue={100}
            startAngle={0}
            endAngle={360}
            innerRadius={0.46}
            padding={0.28}
            cornerRadius={4}
            margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
            colors={(bar) => ringColor[bar.groupId] ?? "#3b82f6"}
            enableTracks
            tracksColor="#f3f3f3"
            enableRadialGrid={false}
            enableCircularGrid={false}
            radialAxisStart={null}
            circularAxisOuter={null}
            enableLabels={false}
            // Karta `overflow-hidden` - kichik halqada tultip baribir kesilardi.
            isInteractive={false}
            animate={false}
          />

          {/* Umumiy indeks halqalar markazida - nivo qatlami o'rniga oddiy
              qatlam, chunki unga faqat tayyor son kerak. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg leading-none font-bold text-ink">{num(overall)}%</span>
            <span className="mt-1 text-[9px] leading-none text-ink-soft">umumiy</span>
          </div>
        </div>

        <ul className="mt-2 flex shrink-0 flex-col gap-1.5">
          {rings.map((ring) => (
            <li key={ring.id} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: ring.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-medium text-ink">
                  {ring.label}
                </span>
                <span className="block truncate text-[9px] text-ink-soft">
                  {ring.reading}
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold text-ink">
                {num(ring.score)}%
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function AlertsCard({
  alerts,
  className,
}: {
  alerts: readonly AlertRow[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title="Ogohlantirishlar oqimi">
        <span className="text-[11px] whitespace-nowrap text-ink-soft">
          {alerts.length} ta yozuv &middot; {TODAY}
        </span>
      </CardHeader>

      <CardBody>
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto scrollbar-none">
          {alerts.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2",
                // Tanlangan TP ga tegishli yozuvlar oqimda ajralib turadi.
                item.current ? "bg-canvas" : "hover:bg-canvas/60",
              )}
            >
              <span className="w-10 shrink-0 text-[11px] font-semibold tabular-nums text-ink-soft">
                {item.time}
              </span>
              <span className="w-14 shrink-0 truncate text-[11px] font-semibold text-ink">
                {item.code}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
                {item.text}
              </span>
              <span className="w-24 shrink-0">
                <Badge tone={item.tone}>{item.label}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Ekran
   --------------------------------------------------------------------------- */

/** "Yangilanish" tugmasi aylantiradigan davrlar. */
const REFRESH_RATES = ["5 s", "30 s", "1 daq"] as const;

function loadTone(status: TransformerStatus): StatTone {
  if (status === "critical" || status === "offline") return "bad";
  if (status === "warning") return "flat";
  return "good";
}

/**
 * Monitoring paneli: chapda kuzatuvdagi TP lar, o'ngda tanlangan obyektning
 * real vaqt ko'rsatkichlari.
 *
 * Sahifa `/monitoring` bo'limida, ya'ni ish maydoni qobig'idan tashqarida -
 * shuning uchun `AppShell` shu yerda chiziladi (`(workspace)` layout emas).
 */
export function MonitoringScreen() {
  const [selectedId, setSelectedId] = useState<string>(WATCHED[0].id);
  const [rateIndex, setRateIndex] = useState(0);

  const selected = WATCHED.find((tp) => tp.id === selectedId) ?? WATCHED[0];
  const telemetry = useMemo(() => buildTelemetry(selected), [selected]);
  const alerts = useMemo(() => buildAlerts(selected), [selected]);

  // Maket ma'lumoti statik, shuning uchun davr faqat sozlama sifatida saqlanadi
  // (haqiqiy so'rov jadvali backend ulangach shu qiymatdan olinadi).
  const cycleRate = () => setRateIndex((index) => (index + 1) % REFRESH_RATES.length);

  const offline = selected.status === "offline";

  return (
    <AppShell sidebar={<MonitoringSidebar selectedId={selected.id} onSelect={setSelectedId} />}>
      <div className="flex h-full min-h-0 flex-col gap-2">
        <PageHeader
          title="Monitoring paneli"
          subtitle={`${selected.code} · ${selected.substationName} PS · ${selected.feeder} fider · ${TRANSFORMER_STATUS_LABEL[selected.status]}`}
        >
          <span className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-tint-green px-3 text-[11px] font-medium text-accent-green">
            <LiveDot />
            Jonli
          </span>
          <CycleSelect
            label="Yangilanish"
            value={REFRESH_RATES[rateIndex]}
            onCycle={cycleRate}
          />
        </PageHeader>

        <StatRow>
          <StatCard
            label="Yuklama"
            value={num(telemetry.loadPercent)}
            unit="%"
            icon={Gauge}
            accent="bg-accent-blue"
            tint="bg-tint-blue"
            hint={`${num(telemetry.loadKva)} kVA / ${num(selected.powerKva)} kVA`}
            hintTone={loadTone(selected.status)}
          />
          <StatCard
            label="Kuchlanish"
            value={offline ? "—" : dec(telemetry.voltageKv, 2)}
            unit="kV"
            icon={Activity}
            accent="bg-accent-teal"
            tint="bg-tint-teal"
            hint={
              offline
                ? "Aloqa yo’q"
                : `Nominal ${num(telemetry.nominalKv)} kV · og’ish ${telemetry.deviation >= 0 ? "+" : ""}${dec(telemetry.deviation)}%`
            }
            hintTone={offline || Math.abs(telemetry.deviation) > 5 ? "bad" : "good"}
          />
          <StatCard
            label="Tok"
            value={num(telemetry.currentA)}
            unit="A"
            icon={Zap}
            accent="bg-accent-indigo"
            tint="bg-tint-indigo"
            hint={`Nominal tok ${num(telemetry.nominalCurrentA)} A`}
            hintTone="flat"
          />
          <StatCard
            label="Harorat"
            value={num(telemetry.temperature)}
            unit="°C"
            icon={Thermometer}
            accent="bg-accent-amber"
            tint="bg-tint-amber"
            hint="Chulg’am uchun chegara 85 °C"
            hintTone={
              telemetry.temperature >= 75 ? "bad" : telemetry.temperature <= 60 ? "good" : "flat"
            }
          />
        </StatRow>

        {/* Qatorlar qolgan balandlikni bo'lishadi, ammo maketdagi eng kichik
            o'lchamdan (300 va 240px) past tushmaydi - sahifa skroll bo'lmaydi. */}
        <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[minmax(300px,1.15fr)_minmax(240px,1fr)] gap-2">
          <LoadChartCard
            telemetry={telemetry}
            status={selected.status}
            className="col-span-8"
          />
          <PhasesCard telemetry={telemetry} className="col-span-4" />
          <QualityCard telemetry={telemetry} className="col-span-4" />
          <AlertsCard alerts={alerts} className="col-span-8" />
        </div>
      </div>
    </AppShell>
  );
}
