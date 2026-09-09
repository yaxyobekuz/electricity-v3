"use client";

import {
  type LineCustomSvgLayerProps,
  type LineSvgLayer,
  ResponsiveLine,
} from "@nivo/line";
import { ArrowDown } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

// Maketdagi o'zbekcha apostrof - U+2019: JSX matnida `&rsquo;` (ESLint
// `react/no-unescaped-entities`), `string` qiymatlarida belgining o'zi.

/** X o'qi: joriy oy va undan keyingi to'rt oy. */
const MONTHS = ["Avg", "Sen", "Okt", "Noy", "Dek"] as const;

type TabId = "loss" | "load" | "voltage";

interface TabSeries {
  label: string;
  /** Tooltipdagi o'lchov birligi. */
  unit: string;
  /** Hozirgi (faktik va joriy trend) qiymatlar. */
  current: readonly number[];
  /** Model bergan prognoz qiymatlari. */
  forecast: readonly number[];
  /**
   * Y o'qidagi 4 ta tik. Qiymatlar qo'lda tanlangan: d3 ning avtomatik tiklari
   * bu tor kartada 6-7 ta yorliq berib, o'q ustunini to'ldirib yuboradi.
   * To'r chiziqlari ham aynan shu qiymatlar bo'yicha chiziladi.
   */
  ticks: readonly number[];
  /** Tik yorlig'idagi kasr xonalari (yorliqlar bir xil enlikda tursin). */
  tickDecimals: number;
  /** Tooltipdagi qiymat kasr xonalari. */
  valueDecimals: number;
}

/**
 * Har bir tab uchun mock qatorlar - tashqi API yo'q, ma'lumot fayl ichida.
 * Ikkala seriya ham 5 nuqtadan iborat: prognoz joriy oydan (Avg) ajralib
 * chiqadi, shuning uchun birinchi nuqtalari teng.
 */
const SERIES_BY_TAB: Record<TabId, TabSeries> = {
  loss: {
    label: "Yo’qotishlar",
    unit: "%",
    current: [12.0, 11.6, 11.1, 10.6, 10.2],
    forecast: [12.0, 11.4, 10.7, 9.9, 9.2],
    ticks: [9, 10, 11, 12],
    tickDecimals: 0,
    valueDecimals: 1,
  },
  load: {
    label: "Yuklama",
    unit: "kW",
    current: [1409, 1440, 1385, 1320, 1290],
    forecast: [1409, 1455, 1402, 1350, 1305],
    ticks: [1200, 1300, 1400, 1500],
    tickDecimals: 0,
    valueDecimals: 0,
  },
  voltage: {
    label: "Kuchlanish",
    unit: "kV",
    current: [10.6, 10.5, 10.4, 10.5, 10.6],
    forecast: [10.6, 10.6, 10.7, 10.7, 10.8],
    ticks: [10.2, 10.4, 10.6, 10.8],
    tickDecimals: 1,
    valueDecimals: 1,
  },
};

/** Tablar ko'rinish tartibi (Record kaliti tartibiga tayanmaslik uchun). */
const TAB_ORDER: readonly TabId[] = ["loss", "load", "voltage"];

/** Seriya nomlari legendada ham, tooltipda ham shu ko'rinishda chiqadi. */
const CURRENT_ID = "Hozirgi";
const FORECAST_ID = "Prognoz";

const CURRENT_COLOR = "#2563eb";
const FORECAST_COLOR = "#22c55e";
const LINE_COLORS = [CURRENT_COLOR, FORECAST_COLOR];

/** Nivo seriyasining aniq tipi - custom qatlam propslarini tiplash uchun. */
interface ForecastSeries {
  id: string;
  data: readonly { x: string; y: number }[];
}

/** O'zbek yozuvida kasr ajratgichi - vergul (maketdagi "15,2 ming kWh"). */
function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(".", ",");
}

/**
 * Maslahatdagi to'liq qiymat: minglar uzilmas bo'shliq (U+00A0) bilan
 * ajratiladi - `ConsumptionLossCard` dagi qoida bilan bir xil.
 * `toLocaleString` ishlatilmaydi: server va brauzer lokali farq qilsa
 * gidratatsiya buziladi. O'q yorliqlarida guruhlash yo'q - chap ustunga
 * atigi 26px ajratilgan.
 */
