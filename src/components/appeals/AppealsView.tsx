import { CircleCheck, CircleX, Hourglass, MessagesSquare, TimerOff } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { FilterChip } from "@/components/ui/Filters";
import type { GlyphIcon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { type RegistryColumn, type RegistryRow, RegistryTable } from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { ALL_CHIP } from "@/components/violations/registry-params";
import {
  CELL_GUTTER,
  ClampText,
  ScopeActions,
  StaffCell,
  SubscriberCell,
  TransformerCell,
} from "@/components/violations/RegistryCells";
import { RegistryToolbar } from "@/components/violations/RegistryToolbar";
import type { AppealStatus } from "@/generated/prisma";
import { APPEAL_STATUS_LABEL, APPEAL_STATUS_ORDER } from "@/lib/domain/labels";
import { share } from "@/lib/domain/metrics";
import { formatDate, num, percent } from "@/lib/format";
import type { AppealRow } from "@/lib/queries/lists";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   "Holati" ko'rinishi
   --------------------------------------------------------------------------- */

const STATUS_STYLE: Record<
  AppealStatus,
  { icon: GlyphIcon; badge: string; dot: string; accent: string; tint: string }
> = {
  RESOLVED: {
    icon: CircleCheck,
    badge: "bg-tint-green text-accent-green",
    dot: "bg-accent-green",
    accent: "bg-accent-green",
    tint: "bg-tint-green",
  },
  IN_PROGRESS: {
    icon: Hourglass,
    badge: "bg-tint-blue text-accent-blue",
    dot: "bg-accent-blue",
    accent: "bg-accent-blue",
    tint: "bg-tint-blue",
  },
  // Rad etilgan - yakunlangan, lekin ijobiy emas: neytral kulrang.
  REJECTED: {
    icon: CircleX,
    badge: "bg-canvas text-ink-muted",
    dot: "bg-ink-soft",
    accent: "bg-ink-soft",
    tint: "bg-surface",
  },
  OVERDUE: {
    icon: TimerOff,
    badge: "bg-tint-red text-[#cf4646]",
    dot: "bg-accent-red",
    accent: "bg-accent-red",
    tint: "bg-tint-red",
  },
};

/**
 * Jadvaldagi holat nishoni - `DataTable` dagi `Badge` shaklida. Ikki yonida
 * ichki bo'shliq: tor ustunda nishon qisqaradi, qo'shni ustunga tegmaydi.
 */
function StatusBadge({ status }: { status: AppealStatus }) {
  const label = APPEAL_STATUS_LABEL[status];
  return (
    <span className="flex min-w-0 px-2">
      <span
        title={label}
        className={cn(
          "truncate rounded-full px-2 py-[2.5px] text-[10px] leading-3.25 font-semibold",
          STATUS_STYLE[status].badge,
        )}
      >
        {label}
      </span>
    </span>
  );
}

// Qoidabuzarliklar reestri bilan bir xil: matnli ustunlar chapga tekislangan,
// o'ng tomonida `CELL_GUTTER`. "Holati" ustuni eng uzun nishon ("Ijobiy hal
// etilgan") 1366px ekranda ham to'liq sig'adigan kenglikda.
const COLUMNS: RegistryColumn[] = [
  { key: "date", label: "Sana", grow: 13, align: "left" },
  { key: "text", label: "Murojaat", grow: 18, align: "left" },
  { key: "subscriber", label: "Abonent", grow: 17, align: "left" },
  { key: "transformer", label: "TP", grow: 12, align: "left" },
  { key: "address", label: "Manzil", grow: 15, align: "left" },
  { key: "status", label: "Holati", grow: 14 },
  { key: "staff", label: "Ma’sul xodim", grow: 13, align: "left" },
];

export interface AppealsViewProps {
  /** "Sentabr 2026" */
  periodLabel: string;
  /** `?scope=` obyekti; tuman - null. */
  scope: { kindLabel: string; name: string; href: string; clearHref: string } | null;
  /**
   * Qamrov bo'yicha yig'ma sonlar (`getScopeSummary().appeals`, qidiruv va
   * holat filtrisiz). Murojaatlar shu oyga yuklanmagan bo'lsa - null.
   */
  summary: { total: number; byStatus: Record<AppealStatus, number> } | null;
  /** `listAppeals` natijasi. */
  rows: AppealRow[];
  filteredTotal: number;
  /** Qamrov + qidiruv, holat filtrisiz. */
  chipCounts: Record<AppealStatus, number>;
  /** Qidiruv yoki holat filtri faol. */
  filtered: boolean;
}

/**
 * "Murojaatlar" reestri - "Elektr Murojaatlar.xlsx" shablonining tanlangan
 * oydagi qatorlari. Ko'rinishi qoidabuzarliklar reestri bilan bir xil.
 */
export function AppealsView({
  periodLabel,
  scope,
  summary,
  rows,
  filteredTotal,
  chipCounts,
  filtered,
}: AppealsViewProps) {
  const header = (
    <PageHeader
      title="Murojaatlar"
      subtitle={
        scope
          ? `${periodLabel} · ${scope.kindLabel}: ${scope.name} bo’yicha`
          : `${periodLabel} oyida kelib tushgan murojaatlar`
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
            title={`Murojaatlar ${periodLabel} oyi uchun yuklanmagan`}
            description="“Elektr Murojaatlar.xlsx” faylini shu oy uchun yuklang."
          />
        </div>
      </div>
    );
  }

  const chips: FilterChip<string>[] = [
    {
      value: ALL_CHIP,
      label: "Barchasi",
      count: APPEAL_STATUS_ORDER.reduce((total, status) => total + chipCounts[status], 0),
    },
    ...APPEAL_STATUS_ORDER.map((status) => ({
      value: status,
      label: APPEAL_STATUS_LABEL[status],
      count: chipCounts[status],
      dot: STATUS_STYLE[status].dot,
    })),
  ];

  const tableRows: RegistryRow[] = rows.map((row) => ({
    key: row.id,
    cells: [
      <span key="date" className={cn("truncate text-ink-muted", CELL_GUTTER)}>
        {formatDate(row.date)}
      </span>,
      <ClampText key="text" text={row.text} className="font-medium text-ink" />,
      <SubscriberCell key="subscriber" name={row.subscriberName} subscriber={row.subscriber} />,
      <TransformerCell key="transformer" transformer={row.transformer} feeder={row.feeder} />,
      <ClampText key="address" text={row.address} />,
      <StatusBadge key="status" status={row.status} />,
      <StaffCell key="staff" staff={row.staff} />,
    ],
  }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {header}

      <StatRow>
        <StatCard
          label="Jami murojaat"
          value={num(summary.total)}
          unit="ta"
          icon={MessagesSquare}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`${periodLabel} oyi`}
        />
        {APPEAL_STATUS_ORDER.map((status) => (
          <StatCard
            key={status}
            label={APPEAL_STATUS_LABEL[status]}
            value={num(summary.byStatus[status])}
            unit="ta"
            icon={STATUS_STYLE[status].icon}
            accent={STATUS_STYLE[status].accent}
            tint={STATUS_STYLE[status].tint}
            hint={
              // Murojaat yo'q oyda ulush yo'q - "Jami murojaatning —" chiqmasin.
              summary.total > 0
                ? `Jami murojaatning ${percent(share(summary.byStatus[status], summary.total))}`
                : undefined
            }
          />
        ))}
      </StatRow>

      <Card className="min-h-0 flex-1">
        <RegistryToolbar
          param="status"
          chips={chips}
          placeholder="Murojaat, abonent, TP, xodim..."
          searchLabel="Murojaatlar ro’yxatidan qidirish"
        >
          <span>{num(filteredTotal)} ta yozuv</span>
        </RegistryToolbar>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <RegistryTable
            columns={COLUMNS}
            rows={tableRows}
            emptyText={
              filtered
                ? "Tanlangan shartlarga mos murojaat topilmadi"
                : `${periodLabel} oyida murojaat qayd etilmagan`
            }
          />
        </div>
      </Card>
    </div>
  );
}
