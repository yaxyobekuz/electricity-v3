import { ExternalLink } from "lucide-react";

import { buildWorkRows, type RepairWork } from "@/components/cards/CompletedWorksCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPill } from "@/components/ui/IconPill";

export type PlannedWork = RepairWork;

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
