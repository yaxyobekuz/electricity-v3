import "server-only";

import { prisma } from "@/lib/db/prisma";
import { nameKey } from "@/lib/domain/normalize";

import { listAppeals, listSubscribers, listViolations, type AppealRow, type SubscriberListRow, type ViolationRow } from "./lists";
import { DISTRICT, getScopeSummary, periodUploads, type Db, type EntityRef } from "./scope";
import { join, queryRows, sql, type SqlFragment } from "./sql";
import { listStaffActivity, type StaffActivityRow } from "./staff";

/*
 * Umumiy qidiruv (`/search`) - tanlangan oy ma'lumotlari bo'yicha.
 *
 * Qidiruv qoidasi reyestrlar bilan bir xil: so'rov `nameKey()` ko'rinishiga
 * keltiriladi (registr, apostrof turi va ortiqcha bo'shliq farq qilmaydi) va
 * reyestrdagi qidiruv maydonlaridan birida BUTUN matn sifatida uchrashi
 * kerak. Abonentlar, qoidabuzarliklar, murojaatlar va xodimlar reyestr
 * funksiyalarining o'zi orqali, fider va TP lar esa reyestr sahifasi
 * qidiradigan maydonlar bo'yicha qidiriladi - "Barchasini ko'rish" havolasi
 * (`/transformers?q=...`) aynan shu sonni ko'rsatadi.
 *
 * Shaxsiy maydonlar (passport, PINFL) hech qachon qidirilmaydi.
 */

export const SEARCH_KINDS = [
  "substation",
  "feeder",
  "transformer",
  "subscriber",
  "violation",
  "appeal",
  "staff",
] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number];

/** Har bir tur bo'yicha qaytariladigan natijalar soni. */
export const SEARCH_HIT_LIMIT = 20;

export interface SearchGroup<T> {
  /**
   * So'rovga mos yozuvlarning aniq soni. Tegishli shablon shu oyga
   * yuklanmagan bo'lsa - null ("0 ta" emas).
   */
  total: number | null;
  /** Birinchi `SEARCH_HIT_LIMIT` tasi. */
  rows: T[];
}

export interface SubstationHit {
  id: string;
  name: string;
  address: string | null;
  /** Ma'sul xodim F.I.Sh. (qidiruv maydoni). */
  staffName: string | null;
  usefulKwh: number;
}

export interface FeederHit {
  id: string;
  name: string;
  substation: EntityRef;
  address: string | null;
  staffName: string | null;
  usefulKwh: number;
}

export interface TransformerHit {
  id: string;
  name: string;
  substation: EntityRef;
  feeder: EntityRef;
  address: string | null;
  staffName: string | null;
  usefulKwh: number;
}

