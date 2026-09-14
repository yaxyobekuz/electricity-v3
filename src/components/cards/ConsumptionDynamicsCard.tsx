"use client";

import { type LineCustomSvgLayerProps, ResponsiveLine } from "@nivo/line";
import { ChartNoAxesColumn, Table } from "lucide-react";
import { useMemo, useState } from "react";

import { compactNumber, finite, linearScale } from "@/components/cards/chart-scale";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn, type TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { type SegmentItem, SegmentedIcons } from "@/components/ui/Toggle";
import { energy, monthShort, num, parseMonthKey } from "@/lib/format";

type ViewMode = "chart" | "table";
export type MetricId = "billed" | "consumed" | "loss";

/** Seriya nomlari: legenda, jadval ustunlari va tultip uchun. */
export type DynamicsLabels = Record<MetricId, string>;

/** Shablondagi ustun nomlari. */
const DEFAULT_LABELS: DynamicsLabels = {
  billed: "Umumiy oqim",
  consumed: "Foydali oqim",
  loss: "Yo’qotish",
};

/**
 * Dinamikaning bitta nuqtasi - bitta hisobot oyi (kWh).
 *
 * Ro'yxatda faqat ma'lumoti bor oylar bo'ladi, shuning uchun oraliqda
 * bo'shliq bo'lishi va 12 kalendar oydan uzoqqa cho'zilishi mumkin. Grafik
 * buni yashirmaydi: nuqtalar kalendar bo'yicha joylashadi (ma'lumotsiz oy -
 * bo'sh oraliq, chiziq uziladi), seriya bir necha yilni qamrasa oy nomi
 * ostida yil ham yoziladi (birinchi yorliqda va yil almashganda).
 */
export interface DynamicsMonth {
  /**
   * "2026-09" (`monthKey`), eskidan yangiga - o'qdagi qisqa nom ("Sen"),
   * yil va kalendar o'rni shundan olinadi. Kalit shu ko'rinishda bo'lmasa
   * yoki o'sib bormasa, nuqtalar teng oraliqda va `label` bilan chiziladi.
   */
  key: string;
  /** "Sentabr 2026" - legenda, jadval va tultipda. */
  label: string;
  /** Umumiy oqim */
  billed: number;
  /** Foydali oqim */
  consumed: number;
  /** Yo'qotish - manfiy bo'lishi mumkin. */
  loss: number;
}

const SERIES = [
  { id: "billed", color: "#467acf" },
  { id: "consumed", color: "#46cf61" },
  { id: "loss", color: "#cf4646" },
] as const satisfies ReadonlyArray<{ id: MetricId; color: string }>;

const LINE_COLORS = SERIES.map((series) => series.color);

/** Nivo seriyasi: `x` - oyning o'qdagi o'rni, `y` - kWh (`null` - chiziq uzilishi). */
type ChartSeries = { id: string; data: { x: number; y: number | null }[] };
type LayerProps = LineCustomSvgLayerProps<ChartSeries>;

/** O'q maksimal 4 bo'linmaga yaqin: 166px balandlikda yorliqlar tiqilmaydi. */
const Y_STEPS = 4;

/**
 * Grafik chekkalari: chapda o'q ustuni 33px (Figma `yAxisLeft`), o'ngda
 * 28px, tepada 6px, pastda 24px yorliq qatori + 4px oraliq.
 */
const CHART_MARGIN = { top: 6, right: 28, bottom: 28, left: 33 } as const;

/** Maketda o'q matni 10px, rangi #4d4d4d (yorliq ustunidagi #999999 emas). */
const AXIS_FONT_SIZE = 10;
const AXIS_TEXT_COLOR = "#4d4d4d";
const BASELINE_COLOR = "#b3b3bb";

