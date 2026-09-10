import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SubscriberDetail } from "@/components/subscribers/SubscriberDetail";
import { findSubscriber, SUBSCRIBERS } from "@/lib/data/subscribers";

/**
 * 48 ta abonentning hammasi build vaqtida statik prerender qilinadi -
 * ma'lumot mock bo'lgani uchun sahifalar o'zgarmaydi.
 */
export function generateStaticParams() {
  return SUBSCRIBERS.map((item) => ({ id: item.id }));
}

export async function generateMetadata(
  props: PageProps<"/subscribers/[id]">,
): Promise<Metadata> {
  const { id } = await props.params;
  const subscriber = findSubscriber(id);
  return { title: subscriber ? subscriber.name : "Abonent topilmadi" };
}

export default async function Page(props: PageProps<"/subscribers/[id]">) {
  const { id } = await props.params;
  const subscriber = findSubscriber(id);
  // Noto'g'ri id bilan kirilsa 404 - `notFound()` dan keyin kod bajarilmaydi.
  if (!subscriber) notFound();

  return <SubscriberDetail subscriber={subscriber} />;
}
