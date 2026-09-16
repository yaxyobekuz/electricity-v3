import type { Metadata } from "next";

import { SearchScreen } from "@/components/search/SearchScreen";
import type { SearchFilter, SearchHit, SearchHitGroup, SearchKind } from "@/components/search/types";
import { AppShell, SidebarPanel } from "@/components/shell/AppShell";
import { SidebarPeriod } from "@/components/shell/SidebarPeriod";
import { EmptyState } from "@/components/ui/EmptyState";
import { APPEAL_STATUS_LABEL, SUBSCRIBER_KIND_LABEL, VIOLATOR_TYPE_LABEL } from "@/lib/domain/labels";
import { nameKey } from "@/lib/domain/normalize";
import { energy, formatDate, money, num } from "@/lib/format";
import { getSelectedPeriod } from "@/lib/period";
import { getSearchOverview, SEARCH_KINDS, searchPeriod, type SearchResults } from "@/lib/queries/search-hits";

export const metadata: Metadata = {
  title: "Qidiruv",
};

/** Juda uzun so'rov URL va SQL ni ortiqcha yuklamasin. */
const MAX_QUERY_LENGTH = 120;

/** Matn bo'laklarini ajratuvchi nuqta (U+00B7). */
const DOT = " · ";

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function parseKind(value: string | string[] | undefined): SearchFilter {
  const raw = first(value);
  return (SEARCH_KINDS as readonly string[]).includes(raw) ? (raw as SearchKind) : "all";
}

/** Bo'sh bo'laklar tashlab ketiladi. */
function join(parts: ReadonlyArray<string | null | undefined | false>): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(DOT);
}

function withQuery(path: string, q: string): string {
  return `${path}?${new URLSearchParams({ q }).toString()}`;
}

/**
 * Obyekt manzil yoki ma'sul xodim bo'yicha topilgan bo'lsa, shu maydon izohga
 * qo'shiladi - aks holda qator nima uchun chiqqani ko'rinmaydi.
 */
function matchedExtras(key: string, address: string | null, staffName: string | null): string[] {
  const matches = (value: string | null): value is string => value != null && nameKey(value).includes(key);
  return [
    ...(matches(address) ? [address] : []),
    ...(matches(staffName) ? [`Ma’sul xodim: ${staffName}`] : []),
  ];
}

/**
 * Server qidiruv natijasi -> mijozga oddiy matnlar. Izohlarda faqat shablon
 * maydonlari va ulardan hisoblangan qiymatlar.
 */
