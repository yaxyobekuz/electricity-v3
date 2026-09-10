import type { Metadata } from "next";

import { StaffView } from "@/components/staff/StaffView";

// Sahifa server komponenti bo'lib qoladi: `metadata` faqat shu yerdan
// eksport qilinadi, holat esa `StaffView` ("use client") ichida.
export const metadata: Metadata = { title: "Ma’sul xodimlar" };

export default function Page() {
  return <StaffView />;
}
