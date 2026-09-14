"use client";

// Davr oynasi tanlagichi holat (`useState`) talab qiladi, grafiklar esa
// @nivo (faqat brauzerda chiziladi) - shuning uchun ko'rinish mijozda.
// Barcha sonlar serverda so'rovlardan tayyorlanadi (`statistics-data.ts`),
// bu yerda faqat `format.ts` orqali matnga aylantiriladi.

import { type BarCustomLayerProps, ResponsiveBar } from "@nivo/bar";
import { ResponsivePie } from "@nivo/pie";
import { FileDown, Percent, PlugZap, Unplug, Users, Wallet, Zap } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";

import { finite, linearScale, plainNumber } from "@/components/cards/chart-scale";
import { ConsumptionDynamicsCard, type DynamicsMonth } from "@/components/cards/ConsumptionDynamicsCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { type FilterChip, FilterChips } from "@/components/ui/Filters";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { type StatTone, StatCard, StatRow } from "@/components/ui/StatCard";
import type { SubscriberKind } from "@/generated/prisma";
import { SUBSCRIBER_KIND_LABEL, SUBSCRIBER_KIND_ORDER } from "@/lib/domain/labels";
import { delta, fractions, share } from "@/lib/domain/metrics";
import { EMPTY, energy, money, num, percent, scaled, type ScaledValue } from "@/lib/format";
import type {
  StatisticsData,
  StatisticsMonth,
  StatisticsWindow,
  StatisticsWindowId,
} from "@/lib/queries/statistics-data";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Yordamchilar
   --------------------------------------------------------------------------- */

const WINDOW_LABEL: Record<StatisticsWindowId, string> = {
  month: "Oy",
  quarter: "Chorak",
  year: "Yil",
};

/** `energy()` bilan bir xil yaxlitlash, lekin qiymat va birlik alohida (KPI kartasi uchun). */
function energyParts(kwh: number | null | undefined): ScaledValue {
  if (kwh == null) return { value: EMPTY, unit: "" };
  return Math.abs(kwh) >= 1_000_000 ? scaled(kwh, "kWh", 2) : { value: num(kwh), unit: "kWh" };
}

/** "+3,2%" / "-1,6%" - o'tgan oyga nisbatan o'zgarish. */
function signedPercent(value: number): string {
  return value > 0 ? `+${percent(value)}` : percent(value);
}

/** O'sishi yomon ko'rsatkich (yo'qotish) uchun izoh ohangi. */
function lossTone(diff: number): StatTone {
  if (diff === 0) return "flat";
  return diff > 0 ? "bad" : "good";
}

interface Kpi {
  id: string;
  label: string;
  value: ScaledValue;
  hint: string;
  tone: StatTone;
}

