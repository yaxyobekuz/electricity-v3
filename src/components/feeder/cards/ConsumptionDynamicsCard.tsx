"use client";

import { ResponsiveLine } from "@nivo/line";
import { ChartNoAxesColumn, FileDown, Table } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn, type TableRow } from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";
import { type SegmentItem, SegmentedIcons } from "@/components/ui/Toggle";
import { cn } from "@/lib/ui/cn";

type ViewMode = "chart" | "table";
type MetricId = "billed" | "consumed" | "loss";

interface DayRow {
  day: number;
  billed: number;
  consumed: number;
  loss: number;
}

/**
 * Maketdagi egri chiziqlarning tugun koordinatalaridan teskari hisoblangan
 * qiymatlar (o'q 0 / 500 / 2000 da teng bo'linadi - pastdagi symlog shkala).
 */
const DAYS: readonly DayRow[] = [
  { day: 1, billed: 1146, consumed: 27, loss: 236 },
  { day: 2, billed: 1836, consumed: 600, loss: 67 },
  { day: 3, billed: 128, consumed: 1791, loss: 563 },
  { day: 4, billed: 16, consumed: 147, loss: 159 },
  { day: 5, billed: 937, consumed: 408, loss: 415 },
  { day: 6, billed: 578, consumed: 765, loss: 24 },
  { day: 7, billed: 1008, consumed: 298, loss: 209 },
];

const SERIES = [
  {
    id: "billed",
    label: "Hisoblangan",
    total: "1,234 mln kWh",
    color: "#467acf",
  },
  {
    id: "consumed",
    label: "Iste’mol",
    total: "1,020 mln kWh",
    color: "#46cf61",
  },
  { id: "loss", label: "Yo’qotish", total: "0,214 mln kWh", color: "#cf4646" },
] as const satisfies ReadonlyArray<{
  id: MetricId;
  label: string;
  total: string;
  color: string;
}>;

const CHART_DATA = SERIES.map((series) => ({
  id: series.label,
  data: DAYS.map((row) => ({ x: row.day, y: row[series.id] })),
}));

const LINE_COLORS = SERIES.map((series) => series.color);

/**
 * Maketda o'q yorliqlari 0 / 500 / 2000 da **teng** oraliqda turadi, ya'ni
 * shkala chiziqli emas. `symlog` + constant 250 aynan shuni beradi:
 * ln(1+500/250) / ln(1+2000/250) = 1/2.
 */
const Y_SCALE = {
  type: "symlog",
  constant: 250,
  min: 0,
  max: 2000,
  nice: false,
} as const;

/**
 * Grafik chekkalari: chapda o'q ustuni 33px (Figma `yAxisLeft`), o'ngda
 * 28px, tepada 6px, pastda 24px yorliq qatori + 4px oraliq.
 */
const CHART_MARGIN = { top: 6, right: 28, bottom: 28, left: 33 } as const;

/** Maketda o'q matni 10px, rangi #4d4d4d (yorliq ustunidagi #999999 emas). */
const AXIS_FONT_SIZE = 10;
const AXIS_TEXT_COLOR = "#4d4d4d";

