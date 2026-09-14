import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomeView } from "@/components/home/HomeView";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { getSubstation } from "@/lib/queries/entities";
import { loadHomeData } from "@/lib/queries/home-data";

// Marshrut: /substations/[id]. Id - bazadagi podstansiya yozuvi, oylar davomida o'zgarmaydi.

export async function generateMetadata(
  props: PageProps<"/substations/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const period = await getSelectedPeriod();
  // Davr yo'q bo'lsa ham nom kerak - holatsiz so'rov (bo'sh periodId).
  // `getSubstation` - `cache`: sahifa bilan bitta so'rov.
  const substation = await getSubstation(id, period?.id ?? "");
  return { title: substation ? substation.name : "Podstansiya topilmadi" };
}

/**
 * Podstansiya detal sahifasi - `/dashboard` bilan bir xil maket (Figma
 * `4126:47`), ko'rsatkichlar shu podstansiya qamrovida. Noma'lum `id` - 404;
 * podstansiya tanlangan oyda holatiga ega bo'lmasa - sarlavha (yon panel)
 * qoladi, maydonda bo'sh holat.
 *
 * `PageProps` - Next.js generatsiya qiladigan **global** tip, import
 * qilinmaydi. Parametrlar Next 16 da promise: `await props.params`.
 */
export default async function SubstationPage(props: PageProps<"/substations/[id]">) {
  const { id } = await props.params;
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const substation = await getSubstation(id, period.id);
  if (!substation) notFound();

  if (!substation.snapshot) {
    return (
      <div className="h-full rounded-2xl bg-surface">
        <EmptyState
          variant="inline"
          title={`${substation.name} uchun ${period.label} oyida ma’lumot yo’q`}
          description="Yon paneldan boshqa oyni tanlang yoki shu oy uchun Podstansiyalar shablonini yuklang."
        />
      </div>
    );
  }

  const data = await loadHomeData(period, { kind: "substation", id: substation.id });
  return <HomeView data={data} />;
}
