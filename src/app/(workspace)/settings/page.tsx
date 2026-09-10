import type { Metadata } from "next";

import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Sozlamalar" };

/**
 * Sahifa server komponenti bo'lib qoladi (metadata eksporti uchun),
 * barcha holat esa mijoz tomonidagi `SettingsView` ichida.
 */
export default function Page() {
  return <SettingsView />;
}
