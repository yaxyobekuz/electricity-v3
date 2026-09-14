import "server-only";

import { prisma } from "@/lib/db/prisma";

import { getFeeder, getSubstation, getTransformer } from "./entities";
import { listTransformers } from "./lists";
import { getScopeSummary, type Db, type EntityRef, type Scope, type ScopeSummary } from "./scope";

/*
 * "Transformatorlar" reestri (`/transformers`) uchun ma'lumot: qamrov obyekti,
 * shu oyning TP qatorlari va qamrov xulosasi.
 *
 * Qamrov (`?scope=`) - tuman, podstansiya, fider yoki bitta TP. Qatorlar
 * serverda qamrov bo'yicha filtrlanadi (`listTransformers`), statistika esa
 * AYNAN `getScopeSummary` dan - reestrdagi jami son boshqa sahifalardagi
 * xuddi shu qamrov soni bilan bir xil chiqadi (malumotlar.md 5-bo'lim).
 */

/** Mijoz jadvaliga boradigan qator - faqat ko'rsatiladigan maydonlar. */
export interface TransformerRegistryRow {
  id: string;
  name: string;
  substation: EntityRef;
  feeder: EntityRef;
  address: string | null;
  staff: EntityRef | null;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  /** Yo'qotish / Umumiy oqim; umumiy oqim ≤ 0 bo'lsa - null. */
  lossPercent: number | null;
  onlineSubscribers: number;
  offlineSubscribers: number;
  capacityKva: number | null;
  /** Qoidabuzarliklar shu oyga yuklanmagan bo'lsa - null. */
  violations: number | null;
  /** Murojaatlar shu oyga yuklanmagan bo'lsa - null. */
  appeals: number | null;
}

/** Qamrov obyekti (sarlavha va "filtrni olib tashlash" uchun). */
export type RegistryScopeInfo =
  | { kind: "district" }
  | { kind: "substation"; substation: EntityRef }
  | { kind: "feeder"; feeder: EntityRef; substation: EntityRef }
  | { kind: "transformer"; transformer: EntityRef; feeder: EntityRef; substation: EntityRef };

export interface TransformerRegistry {
  scope: RegistryScopeInfo;
  rows: TransformerRegistryRow[];
  summary: ScopeSummary;
}

/** Qamrov obyekti va `listTransformers` filtri; obyekt bazada topilmasa - null. */
async function resolveRegistryScope(
  periodId: string,
  scope: Scope,
  db: Db,
): Promise<{ info: RegistryScopeInfo; filters: { substationId?: string; feederId?: string } } | null> {
  switch (scope.kind) {
    case "district":
      return { info: { kind: "district" }, filters: {} };
    case "substation": {
      const substation = await getSubstation(scope.id, periodId, db);
      if (!substation) return null;
      return {
        info: { kind: "substation", substation: { id: substation.id, name: substation.name } },
        filters: { substationId: substation.id },
      };
    }
    case "feeder": {
      const feeder = await getFeeder(scope.id, periodId, db);
      if (!feeder) return null;
      return {
        info: { kind: "feeder", feeder: { id: feeder.id, name: feeder.name }, substation: feeder.substation },
        filters: { feederId: feeder.id },
      };
    }
    case "transformer": {
      const transformer = await getTransformer(scope.id, periodId, db);
      if (!transformer) return null;
      return {
        info: {
          kind: "transformer",
          transformer: { id: transformer.id, name: transformer.name },
          feeder: transformer.feeder,
          substation: transformer.substation,
        },
        // TP filtri `listTransformers` da yo'q - fider bo'yicha olib, pastda id bilan qoldiriladi.
        filters: { feederId: transformer.feeder.id },
      };
    }
  }
}

/**
 * Qamrov obyekti bazada topilmasa - null (sahifa `notFound()`). Obyekt bor,
 * lekin shu oyda holati yo'q bo'lsa - bo'sh qatorlar va `summary.energy = null`.
 */
export async function getTransformerRegistry(
  periodId: string,
  scope: Scope,
  db: Db = prisma,
): Promise<TransformerRegistry | null> {
  const resolved = await resolveRegistryScope(periodId, scope, db);
  if (!resolved) return null;

  const [rows, summary] = await Promise.all([
    listTransformers(periodId, resolved.filters, db),
    getScopeSummary(periodId, scope, db),
  ]);
  const scoped = scope.kind === "transformer" ? rows.filter((row) => row.id === scope.id) : rows;

  return {
    scope: resolved.info,
    rows: scoped.map((row) => ({
      id: row.id,
      name: row.name,
      substation: row.substation,
      feeder: row.feeder,
      address: row.address,
      staff: row.staff,
      totalKwh: row.totalKwh,
      usefulKwh: row.usefulKwh,
      lossKwh: row.lossKwh,
      lossPercent: row.lossPercent,
      onlineSubscribers: row.onlineSubscribers,
      offlineSubscribers: row.offlineSubscribers,
      capacityKva: row.capacityKva,
      violations: row.violations,
      appeals: row.appeals,
    })),
    summary,
  };
}
