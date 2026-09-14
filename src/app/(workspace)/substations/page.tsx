import type { Metadata } from "next";

import { type SubstationListItem, SubstationsView } from "@/components/substations/SubstationsView";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { listSubstations } from "@/lib/queries/lists";
import { DISTRICT, getScopeComparison } from "@/lib/queries/scope";

export const metadata: Metadata = { title: "Podstansiyalar" };

/**
 * Podstansiyalar ro'yxati - tanlangan oyda holati bor podstansiyalar.
 * `?q=` - qidiruv maydonining boshlang'ich matni.
 *
 * Sahifa server komponenti: ro'yxat (`listSubstations`) va tuman xulosasi
 * (`getScopeComparison`) shu yerda olinadi, `SubstationsView` (mijoz) esa
 * faqat qidiruvni boshqaradi. Yuqoridagi yig'indilar tuman xulosasidan -
 * bosh sahifadagi sonlar bilan aynan bir xil.
 */
export default async function SubstationsPage({ searchParams }: PageProps<"/substations">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const [params, rows, { current, previous, previousPeriod }] = await Promise.all([
    searchParams,
    listSubstations(period.id),
    getScopeComparison(DISTRICT, period),
  ]);
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";

  const items: SubstationListItem[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    totalKwh: row.totalKwh,
    usefulKwh: row.usefulKwh,
    lossKwh: row.lossKwh,
    lossPercent: row.lossPercent,
    feederCount: row.feederCount,
    transformerCount: row.transformerCount,
    subscriberCount: row.subscribers?.total ?? null,
    capacityKva: row.capacityKva,
    staffName: row.staff?.name ?? null,
    address: row.address,
  }));

  return (
    <SubstationsView
      // Havola orqali boshqa `?q=` bilan kelinsa qidiruv holati yangidan boshlanadi.
      key={q}
      periodLabel={period.label}
      reportDate={period.reportDate}
      initialQuery={q}
      rows={items}
      uploads={{
        substations: current.uploads.SUBSTATIONS,
        feeders: current.uploads.FEEDERS,
        transformers: current.uploads.TRANSFORMERS,
      }}
      summary={{
        counts: current.counts,
        energy: current.energy,
        previous:
          previousPeriod && previous
            ? { label: previousPeriod.label, energy: previous.energy }
            : null,
      }}
    />
  );
}
