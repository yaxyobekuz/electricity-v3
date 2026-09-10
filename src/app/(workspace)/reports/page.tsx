import type { Metadata } from "next";

import { ReportsView } from "@/components/reports/ReportsView";

export const metadata: Metadata = { title: "Hisobotlar" };

/**
 * Sahifa server komponenti bo'lib qoladi - `metadata` eksporti faqat shunda
 * ishlaydi. Holat (davr filtri) mijoz komponenti `ReportsView` ichida.
 */
export default function ReportsPage() {
  return <ReportsView />;
}
