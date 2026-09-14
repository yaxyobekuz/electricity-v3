import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { type RegistryColumn, type RegistryRow, RegistryTable } from "@/components/ui/RegistryTable";
import { TEMPLATE_LABEL, TEMPLATE_ORDER } from "@/lib/domain/labels";
import { formatDate, formatDateTime, num } from "@/lib/format";
import type { CoverageCell, CoverageRow } from "@/lib/import/types";

const COLUMNS: RegistryColumn[] = [
  { key: "month", label: "Oy", grow: 14, align: "left" },
  ...TEMPLATE_ORDER.map((type) => ({ key: type, label: TEMPLATE_LABEL[type], grow: 12 })),
];

function Cell({ cell }: { cell: CoverageCell }) {
  if (cell.status === "COMPLETED") {
    return (
      <span
        className="flex min-w-0 flex-col items-center gap-0.5 leading-none"
        title={`Yuklangan: ${formatDateTime(cell.createdAt)}`}
      >
        <Badge tone="green">{num(cell.totalRows)} qator</Badge>
        <span className="truncate text-[10px] text-ink-soft">{formatDate(cell.reportDate)}</span>
      </span>
    );
  }
  if (cell.status === "FAILED") {
    return (
      <span title={`Urinish: ${formatDateTime(cell.createdAt)}`}>
        <Badge tone="red">Rad etilgan</Badge>
      </span>
    );
  }
  return <span className="text-[11px] text-ink-soft">Yuklanmagan</span>;
}

/**
 * Qamrov matritsasi: har bir oy uchun qaysi shablon yuklangan. Katakdagi son -
 * oxirgi muvaffaqiyatli yuklashdagi qatorlar, sana - varaq nomidagi sana.
 */
export function CoverageCard({ rows }: { rows: CoverageRow[] }) {
  const tableRows: RegistryRow[] = rows.map((row) => ({
    key: row.periodId,
    cells: [
      <span key="month" className="flex min-w-0 flex-col leading-tight">
        <span className="truncate font-semibold text-ink">{row.label}</span>
        <span className="truncate text-[10px] text-ink-soft">{formatDate(row.reportDate)} holatiga</span>
      </span>,
      ...TEMPLATE_ORDER.map((type) => <Cell key={type} cell={row.cells[type]} />),
    ],
  }));

  return (
    <Card className="h-auto!">
      <CardHeader title="Oylar bo’yicha qamrov">
        <span className="text-[11px] text-ink-soft">{num(rows.length)} ta oy</span>
      </CardHeader>
      <CardBody>
        {rows.length === 0 ? (
          <EmptyState
            variant="inline"
            action={false}
            title="Hali birorta oy yuklanmagan"
            description="Fayllar saqlangach, har bir oy uchun qaysi shablon yuklangani shu yerda ko’rinadi"
          />
        ) : (
          <div className="max-h-[360px] overflow-y-auto scrollbar-none">
            <RegistryTable columns={COLUMNS} rows={tableRows} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
