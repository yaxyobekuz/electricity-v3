import type { Metadata } from "next";

import { Placeholder } from "@/components/shell/Placeholder";

export const metadata: Metadata = { title: "Murojaatlar" };

/** Sidebar havolasi maketda bor, sahifaning o'z maketi hali chizilmagan. */
export default function Page() {
  return <Placeholder title="Murojaatlar" />;
}
