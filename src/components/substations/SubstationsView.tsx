"use client";

// Qidiruv holat (`useState`) talab qiladi - shuning uchun ro'yxatning o'zi
// mijoz komponenti, ma'lumot esa `page.tsx` (server) dan props bo'lib keladi.

import { Factory } from "lucide-react";
import { type ReactNode, useMemo } from "react";

import {
  CellLink,
  FlowStatCards,
  MissingTemplates,
  type RegistryFlowSummary,
  StaffCell,
  TextCell,
  matchesQuery,
  useSearchQuery,
} from "@/components/substations/registry-parts";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchField } from "@/components/ui/Filters";
import { PageHeader } from "@/components/ui/PageHeader";
import { type RegistryColumn, RegistryTable } from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { formatDate, num, percent } from "@/lib/format";

/** Jadval qatori - `listSubstations` qatorining mijozga kerakli qismi. */
export interface SubstationListItem {
  id: string;
  name: string;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  lossPercent: number | null;
  /** Fiderlar shu oyga yuklanmagan bo'lsa - null. */
  feederCount: number | null;
  /** Transformatorlar shu oyga yuklanmagan bo'lsa - null. */
  transformerCount: number | null;
  /** Σ TP holatlaridagi abonentlar; Transformatorlar yuklanmagan bo'lsa - null. */
  subscriberCount: number | null;
  capacityKva: number | null;
  staffName: string | null;
  address: string | null;
}

export interface SubstationsSummary extends RegistryFlowSummary {
  /** `getScopeSummary(tuman).counts` - shablon yuklanmagan bo'lsa null. */
  counts: { substations: number | null; feeders: number | null; transformers: number | null };
}

/** Ustunlar: faqat shablondagi va undan hisoblangan qiymatlar. */
const BASE_COLUMNS: RegistryColumn[] = [
  { key: "name", label: "Nomi", grow: 14, align: "left" },
  { key: "total", label: "Umumiy oqim, kWh", grow: 11 },
  { key: "useful", label: "Foydali oqim, kWh", grow: 11 },
  { key: "loss", label: "Yo’qotish, kWh", grow: 10 },
  { key: "lossPercent", label: "Yo’qotish, %", grow: 8 },
  { key: "feeders", label: "Fiderlar", grow: 7 },
  { key: "transformers", label: "TP", grow: 6 },
  { key: "subscribers", label: "Abonentlar", grow: 8 },
  { key: "capacity", label: "Quvvati, kVA", grow: 9 },
  { key: "staff", label: "Ma’sul xodim", grow: 15, align: "left" },
  { key: "address", label: "Manzil", grow: 18, align: "left" },
];

/** Qator kataklari ustun kalitlari bo'yicha - yashirilgan ustun oson tushib qoladi. */
function rowCells(item: SubstationListItem): Record<string, ReactNode> {
  return {
    name: (
      <CellLink href={`/substations/${item.id}`} strong>
        {item.name}
      </CellLink>
    ),
    total: num(item.totalKwh),
    useful: num(item.usefulKwh),
    loss: num(item.lossKwh),
    lossPercent: percent(item.lossPercent),
    feeders: num(item.feederCount),
    transformers: num(item.transformerCount),
    subscribers: num(item.subscriberCount),
    capacity: num(item.capacityKva),
    staff: <StaffCell name={item.staffName} />,
    address: <TextCell value={item.address} />,
  };
}

/**
 * Podstansiyalar ro'yxati (1476x1064 ish maydoni).
 *
 * Balandlik taqsimoti: yo'lak 56 + 8, ko'rsatkichlar 104 + 8, qolgani -
 * jadval kartasi. Sahifaning o'zi skroll bo'lmaydi, faqat jadval ichi
 * skroll qilinadi. Qatorlar Excel fayldagi tartibda.
 *
 * Shablon shu oyga yuklanmagan bo'lsa unga bog'liq ustun (Fiderlar, TP,
 * Abonentlar) ko'rsatilmaydi va asboblar qatorida "... yuklanmagan" turadi.
 */
export function SubstationsView({
  periodLabel,
  reportDate,
  initialQuery,
  rows,
  uploads,
  summary,
}: {
  periodLabel: string;
  /** Davrning hisobot sanasi, ISO. */
  reportDate: string;
  /** `?q=` qiymati. */
  initialQuery: string;
  rows: readonly SubstationListItem[];
  uploads: { substations: boolean; feeders: boolean; transformers: boolean };
  summary: SubstationsSummary;
}) {
  const [query, setQuery] = useSearchQuery(initialQuery);

  const visible = useMemo(
    () => rows.filter((item) => matchesQuery(query, [item.name, item.address, item.staffName])),
    [rows, query],
  );

  const columns = useMemo(
    () =>
      BASE_COLUMNS.filter((column) => {
        if (column.key === "feeders") return uploads.feeders;
        if (column.key === "transformers" || column.key === "subscribers") return uploads.transformers;
        return true;
      }),
    [uploads.feeders, uploads.transformers],
  );

  const missing = [
    uploads.feeders ? null : "Fiderlar",
    uploads.transformers ? null : "Transformatorlar",
  ].filter((label): label is string => label !== null);

  const { counts } = summary;
  const countHint = [
    counts.feeders != null ? `Fiderlar: ${num(counts.feeders)} ta` : null,
    counts.transformers != null ? `TP: ${num(counts.transformers)} ta` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Podstansiyalar"
        subtitle={`${formatDate(reportDate)} holatiga${
          counts.substations != null ? ` — ${num(counts.substations)} ta podstansiya` : ""
        }`}
      />

      <StatRow>
        <StatCard
          label="Podstansiyalar"
          value={num(counts.substations)}
          unit={counts.substations != null ? "ta" : undefined}
          icon={Factory}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={uploads.substations ? countHint || undefined : "Podstansiyalar yuklanmagan"}
        />
        <FlowStatCards summary={summary} missing="Podstansiyalar yuklanmagan" />
      </StatRow>

      <Card className="min-h-0 flex-1">
        {uploads.substations ? (
          <>
            <div className="flex shrink-0 items-center gap-2 pb-3">
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Nom, manzil yoki xodim..."
                label="Podstansiyalar ro’yxatidan qidirish"
                className="w-60"
              />
              <MissingTemplates labels={missing} />
              <span className="ml-auto shrink-0 text-[11px] text-ink-soft">
                {num(visible.length)} ta yozuv
              </span>
            </div>

            <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
              <RegistryTable
                columns={columns}
                emptyText={rows.length === 0 ? "Bu oyda podstansiya yo’q" : "So’rovga mos podstansiya topilmadi"}
                rows={visible.map((item) => {
                  const cells = rowCells(item);
                  return { key: item.id, cells: columns.map((column) => cells[column.key]) };
                })}
              />
            </div>
          </>
        ) : (
          <EmptyState
            variant="inline"
            title="Podstansiyalar yuklanmagan"
            description={`${periodLabel} uchun Podstansiyalar fayli yuklanmagan.`}
          />
        )}
      </Card>
    </div>
  );
}
