import "server-only";

import { cache } from "react";

import {
  Prisma,
  type AppealStatus,
  type MeterStatus,
  type SubscriberKind,
  type TemplateType,
  type ViolatorType,
} from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import {
  APPEAL_STATUS_ORDER,
  METER_STATUS_ORDER,
  SUBSCRIBER_KIND_ORDER,
  TEMPLATE_ORDER,
  VIOLATOR_TYPE_ORDER,
} from "@/lib/domain/labels";
import { lossPercent, toNumber } from "@/lib/domain/metrics";
import { monthKey, monthLabel, monthShort } from "@/lib/format";
import type { PeriodInfo } from "@/lib/period";

import { sql, type SqlFragment } from "./sql";

/*
 * Qamrov (tuman / podstansiya / fider / TP) bo'yicha yig'ma ko'rsatkichlar.
 * Har bir son uchun manba YAGONA: `.claude/docs/malumotlar.md` 5-bo'lim.
 * Sahifalar va boshqa so'rov modullari (`entities`, `lists`, `staff`,
 * `repairs`) umumiy yordamchilarni ham shu fayldan oladi.
 *
 * Barcha funksiyalar oddiy (serializable) obyekt qaytaradi: Decimal -> son,
 * sana -> ISO matn. Oxirgi `db` parametri - test tranzaksiyasi uchun.
 */

// ---------------------------------------------------------------------------
// Umumiy yordamchilar
// ---------------------------------------------------------------------------

/** Prisma klienti yoki tranzaksiya klienti. */
export type Db = Prisma.TransactionClient;

export type Scope =
  | { kind: "district" }
  | { kind: "substation"; id: string }
  | { kind: "feeder"; id: string }
  | { kind: "transformer"; id: string };

export const DISTRICT: Scope = { kind: "district" };

/** Obyektga havola (breadcrumb, jadval katagi). */
export interface EntityRef {
  id: string;
  name: string;
}

/** Decimal / null -> son; null bo'lsa 0 (majburiy ustunlar va yig'indilar uchun). */
export function amount(value: Prisma.Decimal | number | null | undefined): number {
  return toNumber(value) ?? 0;
}

/** Sana -> ISO matn yoki null. */
export function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/** Enum ro'yxatidan nol qiymatli yozuv: `{ LEGAL: 0, HOUSEHOLD: 0 }`. */
export function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

/** `PeriodInfo` - `src/lib/period.ts` dagi `toInfo` bilan bir xil (testda solishtiriladi). */
export function toPeriodInfo(row: { id: string; month: Date; reportDate: Date }): PeriodInfo {
  return {
    id: row.id,
    key: monthKey(row.month),
    month: row.month.toISOString(),
    reportDate: row.reportDate.toISOString(),
    label: monthLabel(row.month),
  };
}

/**
 * TP ga bog'langan jadvallar (TP holati, abonent, qoidabuzarlik, murojaat)
 * uchun qamrov filtri - Prisma `where` qismi.
 */
export function transformerScopeWhere(scope: Scope | undefined): {
  transformerId?: string;
  transformer?: { substationId?: string; feederId?: string };
} {
  switch (scope?.kind) {
    case "substation":
      return { transformer: { substationId: scope.id } };
    case "feeder":
      return { transformer: { feederId: scope.id } };
    case "transformer":
      return { transformerId: scope.id };
    default:
      return {};
  }
}

/**
 * Xuddi shu filtr xom SQL uchun. So'rovda `transformers` jadvali `t`
 * nomi bilan ulangan bo'lishi shart.
 */
export function transformerScopeSql(scope: Scope | undefined): SqlFragment {
  switch (scope?.kind) {
    case "substation":
      return sql`t."substationId" = ${scope.id}`;
    case "feeder":
      return sql`t."feederId" = ${scope.id}`;
    case "transformer":
      return sql`t."id" = ${scope.id}`;
    default:
      return sql`TRUE`;
  }
}

