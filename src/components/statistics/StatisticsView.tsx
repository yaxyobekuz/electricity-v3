"use client";

// Sahifa to'liq mijozda ishlaydi: davr tanlagichi holat (`useState`) talab
// qiladi va barcha grafiklar @nivo (faqat brauzerda chiziladi).

import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { ResponsivePie } from "@nivo/pie";
import { Cable, FileDown, PlugZap, TriangleAlert, Wallet, Zap } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  Badge,
  type BadgeTone,
  DataTable,
  type TableColumn,
  type TableRow,
} from "@/components/ui/DataTable";
import { CycleSelect } from "@/components/ui/Filters";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import {
  between,
  dec,
  energy,
  money,
  MONTHS_SHORT_UZ,
  MONTHS_UZ,
  num,
  series,
} from "@/lib/data/seed";
import { SUBSCRIBERS, subscriberTotals } from "@/lib/data/subscribers";
import { SUBSTATIONS, substationTotals } from "@/lib/data/substations";
import { TRANSFORMERS } from "@/lib/data/transformers";

// Maketdagi o'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, `string`
// proplarda (sarlavha, ustun nomi) \u2019 escape sifatida yoziladi.

/* ---------------------------------------------------------------------------
   Ma'lumot - `seed.ts` yordamida determinlashgan (server va mijoz bir xil
   markup chizishi shart, shuning uchun `Math.random`/`new Date` yo'q).
   --------------------------------------------------------------------------- */

/** Oylik kesim. Domen: `Hisoblangan` - balans hisoblagich (TP kirishi),
 *  `Iste'mol` - foydali oqim (abonent hisoblagichlari), farqi - yo'qotish. */
interface MonthStat {
  key: string;
  /** "Avgust 2026" - oyning to'liq nomi va yili. */
  label: string;
  /** O'q yorlig'i: "Avg". */
  short: string;
  /** Hisoblangan (tarmoqqa berilgan), kWh. */
  supplied: number;
  /** Foydali energiya, kWh. */
  useful: number;
  /** Yo'qotish, kWh. */
  loss: number;
  lossPercent: number;
  /** Hisoblangan to'lov, so'm. */
  billed: number;
  /** Yig'ilgan to'lov, so'm. */
  paid: number;
  collectPercent: number;
}

const DISTRICT = substationTotals();

/**
 * Tuman bo'yicha yo'qotish - podstansiyalar bo'yicha oddiy o'rtacha emas,
 * iste'mol hajmiga vaznlangan (kichik PS katta PS ni "tortib" yubormasin).
 */
const DISTRICT_LOSS_PERCENT =
  SUBSTATIONS.reduce((sum, item) => sum + item.consumptionKwh * item.lossPercent, 0) /
  DISTRICT.consumption;

/** O'rtacha tarif, so'm/kWh - abonent bazasidan iste'mol hajmiga vaznlangan. */
const AVG_TARIFF =
  SUBSCRIBERS.reduce((sum, item) => sum + item.monthlyKwh * item.tariff, 0) /
  SUBSCRIBERS.reduce((sum, item) => sum + item.monthlyKwh, 0);

/** `TODAY` = "10-avgust, 2026": oyna oxirgi 12 oy - sentabr 2025 ... avgust 2026. */
const CURRENT_MONTH = 7;
const CURRENT_YEAR = 2026;

/**
 * O'q yorliqlari. `MONTHS_SHORT_UZ` da Iyun ham, Iyul ham "Iyu" bo'lib
 * qoladi - nivo esa indeks qiymatlarining noyobligini talab qiladi: nuqtali
 * o'q (`xScale: point`) takrorlangan qiymatni domendan tashlab yuboradi va
 * ikki oy bitta nuqtaga ustma-ust tushadi. Shuning uchun shu ikkitasi
 * ajratiladi (`SubstationDetail` dagi bilan bir xil konvensiya).
 */
const AXIS_MONTHS = MONTHS_SHORT_UZ.map((short, index) => {
  if (index === 5) return "Iyn";
  if (index === 6) return "Iyl";
  return short;
});

