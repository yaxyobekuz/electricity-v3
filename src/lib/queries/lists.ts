import "server-only";

import {
  Prisma,
  type AppealStatus,
  type MeterStatus,
  type SubscriberKind,
  type ViolatorType,
} from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import {
  APPEAL_STATUS_ORDER,
  METER_STATUS_ORDER,
  SUBSCRIBER_KIND_ORDER,
  VIOLATOR_TYPE_ORDER,
} from "@/lib/domain/labels";
import { lossPercent, toNumber } from "@/lib/domain/metrics";
import { contractKey, nameKey } from "@/lib/domain/normalize";

import {
  amount,
  iso,
  periodUploads,
  transformerScopeSql,
  transformerScopeWhere,
  zeroRecord,
  type Db,
  type EntityRef,
  type Scope,
} from "./scope";
import { join, queryRows, raw, sql, type SqlFragment } from "./sql";

/*
 * Reestr sahifalari va kartalar uchun ro'yxatlar - tanlangan oyda holati bor
 * obyektlar. Tartib: Excel fayldagi qator tartibi (`rowNumber`), sahifa
 * xohlasa o'zi saralaydi. Abonent sonlari va boshqa yig'indilar
 * `scope.ts` dagi `getScopeSummary` bilan bir xil manbadan (5-bo'lim).
 */

const STAFF_SELECT = { select: { id: true, name: true } } as const;

interface EnergyRow {
  totalKwh: Prisma.Decimal;
  usefulKwh: Prisma.Decimal;
  lossKwh: Prisma.Decimal;
}

function energyFields(row: EnergyRow) {
  const totalKwh = amount(row.totalKwh);
  const lossKwh = amount(row.lossKwh);
  return { totalKwh, usefulKwh: amount(row.usefulKwh), lossKwh, lossPercent: lossPercent(totalKwh, lossKwh) };
}

export interface SubscriberCounts {
  total: number;
  online: number;
  offline: number;
}

interface ChildAggregate {
  id: string;
  transformers: number;
  online: number;
  offline: number;
}

/** Kalit (podstansiya yoki fider id) bo'yicha shu oyning TP holatlari soni va abonentlari. */
async function transformerAggregates(
  periodId: string,
  groupColumn: "substationId" | "feederId",
  db: Db,
): Promise<Map<string, ChildAggregate>> {
  // Ustun nomi faqat shu ikki o'zgarmas qiymatdan biri - foydalanuvchi matni emas.
  const column = raw(groupColumn === "substationId" ? `t."substationId"` : `t."feederId"`);
  const rows = await queryRows<ChildAggregate>(
    db,
    sql`
    SELECT ${column} AS id,
           COUNT(*)::int AS transformers,
           COALESCE(SUM(ts."onlineSubscribers"), 0)::int AS online,
           COALESCE(SUM(ts."offlineSubscribers"), 0)::int AS offline
    FROM transformer_snapshots ts
    JOIN transformers t ON t.id = ts."transformerId"
    WHERE ts."periodId" = ${periodId}
    GROUP BY 1`,
  );
  return new Map(rows.map((row) => [row.id, row]));
}

/** Transformatorlar shu oyga yuklanmagan bo'lsa - null (0 emas). */
function subscriberCounts(aggregate: ChildAggregate | undefined, uploaded: boolean): SubscriberCounts | null {
  if (!uploaded) return null;
  const online = aggregate?.online ?? 0;
  const offline = aggregate?.offline ?? 0;
  return { total: online + offline, online, offline };
}

// ---------------------------------------------------------------------------
// Podstansiyalar
// ---------------------------------------------------------------------------

export interface SubstationRow {
  id: string;
  name: string;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  lossPercent: number | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  capacityKva: number | null;
  staff: EntityRef | null;
  /** Shu oyda holati bor fiderlar; Fiderlar shu oyga yuklanmagan bo'lsa - null. */
  feederCount: number | null;
  /** Shu oyda holati bor TP lar; Transformatorlar yuklanmagan bo'lsa - null. */
  transformerCount: number | null;
  /** Σ TP holatlari; Transformatorlar yuklanmagan bo'lsa - null. */
  subscribers: SubscriberCounts | null;
}