/*
 * "Yuklangan" va "o'tgan oy" qoidalari `src/lib/period.ts` dagi
 * `getPeriodUploads` / `getPreviousPeriod` bilan bir xil, lekin `db`
 * parametrini oladi - sahifalar va test tranzaksiyasi AYNAN shu kodni
 * ishlatadi. `period.ts` bilan mosligi `scripts/check-queries.ts` da haqiqiy
 * baza davrlarida tekshiriladi.
 */

/** Bir nechta davr uchun yuklangan shablonlar - bitta so'rov. */
export async function uploadsMany(
  periodIds: readonly string[],
  db: Db = prisma,
): Promise<Map<string, Record<TemplateType, boolean>>> {
  const rows =
    periodIds.length === 0
      ? []
      : await db.importBatch.findMany({
          where: { periodId: { in: [...periodIds] }, status: "COMPLETED" },
          distinct: ["periodId", "templateType"],
          select: { periodId: true, templateType: true },
        });
  return new Map(
    periodIds.map((periodId) => {
      const types = new Set(rows.filter((row) => row.periodId === periodId).map((row) => row.templateType));
      return [
        periodId,
        Object.fromEntries(TEMPLATE_ORDER.map((type) => [type, types.has(type)])) as Record<TemplateType, boolean>,
      ];
    }),
  );
}

const cachedUploads = cache(
  async (periodId: string, db: Db): Promise<Record<TemplateType, boolean>> =>
    (await uploadsMany([periodId], db)).get(periodId)!,
);

/** Shu oyga qaysi shablonlar muvaffaqiyatli (COMPLETED) yuklangan. */
export function periodUploads(periodId: string, db: Db = prisma): Promise<Record<TemplateType, boolean>> {
  return cachedUploads(periodId, db);
}

/** Bir oy oldingi davr (`month - 1`); bazada bo'lmasa - null. */
export async function previousPeriodOf(period: PeriodInfo, db: Db = prisma): Promise<PeriodInfo | null> {
  const month = new Date(period.month);
  const previous = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
  const row = await db.period.findUnique({
    where: { month: previous },
    select: { id: true, month: true, reportDate: true },
  });
  return row ? toPeriodInfo(row) : null;
}

// ---------------------------------------------------------------------------
// Qamrov xulosasi
// ---------------------------------------------------------------------------

export interface EnergySummary {
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  /** Σ yo'qotish / Σ umumiy oqim; umumiy oqim ≤ 0 bo'lsa - null. */
  lossPercent: number | null;
}

export interface ScopeSummary {
  /**
   * Shu oyga qaysi shablonlar yuklangan. Oyga 1..6 ta fayl yuklanishi mumkin:
   * yuklanmagan shablonning soni "0" emas, "ma'lumot yo'q".
   */
  uploads: Record<TemplateType, boolean>;
  /** Tuman - Σ podstansiya holatlari; qolganlari - obyektning o'z holati. Holat yo'q - null. */
  energy: EnergySummary | null;
  /**
   * Shu oyda holati bor obyektlar soni. Qamrov obyektining o'zi va uning
   * ota obyektlari ham sanaladi (fider qamrovida: podstansiya 0/1, fider 0/1,
   * TP - shu fiderdagilar). Tegishli shablon (Podstansiyalar / Fiderlar /
   * Transformatorlar) shu oyga yuklanmagan bo'lsa - null.
   */
  counts: { substations: number | null; feeders: number | null; transformers: number | null };
  /**
   * Abonentlar soni: Transformatorlar shu oyga yuklangan bo'lsa - Σ TP
   * holatlaridagi "Aloqadagi" / "Aloqadan chiqqan" (4.5 qoida ular abonentlar
   * ro'yxatiga tengligini kafolatlaydi); yuklanmagan, lekin Abonentlar
   * yuklangan bo'lsa - abonentlar ro'yxatidan (aloqada = "Aloqada", qolganlari -
   * aloqadan chiqqan). Ikkalasi ham yo'q - null.
   */
  subscribers: { total: number; online: number; offline: number } | null;
  /** Abonentlar ro'yxatidan (`SubscriberSnapshot`). */
  subscriberList: {
    uploaded: boolean;
    total: number;
    byKind: Record<SubscriberKind, number>;
    byStatus: Record<MeterStatus, number>;
    debtUzs: number;
    creditUzs: number;
    /** `debtUzs > 0` bo'lgan abonentlar soni. */
    debtors: number;
    debtByKind: Record<SubscriberKind, number>;
  };
  violations: {
    uploaded: boolean;
    total: number;
    byType: Record<ViolatorType, number>;
    damageUzs: number;
    damageKwh: number;
    damageUzsByType: Record<ViolatorType, number>;
  };
  appeals: {
    uploaded: boolean;
    total: number;
    byStatus: Record<AppealStatus, number>;
  };
}

