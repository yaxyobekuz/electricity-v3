import "server-only";

import type { SubscriberKind } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { getPeriodsUntil, type PeriodInfo } from "@/lib/period";

import { getTransformer, type TransformerDetail as TransformerEntity } from "./entities";
import { listSubscribers } from "./lists";
import { listRepairs, type RepairList } from "./repairs";
import {
  getScopeComparison,
  getScopeSeries,
  type Db,
  type Scope,
  type ScopeComparison,
  type ScopeSeriesPoint,
} from "./scope";

/*
 * TP detal sahifasi (`/transformers/[id]`) uchun barcha ma'lumot - bitta
 * yuklovchi. Har bir son umumiy so'rovlardan (malumotlar.md 5-bo'lim),
 * bu faylda yangi formula yo'q:
 *   - KPI va kartalar - `getScopeComparison` (shu oy va o'tgan oy);
 *   - dinamika va KPI ustunchalari - `getScopeSeries` (eng ko'pi 12 oy);
 *   - eng katta qarzdorlar - `listSubscribers` (qarzdorlik bo'yicha, birinchi 10 ta);
 *   - ta'mir ishlari - `listRepairs` (`/works` bilan bir xil qoida).
 *
 * Qaytgan obyekt serializable: Decimal va Date yo'q.
 */

/** "Eng katta qarzdor abonentlar" kartasidagi qatorlar soni. */
export const TOP_DEBTORS = 10;

export interface DebtorRow {
  /** Abonent id (`/subscribers/<id>`). */
  id: string;
  contractNumber: string;
  fullName: string;
  kind: SubscriberKind;
  debtUzs: number;
}

export interface TopDebtors {
  /** Abonentlar shabloni shu oyga yuklangan. */
  uploaded: boolean;
  rows: DebtorRow[];
}

export interface TransformerDetailStats {
  comparison: ScopeComparison;
  /** Tanlangan oygacha (u ham kiradi) davrlar, eskidan yangiga. */
  series: ScopeSeriesPoint[];
  debtors: TopDebtors;
  repairs: RepairList;
}

export interface TransformerDetailData {
  period: PeriodInfo;
  transformer: TransformerEntity;
  /** TP ning shu oyda holati yo'q bo'lsa - null (sahifa bo'sh holat ko'rsatadi). */
  stats: TransformerDetailStats | null;
}

/**
 * TP ning eng katta qarzdorlari - `/subscribers?scope=transformer:<id>&debtors=1`
 * ro'yxatining boshi: `debtUzs > 0` (qarzdor ta'rifi -
 * `ScopeSummary.subscriberList.debtors`), qarzdorlik kamayish tartibida.
 * Kartaga faqat ko'rsatiladigan maydonlar olinadi.
 */
async function topDebtors(periodId: string, scope: Scope, db: Db): Promise<TopDebtors> {
  const list = await listSubscribers(periodId, { scope, debtorsOnly: true, sort: "debt", take: TOP_DEBTORS }, db);
  return {
    uploaded: list.uploaded,
    rows: list.rows.map((row) => ({
      id: row.id,
      contractNumber: row.contractNumber,
      fullName: row.fullName,
      kind: row.kind,
      debtUzs: row.debtUzs,
    })),
  };
}

/** TP topilmasa - null (sahifa `notFound()`). */
export async function getTransformerDetailData(
  id: string,
  period: PeriodInfo,
  db: Db = prisma,
): Promise<TransformerDetailData | null> {
  // `cache` kaliti argumentlar soniga ham bog'liq: `generateMetadata` dagi
  // `getTransformer(id, periodId)` chaqiruvi bilan bitta so'rov bo'lsin.
  const transformer = await (db === prisma
    ? getTransformer(id, period.id)
    : getTransformer(id, period.id, db));
  if (!transformer) return null;
  if (!transformer.snapshot) return { period, transformer, stats: null };

  const scope: Scope = { kind: "transformer", id };
  const periods = await getPeriodsUntil(period, 12);
  const [comparison, series, debtors, repairs] = await Promise.all([
    getScopeComparison(scope, period, db),
    getScopeSeries(scope, periods, db),
    topDebtors(period.id, scope, db),
    listRepairs(period.id, scope, db),
  ]);

  return { period, transformer, stats: { comparison, series, debtors, repairs } };
}
