import type { Metadata } from "next";

import { SubstationsView } from "@/components/substations/SubstationsView";

export const metadata: Metadata = { title: "Podstansiyalar" };

/**
 * Podstansiyalar ro'yxati.
 *
 * Sahifa **server** komponenti bo'lib qoladi (metadata eksporti uchun),
 * qidiruv va filtr holati esa `SubstationsView` ichida - u mijoz komponenti.
 */
export default function SubstationsPage() {
  return <SubstationsView />;
}
