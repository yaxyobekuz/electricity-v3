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

export type CompletedWork = RepairWork;

/**
 * Ustun nisbatlari maketdagi 96 / 250.67 / 96 px dan olingan
 * (454.67px qatordan 6px ichki bo'shliqlar ayirilgach) -> 18 : 47 : 18.
 */
const COLUMNS: TableColumn[] = [
  { key: "tp", label: "Transformator", grow: 18 },
  { key: "work", label: "Bajarilgan ish", grow: 47, align: "left" },
  { key: "date", label: "Sana", grow: 18 },
];

export function buildWorkRows(works: readonly RepairWork[]): TableRow[] {
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
 * "Bajarilgan ishlar" kartasi (span-6, 209px): ta'mir sanasi hisobot
 * sanasidan oldin yoki unga teng bo'lgan ishlar.
 */
export function CompletedWorksCard({
  works,
  className,
}: {
  works: readonly RepairWork[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title="Bajarilgan ishlar">
        <IconPill icon={ExternalLink} label="Barcha ishlarni ochish" href="/works" />
      </CardHeader>
      <CardBody>
        {works.length === 0 ? (
          <EmptyState variant="inline" action={false} title="Bajarilgan ta’mir ishlari yo’q" />
        ) : (
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
            {/* Maketda bu jadval qatorlari 28px, oxirgisi 32px (XML: 4080:479). */}
            <DataTable
              columns={COLUMNS}
              rows={buildWorkRows(works)}
              rowHeight={28}
              lastRowHeight={32}
            />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
