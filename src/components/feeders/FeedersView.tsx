"use client";

// Qidiruv holat (`useState`) talab qiladi - shuning uchun ro'yxatning o'zi
// mijoz komponenti. Qamrov filtri (`?scope=`) esa serverda qo'llanadi:
// "chip"lar oddiy havola, bosilganda sahifa yangi qamrov bilan chiziladi.

import { Workflow, X } from "lucide-react";
import Link from "next/link";
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
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { type RegistryColumn, RegistryTable } from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { formatDate, num, percent } from "@/lib/format";
import { cn } from "@/lib/ui/cn";

/** Jadval qatori - `listFeeders` qatorining mijozga kerakli qismi. */
export interface FeederListItem {
  id: string;
  name: string;
  substation: { id: string; name: string };
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  lossPercent: number | null;
  /** Transformatorlar shu oyga yuklanmagan bo'lsa - null. */
  transformerCount: number | null;
  /** Σ TP holatlaridagi abonentlar; Transformatorlar yuklanmagan bo'lsa - null. */
  subscriberCount: number | null;
  capacityKva: number | null;
  staffName: string | null;
  address: string | null;
}

/** Podstansiya filtri tugmasi: shu oydagi fiderlari soni bilan. */
export interface SubstationChip {
  id: string;
  name: string;
  count: number;
}

/** Faol qamrov filtri: "Podstansiya: Baliqchi". */
export interface FeederFilter {
  label: string;
  name: string;
  /** Filtr obyektining sahifasi. */
  href: string;
}

export interface FeedersSummary extends RegistryFlowSummary {
  /** Xulosa qamrovi - "yuklanmagan" izohini tanlash uchun. */
  scope: "district" | "substation" | "feeder" | "transformer";
  /** `getScopeSummary(qamrov).counts`; shablon yuklanmagan bo'lsa null. */
  counts: { feeders: number | null; transformers: number | null };
}

const BASE_COLUMNS: RegistryColumn[] = [
  { key: "name", label: "Nomi", grow: 12, align: "left" },
  { key: "substation", label: "Podstansiya", grow: 11, align: "left" },
  { key: "total", label: "Umumiy oqim, kWh", grow: 11 },
  { key: "useful", label: "Foydali oqim, kWh", grow: 11 },
  { key: "loss", label: "Yo’qotish, kWh", grow: 10 },
  { key: "lossPercent", label: "Yo’qotish, %", grow: 8 },
  { key: "transformers", label: "TP", grow: 6 },
  { key: "subscribers", label: "Abonentlar", grow: 8 },
  { key: "capacity", label: "Quvvati, kVA", grow: 9 },
  { key: "staff", label: "Ma’sul xodim", grow: 14, align: "left" },
  { key: "address", label: "Manzil", grow: 16, align: "left" },
];

function rowCells(item: FeederListItem): Record<string, ReactNode> {
  return {
    name: (
      <CellLink href={`/feeders/${item.id}`} strong>
        {item.name}
      </CellLink>
    ),
    substation: <CellLink href={`/substations/${item.substation.id}`}>{item.substation.name}</CellLink>,
    total: num(item.totalKwh),
    useful: num(item.usefulKwh),
    loss: num(item.lossKwh),
    lossPercent: percent(item.lossPercent),
    transformers: num(item.transformerCount),
    subscribers: num(item.subscriberCount),
    capacity: num(item.capacityKva),
    staff: <StaffCell name={item.staffName} />,
    address: <TextCell value={item.address} />,
  };
}

/** `/feeders?scope=...&q=...` - qidiruv matni filtrlar orasida saqlanadi. */
function feedersHref(scope: string | null, query: string): string {
  const params = new URLSearchParams();
  if (scope) params.set("scope", scope);
  if (query.trim()) params.set("q", query.trim());
  const search = params.toString();
  return search ? `/feeders?${search}` : "/feeders";
}

/** Energiya yo'q bo'lganda izoh - qamrov turiga qarab. */
const MISSING_ENERGY: Record<FeedersSummary["scope"], string> = {
  district: "Podstansiyalar yuklanmagan",
  substation: "Podstansiya holati yo’q",
  feeder: "Fider holati yo’q",
  transformer: "Fider holati yo’q",
};

/** `FilterChips` bilan bir xil ko'rinish, lekin havola (server filtri). */
function ChipLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
        active ? "bg-brand text-white" : "bg-canvas text-ink-muted hover:bg-black/5",
      )}
    >
      <span className="whitespace-nowrap">{label}</span>
      <span className={cn("font-semibold", active ? "text-white" : "text-ink")}>{num(count)}</span>
    </Link>
  );
}

/**
 * Fiderlar ro'yxati (1476x1064 ish maydoni) - tuzilma podstansiyalar
 * ro'yxati bilan bir xil: yo'lak 56, ko'rsatkichlar 104, qolgani - jadval
 * kartasi (faqat jadval ichi skroll qilinadi).
 *
 * Asboblar qatorida: qidiruv (nom, podstansiya, manzil, xodim), podstansiya
 * filtrlari va faol qamrov belgisi (tozalash tugmasi bilan).
 */
