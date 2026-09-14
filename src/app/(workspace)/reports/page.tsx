import type { Metadata } from "next";

import { ReportsView, type ReportTemplateStatus, type ScopePick } from "@/components/reports/ReportsView";
import { EmptyState } from "@/components/ui/EmptyState";
import { TEMPLATE_LABEL, TEMPLATE_ORDER } from "@/lib/domain/labels";
import { formatDate } from "@/lib/format";
import { getPeriodsUntil, getPeriodUploads, getSelectedPeriod } from "@/lib/period";
import { DISTRICT_NAME } from "@/lib/queries/reports-data";
import { listReportScopeOptions } from "@/lib/queries/reports-options";
import { periodRangeLabel } from "@/lib/reports/period-range";
import { parseScopeParam, scopeParam } from "@/lib/scope-param";

export const metadata: Metadata = { title: "Hisobotlar" };

/** Yillik hisobot qamraydigan eng ko'p oylar soni (`/api/reports` bilan bir xil). */
const YEARLY_MONTHS = 12;

/**
 * "Hisobotlar" - tanlangan oy uchun oylik va yillik hisobotni yuklab olish.
 * Qamrov tanlagichi shu oyda holati bor podstansiya / fider / TP lardan
 * tuziladi; fayl `/api/reports` da faqat shablon ma'lumotidan shakllanadi.
 * `?scope=<kind>:<id>` - tanlagichning boshlang'ich qiymati.
 */
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const [params, options, uploads, history] = await Promise.all([
    searchParams,
    listReportScopeOptions(period.id),
    getPeriodUploads(period.id),
    getPeriodsUntil(period, YEARLY_MONTHS),
  ]);

  // Boshlang'ich qamrov: obyekt shu oyning ro'yxatida bo'lsagina tanlanadi.
  const scope = parseScopeParam(params.scope);
  let initial: ScopePick = { substationId: null, feederId: null, transformerId: null };
  if (scope.kind === "substation" && options.substations.some((row) => row.id === scope.id)) {
    initial = { ...initial, substationId: scope.id };
  } else if (scope.kind === "feeder") {
    const feeder = options.feeders.find((row) => row.id === scope.id);
    if (feeder) initial = { ...initial, substationId: feeder.substationId, feederId: feeder.id };
  } else if (scope.kind === "transformer") {
    const tp = options.transformers.find((row) => row.id === scope.id);
    if (tp) initial = { substationId: tp.substationId, feederId: tp.feederId, transformerId: tp.id };
  }

  const templates: ReportTemplateStatus[] = TEMPLATE_ORDER.map((type) => ({
    type,
    label: TEMPLATE_LABEL[type],
    uploaded: uploads[type],
  }));

  return (
    <ReportsView
      // URL dagi qamrov o'zgarsa tanlagich `initial` dan qayta boshlanadi. Oy
      // almashganda esa holat saqlanadi - ko'rinishning o'zi yangi oyda yo'q
      // obyektni tanlovdan tushiradi.
      key={scopeParam(scope) || "district"}
      period={{ key: period.key, label: period.label, reportDate: formatDate(period.reportDate) }}
      yearly={{ rangeLabel: periodRangeLabel(history.map((item) => item.month)), months: history.length }}
      districtName={DISTRICT_NAME}
      substations={options.substations}
      feeders={options.feeders}
      transformers={options.transformers}
      templates={templates}
      initial={initial}
    />
  );
}
