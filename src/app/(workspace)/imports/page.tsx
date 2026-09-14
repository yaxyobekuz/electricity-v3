import type { Metadata } from "next";
import { connection } from "next/server";

import { ImportsView } from "@/components/imports/ImportsView";
import { getImportCoverage, listImportHistory } from "@/lib/import/history";

export const metadata: Metadata = { title: "Ma’lumot yuklash" };

/**
 * Sahifa har so'rovda bazadan o'qiladi (`connection()` - build paytida
 * prerender qilinmaydi): import'dan keyin qamrov va tarix darhol yangilanadi.
 */
export default async function ImportsPage() {
  await connection();
  const [coverage, history] = await Promise.all([getImportCoverage(), listImportHistory(50)]);
  return <ImportsView coverage={coverage} history={history} />;
}
