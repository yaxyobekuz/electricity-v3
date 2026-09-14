import { ExternalLink } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn, type TableRow } from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";

export interface CompletedWork {
  /** Qator kaliti - bir transformatorda bir nechta ish bo'lishi mumkin. */
  id: string;
  tp: string;
  work: string;
  date: string;
}

const WORKS: readonly CompletedWork[] = [
  { id: "01-xatlov", tp: "TP-01", work: "Xatlov o’tkazish", date: "21-avgust, 2026" },
  {
    id: "004-repair",
    tp: "TP-004",
    work: "Toka transformatorni ta’mirlash",
    date: "1-avgust, 2026",
  },
  { id: "005-meter", tp: "TP-005", work: "Hisoblagich o’rnatish", date: "18-avgust, 2026" },
];

/**
 * Ustun nisbatlari maketdagi 96 / 250.67 / 96 px dan olingan
 * (454.67px qatordan 6px ichki bo'shliqlar ayirilgach) -> 18 : 47 : 18.
 */
const COLUMNS: TableColumn[] = [
  { key: "tp", label: "Transformtator", grow: 18 },
  { key: "work", label: "Bajarilgan Ish", grow: 47, align: "left" },
  { key: "date", label: "Sana", grow: 18 },
];

function buildRows(works: readonly CompletedWork[]): TableRow[] {
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
 * Fider sahifasining 4-qatoridagi "Bajarilgan ishlar" kartasi (span-6, 209px).
 * Transformator sahifasida ro'yxat o'sha TP ishlaridan - `works`.
 */
export function CompletedWorksCard({
  works = WORKS,
  className,
}: {
  works?: readonly CompletedWork[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title="Bajarilgan ishlar">
        <IconPill icon={ExternalLink} label="Barcha ishlarni ochish" href="/works" />
      </CardHeader>
      <CardBody>
        {/* Maketda bu jadval qatorlari 28px, oxirgisi 32px (XML: 4080:479). */}
        <DataTable columns={COLUMNS} rows={buildRows(works)} rowHeight={28} lastRowHeight={32} />
      </CardBody>
    </Card>
  );
}
