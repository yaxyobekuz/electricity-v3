import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/DataTable";
import { type RegistryColumn, type RegistryRow, RegistryTable } from "@/components/ui/RegistryTable";
import { TEMPLATE_LABEL } from "@/lib/domain/labels";
import { formatDateTime, monthLabel, num, parseMonthKey } from "@/lib/format";
import type { ImportHistoryItem } from "@/lib/import/types";

import { fileSizeLabel } from "./templateFiles";

const COLUMNS: RegistryColumn[] = [
  { key: "time", label: "Vaqt", grow: 12, align: "left" },
  { key: "file", label: "Fayl", grow: 20, align: "left" },
  { key: "template", label: "Shablon", grow: 11 },
  { key: "month", label: "Oy", grow: 10 },
  { key: "status", label: "Holat", grow: 9 },
  { key: "rows", label: "Qator", grow: 7 },
  { key: "changes", label: "Qo’shildi / yangilandi / o’chirildi", grow: 16 },
  { key: "note", label: "Izoh", grow: 22, align: "left" },
];

/** Oxirgi yuklashlar - muvaffaqiyatli va rad etilganlar. */
export function ImportHistoryCard({ items }: { items: ImportHistoryItem[] }) {
  const rows: RegistryRow[] = items.map((item) => {
    const done = item.status === "COMPLETED";
    const note = done
      ? item.warningCount > 0
        ? `${num(item.warningCount)} ta ogohlantirish`
        : "—"
      : `${num(item.errorCount)} ta xato${item.firstError ? `: ${item.firstError}` : ""}`;
    return {
      key: item.id,
      cells: [
        <span key="time" className="truncate text-ink-muted">
          {formatDateTime(item.createdAt)}
        </span>,
        <span key="file" className="truncate font-medium" title={`${item.fileName} · ${fileSizeLabel(item.fileSize)}`}>
          {item.fileName}
        </span>,
        <span key="template" className="truncate">
          {TEMPLATE_LABEL[item.templateType]}
        </span>,
        <span key="month" className="truncate">
          {item.month ? monthLabel(parseMonthKey(item.month)) : "—"}
        </span>,
        <Badge key="status" tone={done ? "green" : "red"}>
          {done ? "Saqlangan" : "Rad etilgan"}
        </Badge>,
        <span key="rows" className="truncate tabular-nums">
          {num(item.totalRows)}
        </span>,
        <span key="changes" className="truncate tabular-nums text-ink-muted">
          {done ? `${num(item.createdRows)} / ${num(item.updatedRows)} / ${num(item.removedRows)}` : "—"}
        </span>,
        <span key="note" className={done ? "truncate text-ink-soft" : "truncate text-state-bad"} title={note}>
          {note}
        </span>,
      ],
    };
  });

  return (
    <Card className="h-auto!">
      <CardHeader title="Yuklash tarixi">
        <span className="text-[11px] text-ink-soft">oxirgi {num(items.length)} ta</span>
      </CardHeader>
      <CardBody>
        <div className="max-h-[440px] overflow-y-auto scrollbar-none">
          <RegistryTable columns={COLUMNS} rows={rows} emptyText="Hali yuklash bo’lmagan" />
        </div>
      </CardBody>
    </Card>
  );
}
