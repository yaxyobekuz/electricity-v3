import { DISTRICT_TITLE } from "@/components/shell/nav";
import { prisma } from "@/lib/db/prisma";

/** Podstansiya sahifasi sarlavhasi - podstansiya nomi. */
export default async function SubstationTitle({ params }: PageProps<"/substations/[id]">) {
  const { id } = await params;
  const substation = await prisma.substation.findUnique({
    where: { id },
    select: { name: true },
  });
  return substation?.name ?? DISTRICT_TITLE;
}
