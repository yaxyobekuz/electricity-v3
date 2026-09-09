import { ExternalLink } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  Badge,
  DataTable,
  type TableColumn,
  type TableRow,
} from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";

type WorkStatus = "new" | "inProgress" | "planned";

interface PlannedWork {
  tp: string;
  work: string;
  status: WorkStatus;
  date: string;
}

const WORKS: readonly PlannedWork[] = [
  {
    tp: "TP-A303",
    work: "Transformatorni tekshirish",
    status: "new",
    date: "7-sentabr, 2026",
  },
  {
    tp: "TP-33",
    work: "Toka transformatorni ta\u2019mirlash",
    status: "inProgress",
    date: "23-avgust, 2026",
  },
  {
    tp: "TP-08",
    work: "Hisoblagich chipini almashtirish. Hamda, qayta texnik ko\u2019rikdan o\u2019tkazish",
    status: "planned",
    date: "Bugun",
  },
];

/**
 * Maketdagi ustun kengliklari: 96 / 319.56 / 96 / 96 (619.56px qatordan
 * 6px ichki bo'shliqlar ayirilgach). "Ish" ustuni chapga tekislangan,
 * qolganlari markazda.
 */
const COLUMNS: TableColumn[] = [
  { key: "tp", label: "Transformtator", grow: 96 },
  { key: "work", label: "Ish", grow: 319.56, align: "left" },
  { key: "status", label: "Holat", grow: 96 },
  { key: "date", label: "Sana", grow: 96 },
];

/**
 * "Yangi" nishoni maketda #EFF6FF fon + #3B82F6 matn, ya'ni `accent-blue`.
 * `Badge` ning `blue` toni brend ko'kini (#007CD2) beradi, shuning uchun bu
 * bitta holat mahalliy span bilan chiziladi - qolgan ikkitasi `Badge` ga mos.
 */
function StatusCell({ status }: { status: WorkStatus }) {
  if (status === "inProgress") return <Badge tone="green">Bajarilmoqda</Badge>;
  if (status === "planned") return <Badge tone="amber">Rejada</Badge>;
  return (
    <span className="flex justify-center">
      <span className="inline-flex shrink-0 rounded-full bg-tint-blue px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-accent-blue">
        Yangi
      </span>
    </span>
  );
}

const ROWS: TableRow[] = WORKS.map((item) => ({
  key: item.tp,
  cells: [
    // Maketda 1-ustun qolganlaridan qalinroq (medium).
    <span key="tp" className="font-medium">
      {item.tp}
    </span>,
    item.work,
    <StatusCell key="status" status={item.status} />,
    item.date,
  ],
}));

/** Fider sahifasining 4-qatoridagi "Rejalashtirilgan ishlar" kartasi (span-8, 209px). */
export function PlannedWorksCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Rejalashtirilgan ishlar">
        <IconPill icon={ExternalLink} label="Barcha ishlarni ochish" href="/works" />
      </CardHeader>
      <CardBody>
        <DataTable columns={COLUMNS} rows={ROWS} />
      </CardBody>
    </Card>
  );
}