export async function listSubstations(periodId: string, db: Db = prisma): Promise<SubstationRow[]> {
  const [snapshots, feederCounts, transformers, uploads] = await Promise.all([
    db.substationSnapshot.findMany({
      where: { periodId },
      orderBy: { rowNumber: "asc" },
      include: { substation: { select: { name: true } }, staff: STAFF_SELECT },
    }),
    db.$queryRaw<{ id: string; feeders: number }[]>`
      SELECT f."substationId" AS id, COUNT(*)::int AS feeders
      FROM feeder_snapshots fs
      JOIN feeders f ON f.id = fs."feederId"
      WHERE fs."periodId" = ${periodId}
      GROUP BY 1`,
    transformerAggregates(periodId, "substationId", db),
    periodUploads(periodId, db),
  ]);
  const feeders = new Map(feederCounts.map((row) => [row.id, row.feeders]));
  return snapshots.map((snap) => ({
    id: snap.substationId,
    name: snap.substation.name,
    ...energyFields(snap),
    address: snap.address,
    lat: toNumber(snap.latitude),
    lng: toNumber(snap.longitude),
    capacityKva: toNumber(snap.capacityKva),
    staff: snap.staff,
    feederCount: uploads.FEEDERS ? (feeders.get(snap.substationId) ?? 0) : null,
    transformerCount: uploads.TRANSFORMERS ? (transformers.get(snap.substationId)?.transformers ?? 0) : null,
    subscribers: subscriberCounts(transformers.get(snap.substationId), uploads.TRANSFORMERS),
  }));
}

// ---------------------------------------------------------------------------
// Fiderlar
// ---------------------------------------------------------------------------

export interface FeederRow {
  id: string;
  name: string;
  substation: EntityRef;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  lossPercent: number | null;
  address: string | null;
  capacityKva: number | null;
  staff: EntityRef | null;
  /** Shu oyda holati bor TP lar; Transformatorlar yuklanmagan bo'lsa - null. */
  transformerCount: number | null;
  /** Σ TP holatlari; Transformatorlar yuklanmagan bo'lsa - null. */
  subscribers: SubscriberCounts | null;
}

export async function listFeeders(
  periodId: string,
  filters: { substationId?: string } = {},
  db: Db = prisma,
): Promise<FeederRow[]> {
  const [snapshots, transformers, uploads] = await Promise.all([
    db.feederSnapshot.findMany({
      where: { periodId, ...(filters.substationId ? { feeder: { substationId: filters.substationId } } : {}) },
      orderBy: { rowNumber: "asc" },
      include: {
        feeder: { select: { name: true, substation: { select: { id: true, name: true } } } },
        staff: STAFF_SELECT,
      },
    }),
    transformerAggregates(periodId, "feederId", db),
    periodUploads(periodId, db),
  ]);
  return snapshots.map((snap) => ({
    id: snap.feederId,
    name: snap.feeder.name,
    substation: snap.feeder.substation,
    ...energyFields(snap),
    address: snap.address,
    capacityKva: toNumber(snap.capacityKva),
    staff: snap.staff,
    transformerCount: uploads.TRANSFORMERS ? (transformers.get(snap.feederId)?.transformers ?? 0) : null,
    subscribers: subscriberCounts(transformers.get(snap.feederId), uploads.TRANSFORMERS),
  }));
}

// ---------------------------------------------------------------------------
// Transformatorlar
// ---------------------------------------------------------------------------

export interface TransformerRow {
  id: string;
  name: string;
  substation: EntityRef;
  feeder: EntityRef;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  lossPercent: number | null;
  onlineSubscribers: number;
  offlineSubscribers: number;
  address: string | null;
  lat: number | null;
  lng: number | null;
  capacityKva: number | null;
  currentRepairDate: string | null;
  overhaulDate: string | null;
  staff: EntityRef | null;
  /** Shu oydagi qoidabuzarliklar soni; Qoidabuzarliklar yuklanmagan bo'lsa - null. */
  violations: number | null;
  /** Shu oydagi murojaatlar soni; Murojaatlar yuklanmagan bo'lsa - null. */
  appeals: number | null;
}

