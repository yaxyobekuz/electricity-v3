"use client";

import { type BarCustomLayerProps, ResponsiveBar } from "@nivo/bar";
import { ChartNoAxesColumn, Table } from "lucide-react";
import { useMemo, useState } from "react";

import { compactNumber, finite, niceStep, plainNumber } from "@/components/cards/chart-scale";
import { Card, CardFooterLink, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedIcons } from "@/components/ui/Toggle";
import { cn } from "@/lib/ui/cn";

export interface TopBarItem {
  id: string;
  /** Chap ustundagi nom: "Chinobod", "Xaqulobod". */
  label: string;
  /** Shkaladagi qiymat (`unit` birligida, manfiy bo'lishi mumkin). */
  value: number;
}

/** Nivo'ga uzatiladigan qator (`BarDatum` talabi uchun `type`, `interface` emas). */
type BarRow = { id: string; label: string; value: number };

/**
 * Maketdagi o'lchamlar (Figma `4216:57`, "BarLineChart" 454.67x218, ichki
 * blok 8px pastda):
 *
 *   yAxisTop   15px  - qiymat o'qi YUQORIDA (0 / 20 / ... / max)
 *   MainChart  195px - chapda yorliq ustuni (59 / 66 / 46px), o'ngda 4px,
 *              qolgani ustunlar maydoni
 *   yorliq     ustun chetidan 2px chapda tugaydi
 *   ustun      qator qadamining 40.37% i (2 ta qatorda 39.36/97.5,
 *              6 ta qatorda 13.12/32.5), qator ichida markazda
 */
const AXIS_HEIGHT = 15;
const PLOT_HEIGHT = 195;
const CHART_RIGHT = 4;
const LABEL_GAP = 2;
const BAR_SHARE = 0.4037;

/**
 * Nivo'da band shkalaning `padding` i ichki va tashqi bo'shliqni TENG
 * qiladi, maketda esa ustun qator qadamining markazida - tashqi bo'shliq
 * ichkisining yarmi. Farqni nivo'ning ichki maydonini yuqori va pastga
 * `padding * qadam / 2` ga cho'zib yo'qotamiz: shunda nivo qadami maketdagi
 * `195 / n` ga, birinchi ustun esa aynan o'z qatorining markaziga tushadi.
 * O'q va tik chiziqlar maydonga bog'liq bo'lgani uchun `ScaleLayer` chizadi.
 */
const BAR_PADDING = 1 - BAR_SHARE;

/** Avtomatik shkalada bo'linmalar soni (maketda 5..8). */
const AUTO_STEPS = 5;
/** Noto'g'ri `tickStep` da cheksiz yorliq chizilmasin. */
const MAX_TICKS = 20;

/**
 * Maketda o'q va yorliq matni 12px (qutisi 15px: "100" - 21px, "Chinobod" -
 * 55px), rangi #4d4d4d; to'r - #d9d9dd.
 */
const AXIS_TEXT = { fill: "#4d4d4d", fontSize: 12 } as const;
const GRID_COLOR = "#d9d9dd";

const CHART_THEME = {
  text: { fontFamily: "inherit", ...AXIS_TEXT },
  axis: {
    ticks: { text: AXIS_TEXT },
    domain: { line: { stroke: "transparent" } },
  },
} as const;

/**
 * Tik to'r chiziqlari va yuqoridagi qiymat o'qi. `inset` - nivo ichki
 * maydonining tepasidan haqiqiy (195px) maydongacha bo'lgan masofa.
 */
function scaleLayer(tickValues: readonly number[], inset: number) {
  return function ScaleLayer({ xScale }: BarCustomLayerProps<BarRow>) {
    const scale = xScale as (value: number) => number;
    return (
      <g>
        {tickValues.map((value) => {
          const x = scale(value);
          return (
            <g key={value}>
              <line x1={x} x2={x} y1={inset} y2={inset + PLOT_HEIGHT} stroke={GRID_COLOR} />
              {/* Yorliq 15px lik o'q qatorining markazida (maketda quti maydonga tegib turadi). */}
              <text
                x={x}
                y={inset - AXIS_HEIGHT / 2}
                textAnchor="middle"
                dominantBaseline="central"
                style={AXIS_TEXT}
              >
                {compactNumber(value)}
              </text>
            </g>
          );
        })}
      </g>
    );
  };
}

/**
 * Shkala: berilgan `max` / `tickStep` yoki qiymatlardan yaxlit chegara.
 * Nol doim ichida; manfiy qiymat bo'lsa shkala chapga cho'ziladi.
 */
function buildScale(values: readonly number[], max?: number, tickStep?: number) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const step =
    tickStep && tickStep > 0 && Number.isFinite(tickStep)
      ? tickStep
      : niceStep((Math.max(hi, max ?? 0) - lo) / AUTO_STEPS);
  const bottom = lo < 0 ? Math.floor(lo / step) * step : 0;
  const top = Math.max(
    max && Number.isFinite(max) ? max : 0,
    Math.ceil(hi / step) * step,
    bottom + step,
  );
  const count = Math.min(MAX_TICKS, Math.floor((top - bottom) / step + 1e-9));
  const ticks = Array.from({ length: count + 1 }, (_, index) =>
    Number((bottom + index * step).toPrecision(12)),
  );
  return { min: bottom, max: top, ticks };
}

type View = "chart" | "table";

