import type { Metadata } from "next";

import { SearchScreen } from "@/components/search/SearchScreen";

export const metadata: Metadata = {
  title: "Qidiruv",
};

/**
 * Qidiruv "Boshqaruv paneli" guruhiga kirmaydi - o'zining ikkilamchi paneli
 * bor, shuning uchun `(workspace)` maketidan tashqarida turadi va qobiqni
 * `SearchScreen` o'zi chizadi (xarita sahifasi bilan bir xil yondashuv).
 */
export default function SearchPage() {
  return <SearchScreen />;
}
