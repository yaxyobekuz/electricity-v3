"use client";

import { CircleCheck, Info, Thermometer, TriangleAlert, ZapOff } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/DataTable";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

// Maketdagi o'zbekcha apostrof - U+2019. Bu karta matnlari JSX matn tugunlari
// emas, `const` ichidagi oddiy satrlar, shuning uchun ular ’ belgisini
// bevosita saqlaydi (`&rsquo;` satr qiymatida ish bermaydi).

/** Hodisaning og'irligi - plitka rangi, ikonka va filtr shu maydondan kelib chiqadi. */
type Severity = "critical" | "warning" | "new" | "resolved";

interface Incident {
  id: string;
  severity: Severity;
  icon: GlyphIcon;
  title: string;
  /** Hodisa manzili (mahalla / obyekt). */
  place: string;
  time: string;
  badge: { label: string; tone: BadgeTone };
}

const ITEMS: readonly Incident[] = [
  {
    id: "tp-066-load",
    severity: "critical",
    icon: TriangleAlert,
    title: "TP-066 transformator yuklamasi 92%",
    place: "Baliqchi shaharchasi, Markaz mahallasi",
    time: "13:28",
    badge: { label: "Kritik", tone: "red" },
  },
  {
    id: "voltage-drop",
    severity: "critical",
    icon: TriangleAlert,
    title: "Tarmoqda kuchlanish pasayishi (10 kV)",
    place: "Chinobod mahallasi, Feeder TP-043",
    time: "12:47",
    badge: { label: "Kritik", tone: "red" },
  },
  {
    id: "commercial-loss",
    severity: "warning",
    icon: ZapOff,
    title: "Tijorat yo’qotishlar bo’yicha ogohlantirish",
    place: "Fayzobod mahallasi, iste’molchi guruhi",
    time: "11:56",
    badge: { label: "Ogohl.", tone: "amber" },
  },
  {
    id: "tp-089-temp",
    severity: "warning",
    icon: Thermometer,
    title: "Transformator barqaror emas (78°C)",
    place: "Sarnovul mahallasi, TP-089",
    time: "11:22",
    badge: { label: "Ogohl.", tone: "amber" },
  },
  {
    id: "meter-theft",
    severity: "new",
    icon: Info,
    title: "Hisoblagich o’g’irligi belgilandi",
    place: "Baliqchi shaharchasi, guruh-12",
    time: "10:36",
    badge: { label: "O’rta", tone: "blue" },
  },
  {
    id: "consumer-restored",
    severity: "resolved",
    icon: CircleCheck,
    title: "O’chirilgan iste’molchi tiklandi",
    place: "Chinobod mahallasi, 3-uylar",
    time: "09:14",
    badge: { label: "Yakunlandi", tone: "green" },
  },
];

/**
 * 26px plitkaning foni va ikonka rangi. "resolved" uchun `accent-green`
 * (#22c55e) maketdagidan yorqinroq, shuning uchun `@theme` dagi
 * `state-ok` (#16a34a) tokeni olinadi.
 */
const SEVERITY_TILE: Record<Severity, string> = {
  critical: "bg-tint-red text-accent-red",
  warning: "bg-tint-amber text-accent-amber",
  new: "bg-tint-blue text-brand",
  resolved: "bg-tint-green text-state-ok",
};

type Filter = "all" | "critical" | "warning" | "new";

/**
 * Filtr sonlari ro'yxatdan hisoblanadi - ma'lumot o'zgarganda pill'lardagi
 * raqamlar qo'lda tuzatishni talab qilmaydi.
 */
const COUNTS: Record<Filter, number> = {
  all: ITEMS.length,
  critical: ITEMS.filter((item) => item.severity === "critical").length,
  warning: ITEMS.filter((item) => item.severity === "warning").length,
  new: ITEMS.filter((item) => item.severity === "new").length,
};

