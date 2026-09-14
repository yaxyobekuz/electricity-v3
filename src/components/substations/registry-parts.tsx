"use client";

import { Activity, PlugZap, TriangleAlert, ZapOff } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { StatCard, type StatTone } from "@/components/ui/StatCard";
import { nameKey } from "@/lib/domain/normalize";
import { EMPTY, energy, percent, scaled } from "@/lib/format";

/*
 * Podstansiyalar va fiderlar ro'yxatlari uchun umumiy bo'laklar: qidiruv
 * holati (`?q=`), oqim statistikasi kartalari, jadval kataklaridagi havolalar
 * va "yuklanmagan" belgisi. Ikkala sahifa ham mijoz komponenti, shuning uchun
 * bu yerda faqat oddiy (serializable) qiymatlar qabul qilinadi.
 */

/** Qamrov xulosasidagi energiya (`EnergySummary` bilan bir xil shakl). */
export interface RegistryEnergy {
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  lossPercent: number | null;
}

/**
 * Yuqoridagi yig'indilar - `getScopeSummary` dan (qatorlar yig'indisi emas).
 * `previous` - o'tgan oy davri bazada bo'lsa; uning `energy` si null bo'lsa
 * o'sha oyda qamrovning holati yo'q.
 */
export interface RegistryFlowSummary {
  energy: RegistryEnergy | null;
  previous: { label: string; energy: RegistryEnergy | null } | null;
}

/** Qidiruv: har bir maydon `nameKey` bilan solishtiriladi (apostrof va registr farq qilmaydi). */
export function matchesQuery(query: string, values: readonly (string | null)[]): boolean {
  const key = nameKey(query);
  if (key === "") return true;
  return values.some((value) => value != null && nameKey(value).includes(key));
}

/**
 * Qidiruv matni holati. Boshlang'ich qiymat - `?q=`; har o'zgarishda URL
 * ham yangilanadi (havolani ulashish mumkin), sahifa serverdan qayta
 * so'ralmaydi - filtr mijozda qo'llanadi.
 */
export function useSearchQuery(initial: string): [string, (next: string) => void] {
  const [query, setQuery] = useState(initial);
  const update = (next: string) => {
    setQuery(next);
    const url = new URL(window.location.href);
    if (next.trim()) url.searchParams.set("q", next.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };
  return [query, update];
}

/** Karta qiymati: milliondan boshlab 2 xona - "1,89" va "1,85 mln" ikkalasi "1,9" bo'lib qolmasin. */
function flowValue(kwh: number | undefined) {
  return scaled(kwh, "kWh", kwh != null && Math.abs(kwh) >= 1_000_000 ? 2 : 1);
}

/** "O’tgan oy: 1,2 mln kWh" izohi; o'tgan oy davri yo'q bo'lsa - izoh yo'q. */
function previousHint(
  previous: RegistryFlowSummary["previous"],
  format: (energy: RegistryEnergy) => string,
): string | undefined {
  if (!previous) return undefined;
  return `O’tgan oy: ${previous.energy ? format(previous.energy) : "ma’lumot yo’q"}`;
}

/**
 * Yo'qotish ulushining o'zgarishi: o'sish yomon, kamayish yaxshi. Ko'rsatilgan
 * aniqlikda solishtiriladi - ikkala oy ham "2,0%" bo'lsa rang yo'q.
 */
function lossTone(summary: RegistryFlowSummary): StatTone {
  const current = summary.energy?.lossPercent;
  const before = summary.previous?.energy?.lossPercent;
  if (current == null || before == null || percent(current) === percent(before)) return "flat";
  return current > before ? "bad" : "good";
}

/**
 * Umumiy oqim, Foydali oqim va Yo'qotish kartalari. `missing` - energiya
 * yo'q bo'lganda izoh ("Podstansiyalar yuklanmagan").
 */
export function FlowStatCards({
  summary,
  missing,
}: {
  summary: RegistryFlowSummary;
  missing: string;
}) {
  const { energy: current } = summary;
  const total = flowValue(current?.totalKwh);
  const useful = flowValue(current?.usefulKwh);

  return (
    <>
      <StatCard
        label="Umumiy oqim"
        value={total.value}
        unit={current ? total.unit : undefined}
        icon={Activity}
        accent="bg-accent-blue"
        tint="bg-tint-blue"
        hint={current ? previousHint(summary.previous, (item) => energy(item.totalKwh)) : missing}
      />
      <StatCard
        label="Foydali oqim"
        value={useful.value}
        unit={current ? useful.unit : undefined}
        icon={PlugZap}
        accent="bg-accent-green"
        tint="bg-tint-green"
        hint={current ? previousHint(summary.previous, (item) => energy(item.usefulKwh)) : missing}
      />
      <StatCard
        label="Yo’qotish"
        value={current?.lossPercent != null ? percent(current.lossPercent) : EMPTY}
        icon={ZapOff}
        accent="bg-accent-red"
        tint="bg-tint-red"
        hint={
          current
            ? [energy(current.lossKwh), previousHint(summary.previous, (item) => percent(item.lossPercent))]
                .filter(Boolean)
                .join(" · ")
            : missing
        }
        hintTone={lossTone(summary)}
      />
    </>
  );
}

/** Jadval katagidagi obyekt havolasi (qator o'zi havola emas - bir qatorda bir nechta havola bor). */
export function CellLink({
  href,
  children,
  strong = false,
}: {
  href: string;
  children: ReactNode;
  strong?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        strong
          ? "truncate font-semibold text-ink transition-colors hover:text-brand hover:underline"
          : "truncate text-ink-muted transition-colors hover:text-brand hover:underline"
      }
    >
      {children}
    </Link>
  );
}

/** Ma'sul xodim katagi: `/staff?q=<F.I.Sh.>`; ko'rsatilmagan bo'lsa - "—". */
export function StaffCell({ name }: { name: string | null }) {
  if (!name) return <span className="text-ink-soft">{EMPTY}</span>;
  return <CellLink href={`/staff?q=${encodeURIComponent(name)}`}>{name}</CellLink>;
}

/** Oddiy matn katagi (manzil); bo'sh bo'lsa - "—". */
export function TextCell({ value }: { value: string | null }) {
  return (
    <span className={value ? "truncate text-ink-muted" : "text-ink-soft"} title={value ?? undefined}>
      {value ?? EMPTY}
    </span>
  );
}

/** Asboblar qatoridagi "<Shablon> yuklanmagan" belgisi - shu ustunlar jadvalda yo'q. */
export function MissingTemplates({ labels }: { labels: readonly string[] }) {
  if (labels.length === 0) return null;
  return (
    <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-tint-amber px-3 text-[11px] font-medium text-accent-amber">
      <Icon icon={TriangleAlert} size={14} className="shrink-0" />
      {labels.join(", ")} yuklanmagan
    </span>
  );
}
