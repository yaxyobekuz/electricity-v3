import "server-only";

import { prisma } from "@/lib/db/prisma";
import { scopeParam } from "@/lib/scope-param";

import { getFeeder, getSubstation, getTransformer } from "./entities";
import type { Db, Scope } from "./scope";

/*
 * Reestr sahifalari (qoidabuzarliklar, murojaatlar) sarlavhasi uchun qamrov
 * obyekti: `?scope=feeder:<id>` qaysi obyektni bildiradi. Nomi va havolasi
 * `entities.ts` dagi keshlangan so'rovlardan olinadi - detal sahifasi bilan
 * bitta manba.
 */

export interface RegistryScope {
  /** `"feeder:<id>"` - URL parametri. */
  param: string;
  /** "Podstansiya" / "Fider" / "TP". */
  kindLabel: string;
  name: string;
  /** Obyektning detal sahifasi. */
  href: string;
}

/**
 * Tuman - null. Obyekt bazada yo'q (noto'g'ri id) - `undefined`, sahifa
 * `notFound()` qiladi: bo'sh ro'yxatni "0 ta" deb ko'rsatib bo'lmaydi.
 */
export async function getRegistryScope(
  scope: Scope,
  periodId: string,
  db: Db = prisma,
): Promise<RegistryScope | null | undefined> {
  switch (scope.kind) {
    case "district":
      return null;
    case "substation": {
      const entity = await getSubstation(scope.id, periodId, db);
      return entity
        ? { param: scopeParam(scope), kindLabel: "Podstansiya", name: entity.name, href: `/substations/${entity.id}` }
        : undefined;
    }
    case "feeder": {
      const entity = await getFeeder(scope.id, periodId, db);
      return entity
        ? { param: scopeParam(scope), kindLabel: "Fider", name: entity.name, href: `/feeders/${entity.id}` }
        : undefined;
    }
    case "transformer": {
      const entity = await getTransformer(scope.id, periodId, db);
      return entity
        ? { param: scopeParam(scope), kindLabel: "TP", name: entity.name, href: `/transformers/${entity.id}` }
        : undefined;
    }
  }
}
