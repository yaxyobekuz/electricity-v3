import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TransformerDetail } from "@/components/transformers/TransformerDetail";
import { EmptyState } from "@/components/ui/EmptyState";
import { getSelectedPeriod } from "@/lib/period";
import { getTransformer } from "@/lib/queries/entities";
import { getTransformerDetailData } from "@/lib/queries/transformers-detail";

/*
 * Sahifa dinamik: tanlangan oy cookie'dan o'qiladi va har importdan keyin
 * yangi ma'lumot darhol ko'rinadi (`generateStaticParams` yo'q).
 */

export async function generateMetadata(
  props: PageProps<"/transformers/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const period = await getSelectedPeriod();
  // `getTransformer` keshlangan - sahifa o'zi xuddi shu so'rovni qayta yubormaydi.
  const transformer = period ? await getTransformer(id, period.id) : null;
  return { title: transformer ? `${transformer.name} · Transformator` : "Transformator" };
}

/** TP detal sahifasi - fider sahifasi bilan bir xil maket, shu TP qamrovida. */
export default async function Page(props: PageProps<"/transformers/[id]">) {
  const { id } = await props.params;
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const data = await getTransformerDetailData(id, period);
  if (!data) notFound();

  return <TransformerDetail data={data} />;
}
