import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeederDetail } from "@/components/feeders/FeederDetail";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { getFeeder } from "@/lib/queries/entities";
import { getFeederDashboard } from "@/lib/queries/feeders-detail";

// Marshrut: /feeders/[id]. Id - bazadagi fider yozuvi, oylar davomida o'zgarmaydi.

export async function generateMetadata(props: PageProps<"/feeders/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const period = await getSelectedPeriod();
  // Davr yo'q bo'lsa ham fider nomi kerak - holatsiz so'rov (bo'sh periodId).
  const feeder = await getFeeder(id, period?.id ?? "");
  return { title: feeder ? `${feeder.name} fideri` : "Fider topilmadi" };
}

/**
 * Fider detal sahifasi. Noma'lum `id` - 404; fider bor, lekin tanlangan oyda
 * holati yo'q - sarlavha va "ma'lumot yo'q" holati.
 *
 * `PageProps` - Next.js generatsiya qiladigan **global** tip, import
 * qilinmaydi. Parametrlar Next 16 da promise: `await props.params`.
 */
export default async function FeederPage(props: PageProps<"/feeders/[id]">) {
  const { id } = await props.params;
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const feeder = await getFeeder(id, period.id);
  if (!feeder) notFound();

  const dashboard = feeder.snapshot ? await getFeederDashboard(feeder, period) : null;

  return <FeederDetail data={{ feeder, period, dashboard }} />;
}