export interface SearchResults {
  substation: SearchGroup<SubstationHit>;
  feeder: SearchGroup<FeederHit>;
  transformer: SearchGroup<TransformerHit>;
  subscriber: SearchGroup<SubscriberListRow>;
  violation: SearchGroup<ViolationRow>;
  appeal: SearchGroup<AppealRow>;
  staff: SearchGroup<StaffActivityRow>;
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** `normalize.ts` dagi apostrof turlari - hammasi `'` ga keltiriladi. */
const APOSTROPHE_VARIANTS = "‘’ʻʼ`´′";

/**
 * SQL ifodasini `nameKey()` ko'rinishiga keltiradi - `lists.ts` dagi abonent
 * qidiruvi bilan bir xil ifoda (bo'shliqlar bittaga, apostroflar `'`, kichik harf).
 */
function normalizedSql(expression: SqlFragment): SqlFragment {
  return sql`lower(translate(regexp_replace(coalesce(${expression}, ''), ${"\\s+"}, ' ', 'g'), ${APOSTROPHE_VARIANTS}, ${"'".repeat(APOSTROPHE_VARIANTS.length)}))`;
}

/** Naqshlar: ichida uchraydi / shu bilan boshlanadi. */
function patterns(key: string) {
  const escaped = escapeLike(key);
  return { contains: `%${escaped}%`, prefix: `${escaped}%` };
}

/** Maydonlardan birida so'rov uchraydi (har bir maydon alohida - `matchesQuery` kabi). */
function anyFieldMatches(fields: readonly SqlFragment[], contains: string): SqlFragment {
  return join(
    fields.map((field) => sql`${normalizedSql(field)} ILIKE ${contains}`),
    " OR ",
  );
}

/** `total` - `COUNT(*) OVER ()`: LIMIT dan oldingi umumiy son. */
interface Counted {
  total: number;
}

/** Topilgan qatorlar -> guruh; shablon yuklanmagan bo'lsa soni null. */
function group<Raw extends Counted, T>(rows: Raw[], uploaded: boolean, map: (row: Raw) => T): SearchGroup<T> {
  if (!uploaded) return { total: null, rows: [] };
  return { total: rows[0]?.total ?? 0, rows: rows.map(map) };
}

// Obyektlar reyestrlardagi qidiruv maydonlari bo'yicha qidiriladi - "Barchasini
// ko'rish" (`/feeders?q=...`) ochgan sahifada aynan shuncha qator chiqadi.
// Tartib: avval nomi so'rov bilan boshlanadiganlari, keyin nomida
// uchraydiganlari (qolganlari - manzil yoki xodim bo'yicha), so'ng alifbo.
// Faqat shu oyda holati bor obyektlar.

/** Podstansiya: nom, manzil, ma'sul xodim (`SubstationsView` qidiruvi). */
function searchSubstations(periodId: string, key: string, db: Db) {
  const { contains, prefix } = patterns(key);
  return queryRows<SubstationRaw>(
    db,
    sql`
      SELECT s.id, s.name, ss.address, st.name AS "staffName",
             ss."usefulKwh"::float8 AS "usefulKwh", COUNT(*) OVER ()::int AS total
      FROM substation_snapshots ss
      JOIN substations s ON s.id = ss."substationId"
      LEFT JOIN staff st ON st.id = ss."staffId"
      WHERE ss."periodId" = ${periodId}
        AND (${anyFieldMatches([sql`s.name`, sql`ss.address`, sql`st.name`], contains)})
      ORDER BY (s."nameKey" LIKE ${prefix}) DESC, (s."nameKey" LIKE ${contains}) DESC, s.name ASC, s.id ASC
      LIMIT ${SEARCH_HIT_LIMIT}`,
  );
}

interface SubstationRaw extends Counted {
  id: string;
  name: string;
  address: string | null;
  staffName: string | null;
  usefulKwh: number;
}

interface FeederRaw extends SubstationRaw {
  substationId: string;
  substationName: string;
}

/** Fider: nom, podstansiya nomi, manzil, ma'sul xodim (`FeedersView` qidiruvi). */
function searchFeeders(periodId: string, key: string, db: Db) {
  const { contains, prefix } = patterns(key);
  return queryRows<FeederRaw>(
    db,
    sql`
      SELECT f.id, f.name, s.id AS "substationId", s.name AS "substationName",
             fs.address, st.name AS "staffName",
             fs."usefulKwh"::float8 AS "usefulKwh", COUNT(*) OVER ()::int AS total
      FROM feeder_snapshots fs
      JOIN feeders f ON f.id = fs."feederId"
      JOIN substations s ON s.id = f."substationId"
      LEFT JOIN staff st ON st.id = fs."staffId"
      WHERE fs."periodId" = ${periodId}
        AND (${anyFieldMatches([sql`f.name`, sql`s.name`, sql`fs.address`, sql`st.name`], contains)})
      ORDER BY (f."nameKey" LIKE ${prefix}) DESC, (f."nameKey" LIKE ${contains}) DESC,
               f.name ASC, s.name ASC, f.id ASC
      LIMIT ${SEARCH_HIT_LIMIT}`,
  );
}

interface TransformerRaw extends FeederRaw {
  feederId: string;
  feederName: string;
}

/**
 * TP: nom, podstansiya va fider nomi, manzil, ma'sul xodim. `TransformersTable`
 * maydonlarni bitta matnga qo'shib qidiradi - bu yerda ham xuddi shunday,
 * shunda soni reyestrdagi bilan aniq teng.
 */
function searchTransformers(periodId: string, key: string, db: Db) {
  const { contains, prefix } = patterns(key);
  const text = sql`concat_ws(' ', t.name, s.name, f.name, ts.address, st.name)`;
  return queryRows<TransformerRaw>(
    db,
    sql`
      SELECT t.id, t.name, f.id AS "feederId", f.name AS "feederName",
             s.id AS "substationId", s.name AS "substationName",
             ts.address, st.name AS "staffName",
             ts."usefulKwh"::float8 AS "usefulKwh", COUNT(*) OVER ()::int AS total
      FROM transformer_snapshots ts
      JOIN transformers t ON t.id = ts."transformerId"
      JOIN feeders f ON f.id = t."feederId"
      JOIN substations s ON s.id = t."substationId"
      LEFT JOIN staff st ON st.id = ts."staffId"
      WHERE ts."periodId" = ${periodId} AND ${normalizedSql(text)} ILIKE ${contains}
      ORDER BY (t."nameKey" LIKE ${prefix}) DESC, (t."nameKey" LIKE ${contains}) DESC,
               t.name ASC, f.name ASC, t.id ASC
      LIMIT ${SEARCH_HIT_LIMIT}`,
  );
}

/**
 * `q` bo'yicha barcha turlarda qidiradi. Bo'sh so'rov (kalit bo'sh) - null:
 * sahifa tezkor plitkalarni ko'rsatadi.
 */
export async function searchPeriod(periodId: string, q: string, db: Db = prisma): Promise<SearchResults | null> {
  const key = nameKey(q);
  if (key === "") return null;

  const [uploads, substations, feeders, transformers, subscribers, violations, appeals, staff] = await Promise.all([
    periodUploads(periodId, db),
    searchSubstations(periodId, key, db),
    searchFeeders(periodId, key, db),
    searchTransformers(periodId, key, db),
    listSubscribers(periodId, { q, take: SEARCH_HIT_LIMIT }, db),
    listViolations(periodId, { q }, db),
    listAppeals(periodId, { q }, db),
    listStaffActivity(periodId, db),
  ]);

  // Xodimlar - `/staff` sahifasidagi ro'yxat (shu oyda uchragan xodimlar).
  const staffRows = staff.rows.filter((row) => nameKey(row.name).includes(key));

  return {
    substation: group(substations, uploads.SUBSTATIONS, ({ id, name, address, staffName, usefulKwh }) => ({
      id,
      name,
      address,
      staffName,
      usefulKwh,
    })),
    feeder: group(feeders, uploads.FEEDERS, (row) => ({
      id: row.id,
      name: row.name,
      substation: { id: row.substationId, name: row.substationName },
      address: row.address,
      staffName: row.staffName,
      usefulKwh: row.usefulKwh,
    })),
    transformer: group(transformers, uploads.TRANSFORMERS, (row) => ({
      id: row.id,
      name: row.name,
      substation: { id: row.substationId, name: row.substationName },
      feeder: { id: row.feederId, name: row.feederName },
      address: row.address,
      staffName: row.staffName,
      usefulKwh: row.usefulKwh,
    })),
    subscriber: subscribers.uploaded
      ? { total: subscribers.counts.all, rows: subscribers.rows }
      : { total: null, rows: [] },
    violation: violations.uploaded
      ? { total: violations.totals.total, rows: violations.rows.slice(0, SEARCH_HIT_LIMIT) }
      : { total: null, rows: [] },
    appeal: appeals.uploaded
      ? { total: appeals.totals.total, rows: appeals.rows.slice(0, SEARCH_HIT_LIMIT) }
      : { total: null, rows: [] },
    staff: { total: staffRows.length, rows: staffRows.slice(0, SEARCH_HIT_LIMIT) },
  };
}

/**
 * Tanlangan oydagi reyestrlar hajmi - qidiruv bo'sh bo'lganda plitkalar va
 * filtr tugmalari uchun. Sonlar sahifalardagi bilan bir xil manbadan:
 * `getScopeSummary` (tuman) va `listStaffActivity`. Yuklanmagan shablon - null.
 */
export async function getSearchOverview(periodId: string, db: Db = prisma): Promise<Record<SearchKind, number | null>> {
  const [summary, staff] = await Promise.all([
    getScopeSummary(periodId, DISTRICT, db),
    listStaffActivity(periodId, db),
  ]);
  return {
    substation: summary.counts.substations,
    feeder: summary.counts.feeders,
    transformer: summary.counts.transformers,
    // Abonentlar soni - Σ TP holatlari (5-bo'lim; 4.5-qoida bo'yicha ro'yxat
    // bilan teng). Qidiruv esa ro'yxat bo'yicha, shuning uchun ro'yxat
    // yuklanmagan oyda - null.
    subscriber: summary.subscriberList.uploaded ? (summary.subscribers?.total ?? null) : null,
    violation: summary.violations.uploaded ? summary.violations.total : null,
    appeal: summary.appeals.uploaded ? summary.appeals.total : null,
    staff: staff.totals.staff,
  };
}
