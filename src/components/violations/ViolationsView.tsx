import { Building2, ClipboardList, HandCoins, ShieldCheck, UserRound } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FilterChip } from "@/components/ui/Filters";
import type { GlyphIcon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { type RegistryColumn, type RegistryRow, RegistryTable } from "@/components/ui/RegistryTable";
import { StatCard } from "@/components/ui/StatCard";
import type { ViolatorType } from "@/generated/prisma";
import { VIOLATOR_TYPE_LABEL, VIOLATOR_TYPE_ORDER } from "@/lib/domain/labels";
import { energy, formatDate, money, num, scaled } from "@/lib/format";
import type { ViolationRow } from "@/lib/queries/lists";
import { cn } from "@/lib/ui/cn";

import { ALL_CHIP } from "./registry-params";
import {
  CELL_GUTTER,
  ClampText,
  ScopeActions,
  StaffCell,
  SubscriberCell,
  TransformerCell,
} from "./RegistryCells";
import { RegistryToolbar } from "./RegistryToolbar";

/* ---------------------------------------------------------------------------
   Qoidabuzar turi ko'rinishi (ohanglar `ViolationsCard` bilan bir xil)
   --------------------------------------------------------------------------- */

const TYPE_STYLE: Record<ViolatorType, { icon: GlyphIcon; dot: string; accent: string; tint: string }> = {
  LEGAL: { icon: Building2, dot: "bg-accent-amber", accent: "bg-accent-amber", tint: "bg-tint-amber" },
  INDIVIDUAL: { icon: UserRound, dot: "bg-accent-red", accent: "bg-accent-red", tint: "bg-tint-red" },
  INNOCENT: { icon: ShieldCheck, dot: "bg-accent-green", accent: "bg-accent-green", tint: "bg-tint-green" },
};

// Matnli ustunlar chapga tekislangan (o'ng tomonida `CELL_GUTTER`), zarar
// summalari - oxirida, o'ngga: raqam matnga yopishib qolmaydi. Oxirgi ustun
// sarlavhasi to'liq sig'adigan kenglikda - tor ekranda qisqargan qo'shni
// sarlavha unga yopishmasin.
const COLUMNS: RegistryColumn[] = [
  { key: "date", label: "Sana", grow: 13, align: "left" },
  { key: "subscriber", label: "Abonent", grow: 16, align: "left" },
  { key: "type", label: "Turi", grow: 9, align: "left" },
  { key: "transformer", label: "TP", grow: 12, align: "left" },
  { key: "address", label: "Manzil", grow: 13, align: "left" },
  { key: "staff", label: "Ma’sul xodim", grow: 13, align: "left" },
  { key: "damageUzs", label: "Keltirilgan zarar (so’m)", grow: 13, align: "right" },
  { key: "damageKwh", label: "Taxminiy zarar (kWh)", grow: 15, align: "right" },
];

export interface ViolationsViewProps {
  /** "Sentabr 2026" */
  periodLabel: string;
  /** `?scope=` obyekti; tuman - null. */
  scope: { kindLabel: string; name: string; href: string; clearHref: string } | null;
  /**
   * Qamrov bo'yicha yig'ma sonlar (`getScopeSummary().violations`, qidiruv
   * va tur filtrisiz). Qoidabuzarliklar shu oyga yuklanmagan bo'lsa - null.
   */
  summary: {
    total: number;
    byType: Record<ViolatorType, number>;
    damageUzs: number;
    damageKwh: number;
    damageUzsByType: Record<ViolatorType, number>;
  } | null;
  /** `listViolations` natijasi: qatorlar, filtrdan keyingi son va chip sonlari. */
  rows: ViolationRow[];
  filteredTotal: number;
  /** Qamrov + qidiruv, tur filtrisiz. */
  chipCounts: Record<ViolatorType, number>;
  /** Qidiruv yoki tur filtri faol - bo'sh jadval matni shunga qarab. */
  filtered: boolean;
}

/**
 * "Qoidabuzarliklar" reestri - "Elektr Qoidabuzarliklar.xlsx" shablonining
 * tanlangan oydagi qatorlari (`.claude/docs/malumotlar.md`, 5-bo'lim).
 *
 * Sahifa o'zi skroll bo'lmaydi - jadval kartaning ichida skroll qilinadi,
 * yuqoridagi yo'lak va statistika qatori doim ko'rinib turadi.
 */
export function ViolationsView({
  periodLabel,
  scope,
  summary,
  rows,
  filteredTotal,
  chipCounts,
  filtered,
}: ViolationsViewProps) {
  const header = (
    <PageHeader
      title="Qoidabuzarliklar"
      subtitle={
        scope
          ? `${periodLabel} · ${scope.kindLabel}: ${scope.name} bo’yicha`
          : `${periodLabel} oyida qayd etilgan holatlar`
      }
    >
      {scope ? <ScopeActions {...scope} /> : null}
    </PageHeader>
  );

  if (!summary) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        {header}
        <div className="min-h-0 flex-1">
          <EmptyState
            title={`Qoidabuzarliklar ${periodLabel} oyi uchun yuklanmagan`}
            description="“Elektr Qoidabuzarliklar.xlsx” faylini shu oy uchun yuklang."
          />
        </div>
      </div>
    );
  }

  const damageUzs = scaled(summary.damageUzs, "so’m");

  const chips: FilterChip<string>[] = [
    {
      value: ALL_CHIP,
      label: "Barchasi",
      count: VIOLATOR_TYPE_ORDER.reduce((total, type) => total + chipCounts[type], 0),
    },
    ...VIOLATOR_TYPE_ORDER.map((type) => ({
      value: type,
      label: VIOLATOR_TYPE_LABEL[type],
      count: chipCounts[type],
      dot: TYPE_STYLE[type].dot,
    })),
  ];

  const tableRows: RegistryRow[] = rows.map((row) => ({
    key: row.id,
    cells: [
      <span key="date" className={cn("truncate text-ink-muted", CELL_GUTTER)}>
        {formatDate(row.date)}
      </span>,
      <SubscriberCell key="subscriber" name={row.subscriberName} subscriber={row.subscriber} />,
      <span key="type" className={cn("flex min-w-0 items-center gap-1.5", CELL_GUTTER)}>
        <span className={cn("size-1.5 shrink-0 rounded-full", TYPE_STYLE[row.violatorType].dot)} aria-hidden />
        <span className="truncate">{VIOLATOR_TYPE_LABEL[row.violatorType]}</span>
      </span>,
      <TransformerCell
        key="transformer"
        transformer={row.transformer}
        feeder={row.feeder}
        substation={row.substation}
      />,
      <ClampText key="address" text={row.address} />,
      <StaffCell key="staff" staff={row.staff} />,
      <span
        key="damageUzs"
        className={cn("truncate tabular-nums", row.damageUzs > 0 ? "font-medium text-ink" : "text-ink-soft")}
      >
        {num(row.damageUzs)}
      </span>,
      <span
        key="damageKwh"
        className={cn("truncate pl-3 tabular-nums", row.damageKwh > 0 ? "text-ink" : "text-ink-soft")}
      >
        {num(row.damageKwh)}
      </span>,
    ],
  }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {header}

      {/*
        `StatRow` bilan bir xil balandlik va oraliq, lekin zarar kartasi
        kengroq (3:2): "49,5 mln so’m" 1366px ekranda ham qisqarmay sig'adi.
      */}
      <div className="grid h-26 shrink-0 grid-cols-[repeat(4,minmax(0,2fr))_minmax(0,3fr)] gap-2">
        <StatCard
          label="Jami holat"
          value={num(summary.total)}
          unit="ta"
          icon={ClipboardList}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={`${periodLabel} oyi`}
        />
        {VIOLATOR_TYPE_ORDER.map((type) => (
          <StatCard
            key={type}
            label={VIOLATOR_TYPE_LABEL[type]}
            value={num(summary.byType[type])}
            unit="ta"
            icon={TYPE_STYLE[type].icon}
            accent={TYPE_STYLE[type].accent}
            tint={TYPE_STYLE[type].tint}
            hint={`Zarar: ${money(summary.damageUzsByType[type])}`}
          />
        ))}
        {/* kWh alohida karta emas, izohda: oltita karta qatorga sig'masdi. */}
        <StatCard
          label="Keltirilgan zarar"
          value={damageUzs.value}
          unit={damageUzs.unit}
          icon={HandCoins}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`Taxminiy zarar: ${energy(summary.damageKwh)}`}
        />
      </div>

      <Card className="min-h-0 flex-1">
        <RegistryToolbar
          param="type"
          chips={chips}
          placeholder="Abonent, TP, manzil, xodim..."
          searchLabel="Qoidabuzarliklar ro’yxatidan qidirish"
        >
          <span>{num(filteredTotal)} ta yozuv</span>
        </RegistryToolbar>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <RegistryTable
            columns={COLUMNS}
            rows={tableRows}
            emptyText={
              filtered
                ? "Tanlangan shartlarga mos qoidabuzarlik topilmadi"
                : `${periodLabel} oyida qoidabuzarlik qayd etilmagan`
            }
          />
        </div>
      </Card>
    </div>
  );
}
