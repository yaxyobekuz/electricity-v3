import type { Metadata } from "next";

import { WorksView } from "@/components/works/WorksView";

export const metadata: Metadata = { title: "Ishlar" };

/**
 * Sahifa server komponenti bo'lib qoladi - `metadata` eksporti shuni talab
 * qiladi. Filtr, qidiruv va ko'rinish holati `WorksView` ichida yashaydi.
 */
export default function Page() {
  return <WorksView />;
}