const MONTHS: readonly MonthStat[] = series(
  7.7,
  12,
  DISTRICT.consumption,
  0.14,
  0.16,
).map((supplied, index) => {
  // 0 -> 11 oy oldin; manfiy indeks o'tgan yilga tushadi.
  const offset = CURRENT_MONTH - 11 + index;
  const monthIndex = (offset + 12) % 12;
  const year = offset < 0 ? CURRENT_YEAR - 1 : CURRENT_YEAR;

  // Yo'qotish tuman o'rtachasi atrofida +-2.2 p.p. tebranadi (mavsumiylik).
  const lossPercent = DISTRICT_LOSS_PERCENT + between(index * 3.7 + 11.3, -22, 22, 1) / 10;
  const loss = Math.round((supplied * lossPercent) / 100);
  const useful = supplied - loss;
  const billed = Math.round(useful * AVG_TARIFF);
  const collectPercent = between(index * 5.1 + 17.9, 886, 991, 1) / 10;

  return {
    key: `m-${index}`,
    label: `${MONTHS_UZ[monthIndex]} ${year}`,
    short: AXIS_MONTHS[monthIndex],
    supplied,
    useful,
    loss,
    lossPercent,
    billed,
    paid: Math.round((billed * collectPercent) / 100),
    collectPercent,
  };
});

/**
 * Umumiy yo'qotishning tarkibi. Domen bo'yicha texnik yo'qotish - normativ,
 * qolgani tijorat; "hisobsiz" (hisoblagichdan o'tmagan) ulush tahlil uchun
 * tijoratdan alohida ajratib ko'rsatiladi.
 */
const LOSS_SPLIT = { technical: 0.6, commercial: 0.27, unmetered: 0.13 } as const;

/** Halqaning bir bo'lagi. Rang nivo'ga `colors={{ datum: "data.color" }}`
 *  orqali uzatiladi - nivo SVG ichida CSS tokenini o'qiy olmaydi. */
interface LossSlice {
  id: string;
  label: string;
  /** Yoy o'lchami, kWh. */
  value: number;
  color: string;
}

interface PeriodOption {
  id: string;
  label: string;
  /** Oynaning oxiridan sanaladigan oylar soni. */
  months: number;
}

const PERIODS: readonly PeriodOption[] = [
  { id: "month", label: "Oy", months: 1 },
  { id: "quarter", label: "Chorak", months: 3 },
  { id: "year", label: "Yil", months: 12 },
];

interface PeriodTotals {
  supplied: number;
  useful: number;
  loss: number;
  lossPercent: number;
  paid: number;
  collectPercent: number;
  /** "Avgust 2026" yoki "Sentabr 2025 — Avgust 2026". */
  range: string;
}

function aggregate(months: number): PeriodTotals {
  const slice = MONTHS.slice(MONTHS.length - months);
  const supplied = slice.reduce((sum, item) => sum + item.supplied, 0);
  const loss = slice.reduce((sum, item) => sum + item.loss, 0);
  const billed = slice.reduce((sum, item) => sum + item.billed, 0);
  const paid = slice.reduce((sum, item) => sum + item.paid, 0);
  const first = slice[0];
  const last = slice[slice.length - 1];

  return {
    supplied,
    useful: supplied - loss,
    loss,
    lossPercent: (loss / supplied) * 100,
    paid,
    collectPercent: (paid / billed) * 100,
    range: months === 1 ? last.label : `${first.label} — ${last.label}`,
  };
}

/** Uchala davr oldindan hisoblanadi - qayta chizishda arifmetika takrorlanmaydi. */
const TOTALS_BY_PERIOD: readonly PeriodTotals[] = PERIODS.map((period) =>
  aggregate(period.months),
);

/** "Baliqchi podstansiyasi" -> "Baliqchi": grafik o'qi va jadval katagi tor. */
function shortName(name: string): string {
  return name.replace(" podstansiyasi", "");
}

/* --- Iste'molchi turlari: ulushlar abonent bazasidan olinadi ---------------- */

const SUBSCRIBER_TOTALS = subscriberTotals();

const SAMPLE_KWH = SUBSCRIBERS.reduce((sum, item) => sum + item.monthlyKwh, 0);

interface KindShare {
  id: string;
  /** Abonentlar soni - o'q yorlig'ida qavs ichida. */
  count: number;
  /** Shu turning foydali energiyadagi ulushi (0..1). */
  share: number;
  color: string;
}

