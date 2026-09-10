"use client";

// Qidiruv va filtr holati mijozda saqlanadi, shuning uchun ko'rinish mijoz
// komponenti. `page.tsx` esa server bo'lib qoladi - `metadata` eksporti uchun.

import {
  CircuitBoard,
  FileDown,
  OctagonAlert,
  Plus,
  TriangleAlert,
  Zap,
  ZapOff,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { type RegistryColumn, RegistryTable } from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { subscriberCount } from "@/lib/data/relations";
import { dec, energy, num } from "@/lib/data/seed";
import {
  type Transformer,
  TRANSFORMER_STATUS_LABEL,
  TRANSFORMERS,
  type TransformerStatus,
  transformerTotals,
} from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

/** Filtr tugmasining qiymati: "hammasi" yoki aniq holat. */
type StatusFilter = "all" | TransformerStatus;

/**
 * Saralash tartibi: e'tibor talab qiladigan TP yuqorida turadi, o'chirilgani
 * esa ro'yxat oxirida (uning yuklamasi umuman yo'q, taqqoslashga arzimaydi).
 */
const STATUS_ORDER: Record<TransformerStatus, number> = {
  critical: 0,
  warning: 1,
  ok: 2,
  offline: 3,
};

/**
 * Holat nishonining ranglari. `DataTable` dagi umumiy `Badge` ishlatilmadi:
 * unda neytral (kulrang) ohang yo'q, "O'chirilgan" esa aynan shunday
 * ko'rinishi kerak - yashil/sariq/qizil shkalasidan tashqarida.
 */
const STATUS_PILL: Record<TransformerStatus, string> = {
  ok: "bg-tint-green text-accent-green",
  warning: "bg-tint-amber text-accent-amber",
  critical: "bg-tint-red text-accent-red",
  offline: "bg-canvas text-ink-soft",
};

function StatusPill({ status }: { status: TransformerStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2 py-[2.5px] text-[10px] leading-[13px] font-semibold whitespace-nowrap",
        STATUS_PILL[status],
      )}
    >
      {TRANSFORMER_STATUS_LABEL[status]}
    </span>
  );
}

/** Yuklama 100% dan oshsa - haddan tashqari, 85% dan oshsa - ogohlantirish. */
function loadClass(item: Transformer): string {
  if (item.status === "offline") return "text-ink-soft";
  if (item.loadPercent > 100) return "font-bold text-accent-red";
  if (item.loadPercent > 85) return "font-semibold text-accent-amber";
  return "text-ink";
}

/** Chulg'am harorati 75 daraja (C) dan oshsa - qizil. */
function tempClass(item: Transformer): string {
  if (item.status === "offline") return "text-ink-soft";
  return item.temperature > 75 ? "font-semibold text-accent-red" : "text-ink";
}

/**
 * Ustun kengliklari nisbatlarda beriladi (jami 136). Kod, podstansiya va
 * hudud - matnli ustunlar, shuning uchun chapga tekislangan.
 */
const COLUMNS: RegistryColumn[] = [
  { key: "code", label: "Kod", grow: 10, align: "left" },
  { key: "substation", label: "Podstansiya", grow: 20, align: "left" },
  { key: "area", label: "Hudud", grow: 18, align: "left" },
  { key: "feeder", label: "Fider", grow: 8 },
  { key: "status", label: "Holat", grow: 14 },
  { key: "power", label: "Quvvat, kVA", grow: 10 },
  { key: "load", label: "Yuklama", grow: 12 },
  { key: "temp", label: "Harorat", grow: 10 },
  { key: "subscribers", label: "Abonent", grow: 10 },
  { key: "consumption", label: "Iste\u2019mol", grow: 14 },
  { key: "loss", label: "Yo\u2019qotish", grow: 10 },
];

const TOTALS = transformerTotals();

/** Sarlavha ostidagi izoh uchun - nechta podstansiyaga taqsimlangani. */
const SUBSTATION_COUNT = new Set(TRANSFORMERS.map((item) => item.substationId)).size;

/**
 * Saralangan ro'yxat holatga bog'liq emas, shuning uchun modul darajasida
 * bir marta hisoblanadi (har renderda `sort` chaqirilmaydi).
 */
