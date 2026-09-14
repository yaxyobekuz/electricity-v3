import type { Metadata } from "next";

import { HomeView } from "@/components/home/HomeView";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { loadHomeData } from "@/lib/queries/home-data";

export const metadata: Metadata = { title: "Asosiy" };

/**
 * "Asosiy" - tuman bo'yicha tanlangan oy ko'rsatkichlari. Oy cookie'dan
 * (`getSelectedPeriod`), shuning uchun sahifa dinamik: import'dan keyin
 * darhol yangi ma'lumot ko'rinadi.
 */
export default async function DashboardPage() {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const data = await loadHomeData(period, { kind: "district" });
  return <HomeView data={data} />;
}
