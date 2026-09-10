import type { Metadata } from "next";

import { SubscribersView } from "@/components/subscribers/SubscribersView";

export const metadata: Metadata = { title: "Abonentlar" };

/**
 * Abonentlar ro'yxati. Sahifa **server** komponenti bo'lib qoladi (metadata
 * eksporti uchun), filtr holati esa mijozdagi `SubscribersView` da yashaydi.
 */
export default function Page() {
  return <SubscribersView />;
}