const KIND_SHARES: readonly KindShare[] = [
  {
    id: "Aholi",
    count: SUBSCRIBER_TOTALS.household,
    share:
      SUBSCRIBERS.filter((item) => item.kind === "household").reduce(
        (sum, item) => sum + item.monthlyKwh,
        0,
      ) / SAMPLE_KWH,
    color: "#3b82f6",
  },
  {
    id: "Yuridik",
    count: SUBSCRIBER_TOTALS.legal,
    share:
      SUBSCRIBERS.filter((item) => item.kind === "legal").reduce(
        (sum, item) => sum + item.monthlyKwh,
        0,
      ) / SAMPLE_KWH,
    color: "#6155f5",
  },
  {
    id: "Budjet",
    count: SUBSCRIBER_TOTALS.budget,
    share:
      SUBSCRIBERS.filter((item) => item.kind === "budget").reduce(
        (sum, item) => sum + item.monthlyKwh,
        0,
      ) / SAMPLE_KWH,
    color: "#14b8a6",
  },
];

/** Pastki o'qdagi yorliq - qavsda abonentlar soni: "Aholi (37)". */
const KIND_AXIS: Record<string, string> = Object.fromEntries(
  KIND_SHARES.map((kind) => [kind.id, `${kind.id} (${kind.count})`]),
);

/* --- Reyting va eng yomon TP ----------------------------------------------- */

const TOP_SUBSTATIONS = [...SUBSTATIONS]
  .sort((a, b) => b.consumptionKwh - a.consumptionKwh)
  .slice(0, 6);

/** Chap o'qdagi yorliq: nivo indeksi `id`, ekranda esa qisqa nom. */
const SUBSTATION_AXIS: Record<string, string> = Object.fromEntries(
  TOP_SUBSTATIONS.map((item) => [item.id, shortName(item.name)]),
);

const WORST_TRANSFORMERS = [...TRANSFORMERS]
  .sort((a, b) => b.lossPercent - a.lossPercent)
  .slice(0, 6);

/** Yo'qotish nishonining rangi: 14% dan yuqorisi kritik, 11% dan - ogohlantirish. */
function lossTone(percent: number): BadgeTone {
  if (percent >= 14) return "red";
  if (percent >= 11) return "amber";
  return "green";
}

/* --- Grafik sozlamalari ---------------------------------------------------- */