interface ScopeParents {
  substationId: string | null;
  feederId: string | null;
  transformerId: string | null;
}

/** Qamrov obyektining ota obyektlari. Obyekt topilmasa - null. */
async function resolveScope(scope: Scope, db: Db): Promise<ScopeParents | null> {
  switch (scope.kind) {
    case "district":
      return { substationId: null, feederId: null, transformerId: null };
    case "substation": {
      const row = await db.substation.findUnique({ where: { id: scope.id }, select: { id: true } });
      return row ? { substationId: row.id, feederId: null, transformerId: null } : null;
    }
    case "feeder": {
      const row = await db.feeder.findUnique({
        where: { id: scope.id },
        select: { id: true, substationId: true },
      });
      return row ? { substationId: row.substationId, feederId: row.id, transformerId: null } : null;
    }
    case "transformer": {
      const row = await db.transformer.findUnique({
        where: { id: scope.id },
        select: { id: true, substationId: true, feederId: true },
      });
      return row ? { substationId: row.substationId, feederId: row.feederId, transformerId: row.id } : null;
    }
  }
}

function energyOf(
  row: { totalKwh: Prisma.Decimal | null; usefulKwh: Prisma.Decimal | null; lossKwh: Prisma.Decimal | null } | null,
): EnergySummary | null {
  if (!row) return null;
  const totalKwh = amount(row.totalKwh);
  const lossKwh = amount(row.lossKwh);
  return { totalKwh, usefulKwh: amount(row.usefulKwh), lossKwh, lossPercent: lossPercent(totalKwh, lossKwh) };
}

const ENERGY_SELECT = { totalKwh: true, usefulKwh: true, lossKwh: true } as const;

async function scopeEnergy(periodId: string, scope: Scope, db: Db): Promise<EnergySummary | null> {
  switch (scope.kind) {
    case "district": {
      const result = await db.substationSnapshot.aggregate({
        where: { periodId },
        _count: { _all: true },
        _sum: ENERGY_SELECT,
      });
      return result._count._all > 0 ? energyOf(result._sum) : null;
    }
    case "substation":
      return energyOf(
        await db.substationSnapshot.findUnique({
          where: { periodId_substationId: { periodId, substationId: scope.id } },
          select: ENERGY_SELECT,
        }),
      );
    case "feeder":
      return energyOf(
        await db.feederSnapshot.findUnique({
          where: { periodId_feederId: { periodId, feederId: scope.id } },
          select: ENERGY_SELECT,
        }),
      );
    case "transformer":
      return energyOf(
        await db.transformerSnapshot.findUnique({
          where: { periodId_transformerId: { periodId, transformerId: scope.id } },
          select: ENERGY_SELECT,
        }),
      );
  }
}

