import type { Metadata } from "next";

import { TransformersView } from "@/components/transformers/TransformersView";

export const metadata: Metadata = { title: "Transformatorlar" };

/**
 * Server komponenti: `metadata` shu yerdan eksport qilinadi, qidiruv va filtr
 * holati esa `TransformersView` (mijoz komponenti) ichida yashaydi.
 */
export default function Page() {
  return <TransformersView />;
}
