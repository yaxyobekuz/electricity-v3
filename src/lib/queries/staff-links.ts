import "server-only";

import { prisma } from "@/lib/db/prisma";
import { nameKey } from "@/lib/domain/normalize";
import { scopedHref } from "@/lib/scope-param";

import { listAppeals, listViolations } from "./lists";
import type { Db, EntityRef, Scope } from "./scope";

/*
 * Xodimlar sahifasidagi sonlar uchun "aniq" havolalar. Son havolaga faqat
 * ochiladigan sahifa AYNAN shu xodimning yozuvlarini (shuncha qatorni)
 * ko'rsatsa aylanadi; aks holda son oddiy matn bo'lib qoladi. Xodim bo'yicha
 * filtr reestrlarda yo'q, shuning uchun aniq havola uch xil bo'lishi mumkin:
 *
 *   1. yozuv bitta va uning sahifasi bor        -> `/feeders/<id>`;
 *   2. qidiruv (`?q=<F.I.Sh.>`) aynan shu yozuvlarni qaytaradi - faqat
 *      qoidabuzarlik va murojaatlar (ularning qidiruvi xodim nomini ham
 *      qamraydi); oyning ro'yxati bir marta o'qiladi va qidiruv xotirada
 *      reestr bilan bir xil maydonlarda tekshiriladi;
 *   3. xodimning yozuvlari bitta qamrovning (TP / fider / podstansiya) shu
 *      oydagi BARCHA yozuvlari -> `?scope=<kind>:<id>`; butun tuman bo'lsa -
 *      filtrsiz reestr.
 *
 * Abonentlar qator-qator o'qilmaydi: (xodim, TP) guruhlari sanaladi, id esa
 * faqat bitta abonenti bor xodimlar uchun olinadi.
 */

export interface StaffLinks {
  substations: string | null;
  feeders: string | null;
  transformers: string | null;
  subscribers: string | null;
  violations: string | null;
  appeals: string | null;
}

type Level = "transformer" | "feeder" | "substation";

/**
 * Yozuvlar guruhi: bir xodimga biriktirilgan va bir xil obyektlar ostidagi
 * `count` ta yozuv. `id` - guruhdagi yagona yozuv (tafsilot havolasi uchun).
 */
interface Placement {
  staffId: string | null;
  count: number;
  id?: string;
  transformer?: string;
  feeder?: string;
  substation?: string;
}

/**
 * Xodim -> havola. `levels` - tekshiriladigan qamrovlar, torroqdan
 * kengrog'iga (birinchi mos kelgani olinadi).
 */
function exactLinks(
  groups: readonly Placement[],
  registry: string,
  levels: readonly Level[],
  detail?: (id: string) => string,
): Map<string, string> {
  let all = 0;
  const totals = new Map<string, number>();
  const byStaff = new Map<string, { total: number; groups: Placement[] }>();
  for (const group of groups) {
    all += group.count;
    for (const level of levels) {
      const id = group[level];
      if (id) totals.set(`${level}:${id}`, (totals.get(`${level}:${id}`) ?? 0) + group.count);
    }
    if (!group.staffId) continue;
    const own = byStaff.get(group.staffId);
    if (own) {
      own.total += group.count;
      own.groups.push(group);
    } else {
      byStaff.set(group.staffId, { total: group.count, groups: [group] });
    }
  }

  const links = new Map<string, string>();
  for (const [staffId, own] of byStaff) {
    const single = own.total === 1 ? own.groups[0].id : undefined;
    if (single && detail) {
      links.set(staffId, detail(single));
      continue;
    }
    let href: string | null = null;
    for (const level of levels) {
      const ids = new Set(own.groups.map((group) => group[level]));
      if (ids.size !== 1) continue;
      const [id] = ids;
      if (id && totals.get(`${level}:${id}`) === own.total) {
        href = scopedHref(registry, { kind: level, id } as Scope);
        break;
      }
    }
    if (!href && own.total === all) href = registry;
    if (href) links.set(staffId, href);
  }
  return links;
}

/** Reestr qatori: xodimi, joylashuvi va qidiruv tekshiradigan maydonlar. */
interface SearchableRow {
  id: string;
  staff: EntityRef | null;
  transformer: EntityRef;
  feeder: EntityRef;
  substation: EntityRef;
}

function placementOf(row: SearchableRow): Placement {
  return {
    staffId: row.staff?.id ?? null,
    count: 1,
    id: row.id,
    transformer: row.transformer.id,
    feeder: row.feeder.id,
    substation: row.substation.id,
  };
}

/**
 * Qidiruv havolasi (`/violations?q=<F.I.Sh.>`) aniqmi: `?q` shu F.I.Sh. bo'lganda
 * reestr ko'rsatadigan qatorlar (`fields` - `lists.ts` dagi `matchesSearch`
 * maydonlari) aynan xodimning barcha yozuvlari bo'lsa.
 */
function searchLinks<T extends SearchableRow>(
  rows: readonly T[],
  registry: string,
  fields: (row: T) => readonly (string | null | undefined)[],
): Map<string, string> {
  const keyed = rows.map((row) => ({
    staffId: row.staff?.id ?? null,
    keys: fields(row).flatMap((value) => (value == null ? [] : [nameKey(value)])),
  }));

  const staff = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    if (!row.staff) continue;
    const entry = staff.get(row.staff.id);
    if (entry) entry.count += 1;
    else staff.set(row.staff.id, { name: row.staff.name, count: 1 });
  }

  const links = new Map<string, string>();
  for (const [staffId, { name, count }] of staff) {
    const key = nameKey(name);
    if (!key) continue;
    let matched = 0;
    let exact = true;
    for (const row of keyed) {
      if (!row.keys.some((value) => value.includes(key))) continue;
      if (row.staffId !== staffId) {
        exact = false;
        break;
      }
      matched += 1;
    }
    if (exact && matched === count) links.set(staffId, `${registry}?${new URLSearchParams({ q: name })}`);
  }
  return links;
}

