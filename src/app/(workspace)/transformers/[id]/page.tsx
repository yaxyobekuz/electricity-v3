import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TransformerDetail } from "@/components/transformers/TransformerDetail";
import { subscribersOfTransformer } from "@/lib/data/subscribers";
import { findTransformer, TRANSFORMERS } from "@/lib/data/transformers";

/**
 * Barcha TP sahifalari statik prerender bo'ladi - ma'lumot mock bo'lgani
 * uchun ular hech qachon o'zgarmaydi.
 */
export function generateStaticParams() {
  return TRANSFORMERS.map((item) => ({ id: item.id }));
}

export async function generateMetadata(
  props: PageProps<"/transformers/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const transformer = findTransformer(id);
  return {
    title: transformer ? `${transformer.code} · Transformator` : "Transformator",
  };
}

/**
 * Detal sahifasi server komponenti bo'lib qoladi: ma'lumot shu yerda
 * tanlanadi, grafiklar va holat esa `TransformerDetail` (mijoz) ichida.
 */
export default async function Page(props: PageProps<"/transformers/[id]">) {
  const { id } = await props.params;
  const transformer = findTransformer(id);
  if (!transformer) notFound();

  return (
    <TransformerDetail
      transformer={transformer}
      subscribers={subscribersOfTransformer(transformer.id)}
    />
  );
}
