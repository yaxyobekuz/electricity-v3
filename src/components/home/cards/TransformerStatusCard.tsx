import Link from "next/link";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  Badge,
  type BadgeTone,
  DataTable,
  type TableColumn,
} from "@/components/ui/DataTable";

// O'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, `string` proplarda
// (ustun nomlari) \u2019 escape sifatida yoziladi.

interface TransformerStatusRow {
  id: string;
  /** Jadvaldagi tartib raqami (maketda alohida ustun). */
  no: number;
  name: string;
  state: { label: string; tone: BadgeTone };
  /** Joriy yuklama, foizda. Rang shu son bo'yicha tanlanadi. */
  load: number;
  /** O'rtacha yuklama (kVt). */
  avg: string;
  /** Aloqada bo'lmagan hisoblagichlar soni. */
  offline: string;
  usage: string;
  loss: string;
}

const TRANSFORMERS: readonly TransformerStatusRow[] = [
  {
    id: "tp-066",
    no: 1,
    name: "TP-066",
    state: { label: "Ogohl.", tone: "amber" },
    load: 88,
    avg: "169.4",
    offline: "3 ta",
    usage: "126 026",
    loss: "13.7%",
  },
  {
    id: "tp-226",
    no: 2,
    name: "TP-226",
    state: { label: "Yaxshi", tone: "green" },
    load: 39,
    avg: "121.4",
    offline: "1 ta",
    usage: "90 297",
    loss: "9.8%",
  },
  {
    id: "tp-089",
    no: 3,
    name: "TP-089",
    state: { label: "Yaxshi", tone: "green" },
    load: 84,
    avg: "75.1",
    offline: "5 ta",
    usage: "55 889",
    loss: "6.1%",
  },
  {
    id: "tp-043",
    no: 4,
    name: "TP-043",
    state: { label: "Kritik", tone: "red" },
    load: 146,
    avg: "75.0",
    offline: "6 ta",
    usage: "55 816",
    loss: "6.0%",
  },
  {
    id: "tp-166",
    no: 5,
    name: "TP-166",
    state: { label: "Yaxshi", tone: "green" },
    load: 87,
    avg: "63.8",
    offline: "2 ta",
    usage: "47 449",
    loss: "5.1%",
  },
];

/**
 * Ustun kengliklari `grow` nisbati bilan beriladi. Karta tor (span-7 =
 * ~425px, jadval uchun ~381px), ustunlar esa sakkizta - shuning uchun
 * jadval `compact` rejimda (sarlavha 10px) va nomlar qisqartirilgan:
 * "O'rtacha" (o'rtacha yuklama), "Aloqa" (aloqada emas), "Iste'mol" (kWh).
 * Shu nisbatlarda eng uzun sarlavha ("Transformator", ~72px) 75px katakka
 * sig'adi - ya'ni birorta sarlavha kesilmaydi.
 */
const COLUMNS: TableColumn[] = [
  { key: "no", label: "\u2116", grow: 5, align: "center" },
  { key: "name", label: "Transformator", grow: 22, align: "left" },
  { key: "state", label: "Holat", grow: 15 },
  { key: "load", label: "Yuklama", grow: 13 },
  { key: "avg", label: "O\u2019rtacha", grow: 14 },
  { key: "offline", label: "Aloqa", grow: 11 },
  { key: "usage", label: "Iste\u2019mol", grow: 15 },
  { key: "loss", label: "Yo\u2019qotish", grow: 16 },
];

/**
 * Yuklama darajasining rangi: 100% dan oshsa transformator haddan tashqari
 * yuklangan (`trend-up` - yo'qotish kontekstidagi "yomon" qizil), 85% dan
 * oshsa ogohlantirish rangi, aks holda oddiy matn rangi.
 */
function loadClassName(load: number): string {
  if (load > 100) return "font-semibold text-trend-up";
  if (load > 85) return "text-accent-amber";
  return "";
}

/**
 * "Bosh sahifa" 3-qatori, chapdagi karta (span-7, 246px).
 *
 * Tana balandligi ~160px (232 - 32 sarlavha - 32 ichki bo'shliq - 8px
 * `CardBody` pt), `compact` jadval esa 150px (26 + 4x24 + 28) - beshala qator
 * to'liq sig'adi. Skroll o'ramchisi baribir qoldirilgan: pastroq ekranda
 * oxirgi qator kesilib qolmasin.
 */
export function TransformerStatusCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Transformatorlar holati">
        <Link
          href="/transformers"
          className="shrink-0 text-[11px] font-medium text-brand transition-opacity hover:opacity-70"
        >
          Barchasi (51)
        </Link>
      </CardHeader>

      <CardBody>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <DataTable
            compact
            /* Sarlavha katagining o'z leading'i yo'q - tor kartada qator
               balandligi oshib ketmasligi uchun zich `leading-tight`. */
            className="leading-tight"
            columns={COLUMNS}
            rows={TRANSFORMERS.map((row) => ({
              key: row.id,
              cells: [
                row.no,
                <span key="name" className="font-medium">
                  {row.name}
                </span>,
                <Badge key="state" tone={row.state.tone}>
                  {row.state.label}
                </Badge>,
                <span key="load" className={loadClassName(row.load)}>
                  {row.load}
                </span>,
                row.avg,
                row.offline,
                row.usage,
                row.loss,
              ],
            }))}
          />
        </div>
      </CardBody>
    </Card>
  );
}
