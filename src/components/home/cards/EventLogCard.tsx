import Link from "next/link";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  Badge,
  type BadgeTone,
  DataTable,
  type TableColumn,
} from "@/components/ui/DataTable";
import { cn } from "@/lib/ui/cn";

// O'zbekcha apostrof - U+2019: JSX matnida va JSX atribut satrlarida
// `&rsquo;` (JSX ularni o'zi dekodlaydi), oddiy `const` satrlarida esa
// `\u2019` escape sifatida yoziladi.

interface EventRow {
  id: string;
  /** Hodisa ro'yxatga olingan vaqt (HH:MM). */
  time: string;
  /** Transformator yoki liniya nomi. */
  asset: string;
  event: string;
  state: { label: string; tone: BadgeTone };
}

/**
 * Nom yonidagi 6px doira hodisaning joriy holatini bildiradi - nishon bilan
 * bir xil ma'noni tashiydi, shuning uchun rangi `state.tone` dan olinadi.
 * Qatorda alohida `dot` maydoni saqlansa, ikki manba vaqt o'tib bir-biriga
 * zid bo'lib qolardi (masalan "Yechildi" nishoni yonida qizil doira).
 *
 * Yashil/sariq aksent tokenlariga aynan to'g'ri keladi; qizil esa kelmaydi
 * (`accent-red` = #ff383c maketdagidan yorqinroq), shuning uchun u aniq hex
 * bilan yoziladi - `SituationCenterCard` dagi filtr doiralari kabi.
 */
const STATE_DOT: Record<BadgeTone, string> = {
  red: "bg-[#ef4444]",
  amber: "bg-accent-amber",
  green: "bg-accent-green",
  blue: "bg-accent-blue",
  purple: "bg-accent-purple",
};

const EVENTS: readonly EventRow[] = [
  {
    id: "tp-066-load",
    time: "10:32",
    asset: "TP-066",
    event: "Yuklama 92%",
    state: { label: "Kritik", tone: "red" },
  },
  {
    id: "tp-043-voltage",
    time: "09:47",
    asset: "TP-043",
    event: "Kuchlanish pasayishi",
    state: { label: "Ogohl.", tone: "amber" },
  },
  {
    id: "tp-089-meter",
    time: "08:15",
    asset: "TP-089",
    event: "Hisoblagich o\u2019g\u2019irligi",
    state: { label: "Yechildi", tone: "green" },
  },
  {
    id: "l-10kv-outage",
    time: "06:32",
    asset: "L-10 kV",
    event: "O\u2019chish",
    state: { label: "Yechildi", tone: "green" },
  },
  {
    id: "tp-226-temp",
    time: "04:21",
    asset: "TP-226",
    event: "Harorat 78\u00b0C",
    state: { label: "Ogohl.", tone: "amber" },
  },
];

/**
 * Ustun nisbatlari span-6 kartaning aniq kengligiga qarab tanlangan: 363px
 * karta -> 331px ichki maydon -> jadvalning `px-1.5` idan keyin 319px.
 * 10/24/36/16 (jami 86) taqsimoti ~37 / ~89 / ~133 / ~59 px beradi.
 *
 * Eng uzun kataklar shu kengliklarga sig'adi: "Kuchlanish pasayishi" (~118px)
 * va "Hisoblagich o'g'irligi" (~124px) hodisa ustuniga, "Ogohl." nishoni
 * (~48px) holat ustuniga. Ustun nomi ham kesilmasligi kerak - shuning uchun
 * "Transformator / Liniya" (11px yarim qalin, ~125px) o'rniga "Obyekt": u
 * transformatorni ham, "L-10 kV" liniyasini ham qamrab oladi.
 */
const COLUMNS: TableColumn[] = [
  { key: "time", label: "Vaqt", grow: 10 },
  { key: "asset", label: "Obyekt", grow: 23, align: "left" },
  { key: "event", label: "Hodisa", grow: 34, align: "left" },
  { key: "state", label: "Holat", grow: 18 },
];

/**
 * Bosh sahifa, 4-qator: "Hodisa loglari" (363x262).
 *
 * Foydali balandlik 184px (256 - 32 padding - 32 sarlavha - 8 `CardBody` pt).
 * `compact` jadval 150px (26 + 4x24 + 28), havola bilan birga 173px - beshala
 * qator ham, havola ham to'liq ko'rinadi. Skroll o'ramchisi pastroq ekran
 * uchun qoldirilgan.
 */
export function EventLogCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Hodisa loglari (so&rsquo;nggi 5 ta)" />

      <CardBody>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          {/* 11px sarlavha katagining o'z leading'i yo'q - ota elementdan meros. */}
          <DataTable
            compact
            className="leading-tight"
            columns={COLUMNS}
            rows={EVENTS.map((row) => ({
              key: row.id,
              cells: [
                <span key="time" className="tabular-nums text-ink-muted">
                  {row.time}
                </span>,
                <span key="asset" className="flex items-center gap-1.5">
                  {/* Holat nishonda ham bor - doira faqat bezak. */}
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      STATE_DOT[row.state.tone],
                    )}
                  />
                  <span className="min-w-0 truncate font-medium">{row.asset}</span>
                </span>,
                row.event,
                <Badge key="state" tone={row.state.tone}>
                  {row.state.label}
                </Badge>,
              ],
            }))}
          />
        </div>

        {/* Havola jadval bilan bir chiziqda tursin uchun chapga tekislangan.
            `leading-4` o'ramchida turishi shart: qator qutisi balandligini
            ichkaridagi <a> emas, ota blokning "strut" i belgilaydi - meros
            qilib olingan `normal` bilan yo'lak 24px bo'lib, jadvalning
            oxirgi qatorini 4px ga siqib qo'yadi. */}
        <div className="shrink-0 pt-2 leading-4">
          <Link
            href="/violations"
            className="text-[11px] leading-4 font-medium text-brand transition-opacity hover:opacity-70"
          >
            Barchasini ko&rsquo;rish &rarr;
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