const SORTED: readonly Transformer[] = [...TRANSFORMERS].sort(
  (a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.loadPercent - a.loadPercent,
);

const CHIPS: ReadonlyArray<FilterChip<StatusFilter>> = [
  { value: "all", label: "Barchasi", count: TOTALS.total },
  {
    value: "ok",
    label: TRANSFORMER_STATUS_LABEL.ok,
    count: TOTALS.ok,
    dot: "bg-accent-green",
  },
  {
    value: "warning",
    label: TRANSFORMER_STATUS_LABEL.warning,
    count: TOTALS.warning,
    dot: "bg-accent-amber",
  },
  {
    value: "critical",
    label: TRANSFORMER_STATUS_LABEL.critical,
    count: TOTALS.critical,
    dot: "bg-accent-red",
  },
  {
    value: "offline",
    label: TRANSFORMER_STATUS_LABEL.offline,
    count: TOTALS.offline,
    dot: "bg-ink-soft",
  },
];

/**
 * "Transformatorlar" ro'yxati.
 *
 * Sahifa o'zi skroll bo'lmaydi: sarlavha va statistika qat'iy qatorlar,
 * jadval esa qolgan joyni egallab, ICHKARIDA skroll qilinadi.
 */
export function TransformersView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SORTED.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!needle) return true;
      return (
        item.code.toLowerCase().includes(needle) ||
        item.substationName.toLowerCase().includes(needle) ||
        item.area.toLowerCase().includes(needle)
      );
    });
  }, [query, status]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Transformatorlar"
        subtitle={`${num(TOTALS.total)} ta transformator \u00b7 ${num(SUBSTATION_COUNT)} ta podstansiya`}
      >
        <HeaderButton icon={FileDown}>Hisobot</HeaderButton>
        <HeaderButton icon={Plus} tone="brand">
          Yangi TP
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Jami TP"
          value={num(TOTALS.total)}
          icon={CircuitBoard}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={`Sog\u2019lom: ${num(TOTALS.ok)} ta`}
        />
        <StatCard
          label="Ogohlantirish"
          value={num(TOTALS.warning)}
          icon={TriangleAlert}
          accent="bg-accent-amber"
          tint="bg-tint-amber"
          hint="Yuklama 85% dan yuqori"
        />
        <StatCard
          label="Kritik"
          value={num(TOTALS.critical)}
          icon={OctagonAlert}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint="Zudlik bilan chora kerak"
          hintTone="bad"
        />
        <StatCard
          label="Umumiy quvvat"
          value={num(TOTALS.power)}
          unit="kVA"
          icon={Zap}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`O\u2019rtacha yuklama: ${dec(TOTALS.load)}%`}
        />
        <StatCard
          label={"O\u2019rtacha yo\u2019qotish"}
          value={dec(TOTALS.loss)}
          unit="%"
          icon={ZapOff}
          accent="bg-accent-teal"
          tint="bg-tint-teal"
          hint={`Oylik iste\u2019mol: ${energy(TOTALS.consumption)}`}
        />
      </StatRow>

      <Card className="min-h-0 flex-1">
        <div className="flex shrink-0 items-center gap-2 pb-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={"Kod, podstansiya yoki hudud..."}
            label={"Transformatorlar ro\u2019yxatidan qidirish"}
            className="w-[240px]"
          />
          <FilterChips items={CHIPS} value={status} onChange={setStatus} />
          <span className="ml-auto shrink-0 text-[11px] text-ink-soft">
            {rows.length} ta yozuv
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <RegistryTable
            columns={COLUMNS}
            emptyText={"Shu shartlarga mos transformator topilmadi"}
            rows={rows.map((item) => ({
              key: item.id,
              href: `/transformers/${item.id}`,
              cells: [
                <span key="code" className="truncate font-semibold text-ink">
                  {item.code}
                </span>,
                <span key="substation" className="truncate">
                  {item.substationName}
                </span>,
                <span key="area" className="truncate text-ink-muted">
                  {item.area}
                </span>,
                item.feeder,
                <StatusPill key="status" status={item.status} />,
                num(item.powerKva),
                <span key="load" className={loadClass(item)}>
                  {dec(item.loadPercent)}%
                </span>,
                <span key="temp" className={tempClass(item)}>
                  {num(item.temperature)}
                  {"\u00b0C"}
                </span>,
                num(subscriberCount(item.id)),
                <span key="consumption" className="truncate">
                  {energy(item.consumptionKwh)}
                </span>,
                `${dec(item.lossPercent)}%`,
              ],
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
