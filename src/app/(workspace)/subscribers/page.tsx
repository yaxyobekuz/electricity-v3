import type { Metadata } from "next";
import { notFound } from "next/navigation";

import type { MeterStatus, SubscriberKind } from "@/generated/prisma";
import type { RegistryScope, RegistryState } from "@/components/subscribers/SubscribersRegistry";
import { SubscribersView } from "@/components/subscribers/SubscribersView";
import { EmptyState } from "@/components/ui/EmptyState";
import { METER_STATUS_ORDER, SUBSCRIBER_KIND_ORDER } from "@/lib/domain/labels";
import { getSelectedPeriod } from "@/lib/period";
import { getFeeder, getSubstation, getTransformer } from "@/lib/queries/entities";
import { listSubscribers } from "@/lib/queries/lists";
import { getScopeSummary, type Scope } from "@/lib/queries/scope";
import { parseScopeParam, scopeParam } from "@/lib/scope-param";

export const metadata: Metadata = { title: "Abonentlar" };

/** Bir sahifadagi qatorlar soni. */
const PAGE_SIZE = 50;

type SearchValue = string | string[] | undefined;

function first(value: SearchValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function oneOf<T extends string>(value: string | undefined, options: readonly T[]): T | null {
  return value != null && (options as readonly string[]).includes(value) ? (value as T) : null;
}

/**
 * So'raladigan sahifa raqamining yuqori chegarasi. Kattaroq raqam OFFSET ni
 * bigint chegarasidan chiqarib yuborardi; undan keyin baribir oxirgi sahifaga
 * tushiriladi.
 */
const MAX_PAGE = 1_000_000;

/** "3" -> 3; "999999999999" -> MAX_PAGE; noto'g'ri yozuv ("0", "-2", "1e18", "2.5") - 1. */
function pageNumber(value: string | undefined): number {
  return value != null && /^[1-9]\d*$/.test(value) ? Math.min(Number(value), MAX_PAGE) : 1;
}

/** Qamrov obyektining nomi va havolasi (banner uchun). Obyekt topilmasa - null. */
async function resolveScope(scope: Scope, periodId: string): Promise<RegistryScope | null> {
  switch (scope.kind) {
    case "district":
      return null;
    case "substation": {
      const substation = await getSubstation(scope.id, periodId);
      return substation
        ? { kindLabel: "Podstansiya", name: substation.name, href: `/substations/${substation.id}`, parent: null }
        : null;
    }
    case "feeder": {
      const feeder = await getFeeder(scope.id, periodId);
      return feeder
        ? {
            kindLabel: "Fider",
            name: feeder.name,
            href: `/feeders/${feeder.id}`,
            parent: { label: feeder.substation.name, href: `/substations/${feeder.substation.id}` },
          }
        : null;
    }
    case "transformer": {
      const transformer = await getTransformer(scope.id, periodId);
      return transformer
        ? {
            kindLabel: "TP",
            name: transformer.name,
            href: `/transformers/${transformer.id}`,
            parent: { label: transformer.feeder.name, href: `/feeders/${transformer.feeder.id}` },
          }
        : null;
    }
  }
}

/**
 * Abonentlar reestri. Filtr va sahifalash serverda (`listSubscribers`) -
 * minglab qator mijozga yuborilmaydi. Filtr holati URL da:
 * `?scope=&q=&kind=&status=&debtors=1&page=`.
 */
export default async function Page({ searchParams }: PageProps<"/subscribers">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const params = await searchParams;
  const scope = parseScopeParam(params.scope);
  const q = (first(params.q) ?? "").trim();
  const kind = oneOf<SubscriberKind>(first(params.kind), SUBSCRIBER_KIND_ORDER);
  const status = oneOf<MeterStatus>(first(params.status), METER_STATUS_ORDER);
  const debtors = first(params.debtors) === "1";
  const requestedPage = pageNumber(first(params.page));

  const [scopeInfo, summary] = await Promise.all([
    resolveScope(scope, period.id),
    getScopeSummary(period.id, scope),
  ]);
  // Mavjud bo'lmagan obyekt bo'yicha filtr "0 ta abonent" ko'rsatmasin.
  if (scope.kind !== "district" && !scopeInfo) notFound();

  const filters = { scope, q, kind: kind ?? undefined, status: status ?? undefined, debtorsOnly: debtors };
  let list = await listSubscribers(period.id, {
    ...filters,
    take: PAGE_SIZE,
    skip: (requestedPage - 1) * PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  // Sahifa raqami filtrdan keyingi sonidan oshib ketsa - oxirgi sahifa.
  if (page !== requestedPage) {
    list = await listSubscribers(period.id, { ...filters, take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE });
  }

  const state: RegistryState = { scope: scopeParam(scope), q, kind, status, debtors, page };

  return (
    <SubscribersView
      period={period}
      summary={{
        subscribers: summary.subscribers,
        listUploaded: summary.subscriberList.uploaded,
        byKind: summary.subscriberList.byKind,
        byStatus: summary.subscriberList.byStatus,
        debtUzs: summary.subscriberList.debtUzs,
        debtors: summary.subscriberList.debtors,
      }}
      registry={{
        state,
        scope: scopeInfo,
        uploaded: list.uploaded,
        rows: list.rows.map((row) => ({
          id: row.id,
          contractNumber: row.contractNumber,
          fullName: row.fullName,
          kind: row.kind,
          meterStatus: row.meterStatus,
          transformer: row.transformer,
          feeder: row.feeder,
          meterSerial: row.meterSerial,
          meterReading: row.meterReading,
          lastReadingAt: row.lastReadingAt,
          debtUzs: row.debtUzs,
          creditUzs: row.creditUzs,
          address: row.address,
        })),
        total: list.total,
        counts: list.counts,
        pageSize: PAGE_SIZE,
        periodLabel: period.label,
      }}
    />
  );
}