export async function listTransformers(
  periodId: string,
  filters: { substationId?: string; feederId?: string } = {},
  db: Db = prisma,
): Promise<TransformerRow[]> {
  const scoped = {
    periodId,
    ...(filters.substationId || filters.feederId
      ? {
          transformer: {
            ...(filters.substationId ? { substationId: filters.substationId } : {}),
            ...(filters.feederId ? { feederId: filters.feederId } : {}),
          },
        }
      : {}),
  };
  const [snapshots, violations, appeals, uploads] = await Promise.all([
    db.transformerSnapshot.findMany({
      where: scoped,
      orderBy: { rowNumber: "asc" },
      include: {
        transformer: {
          select: {
            name: true,
            feeder: { select: { id: true, name: true } },
            substation: { select: { id: true, name: true } },
          },
        },
        staff: STAFF_SELECT,
      },
    }),
    db.violation.groupBy({ by: ["transformerId"], where: scoped, _count: { _all: true } }),
    db.appeal.groupBy({ by: ["transformerId"], where: scoped, _count: { _all: true } }),
    periodUploads(periodId, db),
  ]);
  const violationCounts = new Map(violations.map((group) => [group.transformerId, group._count._all]));
  const appealCounts = new Map(appeals.map((group) => [group.transformerId, group._count._all]));
  return snapshots.map((snap) => ({
    id: snap.transformerId,
    name: snap.transformer.name,
    substation: snap.transformer.substation,
    feeder: snap.transformer.feeder,
    ...energyFields(snap),
    onlineSubscribers: snap.onlineSubscribers,
    offlineSubscribers: snap.offlineSubscribers,
    address: snap.address,
    lat: toNumber(snap.latitude),
    lng: toNumber(snap.longitude),
    capacityKva: toNumber(snap.capacityKva),
    currentRepairDate: iso(snap.currentRepairDate),
    overhaulDate: iso(snap.overhaulDate),
    staff: snap.staff,
    violations: uploads.VIOLATIONS ? (violationCounts.get(snap.transformerId) ?? 0) : null,
    appeals: uploads.APPEALS ? (appealCounts.get(snap.transformerId) ?? 0) : null,
  }));
}

// ---------------------------------------------------------------------------
// Qidiruv yordamchilari
// ---------------------------------------------------------------------------

/** `normalize.ts` dagi apostrof turlari - hammasi `'` ga keltiriladi. */
const APOSTROPHE_VARIANTS = "‘’ʻʼ`´′";

