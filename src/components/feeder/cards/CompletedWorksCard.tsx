import { ExternalLink } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn, type TableRow } from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";

interface CompletedWork {
  tp: string;
  work: string;
  date: string;
}

const WORKS: readonly CompletedWork[] = [
  { tp: "TP-01", work: "Xatlov o\u2019tkazish", date: "21-avgust, 2026" },
  { tp: "TP-004", work: "Toka transformatorni ta\u2019mirlash", date: "1-avgust, 2026" },
  { tp: "TP-005", work: "Hisoblagich o\u2019rnatish", date: "18-avgust, 2026" },
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

const ROWS: TableRow[] = WORKS.map((item) => ({
  key: item.tp,
  cells: [
    // Maketda 1-ustun qolganlaridan qalinroq (medium).
    <span key="tp" className="font-medium">
      {item.tp}
    </span>,
    item.work,
    item.date,
  ],
}));

/** Fider sahifasining 4-qatoridagi "Bajarilgan ishlar" kartasi (span-6, 209px). */
export function CompletedWorksCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Bajarilgan ishlar">
        <IconPill icon={ExternalLink} label="Barcha ishlarni ochish" href="/works" />
      </CardHeader>
      <CardBody>
        <DataTable columns={COLUMNS} rows={ROWS} />
      </CardBody>
    </Card>
  );
}
