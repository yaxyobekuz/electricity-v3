"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircuitBoard,
  Factory,
  Hand,
  History,
  Map as MapIcon,
  Search,
  SearchX,
  TriangleAlert,
  Users,
  X,
} from "lucide-react";

import { AppShell, SidebarPanel } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { transformerCount } from "@/lib/data/relations";
import { between, energy, money, num, pick } from "@/lib/data/seed";
import { SUBSCRIBER_KIND_LABEL, SUBSCRIBER_STATUS_LABEL, SUBSCRIBERS } from "@/lib/data/subscribers";
import { SUBSTATION_STATUS_LABEL, SUBSTATIONS } from "@/lib/data/substations";
import { TRANSFORMER_STATUS_LABEL, TRANSFORMERS } from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Natija turlari
   --------------------------------------------------------------------------- */

/** Qidiruv natijasining turi - guruhlash va nishon rangi shu bo'yicha. */
type HitKind = "incident" | "subscriber" | "substation" | "transformer" | "violation";

/** Chap paneldagi filtr qiymati. */
type FilterValue = "all" | HitKind;

interface KindStyle {
  /** Nishondagi qisqa nom ("Abonent"). */
  label: string;
  /** Guruh sarlavhasidagi ko'plik shakli ("Abonentlar"). */
  plural: string;
  icon: GlyphIcon;
  /** Ikonka plitkasi foni - `tint-*` tokeni. */
  tint: string;
  /** Ikonka va nishon matni rangi - `accent-*` tokeni. */
  text: string;
}

const KIND_STYLE: Record<HitKind, KindStyle> = {
  substation: {
    label: "Podstansiya",
    plural: "Podstansiyalar",
    icon: Factory,
    tint: "bg-tint-blue",
    text: "text-accent-blue",
  },
  transformer: {
    label: "Transformator",
    plural: "Transformatorlar",
    icon: CircuitBoard,
    tint: "bg-tint-indigo",
    text: "text-accent-indigo",
  },
  subscriber: {
    label: "Abonent",
    plural: "Abonentlar",
    icon: Users,
    tint: "bg-tint-green",
    text: "text-accent-green",
  },
  violation: {
    label: "Qoidabuzarlik",
    plural: "Qoidabuzarliklar",
    icon: Hand,
    tint: "bg-tint-red",
    text: "text-accent-red",
  },
  incident: {
    label: "Hodisa",
    plural: "Hodisalar",
    icon: TriangleAlert,
    tint: "bg-tint-amber",
    text: "text-accent-amber",
  },
};

/** Guruhlar doim shu tartibda chiziladi - tarmoq ierarxiyasi bo'yicha. */
const KIND_ORDER: readonly HitKind[] = [
  "substation",
  "transformer",
  "subscriber",
  "violation",
  "incident",
];

/** Har bir guruhdan boshida ko'rsatiladigan natijalar soni. */
const PREVIEW_LIMIT = 6;

/** Matn bo'laklarini ajratuvchi nuqta (U+00B7). */
const DOT = " · ";

/* ---------------------------------------------------------------------------
   Qoidabuzarlik va hodisa - maket ma'lumoti
   Bu ikki ro'yxat uchun alohida modul yo'q, shuning uchun mavjud abonent va
   transformatorlar ustiga determinlashgan tarzda quriladi (`Math.random` yo'q).
   --------------------------------------------------------------------------- */

const VIOLATION_TYPES = [
  "Hisoblagichni chetlab o\u2019tish",
  "Hisoblagich muhri buzilgan",
  "Ruxsatsiz ulanish",
  "Hisoblagich ko\u2019rsatkichiga aralashuv",
  "Shartnomasiz iste\u2019mol",
  "Tarifdan noto\u2019g\u2019ri foydalanish",
] as const;

const VIOLATION_STATES = ["Tekshiruvda", "Dalolatnoma rasmiylashtirildi", "Yopilgan"] as const;

const INCIDENT_TYPES = [
  "Fider avariyasi",
  "Transformator qizib ketdi",
  "Kuchlanish me\u2019yordan pasaydi",
  "Kabel uzilishi",
  "Hisoblagichlar aloqasi uzildi",
  "Himoya ishga tushdi",
] as const;

