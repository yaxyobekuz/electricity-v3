import type { Metadata } from "next";

import {
  type StaffColumns,
  type StaffDistrict,
  type StaffItem,
  StaffView,
} from "@/components/staff/StaffView";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { DISTRICT, getScopeSummary } from "@/lib/queries/scope";
import { listStaffLinks } from "@/lib/queries/staff-links";
import { listStaffActivity } from "@/lib/queries/staff";

export const metadata: Metadata = { title: "Ma’sul xodimlar" };

/**
 * Xodimlar - tanlangan oy holatlari va yozuvlarida "Ma’sul xodim" /
 * "Biriktirilgan xodim" sifatida uchragan har bir F.I.Sh. (`listStaffActivity`).
 * `?q` - boshlang'ich qidiruv (boshqa sahifalardagi xodim havolalari).
 *
 * Xodim ustuni ixtiyoriy, shuning uchun xodimlar yig'indisi tuman sonidan kam
 * bo'lishi mumkin. Tuman sonlari (izohlar va "Muddati buzilgan" kartasi) -
 * boshqa sahifalar bilan bir xil manbadan (`getScopeSummary`).
 */
export default async function Page({ searchParams }: PageProps<"/staff">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const [params, activity, links, summary] = await Promise.all([
    searchParams,
    listStaffActivity(period.id),
    listStaffLinks(period.id),
    getScopeSummary(period.id, DISTRICT),
  ]);
  const q = (Array.isArray(params.q) ? params.q[0] : params.q) ?? "";

  // Shablon shu oyga yuklanmagan bo'lsa, uning ustunidagi 0 - "ma'lumot yo'q":
  // ustun va unga tayangan son ko'rsatilmaydi.
  const columns: StaffColumns = {
    substations: activity.uploads.SUBSTATIONS,
    feeders: activity.uploads.FEEDERS,
    transformers: activity.uploads.TRANSFORMERS,
    subscribers: activity.uploads.SUBSCRIBERS,
    violations: activity.uploads.VIOLATIONS,
    appeals: activity.uploads.APPEALS,
  };

  // Yuklanmagan shablon soni null - yig'indiga kirmaydi.
  const { counts } = summary;
  const district: StaffDistrict = {
    objects: (counts.substations ?? 0) + (counts.feeders ?? 0) + (counts.transformers ?? 0),
    subscribers: summary.subscriberList.total,
    appeals: summary.appeals.total,
    appealsOverdue: summary.appeals.byStatus.OVERDUE,
  };

  const rows: StaffItem[] = activity.rows.map((row) => ({
    id: row.id,
    name: row.name,
    substations: row.substations,
    feeders: row.feeders,
    transformers: row.transformers,
    subscribers: row.subscribers,
    violations: row.violations,
    damageUzs: row.damageUzs,
    appeals: row.appeals,
    appealsOverdue: row.appealsOverdue,
    links: links.get(row.id) ?? null,
  }));

  return (
    <StaffView
      key={q}
      periodLabel={period.label}
      reportDate={period.reportDate}
      columns={columns}
      rows={rows}
      totals={activity.totals}
      district={district}
      initialQuery={q}
    />
  );
}
