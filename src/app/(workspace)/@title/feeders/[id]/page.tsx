import { DISTRICT_TITLE } from "@/components/shell/nav";
import { prisma } from "@/lib/db/prisma";

/** Fider sahifasi sarlavhasi - fider nomi. */
export default async function FeederTitle({ params }: PageProps<"/feeders/[id]">) {
  const { id } = await params;
  const feeder = await prisma.feeder.findUnique({
    where: { id },
    select: { name: true },
  });
  return feeder?.name ?? DISTRICT_TITLE;
}