const INCIDENT_STATES = ["Ochiq", "Bartaraf etilmoqda", "Bartaraf etilgan"] as const;

/** Hodisa va qoidabuzarlik sanalari - `TODAY` (10-avgust, 2026) dan oldingi kunlar. */
const EVENT_DATES = [
  "9-avgust, 2026",
  "7-avgust, 2026",
  "4-avgust, 2026",
  "1-avgust, 2026",
  "27-iyul, 2026",
  "19-iyul, 2026",
] as const;

interface Violation {
  id: string;
  code: string;
  type: string;
  state: string;
  subscriber: string;
  area: string;
  date: string;
  /** Qayta hisoblangan summa, so'm. */
  amount: number;
}

const VIOLATIONS: readonly Violation[] = Array.from({ length: 14 }, (_, index) => {
  const seed = index + 701;
  // Abonentlar ro'yxatidan qadam bilan olinadi - bir xil abonent takrorlanmaydi.
  const subscriber = SUBSCRIBERS[(index * 7 + 3) % SUBSCRIBERS.length];

  return {
    id: `qb-${String(index + 1).padStart(3, "0")}`,
    code: `QB-${between(seed * 3.1, 2100, 2990, 1)}`,
    type: pick(seed * 5.3, VIOLATION_TYPES),
    state: pick(seed * 7.9, VIOLATION_STATES),
    subscriber: subscriber.name,
    area: subscriber.area,
    date: pick(seed * 11.3, EVENT_DATES),
    amount: between(seed * 13.7, 380_000, 9_600_000, 1_000),
  };
});

interface Incident {
  id: string;
  code: string;
  type: string;
  state: string;
  transformerCode: string;
  substationName: string;
  area: string;
  date: string;
}

const INCIDENTS: readonly Incident[] = Array.from({ length: 10 }, (_, index) => {
  const seed = index + 811;
  const transformer = TRANSFORMERS[(index * 5 + 2) % TRANSFORMERS.length];

  return {
    id: `hd-${String(index + 1).padStart(3, "0")}`,
    code: `HD-${between(seed * 3.7, 110, 190, 1)}`,
    type: pick(seed * 6.7, INCIDENT_TYPES),
    state: pick(seed * 9.7, INCIDENT_STATES),
    transformerCode: transformer.code,
    substationName: transformer.substationName,
    area: transformer.area,
    date: pick(seed * 11.9, EVENT_DATES),
  };
});

/* ---------------------------------------------------------------------------
   Natijalar indeksi
   --------------------------------------------------------------------------- */

interface SearchHit {
  id: string;
  kind: HitKind;
  title: string;
  subtitle: string;
  href: string;
  /** Qidiruv shu normalizatsiya qilingan matn ustidan olib boriladi. */
  haystack: string;
}

/**
 * Katta-kichik harf va apostrof turlarini bir ko'rinishga keltiradi
 * (maketda U+2019, klaviaturada odatda U+0027 teriladi).
 *
 * Muhim: almashtirishlar belgilar sonini o'zgartirmaydi, shuning uchun
 * normalizatsiya qilingan matndagi indeks asl matndagi indeksga mos keladi -
 * `Highlight` shunga tayanadi.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[‘’ʼ`´]/g, "'");
}

function makeHit(
  kind: HitKind,
  id: string,
  href: string,
  title: string,
  parts: readonly string[],
  extra: readonly string[] = [],
): SearchHit {
  return {
    id,
    kind,
    href,
    title,
    subtitle: parts.join(DOT),
    // Izohda ko'rinmaydigan maydonlar (hisoblagich raqami, holat) ham
    // qidiriladi - shuning uchun ular `extra` orqali indeksga qo'shiladi.
    haystack: normalize([title, ...parts, ...extra].join(" ")),
  };
}

/**
 * Butun indeks bir marta - modul yuklanganda - quriladi. Ma'lumot statik
 * bo'lgani uchun uni komponent ichida qayta hisoblashning hojati yo'q.
 */