const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" },
  axis: {
    ticks: { text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#e8e8ec", strokeDasharray: "2 2" } },
  labels: { text: { fontFamily: "inherit", fontSize: 10, fontWeight: 600 } },
} as const;

interface LineSeries {
  id: "loss" | "supplied" | "useful";
  label: string;
  color: string;
}

/** Legenda ham, chiziq ranglari ham shu ro'yxatdan olinadi (bitta manba). */
const LINE_SERIES: readonly LineSeries[] = [
  { id: "supplied", label: "Jami iste\u2019mol", color: "#3b82f6" },
  { id: "useful", label: "Foydali energiya", color: "#22c55e" },
  { id: "loss", label: "Yo\u2019qotish", color: "#ef4444" },
];

const LINE_COLORS = LINE_SERIES.map((item) => item.color);

/**
 * Grafik ming kWh da chiziladi (kWh da o'q yorliqlari 7 xonali bo'lib ketardi).
 * Yuqori chegara 2 000 ming (2 mln) ga yaxlitlanadi - shunda barcha
 * bo'linmalar butun qiymatda chiqadi.
 */
const LINE_MAX =
  Math.ceil(Math.max(...MONTHS.map((item) => item.supplied)) / 2_000_000) * 2000;

const Y_TICKS = Array.from({ length: LINE_MAX / 2000 + 1 }, (_, index) => index * 2000);

const LINE_DATA = LINE_SERIES.map((item) => ({
  id: item.label,
  data: MONTHS.map((month) => ({ x: month.short, y: Math.round(month[item.id] / 1000) })),
}));

const LINE_MARGIN = { top: 6, right: 12, bottom: 22, left: 46 } as const;

/* --- Oylik jadval ---------------------------------------------------------- */

const MONTH_COLUMNS: TableColumn[] = [
  { key: "month", label: "Oy", grow: 1.35, align: "left" },
  { key: "billed", label: "Hisoblangan", grow: 1.15 },
  { key: "usage", label: "Iste\u2019mol", grow: 1.15 },
  { key: "loss", label: "Yo\u2019qotish", grow: 1.1 },
  { key: "lossPercent", label: "Yo\u2019qotish %", grow: 0.9 },
  { key: "payment", label: "To\u2019lov", grow: 1.35 },
  { key: "collect", label: "Yig\u2019ilish %", grow: 0.9 },
];

function monthRows(items: readonly MonthStat[]): TableRow[] {
  return items.map((month) => ({
    key: month.key,
    cells: [
      <span key="month" className="font-medium">
        {month.label}
      </span>,
      energy(month.supplied),
      energy(month.useful),
      energy(month.loss),
      <span key="loss" className="font-semibold text-trend-up">
        {dec(month.lossPercent, 1)}%
      </span>,
      money(month.paid),
      <span
        key="collect"
        className={month.collectPercent >= 95 ? "font-semibold text-trend-down" : ""}
      >
        {dec(month.collectPercent, 1)}%
      </span>,
    ],
  }));
}

/** Ikkita 6 qatorli jadval - 12 qator bitta ustunda 240px kartaga sig'maydi. */
const MONTH_HALVES = [MONTHS.slice(0, 6), MONTHS.slice(6)] as const;

const TP_COLUMNS: TableColumn[] = [
  { key: "code", label: "TP", grow: 1, align: "left" },
  { key: "substation", label: "Podstansiya", grow: 1.3, align: "left" },
  { key: "usage", label: "Oylik iste\u2019mol", grow: 1.2 },
  { key: "loss", label: "Yo\u2019qotish %", grow: 1 },
];

/* ---------------------------------------------------------------------------
   Ko'rinish
   --------------------------------------------------------------------------- */

export function StatisticsView() {
  const [periodIndex, setPeriodIndex] = useState(0);
  const period = PERIODS[periodIndex];
  const totals = TOTALS_BY_PERIOD[periodIndex];

  const technical = totals.loss * LOSS_SPLIT.technical;
  const commercial = totals.loss * LOSS_SPLIT.commercial;
  const unmetered = totals.loss * LOSS_SPLIT.unmetered;

  const lossSlices: LossSlice[] = [
    { id: "technical", label: "Texnik", value: technical, color: "#f59e0b" },
    { id: "commercial", label: "Tijorat", value: commercial, color: "#ef4444" },
    { id: "unmetered", label: "Hisobsiz", value: unmetered, color: "#6155f5" },
  ];

  // Tanlangan davr barcha grafiklarga ta'sir qiladi: ustunlar ham shu
  // davrdagi hajmni ko'rsatadi (ming kWh).
  const kindBars = KIND_SHARES.map((kind) => ({
    id: kind.id,
    value: Math.round((totals.useful * kind.share) / 1000),
    color: kind.color,
  }));

  const substationBars = TOP_SUBSTATIONS.map((item) => ({
    id: item.id,
    value: Math.round((item.consumptionKwh * period.months) / 1000),
  })).reverse();

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
      <PageHeader
        title="Statistika"
        subtitle={"Iste\u2019mol, yo\u2019qotish va to\u2019lovlar tahlili"}
      >
        <CycleSelect
          label="Davr"
          value={period.label}
          onCycle={() => setPeriodIndex((index) => (index + 1) % PERIODS.length)}
        />
        <HeaderButton icon={FileDown}>Yuklab olish</HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label={"Jami iste\u2019mol"}
          value={energy(totals.supplied)}
          icon={Zap}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={totals.range}
        />
        <StatCard
          label="Foydali energiya"
          value={energy(totals.useful)}
          icon={PlugZap}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint={`Samaradorlik ${dec((totals.useful / totals.supplied) * 100, 1)}%`}
          hintTone="good"
        />
        <StatCard
          label={"Texnik yo\u2019qotish"}
          value={energy(technical)}
          icon={Cable}
          accent="bg-accent-amber"
          tint="bg-tint-amber"
          hint={`Tarmoqdan ${dec((technical / totals.supplied) * 100, 1)}%`}
        />
        <StatCard
          label={"Tijorat yo\u2019qotish"}
          value={energy(commercial)}
          icon={TriangleAlert}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint={`Tarmoqdan ${dec((commercial / totals.supplied) * 100, 1)}%`}
          hintTone="bad"
        />
        <StatCard
          label={"Yig\u2019ilgan to\u2019lov"}
          value={money(totals.paid)}
          icon={Wallet}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`Yig\u2019ilish ${dec(totals.collectPercent, 1)}%`}
          hintTone="good"
        />
      </StatRow>

      {/* Balandlik qator sifatida beriladi, karta klassida emas: `Card` ning
          o'zida `h-full` bor va Tailwind uni `h-[300px]` dan keyin chizadi -
          ya'ni kartaga qo'yilgan aniq balandlik ishlamay qolardi. `shrink-0`
          esa past ekranda qatorlarni siqilishdan saqlaydi (sahifa skroll bo'ladi). */}
      <div className="grid shrink-0 grid-cols-12 grid-rows-[300px_280px_240px] gap-2">
        {/* a) Dinamika - sahifadagi eng katta grafik, tultip yoqilgan. */}
        <Card className="col-span-8">
          <CardHeader title={"Iste\u2019mol va yo\u2019qotish dinamikasi"}>
            <span className="text-[11px] text-ink-soft">ming kWh &middot; 12 oy</span>
          </CardHeader>
          <CardBody>
            {/* Legenda grafik ustida: nivo legendasi past kartada joy yeydi. */}
            <div className="flex shrink-0 items-center gap-3 text-[10px] text-ink-soft">
              {LINE_SERIES.map((item) => (
                <span key={item.id} className="flex items-center gap-1 whitespace-nowrap">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
              ))}
            </div>

            <div className="mt-2 min-h-0 flex-1">
              <ResponsiveLine
                data={LINE_DATA}
                margin={LINE_MARGIN}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: 0, max: LINE_MAX, stacked: false }}
                curve="monotoneX"
                colors={LINE_COLORS}
                lineWidth={2}
                theme={CHART_THEME}
                axisTop={null}
                axisRight={null}
                axisBottom={{ tickSize: 0, tickPadding: 6 }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 6,
                  tickValues: Y_TICKS,
                  format: (value: number) => num(value),
                }}
                enableGridX={false}
                gridYValues={Y_TICKS}
                pointSize={5}
                pointColor="#ffffff"
                pointBorderWidth={1.5}
                pointBorderColor={{ from: "seriesColor" }}
                enableCrosshair={false}
                enableTouchCrosshair={false}
                useMesh
                animate={false}
                tooltip={({ point }) => (
                  <div className="rounded-md bg-surface px-2 py-1 whitespace-nowrap shadow-md">
                    <div className="text-[9px] text-ink-soft">{point.data.xFormatted}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: point.seriesColor }}
                      />
                      <span className="text-ink-soft">{point.seriesId}</span>
                      <span className="font-semibold">
                        {num(Number(point.data.y))} ming kWh
                      </span>
                    </div>
                  </div>
                )}
              />
            </div>
          </CardBody>
        </Card>

        {/* b) Yo'qotish tuzilmasi - halqa va yonida legenda. */}
        <Card className="col-span-4">
          <CardHeader title={"Yo\u2019qotish tuzilmasi"} />
          <CardBody>
            <div className="flex min-h-0 flex-1 items-center gap-3">
              <div className="relative h-full w-[150px] shrink-0">
                {/* Karta `overflow-hidden` - nivo tultipi kesilardi, shuning
                    uchun grafik statik, ma'lumot legendada to'liq ko'rinadi. */}
                <ResponsivePie<LossSlice>
                  data={lossSlices}
                  innerRadius={0.7}
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
                  <span className="text-xl leading-none font-bold text-ink">
                    {dec(totals.lossPercent, 1)}%
                  </span>
                  <span className="mt-1 text-[9px] text-ink-soft">umumiy yo&rsquo;qotish</span>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
                {lossSlices.map((slice) => (
                  <div key={slice.id} className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-[10px] leading-[13px] text-ink-soft">
                        {slice.label}
                      </span>
                      <div className="mt-0.5 flex items-baseline gap-1">
                        <span className="min-w-0 truncate text-[11px] leading-[14px] font-semibold text-ink">
                          {energy(slice.value)}
                        </span>
                        <span className="shrink-0 text-[9px] text-ink-soft">
                          ({dec((slice.value / totals.loss) * 100, 0)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* c) Iste'molchi turlari - vertikal ustunlar, qavsda abonent soni. */}
        <Card className="col-span-4">
          <CardHeader title={"Iste\u2019molchi turlari bo\u2019yicha"}>
            <span className="text-[11px] text-ink-soft">ming kWh</span>
          </CardHeader>
          <CardBody>
            <div className="min-h-0 flex-1">
              <ResponsiveBar
                data={kindBars}
                keys={["value"]}
                indexBy="id"
                margin={{ top: 8, right: 8, bottom: 24, left: 46 }}
                padding={0.42}
                colors={{ datum: "data.color" }}
                borderRadius={4}
                enableGridX={false}
                gridYValues={4}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 8,
                  format: (value: string) => KIND_AXIS[value] ?? value,
                }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 6,
                  tickValues: 4,
                  format: (value: number) => num(value),
                }}
                valueFormat={(value) => num(value)}
                labelSkipHeight={18}
                labelTextColor="#ffffff"
                theme={CHART_THEME}
                isInteractive={false}
                animate={false}
              />
            </div>
          </CardBody>
        </Card>

        {/* d) Podstansiyalar reytingi - eng ko'p iste'mol qiluvchi oltitasi. */}
        <Card className="col-span-4">
          <CardHeader title="Podstansiyalar reytingi">
            <span className="text-[11px] text-ink-soft">ming kWh</span>
          </CardHeader>
          <CardBody>
            <div className="min-h-0 flex-1">
              <ResponsiveBar
                data={substationBars}
                keys={["value"]}
                indexBy="id"
                layout="horizontal"
                margin={{ top: 4, right: 8, bottom: 4, left: 68 }}
                padding={0.3}
                colors={["#007cd2"]}
                borderRadius={4}
                enableGridX={false}
                enableGridY={false}
                axisTop={null}
                axisRight={null}
                axisBottom={null}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 8,
                  format: (value: string) => SUBSTATION_AXIS[value] ?? value,
                }}
                valueFormat={(value) => num(value)}
                labelSkipWidth={48}
                labelTextColor="#ffffff"
                theme={CHART_THEME}
                isInteractive={false}
                animate={false}
              />
            </div>
          </CardBody>
        </Card>

        {/* e) Yo'qotish bo'yicha eng yomon TP - foiz bo'yicha saralangan. */}
        <Card className="col-span-4">
          <CardHeader title={"Yo\u2019qotish bo\u2019yicha eng yomon TP"} />
          <CardBody>
            <div className="min-h-0 flex-1">
              <DataTable
                className="leading-tight"
                compact
                columns={TP_COLUMNS}
                rows={WORST_TRANSFORMERS.map((item) => ({
                  key: item.id,
                  cells: [
                    <span key="code" className="font-medium">
                      {item.code}
                    </span>,
                    shortName(item.substationName),
                    energy(item.consumptionKwh),
                    <Badge key="loss" tone={lossTone(item.lossPercent)}>
                      {dec(item.lossPercent, 1)}%
                    </Badge>,
                  ],
                }))}
              />
            </div>
            <p className="shrink-0 pt-2 text-[10px] text-ink-soft">
              Normativ chegara &mdash; 8%. 14% dan yuqorisi tekshiruvga chiqariladi.
            </p>
          </CardBody>
        </Card>

        {/* f) Oylik kesim - 12 oy ikkita jadvalga bo'lingan (240px kartaga
            bitta ustunda 12 qator sig'maydi). */}
        <Card className="col-span-12">
          <CardHeader title={"Oylik ko\u2019rsatkichlar jadvali"}>
            <span className="text-[11px] text-ink-soft">
              {MONTHS[0].label} &mdash; {MONTHS[MONTHS.length - 1].label}
            </span>
          </CardHeader>
          <CardBody>
            <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
              {MONTH_HALVES.map((half) => (
                <DataTable
                  key={half[0].key}
                  className="leading-tight"
                  compact
                  rowHeight={22}
                  lastRowHeight={24}
                  columns={MONTH_COLUMNS}
                  rows={monthRows(half)}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