/** Figma theme: o'q matni #4d4d4d/10px, to'r - 2/2 uzuq #d9d9dd. */
const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: AXIS_FONT_SIZE, fill: AXIS_TEXT_COLOR },
  axis: {
    ticks: { text: { fill: AXIS_TEXT_COLOR, fontSize: AXIS_FONT_SIZE } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#d9d9dd", strokeDasharray: "2 2" } },
} as const;

/**
 * Maketda tik to'r chiziqlari (`yLines`, Figma `4029:1249`) grafik
 * balandligini to'liq egallamaydi: yuqoridan ham, pastdan ham 9.26px
 * ichkarida turadi. Nivo'ning `enableGridX` i ularni butun balandlikka
 * tortadi, shuning uchun u o'chirilib, qator alohida qatlam sifatida chiziladi.
 */
const X_GRID_INSET = 9.26;
/** Yorliq qutisining tepasi pastki chiziqdan 4px pastda. */
const X_LABEL_GAP = 4;
/**
 * Yil qatori oy nomidan 12px pastda: ikkala qator 28px lik pastki chekkaga
 * sig'adi va chap o'qdagi eng pastki yorliqqa tegmaydi.
 */
const X_YEAR_OFFSET = 12;
const X_YEAR_COLOR = "#999999";
/** "2026" 10px da ~24px - yorliqlar orasida kamida shuncha joy bo'lsin. */
const X_LABEL_MIN_SPACE = 26;

/** O'qdagi oy: kalendar o'rni, qisqa nomi va yili. */
interface AxisMonth {
  month: DynamicsMonth;
  /** O'qdagi o'rni: oy tartib raqami (yil * 12 + oy) yoki oddiy indeks. */
  x: number;
  /** "Sen"; kalit "YYYY-MM" bo'lmasa - to'liq yorliq. */
  short: string;
  /** Kalendar rejimida yil, aks holda `null`. */
  year: number | null;
}

/**
 * Oylarning o'qdagi o'rni. Barcha kalitlar "YYYY-MM" va o'sib borsa - oy
 * tartib raqami: ma'lumotsiz oylar teng oraliqqa qisilmay, bo'sh joy bo'lib
 * qoladi. Aks holda nuqtalar teng oraliqda (0, 1, 2...).
 */
function toAxisMonths(months: readonly DynamicsMonth[]): AxisMonth[] {
  const dates = months.map((month) => parseMonthKey(month.key));
  const ordinals = dates.flatMap((date) =>
    date ? [date.getUTCFullYear() * 12 + date.getUTCMonth()] : [],
  );
  const calendar =
    ordinals.length === months.length &&
    ordinals.every((value, index) => index === 0 || value > ordinals[index - 1]);

  return months.map((month, index) => {
    const date = dates[index];
    return {
      month,
      x: calendar ? ordinals[index] : index,
      short: date ? monthShort(date) : month.label,
      year: calendar && date ? date.getUTCFullYear() : null,
    };
  });
}

/**
 * Yorliqli oylar. Sanash oxirgi (tanlangan) oydan boshlanadi - u doim
 * yorliqli; qolganlari oldingi yorliqdan kamida `X_LABEL_MIN_SPACE` uzoqda
 * bo'lsa chiziladi (oraliqlar notekis bo'lishi mumkin).
 */
function visibleAxisMonths(
  axis: readonly AxisMonth[],
  xScale: (value: number) => number,
): AxisMonth[] {
  const kept: AxisMonth[] = [];
  let lastX = Number.POSITIVE_INFINITY;
  for (let index = axis.length - 1; index >= 0; index -= 1) {
    const x = xScale(axis[index].x);
    if (lastX - x >= X_LABEL_MIN_SPACE) {
      kept.unshift(axis[index]);
      lastX = x;
    }
  }
  return kept;
}

/**
 * Pastki chiziq va (manfiy yo'qotish bo'lsa) nol chizig'i. Maketda ular
 * uzluksiz va to'qroq - grid uslubiga sig'maydi.
 */
function baselineLayer(hasNegative: boolean) {
  return function BaselineRule({ innerWidth, innerHeight, yScale }: LayerProps) {
    const zero = yScale(0);
    return (
      <g stroke={BASELINE_COLOR}>
        <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} />
        {hasNegative ? <line x1={0} x2={innerWidth} y1={zero} y2={zero} /> : null}
      </g>
    );
  };
}

/**
 * Tik to'r chiziqlari va oy yorliqlari - nuqtalar ustida. Seriya bir necha
 * yilni qamrasa, birinchi yorliq va yil almashgan yorliq ostida yil yoziladi
 * - aks holda ikki xil yilning "Sen"ini ajratib bo'lmaydi.
 */