const ALL_HITS: readonly SearchHit[] = [
  ...SUBSTATIONS.map((item) =>
    makeHit(
      "substation",
      item.id,
      `/substations/${item.id}`,
      item.name,
      [
        item.code,
        item.voltage,
        item.area,
        `${num(transformerCount(item.id))} ta TP`,
        energy(item.consumptionKwh),
      ],
      [item.address, item.responsible, SUBSTATION_STATUS_LABEL[item.status]],
    ),
  ),
  ...TRANSFORMERS.map((item) =>
    makeHit(
      "transformer",
      item.id,
      `/transformers/${item.id}`,
      `${item.code} transformatori`,
      [
        `${num(item.powerKva)} kVA`,
        item.voltage,
        item.substationName,
        item.feeder,
        `yuklama ${num(item.loadPercent)}%`,
      ],
      [item.area, item.address, item.responsible, TRANSFORMER_STATUS_LABEL[item.status]],
    ),
  ),
  ...SUBSCRIBERS.map((item) =>
    makeHit(
      "subscriber",
      item.id,
      `/subscribers/${item.id}`,
      item.name,
      [
        item.code,
        SUBSCRIBER_KIND_LABEL[item.kind],
        item.transformerCode,
        item.address,
        item.balance < 0 ? `qarz ${money(Math.abs(item.balance))}` : energy(item.monthlyKwh),
      ],
      [item.area, item.phone, item.meterNo, item.meterType, SUBSCRIBER_STATUS_LABEL[item.status]],
    ),
  ),
  ...VIOLATIONS.map((item) =>
    makeHit(
      "violation",
      item.id,
      // Qoidabuzarlik uchun alohida detal sahifasi yo'q, reyestr ochiladi.
      // Manzilga `?id=` qo'shilmaydi: loyihada hech bir sahifa `searchParams`
      // ni o'qimaydi, ya'ni parametr faqat URL ni ifloslantirgan bo'lardi.
      "/violations",
      item.type,
      [item.code, item.subscriber, item.area, item.date, money(item.amount)],
      [item.state],
    ),
  ),
  ...INCIDENTS.map((item) =>
    makeHit(
      "incident",
      item.id,
      // Hodisa yuzasidan ochilgan ish "Ishlar" reyestrida ko'rinadi
      // (yuqoridagi sababga ko'ra bu yerda ham parametr uzatilmaydi).
      "/works",
      item.type,
      [item.code, item.transformerCode, item.substationName, item.date, item.state],
      [item.area],
    ),
  ),
];

/** Chap paneldagi filtr tugmalari tartibi. */
const FILTERS: ReadonlyArray<{
  value: FilterValue;
  label: string;
  icon: GlyphIcon;
  text: string;
}> = [
  { value: "all", label: "Barchasi", icon: Search, text: "text-brand" },
  ...KIND_ORDER.map((kind) => ({
    value: kind,
    label: KIND_STYLE[kind].label,
    icon: KIND_STYLE[kind].icon,
    text: KIND_STYLE[kind].text,
  })),
];

/** Panel pastidagi "so'nggi qidiruvlar" - hammasi natija beradigan so'rovlar. */
const RECENT_QUERIES = [
  "TP-066",
  "Baliqchi",
  "Chinobod mahallasi",
  "Qarzdor",
  "Nosoz",
] as const;

/** Qidiruv bo'sh bo'lganda ko'rsatiladigan yirik plitkalar. */
const QUICK_LINKS: ReadonlyArray<{
  key: string;
  href: string;
  label: string;
  hint: string;
  icon: GlyphIcon;
  tint: string;
  text: string;
}> = [
  {
    key: "substations",
    href: "/substations",
    label: "Podstansiyalar",
    hint: `${num(SUBSTATIONS.length)} ta podstansiya, kuchlanish darajasi va yuklama bo\u2019yicha`,
    icon: Factory,
    tint: "bg-tint-blue",
    text: "text-accent-blue",
  },
  {
    key: "transformers",
    href: "/transformers",
    label: "Transformatorlar",
    hint: `${num(TRANSFORMERS.length)} ta TP, quvvat va holat bo\u2019yicha reyestr`,
    icon: CircuitBoard,
    tint: "bg-tint-indigo",
    text: "text-accent-indigo",
  },
  {
    key: "subscribers",
    href: "/subscribers",
    label: "Abonentlar",
    hint: `${num(SUBSCRIBERS.length)} ta shartnoma, balans va hisoblagich holati`,
    icon: Users,
    tint: "bg-tint-green",
    text: "text-accent-green",
  },
  {
    key: "map",
    href: "/map",
    label: "Xarita",
    hint: "Tarmoq obyektlarini xaritada daraja bo\u2019yicha ko\u2019rish",
    icon: MapIcon,
    tint: "bg-tint-purple",
    text: "text-accent-purple",
  },
];

