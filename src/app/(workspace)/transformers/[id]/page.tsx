import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HomeView } from "@/components/home/HomeView";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { getTransformer } from "@/lib/queries/entities";
import { loadHomeData } from "@/lib/queries/home-data";

// Marshrut: /transformers/[id]. Id - bazadagi TP yozuvi, oylar davomida o'zgarmaydi.

export async function generateMetadata(
  props: PageProps<"/transformers/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const period = await getSelectedPeriod();
  // Davr yo'q bo'lsa ham nom kerak - holatsiz so'rov (bo'sh periodId).
  // `getTransformer` - `cache`: sahifa bilan bitta so'rov.
  const transformer = await getTransformer(id, period?.id ?? "");
  return { title: transformer ? `${transformer.name} · Transformator` : "Transformator topilmadi" };
}

/**
 * TP detal sahifasi - `/dashboard`, podstansiya va fider sahifalari bilan bir
 * xil maket (Figma `4126:47`, `HomeView`), ko'rsatkichlar shu TP qamrovida.
 * Noma'lum `id` - 404; TP tanlangan oyda holatiga ega bo'lmasa - sarlavha
 * (yon panel) qoladi, maydonda bo'sh holat.
 *
 * `PageProps` - Next.js generatsiya qiladigan **global** tip, import
 * qilinmaydi. Parametrlar Next 16 da promise: `await props.params`.
 */
export default async function TransformerPage(props: PageProps<"/transformers/[id]">) {
  const { id } = await props.params;
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const transformer = await getTransformer(id, period.id);
  if (!transformer) notFound();

  if (!transformer.snapshot) {
    return (
      <div className="h-full rounded-2xl bg-surface">
        <EmptyState
          variant="inline"
          title={`${transformer.name} transformatori uchun ${period.label} oyida ma’lumot yo’q`}
          description="Yon paneldan boshqa oyni tanlang yoki shu oy uchun Transformatorlar shablonini yuklang."
        />
      </div>
    );
  }

  const data = await loadHomeData(period, { kind: "transformer", id: transformer.id });
  return <HomeView data={data} />;
}
