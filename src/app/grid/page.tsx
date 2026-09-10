import type { Metadata } from "next";

import { GridScreen } from "@/components/grid/GridScreen";

export const metadata: Metadata = {
  title: "Tarmoq holati",
};

/**
 * "/grid" - `(workspace)` guruhidan tashqarida: bu bo'limning o'z ikkilamchi
 * paneli bor (kuchlanish darajalari daraxti), shuning uchun `AppShell` ni
 * `GridScreen` o'zi chizadi.
 *
 * Sahifa server komponenti bo'lib qoladi - `metadata` eksporti faqat shunda
 * ishlaydi; butun holat `GridScreen` ichida.
 */
export default function GridPage() {
  return <GridScreen />;
}
