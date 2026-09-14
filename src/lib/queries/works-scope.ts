import "server-only";

import { prisma } from "@/lib/db/prisma";

import { transformerScopeWhere, type Db, type Scope } from "./scope";

/**
 * Qamrovdagi TP holatlari soni (tanlangan oy). Ta'mir sanalari faqat shu
 * holatlardan olinadi: 0 bo'lsa, qamrov uchun shu oyda ma'lumot yo'q -
 * sahifa "0 ta ta'mir" emas, bo'sh holat ko'rsatadi.
 */
export async function countScopeTransformers(periodId: string, scope: Scope, db: Db = prisma): Promise<number> {
  return db.transformerSnapshot.count({ where: { periodId, ...transformerScopeWhere(scope) } });
}
