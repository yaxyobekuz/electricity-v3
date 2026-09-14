import "server-only";

import { prisma } from "@/lib/db/prisma";

import { listFeeders, listSubstations, listTransformers } from "./lists";
import type { Db, EntityRef } from "./scope";

/*
 * `/reports` sahifasidagi qamrov tanlagichi uchun obyektlar ro'yxati: shu oyda
 * holati bor podstansiya, fider va TP lar - reestr sahifalari bilan bir xil
 * `listSubstations` / `listFeeders` / `listTransformers` dan (fayl tartibida).
 * Mijozga faqat nom va ota obyekt id lari uzatiladi.
 */

export interface ReportScopeOptions {
  substations: EntityRef[];
  feeders: Array<EntityRef & { substationId: string }>;
  transformers: Array<EntityRef & { substationId: string; feederId: string }>;
}

export async function listReportScopeOptions(periodId: string, db: Db = prisma): Promise<ReportScopeOptions> {
  const [substations, feeders, transformers] = await Promise.all([
    listSubstations(periodId, db),
    listFeeders(periodId, {}, db),
    listTransformers(periodId, {}, db),
  ]);
  return {
    substations: substations.map((row) => ({ id: row.id, name: row.name })),
    feeders: feeders.map((row) => ({ id: row.id, name: row.name, substationId: row.substation.id })),
    transformers: transformers.map((row) => ({
      id: row.id,
      name: row.name,
      substationId: row.substation.id,
      feederId: row.feeder.id,
    })),
  };
}
