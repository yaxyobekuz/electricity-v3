import type { Metadata } from "next";

import { FeedersView } from "@/components/feeders/FeedersView";

export const metadata: Metadata = { title: "Fiderlar" };

/**
 * Fiderlar ro'yxati. Sahifa server komponenti bo'lib qoladi (metadata
 * eksporti uchun), qidiruv va filtr holati esa `FeedersView` ichida.
 */
export default function FeedersPage() {
  return <FeedersView />;
}
