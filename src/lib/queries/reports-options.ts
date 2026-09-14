import "server-only";

import { prisma } from "@/lib/db/prisma";

import type { Db, EntityRef } from "./scope";

/*
 * `/reports` sahifasidagi qamrov tanlagichi uchun obyektlar ro'yxati: shu oyda
 * holati bor podstansiya, fider va TP lar. Manba va tartib `listSubstations` /
 * `listFeeders` / `listTransformers` bilan bir xil (`*Snapshot`, `rowNumber`),
 * lekin faqat nom va ota obyekt - tanlagichga yig'indilar kerak emas.
 */

export interface ReportScopeOptions {
  substations: EntityRef[];
  feeders: Array<EntityRef & { substationId: string }>;
  transformers: Array<EntityRef & { substationId: string; feederId: string }>;
}

export async function listReportScopeOptions(periodId: string, db: Db = prisma): Promise<ReportScopeOptions> {
  const [substations, feeders, transformers] = await Promise.all([
    db.substationSnapshot.findMany({
      where: { periodId },
      orderBy: { rowNumber: "asc" },
      select: { substation: { select: { id: true, name: true } } },
    }),
    db.feederSnapshot.findMany({
      where: { periodId },
      orderBy: { rowNumber: "asc" },
      select: { feeder: { select: { id: true, name: true, substationId: true } } },
    }),
    db.transformerSnapshot.findMany({
      where: { periodId },
      orderBy: { rowNumber: "asc" },
      select: { transformer: { select: { id: true, name: true, substationId: true, feederId: true } } },
    }),
  ]);
  return {
    substations: substations.map((row) => row.substation),
    feeders: feeders.map((row) => row.feeder),
    transformers: transformers.map((row) => row.transformer),
  };
}