function monthAxisLayer(axis: readonly AxisMonth[]) {
  const firstYear = axis[0]?.year ?? null;
  const multiYear = firstYear !== null && axis.some((item) => item.year !== firstYear);

  return function MonthAxis({ innerHeight, xScale }: LayerProps) {
    const visible = visibleAxisMonths(axis, xScale);

    return (
      <g>
        {/* `strokeDashoffset` uzuq naqshni maydon tepasiga bog'laydi - maketdagidek. */}
        <g stroke="#d9d9dd" strokeDasharray="2 2" strokeDashoffset={X_GRID_INSET}>
          {visible.map((item) => (
            <line
              key={item.month.key}
              x1={xScale(item.x)}
              x2={xScale(item.x)}
              y1={X_GRID_INSET}
              y2={Math.max(X_GRID_INSET, innerHeight - X_GRID_INSET)}
            />
          ))}
        </g>
        <g transform={`translate(0,${innerHeight + X_LABEL_GAP})`}>
          {visible.map((item, index) => {
            const showYear =
              multiYear &&
              item.year !== null &&
              (index === 0 || visible[index - 1].year !== item.year);
            return (
              <g key={item.month.key}>
                <text
                  x={xScale(item.x)}
                  textAnchor="middle"
                  dominantBaseline="text-before-edge"
                  fill={AXIS_TEXT_COLOR}
                  style={{ fontSize: AXIS_FONT_SIZE }}
                >
                  {item.short}
                </text>
                {showYear ? (
                  <text
                    x={xScale(item.x)}
                    y={X_YEAR_OFFSET}
                    textAnchor="middle"
                    dominantBaseline="text-before-edge"
                    fill={X_YEAR_COLOR}
                    style={{ fontSize: AXIS_FONT_SIZE }}
                  >
                    {item.year}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </g>
    );
  };
}

const VIEW_ITEMS: ReadonlyArray<SegmentItem<ViewMode>> = [
  { value: "chart", Icon: ChartNoAxesColumn, label: "Grafik" },
  { value: "table", Icon: Table, label: "Jadval" },
];

function buildColumns(labels: DynamicsLabels): TableColumn[] {
  return [
    { key: "month", label: "Oy", grow: 20 },
    { key: "billed", label: `${labels.billed}, kWh`, grow: 24 },
    { key: "consumed", label: `${labels.consumed}, kWh`, grow: 24 },
    { key: "loss", label: `${labels.loss}, kWh`, grow: 24 },
  ];
}

function buildRows(months: readonly DynamicsMonth[]): TableRow[] {
  return months.map((month) => ({
    key: month.key,
    cells: [
      <span key="month" className="font-medium">
        {month.label}
      </span>,
      num(month.billed),
      num(month.consumed),
      num(month.loss),
    ],
  }));
}

/**
 * Oqim dinamikasi kartasi (Figma `4029:1221`, 487x298).
 *
 * Tana 200px: chapda grafik (o'q uchun 33px chap, 28px o'ng chekka), o'ngda
 * 109px yorliq ustuni. Nuqtalar - tanlangan oy va undan oldingi, ma'lumoti
 * bor oylar (1..12 ta, eskidan yangiga). Legendada oxirgi nuqta, ya'ni
 * tanlangan oy qiymatlari.
 *
 * Shkala chiziqli va nolni o'z ichiga oladi; yo'qotish manfiy bo'lsa o'q
 * pastga cho'ziladi va nol chizig'i chiziladi.
 */
export function ConsumptionDynamicsCard({
  title = "Oqim dinamikasi",
  labels = DEFAULT_LABELS,
  months,
  className,
}: {
  title?: string;
  labels?: DynamicsLabels;
  /** 1..12 ta oy, eskidan yangiga. Bo'sh - karta bo'sh holatda. */
  months: readonly DynamicsMonth[];
  className?: string;
}) {
  const [view, setView] = useState<ViewMode>("chart");

  const scale = useMemo(
    () =>
      linearScale(
        months.flatMap((month) => [month.billed, month.consumed, month.loss]),
        Y_STEPS,
      ),
    [months],
  );

  const axis = useMemo(() => toAxisMonths(months), [months]);

  const chartData = useMemo<ChartSeries[]>(
    () =>
      SERIES.map((series) => ({
        id: labels[series.id],
        data: axis.flatMap((item, index) => {
          const datum = { x: item.x, y: finite(item.month[series.id]) };
          const next = axis[index + 1];
          // Orada ma'lumotsiz oy bor - chiziq uziladi, qiymat "to'ldirilmaydi".
          return next && next.x - item.x > 1 ? [datum, { x: item.x + 1, y: null }] : [datum];
        }),
      })),
    [axis, labels],
  );

  const xScaleSpec = useMemo(
    () => ({
      type: "linear" as const,
      min: axis[0]?.x ?? 0,
      max: axis.at(-1)?.x ?? 0,
      nice: false,
    }),
    [axis],
  );

  const labelByX = useMemo<Record<string, string>>(
    () => Object.fromEntries(axis.map((item) => [String(item.x), item.month.label])),
    [axis],
  );

  const chartLayers = useMemo(
    () => [
      "grid" as const,
      monthAxisLayer(axis),
      "axes" as const,
      baselineLayer(scale.min < 0),
      "lines" as const,
      "points" as const,
      "mesh" as const,
    ],
    [axis, scale.min],
  );

  const columns = useMemo(() => buildColumns(labels), [labels]);
  const rows = useMemo(() => buildRows(months), [months]);

  const latest = months.at(-1);

  return (
    <Card className={className}>
      <CardHeader title={title}>
        {latest ? <SegmentedIcons items={VIEW_ITEMS} value={view} onChange={setView} /> : null}
      </CardHeader>

      <CardBody>
        {!latest ? (
          <EmptyState variant="inline" action={false} title="Oqim ma’lumoti yuklanmagan" />
        ) : view === "chart" ? (
          <div className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              <ResponsiveLine
                data={chartData}
                margin={CHART_MARGIN}
                // Kalendar o'rni: ma'lumotsiz oylar teng oraliqqa qisilmaydi.
                xScale={xScaleSpec}
                yScale={{ type: "linear", min: scale.min, max: scale.max, nice: false }}
                yFormat={(value) => energy(Number(value))}
                curve="monotoneX"
                colors={LINE_COLORS}
                lineWidth={2}
                theme={CHART_THEME}
                axisTop={null}
                axisRight={null}
                // x yorliqlari va tik to'rni `monthAxisLayer` chizadi.
                axisBottom={null}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 4,
                  tickValues: scale.ticks,
                  format: (value: number) => compactNumber(value),
                }}
                // Pastki (va nol) chiziqni `baselineLayer` chizadi, shuning uchun to'rda yo'q.
                gridYValues={scale.ticks.filter(
                  (value) => value !== scale.min && !(scale.min < 0 && value === 0),
                )}
                enableGridX={false}
                layers={chartLayers}
                pointSize={6}
                pointColor="#ffffff"
                pointBorderWidth={2}
                pointBorderColor={{ from: "seriesColor" }}
                enableTouchCrosshair={false}
                enableCrosshair={false}
                useMesh
                isInteractive
                animate={false}
                tooltip={({ point }) => (
                  <div className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-[11px] whitespace-nowrap text-ink shadow-md">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: point.seriesColor }}
                    />
                    <span className="text-ink-soft">
                      {labelByX[String(point.data.x)]} · {point.seriesId}
                    </span>
                    <span className="font-semibold">{point.data.yFormatted}</span>
                  </div>
                )}
              />
            </div>

            {/* Yorliq ustuni: 109px, tepada tanlangan oy, 35px qatorlar, oralig'i 8px */}
            <div className="flex w-[109px] shrink-0 flex-col justify-center gap-2">
              <span className="truncate text-[10px] leading-[13px] font-medium text-ink-soft">
                {latest.label}
              </span>
              {SERIES.map((series) => (
                <div key={series.id} className="flex h-[35px] items-center gap-2.5">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: series.color }}
                  />
                  <div className="min-w-0">
                    <span className="block truncate text-[10px] leading-[13px] text-[#999999]">
                      {labels[series.id]}
                    </span>
                    <span className="mt-1.5 block truncate text-xs leading-4 font-semibold text-ink">
                      {energy(latest[series.id])}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
            <DataTable columns={columns} rows={rows} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