function toGroups(results: SearchResults, q: string): SearchHitGroup[] {
  const key = nameKey(q);
  const build = (
    kind: SearchKind,
    total: number | null,
    hits: SearchHit[],
    registryPath: string | null,
  ): SearchHitGroup => ({
    kind,
    total,
    hits,
    registryHref: registryPath ? withQuery(registryPath, q) : null,
  });

  return [
    build(
      "substation",
      results.substation.total,
      results.substation.rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: join([
          row.address,
          ...matchedExtras(key, null, row.staffName),
          `Foydali oqim ${energy(row.usefulKwh)}`,
        ]),
        href: `/substations/${row.id}`,
      })),
      // Podstansiyalar reyestrida qidiruv parametri yo'q.
      null,
    ),
    build(
      "feeder",
      results.feeder.total,
      results.feeder.rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: join([
          row.substation.name,
          ...matchedExtras(key, row.address, row.staffName),
          `Foydali oqim ${energy(row.usefulKwh)}`,
        ]),
        href: `/feeders/${row.id}`,
      })),
      "/feeders",
    ),
    build(
      "transformer",
      results.transformer.total,
      results.transformer.rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: join([
          row.substation.name,
          row.feeder.name,
          ...matchedExtras(key, row.address, row.staffName),
          `Foydali oqim ${energy(row.usefulKwh)}`,
        ]),
        href: `/transformers/${row.id}`,
      })),
      "/transformers",
    ),
    build(
      "subscriber",
      results.subscriber.total,
      results.subscriber.rows.map((row) => ({
        id: row.id,
        title: row.fullName,
        subtitle: join([
          row.contractNumber,
          SUBSCRIBER_KIND_LABEL[row.kind],
          row.transformer.name,
          row.meterSerial && `hisoblagich ${row.meterSerial}`,
          row.address,
        ]),
        href: `/subscribers/${row.id}`,
      })),
      "/subscribers",
    ),
    build(
      "violation",
      results.violation.total,
      results.violation.rows.map((row) => ({
        id: row.id,
        title: row.subscriberName,
        subtitle: join([
          VIOLATOR_TYPE_LABEL[row.violatorType],
          row.transformer?.name ?? row.substation?.name,
          formatDate(row.date),
          `zarar ${money(row.damageUzs)}`,
          row.address,
          ...matchedExtras(key, null, row.staff?.name ?? null),
        ]),
        // Qoidabuzarlikning alohida sahifasi yo'q - reyestr abonent nomi bilan ochiladi.
        href: withQuery("/violations", row.subscriberName),
      })),
      "/violations",
    ),
    build(
      "appeal",
      results.appeal.total,
      results.appeal.rows.map((row) => ({
        id: row.id,
        title: row.text,
        subtitle: join([
          row.subscriberName,
          row.transformer?.name ?? row.substation?.name,
          formatDate(row.date),
          APPEAL_STATUS_LABEL[row.status],
          ...matchedExtras(key, row.address, row.staff?.name ?? null),
        ]),
        href: withQuery("/appeals", row.subscriberName),
      })),
      "/appeals",
    ),
    build(
      "staff",
      results.staff.total,
      results.staff.rows.map((row) => ({
        id: row.id,
        title: row.name,
        subtitle: join([
          row.substations > 0 && `${num(row.substations)} ta podstansiya`,
          row.feeders > 0 && `${num(row.feeders)} ta fider`,
          row.transformers > 0 && `${num(row.transformers)} ta TP`,
          row.subscribers > 0 && `${num(row.subscribers)} ta abonent`,
          row.violations > 0 && `${num(row.violations)} ta qoidabuzarlik`,
          row.appeals > 0 && `${num(row.appeals)} ta murojaat`,
        ]),
        href: withQuery("/staff", row.name),
      })),
      "/staff",
    ),
  ];
}

/**
 * Qidiruv "Boshqaruv paneli" guruhiga kirmaydi - o'zining ikkilamchi paneli
 * bor, shuning uchun `(workspace)` maketidan tashqarida turadi va qobiqni
 * `SearchScreen` o'zi chizadi (xarita sahifasi bilan bir xil yondashuv).
 *
 * Qidiruv serverda, tanlangan oy bo'yicha: mijoz so'rovni URL ga (`?q=`)
 * yozadi, sahifa shu so'rov bilan qayta chiziladi.
 */
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const params = await searchParams;
  const q = first(params.q).trim().slice(0, MAX_QUERY_LENGTH);
  const kind = parseKind(params.kind);

  const period = await getSelectedPeriod();
  if (!period) {
    return (
      <AppShell
        sidebar={
          <SidebarPanel title="Qidiruv">
            <SidebarPeriod />
          </SidebarPanel>
        }
      >
        <EmptyState />
      </AppShell>
    );
  }

  const results = await searchPeriod(period.id, q);
  const groups = results ? toGroups(results, q) : null;
  const counts = groups
    ? (Object.fromEntries(groups.map((group) => [group.kind, group.total])) as Record<SearchKind, number | null>)
    : await getSearchOverview(period.id);

  return (
    <SearchScreen
      query={q}
      kind={kind}
      groups={groups}
      counts={counts}
      periodLabel={period.label}
      periodSelect={<SidebarPeriod />}
    />
  );
}