export function FeedersView({
  periodLabel,
  reportDate,
  initialQuery,
  rows,
  totalFeeders,
  chips,
  activeSubstationId,
  filter,
  uploads,
  summary,
}: {
  periodLabel: string;
  /** Davrning hisobot sanasi, ISO. */
  reportDate: string;
  /** `?q=` qiymati. */
  initialQuery: string;
  /** Qamrov filtri qo'llangan qatorlar. */
  rows: readonly FeederListItem[];
  /** Shu oydagi barcha fiderlar soni ("Barchasi" tugmasi). */
  totalFeeders: number;
  chips: readonly SubstationChip[];
  /** Podstansiya bo'yicha filtr faol bo'lsa - uning id si. */
  activeSubstationId: string | null;
  /** Faol filtr; `"unknown"` - `?scope=` dagi obyekt topilmadi. */
  filter: FeederFilter | "unknown" | null;
  uploads: { feeders: boolean; transformers: boolean };
  summary: FeedersSummary;
}) {
  const [query, onQueryChange] = useSearchQuery(initialQuery);

  const visible = useMemo(
    () =>
      rows.filter((item) =>
        matchesQuery(query, [item.name, item.substation.name, item.address, item.staffName]),
      ),
    [rows, query],
  );

  const columns = useMemo(
    () =>
      BASE_COLUMNS.filter(
        (column) =>
          uploads.transformers || (column.key !== "transformers" && column.key !== "subscribers"),
      ),
    [uploads.transformers],
  );

  const { counts } = summary;
  const noFilter = filter === null;
  // Podstansiya filtri odatda "chip" bilan ko'rinadi; shu oyda fideri yo'q
  // podstansiyaning chipi yo'q - unda ham alohida belgi (tozalash tugmasi bilan).
  const showFilterBadge =
    filter !== null &&
    (activeSubstationId === null || !chips.some((chip) => chip.id === activeSubstationId));
  // Yig'indilar filtr qamrovi bo'yicha - izohda qamrov nomi ham turadi.
  const subtitle = [
    `${formatDate(reportDate)} holatiga`,
    filter && filter !== "unknown" ? `${filter.label}: ${filter.name}` : null,
    counts.feeders != null ? `${num(counts.feeders)} ta fider` : null,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader title="Fiderlar" subtitle={subtitle} />

      <StatRow>
        <StatCard
          label="Fiderlar"
          value={num(counts.feeders)}
          unit={counts.feeders != null ? "ta" : undefined}
          icon={Workflow}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={
            filter === "unknown"
              ? "Obyekt topilmadi"
              : !uploads.feeders
                ? "Fiderlar yuklanmagan"
                : counts.transformers != null
                  ? `TP: ${num(counts.transformers)} ta`
                  : "Transformatorlar yuklanmagan"
          }
        />
        <FlowStatCards
          summary={summary}
          missing={filter === "unknown" ? "Obyekt topilmadi" : MISSING_ENERGY[summary.scope]}
        />
      </StatRow>

      <Card className="min-h-0 flex-1">
        {uploads.feeders ? (
          <>
            <div className="flex shrink-0 items-center gap-2 pb-3">
              <SearchField
                value={query}
                onChange={onQueryChange}
                placeholder="Nom, podstansiya, manzil, xodim..."
                label="Fiderlar ro’yxatidan qidirish"
                className="w-60 shrink-0"
              />

              <nav aria-label="Podstansiya bo’yicha filtr" className="scrollbar-none flex min-w-0 items-center gap-1.5 overflow-x-auto">
                <ChipLink href={feedersHref(null, query)} active={noFilter} label="Barchasi" count={totalFeeders} />
                {chips.map((chip) => (
                  <ChipLink
                    key={chip.id}
                    href={feedersHref(`substation:${chip.id}`, query)}
                    active={chip.id === activeSubstationId}
                    label={chip.name}
                    count={chip.count}
                  />
                ))}
              </nav>

              {showFilterBadge ? (
                <span className="flex h-8 min-w-0 shrink items-center gap-1.5 rounded-lg bg-tint-blue pr-1 pl-3 text-xs text-ink">
                  {filter === "unknown" ? (
                    <span className="truncate font-medium text-accent-red">Filtrdagi obyekt topilmadi</span>
                  ) : (
                    <span className="truncate">
                      <span className="text-ink-muted">{filter.label}: </span>
                      <Link href={filter.href} className="font-semibold hover:text-brand hover:underline">
                        {filter.name}
                      </Link>
                    </span>
                  )}
                  <Link
                    href={feedersHref(null, query)}
                    aria-label="Filtrni tozalash"
                    title="Filtrni tozalash"
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-black/5 hover:text-ink"
                  >
                    <Icon icon={X} size={14} />
                  </Link>
                </span>
              ) : null}

              <MissingTemplates labels={uploads.transformers ? [] : ["Transformatorlar"]} />
              <span className="ml-auto shrink-0 text-[11px] text-ink-soft">
                {num(visible.length)} ta yozuv
              </span>
            </div>

            <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
              <RegistryTable
                columns={columns}
                emptyText={
                  filter === "unknown"
                    ? "Filtrdagi obyekt topilmadi"
                    : rows.length === 0
                      ? "Bu qamrovda shu oyda fider yo’q"
                      : "So’rovga mos fider topilmadi"
                }
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
            title="Fiderlar yuklanmagan"
            description={`${periodLabel} uchun Fiderlar fayli yuklanmagan.`}
          />
        )}
      </Card>
    </div>
  );
}