/** SQL ifodasini `nameKey()` ga o'xshash ko'rinishga keltiradi. */
function normalizedSql(expression: SqlFragment): SqlFragment {
  return sql`lower(translate(regexp_replace(coalesce(${expression}, ''), ${"\\s+"}, ' ', 'g'), ${APOSTROPHE_VARIANTS}, ${"'".repeat(APOSTROPHE_VARIANTS.length)}))`;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Qidiruv matni -> `nameKey` ko'rinishi; bo'sh bo'lsa - null. */
function searchKey(q: string | null | undefined): string | null {
  const key = nameKey(q ?? "");
  return key === "" ? null : key;
}

/** Matn qidiruvi (JS da): har bir maydon `nameKey` bilan solishtiriladi. */
function matchesSearch(key: string | null, values: readonly (string | null | undefined)[]): boolean {
  if (key == null) return true;
  return values.some((value) => value != null && nameKey(value).includes(key));
}

function isOneOf<T extends string>(value: string | null | undefined, options: readonly T[]): value is T {
  return value != null && (options as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Abonentlar
// ---------------------------------------------------------------------------

export interface SubscriberListFilters {
  scope?: Scope;
  /** FISH, shartnoma raqami, hisoblagich raqami, manzil. Registr va apostrof farq qilmaydi. */
  q?: string;
  kind?: SubscriberKind;
  status?: MeterStatus;
  /** Faqat `debtUzs > 0`. */
  debtorsOnly?: boolean;
  take: number;
  skip?: number;
  /** "name" - FISH bo'yicha (standart); "debt" - qarzdorlik kamayish tartibida. */
  sort?: "name" | "debt";
}

export interface SubscriberListRow {
  id: string;
  contractNumber: string;
  fullName: string;
  kind: SubscriberKind;
  meterStatus: MeterStatus;
  transformer: EntityRef;
  feeder: EntityRef;
  substation: EntityRef;
  meterSerial: string | null;
  meterReading: number | null;
  lastReadingAt: string | null;
  debtUzs: number;
  creditUzs: number;
  address: string | null;
  staff: EntityRef | null;
}

export interface SubscriberList {
  /** Abonentlar shabloni shu oyga yuklangan (yuklanmagan oyda bo'sh ro'yxat "0 ta" emas). */
  uploaded: boolean;
  rows: SubscriberListRow[];
  /** Barcha filtrlardan keyingi son (sahifalash uchun). */
  total: number;
  /**
   * Filtr "chip"lari uchun sonlar. Har bir guruh o'z filtrini e'tiborsiz
   * qoldiradi, qolgan faol filtrlarni esa qo'llaydi - chip bosilganda
   * aynan shuncha qator chiqadi:
   *   - `all`      - faqat qamrov + qidiruv (tur, holat, qarzdorlik filtrlarisiz);
   *   - `byKind`   - qamrov + qidiruv + holat + qarzdorlik, tur bo'yicha;
   *   - `byStatus` - qamrov + qidiruv + tur + qarzdorlik, holat bo'yicha;
   *   - `debtors`  - qamrov + qidiruv + tur + holat, `debtUzs > 0`.
   */
  counts: {
    all: number;
    byKind: Record<SubscriberKind, number>;
    byStatus: Record<MeterStatus, number>;
    debtors: number;
  };
}

interface SubscriberRawRow {
  id: string;
  contractNumber: string;
  fullName: string;
  kind: SubscriberKind;
  meterStatus: MeterStatus;
  transformerId: string;
  transformerName: string;
  feederId: string;
  feederName: string;
  substationId: string;
  substationName: string;
  meterSerial: string | null;
  meterReading: number | null;
  lastReadingAt: Date | null;
  debtUzs: number;
  creditUzs: number;
  address: string | null;
  staffId: string | null;
  staffName: string | null;
}

const MAX_TAKE = 500;

export async function listSubscribers(
  periodId: string,
  filters: SubscriberListFilters,
  db: Db = prisma,
): Promise<SubscriberList> {
  const kind = isOneOf(filters.kind, SUBSCRIBER_KIND_ORDER) ? filters.kind : null;
  const status = isOneOf(filters.status, METER_STATUS_ORDER) ? filters.status : null;
  const debtorsOnly = filters.debtorsOnly === true;
  const take = Math.min(Math.max(Math.trunc(filters.take) || 0, 0), MAX_TAKE);
  const skip = Math.max(Math.trunc(filters.skip ?? 0) || 0, 0);

  // Qamrov + qidiruv - barcha sonlar uchun umumiy asos.
  const base: SqlFragment[] = [sql`s."periodId" = ${periodId}`, transformerScopeSql(filters.scope)];
  const key = searchKey(filters.q);
  if (key != null) {
    const pattern = `%${escapeLike(key)}%`;
    const contract = contractKey(filters.q ?? "");
    base.push(sql`(
      ${normalizedSql(sql`s."fullName"`)} ILIKE ${pattern}
      OR ${normalizedSql(sql`sub."contractNumber"`)} ILIKE ${pattern}
      OR ${contract !== "" ? sql`sub."contractKey" LIKE ${`%${escapeLike(contract)}%`}` : sql`FALSE`}
      OR ${normalizedSql(sql`s."meterSerial"`)} ILIKE ${pattern}
      OR ${normalizedSql(sql`s."address"`)} ILIKE ${pattern}
    )`);
  }

  const filtered = [...base];
  if (kind) filtered.push(sql`s."kind"::text = ${kind}`);
  if (status) filtered.push(sql`s."meterStatus"::text = ${status}`);
  if (debtorsOnly) filtered.push(sql`s."debtUzs" > 0`);

  const from = sql`
    FROM subscriber_snapshots s
    JOIN subscribers sub ON sub.id = s."subscriberId"
    JOIN transformers t ON t.id = s."transformerId"`;

  const orderBy =
    filters.sort === "debt"
      ? sql`s."debtUzs" DESC, s."fullName" ASC, s.id ASC`
      : sql`s."fullName" ASC, s.id ASC`;

  const [uploads, groups, rows] = await Promise.all([
    periodUploads(periodId, db),
    // Tur x holat x qarzdor bo'yicha eng ko'pi 12 guruh - barcha sonlar shundan.
    queryRows<{ kind: SubscriberKind; meterStatus: MeterStatus; debtor: boolean; n: number }>(
      db,
      sql`
      SELECT s."kind"::text AS kind, s."meterStatus"::text AS "meterStatus",
             (s."debtUzs" > 0) AS debtor, COUNT(*)::int AS n
      ${from}
      WHERE ${join(base, " AND ")}
      GROUP BY 1, 2, 3`,
    ),
    take === 0
      ? Promise.resolve([] as SubscriberRawRow[])
      : queryRows<SubscriberRawRow>(
          db,
          sql`
      SELECT s."subscriberId" AS id, sub."contractNumber", s."fullName",
             s."kind"::text AS kind, s."meterStatus"::text AS "meterStatus",
             t.id AS "transformerId", t.name AS "transformerName",
             f.id AS "feederId", f.name AS "feederName",
             ss.id AS "substationId", ss.name AS "substationName",
             s."meterSerial", s."meterReading"::float8 AS "meterReading", s."lastReadingAt",
             s."debtUzs"::float8 AS "debtUzs", s."creditUzs"::float8 AS "creditUzs",
             s."address", st.id AS "staffId", st.name AS "staffName"
      ${from}
      JOIN feeders f ON f.id = t."feederId"
      JOIN substations ss ON ss.id = t."substationId"
      LEFT JOIN staff st ON st.id = s."staffId"
      WHERE ${join(filtered, " AND ")}
      ORDER BY ${orderBy}
      LIMIT ${take} OFFSET ${skip}`,
        ),
  ]);

  const counts: SubscriberList["counts"] = {
    all: 0,
    byKind: zeroRecord(SUBSCRIBER_KIND_ORDER),
    byStatus: zeroRecord(METER_STATUS_ORDER),
    debtors: 0,
  };
  let total = 0;
  for (const group of groups) {
    const kindOk = !kind || group.kind === kind;
    const statusOk = !status || group.meterStatus === status;
    const debtOk = !debtorsOnly || group.debtor;
    counts.all += group.n;
    if (statusOk && debtOk) counts.byKind[group.kind] += group.n;
    if (kindOk && debtOk) counts.byStatus[group.meterStatus] += group.n;
    if (kindOk && statusOk && group.debtor) counts.debtors += group.n;
    if (kindOk && statusOk && debtOk) total += group.n;
  }

  return {
    uploaded: uploads.SUBSCRIBERS,
    rows: rows.map((row) => ({
      id: row.id,
      contractNumber: row.contractNumber,
      fullName: row.fullName,
      kind: row.kind,
      meterStatus: row.meterStatus,
      transformer: { id: row.transformerId, name: row.transformerName },
      feeder: { id: row.feederId, name: row.feederName },
      substation: { id: row.substationId, name: row.substationName },
      meterSerial: row.meterSerial,
      meterReading: row.meterReading,
      lastReadingAt: iso(row.lastReadingAt),
      debtUzs: row.debtUzs,
      creditUzs: row.creditUzs,
      address: row.address,
      staff: row.staffId != null ? { id: row.staffId, name: row.staffName ?? "" } : null,
    })),
    total,
    counts,
  };
}

// ---------------------------------------------------------------------------
// Qoidabuzarliklar va murojaatlar
// ---------------------------------------------------------------------------

/** TP va uning ota obyektlari. */
const TRANSFORMER_PATH = {
  select: {
    id: true,
    name: true,
    feeder: { select: { id: true, name: true } },
    substation: { select: { id: true, name: true } },
  },
} as const;

export interface ViolationRow {
  id: string;
  /** "Sana", ISO. */
  date: string;
  subscriberName: string;
  /** Abonent bir ma'noli topilgan bo'lsa. */
  subscriber: { id: string } | null;
  violatorType: ViolatorType;
  address: string | null;
  damageUzs: number;
  damageKwh: number;
  staff: EntityRef | null;
  transformer: EntityRef;
  feeder: EntityRef;
  substation: EntityRef;
  rowNumber: number;
}

export interface ViolationList {
  /** Qoidabuzarliklar shabloni shu oyga yuklangan. */
  uploaded: boolean;
  rows: ViolationRow[];
  /**
   * `total`, `damageUzs`, `damageKwh` - barcha filtrlardan keyin (`rows` bilan
   * bir xil). `byType` - qamrov + qidiruv, tur filtrisiz (chip sonlari).
   */
  totals: {
    total: number;
    byType: Record<ViolatorType, number>;
    damageUzs: number;
    damageKwh: number;
  };
}

export async function listViolations(
  periodId: string,
  filters: { scope?: Scope; q?: string; type?: ViolatorType } = {},
  db: Db = prisma,
): Promise<ViolationList> {
  const type = isOneOf(filters.type, VIOLATOR_TYPE_ORDER) ? filters.type : null;
  const key = searchKey(filters.q);
  const [uploads, records] = await Promise.all([
    periodUploads(periodId, db),
    db.violation.findMany({
      where: { periodId, ...transformerScopeWhere(filters.scope) },
      orderBy: [{ date: "desc" }, { rowNumber: "asc" }],
      include: { transformer: TRANSFORMER_PATH, staff: STAFF_SELECT },
    }),
  ]);

  const totals: ViolationList["totals"] = {
    total: 0,
    byType: zeroRecord(VIOLATOR_TYPE_ORDER),
    damageUzs: 0,
    damageKwh: 0,
  };
  const rows: ViolationRow[] = [];
  for (const record of records) {
    if (!matchesSearch(key, [record.subscriberName, record.address, record.transformer.name, record.staff?.name])) {
      continue;
    }
    totals.byType[record.violatorType] += 1;
    if (type && record.violatorType !== type) continue;
    const row: ViolationRow = {
      id: record.id,
      date: record.date.toISOString(),
      subscriberName: record.subscriberName,
      subscriber: record.subscriberId ? { id: record.subscriberId } : null,
      violatorType: record.violatorType,
      address: record.address,
      damageUzs: amount(record.damageUzs),
      damageKwh: amount(record.damageKwh),
      staff: record.staff,
      transformer: { id: record.transformer.id, name: record.transformer.name },
      feeder: record.transformer.feeder,
      substation: record.transformer.substation,
      rowNumber: record.rowNumber,
    };
    totals.total += 1;
    totals.damageUzs += row.damageUzs;
    totals.damageKwh += row.damageKwh;
    rows.push(row);
  }
  return { uploaded: uploads.VIOLATIONS, rows, totals };
}

export interface AppealRow {
  id: string;
  /** "Sana", ISO. */
  date: string;
  text: string;
  subscriberName: string;
  subscriber: { id: string } | null;
  status: AppealStatus;
  address: string | null;
  staff: EntityRef | null;
  transformer: EntityRef;
  feeder: EntityRef;
  substation: EntityRef;
  rowNumber: number;
}

export interface AppealList {
  /** Murojaatlar shabloni shu oyga yuklangan. */
  uploaded: boolean;
  rows: AppealRow[];
  /** `total` - barcha filtrlardan keyin; `byStatus` - qamrov + qidiruv, holat filtrisiz. */
  totals: {
    total: number;
    byStatus: Record<AppealStatus, number>;
  };
}

export async function listAppeals(
  periodId: string,
  filters: { scope?: Scope; q?: string; status?: AppealStatus } = {},
  db: Db = prisma,
): Promise<AppealList> {
  const status = isOneOf(filters.status, APPEAL_STATUS_ORDER) ? filters.status : null;
  const key = searchKey(filters.q);
  const [uploads, records] = await Promise.all([
    periodUploads(periodId, db),
    db.appeal.findMany({
      where: { periodId, ...transformerScopeWhere(filters.scope) },
      orderBy: [{ date: "desc" }, { rowNumber: "asc" }],
      include: { transformer: TRANSFORMER_PATH, staff: STAFF_SELECT },
    }),
  ]);

  const totals: AppealList["totals"] = { total: 0, byStatus: zeroRecord(APPEAL_STATUS_ORDER) };
  const rows: AppealRow[] = [];
  for (const record of records) {
    if (
      !matchesSearch(key, [
        record.text,
        record.subscriberName,
        record.address,
        record.transformer.name,
        record.staff?.name,
      ])
    ) {
      continue;
    }
    totals.byStatus[record.status] += 1;
    if (status && record.status !== status) continue;
    totals.total += 1;
    rows.push({
      id: record.id,
      date: record.date.toISOString(),
      text: record.text,
      subscriberName: record.subscriberName,
      subscriber: record.subscriberId ? { id: record.subscriberId } : null,
      status: record.status,
      address: record.address,
      staff: record.staff,
      transformer: { id: record.transformer.id, name: record.transformer.name },
      feeder: record.transformer.feeder,
      substation: record.transformer.substation,
      rowNumber: record.rowNumber,
    });
  }
  return { uploaded: uploads.APPEALS, rows, totals };
}
