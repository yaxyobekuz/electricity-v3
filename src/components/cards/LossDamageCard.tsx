"use client";

import {
  type ComputedBar,
  type RadialBarCustomLayerProps,
  ResponsiveRadialBar,
} from "@nivo/radial-bar";
import { ChartNoAxesColumn, Table } from "lucide-react";
import { useMemo, useState } from "react";

import { finite, fixedScale, moneyUnit, plainNumber } from "@/components/cards/chart-scale";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedIcons } from "@/components/ui/Toggle";
import { money } from "@/lib/format";

/** Zarar bo'lagi - qoidabuzar turi bo'yicha Σ "Keltirilgan zarar miqdori (UZS)". */
export interface DamageKind {
  id: string;
  /** "Yuridik", "Jismoniy", "Aybisiz" (`VIOLATOR_TYPE_LABEL`). */
  label: string;
  /** So'm. */
  value: number;
  color: string;
}

/** Halqa 0 dan `max` gacha 270 gradusni supuradi (nivo standarti). */
const END_ANGLE = 270;
/** O'q 8 ta teng bo'linmaga ajratilgan (maketda 0..200, qadam 25). */
const TICK_STEPS = 8;

const GRID_COLOR = "#dddddd";
/** Maketda qutb aylanalari nurlardan ochiqroq (1px chiziqda ~19 birlik siyoh). */
const GRID_CIRCLE_COLOR = "#ececec";
const AXIS_TEXT_COLOR = "#767676";
const TRACK_COLOR = "#f3f3f3";

/**
 * Maketda qutb o'qi ustunlardan tashqarida turadi (ustun radiusi 66px,
 * aylana 69px, nur uchi 78px, nur boshi va ichki aylana 20px), nivo esa
 * o'qni aynan `outerRadius`da chizadi - shuning uchun nisbatlar qo'lda.
 */
const AXIS_CIRCLE_RATIO = 1.048;
const TICK_END_RATIO = 1.185;
const GRID_INNER_RATIO = 0.305;
/**
 * Maketda yorliq quticha markazi emas, tashqi cheti 73px radiusda turadi
 * (o'ngda chap chet, chapda o'ng chet) - shuning uchun alohida radius.
 */
const LABEL_RADIUS_RATIO = 1.105;
/** Shu qiymatdan past `sin` da yorliq markazlanadi (0 va 125 bo'linmalari). */
const LABEL_CENTER_SIN = 0.2;
/** Oy nomi markazdan chapga-yuqoriga, halqalarning bo'sh choragida. */
const MONTH_X_RATIO = -0.434;
const MONTH_Y_RATIO = -0.694;
/** Birlik yozuvi oy nomidan pastda (tashqi radiusga nisbatan). */
const UNIT_Y_OFFSET_RATIO = 0.19;

const pointAt = (angle: number, radius: number): [number, number] => [
  Math.sin(angle) * radius,
  -Math.cos(angle) * radius,
];

/**
 * Maketdagi qutb o'qi: to'liq aylana + har 1/8 bo'linmada nur va yorliq.
 * Nivo'ning o'z `grid` qatlami faqat standart 20 lik bo'linmalarni beradi va
 * treklar ostida qoladi, shuning uchun qo'lda chiziladi. Shkala (`max`), oy va
 * birlik propdan keladi, shuning uchun qatlam fabrika orqali yasaladi.
 */
function polarAxisLayer(max: number, month: string, unit: string) {
  const ticks = Array.from({ length: TICK_STEPS + 1 }, (_, index) => (max / TICK_STEPS) * index);
  /** Qiymat -> burchak (radian), 12 soatdan soat mili bo'yicha. */
  const angleOf = (value: number) => ((value / max) * END_ANGLE * Math.PI) / 180;

  return function PolarAxisLayer({ center, outerRadius }: RadialBarCustomLayerProps) {
    const gridStart = outerRadius * GRID_INNER_RATIO;
    const tickEnd = outerRadius * TICK_END_RATIO;
    const labelRadius = outerRadius * LABEL_RADIUS_RATIO;

    return (
      <g transform={`translate(${center[0]},${center[1]})`}>
        <circle r={outerRadius * AXIS_CIRCLE_RATIO} fill="none" stroke={GRID_CIRCLE_COLOR} />
        {/* Maketda nurlar boshlanadigan joyda ham to'liq aylana bor. */}
        <circle r={gridStart} fill="none" stroke={GRID_CIRCLE_COLOR} />
        {ticks.map((value, index) => {
          const angle = angleOf(value);
          const [x1, y1] = pointAt(angle, gridStart);
          const [x2, y2] = pointAt(angle, tickEnd);
          const sin = Math.sin(angle);
          const anchor =
            sin > LABEL_CENTER_SIN ? "start" : sin < -LABEL_CENTER_SIN ? "end" : "middle";

          return (
            <g key={index}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GRID_COLOR} />
              {/* Yorliq: gorizontal tayanch quticha cheti, vertikal - nur uchi. */}
              <text
                x={sin * labelRadius}
                y={y2}
                textAnchor={anchor}
                fontSize={11}
                fill={AXIS_TEXT_COLOR}
              >
                {plainNumber(value)}
              </text>
            </g>
          );
        })}
        {/* Oy nomi va shkala birligi bo'sh chorakda (halqalar 270 gradusda tugaydi). */}
        <text
          x={MONTH_X_RATIO * outerRadius}
          y={MONTH_Y_RATIO * outerRadius}
          textAnchor="middle"
          fontSize={11}
          fill={AXIS_TEXT_COLOR}
        >
          {month}
        </text>
        <text
          x={MONTH_X_RATIO * outerRadius}
          y={(MONTH_Y_RATIO + UNIT_Y_OFFSET_RATIO) * outerRadius}
          textAnchor="middle"
          fontSize={9}
          fill={AXIS_TEXT_COLOR}
        >
          {unit}
        </text>
      </g>
    );
  };
}