function buildKpis(data: StatisticsData, win: StatisticsWindow): Kpi[] {
  const { energy: totals } = win;
  const previous = win.id === "month" ? data.previousMonth : null;
  const missingEnergy = "Podstansiyalar yuklanmagan";
  const skipped = win.periods - win.energyPeriods;

  // O'tgan oyga nisbatan farq (faqat "Oy" oynasida, o'tgan oy bazada bo'lsa).
  const change = (current: number | undefined, before: number | null | undefined) => {
    const result = previous ? delta(current, before) : null;
    return result && result.percent != null ? result : null;
  };

  const totalChange = change(totals?.totalKwh, previous?.totalKwh);
  const lossChange = change(totals?.lossKwh, previous?.lossKwh);

  const totalHint = !totals
    ? missingEnergy
    : totalChange
      ? `O’tgan oyga nisbatan ${signedPercent(totalChange.percent!)}`
      : skipped > 0
        ? `${win.rangeLabel} · ${num(skipped)} oyga yuklanmagan`
        : win.rangeLabel;

  const lossHint = !totals
    ? missingEnergy
    : lossChange
      ? `O’tgan oyga nisbatan ${signedPercent(lossChange.percent!)}`
      : win.energyPeriods > 1
        ? `${num(win.energyPeriods)} oy yig’indisi`
        : win.rangeLabel;

  let shareHint = missingEnergy;
  let shareTone: StatTone = "flat";
  if (totals) {
    if (win.id === "month") {
      const before = previous?.lossPercent ?? null;
      const now = totals.lossPercent;
      shareHint = before != null ? `O’tgan oy: ${percent(before, 2)}` : "Σ yo’qotish / Σ umumiy oqim";
      if (before != null && now != null) shareTone = lossTone(now - before);
    } else {
      shareHint = win.peakLossMonth
        ? `Eng yuqori: ${win.peakLossMonth.label} (${percent(win.peakLossMonth.lossPercent, 2)})`
        : "Σ yo’qotish / Σ umumiy oqim";
    }
  }

  const { subscribers } = data.current;
  const list = data.current.subscriberList;

  return [
    {
      id: "total",
      label: "Umumiy oqim",
      value: energyParts(totals?.totalKwh),
      hint: totalHint,
      tone: "flat",
    },
    {
      id: "useful",
      label: "Foydali oqim",
      value: energyParts(totals?.usefulKwh),
      hint: totals ? `Umumiy oqimning ${percent(win.usefulShare)}` : missingEnergy,
      tone: "flat",
    },
    {
      id: "loss",
      label: "Yo’qotish",
      value: energyParts(totals?.lossKwh),
      hint: lossHint,
      tone: lossChange ? lossTone(lossChange.diff) : "flat",
    },
    {
      id: "loss-share",
      label: "Yo’qotish ulushi",
      value: { value: totals ? percent(totals.lossPercent, 2) : EMPTY, unit: "" },
      hint: shareHint,
      tone: shareTone,
    },
    {
      id: "subscribers",
      label: "Abonentlar",
      value: subscribers ? { value: num(subscribers.total), unit: "ta" } : { value: EMPTY, unit: "" },
      hint: subscribers
        ? `${data.period.label} · aloqadan chiqqan ${num(subscribers.offline)}`
        : "Transformatorlar yuklanmagan",
      tone: "flat",
    },
    {
      id: "debt",
      label: "Qarzdorlik",
      value: list.uploaded ? scaled(list.debtUzs, "so’m") : { value: EMPTY, unit: "" },
      hint: list.uploaded
        ? `${data.period.label} · ${num(list.debtors)} ta qarzdor`
        : "Abonentlar ro’yxati yuklanmagan",
      tone: "flat",
    },
  ];
}

const KPI_STYLE: Record<string, { icon: typeof Zap; accent: string; tint: string }> = {
  total: { icon: Zap, accent: "bg-accent-blue", tint: "bg-tint-blue" },
  useful: { icon: PlugZap, accent: "bg-accent-green", tint: "bg-tint-green" },
  loss: { icon: Unplug, accent: "bg-accent-red", tint: "bg-tint-red" },
  "loss-share": { icon: Percent, accent: "bg-accent-amber", tint: "bg-tint-amber" },
  subscribers: { icon: Users, accent: "bg-accent-indigo", tint: "bg-tint-indigo" },
  debt: { icon: Wallet, accent: "bg-accent-purple", tint: "bg-tint-purple" },
};

/** Karta sarlavhasining o'ng tomonidagi kichik izoh. */
function Caption({ children }: { children: ReactNode }) {
  return <span className="truncate text-[11px] text-ink-soft">{children}</span>;
}

/* ---------------------------------------------------------------------------
   Yo'qotish ulushi dinamikasi
   --------------------------------------------------------------------------- */

type LossBar = { id: string; label: string; fullLabel: string; value: number };

const LOSS_COLOR = "#cf4646";
const LOSS_COLOR_SOFT = "#eeb4b4";

