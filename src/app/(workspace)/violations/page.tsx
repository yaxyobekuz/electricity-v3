import type { Metadata } from "next";

import { ViolationsView } from "@/components/violations/ViolationsView";

export const metadata: Metadata = { title: "Qoidabuzarliklar" };

/**
 * Sahifa server komponenti bo'lib qoladi - `metadata` eksporti shuni talab
 * qiladi. Qidiruv/filtr holati `ViolationsView` ichida (mijoz tomonida).
 */
export default function Page() {
  return <ViolationsView />;
}
