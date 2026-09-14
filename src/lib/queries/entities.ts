import "server-only";

import { cache } from "react";

import type { MeterStatus, SubscriberKind } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { lossPercent, toNumber } from "@/lib/domain/metrics";
import { monthKey, monthLabel, monthShort } from "@/lib/format";

import { amount, iso, type Db, type EntityRef } from "./scope";

/*
 * Bitta obyekt sahifasi uchun: obyekt, uning ota obyektlari (breadcrumb) va
 * tanlangan oydagi holati. Obyekt topilmasa - null (sahifa `notFound()`);
 * obyekt bor, lekin shu oyda holati yo'q - `snapshot: null`.
 *
 * `cache` - `generateMetadata` va sahifa bitta so'rovni ikki marta yubormasin.
 */

const STAFF_SELECT = { select: { id: true, name: true } } as const;

export interface EnergyFields {
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  /** Σ yo'qotish / Σ umumiy oqim; umumiy oqim ≤ 0 bo'lsa - null. */
  lossPercent: number | null;
}

function energyFields(row: {
  totalKwh: { toNumber(): number };
  usefulKwh: { toNumber(): number };
  lossKwh: { toNumber(): number };
}): EnergyFields {
  const totalKwh = row.totalKwh.toNumber();
  const lossKwh = row.lossKwh.toNumber();
  return { totalKwh, usefulKwh: row.usefulKwh.toNumber(), lossKwh, lossPercent: lossPercent(totalKwh, lossKwh) };
}

// ---------------------------------------------------------------------------
// Podstansiya
// ---------------------------------------------------------------------------

export interface SubstationDetail {
  id: string;
  name: string;
  snapshot:
    | (EnergyFields & {
        address: string | null;
        lat: number | null;
        lng: number | null;
        capacityKva: number | null;
        staff: EntityRef | null;
        rowNumber: number;
      })
    | null;
}

export const getSubstation = cache(
  async (id: string, periodId: string, db: Db = prisma): Promise<SubstationDetail | null> => {
    const row = await db.substation.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        snapshots: { where: { periodId }, include: { staff: STAFF_SELECT } },
      },
    });
    if (!row) return null;
    const snap = row.snapshots[0];
    return {
      id: row.id,
      name: row.name,
      snapshot: snap
        ? {
            ...energyFields(snap),
            address: snap.address,
            lat: toNumber(snap.latitude),
            lng: toNumber(snap.longitude),
            capacityKva: toNumber(snap.capacityKva),
            staff: snap.staff,
            rowNumber: snap.rowNumber,
          }
        : null,
    };
  },
);

// ---------------------------------------------------------------------------
// Fider
// ---------------------------------------------------------------------------

export interface FeederDetail {
  id: string;
  name: string;
  substation: EntityRef;
  snapshot:
    | (EnergyFields & {
        address: string | null;
        capacityKva: number | null;
        staff: EntityRef | null;
        rowNumber: number;
      })
    | null;
}

export const getFeeder = cache(async (id: string, periodId: string, db: Db = prisma): Promise<FeederDetail | null> => {
  const row = await db.feeder.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      substation: { select: { id: true, name: true } },
      snapshots: { where: { periodId }, include: { staff: STAFF_SELECT } },
    },
  });
  if (!row) return null;
  const snap = row.snapshots[0];
  return {
    id: row.id,
    name: row.name,
    substation: row.substation,
    snapshot: snap
      ? {
          ...energyFields(snap),
          address: snap.address,
          capacityKva: toNumber(snap.capacityKva),
          staff: snap.staff,
          rowNumber: snap.rowNumber,
        }
      : null,
  };
});

// ---------------------------------------------------------------------------
// Transformator (TP)
// ---------------------------------------------------------------------------

export interface TransformerDetail {
  id: string;
  name: string;
  substation: EntityRef;
  feeder: EntityRef;
  snapshot:
    | (EnergyFields & {
        onlineSubscribers: number;
        offlineSubscribers: number;
        /** online + offline */
        subscribers: number;
        address: string | null;
        lat: number | null;
        lng: number | null;
        capacityKva: number | null;
        /** "Joriy ta'mir sanasi", ISO. */
        currentRepairDate: string | null;
        /** "To'la ta'mir sanasi", ISO. */
        overhaulDate: string | null;
        staff: EntityRef | null;
        rowNumber: number;
      })
    | null;
}

