"use client";

import { ResponsiveBar } from "@nivo/bar";
import { ChartNoAxesColumn, FileDown, Table } from "lucide-react";
import { useState } from "react";

import { Card, CardFooterLink, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";
import { SegmentedIcons } from "@/components/ui/Toggle";
import { cn } from "@/lib/ui/cn";

export interface TopBarItem {
  id: string;
  /** Chap ustundagi nom: "Chinobod", "Xaqulobod". */
  label: string;
  /** Shkaladagi qiymat (mln kWh). */
  value: number;
}

/**
 * Maketdagi o'lchamlar (Figma `4216:57`, "BarLineChart" 454.67x218):
 *
 *   yAxisTop   15px  - qiymat o'qi YUQORIDA (0 / 20 / ... / max)
 *   MainChart  195px - chapda 59px yorliq ustuni, qolgani ustunlar maydoni
 *   ustun      qator qadamining 40% i (2 ta qatorda 39.36/97.5,
 *              6 ta qatorda 13.12/32.5 - ikkalasi ham 0.404)
 *
 * Shundan nivo `padding` qiymati 0.6 bo'ladi.
 */
/*
 * O’ng chekka 12px: oxirgi bo’linma yorlig’i ("100" / "200") tik ustida
 * markazlashadi, 4px da uning yarmi SVG chetidan chiqib kesilardi.
 * Maketda ham u o’ng chetga tegib turadi, ya’ni ichkariga surilgan.
 */
const CHART_MARGIN = { top: 15, right: 12, bottom: 0, left: 59 } as const;
const BAR_PADDING = 0.6;

/** Maketda o'q va yorliq matni 10px, rangi #4d4d4d; to'r - #d9d9dd. */
const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 10, fill: "#4d4d4d" },
  axis: {
    ticks: { text: { fill: "#4d4d4d", fontSize: 10 } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#d9d9dd", strokeWidth: 1 } },
} as const;

type View = "chart" | "table";

const VIEWS = [
  { value: "chart", Icon: ChartNoAxesColumn, label: "Grafik" },
  { value: "table", Icon: Table, label: "Jadval" },
] as const satisfies ReadonlyArray<{ value: View; Icon: typeof Table; label: string }>;

/**
 * "Eng ko'p sarfga ega ..." kartasi - gorizontal ustunli diagramma.
 *
 * Bosh sahifada ikki marta ishlatiladi (podstansiyalar va fiderlar), maketda
 * ular faqat ma'lumot va shkala chegarasi bilan farq qiladi, shuning uchun
 * komponent bitta.
 */
export function TopBarsCard({
  title,
  items,
  max,
  tickStep,
  unit,
  footerLabel,
  footerHref,
  className,
}: {
  title: string;
  items: readonly TopBarItem[];
  /** Shkalaning yuqori chegarasi (maketda 100 yoki 200). */
  max: number;
  /** O'q bo'linmasi orasidagi qadam (20 yoki 25). */
  tickStep: number;
  /** Qiymat yonidagi birlik: "mln kWh". */
  unit: string;
  footerLabel: string;
  footerHref: string;
  className?: string;
}) {
  const [view, setView] = useState<View>("chart");

  const tickValues = Array.from(
    { length: Math.floor(max / tickStep) + 1 },
    (_, index) => index * tickStep,
  );

  // Nivo gorizontal ustunlarni pastdan yuqoriga chizadi - maketdagi tartib
  // saqlanishi uchun ro'yxat teskari uzatiladi.
  const chartData = [...items].reverse().map((item) => ({
    id: item.id,
    label: item.label,
    value: item.value,
  }));

  const nameById: Record<string, string> = Object.fromEntries(
    items.map((item) => [item.id, item.label]),
  );

  const columns: TableColumn[] = [
    { key: "name", label: "Nomi", grow: 3, align: "left" },
    { key: "value", label: `Sarf, ${unit}`, grow: 2 },
  ];

  return (
    <Card padded={false} className={cn("px-4 pt-4 pb-2", className)}>
      <CardHeader title={title}>
        <SegmentedIcons items={VIEWS} value={view} onChange={setView} />
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      {/* Maketda diagramma sarlavhadan 16px pastda boshlanadi (48 - 32), ya'ni
          `CardBody` ning 8px i yetmaydi - shuning uchun bu yerda pt-4. */}
      <div className="min-h-0 flex-1 pt-4">
        {view === "chart" ? (
          <ResponsiveBar
            data={chartData}
            keys={["value"]}
            indexBy="id"
            layout="horizontal"
            margin={CHART_MARGIN}
            padding={BAR_PADDING}
            colors={["#007cd2"]}
            borderRadius={2}
            valueScale={{ type: "linear", min: 0, max }}
            gridXValues={tickValues}
            enableGridX
            enableGridY={false}
            axisTop={{ tickSize: 0, tickPadding: 4, tickValues }}
            axisBottom={null}
            axisRight={null}
            axisLeft={{
              tickSize: 0,
              tickPadding: 6,
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
                  {String(data.value).replace(".", ",")} {unit}
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
                  String(item.value).replace(".", ","),
                ],
              }))}
            />
          </div>
        )}
      </div>

      <CardFooterLink href={footerHref}>{footerLabel}</CardFooterLink>
    </Card>
  );
}
