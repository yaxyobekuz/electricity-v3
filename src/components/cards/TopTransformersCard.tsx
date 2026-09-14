"use client";

import { ResponsiveBar } from "@nivo/bar";
import { ChartNoAxesColumn, Table } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { finite } from "@/components/cards/chart-scale";
import { Card, CardBody, CardFooterLink, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedIcons } from "@/components/ui/Toggle";
import { dec } from "@/lib/format";
import { cn } from "@/lib/ui/cn";

/** Karta qatori: jadval kataklari va grafikdagi ustun (yorliq + qiymat). */
export interface TopRow {
  /** Noyob kalit - nivo indeksi ham shu (nomlar takrorlanishi mumkin). */
  id: string;
  /** Jadval kataklari - `columns` tartibida. */
  cells: ReactNode[];
  /** Grafik o'qidagi yorliq. */
  label: string;
  /** Grafikdagi ustun qiymati (manfiy bo'lishi mumkin). */
  value: number;
  /** Ustun ichidagi yozuv; berilmasa `value` + `valueSuffix`. */
  valueText?: string;
}

const CHART_THEME = {
  axis: { ticks: { text: { fontSize: 11, fill: "#767676", fontWeight: 500 } } },
  labels: { text: { fontSize: 11, fontWeight: 600 } },
};

type View = "chart" | "table";

const VIEWS = [
  { value: "chart", Icon: ChartNoAxesColumn, label: "Grafik" },
  { value: "table", Icon: Table, label: "Jadval" },
] as const satisfies ReadonlyArray<{ value: View; Icon: typeof Table; label: string }>;

/**
 * "Eng ko'p ..." jadval/grafik kartasi (Figma `4051:89`, 487x298).
 *
 * Jadval maketda 208px joy egallaydi, umumiy karta esa 298px - shuning uchun
 * pastki bo'shliq 8px (maketdagidek), aks holda oxirgi qator sig'maydi.
 *
 * Fider sahifasida - transformatorlar, transformator sahifasida - abonentlar:
 * sarlavha, ustunlar va qatorlar sahifadan keladi. Footer havolasi faqat
 * `footerHref` berilganda chiziladi.
 */
export function TopTransformersCard({
  title,
  columns,
  rows,
  valueSuffix = "",
  valueDigits = 0,
  axisWidth = 48,
  footerLabel = "Ba’tafsil",
  footerHref,
  emptyText = "Ma’lumot yo’q",
  className,
}: {
  title: string;
  columns: TableColumn[];
  rows: readonly TopRow[];
  /** Ustun yozuvidagi birlik: "kWh". */
  valueSuffix?: string;
  valueDigits?: number;
  /** Grafikdagi yorliq ustunining eni, px. */
  axisWidth?: number;
  footerLabel?: string;
  footerHref?: string;
  emptyText?: string;
  className?: string;
}) {
  const [view, setView] = useState<View>("table");

  const labelById = useMemo<Record<string, string>>(
    () => Object.fromEntries(rows.map((row) => [row.id, row.label])),
    [rows],
  );

  const textById = useMemo<Record<string, string>>(
    () =>
      Object.fromEntries(
        rows.map((row) => [
          row.id,
          row.valueText ?? `${dec(row.value, valueDigits)} ${valueSuffix}`.trim(),
        ]),
      ),
    [rows, valueDigits, valueSuffix],
  );

  /** Gorizontal ustunlar pastdan yuqoriga chiziladi, shuning uchun teskari. */
  const chartData = useMemo(
    () => rows.map((row) => ({ id: row.id, value: finite(row.value) })).reverse(),
    [rows],
  );

  /** Nol doim shkalada; hammasi nol bo'lsa ham oraliq bo'sh emas. */
  const valueScale = useMemo(() => {
    const values = chartData.map((row) => row.value);
    const min = Math.min(0, ...values);
    const max = Math.max(0, ...values);
    return { type: "linear" as const, min, max: max > min ? max : min + 1 };
  }, [chartData]);

  const empty = rows.length === 0;

  return (
    <Card padded={false} className={cn("px-4 pt-4 pb-2", className)}>
      <CardHeader title={title}>
        {empty ? null : <SegmentedIcons items={VIEWS} value={view} onChange={setView} />}
      </CardHeader>

      <CardBody>
        {/* Jadval ko'rinishida 298px kartaga 6 qator sig'adi; qatorlar soni
            cheklanmagan, shuning uchun qolganlari aylantirib ko'riladi. */}
        <div
          className={cn(
            "min-h-0 flex-1",
            !empty && view === "table" && "scrollbar-none overflow-y-auto",
          )}
        >
          {empty ? (
            <EmptyState variant="inline" action={false} title={emptyText} />
          ) : view === "table" ? (
            <DataTable
              /* 11px sarlavha katagida o'z leading'i yo'q - maketdagi 14px qator
                 balandligi ota elementdan meros olinadi. */
              className="leading-tight"
              columns={columns}
              rows={rows.map((row) => ({ key: row.id, cells: row.cells }))}
            />
          ) : (
            <ResponsiveBar
              data={chartData}
              keys={["value"]}
              indexBy="id"
              layout="horizontal"
              margin={{ top: 2, right: 8, bottom: 2, left: axisWidth }}
              padding={0.35}
              colors={["#007cd2"]}
              borderRadius={4}
              valueScale={valueScale}
              enableGridX={false}
              enableGridY={false}
              axisTop={null}
              axisRight={null}
              axisBottom={null}
              axisLeft={{
                tickSize: 0,
                tickPadding: 8,
                format: (value: string) => labelById[value] ?? value,
              }}
              label={(bar) => textById[String(bar.indexValue)] ?? ""}
              labelSkipWidth={56}
              labelTextColor="#ffffff"
              theme={CHART_THEME}
              isInteractive={false}
              animate={false}
            />
          )}
        </div>
      </CardBody>

      {footerHref ? <CardFooterLink href={footerHref}>{footerLabel}</CardFooterLink> : null}
    </Card>
  );
}
