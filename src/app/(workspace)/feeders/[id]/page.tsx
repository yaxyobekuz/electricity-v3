import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomeView } from "@/components/home/HomeView";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { getFeeder } from "@/lib/queries/entities";
import { loadHomeData } from "@/lib/queries/home-data";

// Marshrut: /feeders/[id]. Id - bazadagi fider yozuvi, oylar davomida o'zgarmaydi.

export async function generateMetadata(props: PageProps<"/feeders/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const period = await getSelectedPeriod();
  // Davr yo'q bo'lsa ham fider nomi kerak - holatsiz so'rov (bo'sh periodId).
  const feeder = await getFeeder(id, period?.id ?? "");
  return { title: feeder ? `${feeder.name} fideri` : "Fider topilmadi" };
}

/**
 * Fider detal sahifasi - `/dashboard` va podstansiya sahifasi bilan bir xil
 * maket (Figma `4126:47`, `HomeView`), ko'rsatkichlar shu fider qamrovida.
 * Noma'lum `id` - 404; fider tanlangan oyda holatiga ega bo'lmasa - sarlavha
 * (yon panel) qoladi, maydonda bo'sh holat.
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

  if (!feeder.snapshot) {
    return (
      <div className="h-full rounded-2xl bg-surface">
        <EmptyState
          variant="inline"
          title={`${feeder.name} fideri uchun ${period.label} oyida ma’lumot yo’q`}
          description="Yon paneldan boshqa oyni tanlang yoki shu oy uchun Fiderlar shablonini yuklang."
        />
      </div>
    );
  }

  const data = await loadHomeData(period, { kind: "feeder", id: feeder.id });
  return <HomeView data={data} />;
}