const BAR_THEME = {
  text: { fontFamily: "inherit", fontSize: 10, fill: "#4d4d4d" },
  axis: {
    ticks: { text: { fontSize: 10, fill: "#4d4d4d" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#d9d9dd", strokeDasharray: "2 2" } },
} as const;

/** Ustun ustida (manfiy bo'lsa - ostida) foiz yozuvi. */
function LossValueLabels({ bars }: BarCustomLayerProps<LossBar>) {
  return (
    <g>
      {bars.map((bar) => {
        const value = bar.data.value ?? 0;
        const negative = value < 0;
        return (
          <text
            key={bar.key}
            x={bar.x + bar.width / 2}
            y={negative ? bar.y + bar.height + 4 : bar.y - 4}
            textAnchor="middle"
            dominantBaseline={negative ? "text-before-edge" : "text-after-edge"}
            style={{ fontSize: 10, fontWeight: 600, fill: "#333333" }}
          >
            {percent(value, 2)}
          </text>
        );
      })}
    </g>
  );
}

function LossShareDynamicsCard({ months, selectedKey }: { months: readonly StatisticsMonth[]; selectedKey: string }) {
  const bars = useMemo<LossBar[]>(
    () =>
      months.flatMap((month) =>
        month.hasData && month.lossPercent != null
          ? [{ id: month.key, label: month.short, fullLabel: month.label, value: month.lossPercent }]
          : [],
      ),
    [months],
  );
  const scale = useMemo(() => linearScale(bars.map((bar) => bar.value), 4), [bars]);
  const labelById = useMemo(() => Object.fromEntries(bars.map((bar) => [bar.id, bar.label])), [bars]);
  const selected = bars.find((bar) => bar.id === selectedKey);

  return (
    <Card className="col-span-4">
      <CardHeader title="Yo’qotish ulushi dinamikasi">
        {selected ? (
          <Caption>
            {selected.fullLabel}: {percent(selected.value, 2)}
          </Caption>
        ) : null}
      </CardHeader>
      <CardBody>
        {bars.length === 0 ? (
          <EmptyState variant="inline" action={false} title="Oqim ma’lumoti yuklanmagan" />
        ) : (
          <div className="min-h-0 flex-1">
            <ResponsiveBar<LossBar>
              data={bars}
              keys={["value"]}
              indexBy="id"
              margin={{ top: 18, right: 8, bottom: 22, left: 40 }}
              padding={0.45}
              valueScale={{ type: "linear", min: scale.min, max: scale.max }}
              colors={(bar) => (bar.data.id === selectedKey ? LOSS_COLOR : LOSS_COLOR_SOFT)}
              borderRadius={3}
              enableLabel={false}
              enableGridX={false}
              gridYValues={scale.ticks}
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 0,
                tickPadding: 6,
                format: (value: string) => labelById[value] ?? value,
              }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 6,
                tickValues: scale.ticks,
                format: (value: number) => `${plainNumber(value)}%`,
              }}
              layers={["grid", "axes", "bars", LossValueLabels]}
              theme={BAR_THEME}
              animate={false}
              tooltip={({ data, color }) => (
                <div className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-[11px] whitespace-nowrap text-ink shadow-md">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-ink-soft">{data.fullLabel}</span>
                  <span className="font-semibold">{percent(finite(data.value), 2)}</span>
                </div>
              )}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Podstansiyalar reytingi va yo'qotish tarkibi (tanlangan oyna)
   --------------------------------------------------------------------------- */

function SubstationRankingCard({ win }: { win: StatisticsWindow }) {
  const bars = fractions(win.substations.map((row) => row.usefulKwh));

  return (
    <Card className="col-span-5">
      <CardHeader title="Podstansiyalar reytingi">
        <Caption>Foydali oqim · {win.rangeLabel}</Caption>
      </CardHeader>
      <CardBody>
        {!win.energy || win.substations.length === 0 ? (
          <EmptyState variant="inline" action={false} title="Podstansiyalar yuklanmagan" />
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-3 border-b border-hairline pb-1.5 text-[10px] font-medium text-ink-soft">
              <span className="w-28 shrink-0">Podstansiya</span>
              <span className="min-w-0 flex-1" />
              <span className="w-24 shrink-0 text-right">Foydali oqim</span>
              <span className="w-16 shrink-0 text-right">Yo’qotish, %</span>
            </div>
            <ul className="scrollbar-none flex min-h-0 flex-1 flex-col overflow-y-auto">
              {win.substations.map((row, index) => (
                <li key={row.id} className="flex min-h-9 shrink-0 items-center gap-3 border-b border-hairline last:border-b-0">
                  <Link
                    href={`/substations/${row.id}`}
                    className="w-28 shrink-0 truncate text-xs font-medium text-ink hover:text-brand"
                    title={row.name}
                  >
                    {row.name}
                  </Link>
                  <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-canvas">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${(bars[index] * 100).toFixed(2)}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 truncate text-right text-xs font-semibold text-ink">
                    {energy(row.usefulKwh)}
                  </span>
                  <span
                    className="w-16 shrink-0 text-right text-[11px] text-ink-muted"
                    title="Yo’qotish ulushi"
                  >
                    {percent(row.lossPercent, 2)}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

const SLICE_COLORS = ["#467acf", "#f59e0b", "#46cf61", "#cb30e0", "#6155f5", "#14b8a6", "#ac7f5e", "#cf4646"];

type LossSlice = { id: string; label: string; value: number; color: string };

function LossStructureCard({ win }: { win: StatisticsWindow }) {
  const rows = useMemo(
    () =>
      [...win.substations]
        .sort((a, b) => b.lossKwh - a.lossKwh)
        .map((row, index) => ({ ...row, color: SLICE_COLORS[index % SLICE_COLORS.length] })),
    [win.substations],
  );
  // Halqa faqat barcha yo'qotishlar musbat bo'lganda to'g'ri ulush ko'rsatadi.
  const drawable = rows.length > 0 && rows.every((row) => row.lossKwh >= 0) && (win.energy?.lossKwh ?? 0) > 0;
  const slices: LossSlice[] = rows
    .filter((row) => row.lossKwh > 0)
    .map((row) => ({ id: row.id, label: row.name, value: row.lossKwh, color: row.color }));
  const center = energyParts(win.energy?.lossKwh);

  return (
    <Card className="col-span-4">
      <CardHeader title="Yo’qotish tarkibi">
        <Caption>podstansiyalar bo’yicha</Caption>
      </CardHeader>
      <CardBody>
        {!win.energy || rows.length === 0 ? (
          <EmptyState variant="inline" action={false} title="Podstansiyalar yuklanmagan" />
        ) : (
          <div className="flex min-h-0 flex-1 items-center gap-3">
            {drawable ? (
              <div className="relative h-full max-h-47.5 w-42.5 shrink-0">
                <ResponsivePie<LossSlice>
                  data={slices}
                  innerRadius={0.68}
                  padAngle={1.2}
                  cornerRadius={2}
                  margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
                  colors={{ datum: "data.color" }}
                  enableArcLabels={false}
                  enableArcLinkLabels={false}
                  isInteractive={false}
                  animate={false}
                />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg leading-none font-bold text-ink">{center.value}</span>
                  <span className="mt-1 text-[10px] text-ink-soft">{center.unit}</span>
                </div>
              </div>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {!drawable ? (
                <p className="text-[11px] leading-4 text-ink-soft">
                  Manfiy yo’qotishli podstansiya bor - ulush halqasi chizilmaydi.
                </p>
              ) : null}
              <ul className="scrollbar-none flex max-h-50 flex-col gap-2.5 overflow-y-auto">
                {rows.map((row) => (
                  <li key={row.id} className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] leading-3.5 text-ink-muted">{row.name}</span>
                      <span className="mt-0.5 flex items-baseline gap-1">
                        <span className="truncate text-xs leading-4 font-semibold text-ink">
                          {energy(row.lossKwh)}
                        </span>
                        <span className="shrink-0 text-[10px] text-ink-soft">({percent(row.lossShare)})</span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Abonent turlari (tanlangan oy)
   --------------------------------------------------------------------------- */

const KIND_COLOR: Record<SubscriberKind, string> = {
  HOUSEHOLD: "bg-accent-blue",
  LEGAL: "bg-accent-indigo",
};

function ShareBar({ value, color }: { value: number | null; color: string }) {
  const width = Math.min(100, Math.max(0, finite(value)));
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-canvas">
      <span className={cn("block h-full rounded-full", color)} style={{ width: `${width.toFixed(2)}%` }} />
    </span>
  );
}

function SubscriberKindsCard({ data }: { data: StatisticsData }) {
  const list = data.current.subscriberList;

  return (
    <Card className="col-span-3">
      <CardHeader title="Abonent turlari">
        <Caption>{data.period.label}</Caption>
      </CardHeader>
      <CardBody>
        {!list.uploaded ? (
          <EmptyState variant="inline" action={false} title="Abonentlar ro’yxati yuklanmagan" />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
            {SUBSCRIBER_KIND_ORDER.map((kind) => {
              const countShare = share(list.byKind[kind], list.total);
              const debtShare = share(list.debtByKind[kind], list.debtUzs);
              return (
                <Link
                  key={kind}
                  href={`/subscribers?kind=${kind}`}
                  className="flex flex-col gap-1.5 rounded-lg bg-canvas/60 p-2.5 transition-colors hover:bg-canvas"
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-ink">{SUBSCRIBER_KIND_LABEL[kind]}</span>
                    <span className="shrink-0 text-xs font-semibold text-ink">
                      {num(list.byKind[kind])} ta{" "}
                      <span className="font-normal text-ink-soft">({percent(countShare)})</span>
                    </span>
                  </span>
                  <ShareBar value={countShare} color={KIND_COLOR[kind]} />
                  <span className="mt-0.5 flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="truncate text-ink-muted">Qarzdorlik</span>
                    <span className="shrink-0 font-medium text-ink">
                      {money(list.debtByKind[kind])}{" "}
                      <span className="text-ink-soft">({percent(debtShare)})</span>
                    </span>
                  </span>
                  <ShareBar value={debtShare} color="bg-accent-purple" />
                </Link>
              );
            })}
            <p className="shrink-0 truncate text-[11px] text-ink-soft">
              Jami: {num(list.total)} ta · {money(list.debtUzs)}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Eng yuqori yo'qotishli TP lar (tanlangan oy)
   --------------------------------------------------------------------------- */

const TP_COLUMNS: TableColumn[] = [
  { key: "rank", label: "№", grow: 0.4 },
  { key: "name", label: "TP", grow: 1.2, align: "left" },
  { key: "substation", label: "Podstansiya", grow: 1.3, align: "left" },
  { key: "feeder", label: "Fider", grow: 1.3, align: "left" },
  { key: "total", label: "Umumiy oqim", grow: 1.2, align: "right" },
  { key: "loss", label: "Yo’qotish", grow: 1.1, align: "right" },
  { key: "share", label: "Yo’qotish ulushi", grow: 1.1, align: "right" },
  { key: "subscribers", label: "Abonentlar", grow: 0.9, align: "right" },
];

function EntityLink({ href, children, strong = false }: { href: string; children: ReactNode; strong?: boolean }) {
  return (
    <Link href={href} className={cn("hover:text-brand hover:underline", strong && "font-semibold")}>
      {children}
    </Link>
  );
}

function WorstTransformersCard({ data }: { data: StatisticsData }) {
  const rows = data.worstTransformers;

  return (
    <Card className="col-span-12">
      <CardHeader title="Yo’qotish ulushi eng yuqori TP lar">
        {rows ? (
          <Caption>
            {data.period.label} · umumiy oqimi bor {num(data.rankedTransformers)} ta TP orasida
          </Caption>
        ) : null}
      </CardHeader>
      <CardBody>
        {rows == null ? (
          <EmptyState variant="inline" action={false} title="Transformatorlar yuklanmagan" />
        ) : (
          <DataTable
            columns={TP_COLUMNS}
            lastRowFooter={false}
            emptyText="Shu oyda umumiy oqimi bor TP yo’q"
            rows={rows.map((row, index) => ({
              key: row.id,
              cells: [
                <span key="rank" className="text-ink-soft">
                  {index + 1}
                </span>,
                <EntityLink key="name" href={`/transformers/${row.id}`} strong>
                  {row.name}
                </EntityLink>,
                <EntityLink key="substation" href={`/substations/${row.substation.id}`}>
                  {row.substation.name}
                </EntityLink>,
                <EntityLink key="feeder" href={`/feeders/${row.feeder.id}`}>
                  {row.feeder.name}
                </EntityLink>,
                energy(row.totalKwh),
                energy(row.lossKwh),
                <span key="share" className="font-semibold text-trend-up">
                  {percent(row.lossPercent, 2)}
                </span>,
                num(row.subscribers),
              ],
            }))}
          />
        )}
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Oylik jadval
   --------------------------------------------------------------------------- */

const MONTH_COLUMNS: TableColumn[] = [
  { key: "month", label: "Oy", grow: 1.2, align: "left" },
  { key: "total", label: "Umumiy oqim", grow: 1.1, align: "right" },
  { key: "useful", label: "Foydali oqim", grow: 1.1, align: "right" },
  { key: "loss", label: "Yo’qotish", grow: 1, align: "right" },
  { key: "share", label: "Yo’qotish ulushi", grow: 1, align: "right" },
  { key: "subscribers", label: "Abonentlar", grow: 0.9, align: "right" },
  { key: "debt", label: "Qarzdorlik", grow: 1.1, align: "right" },
  { key: "violations", label: "Qoidabuzarlik", grow: 0.9, align: "right" },
  { key: "appeals", label: "Murojaat", grow: 0.8, align: "right" },
];

function MonthlyTableCard({ data }: { data: StatisticsData }) {
  const hasMissing = data.months.some(
    (month) =>
      !month.hasData ||
      month.subscribers == null ||
      month.debtUzs == null ||
      month.violations == null ||
      month.appeals == null,
  );

  return (
    <Card className="col-span-12">
      <CardHeader title="Oylik ko’rsatkichlar">
        <Caption>
          {data.historyLabel} · {num(data.months.length)} oy
        </Caption>
      </CardHeader>
      <CardBody>
        <DataTable
          columns={MONTH_COLUMNS}
          lastRowFooter={false}
          rows={data.months.map((month) => {
            const selected = month.key === data.period.key;
            return {
              key: month.key,
              cells: [
                <span key="month" className={selected ? "font-bold" : "font-medium"}>
                  {month.label}
                </span>,
                energy(month.totalKwh),
                energy(month.usefulKwh),
                energy(month.lossKwh),
                percent(month.lossPercent, 2),
                month.subscribers == null ? EMPTY : num(month.subscribers),
                money(month.debtUzs),
                month.violations == null ? EMPTY : num(month.violations),
                month.appeals == null ? EMPTY : num(month.appeals),
              ],
            };
          })}
        />
        {hasMissing ? (
          <p className="shrink-0 pt-2 text-[10px] text-ink-soft">
            {EMPTY} - shu oy uchun tegishli shablon yuklanmagan.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   Ko'rinish
   --------------------------------------------------------------------------- */

/**
 * "Statistika" - tuman bo'yicha tahlil. Davr oynasi (Oy / Chorak / Yil) -
 * tanlangan oy va undan oldingi bazadagi 1 / 3 / 12 ta davr; u KPI lar,
 * podstansiyalar reytingi va yo'qotish tarkibiga ta'sir qiladi. Dinamika,
 * TP reytingi va abonentlar - tanlangan oy (va undan oldingi 12 davr).
 */
export function StatisticsView({ data }: { data: StatisticsData }) {
  const [windowId, setWindowId] = useState<StatisticsWindowId>("month");
  const win = data.windows.find((item) => item.id === windowId) ?? data.windows[0];

  const chips: ReadonlyArray<FilterChip<StatisticsWindowId>> = data.windows.map((item) => ({
    value: item.id,
    label: WINDOW_LABEL[item.id],
  }));

  const kpis = buildKpis(data, win);

  const dynamics = useMemo<DynamicsMonth[]>(
    () =>
      data.months.flatMap((month) =>
        month.hasData
          ? [
              {
                key: month.key,
                label: month.label,
                billed: month.totalKwh ?? 0,
                consumed: month.usefulKwh ?? 0,
                loss: month.lossKwh ?? 0,
              },
            ]
          : [],
      ),
    [data.months],
  );

  const shortage =
    win.periods < win.requested ? ` · bazada ${num(win.requested)} oy o’rniga ${num(win.periods)} oy bor` : "";

  return (
    <div className="scrollbar-none flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
      <PageHeader title="Statistika" subtitle={`Tuman bo’yicha tahlil · ${win.rangeLabel}${shortage}`}>
        <FilterChips items={chips} value={windowId} onChange={setWindowId} />
        <HeaderButton icon={FileDown} href="/reports">
          Hisobotlar
        </HeaderButton>
      </PageHeader>

      <StatRow>
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.id}
            label={kpi.label}
            value={kpi.value.value}
            unit={kpi.value.unit || undefined}
            icon={KPI_STYLE[kpi.id].icon}
            accent={KPI_STYLE[kpi.id].accent}
            tint={KPI_STYLE[kpi.id].tint}
            hint={kpi.hint}
            hintTone={kpi.tone}
          />
        ))}
      </StatRow>

      <div className="grid h-75 shrink-0 grid-cols-12 gap-2">
        <ConsumptionDynamicsCard className="col-span-8" months={dynamics} />
        <LossShareDynamicsCard months={data.months} selectedKey={data.period.key} />
      </div>

      <div className="grid h-75 shrink-0 grid-cols-12 gap-2">
        <SubstationRankingCard win={win} />
        <LossStructureCard win={win} />
        <SubscriberKindsCard data={data} />
      </div>

      <div className="grid shrink-0 grid-cols-12 gap-2">
        <WorstTransformersCard data={data} />
      </div>

      <div className="grid shrink-0 grid-cols-12 gap-2">
        <MonthlyTableCard data={data} />
      </div>
    </div>
  );
}