async function scopeCounts(
  periodId: string,
  scope: Scope,
  parents: ScopeParents | null,
  uploads: Record<TemplateType, boolean>,
  db: Db,
): Promise<ScopeSummary["counts"]> {
  // Yuklanmagan shablon - null (0 emas).
  const whenUploaded = (type: TemplateType, count: () => Promise<number>) =>
    uploads[type] ? (parents ? count() : Promise.resolve(0)) : Promise.resolve(null);
  const [substations, feeders, transformers] = await Promise.all([
    whenUploaded("SUBSTATIONS", () =>
      db.substationSnapshot.count({
        where: { periodId, ...(parents?.substationId ? { substationId: parents.substationId } : {}) },
      }),
    ),
    whenUploaded("FEEDERS", () =>
      db.feederSnapshot.count({
        where: {
          periodId,
          ...(parents?.feederId
            ? { feederId: parents.feederId }
            : parents?.substationId
              ? { feeder: { substationId: parents.substationId } }
              : {}),
        },
      }),
    ),
    whenUploaded("TRANSFORMERS", () =>
      db.transformerSnapshot.count({ where: { periodId, ...transformerScopeWhere(scope) } }),
    ),
  ]);
  return { substations, feeders, transformers };
}

async function computeScopeSummary(periodId: string, scope: Scope, db: Db): Promise<ScopeSummary> {
  const scoped = { periodId, ...transformerScopeWhere(scope) };
  const [parents, energy, uploads, onlineOffline, subscriberGroups, debtors, violationGroups, appealGroups] =
    await Promise.all([
      resolveScope(scope, db),
      scopeEnergy(periodId, scope, db),
      periodUploads(periodId, db),
      db.transformerSnapshot.aggregate({
        where: scoped,
        _sum: { onlineSubscribers: true, offlineSubscribers: true },
      }),
      db.subscriberSnapshot.groupBy({
        by: ["kind", "meterStatus"],
        where: scoped,
        _count: { _all: true },
        _sum: { debtUzs: true, creditUzs: true },
      }),
      db.subscriberSnapshot.count({ where: { ...scoped, debtUzs: { gt: 0 } } }),
      db.violation.groupBy({
        by: ["violatorType"],
        where: scoped,
        _count: { _all: true },
        _sum: { damageUzs: true, damageKwh: true },
      }),
      db.appeal.groupBy({
        by: ["status"],
        where: scoped,
        _count: { _all: true },
      }),
    ]);
  const counts = await scopeCounts(periodId, scope, parents, uploads, db);

  const online = onlineOffline._sum.onlineSubscribers ?? 0;
  const offline = onlineOffline._sum.offlineSubscribers ?? 0;

  const subscriberList: ScopeSummary["subscriberList"] = {
    uploaded: uploads.SUBSCRIBERS,
    total: 0,
    byKind: zeroRecord(SUBSCRIBER_KIND_ORDER),
    byStatus: zeroRecord(METER_STATUS_ORDER),
    debtUzs: 0,
    creditUzs: 0,
    debtors,
    debtByKind: zeroRecord(SUBSCRIBER_KIND_ORDER),
  };
  for (const group of subscriberGroups) {
    const debt = amount(group._sum.debtUzs);
    subscriberList.total += group._count._all;
    subscriberList.byKind[group.kind] += group._count._all;
    subscriberList.byStatus[group.meterStatus] += group._count._all;
    subscriberList.debtUzs += debt;
    subscriberList.creditUzs += amount(group._sum.creditUzs);
    subscriberList.debtByKind[group.kind] += debt;
  }

  const violations: ScopeSummary["violations"] = {
    uploaded: uploads.VIOLATIONS,
    total: 0,
    byType: zeroRecord(VIOLATOR_TYPE_ORDER),
    damageUzs: 0,
    damageKwh: 0,
    damageUzsByType: zeroRecord(VIOLATOR_TYPE_ORDER),
  };
  for (const group of violationGroups) {
    const damage = amount(group._sum.damageUzs);
    violations.total += group._count._all;
    violations.byType[group.violatorType] += group._count._all;
    violations.damageUzs += damage;
    violations.damageKwh += amount(group._sum.damageKwh);
    violations.damageUzsByType[group.violatorType] += damage;
  }

  const appeals: ScopeSummary["appeals"] = {
    uploaded: uploads.APPEALS,
    total: 0,
    byStatus: zeroRecord(APPEAL_STATUS_ORDER),
  };
  for (const group of appealGroups) {
    appeals.total += group._count._all;
    appeals.byStatus[group.status] += group._count._all;
  }

  const listOnline = subscriberList.byStatus.ONLINE;
  const subscribers = uploads.TRANSFORMERS
    ? { total: online + offline, online, offline }
    : uploads.SUBSCRIBERS
      ? { total: subscriberList.total, online: listOnline, offline: subscriberList.total - listOnline }
      : null;

  return {
    uploads,
    energy,
    counts,
    subscribers,
    subscriberList,
    violations,
    appeals,
  };
}

