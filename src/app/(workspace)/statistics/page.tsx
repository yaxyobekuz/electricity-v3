import type { Metadata } from "next";

import { StatisticsView } from "@/components/statistics/StatisticsView";

export const metadata: Metadata = { title: "Statistika" };

/**
 * Sahifa server komponenti bo'lib qoladi (`metadata` eksporti uchun) - davr
 * tanlagichi va grafiklar `StatisticsView` ichida, mijozda ishlaydi.
 */
export default function Page() {
  return <StatisticsView />;
}
