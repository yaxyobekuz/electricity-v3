"use client";

import { type ReactNode, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircuitBoard,
  Factory,
  Hand,
  LoaderCircle,
  Map as MapIcon,
  MessagesSquare,
  Search,
  SearchX,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { AppShell, SidebarPanel } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { UserGroup } from "@/components/ui/icons/UserGroup";
import { num } from "@/lib/format";
import { cn } from "@/lib/ui/cn";

import type { SearchFilter, SearchHit, SearchHitGroup, SearchKind } from "./types";

/* ---------------------------------------------------------------------------
   Natija turlari
   --------------------------------------------------------------------------- */

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

const KIND_STYLE: Record<SearchKind, KindStyle> = {
  substation: {
    label: "Podstansiya",
    plural: "Podstansiyalar",
    icon: Factory,
    tint: "bg-tint-blue",
    text: "text-accent-blue",
  },
  feeder: {
    label: "Fider",
    plural: "Fiderlar",
    icon: Workflow,
    tint: "bg-tint-teal",
    text: "text-accent-teal",
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
  appeal: {
    label: "Murojaat",
    plural: "Murojaatlar",
    icon: MessagesSquare,
    tint: "bg-tint-amber",
    text: "text-accent-amber",
  },
  staff: {
    label: "Xodim",
    plural: "Ma’sul xodimlar",
    icon: UserGroup,
    tint: "bg-tint-purple",
    text: "text-accent-purple",
  },
};

/** Guruhlar doim shu tartibda chiziladi - tarmoq ierarxiyasi bo'yicha. */
const KIND_ORDER: readonly SearchKind[] = [
  "substation",
  "feeder",
  "transformer",
  "subscriber",
  "violation",
  "appeal",
  "staff",
];

/** Har bir guruhdan boshida ko'rsatiladigan natijalar soni. */
const PREVIEW_LIMIT = 6;

/** Terish to'xtagach URL (va server qidiruvi) yangilanishigacha kutish. */
const DEBOUNCE_MS = 300;

/** Qidiruv bo'sh bo'lganda ko'rsatiladigan plitkalar: reyestr va uning birligi. */
const QUICK_LINKS: ReadonlyArray<{ kind: SearchKind; href: string; unit: string }> = [
  { kind: "substation", href: "/substations", unit: "podstansiya" },
  { kind: "feeder", href: "/feeders", unit: "fider" },
  { kind: "transformer", href: "/transformers", unit: "transformator" },
  { kind: "subscriber", href: "/subscribers", unit: "abonent" },
  { kind: "violation", href: "/violations", unit: "qoidabuzarlik" },
  { kind: "appeal", href: "/appeals", unit: "murojaat" },
  { kind: "staff", href: "/staff", unit: "xodim" },
];

/**
 * Har bir turda qaysi shablon maydonlari bo'yicha qidiriladi - server
 * qidiruvi (`search-hits.ts`) va reyestrlardagi qidiruv bilan bir xil.
 */
const SEARCH_FIELDS: Record<SearchKind, string> = {
  substation: "podstansiya nomi, manzili va ma’sul xodimi",
  feeder: "fider nomi, podstansiya nomi, manzil va ma’sul xodim",
  transformer: "TP nomi, podstansiya va fider nomi, manzil va ma’sul xodim",
  subscriber: "abonent F.I.Sh., shartnoma raqami, hisoblagich raqami va manzili",
  violation: "qoidabuzar abonent nomi, TP nomi, manzil va ma’sul xodim",
  appeal: "murojaat matni, abonent nomi, TP nomi, manzil va ma’sul xodim",
  staff: "ma’sul xodim F.I.Sh.",
};

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const PLACEHOLDER_ALL =
  "Obyekt nomi, abonent F.I.Sh., shartnoma yoki hisoblagich raqami, manzil bo’yicha qidiring...";

/** `/search?q=...&kind=...` - bo'sh qiymatlar URL ga yozilmaydi. */
function searchHref(query: string, kind: SearchFilter): string {
  const params = new URLSearchParams();
  if (query !== "") params.set("q", query);
  if (kind !== "all") params.set("kind", kind);
  const search = params.toString();
  return search ? `/search?${search}` : "/search";
}

/**
 * Katta-kichik harf va apostrof turlarini bir ko'rinishga keltiradi.
 *
 * Muhim: almashtirishlar belgilar sonini o'zgartirmaydi, shuning uchun
 * normalizatsiya qilingan matndagi indeks asl matndagi indeksga mos keladi -
 * `Highlight` shunga tayanadi.
 */
function normalize(value: string): string {
  return value.toLowerCase().replace(/[‘’ʻʼ`´′]/g, "'");
}

/* ---------------------------------------------------------------------------
   Ekran
   --------------------------------------------------------------------------- */

export function SearchScreen({
  query: serverQuery,
  kind: serverKind,
  groups,
  counts,
  periodLabel,
  periodSelect,
}: {
  /** Sahifa chizilgan so'rov (URL dagi `q`, chetlari kesilgan). */
  query: string;
  /** URL dagi `kind`. */
  kind: SearchFilter;
  /** `query` bo'yicha natijalar; so'rov bo'sh bo'lsa - null (tezkor plitkalar). */
  groups: SearchHitGroup[] | null;
  /**
   * Filtr tugmalaridagi sonlar: so'rov bo'lsa - topilganlar, bo'sh bo'lsa -
   * oydagi reyestr hajmi. Yuklanmagan shablon - null.
   */
  counts: Record<SearchKind, number | null>;
  /** "Sentabr 2026" */
  periodLabel: string;
  /** Yon paneldagi hisobot oyi tanlagichi (server qismi). */
  periodSelect: ReactNode;
}) {
  const router = useRouter();
  const [navigating, startTransition] = useTransition();
  const [query, setQuery] = useState(serverQuery);
  const [filter, setFilter] = useState<SearchFilter>(serverKind);
  // Qaysi guruhlar to'liq ochilgani ("Yana N ta" bosilgan guruhlar).
  const [expanded, setExpanded] = useState<Partial<Record<SearchKind, boolean>>>({});
  // Serverga so'nggi yuborilgan so'rov va serverdan so'nggi kelgan qiymatlar.
  const [requested, setRequested] = useState(serverQuery);
  const [seen, setSeen] = useState({ query: serverQuery, kind: serverKind });

  // Tashqi o'tish (masalan, chap paneldagi "Qidiruv" havolasi) maydonni URL
  // ga moslaydi. O'zimiz yuborgan so'rov javobi esa terilayotgan matnni
  // bosib ketmasligi kerak - shuning uchun o'tish davomida e'tiborsiz.
  if (seen.query !== serverQuery || seen.kind !== serverKind) {
    setSeen({ query: serverQuery, kind: serverKind });
    if (!navigating) {
      if (serverQuery !== requested) {
        setQuery(serverQuery);
        setRequested(serverQuery);
        setExpanded({});
      }
      setFilter(serverKind);
    }
  }

  const trimmed = query.trim();

  // Terish to'xtagach URL yangilanadi - server shu so'rov bo'yicha qidiradi.
  useEffect(() => {
    if (trimmed === requested) return;
    const timer = setTimeout(() => {
      setRequested(trimmed);
      setExpanded({});
      startTransition(() => {
        router.replace(searchHref(trimmed, filter), { scroll: false });
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [trimmed, requested, filter, router]);

  const searching = navigating || trimmed !== requested;

  /** Filtr serverga murojaatsiz almashadi: natijalar allaqachon bor, URL shunchaki yangilanadi. */
  function handleFilter(next: SearchFilter) {
    setFilter(next);
    setExpanded({});
    window.history.replaceState(null, "", searchHref(requested, next));
  }

  // Barcha turlarda topilganlar. "Barchasi" yonida faqat so'rov bo'lganda va
  // hamma tur yuklangan bo'lsa ko'rsatiladi: bo'sh so'rovda turli reyestrlar
  // hajmini qo'shish ma'nosiz, yuklanmagan tur esa yig'indida 0 bo'lib qolardi.
  const matchedCount = KIND_ORDER.reduce((total, kind) => total + (counts[kind] ?? 0), 0);
  const allUploaded = KIND_ORDER.every((kind) => counts[kind] !== null);
  const visible = (groups ?? []).filter(
    (group) => (filter === "all" || group.kind === filter) && group.hits.length > 0,
  );

  return (
    <AppShell
      sidebar={
        <SidebarPanel title="Qidiruv">
          {periodSelect}
          <nav aria-label="Natija turlari">
            <ul className="flex flex-col gap-2">
              <FilterButton
                active={filter === "all"}
                icon={Search}
                iconClass="text-brand"
                label="Barchasi"
                count={groups !== null && allUploaded ? matchedCount : undefined}
                onClick={() => handleFilter("all")}
              />
              {KIND_ORDER.map((kind) => (
                <FilterButton
                  key={kind}
                  active={filter === kind}
                  icon={KIND_STYLE[kind].icon}
                  iconClass={KIND_STYLE[kind].text}
                  label={KIND_STYLE[kind].plural}
                  count={counts[kind]}
                  onClick={() => handleFilter(kind)}
                />
              ))}
            </ul>
          </nav>
        </SidebarPanel>
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        {/* Qidiruv maydoni - sahifaning asosiy boshqaruv elementi, 48px. */}
        <div className="relative h-12 shrink-0">
          <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-soft">
            <Icon
              icon={searching && trimmed !== "" ? LoaderCircle : Search}
              size={20}
              className={searching && trimmed !== "" ? "animate-spin" : undefined}
            />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            // Sahifa (`MAX_QUERY_LENGTH`) bilan bir xil chegara.
            maxLength={120}
            aria-label="Umumiy qidiruv"
            placeholder={
              filter === "all"
                ? PLACEHOLDER_ALL
                : `${upperFirst(SEARCH_FIELDS[filter])} bo’yicha qidiring...`
            }
            // Brauzerning o'z "tozalash" tugmasi o'chiriladi - o'ngda bizning X bor.
            className="h-12 w-full rounded-xl bg-surface pr-14 pl-12 text-sm text-ink outline-none placeholder:text-ink-soft focus:ring-1 focus:ring-brand/40 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {/* Shart `query` bo'yicha: faqat bo'sh joy terilganda ham maydonda
              matn ko'rinadi, demak tozalash tugmasi kerak. */}
          {query === "" ? null : (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Qidiruvni tozalash"
              className="absolute top-1/2 right-3 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-canvas"
            >
              <Icon icon={X} size={18} />
            </button>
          )}
        </div>

        {/* Natijalar maydoni - sahifaning o'zi emas, shu blok skroll bo'ladi.
            Yangi javob kelguncha eski natija xira ko'rinadi. */}
        <div
          aria-busy={searching}
          className={cn(
            "min-h-0 flex-1 overflow-y-auto transition-opacity scrollbar-none",
            searching && "opacity-60",
          )}
        >
          {groups === null ? (
            <QuickStart counts={counts} filter={filter} periodLabel={periodLabel} />
          ) : visible.length === 0 ? (
            <NoResults
              query={serverQuery}
              filter={filter}
              filterTotal={filter === "all" ? null : counts[filter]}
              otherCount={filter === "all" ? 0 : matchedCount}
              showOtherCount={allUploaded}
              periodLabel={periodLabel}
              onReset={() => handleFilter("all")}
            />
          ) : (
            <div className="flex flex-col gap-2">
              {visible.map((group) => (
                <ResultGroup
                  key={group.kind}
                  group={group}
                  query={serverQuery}
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

function FilterButton({
  active,
  icon,
  iconClass,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: GlyphIcon;
  iconClass: string;
  label: string;
  /** null - shablon shu oyga yuklanmagan; undefined - son ko'rsatilmaydi. */
  count?: number | null;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "flex h-12 w-full items-center gap-4 rounded-xl px-5 text-left transition-colors",
          active ? "bg-brand text-white" : "text-ink hover:bg-canvas",
        )}
      >
        <span className={cn("shrink-0", active ? "text-white" : iconClass)}>
          <Icon icon={icon} size={24} />
        </span>
        <span className="truncate text-base font-semibold">{label}</span>
        {count === undefined ? null : (
          <span
            className={cn(
              "ml-auto shrink-0 font-semibold",
              count === null ? "text-xs" : "text-sm",
              active ? "text-white" : "text-ink-soft",
            )}
          >
            {count === null ? "yuklanmagan" : num(count)}
          </span>
        )}
      </button>
    </li>
  );
}

/* ---------------------------------------------------------------------------
   Natijalar guruhi
   --------------------------------------------------------------------------- */

function ResultGroup({
  group,
  query,
  open,
  onToggle,
}: {
  group: SearchHitGroup;
  query: string;
  open: boolean;
  onToggle: () => void;
}) {
  const style = KIND_STYLE[group.kind];
  const shown = open ? group.hits : group.hits.slice(0, PREVIEW_LIMIT);
  const rest = group.hits.length - shown.length;
  const total = group.total ?? group.hits.length;
  // Serverdan birinchi 20 tasi keladi; qolganlari reyestrda.
  const truncated = total > group.hits.length;

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
          {num(total)} ta natija
          {truncated ? `, birinchi ${num(group.hits.length)} tasi` : null}
        </span>
        {truncated && group.registryHref ? (
          <Link
            href={group.registryHref}
            className="ml-auto flex shrink-0 items-center gap-1 text-[11px] font-medium text-brand transition-opacity hover:opacity-70"
          >
            Barchasini ko’rish
            <Icon icon={ArrowRight} size={14} />
          </Link>
        ) : null}
      </header>

      <div className="flex flex-col pt-2">
        {shown.map((hit) => (
          <ResultRow key={hit.id} kind={group.kind} hit={hit} query={query} />
        ))}
      </div>

      {group.hits.length > PREVIEW_LIMIT ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-canvas text-xs font-medium text-brand transition-colors hover:bg-black/5"
        >
          {open ? "Kamroq ko’rsatish" : `Yana ${num(rest)} ta`}
          {/* Strelka holatni ko'rsatadi: yopiq - pastga, ochiq - tepaga. */}
          <Icon icon={open ? ChevronUp : ChevronDown} size={14} />
        </button>
      ) : null}
    </Card>
  );
}

function ResultRow({ kind, hit, query }: { kind: SearchKind; hit: SearchHit; query: string }) {
  const style = KIND_STYLE[kind];

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
  const needle = normalize(query).replace(/\s+/g, " ").trim();
  if (haystack.length !== text.length || needle === "") return <>{text}</>;

  const at = haystack.indexOf(needle);
  if (at < 0) return <>{text}</>;
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

/**
 * Bo'sh so'rov holati. "Barchasi" tanlangan bo'lsa - barcha reyestr
 * plitkalari va har bir turda qidiriladigan maydonlar; bitta tur tanlangan
 * bo'lsa - faqat shu tur plitkasi va uning qidiruv maydonlari (filtr tugmasi
 * bosilgani ko'rinib turadi, keyingi so'rov shu tur bilan cheklanadi).
 */
function QuickStart({
  counts,
  filter,
  periodLabel,
}: {
  counts: Record<SearchKind, number | null>;
  filter: SearchFilter;
  periodLabel: string;
}) {
  const tile = (item: (typeof QUICK_LINKS)[number]) => {
    const style = KIND_STYLE[item.kind];
    const value = counts[item.kind];
    return (
      <QuickTile
        key={item.kind}
        href={item.href}
        label={style.plural}
        hint={value === null ? `${style.plural} yuklanmagan` : `${num(value)} ta ${item.unit}`}
        icon={style.icon}
        tint={style.tint}
        text={style.text}
      />
    );
  };

  if (filter !== "all") {
    const item = QUICK_LINKS.find((link) => link.kind === filter);
    return (
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {item ? tile(item) : null}
        <Card className="xl:col-span-3">
          <header className="flex h-8 shrink-0 items-center gap-2">
            <h2 className="truncate text-sm font-bold text-ink">
              {KIND_STYLE[filter].plural} bo’yicha qidiruv
            </h2>
            <span className="shrink-0 text-[11px] text-ink-soft">{periodLabel}</span>
          </header>
          <p className="pt-2 text-xs leading-relaxed text-ink-muted">
            {counts[filter] === null ? (
              <>{periodLabel} oyi uchun bu shablon hali yuklanmagan.</>
            ) : (
              <>
                {periodLabel} oyi ma’lumotlarida {SEARCH_FIELDS[filter]} bo’yicha qidiriladi.
                Katta-kichik harf va apostrof turi farq qilmaydi.
              </>
            )}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        {QUICK_LINKS.map(tile)}
        <QuickTile
          href="/map"
          label="Xarita"
          hint="Tarmoq obyektlarini xaritada ko’rish"
          icon={MapIcon}
          tint="bg-tint-brown"
          text="text-accent-brown"
        />
      </div>

      <Card>
        <header className="flex h-8 shrink-0 items-center gap-2">
          <h2 className="truncate text-sm font-bold text-ink">Nimalarni qidirish mumkin</h2>
          <span className="shrink-0 text-[11px] text-ink-soft">{periodLabel}</span>
        </header>
        <p className="pt-2 text-xs leading-relaxed text-ink-muted">
          Qidiruv tanlangan oyda yuklangan Excel shablonlari bo’yicha olib boriladi. Katta-kichik
          harf va apostrof turi farq qilmaydi.
        </p>
        <dl className="grid gap-x-6 gap-y-1.5 pt-3 text-xs leading-relaxed xl:grid-cols-2">
          {KIND_ORDER.map((kind) => (
            <div key={kind} className="flex min-w-0 gap-1.5">
              <dt className={cn("shrink-0 font-semibold", KIND_STYLE[kind].text)}>
                {KIND_STYLE[kind].plural}:
              </dt>
              <dd className="min-w-0 text-ink-muted">{SEARCH_FIELDS[kind]}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

function QuickTile({
  href,
  label,
  hint,
  icon,
  tint,
  text,
}: {
  href: string;
  label: string;
  hint: string;
  icon: GlyphIcon;
  tint: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-42 flex-col justify-between rounded-2xl bg-surface p-4 transition-colors hover:bg-canvas"
    >
      <span className={cn("flex size-11 items-center justify-center rounded-xl", tint, text)}>
        <Icon icon={icon} size={24} />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-bold text-ink">{label}</span>
        <span className="text-[11px] leading-tight text-ink-soft">{hint}</span>
      </span>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-brand">
        Ochish
        <Icon icon={ArrowRight} size={14} />
      </span>
    </Link>
  );
}

function NoResults({
  query,
  filter,
  filterTotal,
  otherCount,
  showOtherCount,
  periodLabel,
  onReset,
}: {
  query: string;
  filter: SearchFilter;
  /** Tanlangan tur soni; null - shablon yuklanmagan. */
  filterTotal: number | null;
  /** Barcha turlarda topilgan natijalar soni (filtr tor bo'lsa). */
  otherCount: number;
  /** Hamma tur yuklangan - son to'liq, tugmada ko'rsatsa bo'ladi. */
  showOtherCount: boolean;
  periodLabel: string;
  onReset: () => void;
}) {
  const notUploaded = filter !== "all" && filterTotal === null;

  return (
    <div className="flex h-full min-h-80 flex-col items-center justify-center gap-3 rounded-2xl bg-surface p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-canvas text-ink-soft">
        <Icon icon={SearchX} size={28} />
      </span>
      {/* Boshqa turlarda natija bo'lsa "hech narsa topilmadi" deyish noto'g'ri
          bo'lardi - matn filtr torligini aytadi. */}
      <p className="text-sm font-bold text-ink">
        {notUploaded
          ? `${KIND_STYLE[filter].plural} yuklanmagan`
          : otherCount > 0
            ? "Bu turda natija yo’q"
            : "Hech narsa topilmadi"}
      </p>
      <p className="max-w-110 text-xs leading-relaxed text-ink-soft">
        {notUploaded ? (
          <>{periodLabel} oyi uchun bu shablon hali yuklanmagan.</>
        ) : otherCount > 0 ? (
          <>
            &laquo;{query}&raquo; bo’yicha natijalar bor, ammo tanlangan turda emas. Chap
            panelda boshqa turni tanlang.
          </>
        ) : (
          <>
            &laquo;{query}&raquo; bo’yicha {periodLabel} oyi ma’lumotlarida mos yozuv
            yo’q. Obyekt nomi, abonent F.I.Sh., shartnoma yoki hisoblagich raqamining bir
            qismi bilan urinib ko’ring.
          </>
        )}
      </p>
      {otherCount > 0 ? (
        <button
          type="button"
          onClick={onReset}
          className="flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-xs font-medium text-white transition-opacity hover:opacity-90"
        >
          Barcha turlarda ko’rish{showOtherCount ? ` (${num(otherCount)} ta)` : null}
          <Icon icon={ArrowRight} size={14} />
        </button>
      ) : null}
    </div>
  );
}
