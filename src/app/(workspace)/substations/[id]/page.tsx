import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SubstationDetail } from "@/components/substations/SubstationDetail";
import { findSubstation, SUBSTATIONS } from "@/lib/data/substations";

// Marshrut: /substations/[id]. Ro'yxatdagi har bir qator shu sahifaga olib keladi.

/**
 * Barcha podstansiyalar oldindan ma'lum - shuning uchun sahifalar qurilish
 * paytida statik prerender qilinadi (ro'yxatdan o'tishda kutish bo'lmaydi).
 */
export function generateStaticParams() {
  return SUBSTATIONS.map((item) => ({ id: item.id }));
}

export async function generateMetadata(
  props: PageProps<"/substations/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const substation = findSubstation(id);
  return { title: substation ? substation.name : "Podstansiya topilmadi" };
}

/**
 * Podstansiya detal sahifasi.
 *
 * `PageProps` - Next.js generatsiya qiladigan **global** tip, import
 * qilinmaydi. Parametrlar Next 16 da promise: `await props.params`.
 */
export default async function SubstationPage(props: PageProps<"/substations/[id]">) {
  const { id } = await props.params;
  const substation = findSubstation(id);
  if (!substation) notFound();

  return <SubstationDetail substation={substation} />;
}