/** Figma theme: o'q matni #4d4d4d/10px, to'r - 2/2 uzuq #d9d9dd. */
const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: AXIS_FONT_SIZE, fill: AXIS_TEXT_COLOR },
  axis: {
    ticks: { text: { fill: AXIS_TEXT_COLOR, fontSize: AXIS_FONT_SIZE } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#d9d9dd", strokeDasharray: "2 2" } },
} as const;

/** Pastki o'q chizig'i maketda uzluksiz va to'qroq - grid uslubiga sig'maydi. */
function BaselineRule({
  innerWidth,
  innerHeight,
}: {
  innerWidth: number;
  innerHeight: number;
}) {
  return (
    <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="#b3b3bb" />
  );
}

/**
 * Maketda x yorliqlari tugun ustida turmaydi: `xAxis` (Figma `4029:1310`)
 * butun grafik kengligini 7 ta teng "xLabelBox" ga bo'ladi (birinchisi
 * x=1.02 dan, har biri 49.23px) va raqam quti markazida turadi. Nivo'ning
 * `axisBottom` i yorliqni nuqta ustiga qo'yadi - farq chekkalarda 7px gacha,
 * shuning uchun qatorni alohida qatlam chizadi.
 */
const X_LABEL_INSET = 1.024;
/** Yorliq qutisining tepasi 0 chizig'idan 4px pastda. */
const X_LABEL_GAP = 4;

function XAxisLabels({
  innerWidth,
  innerHeight,
}: {
  innerWidth: number;
  innerHeight: number;
}) {
  const chartWidth = innerWidth + CHART_MARGIN.left + CHART_MARGIN.right;
  const boxWidth = (chartWidth - X_LABEL_INSET) / DAYS.length;

  return (
    <g transform={`translate(0,${innerHeight + X_LABEL_GAP})`}>
      {DAYS.map((row, index) => (
        <text
          key={row.day}
          x={X_LABEL_INSET + boxWidth * (index + 0.5) - CHART_MARGIN.left}
          textAnchor="middle"
          dominantBaseline="text-before-edge"
          fill={AXIS_TEXT_COLOR}
          style={{ fontSize: AXIS_FONT_SIZE }}
        >
          {row.day}
        </text>
      ))}
    </g>
  );
}

const VIEW_ITEMS: ReadonlyArray<SegmentItem<ViewMode>> = [
  { value: "chart", Icon: ChartNoAxesColumn, label: "Grafik" },
  { value: "table", Icon: Table, label: "Jadval" },
];

/** Tanlangan oraliq: 7 kun maketda yo'lakning 27.7% ini egallaydi. */
const RANGES = [
  { days: 7, label: "7 kun", width: "27.7%" },
  { days: 14, label: "14 kun", width: "55.4%" },
  { days: 30, label: "30 kun", width: "100%" },
] as const;

const COLUMNS: TableColumn[] = [
  { key: "day", label: "Kun", grow: 12 },
  { key: "billed", label: "Hisoblangan", grow: 24 },
  { key: "consumed", label: "Iste’mol", grow: 24 },
  { key: "loss", label: "Yo’qotish", grow: 24 },
];

const ROWS: TableRow[] = DAYS.map((row) => ({
  key: String(row.day),
  cells: [
    <span key="day" className="font-medium">
      {row.day}
    </span>,
    row.billed,
    row.consumed,
    row.loss,
  ],
}));

/**
 * "Iste'mol dinamikasi" kartasi (Figma `4029:1221`, 487x298).
 *
 * Tana 200px: chapda 345.67px grafik (o'q uchun 33px chap, 28px o'ng chekka),
 * o'ngda 109px yorliq ustuni. Pastda 18px oraliq yo'lagi.
 */
export function ConsumptionDynamicsCard({ className }: { className?: string }) {
  const [view, setView] = useState<ViewMode>("chart");
  const [rangeIndex, setRangeIndex] = useState(0);
  const range = RANGES[rangeIndex];

  // Ikkala tutqich ham bir xil ishlaydi: oraliqni aylantirib almashtiradi.
  const cycleRange = () => setRangeIndex((index) => (index + 1) % RANGES.length);

  return (
    <Card className={className}>
      <CardHeader title="Iste’mol dinamikasi">
        <SegmentedIcons items={VIEW_ITEMS} value={view} onChange={setView} />
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody>
        {view === "chart" ? (
          <>
            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1">
                <ResponsiveLine
                  data={CHART_DATA}
                  margin={CHART_MARGIN}
                  xScale={{ type: "point" }}
                  yScale={Y_SCALE}
                  curve="monotoneX"
                  colors={LINE_COLORS}
                  lineWidth={2}
                  theme={CHART_THEME}
                  axisTop={null}
                  axisRight={null}
                  // x yorliqlarini `XAxisLabels` chizadi (maketda ular nuqta ustida emas).
                  axisBottom={null}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 4,
                    tickValues: [0, 500, 2000],
                  }}
                  // 0 chizig'ini `BaselineRule` chizadi, shuning uchun to'rda yo'q.
                  gridYValues={[500, 2000]}
                  layers={[
                    "grid",
                    "axes",
                    BaselineRule,
                    XAxisLabels,
                    "lines",
                    "points",
                    "mesh",
                  ]}
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
                      <span className="text-ink-soft">{point.seriesId}</span>
                      <span className="font-semibold">{point.data.yFormatted}</span>
                    </div>
                  )}
                />
              </div>

              {/* Yorliq ustuni: 109px, 35px qatorlar, oralig'i 8px */}
              <div className="flex w-[109px] shrink-0 flex-col justify-center gap-2">
                {SERIES.map((series) => (
                  <div key={series.id} className="flex h-[35px] items-center gap-2.5">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: series.color }}
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-[10px] leading-[13px] text-[#999999]">
                        {series.label}
                      </span>
                      <span className="mt-1.5 block truncate text-xs leading-4 font-semibold text-ink">
                        {series.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Oraliq yo'lagi (Figma "Slider", 18px) */}
            <div className="relative mt-2 h-[18px] w-full shrink-0 rounded-full bg-tint-blue">
              <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-[#d5eafc]" />
              {/* Fon yarim shaffof - ostidagi chiziq maketdagidek to'qroq ko'rinadi */}
              <div
                className="absolute inset-y-0 left-1.5 rounded-sm border border-solid border-brand bg-[#49abf5]/30"
                style={{ width: `calc(${range.width} - 12px)` }}
              >
                <span className="flex h-full items-center justify-center text-[11px] font-medium text-brand">
                  {range.label}
                </span>
                {(["left", "right"] as const).map((side) => (
                  <button
                    key={side}
                    type="button"
                    onClick={cycleRange}
                    aria-label={`Oraliqni o’zgartirish (${range.label})`}
                    className={cn(
                      "absolute top-1/2 flex size-3 -translate-y-1/2 items-center justify-center rounded-[3px] bg-surface shadow-sm",
                      side === "left"
                        ? "left-0 -translate-x-1/2"
                        : "right-0 translate-x-1/2",
                    )}
                  >
                    <span className="block h-1 w-px bg-[#dddddd]" />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
            <DataTable columns={COLUMNS} rows={ROWS} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
