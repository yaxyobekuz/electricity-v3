import type { Metadata } from "next";

import {
  type FeederFilter,
  type FeederListItem,
  FeedersView,
  type SubstationChip,
} from "@/components/feeders/FeedersView";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { getFeeder, getSubstation, getTransformer } from "@/lib/queries/entities";
import { listFeeders } from "@/lib/queries/lists";
import { DISTRICT, getScopeComparison, type Scope } from "@/lib/queries/scope";
import { parseScopeParam } from "@/lib/scope-param";

export const metadata: Metadata = { title: "Fiderlar" };

/** Sahifa ichidagi qamrov: ro'yxat filtri va yuqoridagi xulosa manbasi. */
type ResolvedScope =
  | { status: "district" }
  | { status: "unknown" }
  | { status: "found"; scope: Scope; filter: FeederFilter; substationId: string | null; feederId: string | null };

/**
 * `?scope=` -> fiderlar filtri. Podstansiya - uning fiderlari; fider -
 * faqat o'zi; TP - uning fideri (xulosa ham o'sha fider bo'yicha).
 * Obyekt bazada topilmasa - "unknown" (ro'yxat bo'sh, filtrni tozalash mumkin).
 */
async function resolveScope(scope: Scope, periodId: string): Promise<ResolvedScope> {
  switch (scope.kind) {
    case "district":
      return { status: "district" };
    case "substation": {
      const substation = await getSubstation(scope.id, periodId);
      if (!substation) return { status: "unknown" };
      return {
        status: "found",
        scope,
        filter: { label: "Podstansiya", name: substation.name, href: `/substations/${substation.id}` },
        substationId: substation.id,
        feederId: null,
      };
    }
    case "feeder": {
      const feeder = await getFeeder(scope.id, periodId);
      if (!feeder) return { status: "unknown" };
      return {
        status: "found",
        scope,
        filter: { label: "Fider", name: feeder.name, href: `/feeders/${feeder.id}` },
        substationId: null,
        feederId: feeder.id,
      };
    }
    case "transformer": {
      const transformer = await getTransformer(scope.id, periodId);
      if (!transformer) return { status: "unknown" };
      return {
        status: "found",
        scope: { kind: "feeder", id: transformer.feeder.id },
        filter: {
          label: "TP",
          name: `${transformer.name} (${transformer.feeder.name} fideri)`,
          href: `/transformers/${transformer.id}`,
        },
        substationId: null,
        feederId: transformer.feeder.id,
      };
    }
  }
}

function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Fiderlar ro'yxati. `?scope=substation:<id>` (yoki fider / TP) ro'yxatni
 * filtrlaydi, `?q=` - qidiruv maydonining boshlang'ich matni.
 *
 * Yuqoridagi yig'indilar - shu qamrovning `getScopeSummary` qiymati (tuman
 * uchun Σ podstansiyalar, podstansiya/fider uchun obyektning o'z holati),
 * fiderlar qatorlarining yig'indisi emas: bir son hamma sahifada bir xil.
 */
export default async function FeedersPage({ searchParams }: PageProps<"/feeders">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const params = await searchParams;
  const resolved = await resolveScope(parseScopeParam(params.scope), period.id);
  const summaryScope = resolved.status === "found" ? resolved.scope : DISTRICT;

  const [allRows, { current, previous, previousPeriod }] = await Promise.all([
    listFeeders(period.id),
    getScopeComparison(summaryScope, period),
  ]);

  // Podstansiya "chip"lari - shu oydagi barcha fiderlardan (fayl tartibida).
  const chips = new Map<string, SubstationChip>();
  for (const row of allRows) {
    const chip = chips.get(row.substation.id);
    if (chip) chip.count += 1;
    else chips.set(row.substation.id, { id: row.substation.id, name: row.substation.name, count: 1 });
  }

  const rows =
    resolved.status === "unknown"
      ? []
      : resolved.status === "district"
        ? allRows
        : allRows.filter((row) =>
            resolved.feederId ? row.id === resolved.feederId : row.substation.id === resolved.substationId,
          );

  const items: FeederListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    substation: row.substation,
    totalKwh: row.totalKwh,
    usefulKwh: row.usefulKwh,
    lossKwh: row.lossKwh,
    lossPercent: row.lossPercent,
    transformerCount: row.transformerCount,
    subscriberCount: row.subscribers?.total ?? null,
    capacityKva: row.capacityKva,
    staffName: row.staff?.name ?? null,
    address: row.address,
  }));

  const unknown = resolved.status === "unknown";
  const q = firstParam(params.q);

  return (
    <FeedersView
      // Havola orqali boshqa `?q=` bilan kelinsa qidiruv holati yangidan boshlanadi.
      key={q}
      periodLabel={period.label}
      reportDate={period.reportDate}
      initialQuery={q}
      rows={items}
      totalFeeders={allRows.length}
      chips={[...chips.values()]}
      activeSubstationId={resolved.status === "found" ? resolved.substationId : null}
      filter={resolved.status === "found" ? resolved.filter : unknown ? "unknown" : null}
      uploads={{
        feeders: current.uploads.FEEDERS,
        transformers: current.uploads.TRANSFORMERS,
        subscribers: current.uploads.SUBSCRIBERS,
      }}
      summary={{
        scope: summaryScope.kind,
        counts: unknown
          ? { feeders: null, transformers: null }
          : { feeders: current.counts.feeders, transformers: current.counts.transformers },
        energy: unknown ? null : current.energy,
        previous:
          !unknown && previousPeriod && previous
            ? { label: previousPeriod.label, energy: previous.energy }
            : null,
      }}
    />
  );
}
