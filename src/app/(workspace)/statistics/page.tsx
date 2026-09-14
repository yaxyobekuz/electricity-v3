import type { Metadata } from "next";

import { StatisticsView } from "@/components/statistics/StatisticsView";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { loadStatisticsData } from "@/lib/queries/statistics-data";

export const metadata: Metadata = { title: "Statistika" };

/**
 * "Statistika" - tuman bo'yicha tanlangan oy va undan oldingi davrlar tahlili.
 * Ma'lumot serverda so'rovlardan tayyorlanadi; davr oynasi (Oy / Chorak / Yil)
 * almashtirilganda qayta so'rov yuborilmaydi - uchala oyna oldindan hisoblangan.
 */
export default async function StatisticsPage() {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const data = await loadStatisticsData(period);
  return <StatisticsView data={data} />;
}
