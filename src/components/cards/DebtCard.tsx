"use client";

import {
  type RadialBarCustomLayerProps,
  type RadialBarSerie,
  ResponsiveRadialBar,
} from "@nivo/radial-bar";
import { ChartNoAxesColumn, FileDown, Table } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";
import { SegmentedIcons } from "@/components/ui/Toggle";

interface DebtRing {
  id: string;
  /** Legendadagi izoh. */
  label: string;
  /** Legendadagi va jadvaldagi summa. */
  amount: string;
  /**
   * Yoy uzunligi 0-375 shkalada. Maketda yoylar summaga proporsional emas -
   * qiymatlar Figma'dagi burchaklardan (185 / 225 / 250 gradus) hisoblangan.
   */
  arc: number;
  /** Yoy va legenda nuqtasining rangi (maketdan olingan). */
  color: string;
}

/**
 * Legenda va jadval tartibi: tashqi halqadan ichkariga.
 * Summalardagi apostrof - maketdagi egri U+2019 (&rsquo;).
 */
const RINGS: readonly DebtRing[] = [
  { id: "umumiy", label: "Umumiy", amount: "361,7 mln so’m", arc: 348, color: "#3cc3df" },
  { id: "aholi", label: "Aholi", amount: "261,6 mln so’m", arc: 312, color: "#ff928a" },
  { id: "yuridik", label: "Yuridik", amount: "100,1 mln so’m", arc: 256, color: "#8979ff" },
];

/** Nivo birinchi seriyani eng ichki halqa qilib chizadi - shuning uchun teskari. */
const CHART_DATA: RadialBarSerie[] = RINGS.map((ring) => ({
  id: ring.id,
  data: [{ x: "qarz", y: ring.arc }],
})).reverse();

const RING_COLOR: Record<string, string> = Object.fromEntries(
  RINGS.map((ring) => [ring.id, ring.color]),
);

/**
 * Setka nivo'ning o'z qatlamlari bilan chizilmaydi: d3 tik generatori 75
 * qadamli shkalani bera olmaydi (faqat 1/2/5 ning karralari), maketda esa
 * 0-375 oralig'i 6 ta bo'linmaga ajratilgan. Shuning uchun aylanalar,
 * radiuslar va raqamlar maketdagi o'lchamlar bo'yicha qo'lda chiziladi.
 */
const AXIS_TICKS = [
  { label: "0", x: -1, y: -84 },
  { label: "75", x: 66, y: -53 },
  { label: "150", x: 78, y: 25 },
  { label: "225", x: 31, y: 73 },
  { label: "300", x: -57, y: 63 },
  { label: "375", x: -88, y: -3 },
] as const;

/** Bo'linma chiziqlari (gradus, yuqoridan soat yo'nalishi bo'yicha). */
const SPOKES = [0, 54, 108, 162, 216, 270] as const;

/** Maketdagi radiuslar 69px tashqi radiusga nisbatan. */
const RING_OUTER = 72 / 69;
const RING_INNER = 20 / 69;

function PolarDecoration({ center, outerRadius }: RadialBarCustomLayerProps) {
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
        {AXIS_TICKS.map((tick) => (
          <text key={tick.label} x={tick.x * scale} y={tick.y * scale}>
            {tick.label}
          </text>
        ))}
        {/* Oy nomi halqaning bo'sh choragida turadi. */}
        <text x={-32 * scale} y={-49 * scale}>
          Sentabr
        </text>
      </g>
    </g>
  );
}

const COLUMNS: TableColumn[] = [
  { key: "type", label: "Turi" },
  { key: "amount", label: "Summa" },
];

type View = "chart" | "table";

const VIEWS = [
  { value: "chart", Icon: ChartNoAxesColumn, label: "Grafik" },
  { value: "table", Icon: Table, label: "Jadval" },
] as const satisfies ReadonlyArray<{ value: View; Icon: typeof Table; label: string }>;

/**
 * "Qarzdorlik" (Figma `4055:178`, 322x336) - fider sahifasining 3-qatori.
 *
 * Grafik maydoni 169px, ostida 8px oraliq va 87px legenda (yuqorisida ajratgich).
 * Markaz va radiuslar maketdan olingan: tashqi radius 69px, ichki nisbat 0.335.
 */
export function DebtCard({ className }: { className?: string }) {
  const [view, setView] = useState<View>("chart");

  return (
    <Card className={className}>
      <CardHeader title="Qarzdorlik">
        <SegmentedIcons items={VIEWS} value={view} onChange={setView} />
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody>
        {view === "table" ? (
          <DataTable
            columns={COLUMNS}
            rows={RINGS.map((ring) => ({
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
            <div className="min-h-0 flex-1 [&_svg]:overflow-visible">
              <ResponsiveRadialBar
                data={CHART_DATA}
                maxValue={375}
                startAngle={0}
                endAngle={270}
                innerRadius={0.335}
                padding={0.13}
                cornerRadius={0}
                margin={{ top: 21, right: 56, bottom: 10, left: 64 }}
                colors={(bar) => RING_COLOR[bar.groupId] ?? "#3cc3df"}
                enableTracks
                tracksColor="#f3f3f3"
                enableRadialGrid={false}
                enableCircularGrid={false}
                radialAxisStart={null}
                circularAxisOuter={null}
                // Setka yo'llar ustidan, yoylar ostidan chiziladi (maketdagidek).
                layers={["tracks", PolarDecoration, "bars"]}
                isInteractive={false}
                animate={false}
              />
            </div>

            <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 border-t border-solid border-[#dddddd] pt-2">
              {RINGS.map((ring) => (
                <div key={ring.id} className="flex h-8.75 items-center gap-2.5">
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: ring.color }}
                  />
                  <span className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-[10px] leading-3.25 text-[#999999]">
                      {ring.label}
                    </span>
                    <span className="text-xs leading-4 font-semibold text-ink">
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
