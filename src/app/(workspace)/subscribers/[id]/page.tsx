import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SubscriberDetail } from "@/components/subscribers/SubscriberDetail";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPreviousPeriod, getSelectedPeriod } from "@/lib/period";
import { getSubscriber, getSubscriberHistory } from "@/lib/queries/entities";
import { getSubscriberRelated } from "@/lib/queries/subscribers-related";

/** Dinamika: tanlangan oy va undan oldingi eng ko'pi 12 oy (`malumotlar.md` 2-bo'lim). */
const HISTORY_LIMIT = 12;

export async function generateMetadata({ params }: PageProps<"/subscribers/[id]">): Promise<Metadata> {
  const [{ id }, period] = await Promise.all([params, getSelectedPeriod()]);
  if (!period) return { title: "Abonent" };
  // `getSubscriber` - `cache`: sahifa bilan bitta so'rov.
  const subscriber = await getSubscriber(id, period.id);
  return { title: subscriber ? subscriber.fullName : "Abonent topilmadi" };
}

export default async function Page({ params }: PageProps<"/subscribers/[id]">) {
  const period = await getSelectedPeriod();
  if (!period) return <EmptyState />;

  const { id } = await params;
  const subscriber = await getSubscriber(id, period.id);
  if (!subscriber) notFound();

  const [history, related, previousPeriod] = await Promise.all([
    getSubscriberHistory(id),
    subscriber.snapshot ? getSubscriberRelated(id, period.id) : Promise.resolve(null),
    getPreviousPeriod(period),
  ]);

  // Tanlangan oydan keyingi oylar ko'rsatilmaydi - sahifa shu oy "holatiga".
  const points = history.filter((point) => point.key <= period.key).slice(-HISTORY_LIMIT);
  const previous = previousPeriod ? (points.find((point) => point.key === previousPeriod.key) ?? null) : null;

  return (
    <SubscriberDetail
      subscriber={subscriber}
      period={period}
      history={points}
      previous={previous}
      related={related}
    />
  );
}