const VIEWS = [
  { value: "chart", Icon: ChartNoAxesColumn, label: "Grafik" },
  { value: "table", Icon: Table, label: "Jadval" },
] as const satisfies ReadonlyArray<{ value: View; Icon: typeof Table; label: string }>;

/**
 * "Eng ko'p sarfga ega ..." kartasi - gorizontal ustunli diagramma.
 *
 * Bosh sahifada uch marta ishlatiladi (podstansiyalar, fiderlar,
 * transformatorlar), maketda ular faqat ma'lumot, shkala chegarasi va yorliq
 * ustunining kengligi bilan farq qiladi, shuning uchun komponent bitta.
 * `max` / `tickStep` berilmasa - qiymatlardan hisoblanadi.
 */
export function TopBarsCard({
  title,
  items,
  max,
  tickStep,
  unit,
  labelWidth = 59,
  valueColumn,
  footerLabel,
  footerHref,
  emptyText = "Ma’lumot yo’q",
  className,
}: {
  title: string;
  items: readonly TopBarItem[];
  /** Maketdagi `xAxis` kengligi - eng uzun nomga qarab 46 / 59 / 66px. */
  labelWidth?: number;
  /** Shkalaning yuqori chegarasi; berilmasa avtomatik. */
  max?: number;
  /** O'q bo'linmasi orasidagi qadam; berilmasa avtomatik. */
  tickStep?: number;
  /** Qiymat yonidagi birlik: "mln kWh". */
  unit: string;
  /** Jadvaldagi qiymat ustuni nomi; standart - `Sarf, <unit>`. */
  valueColumn?: string;
  footerLabel?: string;
  /** Berilmasa footer havolasi chizilmaydi. */
  footerHref?: string;
  emptyText?: string;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");

  // Nivo gorizontal ustunlarni pastdan yuqoriga chizadi - maketdagi tartib
  // saqlanishi uchun ro'yxat teskari uzatiladi.
  const chartData = useMemo(
    () =>
      [...items].reverse().map(
        (item): BarRow => ({ id: item.id, label: item.label, value: finite(item.value) }),
      ),
    [items],
  );

  const nameById = useMemo<Record<string, string>>(
    () => Object.fromEntries(items.map((item) => [item.id, item.label])),
    [items],
  );

  const scale = useMemo(
    () => buildScale(chartData.map((row) => row.value), max, tickStep),
    [chartData, max, tickStep],
  );

  const columns: TableColumn[] = [
    { key: "name", label: "Nomi", grow: 3, align: "left" },
    { key: "value", label: valueColumn ?? `Sarf, ${unit}`, grow: 2 },
  ];

  // Maketdagi qator qadami va shundan nivo maydoni qancha cho'zilishi.
  const inset = (BAR_PADDING * (PLOT_HEIGHT / Math.max(items.length, 1))) / 2;
  const layers = useMemo(
    () => [scaleLayer(scale.ticks, inset), "bars" as const, "axes" as const],
    [scale.ticks, inset],
  );

  const empty = items.length === 0;

  return (
    <Card padded={false} className={cn("px-4 pt-4 pb-2", className)}>
      <CardHeader title={title}>
        {empty ? null : <SegmentedIcons items={VIEWS} value={view} onChange={setView} />}
      </CardHeader>

      {/* Maketda diagramma bloki sarlavha tagida (y=48), ichki qismi esa 8px
          pastda. O'ng chetdagi "100" / "200" yorlig'i tik ustida markazlashadi
          va 4px lik chekkadan chiqadi - kesilmasligi uchun overflow ochiq. */}
      <div className="min-h-0 flex-1 pt-2 [&_svg]:overflow-visible">
        {empty ? (
          <EmptyState variant="inline" action={false} title={emptyText} />
        ) : view === "chart" ? (
          <ResponsiveBar
            data={chartData}
            keys={["value"]}
            indexBy="id"
            layout="horizontal"
            margin={{
              top: AXIS_HEIGHT - inset,
              right: CHART_RIGHT,
              bottom: -inset,
              left: labelWidth,
            }}
            padding={BAR_PADDING}
            colors={["#007cd2"]}
            borderRadius={2}
            valueScale={{ type: "linear", min: scale.min, max: scale.max }}
            layers={layers}
            axisTop={null}
            axisBottom={null}
            axisRight={null}
            axisLeft={{
              tickSize: 0,
              tickPadding: LABEL_GAP,
              format: (value: string) => nameById[value] ?? value,
            }}
            enableLabel={false}
            theme={CHART_THEME}
            animate={false}
            tooltip={({ data, color }) => (
              <div className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-[11px] whitespace-nowrap text-ink shadow-md">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-ink-soft">{String(data.label)}</span>
                <span className="font-semibold">
                  {plainNumber(Number(data.value))} {unit}
                </span>
              </div>
            )}
          />
        ) : (
          <div className="scrollbar-none h-full overflow-y-auto">
            <DataTable
              className="leading-tight"
              columns={columns}
              rows={items.map((item) => ({
                key: item.id,
                cells: [
                  <span key="name" className="font-medium">
                    {item.label}
                  </span>,
                  plainNumber(item.value),
                ],
              }))}
            />
          </div>
        )}
      </div>

      {footerHref && footerLabel ? (
        <CardFooterLink href={footerHref}>{footerLabel}</CardFooterLink>
      ) : null}
    </Card>
  );
}
