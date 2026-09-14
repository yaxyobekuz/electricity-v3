import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TransformerDetail } from "@/components/transformers/TransformerDetail";
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
 * TP detal sahifasi - fider sahifasi bilan bir xil maket, ma'lumot esa shu
 * TP qamrovida (`TransformerDetail` -> `@/lib/data/transformer-scope`).
 */
export default async function Page(props: PageProps<"/transformers/[id]">) {
  const { id } = await props.params;
  const transformer = findTransformer(id);
  if (!transformer) notFound();

  return <TransformerDetail transformer={transformer} />;
}