type View = "chart" | "table";

const VIEWS = [
  { value: "chart", Icon: ChartNoAxesColumn, label: "Grafik" },
  { value: "table", Icon: Table, label: "Jadval" },
] as const satisfies ReadonlyArray<{ value: View; Icon: typeof Table; label: string }>;

/**
 * Keltirilgan zarar - qoidabuzar turi bo'yicha (Figma `4055:1007`, 322x336),
 * "Qarzdorlik" kartasining egizagi. Grafik maydoni 169px, ostida ajratgich
 * va yorliqlar.
 *
 * Summalar Qoidabuzarliklar shablonidan (so'm). Shkala eng katta bo'lakdan
 * yaxlitlanadi (8 bo'linma), birligi oy nomi ostida. `uploaded={false}` -
 * shu oyga fayl yuklanmagan.
 */
export function LossDamageCard({
  title,
  kinds,
  total,
  month,
  uploaded,
  className,
}: {
  title: string;
  /** Halqalar ichkaridan tashqariga shu tartibda chiziladi. */
  kinds: readonly DamageKind[];
  /** Jami zarar, so'm (jadvalning oxirgi qatori). */
  total: number;
  /** Diagrammadagi oy nomi: "Sentabr". */
  month: string;
  uploaded: boolean;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");

  const { divisor, unit } = moneyUnit(Math.max(0, ...kinds.map((kind) => finite(kind.value))));
  const peak = Math.max(0, ...kinds.map((kind) => finite(kind.value))) / divisor;
  const { max } = fixedScale(peak, TICK_STEPS);

  const chartData = useMemo(
    () =>
      kinds.map((kind) => ({
        id: kind.id,
        data: [{ x: month, y: Math.min(max, Math.max(0, finite(kind.value) / divisor)) }],
      })),
    [kinds, month, max, divisor],
  );

  /** Nivo rangni `category` bo'yicha beradi, bizga esa qator (halqa) kerak. */
  const arcColor = useMemo(() => {
    const byId: Record<string, string> = Object.fromEntries(
      kinds.map((kind) => [kind.id, kind.color]),
    );
    return (bar: Omit<ComputedBar, "color">) => byId[bar.groupId] ?? GRID_COLOR;
  }, [kinds]);

  const axisLayer = useMemo(() => polarAxisLayer(max, month, unit), [max, month, unit]);

  const columns: TableColumn[] = [
    { key: "kind", label: "Qoidabuzar turi", grow: 1.4 },
    { key: "amount", label: "Zarar" },
  ];

  const emptyText = !uploaded
    ? "Qoidabuzarliklar yuklanmagan"
    : kinds.length === 0
      ? "Ma’lumot yo’q"
      : null;

  return (
    <Card className={className}>
      <CardHeader title={title}>
        {emptyText ? null : <SegmentedIcons items={VIEWS} value={view} onChange={setView} />}
      </CardHeader>

      <CardBody>
        {emptyText ? (
          <EmptyState variant="inline" action={false} title={emptyText} />
        ) : view === "chart" ? (
          <>
            <div className="relative min-h-0 flex-1">
              {/* Maketda diagramma 180px kenglikda va markazda. Katta shkalada
                  (3-4 xonali yorliqlar) matn SVG chetidan chiqadi - kesilmasin. */}
              <div className="absolute inset-0 mx-auto w-[180px] max-w-full [&_svg]:overflow-visible">
                <ResponsiveRadialBar
                  data={chartData}
                  maxValue={max}
                  startAngle={0}
                  endAngle={END_ANGLE}
                  /* Maketdan: ustun radiusi 66px, teshik 22px, halqa 12px. */
                  innerRadius={0.334}
                  padding={0.143}
                  /* Markaz 180x169 maydonning (95, 89) nuqtasida. */
                  margin={{ top: 23, right: 19, bottom: 14, left: 29 }}
                  colors={arcColor}
                  tracksColor={TRACK_COLOR}
                  /* O'q treklar ustida, ustunlar ostida turadi. */
                  layers={["tracks", axisLayer, "bars"]}
                  isInteractive={false}
                  animate={false}
                />
              </div>
            </div>

            {/* Ajratgich chizig'i bilan birga 87px: 1 + 8 + 35 + 8 + 35. */}
            <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 border-t border-solid border-[#dddddd] pt-2">
              {kinds.map((kind) => (
                <div key={kind.id} className="flex items-center gap-2.5">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: kind.color }}
                  />
                  <span className="flex min-w-0 flex-col gap-1.5">
                    {/* Maketdagi izoh rangi tokenlardan ko'ra ochiqroq. */}
                    <span className="truncate text-[10px] leading-[13px] text-[#999999]">
                      {kind.label}
                    </span>
                    <span className="truncate text-xs leading-4 font-bold text-ink">
                      {money(kind.value)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1">
            <DataTable
              /* 11px sarlavha katagining leading'i ota elementdan meros. */
              className="leading-tight"
              columns={columns}
              rows={[
                ...kinds.map((kind) => ({
                  key: kind.id,
                  cells: [
                    <span key="kind" className="font-medium">
                      {kind.label}
                    </span>,
                    money(kind.value),
                  ],
                })),
                {
                  key: "total",
                  cells: [
                    <span key="kind" className="font-medium">
                      Jami
                    </span>,
                    money(total),
                  ],
                },
              ]}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