/** "Nimalarni qidirish mumkin" kartasidagi tayyor so'rovlar. */
const SAMPLE_QUERIES = [
  "TP-066",
  "PS-01",
  "Baliqchi podstansiyasi",
  "Chinobod mahallasi",
  "Navoiy ko\u2019chasi",
  "Qarzdor",
  "Kritik",
  "Fider avariyasi",
] as const;

/* ---------------------------------------------------------------------------
   Ekran
   --------------------------------------------------------------------------- */

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  // Qaysi guruhlar to'liq ochilgani ("Yana N ta" bosilgan guruhlar).
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const trimmed = query.trim();

  /** So'rovdagi har bir so'z natijada bo'lishi shart (VA mantiqi). */
  const matches = useMemo(() => {
    const tokens = normalize(trimmed).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    return ALL_HITS.filter((hit) => tokens.every((token) => hit.haystack.includes(token)));
  }, [trimmed]);

  // Filtr yonidagi sonlar: so'rov bo'sh bo'lsa - reyestrdagi umumiy son,
  // aks holda - joriy so'rov bo'yicha topilgani.
  const counted = trimmed === "" ? ALL_HITS : matches;
  const countOf = (value: FilterValue) =>
    value === "all"
      ? counted.length
      : counted.reduce((sum, hit) => (hit.kind === value ? sum + 1 : sum), 0);

  const visible = filter === "all" ? matches : matches.filter((hit) => hit.kind === filter);

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    items: visible.filter((hit) => hit.kind === kind),
  })).filter((group) => group.items.length > 0);

  /** So'rov o'zgarganda ochilgan guruhlar yopiladi - ro'yxat qaytadan quriladi. */
  function handleQuery(next: string) {
    setQuery(next);
    setExpanded({});
  }

  function handleFilter(next: FilterValue) {
    setFilter(next);
    setExpanded({});
  }

  return (
    <AppShell
      sidebar={
        <SidebarPanel
          title="Qidiruv"
          footer={
            <div className="flex shrink-0 flex-col gap-1.5">
              <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold text-ink-soft">
                <Icon icon={History} size={14} />
                So&rsquo;nggi qidiruvlar
              </p>
              {RECENT_QUERIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => handleQuery(item)}
                  className="flex h-9 w-full items-center gap-2 rounded-lg bg-canvas px-3 text-left text-xs text-ink-muted transition-colors hover:bg-black/5"
                >
                  <span className="shrink-0 text-ink-soft">
                    <Icon icon={Search} size={14} />
                  </span>
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          }
        >
          <nav aria-label="Natija turlari">
            <ul className="flex flex-col gap-2">
              {FILTERS.map((item) => {
                const active = item.value === filter;
                return (
                  <li key={item.value}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => handleFilter(item.value)}
                      className={cn(
                        "flex h-12 w-full items-center gap-4 rounded-xl px-5 text-left transition-colors",
                        active ? "bg-brand text-white" : "text-ink hover:bg-canvas",
                      )}
                    >
                      <span className={cn("shrink-0", active ? "text-white" : item.text)}>
                        <Icon icon={item.icon} size={24} />
                      </span>
                      <span className="truncate text-base font-semibold">{item.label}</span>
                      <span
                        className={cn(
                          "ml-auto shrink-0 text-sm font-semibold",
                          active ? "text-white" : "text-ink-soft",
                        )}
                      >
                        {num(countOf(item.value))}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </SidebarPanel>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        {/* Qidiruv maydoni - sahifaning asosiy boshqaruv elementi, 48px. */}
        <div className="relative h-12 shrink-0">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft">
            <Icon icon={Search} size={20} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => handleQuery(event.target.value)}
            aria-label="Umumiy qidiruv"
            placeholder={
              "TP kodi, abonent nomi, shartnoma raqami yoki manzil bo\u2019yicha qidiring..."
            }
            // Brauzerning o'z "tozalash" tugmasi o'chiriladi - o'ngda bizning X bor.
            className="h-12 w-full rounded-xl bg-surface pr-14 pl-12 text-sm text-ink outline-none placeholder:text-ink-soft focus:ring-1 focus:ring-brand/40 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {/* Shart `query` bo'yicha: faqat bo'sh joy terilganda ham maydonda
              matn ko'rinadi, demak tozalash tugmasi kerak. */}
          {query === "" ? null : (
            <button
              type="button"
              onClick={() => handleQuery("")}
              aria-label="Qidiruvni tozalash"
              className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-canvas"
            >
              <Icon icon={X} size={18} />
            </button>
          )}
        </div>

        {/* Natijalar maydoni - sahifaning o'zi emas, shu blok skroll bo'ladi. */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          {trimmed === "" ? (
            <QuickStart onPick={handleQuery} />
          ) : groups.length === 0 ? (
            <EmptyState
              query={trimmed}
              otherCount={filter === "all" ? 0 : matches.length}
              onReset={() => handleFilter("all")}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {groups.map((group) => (
                <ResultGroup
                  key={group.kind}
                  kind={group.kind}
                  items={group.items}
                  query={trimmed}
                  open={expanded[group.kind] === true}
                  onToggle={() =>
                    setExpanded((prev) => ({ ...prev, [group.kind]: prev[group.kind] !== true }))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------------------
   Natijalar guruhi
   --------------------------------------------------------------------------- */

function ResultGroup({
  kind,
  items,
  query,
  open,
  onToggle,
}: {
  kind: HitKind;
  items: readonly SearchHit[];
  query: string;
  open: boolean;
  onToggle: () => void;
}) {
  const style = KIND_STYLE[kind];
  const shown = open ? items : items.slice(0, PREVIEW_LIMIT);
  const rest = items.length - shown.length;

  return (
    <Card>
      <header className="flex h-8 shrink-0 items-center gap-2">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-md",
            style.tint,
            style.text,
          )}
        >
          <Icon icon={style.icon} size={14} />
        </span>
        <h2 className="truncate text-sm font-bold text-ink">{style.plural}</h2>
        <span className="shrink-0 text-[11px] text-ink-soft">
          {num(items.length)} ta natija
        </span>
      </header>

      <div className="flex flex-col pt-2">
        {shown.map((hit) => (
          <ResultRow key={hit.id} hit={hit} query={query} />
        ))}
      </div>

      {items.length > PREVIEW_LIMIT ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-canvas text-xs font-medium text-brand transition-colors hover:bg-black/5"
        >
          {open ? "Kamroq ko\u2019rsatish" : `Yana ${num(rest)} ta`}
          {/* Strelka holatni ko'rsatadi: yopiq - pastga, ochiq - tepaga. */}
          <Icon icon={open ? ChevronUp : ChevronDown} size={14} />
        </button>
      ) : null}
    </Card>
  );
}

function ResultRow({ hit, query }: { hit: SearchHit; query: string }) {
  const style = KIND_STYLE[hit.kind];

  return (
    <Link
      href={hit.href}
      className="group flex h-14 shrink-0 items-center gap-3 rounded-xl px-2 transition-colors hover:bg-canvas"
    >
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          style.tint,
          style.text,
        )}
      >
        <Icon icon={style.icon} size={18} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-xs font-semibold text-ink">
          <Highlight text={hit.title} query={query} />
        </span>
        <span className="truncate text-[11px] text-ink-soft">
          <Highlight text={hit.subtitle} query={query} />
        </span>
      </span>

      <span
        className={cn(
          "shrink-0 rounded-full px-2 py-[2.5px] text-[10px] leading-3.25 font-semibold whitespace-nowrap",
          style.tint,
          style.text,
        )}
      >
        {style.label}
      </span>

      <span className="flex w-4 shrink-0 items-center justify-end text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
        <Icon icon={ChevronRight} size={14} />
      </span>
    </Link>
  );
}

/**
 * Topilgan bo'lakni ajratib ko'rsatadi. Normalizatsiya belgilar sonini
 * o'zgartirmagani uchun indeks asl matnga to'g'ridan-to'g'ri qo'llanadi;
 * ehtiyot uchun uzunlik tengligi yana bir bor tekshiriladi.
 */
function Highlight({ text, query }: { text: string; query: string }) {
  const haystack = normalize(text);
  if (haystack.length !== text.length) return <>{text}</>;

  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  // Avval butun so'rov, topilmasa - birinchi so'z bo'yicha belgilanadi.
  const needle = [normalize(query).trim(), tokens[0] ?? ""].find(
    (candidate) => candidate.length > 0 && haystack.includes(candidate),
  );
  if (needle === undefined) return <>{text}</>;

  const at = haystack.indexOf(needle);
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-tint-amber px-0.5 text-ink">
        {text.slice(at, at + needle.length)}
      </mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/* ---------------------------------------------------------------------------
   Bo'sh so'rov va bo'sh natija holatlari
   --------------------------------------------------------------------------- */

function QuickStart({ onPick }: { onPick: (query: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="flex h-42 flex-col justify-between rounded-2xl bg-surface p-4 transition-colors hover:bg-canvas"
          >
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-xl",
                item.tint,
                item.text,
              )}
            >
              <Icon icon={item.icon} size={24} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm font-bold text-ink">{item.label}</span>
              <span className="text-[11px] leading-tight text-ink-soft">{item.hint}</span>
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand">
              Ochish
              <Icon icon={ArrowRight} size={14} />
            </span>
          </Link>
        ))}
      </div>

      <Card>
        <header className="flex h-8 shrink-0 items-center gap-2">
          <h2 className="truncate text-sm font-bold text-ink">
            Nimalarni qidirish mumkin
          </h2>
          <span className="shrink-0 text-[11px] text-ink-soft">
            {num(ALL_HITS.length)} ta yozuv indekslangan
          </span>
        </header>
        <div className="flex flex-col gap-3 pt-2">
          <p className="text-xs leading-relaxed text-ink-muted">
            Qidiruv podstansiya, transformator va abonent reyestrlari, shuningdek
            qoidabuzarlik va hodisa yozuvlari ustidan olib boriladi: nom, kod,
            shartnoma raqami, hisoblagich raqami, manzil, hudud va holat bo&rsquo;yicha.
            Bir nechta so&rsquo;z yozilsa, natijada ularning hammasi qatnashadi.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_QUERIES.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => onPick(sample)}
                className="flex h-8 items-center rounded-lg bg-canvas px-3 text-xs font-medium text-ink-muted transition-colors hover:bg-black/5"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}

function EmptyState({
  query,
  otherCount,
  onReset,
}: {
  query: string;
  /** Boshqa turlarda topilgan natijalar soni (filtr tor bo'lsa). */
  otherCount: number;
  onReset: () => void;
}) {
  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center gap-3 rounded-2xl bg-surface p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-canvas text-ink-soft">
        <Icon icon={SearchX} size={28} />
      </span>
      {/* Boshqa turlarda natija bo'lsa "hech narsa topilmadi" deyish noto'g'ri
          bo'lardi - matn filtr torligini aytadi. */}
      <p className="text-sm font-bold text-ink">
        {otherCount > 0 ? <>Bu turda natija yo&rsquo;q</> : "Hech narsa topilmadi"}
      </p>
      <p className="max-w-110 text-xs leading-relaxed text-ink-soft">
        {otherCount > 0 ? (
          <>
            &laquo;{query}&raquo; bo&rsquo;yicha natijalar bor, ammo tanlangan turda
            emas. Chap panelda boshqa turni tanlang yoki filtrni kengaytiring.
          </>
        ) : (
          <>
            &laquo;{query}&raquo; bo&rsquo;yicha mos yozuv yo&rsquo;q. Kod (TP-066,
            PS-01), shartnoma raqami (AB-104512), abonent nomi yoki manzil
            bo&rsquo;yicha qisqaroq so&rsquo;rov bilan urinib ko&rsquo;ring.
          </>
        )}
      </p>
      {otherCount > 0 ? (
        <button
          type="button"
          onClick={onReset}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Barcha turlarda ko&rsquo;rish ({num(otherCount)} ta)
          <Icon icon={ArrowRight} size={14} />
        </button>
      ) : null}
    </div>
  );
}
