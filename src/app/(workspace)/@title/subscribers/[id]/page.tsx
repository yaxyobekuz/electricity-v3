import { DISTRICT_TITLE } from "@/components/shell/nav";
import { prisma } from "@/lib/db/prisma";

/**
 * Abonent sahifasi sarlavhasi - F.I.Sh. Abonent obyektida nom yo'q (faqat
 * shartnoma raqami), shuning uchun eng so'nggi oy holatidan olinadi.
 */
export default async function SubscriberTitle({ params }: PageProps<"/subscribers/[id]">) {
  const { id } = await params;
  const snapshot = await prisma.subscriberSnapshot.findFirst({
    where: { subscriberId: id },
    orderBy: { period: { month: "desc" } },
    select: { fullName: true },
  });
  return snapshot?.fullName ?? DISTRICT_TITLE;
}
