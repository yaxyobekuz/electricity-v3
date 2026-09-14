"use client";

// Qidiruv va saralash mijozda: qatorlar (bir necha yuz TP) serverda qamrov
// bo'yicha filtrlanib bir marta keladi, har bosishda server so'rovi yo'q.

import { useMemo, useState } from "react";

import { type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { type RegistryColumn, RegistryTable } from "@/components/ui/RegistryTable";
import { nameKey } from "@/lib/domain/normalize";
import { EMPTY, num, percent } from "@/lib/format";
import type { TransformerRegistryRow } from "@/lib/queries/transformers-registry";

type SortKey = "loss" | "useful";

const SORTS: ReadonlyArray<FilterChip<SortKey>> = [
  { value: "loss", label: "Yo’qotish % bo’yicha" },
  { value: "useful", label: "Foydali oqim bo’yicha" },
];

/**
 * Teng qiymatlarda tartib id bo'yicha - lokalga bog'liq emas, server va
 * brauzer bir xil tartibda chizadi (gidratsiya farqi chiqmaydi).
 */
function byId(a: TransformerRegistryRow, b: TransformerRegistryRow): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Kamayish tartibida; yo'qotish foizi yo'q (umumiy oqim ≤ 0) qatorlar oxirida. */
function compareRows(sort: SortKey) {
  return (a: TransformerRegistryRow, b: TransformerRegistryRow): number => {
    if (sort === "useful") return b.usefulKwh - a.usefulKwh || byId(a, b);
    if (a.lossPercent == null || b.lossPercent == null) {
      return (a.lossPercent == null ? 1 : 0) - (b.lossPercent == null ? 1 : 0) || byId(a, b);
    }
    return b.lossPercent - a.lossPercent || byId(a, b);
  };
}

/** Qidiruv kaliti - TP, podstansiya, fider nomi, manzil va ma'sul xodim. */
function searchText(row: TransformerRegistryRow): string {
  return nameKey(
    [row.name, row.substation.name, row.feeder.name, row.address ?? "", row.staff?.name ?? ""].join(
      "\n",
    ),
  );
}

/**
 * Manzil satridagi `q` ni qidiruv matni bilan bir xil holatda saqlaydi (ulashsa bo'ladi).
 *
 * Holat `null` beriladi: joriy `history.state` da Next.js ning `__NA` belgisi
 * bor, u bilan chaqiruv "ichki" hisoblanib router URL ni yangilamaydi va
 * keyingi `router.refresh()` (oy tanlash, import) `q` ni o'chirib yuboradi.
 */
function syncQueryParam(value: string) {
  const url = new URL(window.location.href);
  const trimmed = value.trim();
  if (trimmed) url.searchParams.set("q", trimmed);
  else url.searchParams.delete("q");
  window.history.replaceState(null, "", `${url.pathname}${url.search}`);
}

export function TransformersTable({
  rows,
  initialQuery,
  violationsUploaded,
  appealsUploaded,
}: {
  rows: readonly TransformerRegistryRow[];
  initialQuery: string;
  /** Qoidabuzarliklar shu oyga yuklanmagan bo'lsa ustun ko'rsatilmaydi. */
  violationsUploaded: boolean;
  /** Murojaatlar shu oyga yuklanmagan bo'lsa ustun ko'rsatilmaydi. */
  appealsUploaded: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [sort, setSort] = useState<SortKey>("loss");

  const indexed = useMemo(() => rows.map((row) => ({ row, text: searchText(row) })), [rows]);

  const visible = useMemo(() => {
    const needle = nameKey(query);
    const matched = needle
      ? indexed.filter((item) => item.text.includes(needle)).map((item) => item.row)
      : indexed.map((item) => item.row);
    return matched.sort(compareRows(sort));
  }, [indexed, query, sort]);

  const columns = useMemo<RegistryColumn[]>(
    () => [
      { key: "name", label: "TP nomi", grow: 12, align: "left" },
      { key: "substation", label: "Podstansiya", grow: 13, align: "left" },
      { key: "feeder", label: "Fider", grow: 13, align: "left" },
      { key: "total", label: "Umumiy oqim, kWh", grow: 13 },
      { key: "useful", label: "Foydali oqim, kWh", grow: 13 },
      { key: "loss", label: "Yo’qotish, %", grow: 9 },
      { key: "subscribers", label: "Abonent: aloqada / chiqqan", grow: 17 },
      { key: "capacity", label: "Quvvati, kVA", grow: 10 },
      ...(violationsUploaded
        ? [{ key: "violations", label: "Qoidabuzarlik", grow: 10 } satisfies RegistryColumn]
        : []),
      ...(appealsUploaded ? [{ key: "appeals", label: "Murojaat", grow: 9 } satisfies RegistryColumn] : []),
      { key: "staff", label: "Ma’sul xodim", grow: 16, align: "left" },
    ],
    [violationsUploaded, appealsUploaded],
  );

  const missing = [
    violationsUploaded ? null : "Qoidabuzarliklar",
    appealsUploaded ? null : "Murojaatlar",
  ].filter(Boolean);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2 pb-3">
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            syncQueryParam(value);
          }}
          placeholder="TP, podstansiya, fider, manzil, xodim..."
          label="Transformatorlar ro’yxatidan qidirish"
          className="w-70"
        />
        <FilterChips items={SORTS} value={sort} onChange={setSort} />
        <span className="ml-auto flex shrink-0 items-center gap-3 text-[11px] text-ink-soft">
          {missing.length > 0 ? <span>{missing.join(", ")} yuklanmagan</span> : null}
          <span>{num(visible.length)} ta yozuv</span>
        </span>
      </div>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        <RegistryTable
          columns={columns}
          emptyText={
            rows.length === 0
              ? "Shu qamrovda transformator yo’q"
              : "Qidiruvga mos transformator topilmadi"
          }
          rows={visible.map((row) => ({
            key: row.id,
            href: `/transformers/${row.id}`,
            cells: [
              <span key="name" className="truncate font-semibold text-ink">
                {row.name}
              </span>,
              <span key="substation" className="truncate">
                {row.substation.name}
              </span>,
              <span key="feeder" className="truncate">
                {row.feeder.name}
              </span>,
              num(row.totalKwh),
              num(row.usefulKwh),
              percent(row.lossPercent),
              <span key="subscribers" className="tabular-nums">
                {num(row.onlineSubscribers)}
                <span className="text-ink-soft"> / </span>
                {num(row.offlineSubscribers)}
              </span>,
              num(row.capacityKva),
              ...(violationsUploaded ? [num(row.violations)] : []),
              ...(appealsUploaded ? [num(row.appeals)] : []),
              <span key="staff" className="truncate text-ink-muted">
                {row.staff?.name ?? EMPTY}
              </span>,
            ],
          }))}
        />
      </div>
    </>
  );
}
