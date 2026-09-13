"use client";

import {
  type RadialBarCustomLayerProps,
  type RadialBarSerie,
  ResponsiveRadialBar,
} from "@nivo/radial-bar";
import { ChartNoAxesColumn, FileDown, Table } from "lucide-react";
import { useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";
import { SegmentedIcons } from "@/components/ui/Toggle";

export interface StatRing {
  id: string;
  /** Legendadagi izoh. */
  label: string;
  /** Legendadagi va jadvaldagi qiymat: "361,7 mln so'm", "1900 ta". */
  amount: string;
  /** Yoy uzunligi `0..max` shkalada. */
  arc: number;
  /** Yoy va legenda nuqtasining rangi. */
  color: string;
}

interface Point {
  x: number;
  y: number;
}

/**
 * Diagramma joylashuvi: nivo chekkalari (ular markazni belgilaydi) va
 * yorliqlarning markazga nisbatan nuqtalari, 69px tashqi radiusda.
 */
export interface RingGeometry {
  margin: { top: number; right: number; bottom: number; left: number };
  /** 6 ta bo'linma yorlig'i, yuqoridan soat yo'nalishi bo'yicha. */
  ticks: readonly Point[];
  /** Oy nomi - halqaning bo'sh choragida. */
  month: Point;
}

/** "Qarzdorlik" maketi (Figma `4055:178`). */
const DEFAULT_GEOMETRY: RingGeometry = {
  margin: { top: 21, right: 56, bottom: 10, left: 64 },
  ticks: [
    { x: -1, y: -84 },
    { x: 66, y: -53 },
    { x: 78, y: 25 },
    { x: 31, y: 73 },
    { x: -57, y: 63 },
    { x: -88, y: -3 },
  ],
  month: { x: -32, y: -49 },
};

/** Bo'linma chiziqlari (gradus, yuqoridan soat yo'nalishi bo'yicha). */
const SPOKES = [0, 54, 108, 162, 216, 270] as const;

/** Maketdagi radiuslar 69px tashqi radiusga nisbatan. */
const RING_OUTER = 72 / 69;
const RING_INNER = 20 / 69;

/**
 * Setka nivo'ning o'z qatlamlari bilan chizilmaydi: d3 tik generatori
 * ixtiyoriy qadamli shkalani bera olmaydi (masalan 0-375 ni 6 bo'linmaga),
 * shuning uchun aylanalar, radiuslar va raqamlar maketdagi o'lchamlar
 * bo'yicha qo'lda chiziladi.
 */
function polarDecoration(tickLabels: readonly string[], month: string, geometry: RingGeometry) {
  return function PolarDecoration({ center, outerRadius }: RadialBarCustomLayerProps) {
    const scale = outerRadius / 69;
    const inner = RING_INNER * outerRadius;
    const outer = RING_OUTER * outerRadius;

    return (
      <g transform={`translate(${center[0]},${center[1]})`}>
        {/* Maketdagi to'r rangi ko'kimtir kul (#d9d9dd), sof kul emas. */}
        <g fill="none" stroke="#d9d9dd" strokeWidth={1}>
          <circle r={outer} />
          <circle r={inner} />
          {SPOKES.map((angle) => {
            const rad = (angle * Math.PI) / 180;
            return (
              <line
                key={angle}
                x1={inner * Math.sin(rad)}
                y1={-inner * Math.cos(rad)}
                x2={outer * Math.sin(rad)}
                y2={-outer * Math.cos(rad)}
              />
            );
          })}
        </g>

        <g fill="#767676" fontSize={11} textAnchor="middle" dominantBaseline="central">
          {geometry.ticks.map((tick, index) => (
            <text key={index} x={tick.x * scale} y={tick.y * scale}>
              {tickLabels[index]}
            </text>
          ))}
          {/* Oy nomi halqaning bo'sh choragida turadi. */}
          <text x={geometry.month.x * scale} y={geometry.month.y * scale}>
            {month}
          </text>
        </g>
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
 * Halqali diagramma kartasi (322x336): sarlavhada grafik/jadval almashtirgichi
 * va yuklab olish, 169px diagramma, ostida 8px oraliq va 87px legenda
 * (yuqorisida ajratgich, 2 ustun x 35px qator).
 *
 * Yoylar 270 gradusni supuradi; markaz va radiuslar maketdan: tashqi radius
 * 69px, ichki nisbat 0.335.
 */
export function RingStatsCard({
  title,
  rings,
  max,
  tickLabels,
  month = "Sentabr",
  columns,
  summary,
  geometry = DEFAULT_GEOMETRY,
  className,
}: {
  title: string;
  /** Tashqi halqadan ichkariga - legenda va jadval ham shu tartibda. */
  rings: readonly StatRing[];
  /** Shkalaning yuqori chegarasi (270 gradusga to'g'ri keladi). */
  max: number;
  /** 6 ta bo'linma yorlig'i: 0 dan `max` gacha. */
  tickLabels: readonly string[];
  month?: string;
  /** Jadval ustunlari nomi: [turi, qiymati]. */
  columns: readonly [string, string];
  /** Diagramma maydonining chap yuqori burchagidagi jamlanma (nuqtasiz yorliq). */
  summary?: { label: string; value: string };
  geometry?: RingGeometry;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");

  const chartData = useMemo<RadialBarSerie[]>(
    // Nivo birinchi seriyani eng ichki halqa qilib chizadi - shuning uchun teskari.
    () => rings.map((ring) => ({ id: ring.id, data: [{ x: "qiymat", y: ring.arc }] })).reverse(),
    [rings],
  );

  const ringColor = useMemo<Record<string, string>>(
    () => Object.fromEntries(rings.map((ring) => [ring.id, ring.color])),
    [rings],
  );

  const decoration = useMemo(
    () => polarDecoration(tickLabels, month, geometry),
    [tickLabels, month, geometry],
  );

  const tableColumns: TableColumn[] = [
    { key: "type", label: columns[0] },
    { key: "amount", label: columns[1] },
  ];

  return (
    <Card className={className}>
      <CardHeader title={title}>
        <SegmentedIcons items={VIEWS} value={view} onChange={setView} />
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody>
        {view === "table" ? (
          <DataTable
            columns={tableColumns}
            rows={rings.map((ring) => ({
              key: ring.id,
              cells: [
                <span key="type" className="font-medium">
                  {ring.label}
                </span>,
                ring.amount,
              ],
            }))}
          />
        ) : (
          <>
            {/* O'q yorliqlari SVG chetidan chiqadi - kesilmasligi uchun overflow ochiq. */}
            <div className="relative min-h-0 flex-1 [&_svg]:overflow-visible">
              <ResponsiveRadialBar
                data={chartData}
                maxValue={max}
                startAngle={0}
                endAngle={270}
                innerRadius={0.335}
                padding={0.13}
                cornerRadius={0}
                margin={geometry.margin}
                colors={(bar) => ringColor[bar.groupId] ?? "#3cc3df"}
                enableTracks
                tracksColor="#f3f3f3"
                enableRadialGrid={false}
                enableCircularGrid={false}
                radialAxisStart={null}
                circularAxisOuter={null}
                // Setka yo'llar ustidan, yoylar ostidan chiziladi (maketdagidek).
                layers={["tracks", decoration, "bars"]}
                isInteractive={false}
                animate={false}
              />

              {summary ? (
                <span className="absolute top-px left-0 flex flex-col gap-1.5">
                  <span className="text-[10px] leading-3.25 text-[#999999]">{summary.label}</span>
                  <span className="text-xs leading-4 font-semibold text-ink">{summary.value}</span>
                </span>
              ) : null}
            </div>

            <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 border-t border-solid border-[#dddddd] pt-2">
              {rings.map((ring) => (
                <div key={ring.id} className="flex h-8.75 min-w-0 items-center gap-2.5">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: ring.color }}
                  />
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate text-[10px] leading-3.25 text-[#999999]">
                      {ring.label}
                    </span>
                    <span className="truncate text-xs leading-4 font-semibold text-ink">
                      {ring.amount}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
