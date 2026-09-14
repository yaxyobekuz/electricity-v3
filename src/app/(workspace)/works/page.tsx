import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  type WorkFilters,
  type WorkItem,
  type WorkScope,
  WorksView,
} from "@/components/works/WorksView";
import { REPAIR_TYPE_ORDER } from "@/lib/domain/labels";
import { getPeriodUploads, getSelectedPeriod } from "@/lib/period";
import { getFeeder, getSubstation, getTransformer } from "@/lib/queries/entities";
import { listRepairs } from "@/lib/queries/repairs";
import type { Scope } from "@/lib/queries/scope";
import { countScopeTransformers } from "@/lib/queries/works-scope";
import { parseScopeParam, scopeParam } from "@/lib/scope-param";

export const metadata: Metadata = { title: "Ta’mir ishlari" };

const TITLE = "Ta’mir ishlari";
const SUBTITLE = "TP larning joriy va to’la ta’mir sanalari";

/** URL qamrovi -> sarlavhadagi nom. Obyekt bazada yo'q bo'lsa - null. */
async function resolveScope(scope: Scope, periodId: string): Promise<WorkScope | null> {
  switch (scope.kind) {
    case "substation": {
      const entity = await getSubstation(scope.id, periodId);
      return entity && { param: scopeParam(scope), kind: "Podstansiya", name: entity.name, href: `/substations/${entity.id}` };
    }
    case "feeder": {
      const entity = await getFeeder(scope.id, periodId);
      return entity && { param: scopeParam(scope), kind: "Fider", name: entity.name, href: `/feeders/${entity.id}` };
    }
    case "transformer": {
      const entity = await getTransformer(scope.id, periodId);
      return entity && { param: scopeParam(scope), kind: "TP", name: entity.name, href: `/transformers/${entity.id}` };
    }
    default:
      return null;
  }
}

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/**
 * Ta'mir ishlari - tanlangan oy TP holatlaridagi ikki sana (`listRepairs`).
 * Qamrov (`?scope`) serverda qo'llanadi; qidiruv (`?q`), holat (`?done=1|0`),
 * tur (`?type`) va ko'rinish (`?view=calendar`) - boshlang'ich holat, ro'yxat
 * mijozda filtrlanadi.
 */
export default async function Page({ searchParams }: PageProps<"/works">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const params = await searchParams;
  const scope = parseScopeParam(params.scope);
  const [scopeInfo, uploads, repairs, scopeTransformers] = await Promise.all([
    resolveScope(scope, period.id),
    getPeriodUploads(period.id),
    listRepairs(period.id, scope),
    scope.kind === "district" ? null : countScopeTransformers(period.id, scope),
  ]);
  if (scope.kind !== "district" && !scopeInfo) notFound();

  if (!uploads.TRANSFORMERS) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <PageHeader title={TITLE} subtitle={SUBTITLE} />
        <EmptyState
          title="Transformatorlar ro’yxati yuklanmagan"
          description={`Ta’mir sanalari TP jadvalidan olinadi - ${period.label} uchun u hali yuklanmagan.`}
        />
      </div>
    );
  }

  const reportDate = repairs.reportDate ?? period.reportDate;
  const reportMonth = reportDate.slice(0, 7);

  // Yangi sanalar (rejalashtirilganlar) yuqorida; bir kundagilar - TP nomi tartibida.
  const rows: WorkItem[] = repairs.rows
    .map((row) => ({
      id: row.id,
      date: row.date,
      type: row.type,
      done: row.done,
      transformer: row.transformer,
      feeder: row.feeder,
      substation: row.substation,
      staff: row.staff,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const inMonth = repairs.rows.filter((row) => row.date.slice(0, 7) === reportMonth);
  const byType = Object.fromEntries(
    REPAIR_TYPE_ORDER.map((type) => [type, repairs.rows.filter((row) => row.type === type).length]),
  ) as Record<(typeof REPAIR_TYPE_ORDER)[number], number>;

  const done = first(params.done);
  const type = first(params.type);
  const initial: WorkFilters = {
    q: first(params.q),
    done: done === "1" ? "done" : done === "0" ? "planned" : "all",
    type: REPAIR_TYPE_ORDER.find((item) => item === type) ?? "all",
    view: first(params.view) === "calendar" ? "calendar" : "list",
  };

  return (
    <WorksView
      // URL filtrlari o'zgarsa (boshqa sahifadan havola) - holat qaytadan o'qiladi.
      key={JSON.stringify([scopeInfo?.param, initial])}
      title={TITLE}
      subtitle={SUBTITLE}
      periodLabel={period.label}
      reportDate={reportDate}
      scope={scopeInfo}
      // Qamrov obyekti bor, lekin uning ostida shu oy TP holati yo'q - ta'mir
      // sanalari ham yo'q: "0 ta" emas, "ma'lumot yo'q".
      missing={
        scopeInfo && scopeTransformers === 0 ? `${scopeInfo.name} uchun ${period.label} oyida ma’lumot yo’q` : null
      }
      rows={rows}
      stats={{
        total: repairs.rows.length,
        done: repairs.counts.done,
        planned: repairs.counts.planned,
        byType,
        inMonth: inMonth.length,
        inMonthDone: inMonth.filter((row) => row.done).length,
      }}
      initial={initial}
    />
  );
}
