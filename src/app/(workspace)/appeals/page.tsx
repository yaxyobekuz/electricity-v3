import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AppealsView } from "@/components/appeals/AppealsView";
import { EmptyState } from "@/components/ui/EmptyState";
import { firstParam, withoutScopeHref } from "@/components/violations/registry-params";
import { APPEAL_STATUS_ORDER } from "@/lib/domain/labels";
import { getSelectedPeriod } from "@/lib/period";
import { listAppeals } from "@/lib/queries/lists";
import { getScopeSummary } from "@/lib/queries/scope";
import { getRegistryScope } from "@/lib/queries/violations-scope";
import { parseScopeParam } from "@/lib/scope-param";

export const metadata: Metadata = { title: "Murojaatlar" };

/**
 * Murojaatlar reestri. Filtrlar URL da:
 *   `?scope=<substation|feeder|transformer>:<id>` - qamrov;
 *   `?q=` - murojaat matni, abonent, TP, manzil, xodim bo'yicha qidiruv;
 *   `?status=RESOLVED|REJECTED|IN_PROGRESS|OVERDUE` - holati.
 *
 * Statistika kartalari - `getScopeSummary().appeals` (boshqa sahifalardagi
 * "Murojaatlar" bilan bir xil); chip sonlari va jadval - `listAppeals`.
 */
export default async function AppealsPage({ searchParams }: PageProps<"/appeals">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const params = await searchParams;
  const scope = parseScopeParam(params.scope);
  const q = firstParam(params.q)?.trim() ?? "";
  const rawStatus = firstParam(params.status);
  const status = APPEAL_STATUS_ORDER.find((value) => value === rawStatus);

  const registryScope = await getRegistryScope(scope, period.id);
  if (registryScope === undefined) notFound();

  const [summary, list] = await Promise.all([
    getScopeSummary(period.id, scope),
    listAppeals(period.id, { scope, q, status }),
  ]);
  const appeals = summary.appeals;

  return (
    <AppealsView
      periodLabel={period.label}
      scope={
        registryScope
          ? {
              kindLabel: registryScope.kindLabel,
              name: registryScope.name,
              href: registryScope.href,
              clearHref: withoutScopeHref("/appeals", { q, status }),
            }
          : null
      }
      summary={appeals.uploaded ? { total: appeals.total, byStatus: appeals.byStatus } : null}
      rows={list.rows}
      filteredTotal={list.totals.total}
      chipCounts={list.totals.byStatus}
      filtered={q !== "" || status !== undefined}
    />
  );
}
