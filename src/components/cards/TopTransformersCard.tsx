"use client";

import { ResponsiveBar } from "@nivo/bar";
import { ChartNoAxesColumn, FileDown, Table } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardFooterLink, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone, DataTable, type TableColumn } from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";
import { SegmentedIcons } from "@/components/ui/Toggle";
import { cn } from "@/lib/ui/cn";

// Maketdagi o'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, `string`
// proplarda (sarlavha, ustun nomi) \u2019 escape sifatida yoziladi.

interface TransformerRow {
  id: string;
  name: string;
  status: { label: string; tone: BadgeTone };
  /** Hisoblangan */
  billed: string;
  /** Iste'mol */
  usage: string;
  /** Yo'qotish */
  loss: string;
  /** Grafik uchun Iste'mol qiymati (ming kVt/s). */
  usageValue: number;
}

const TRANSFORMERS: readonly TransformerRow[] = [
  {
    id: "tp-001",
    name: "TP-001",
    status: { label: "Faol", tone: "green" },
    billed: "51,5 ming",
    usage: "41,4 ming",
    loss: "10,1 ming",
    usageValue: 41.4,
  },
  {
    id: "tp-002",
    name: "TP-002",
    status: { label: "Faol", tone: "green" },
    billed: "51,0 ming",
    usage: "41,0 ming",
    loss: "10,0 ming",
    usageValue: 41,
  },
  {
    id: "tp-003",
    name: "TP-003",
    status: { label: "Nofaol", tone: "red" },
    billed: "40,6 ming",
    usage: "30,0 ming",
    loss: "10,6 ming",
    usageValue: 30,
  },
  {
    id: "tp-004-a",
    name: "TP-004",
    status: { label: "Faol", tone: "green" },
    billed: "31,3 ming",
    usage: "21,3 ming",
    loss: "10,0 ming",
    usageValue: 21.3,
  },
  {
    id: "tp-004-b",
    name: "TP-004",
    status: { label: "Faol", tone: "green" },
    billed: "31,3 ming",
    usage: "21,3 ming",
    loss: "10,0 ming",
    usageValue: 21.3,
  },
  {
    id: "tp-005",
    name: "TP-005",
    status: { label: "Ta'mirda", tone: "amber" },
    billed: "15,1 ming",
    usage: "8,1 ming",
    loss: "7,0 ming",
    usageValue: 8.1,
  },
];

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Nomi" },
  { key: "status", label: "Holat" },
  { key: "billed", label: "Hisoblangan" },
  { key: "usage", label: "Iste\u2019mol" },
  { key: "loss", label: "Yo\u2019qotish" },
];

/** Nivo indeksi noyob bo'lishi shart - TP-004 ikki marta uchraydi. */
const NAME_BY_ID: Record<string, string> = Object.fromEntries(
  TRANSFORMERS.map((row) => [row.id, row.name]),
);

/** Gorizontal ustunlar pastdan yuqoriga chiziladi, shuning uchun teskari. */
const CHART_DATA = TRANSFORMERS.map((row) => ({
  id: row.id,
  value: row.usageValue,
})).reverse();

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
 * "Eng ko'p sarfga ega transformatorlar" (Figma `4051:89`, 487x298).
 *
 * Jadval maketda 208px joy egallaydi, umumiy karta esa 298px - shuning uchun
 * pastki bo'shliq 8px (maketdagidek), aks holda oxirgi qator sig'maydi.
 */
export function TopTransformersCard({ className }: { className?: string }) {
  const [view, setView] = useState<View>("table");

  return (
    <Card padded={false} className={cn("px-4 pt-4 pb-2", className)}>
      <CardHeader title="Eng ko&rsquo;p sarfga ega transformatorlar">
        <SegmentedIcons items={VIEWS} value={view} onChange={setView} />
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody>
        <div className="min-h-0 flex-1">
          {view === "table" ? (
            <DataTable
              /* 11px sarlavha katagida o'z leading'i yo'q - maketdagi 14px qator
                 balandligi ota elementdan meros olinadi. */
              className="leading-tight"
              columns={COLUMNS}
              rows={TRANSFORMERS.map((row) => ({
                key: row.id,
                cells: [
                  <span key="name" className="font-medium">
                    {row.name}
                  </span>,
                  <Badge key="status" tone={row.status.tone}>
                    {row.status.label}
                  </Badge>,
                  row.billed,
                  row.usage,
                  row.loss,
                ],
              }))}
            />
          ) : (
            <ResponsiveBar
              data={CHART_DATA}
              keys={["value"]}
              indexBy="id"
              layout="horizontal"
              margin={{ top: 2, right: 8, bottom: 2, left: 48 }}
              padding={0.35}
              colors={["#007cd2"]}
              borderRadius={4}
              enableGridX={false}
              enableGridY={false}
              axisTop={null}
              axisRight={null}
              axisBottom={null}
              axisLeft={{
                tickSize: 0,
                tickPadding: 8,
                format: (value: string) => NAME_BY_ID[value] ?? value,
              }}
              valueFormat={(value) => `${value.toFixed(1).replace(".", ",")} ming`}
              labelSkipWidth={56}
              labelTextColor="#ffffff"
              theme={CHART_THEME}
              isInteractive={false}
              animate={false}
            />
          )}
        </div>
      </CardBody>

      <CardFooterLink>Ba&apos;tafsil</CardFooterLink>
    </Card>
  );
}