export const getTransformer = cache(
  async (id: string, periodId: string, db: Db = prisma): Promise<TransformerDetail | null> => {
    const row = await db.transformer.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        substation: { select: { id: true, name: true } },
        feeder: { select: { id: true, name: true } },
        snapshots: { where: { periodId }, include: { staff: STAFF_SELECT } },
      },
    });
    if (!row) return null;
    const snap = row.snapshots[0];
    return {
      id: row.id,
      name: row.name,
      substation: row.substation,
      feeder: row.feeder,
      snapshot: snap
        ? {
            ...energyFields(snap),
            onlineSubscribers: snap.onlineSubscribers,
            offlineSubscribers: snap.offlineSubscribers,
            subscribers: snap.onlineSubscribers + snap.offlineSubscribers,
            address: snap.address,
            lat: toNumber(snap.latitude),
            lng: toNumber(snap.longitude),
            capacityKva: toNumber(snap.capacityKva),
            currentRepairDate: iso(snap.currentRepairDate),
            overhaulDate: iso(snap.overhaulDate),
            staff: snap.staff,
            rowNumber: snap.rowNumber,
          }
        : null,
    };
  },
);

// ---------------------------------------------------------------------------
// Abonent
// ---------------------------------------------------------------------------

export interface SubscriberDetail {
  id: string;
  contractNumber: string;
  /**
   * FISH va ota obyektlar: tanlangan oy holatidan; u yo'q bo'lsa - tanlangan
   * oydan oldingi eng so'nggi holatdan, u ham yo'q bo'lsa - keyingi oylardagi
   * eng birinchi holatdan (sarlavha va breadcrumb uchun). Abonent TP ni oydan
   * oyga almashtirishi mumkin - `sourcePeriodKey` qaysi oy ekanini aytadi.
   */
  fullName: string;
  transformer: EntityRef;
  feeder: EntityRef;
  substation: EntityRef;
  /** Qaysi oy holatidan olingani ("2026-09"). */
  sourcePeriodKey: string;
  /** Tanlangan oydagi holat. Passport va PINFL hech qachon qaytarilmaydi. */
  snapshot: {
    fullName: string;
    kind: SubscriberKind;
    meterStatus: MeterStatus;
    staff: EntityRef | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    meterSerial: string | null;
    meterType: string | null;
    debtUzs: number;
    creditUzs: number;
    meterReading: number | null;
    lastReadingAt: string | null;
    lastPaymentDate: string | null;
    lastPaymentUzs: number | null;
    contractDate: string | null;
    meterInstalledAt: string | null;
    rowNumber: number;
  } | null;
}

/** Transformator + fider + podstansiya nomlari (abonent holati TP si orqali). */
const TRANSFORMER_PATH = {
  select: {
    id: true,
    name: true,
    feeder: { select: { id: true, name: true } },
    substation: { select: { id: true, name: true } },
  },
} as const;

const HEADER_SELECT = {
  fullName: true,
  period: { select: { month: true } },
  transformer: TRANSFORMER_PATH,
} as const;

/**
 * Tanlangan oyda holati yo'q abonent uchun sarlavha manbasi: shu oydan oldingi
 * eng so'nggi holat; u ham yo'q bo'lsa - keyingi oylardagi eng birinchisi.
 */
async function fallbackHeader(id: string, periodId: string, db: Db) {
  const period = await db.period.findUnique({ where: { id: periodId }, select: { month: true } });
  const before = await db.subscriberSnapshot.findFirst({
    where: { subscriberId: id, ...(period ? { period: { month: { lte: period.month } } } : {}) },
    orderBy: { period: { month: "desc" } },
    select: HEADER_SELECT,
  });
  if (before || !period) return before;
  return db.subscriberSnapshot.findFirst({
    where: { subscriberId: id, period: { month: { gt: period.month } } },
    orderBy: { period: { month: "asc" } },
    select: HEADER_SELECT,
  });
}

