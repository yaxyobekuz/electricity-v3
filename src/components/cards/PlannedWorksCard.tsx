import { ExternalLink } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn, type TableRow } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPill } from "@/components/ui/IconPill";

/**
 * Ta'mir ishi - TP ning "Joriy ta’mir sanasi" / "To’la ta’mir sanasi"
 * ustunlaridan. Holat (bajarilgan / rejalashtirilgan) sanani hisobot sanasi
 * bilan taqqoslab sahifada aniqlanadi.
 */
export interface RepairWork {
  /** Qator kaliti - bir transformatorda ikki xil ta'mir bo'lishi mumkin. */
  id: string;
  /** TP nomi. */
  tp: string;
  /** "Joriy ta’mir" / "To’la ta’mir". */
  work: string;
  /** Tayyor sana matni (`formatDate`). */
  date: string;
}

/**
 * Maketdagi ustun kengliklari: 96 / 319.56 / 96 (holat ustuni olib
 * tashlangach uning 96px i "Ish" ustuniga qo'shildi). "Ish" ustuni chapga
 * tekislangan, qolganlari markazda.
 */
const COLUMNS: TableColumn[] = [
  { key: "tp", label: "Transformator", grow: 96 },
  { key: "work", label: "Ish", grow: 415.56, align: "left" },
  { key: "date", label: "Sana", grow: 96 },
];

function buildWorkRows(works: readonly RepairWork[]): TableRow[] {
  return works.map((item) => ({
    key: item.id,
    cells: [
      // Maketda 1-ustun qolganlaridan qalinroq (medium).
      <span key="tp" className="font-medium">
        {item.tp}
      </span>,
      item.work,
      item.date,
    ],
  }));
}

/**
 * "Rejalashtirilgan ishlar" kartasi (span-8, 209px; bosh sahifada 298px):
 * ta'mir sanasi hisobot sanasidan keyin bo'lgan ishlar. Shablonda ish holati
 * yo'q - faqat sana.
 */
export function PlannedWorksCard({
  works,
  className,
}: {
  works: readonly RepairWork[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title="Rejalashtirilgan ishlar">
        <IconPill icon={ExternalLink} label="Barcha ishlarni ochish" href="/works" />
      </CardHeader>
      <CardBody>
        {works.length === 0 ? (
          <EmptyState
            variant="inline"
            action={false}
            title="Rejalashtirilgan ta’mir ishlari yo’q"
          />
        ) : (
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
            {/* Maketda bu jadval qatorlari 30px, oxirgisi 34px (XML: 4082:577). */}
            <DataTable
              columns={COLUMNS}
              rows={buildWorkRows(works)}
              rowHeight={30}
              lastRowHeight={34}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
