import { DISTRICT_TITLE } from "@/components/shell/nav";
import { prisma } from "@/lib/db/prisma";

/** TP sahifasi sarlavhasi - "<TP nomi> transformatori". */
export default async function TransformerTitle({ params }: PageProps<"/transformers/[id]">) {
  const { id } = await params;
  const transformer = await prisma.transformer.findUnique({
    where: { id },
    select: { name: true },
  });
  return transformer ? `${transformer.name} transformatori` : DISTRICT_TITLE;
}
