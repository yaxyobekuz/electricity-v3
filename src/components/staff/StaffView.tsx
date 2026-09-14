"use client";

// Qidiruv holati brauzerda - shuning uchun mijoz komponenti. Ma'lumot va
// havolalar `page.tsx` (server) da tayyorlanadi.

import { MessageSquareWarning, Network, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchField } from "@/components/ui/Filters";
import { PageHeader } from "@/components/ui/PageHeader";
import { type RegistryColumn, type RegistryRow, RegistryTable } from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { fractions } from "@/lib/domain/metrics";
import { nameKey } from "@/lib/domain/normalize";
import { EMPTY, formatDate, money, num } from "@/lib/format";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Tiplar (server sahifasi shu ko'rinishda uzatadi)
   --------------------------------------------------------------------------- */

type Metric = "substations" | "feeders" | "transformers" | "subscribers" | "violations" | "appeals";

/** Qaysi shablonlar shu oyga yuklangan - yuklanmaganining ustuni chizilmaydi. */
export type StaffColumns = Record<Metric, boolean>;

export interface StaffItem {
  id: string;
  name: string;
  substations: number;
  feeders: number;
  transformers: number;
  subscribers: number;
  violations: number;
  /** Qoidabuzarliklardagi zarar, so'm. */
  damageUzs: number;
  appeals: number;
  appealsOverdue: number;
  /** Son aynan shu xodimning yozuvlarini ochadigan havola; aniq havola yo'q - null. */
  links: Record<Metric, string | null> | null;
}

/** Xodimlar bo'yicha yig'indilar (xodimi ko'rsatilmagan yozuvlar kirmaydi). */
interface StaffTotals {
  staff: number;
  substations: number;
  feeders: number;
  transformers: number;
  subscribers: number;
  violations: number;
  damageUzs: number;
  appeals: number;
  appealsOverdue: number;
}

/**
 * Tuman bo'yicha sonlar (`getScopeSummary`) - xodimi ko'rsatilmaganlar ham
 * kiradi. Yuklanmagan shablon sonlari bu yerda ishlatilmaydi (`columns`).
 */
export interface StaffDistrict {
  /** Yuklangan obyekt shablonlaridagi PS + fider + TP holatlari. */
  objects: number;
  subscribers: number;
  appeals: number;
  appealsOverdue: number;
}

/* ---------------------------------------------------------------------------
   Yordamchilar
   --------------------------------------------------------------------------- */

/**
 * Bosh harflar doirasining rangi - rasm o'rniga. Xodimning ro'yxatdagi
 * o'rniga bog'langan, qidiruvda o'zgarmaydi.
 */
const SWATCHES = [
  "bg-tint-blue text-accent-blue",
  "bg-tint-green text-accent-green",
  "bg-tint-purple text-accent-purple",
  "bg-tint-indigo text-accent-indigo",
  "bg-tint-amber text-accent-amber",
  "bg-tint-teal text-accent-teal",
  "bg-tint-brown text-accent-brown",
  "bg-tint-red text-accent-red",
] as const;

/** "Karimov Egamberdi" -> "KE". */
function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** Son: aniq havola bo'lsa - havola, aks holda oddiy matn. Nol hech qachon havola emas. */
function CountLink({ value, href }: { value: number; href: string | null | undefined }) {
  if (href && value > 0) {
    return (
      <Link href={href} className="font-semibold text-brand hover:underline">
        {num(value)}
      </Link>
    );
  }
  return <span className="font-semibold text-ink">{num(value)}</span>;
}

/** Xodimga biriktirilgan PS + fider + TP (faqat yuklangan shablonlar). */
function objectsOf(row: Pick<StaffItem, "substations" | "feeders" | "transformers">, columns: StaffColumns): number {
  return (
    (columns.substations ? row.substations : 0) +
    (columns.feeders ? row.feeders : 0) +
    (columns.transformers ? row.transformers : 0)
  );
}

const TOP_COUNT = 8;

/* ---------------------------------------------------------------------------
   Ko'rinish
   --------------------------------------------------------------------------- */

export function StaffView({
  periodLabel,
  reportDate,
  columns,
  rows,
  totals,
  district,
  initialQuery,
}: {
  periodLabel: string;
  /** ISO. */
  reportDate: string;
  columns: StaffColumns;
  /** Nom bo'yicha saralangan. */
  rows: readonly StaffItem[];
  totals: StaffTotals;
  district: StaffDistrict;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);

  // Qidiruv URL ga yoziladi (sahifa qayta yuklanmaydi).
  const search = (next: string) => {
    setQuery(next);
    const params = new URLSearchParams();
    if (next) params.set("q", next);
    const value = params.toString();
    window.history.replaceState(null, "", value ? `?${value}` : window.location.pathname);
  };

  const swatch = useMemo(
    () => new Map(rows.map((row, index) => [row.id, SWATCHES[index % SWATCHES.length]])),
    [rows],
  );

  const tableColumns = useMemo(() => {
    const all: (RegistryColumn | false)[] = [
      { key: "name", label: "F.I.Sh.", grow: 24, align: "left" },
      columns.substations && { key: "substations", label: "Podstansiyalar", grow: 11 },
      columns.feeders && { key: "feeders", label: "Fiderlar", grow: 9 },
      columns.transformers && { key: "transformers", label: "TP", grow: 8 },
      columns.subscribers && { key: "subscribers", label: "Abonentlar", grow: 10 },
      columns.violations && { key: "violations", label: "Qoidabuzarliklar", grow: 16, align: "left" },
      columns.appeals && { key: "appeals", label: "Murojaatlar", grow: 16, align: "left" },
    ];
    return all.filter((column): column is RegistryColumn => column !== false);
  }, [columns]);

  const visible = useMemo(() => {
    const key = nameKey(query);
    return key ? rows.filter((row) => nameKey(row.name).includes(key)) : rows;
  }, [rows, query]);

  const tableRows = useMemo<RegistryRow[]>(
    () =>
      visible.map((row) => ({
        key: row.id,
        cells: [
          <span key="name" className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                swatch.get(row.id),
              )}
            >
              {initialsOf(row.name)}
            </span>
            <span className="min-w-0 truncate font-medium text-ink">{row.name}</span>
          </span>,
          columns.substations && <CountLink key="substations" value={row.substations} href={row.links?.substations} />,
          columns.feeders && <CountLink key="feeders" value={row.feeders} href={row.links?.feeders} />,
          columns.transformers && (
            <CountLink key="transformers" value={row.transformers} href={row.links?.transformers} />
          ),
          columns.subscribers && <CountLink key="subscribers" value={row.subscribers} href={row.links?.subscribers} />,
          columns.violations && (
            <span key="violations" className="flex min-w-0 items-baseline gap-1.5">
              <CountLink value={row.violations} href={row.links?.violations} />
              {row.violations > 0 ? (
                <span className="truncate text-[11px] text-ink-soft">{money(row.damageUzs)}</span>
              ) : null}
            </span>
          ),
          columns.appeals && (
            <span key="appeals" className="flex min-w-0 items-baseline gap-1.5">
              <CountLink value={row.appeals} href={row.links?.appeals} />
              {row.appealsOverdue > 0 ? (
                <span className="truncate text-[11px] text-accent-red">
                  {num(row.appealsOverdue)} ta muddati buzilgan
                </span>
              ) : null}
            </span>
          ),
        ].filter((cell) => cell !== false),
      })),
    [visible, columns, swatch],
  );

  const objectKinds = [columns.substations, columns.feeders, columns.transformers].filter(Boolean).length;
  const objectsUploaded = objectKinds > 0;
  // Xodimi ko'rsatilmagan muddati buzilgan murojaatlar (kartadagi tuman soni va
  // jadval yig'indisi orasidagi farq).
  const overdueWithoutStaff = district.appealsOverdue - totals.appealsOverdue;

  // Eng ko'p obyekt biriktirilgan xodimlar - butun oy bo'yicha, qidiruvga bog'liq emas.
  // Saralash barqaror: teng sonlilar serverdagi nom tartibida qoladi (mijozda
  // `localeCompare` ishlatilmaydi - brauzer va server ICU farqi gidratsiyani buzmasin).
  const top = useMemo(() => {
    const ranked = rows
      .map((row) => ({ row, objects: objectsOf(row, columns) }))
      .filter((item) => item.objects > 0)
      .sort((a, b) => b.objects - a.objects)
      .slice(0, TOP_COUNT);
    const widths = fractions(ranked.map((item) => item.objects));
    return ranked.map((item, index) => ({ ...item, width: widths[index] }));
  }, [rows, columns]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Ma’sul xodimlar"
        subtitle={`Shablonlarda ma’sul yoki biriktirilgan xodim sifatida ko’rsatilganlar · ${periodLabel}`}
      />

      <StatRow>
        <StatCard
          label="Xodimlar soni"
          value={num(totals.staff)}
          unit="nafar"
          icon={Users}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={`${formatDate(reportDate)} holatiga`}
        />
        <StatCard
          label="Biriktirilgan obyektlar"
          value={objectsUploaded ? num(objectsOf(totals, columns)) : EMPTY}
          unit={objectsUploaded ? "ta" : undefined}
          icon={Network}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={
            // Tuman jami oldinda (abonentlar kartasi kabi): bo'linish qiymatning
            // o'zini tashkil qiladi, tuman jamini emas.
            objectsUploaded
              ? `Jami ${num(district.objects)} ta obyektdan · ${breakdown(totals, columns)}`
              : "Obyekt shablonlari yuklanmagan"
          }
        />
        <StatCard
          label="Biriktirilgan abonentlar"
          value={columns.subscribers ? num(totals.subscribers) : EMPTY}
          unit={columns.subscribers ? "ta" : undefined}
          icon={UserRound}
          accent="bg-accent-teal"
          tint="bg-tint-teal"
          hint={
            columns.subscribers
              ? `Jami ${num(district.subscribers)} ta abonentdan`
              : "Abonentlar ro’yxati yuklanmagan"
          }
        />
        <StatCard
          label="Muddati buzilgan murojaatlar"
          value={columns.appeals ? num(district.appealsOverdue) : EMPTY}
          unit={columns.appeals ? "ta" : undefined}
          icon={MessageSquareWarning}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint={
            columns.appeals
              ? [
                  `Jami ${num(district.appeals)} ta murojaatdan`,
                  overdueWithoutStaff > 0 && `${num(overdueWithoutStaff)} tasiga xodim ko’rsatilmagan`,
                ]
                  .filter(Boolean)
                  .join(" · ")
              : "Murojaatlar yuklanmagan"
          }
          hintTone={columns.appeals && district.appealsOverdue > 0 ? "bad" : "flat"}
        />
      </StatRow>

      {/* Qator balandligi `minmax(0,1fr)`: jadval uzun bo'lsa sahifa emas,
          karta ichi skroll qilinadi. */}
      <div className="grid min-h-0 flex-1 grid-cols-12 grid-rows-[minmax(0,1fr)] gap-2">
        <Card className="col-span-8 min-h-0">
          <div className="flex shrink-0 items-center gap-2 pb-3">
            <SearchField
              value={query}
              onChange={search}
              placeholder="Xodim F.I.Sh..."
              label="Xodimlar ro’yxatidan qidirish"
              className="w-60"
            />
            <span className="ml-auto shrink-0 text-[11px] text-ink-soft">{num(visible.length)} ta yozuv</span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
            <RegistryTable
              columns={tableColumns}
              rows={tableRows}
              emptyText={rows.length === 0 ? "Shu oyda xodim ko’rsatilmagan" : "Bunday xodim topilmadi"}
            />
          </div>
        </Card>

        <Card className="col-span-4 min-h-0">
          <CardHeader title="Eng ko’p obyekt biriktirilgan xodimlar" />
          <CardBody>
            {!objectsUploaded ? (
              <EmptyState variant="inline" title="Obyekt shablonlari yuklanmagan" />
            ) : top.length === 0 ? (
              <EmptyState variant="inline" action={false} title="Obyekt biriktirilgan xodim yo’q" />
            ) : (
              <>
                <p className="shrink-0 text-[11px] text-ink-soft">
                  {["Podstansiya", "fider", "TP"]
                    .filter((_, index) => [columns.substations, columns.feeders, columns.transformers][index])
                    .join(" + ")}
                  , {periodLabel}
                </p>
                <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto scrollbar-none">
                  {top.map(({ row, objects, width }) => (
                    <li key={row.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => search(row.name)}
                        title={objectKinds > 1 ? breakdown(row, columns) : undefined}
                        className="group block w-full min-w-0 text-left"
                      >
                        <span className="flex min-w-0 items-baseline gap-2">
                          <span className="min-w-0 flex-1 truncate text-[11px] text-ink-muted group-hover:text-brand">
                            {row.name}
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold text-ink">{num(objects)} ta</span>
                        </span>
                        <span className="mt-1.5 block h-1.5 w-full overflow-hidden rounded-full bg-canvas">
                          <span
                            className="block h-full rounded-full bg-brand"
                            style={{ width: `${width * 100}%` }}
                          />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

/** Obyektlar bo'linishi (faqat yuklangan shablonlar): "PS: 1 · Fider: 2 · TP: 19". */
function breakdown(
  row: Pick<StaffItem, "substations" | "feeders" | "transformers">,
  columns: StaffColumns,
): string {
  return [
    columns.substations && `PS: ${num(row.substations)}`,
    columns.feeders && `Fider: ${num(row.feeders)}`,
    columns.transformers && `TP: ${num(row.transformers)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