// Scope obyekt - `cache` havola bo'yicha solishtiradi, shuning uchun kalit
// oddiy qiymatlarga ajratiladi.
const cachedScopeSummary = cache(
  (periodId: string, kind: Scope["kind"], id: string | null, db: Db): Promise<ScopeSummary> =>
    computeScopeSummary(periodId, (id == null ? { kind: "district" } : { kind, id }) as Scope, db),
);

/** Tanlangan oyda qamrov bo'yicha barcha yig'ma ko'rsatkichlar. */
export function getScopeSummary(periodId: string, scope: Scope, db: Db = prisma): Promise<ScopeSummary> {
  return cachedScopeSummary(periodId, scope.kind, scope.kind === "district" ? null : scope.id, db);
}

// ---------------------------------------------------------------------------
// Dinamika (bir necha oy)
// ---------------------------------------------------------------------------

export interface ScopeSeriesPoint {
  periodId: string;
  /** "2026-09" */
  key: string;
  /** "Sen" */
  label: string;
  /** "Sentabr 2026" */
  fullLabel: string;
  /** Qamrov obyektining shu oyda energiya holati bor (`ScopeSummary.energy !== null`). */
  hasData: boolean;
  totalKwh: number | null;
  usefulKwh: number | null;
  lossKwh: number | null;
  lossPercent: number | null;
  /**
   * Abonentlar soni - `ScopeSummary.subscribers.total` bilan bir xil qoida:
   * Transformatorlar yuklangan bo'lsa Σ TP holatlari, aks holda abonentlar
   * ro'yxati; ikkalasi ham yo'q - null.
   */
  subscribers: number | null;
  /** Abonentlar ro'yxati shu oyga yuklanmagan bo'lsa - null. */
  debtUzs: number | null;
  /** Qoidabuzarliklar shu oyga yuklanmagan bo'lsa - null. */
  violations: number | null;
  damageUzs: number | null;
  /** Murojaatlar shu oyga yuklanmagan bo'lsa - null. */
  appeals: number | null;
}

type EnergyRow = {
  periodId: string;
  totalKwh: Prisma.Decimal | null;
  usefulKwh: Prisma.Decimal | null;
  lossKwh: Prisma.Decimal | null;
};

async function seriesEnergy(periodIds: string[], scope: Scope, db: Db): Promise<Map<string, EnergySummary>> {
  const inPeriods = { in: periodIds };
  let rows: EnergyRow[];
  switch (scope.kind) {
    case "district": {
      const groups = await db.substationSnapshot.groupBy({
        by: ["periodId"],
        where: { periodId: inPeriods },
        _sum: ENERGY_SELECT,
      });
      rows = groups.map((group) => ({ periodId: group.periodId, ...group._sum }));
      break;
    }
    case "substation":
      rows = await db.substationSnapshot.findMany({
        where: { periodId: inPeriods, substationId: scope.id },
        select: { periodId: true, ...ENERGY_SELECT },
      });
      break;
    case "feeder":
      rows = await db.feederSnapshot.findMany({
        where: { periodId: inPeriods, feederId: scope.id },
        select: { periodId: true, ...ENERGY_SELECT },
      });
      break;
    case "transformer":
      rows = await db.transformerSnapshot.findMany({
        where: { periodId: inPeriods, transformerId: scope.id },
        select: { periodId: true, ...ENERGY_SELECT },
      });
      break;
  }
  return new Map(rows.map((row) => [row.periodId, energyOf(row)!]));
}