const FILTERS = [
  { id: "all", label: "Barchasi", dot: "bg-brand" },
  // Sariq va ko'k doiralar aksent tokenlariga aynan to'g'ri keladi, qizil esa
  // kelmaydi (`accent-red` = #ff383c) - u `EventLogCard` dagidek aniq hex.
  { id: "critical", label: "Kritik", dot: "bg-[#ef4444]" },
  { id: "warning", label: "Ogohlantirish", dot: "bg-accent-amber" },
  { id: "new", label: "Yangi", dot: "bg-accent-blue" },
] as const satisfies ReadonlyArray<{ id: Filter; label: string; dot: string }>;

/**
 * "Vaziyatlar markazi" - bosh sahifaning 2-qatoridagi o'ng ustun (~363x316).
 *
 * Tana ikki qismdan iborat: tepada qat'iy balandlikdagi 24px filtr yo'lagi
 * (kartaga sig'masa gorizontal suriladi), ostida esa qolgan joyni egallovchi
 * ro'yxat.
 *
 * Ro'yxat uchun 248px qoladi (352 - 32 padding - 32 sarlavha - 8 `CardBody`
 * pt - 24 filtr - 8 oraliq). Element balandligini o'ng ustun belgilaydi:
 * 10px vaqt + 17px nishon = 27px (chap ustun 13 + 2 + 10 = 25px dan baland),
 * ustiga 2px chegara va 8px `py-1` - jami 37px. Oraliq 4px bo'lganda
 * 6 x 37 + 5 x 4 = 242px: oltala hodisa ham to'liq ko'rinadi, hech qaysi
 * qator o'rtasidan kesilmaydi. `overflow-y-auto` pastroq ekran uchun.
 */
export function SituationCenterCard({ className }: { className?: string }) {
  const [filter, setFilter] = useState<Filter>("all");

  const visible =
    filter === "all" ? ITEMS : ITEMS.filter((item) => item.severity === filter);

  return (
    <Card className={className}>
      <CardHeader title="Vaziyatlar markazi" />

      <CardBody>
        {/* Filtr yo'lagi */}
        <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto scrollbar-none">
          {FILTERS.map((item) => {
            const active = item.id === filter;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.id)}
                className={cn(
                  "flex h-6 shrink-0 items-center gap-1 rounded-full px-2",
                  "text-[10px] font-medium transition-colors",
                  active
                    ? "bg-brand text-white"
                    : "bg-canvas text-ink-muted hover:bg-black/5",
                )}
              >
                {/* Faol pill ko'k fonda - o'z rangidagi doira ko'rinmay qolardi. */}
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    active ? "bg-white" : item.dot,
                  )}
                />
                <span className="whitespace-nowrap">{item.label}</span>
                <span className="font-semibold">{COUNTS[item.id]}</span>
              </button>
            );
          })}
        </div>

        {/* Hodisalar ro'yxati */}
        <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto scrollbar-none">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-2 rounded-lg border border-solid border-[#f0f0f0] px-2 py-1"
            >
              <span
                className={cn(
                  // `size-5.5` = 22px (Tailwind v4 kanonik yozuvi): zich
                  // qatorning 25px matn blokidan oshib ketmaydi.
                  "flex size-5.5 shrink-0 items-center justify-center rounded-md",
                  SEVERITY_TILE[item.severity],
                )}
              >
                <Icon icon={item.icon} size={12} />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] leading-[13px] font-semibold text-ink">
                  {item.title}
                </p>
                <p className="mt-0.5 truncate text-[9px] leading-[10px] text-ink-soft">
                  {item.place}
                </p>
              </div>

              {/* Vaqt va nishon orasida oraliq yo'q - qator 37px da qoladi. */}
              <div className="flex shrink-0 flex-col items-end">
                <span className="text-[9px] leading-[10px] text-ink-soft">{item.time}</span>
                <Badge tone={item.badge.tone}>{item.badge.label}</Badge>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