function formatTooltipValue(value: number, decimals: number): string {
  const [whole, fraction] = formatNumber(value, decimals).split(",");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped},${fraction}` : grouped;
}

/**
 * Nivo ning standart "lines" qatlami barcha seriyalarni bir xil uzluksiz
 * chiziq bilan chizadi. Prognoz uzuq bo'lishi kerak, shuning uchun qatlam
 * qo'lda yoziladi: bu `defs` naqshlari yoki ikkita alohida grafikdan ancha
 * sodda, `lineGenerator` ni esa nivo tayyor holda uzatadi.
 */
function ForecastLines({
  series,
  lineGenerator,
  lineWidth,
}: LineCustomSvgLayerProps<ForecastSeries>) {
  return (
    <g>
      {series.map((serie) => (
        <path
          key={serie.id}
          d={lineGenerator(serie.data.map((datum) => datum.position)) ?? undefined}
          fill="none"
          stroke={serie.color}
          strokeWidth={lineWidth}
          strokeLinecap="round"
          strokeDasharray={serie.id === FORECAST_ID ? "4 3" : undefined}
        />
      ))}
    </g>
  );
}

/** "lines" o'rniga `ForecastLines` turadi, qolgan tartib nivo standarti. */
const CHART_LAYERS: ReadonlyArray<LineSvgLayer<ForecastSeries>> = [
  "grid",
  "axes",
  ForecastLines,
  "points",
  "mesh",
];

/** Karta tor - o'q matni 9px, chap ustunga 26px yetadi ("1500" + 4px). */
const CHART_MARGIN = { top: 6, right: 6, bottom: 18, left: 26 } as const;

const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 9, fill: "#767676" },
  axis: {
    ticks: { text: { fontSize: 9, fill: "#767676" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#e8e8ec", strokeDasharray: "3 3" } },
} as const;

/** Legendadagi nishon - dumaloq nuqta emas, chiziq turini ko'rsatuvchi shtrix. */
function LegendMark({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <svg width={14} height={6} aria-hidden="true" className="shrink-0">
      <line
        x1={0}
        y1={3}
        x2={14}
        y2={3}
        stroke={color}
        strokeWidth={2}
        strokeDasharray={dashed ? "3 2" : undefined}
      />
    </svg>
  );
}

/**
 * "Prognoz va tahlil" (Bosh sahifa, ~301x262).
 *
 * Quti tor, shuning uchun tana uch qavatga bo'lingan: tab qatori (24px),
 * legenda (~11px) va qolgan joyni egallovchi grafik qatori. O'ngdagi 72px
 * xulosa qutisi grafik kengligidan ajratilgan (`shrink-0`), shunda grafik
 * qanchalik siqilsa ham karta chegarasidan toshib ketmaydi.
 */
export function ForecastCard({ className }: { className?: string }) {
  const [tab, setTab] = useState<TabId>("loss");
  const config = SERIES_BY_TAB[tab];

  const chartData: ForecastSeries[] = [
    {
      id: CURRENT_ID,
      data: MONTHS.map((month, index) => ({ x: month, y: config.current[index] })),
    },
    {
      id: FORECAST_ID,
      data: MONTHS.map((month, index) => ({ x: month, y: config.forecast[index] })),
    },
  ];

  // `ticks` faqat o'qish uchun e'lon qilingan, nivo esa o'zgaruvchan massiv kutadi.
  const tickValues = [...config.ticks];

  /**
   * Shkala chegaralari tik qiymatlariga TENG bo'lsa, eng past nuqta (masalan
   * prognozdagi 9.2%) grafik tagiga yopishib qoladi va nuqta belgisi kesiladi.
   * Shuning uchun domen ikki tomonga bir tik qadamining 20% iga kengaytiriladi;
   * to'r va o'q yorliqlari esa o'zgarishsiz `tickValues` da qoladi.
   */
  const tickStep = tickValues[1] - tickValues[0];
  const yMin = tickValues[0] - tickStep * 0.2;
  const yMax = tickValues[tickValues.length - 1] + tickStep * 0.2;

  return (
    <Card className={className}>
      <CardHeader title="Prognoz va tahlil" />

      <CardBody>
        <div className="flex shrink-0 items-center gap-1">
          {TAB_ORDER.map((id) => {
            const active = id === tab;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(id)}
                className={cn(
                  "flex h-6 shrink-0 items-center rounded-full px-2 text-[10px] font-medium transition-colors",
                  active
                    ? "bg-brand text-white"
                    : "bg-canvas text-ink-muted hover:bg-black/5",
                )}
              >
                {SERIES_BY_TAB[id].label}
              </button>
            );
          })}
        </div>

        <div className="mt-1.5 flex shrink-0 items-center gap-3 text-[9px] text-ink-soft">
          <span className="flex items-center gap-1">
            <LegendMark color={CURRENT_COLOR} />
            {CURRENT_ID}
          </span>
          <span className="flex items-center gap-1">
            <LegendMark color={FORECAST_COLOR} dashed />
            {FORECAST_ID}
          </span>
        </div>

        <div className="mt-1.5 flex min-h-0 flex-1 gap-2">
          <div className="min-w-0 flex-1">
            <ResponsiveLine
              data={chartData}
              margin={CHART_MARGIN}
              xScale={{ type: "point" }}
              yScale={{
                type: "linear",
                min: yMin,
                max: yMax,
                // `nice` domenni yaxlitlab, yuqoridagi kengaytmani yeb qo'yadi.
                nice: false,
              }}
              curve="monotoneX"
              colors={LINE_COLORS}
              lineWidth={2}
              theme={CHART_THEME}
              layers={CHART_LAYERS}
              axisTop={null}
              axisRight={null}
              axisBottom={{ tickSize: 0, tickPadding: 6 }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 4,
                tickValues,
                format: (value: number) => formatNumber(value, config.tickDecimals),
              }}
              enableGridX={false}
              gridYValues={tickValues}
              pointSize={4}
              pointColor="#ffffff"
              pointBorderWidth={1.5}
              pointBorderColor={{ from: "seriesColor" }}
              enableCrosshair={false}
              enableTouchCrosshair={false}
              useMesh
              animate={false}
              tooltip={({ point }) => (
                <div className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-[10px] whitespace-nowrap text-ink shadow-md">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: point.seriesColor }}
                  />
                  <span className="text-ink-soft">{point.seriesId}</span>
                  <span className="font-semibold">
                    {formatTooltipValue(point.data.y, config.valueDecimals)} {config.unit}
                  </span>
                </div>
              )}
            />
          </div>

          {/* Xulosa qutisi sahifaning bosh ko'rsatkichini (yo'qotish prognozini)
              beradi - shuning uchun tanlangan tabga bog'liq emas. */}
          <div className="flex w-[72px] shrink-0 flex-col justify-center gap-1 rounded-lg bg-canvas p-2">
            <span className="text-[9px] text-ink-soft">Kelgusi 3 oyda</span>
            <span className="text-base leading-none font-bold text-ink">7,8%</span>
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-trend-down">
              <Icon icon={ArrowDown} size={12} />
              4,2%
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