/**
 * Berilgan davrlar (eskidan yangiga) bo'yicha qamrov dinamikasi - har davr
 * uchun bitta nuqta. Qiymatlar `getScopeSummary` bilan bir xil manbadan.
 */
export async function getScopeSeries(
  scope: Scope,
  periods: readonly PeriodInfo[],
  db: Db = prisma,
): Promise<ScopeSeriesPoint[]> {
  if (periods.length === 0) return [];
  const periodIds = periods.map((period) => period.id);
  const scoped = { periodId: { in: periodIds }, ...transformerScopeWhere(scope) };

  const [energy, uploads, subscriberGroups, debtGroups, violationGroups, appealGroups] = await Promise.all([
    seriesEnergy(periodIds, scope, db),
    uploadsMany(periodIds, db),
    db.transformerSnapshot.groupBy({
      by: ["periodId"],
      where: scoped,
      _sum: { onlineSubscribers: true, offlineSubscribers: true },
    }),
    db.subscriberSnapshot.groupBy({
      by: ["periodId"],
      where: scoped,
      _count: { _all: true },
      _sum: { debtUzs: true },
    }),
    db.violation.groupBy({
      by: ["periodId"],
      where: scoped,
      _count: { _all: true },
      _sum: { damageUzs: true },
    }),
    db.appeal.groupBy({
      by: ["periodId"],
      where: scoped,
      _count: { _all: true },
    }),
  ]);

  return periods.map((period) => {
    const point = energy.get(period.id) ?? null;
    const uploaded = uploads.get(period.id)!;
    const subscribers = subscriberGroups.find((group) => group.periodId === period.id);
    const debt = debtGroups.find((group) => group.periodId === period.id);
    const violation = violationGroups.find((group) => group.periodId === period.id);
    const appeal = appealGroups.find((group) => group.periodId === period.id);
    return {
      periodId: period.id,
      key: period.key,
      label: monthShort(period.month),
      fullLabel: monthLabel(period.month),
      hasData: point !== null,
      totalKwh: point?.totalKwh ?? null,
      usefulKwh: point?.usefulKwh ?? null,
      lossKwh: point?.lossKwh ?? null,
      lossPercent: point?.lossPercent ?? null,
      subscribers: uploaded.TRANSFORMERS
        ? (subscribers?._sum.onlineSubscribers ?? 0) + (subscribers?._sum.offlineSubscribers ?? 0)
        : uploaded.SUBSCRIBERS
          ? (debt?._count._all ?? 0)
          : null,
      debtUzs: uploaded.SUBSCRIBERS ? amount(debt?._sum.debtUzs) : null,
      violations: uploaded.VIOLATIONS ? (violation?._count._all ?? 0) : null,
      damageUzs: uploaded.VIOLATIONS ? amount(violation?._sum.damageUzs) : null,
      appeals: uploaded.APPEALS ? (appeal?._count._all ?? 0) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// O'tgan oy bilan taqqoslash
// ---------------------------------------------------------------------------

export interface ScopeComparison {
  current: ScopeSummary;
  /** `month - 1` davri bazada bo'lmasa - null (farq ko'rsatilmaydi). */
  previous: ScopeSummary | null;
  previousPeriod: PeriodInfo | null;
}

export async function getScopeComparison(
  scope: Scope,
  period: PeriodInfo,
  db: Db = prisma,
): Promise<ScopeComparison> {
  const [current, previousPeriod] = await Promise.all([
    getScopeSummary(period.id, scope, db),
    previousPeriodOf(period, db),
  ]);
  const previous = previousPeriod ? await getScopeSummary(previousPeriod.id, scope, db) : null;
  return { current, previous, previousPeriod };
}
