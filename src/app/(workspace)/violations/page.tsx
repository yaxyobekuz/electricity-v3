import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { firstParam, withoutScopeHref } from "@/components/violations/registry-params";
import { ViolationsView } from "@/components/violations/ViolationsView";
import { VIOLATOR_TYPE_ORDER } from "@/lib/domain/labels";
import { getSelectedPeriod } from "@/lib/period";
import { listViolations } from "@/lib/queries/lists";
import { getScopeSummary } from "@/lib/queries/scope";
import { getRegistryScope } from "@/lib/queries/violations-scope";
import { parseScopeParam } from "@/lib/scope-param";

export const metadata: Metadata = { title: "Qoidabuzarliklar" };

/**
 * Qoidabuzarliklar reestri. Filtrlar URL da:
 *   `?scope=<substation|feeder|transformer>:<id>` - qamrov;
 *   `?q=` - abonent, TP, manzil, xodim bo'yicha qidiruv;
 *   `?type=LEGAL|INDIVIDUAL|INNOCENT` - qoidabuzar turi.
 *
 * Statistika kartalari - qamrovning yig'ma sonlari (`getScopeSummary`), bosh
 * sahifa va obyekt sahifalaridagi "Qoidabuzarliklar" bilan bir xil. Chip
 * sonlari va jadval - `listViolations` (qidiruv qo'llanadi).
 */
export default async function ViolationsPage({ searchParams }: PageProps<"/violations">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const params = await searchParams;
  const scope = parseScopeParam(params.scope);
  const q = firstParam(params.q)?.trim() ?? "";
  const rawType = firstParam(params.type);
  const type = VIOLATOR_TYPE_ORDER.find((value) => value === rawType);

  const registryScope = await getRegistryScope(scope, period.id);
  if (registryScope === undefined) notFound();

  const [summary, list] = await Promise.all([
    getScopeSummary(period.id, scope),
    listViolations(period.id, { scope, q, type }),
  ]);
  const violations = summary.violations;

  return (
    <ViolationsView
      periodLabel={period.label}
      scope={
        registryScope
          ? {
              kindLabel: registryScope.kindLabel,
              name: registryScope.name,
              href: registryScope.href,
              clearHref: withoutScopeHref("/violations", { q, type }),
            }
          : null
      }
      summary={
        violations.uploaded
          ? {
              total: violations.total,
              byType: violations.byType,
              damageUzs: violations.damageUzs,
              damageKwh: violations.damageKwh,
              damageUzsByType: violations.damageUzsByType,
            }
          : null
      }
      rows={list.rows}
      filteredTotal={list.totals.total}
      chipCounts={list.totals.byType}
      filtered={q !== "" || type !== undefined}
    />
  );
}
