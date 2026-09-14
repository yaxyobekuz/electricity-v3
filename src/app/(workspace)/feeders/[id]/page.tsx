import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeederDetail } from "@/components/feeders/FeederDetail";
import { FEEDERS, findFeeder } from "@/lib/data/feeders";

// Marshrut: /feeders/[id]. Ro'yxatdagi har bir qator shu sahifaga olib keladi.

/** Barcha fiderlar oldindan ma'lum - sahifalar qurilishda statik prerender qilinadi. */
export function generateStaticParams() {
  return FEEDERS.map((item) => ({ id: item.id }));
}

export async function generateMetadata(
  props: PageProps<"/feeders/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const feeder = findFeeder(id);
  return { title: feeder ? feeder.name : "Fider topilmadi" };
}

/**
 * Fider detal sahifasi - maket (Figma `4029:930`) 1ga 1, kartalardagi
 * ko'rsatkichlar hozircha maketdagi qiymatlar. Noma'lum `id` 404 beradi.
 *
 * `PageProps` - Next.js generatsiya qiladigan **global** tip, import
 * qilinmaydi. Parametrlar Next 16 da promise: `await props.params`.
 */
export default async function FeederPage(props: PageProps<"/feeders/[id]">) {
  const { id } = await props.params;
  if (!findFeeder(id)) notFound();

  return <FeederDetail />;
}
