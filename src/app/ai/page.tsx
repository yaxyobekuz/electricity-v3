import type { Metadata } from "next";

import { AiScreen } from "@/components/ai/AiScreen";

export const metadata: Metadata = { title: "Sun’iy intellekt" };

/**
 * Sun'iy intellekt bo'limi ikkilamchi panelini o'zi chizadi (xarita sahifasi
 * kabi), shuning uchun `(workspace)` guruhiga kirmaydi va `AppShell` ni
 * `AiScreen` ichida chaqiradi. Sahifa esa server komponenti bo'lib qoladi -
 * `metadata` faqat shu holatda eksport qilinadi.
 */
export default function AiPage() {
  return <AiScreen />;
}
