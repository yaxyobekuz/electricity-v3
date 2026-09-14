"use client";

import {
  type ComputedBar,
  type RadialBarCustomLayerProps,
  ResponsiveRadialBar,
} from "@nivo/radial-bar";
import { ChartNoAxesColumn, FileDown, Table } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";
import { SegmentedIcons } from "@/components/ui/Toggle";

// Maketdagi o'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, `string`
// qiymatlarda `’`.

export interface LossKind {
  id: string;
  /** Nivo uchun son qiymat (`unit` birligida). */
  value: number;
  /** Maketdagi vergulli yozuv. */
  amount: string;
  color: string;
}

/** Halqalar ichkaridan tashqariga shu tartibda chiziladi. */
const LOSS_KINDS: readonly LossKind[] = [
  { id: "Tabiiy", value: 161.7, amount: "161,7", color: "#55c4ae" },
  { id: "Texnologik", value: 61.6, amount: "61,6", color: "#f4cf3b" },
  { id: "O’g’irlik", value: 50.1, amount: "50,1", color: "#ff928a" },
];

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

const pointAt = (angle: number, radius: number): [number, number] => [
  Math.sin(angle) * radius,
  -Math.cos(angle) * radius,
];

/** O'q yorlig'i: butun son o'zicha, kasr - vergul bilan ("0,5"). */
function tickLabel(value: number): string {
  return String(Number(value.toFixed(2))).replace(".", ",");
}

/**
 * Maketdagi qutb o'qi: to'liq aylana + har 1/8 bo'linmada nur va yorliq.
 * Nivo'ning o'z `grid` qatlami faqat standart 20 lik bo'linmalarni beradi va
 * treklar ostida qoladi, shuning uchun qo'lda chiziladi. Shkala (`max`) va oy
 * propdan keladi, shuning uchun qatlam fabrika orqali yasaladi.
 */
function polarAxisLayer(max: number, month: string) {
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
        {ticks.map((value) => {
          const angle = angleOf(value);
          const [x1, y1] = pointAt(angle, gridStart);
          const [x2, y2] = pointAt(angle, tickEnd);
          const sin = Math.sin(angle);
          const anchor =
            sin > LABEL_CENTER_SIN ? "start" : sin < -LABEL_CENTER_SIN ? "end" : "middle";

          return (
            <g key={value}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GRID_COLOR} />
              {/* Yorliq: gorizontal tayanch quticha cheti, vertikal - nur uchi. */}
              <text
                x={sin * labelRadius}
                y={y2}
                textAnchor={anchor}
                fontSize={11}
                fill={AXIS_TEXT_COLOR}
              >
                {tickLabel(value)}
              </text>
            </g>
          );
        })}
        {/* Oy nomi bo'sh chorakda (halqalar 270 gradusda tugaydi). */}
        <text
          x={MONTH_X_RATIO * outerRadius}
          y={MONTH_Y_RATIO * outerRadius}
          textAnchor="middle"
          fontSize={11}
          fill={AXIS_TEXT_COLOR}
        >
          {month}
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
 * "Yo'qotish zarari" (Figma `4055:1007`, 322x336) - "Qarzdorlik" kartasining
 * egizagi. Grafik maydoni 169px, ostida ajratgich va 3 ta yorliq.
 *
 * Standart qiymatlar - maketdagi (0..200 mln so'm). Transformator sahifasida
 * zarar o'sha TP yo'qotishidan hisoblanadi: `kinds`, `max` (8 ga bo'linadigan
 * shkala chegarasi), `unit` va `total` proplari.
 */
export function LossDamageCard({
  kinds = LOSS_KINDS,
  max = 200,
  unit = "mln so’m",
  // 161,7 + 61,6 + 50,1 - maketdagi uchta qiymat yig'indisi.
  total = "273,4",
  month = "Sentabr",
  className,
}: {
  kinds?: readonly LossKind[];
  max?: number;
  unit?: string;
  total?: string;
  month?: string;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");

  const chartData = useMemo(
    () => kinds.map((kind) => ({ id: kind.id, data: [{ x: month, y: kind.value }] })),
    [kinds, month],
  );

  /** Nivo rangni `category` bo'yicha beradi, bizga esa qator (halqa) kerak. */
  const arcColor = useMemo(() => {
    const byId: Record<string, string> = Object.fromEntries(
      kinds.map((kind) => [kind.id, kind.color]),
    );
    return (bar: Omit<ComputedBar, "color">) => byId[bar.groupId] ?? GRID_COLOR;
  }, [kinds]);

  const axisLayer = useMemo(() => polarAxisLayer(max, month), [max, month]);

  const columns: TableColumn[] = [
    { key: "kind", label: "Yo’qotish turi", grow: 1.4 },
    { key: "amount", label: `Zarar, ${unit}` },
  ];

  return (
    <Card className={className}>
      <CardHeader title="Yo&rsquo;qotish zarari">
        <SegmentedIcons items={VIEWS} value={view} onChange={setView} />
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody>
        {view === "chart" ? (
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
                      {kind.id}
                    </span>
                    <span className="truncate text-xs leading-4 font-bold text-ink">
                      {kind.amount} {unit}
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
                      {kind.id}
                    </span>,
                    kind.amount,
                  ],
                })),
                {
                  key: "total",
                  cells: [
                    <span key="kind" className="font-medium">
                      Jami
                    </span>,
                    total,
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