export const getSubscriber = cache(
  async (id: string, periodId: string, db: Db = prisma): Promise<SubscriberDetail | null> => {
    const [subscriber, current] = await Promise.all([
      db.subscriber.findUnique({ where: { id }, select: { id: true, contractNumber: true } }),
      db.subscriberSnapshot.findUnique({
        where: { periodId_subscriberId: { periodId, subscriberId: id } },
        // Shaxsiy maydonlar (passport, pinfl) ataylab tanlanmaydi.
        select: {
          ...HEADER_SELECT,
          kind: true,
          meterStatus: true,
          staff: STAFF_SELECT,
          address: true,
          latitude: true,
          longitude: true,
          meterSerial: true,
          meterType: true,
          debtUzs: true,
          creditUzs: true,
          meterReading: true,
          lastReadingAt: true,
          lastPaymentDate: true,
          lastPaymentUzs: true,
          contractDate: true,
          meterInstalledAt: true,
          rowNumber: true,
        },
      }),
    ]);
    if (!subscriber) return null;
    // Abonent yozuvi faqat Abonentlar shablonidan yaratiladi - holati doim bor.
    const source = current ?? (await fallbackHeader(id, periodId, db));
    if (!source) return null;

    return {
      id: subscriber.id,
      contractNumber: subscriber.contractNumber,
      fullName: source.fullName,
      transformer: { id: source.transformer.id, name: source.transformer.name },
      feeder: source.transformer.feeder,
      substation: source.transformer.substation,
      sourcePeriodKey: monthKey(source.period.month),
      snapshot: current
        ? {
            fullName: current.fullName,
            kind: current.kind,
            meterStatus: current.meterStatus,
            staff: current.staff,
            address: current.address,
            lat: toNumber(current.latitude),
            lng: toNumber(current.longitude),
            meterSerial: current.meterSerial,
            meterType: current.meterType,
            debtUzs: amount(current.debtUzs),
            creditUzs: amount(current.creditUzs),
            meterReading: toNumber(current.meterReading),
            lastReadingAt: iso(current.lastReadingAt),
            lastPaymentDate: iso(current.lastPaymentDate),
            lastPaymentUzs: toNumber(current.lastPaymentUzs),
            contractDate: iso(current.contractDate),
            meterInstalledAt: iso(current.meterInstalledAt),
            rowNumber: current.rowNumber,
          }
        : null,
    };
  },
);

export interface SubscriberHistoryPoint {
  periodId: string;
  /** "2026-09" */
  key: string;
  /** "Sentabr 2026" */
  label: string;
  /** "Sen" */
  shortLabel: string;
  /** Davrning hisobot sanasi, ISO. */
  reportDate: string;
  transformer: EntityRef;
  meterReading: number | null;
  /**
   * Oldingi mavjud holatdagi ko'rsatkichdan farq. Birinchi holatda yoki
   * ikkala ko'rsatkichdan biri bo'sh bo'lsa - null.
   */
  readingDiff: number | null;
  debtUzs: number;
  creditUzs: number;
  lastReadingAt: string | null;
  lastPaymentDate: string | null;
  lastPaymentUzs: number | null;
  meterStatus: MeterStatus;
}

/** Abonentning barcha oylardagi holati, eskidan yangiga. */
export const getSubscriberHistory = cache(
  async (subscriberId: string, db: Db = prisma): Promise<SubscriberHistoryPoint[]> => {
    const rows = await db.subscriberSnapshot.findMany({
      where: { subscriberId },
      orderBy: { period: { month: "asc" } },
      select: {
        meterReading: true,
        debtUzs: true,
        creditUzs: true,
        lastReadingAt: true,
        lastPaymentDate: true,
        lastPaymentUzs: true,
        meterStatus: true,
        period: { select: { id: true, month: true, reportDate: true } },
        transformer: { select: { id: true, name: true } },
      },
    });
    let previousReading: number | null = null;
    return rows.map((row, index) => {
      const meterReading = toNumber(row.meterReading);
      const readingDiff = index > 0 && meterReading != null && previousReading != null
        ? meterReading - previousReading
        : null;
      previousReading = meterReading;
      return {
        periodId: row.period.id,
        key: monthKey(row.period.month),
        label: monthLabel(row.period.month),
        shortLabel: monthShort(row.period.month),
        reportDate: row.period.reportDate.toISOString(),
        transformer: row.transformer,
        meterReading,
        readingDiff,
        debtUzs: amount(row.debtUzs),
        creditUzs: amount(row.creditUzs),
        lastReadingAt: iso(row.lastReadingAt),
        lastPaymentDate: iso(row.lastPaymentDate),
        lastPaymentUzs: toNumber(row.lastPaymentUzs),
        meterStatus: row.meterStatus,
      };
    });
  },
);