const TRANSFORMER_PARENTS = { select: { feederId: true, substationId: true } } as const;
const SCOPE_LEVELS: readonly Level[] = ["transformer", "feeder", "substation"];

/** Tanlangan oy uchun har bir xodim sonlarining aniq havolalari (bo'lmasa - null). */
export async function listStaffLinks(periodId: string, db: Db = prisma): Promise<Map<string, StaffLinks>> {
  const [substations, feeders, transformers, subscriberGroups, violations, appeals] = await Promise.all([
    db.substationSnapshot.findMany({ where: { periodId }, select: { staffId: true, substationId: true } }),
    db.feederSnapshot.findMany({
      where: { periodId },
      select: { staffId: true, feederId: true, feeder: { select: { substationId: true } } },
    }),
    db.transformerSnapshot.findMany({
      where: { periodId },
      select: { staffId: true, transformerId: true, transformer: TRANSFORMER_PARENTS },
    }),
    db.subscriberSnapshot.groupBy({
      by: ["staffId", "transformerId"],
      where: { periodId },
      _count: { _all: true },
    }),
    listViolations(periodId, {}, db),
    listAppeals(periodId, {}, db),
  ]);

  // Abonent guruhlaridagi TP larning fider va podstansiyasi: odatda TP holatlaridan,
  // shu oyda holati yo'q TP lar - alohida (bitta so'rov).
  const parents = new Map<string, { feederId: string; substationId: string }>(
    transformers.map((row) => [row.transformerId, row.transformer]),
  );
  const missing = [...new Set(subscriberGroups.map((group) => group.transformerId))].filter((id) => !parents.has(id));

  const subscriberTotals = new Map<string, number>();
  for (const group of subscriberGroups) {
    if (group.staffId) subscriberTotals.set(group.staffId, (subscriberTotals.get(group.staffId) ?? 0) + group._count._all);
  }
  const singles = [...subscriberTotals].filter(([, total]) => total === 1).map(([staffId]) => staffId);

  const [missingParents, singleSubscribers] = await Promise.all([
    missing.length > 0
      ? db.transformer.findMany({
          where: { id: { in: missing } },
          select: { id: true, feederId: true, substationId: true },
        })
      : [],
    singles.length > 0
      ? db.subscriberSnapshot.findMany({
          where: { periodId, staffId: { in: singles } },
          select: { staffId: true, subscriberId: true },
        })
      : [],
  ]);
  for (const row of missingParents) parents.set(row.id, row);
  const singleIds = new Map(singleSubscribers.map((row) => [row.staffId, row.subscriberId]));

  const link = {
    substations: exactLinks(
      substations.map((row) => ({ staffId: row.staffId, count: 1, id: row.substationId })),
      "/substations",
      [],
      (id) => `/substations/${id}`,
    ),
    feeders: exactLinks(
      feeders.map((row) => ({
        staffId: row.staffId,
        count: 1,
        id: row.feederId,
        substation: row.feeder.substationId,
      })),
      "/feeders",
      ["substation"],
      (id) => `/feeders/${id}`,
    ),
    transformers: exactLinks(
      transformers.map((row) => ({
        staffId: row.staffId,
        count: 1,
        id: row.transformerId,
        feeder: row.transformer.feederId,
        substation: row.transformer.substationId,
      })),
      "/transformers",
      ["feeder", "substation"],
      (id) => `/transformers/${id}`,
    ),
    subscribers: exactLinks(
      subscriberGroups.map((group) => {
        const parent = parents.get(group.transformerId);
        return {
          staffId: group.staffId,
          count: group._count._all,
          id: group.staffId && group._count._all === 1 ? singleIds.get(group.staffId) : undefined,
          transformer: group.transformerId,
          feeder: parent?.feederId,
          substation: parent?.substationId,
        };
      }),
      "/subscribers",
      SCOPE_LEVELS,
      (id) => `/subscribers/${id}`,
    ),
    violations: exactLinks(violations.rows.map(placementOf), "/violations", SCOPE_LEVELS),
    appeals: exactLinks(appeals.rows.map(placementOf), "/appeals", SCOPE_LEVELS),
  };

  // Qidiruv maydonlari `listViolations` / `listAppeals` dagi bilan bir xil.
  const violationSearch = searchLinks(violations.rows, "/violations", (row) => [
    row.subscriberName,
    row.address,
    row.transformer.name,
    row.staff?.name,
  ]);
  const appealSearch = searchLinks(appeals.rows, "/appeals", (row) => [
    row.text,
    row.subscriberName,
    row.address,
    row.transformer.name,
    row.staff?.name,
  ]);

  const staffIds = new Set<string>();
  for (const map of [...Object.values(link), violationSearch, appealSearch]) {
    for (const id of map.keys()) staffIds.add(id);
  }

  return new Map(
    [...staffIds].map((id) => [
      id,
      {
        substations: link.substations.get(id) ?? null,
        feeders: link.feeders.get(id) ?? null,
        transformers: link.transformers.get(id) ?? null,
        subscribers: link.subscribers.get(id) ?? null,
        // Qidiruv havolasi afzal: u "shu xodimning" yozuvlari degan ma'noni beradi.
        violations: violationSearch.get(id) ?? link.violations.get(id) ?? null,
        appeals: appealSearch.get(id) ?? link.appeals.get(id) ?? null,
      },
    ]),
  );
}
