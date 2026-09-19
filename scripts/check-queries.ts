/*
 * So'rov qatlami (`src/lib/queries/*`) uchun o'zaro moslik testi.
 *
 * Ishga tushirish:
 *   npx tsx --conditions=react-server scripts/check-queries.ts
 *
 * Hammasi bitta tranzaksiya ichida: kichik ierarxiya ikki ketma-ket oy uchun
 * yoziladi, har bir funksiya `db = tx` bilan chaqiriladi va natijalar bir-biri
 * bilan solishtiriladi. Oxirida tranzaksiya ataylab bekor qilinadi - baza
 * o'zgarmaydi (boshqa jarayonlar bilan parallel ishlash xavfsiz).
 */
import "dotenv/config";

import type { AppealStatus, MeterStatus, SubscriberKind, TemplateType, ViolatorType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { TEMPLATE_ORDER } from "@/lib/domain/labels";
import { daysBetween, lossPercent, monthsBetween } from "@/lib/domain/metrics";
import { detectPhotoType, photoKindFromSegment, photoUrl } from "@/lib/domain/photos";
import { daysBeforeReport, durationText, maskIdentifier, monthShort } from "@/lib/format";
import { getPeriodUploads, getPreviousPeriod, listPeriods } from "@/lib/period";
import {
  getFeeder,
  getSubscriber,
  getSubscriberHistory,
  getSubstation,
  getTransformer,
} from "@/lib/queries/entities";
import { listAppeals, listFeeders, listSubscribers, listSubstations, listTransformers, listViolations } from "@/lib/queries/lists";
import { listRepairs } from "@/lib/queries/repairs";
import {
  deleteSubscriberPhoto,
  getSubscriberPhotos,
  readSubscriberPhoto,
  saveSubscriberPhoto,
} from "@/lib/queries/subscriber-photos";
import {
  getSubscriberEventSeries,
  getSubscriberRelated,
  getSubscriberSource,
} from "@/lib/queries/subscribers-related";
import {
  getScopeComparison,
  getScopeSeries,
  getScopeSummary,
  periodUploads,
  previousPeriodOf,
  toPeriodInfo,
  uploadsMany,
  type Db,
  type Scope,
  type ScopeSummary,
} from "@/lib/queries/scope";
import { listStaffActivity } from "@/lib/queries/staff";

// ---------------------------------------------------------------------------
// Tekshiruv yordamchilari
// ---------------------------------------------------------------------------

const failures: string[] = [];
let passed = 0;

function sameValue(actual: unknown, expected: unknown, path: string, errors: string[]): void {
  if (typeof actual === "number" && typeof expected === "number") {
    if (Math.abs(actual - expected) > 1e-6) errors.push(`${path}: ${actual} != ${expected}`);
    return;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      errors.push(`${path}: length ${actual.length} != ${expected.length}`);
      return;
    }
    actual.forEach((item, index) => sameValue(item, expected[index], `${path}[${index}]`, errors));
    return;
  }
  if (actual && expected && typeof actual === "object" && typeof expected === "object") {
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const key of keys) {
      sameValue(
        (actual as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
        `${path}.${key}`,
        errors,
      );
    }
    return;
  }
  if (actual !== expected) errors.push(`${path}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
}

function expectEqual(label: string, actual: unknown, expected: unknown): void {
  const errors: string[] = [];
  sameValue(actual, expected, "", errors);
  if (errors.length === 0) passed += 1;
  else failures.push(`${label}\n    ${errors.slice(0, 6).join("\n    ")}`);
}

function expectTrue(label: string, condition: boolean): void {
  if (condition) passed += 1;
  else failures.push(label);
}

const sumOf = <T>(items: readonly T[], pick: (item: T) => number) => items.reduce((acc, item) => acc + pick(item), 0);

const uploadsOf = (spec: { uploads: readonly TemplateType[] }) =>
  Object.fromEntries(TEMPLATE_ORDER.map((type) => [type, spec.uploads.includes(type)]));

// ---------------------------------------------------------------------------
// Test ma'lumoti
// ---------------------------------------------------------------------------

class Rollback extends Error {}

// Boshqa jarayonlar bilan to'qnashmaslik uchun tasodifiy yil va nom qo'shimchasi.
const YEAR = 1900 + Math.floor(Math.random() * 90);
const TAG = `qtest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const day = (month: number, date: number) => new Date(Date.UTC(YEAR, month - 1, date));

type Energy = [total: number, useful: number, loss: number];

interface SubscriberSpec {
  contract: string;
  name: string;
  kind: SubscriberKind;
  status: MeterStatus;
  debt: number;
  credit: number;
  reading: number | null;
  staff?: "A" | "B";
  address?: string;
  serial?: string;
  lastReadingAt?: Date;
  lastPaymentDate?: Date;
  lastPaymentUzs?: number;
  contractDate?: Date;
}

interface MonthSpec {
  month: number;
  reportDay: number;
  uploads: TemplateType[];
  substations: Record<string, { energy: Energy; staff?: "A" | "B" }>;
  feeders: Record<string, { energy: Energy; staff?: "A" | "B" }>;
  transformers: Record<
    string,
    {
      energy: Energy;
      staff?: "A" | "B";
      current?: Date;
      overhaul?: Date;
      subscribers: SubscriberSpec[];
      /** false - TP holati yozilmaydi (TP faqat abonentlar ro'yxatida). */
      snapshot?: false;
      /** TP holatidagi [aloqada, aloqadan chiqqan] - berilmasa abonentlardan (4.5). */
      counts?: [online: number, offline: number];
    }
  >;
  violations: { tp: string; name: string; type: ViolatorType; uzs: number; kwh: number; staff?: "A" | "B"; subscriber?: string }[];
  appeals: { tp: string; name: string; status: AppealStatus; staff?: "A" | "B" }[];
}

const SUBSTATION_OF: Record<string, string> = { F1: "S1", F2: "S1", F3: "S2" };
const FEEDER_OF: Record<string, string> = { T1: "F1", T2: "F1", T3: "F2", T4: "F3" };

/** Soat va millisekund bilan - xom SQL va Prisma model yo'lidagi sana o'girishini solishtirish uchun. */
const moment = (month: number, date: number) => new Date(Date.UTC(YEAR, month - 1, date, 9, 30, 15, 123));

const C1 = (month: number, debt: number, reading: number | null): SubscriberSpec => ({
  contract: "AB 104 512",
  name: "O‘rinboy Aliyev",
  kind: "HOUSEHOLD",
  status: "ONLINE",
  debt,
  credit: 0,
  reading,
  staff: "A",
  address: "Chinobod ko‘chasi 5",
  serial: "SN-777",
  lastReadingAt: moment(month, 12),
  lastPaymentDate: day(month, 2),
  lastPaymentUzs: 150000.5,
  contractDate: day(1, 15),
});

const MONTHS: MonthSpec[] = [
  {
    month: 3,
    reportDay: 13,
    uploads: ["SUBSTATIONS", "FEEDERS", "TRANSFORMERS", "SUBSCRIBERS", "VIOLATIONS"],
    substations: { S1: { energy: [10000, 9000, 1000], staff: "A" }, S2: { energy: [4000, 3000, 1000] } },
    feeders: {
      F1: { energy: [6000, 5500, 500], staff: "B" },
      F2: { energy: [3500, 3200, 300] },
      F3: { energy: [3800, 2900, 900] },
    },
    transformers: {
      T1: {
        energy: [3000, 2800, 200],
        staff: "A",
        current: day(2, 1),
        subscribers: [
          C1(3, 1000, 100),
          { contract: "C2", name: "Bekzod Karimov", kind: "LEGAL", status: "NOT_RESPONDING", debt: 0, credit: 50, reading: 200, staff: "B" },
        ],
      },
      T2: {
        energy: [2500, 2300, 200],
        subscribers: [
          { contract: "C3", name: "Dilnoza Rahimova", kind: "HOUSEHOLD", status: "SCHEME_CHANGED", debt: 2500.5, credit: 0, reading: null },
        ],
      },
      T3: {
        energy: [3000, 2900, 100],
        subscribers: [
          { contract: "C4", name: "Sardor Yo'ldoshev", kind: "LEGAL", status: "ONLINE", debt: 0, credit: 0, reading: 300, staff: "A" },
        ],
      },
      T4: {
        energy: [3500, 2800, 700],
        staff: "A",
        subscribers: [
          { contract: "C5", name: "Nodira Tosheva", kind: "HOUSEHOLD", status: "ONLINE", debt: 700, credit: 0, reading: 50 },
          { contract: "C7", name: "Aziza Qodirova", kind: "HOUSEHOLD", status: "ONLINE", debt: 0, credit: 10, reading: 5 },
        ],
      },
    },
    violations: [
      { tp: "T1", name: "O'rinboy Aliyev", type: "INDIVIDUAL", uzs: 50000, kwh: 120, staff: "A", subscriber: "AB 104 512" },
      { tp: "T4", name: "Noma’lum shaxs", type: "INNOCENT", uzs: 0, kwh: 0 },
    ],
    appeals: [],
  },
  {
    month: 4,
    reportDay: 13,
    uploads: [...TEMPLATE_ORDER],
    substations: { S1: { energy: [11000, 9900, 1100], staff: "A" }, S2: { energy: [5000, 3500, 1500] } },
    feeders: { F1: { energy: [6500, 6000, 500], staff: "B" }, F3: { energy: [4700.75, 3400.25, 1300.5] } },
    transformers: {
      T1: {
        energy: [3200, 3000, 200],
        staff: "A",
        current: day(4, 1),
        overhaul: day(5, 20),
        subscribers: [
          C1(4, 800, 130),
          {
            contract: "C2",
            name: "Bekzod Karimov",
            kind: "LEGAL",
            status: "NOT_RESPONDING",
            debt: 100,
            credit: 0,
            reading: 260,
            staff: "B",
            lastReadingAt: new Date(Date.UTC(YEAR, 3, 1, 23, 59, 59, 999)),
            contractDate: day(2, 28),
          },
          { contract: "C6", name: "Jasur Ergashev", kind: "HOUSEHOLD", status: "ONLINE", debt: 0, credit: 0, reading: 10, staff: "B" },
        ],
      },
      T2: {
        energy: [2800.5, 2600.25, 200.25],
        staff: "B",
        overhaul: day(4, 14),
        subscribers: [
          { contract: "C3", name: "Dilnoza Rahimova", kind: "HOUSEHOLD", status: "SCHEME_CHANGED", debt: 2600, credit: 0, reading: null },
          { contract: "C4", name: "Sardor Yo'ldoshev", kind: "LEGAL", status: "ONLINE", debt: 0, credit: 0, reading: 350, staff: "A" },
        ],
      },
      T4: {
        energy: [4200, 3200, 1000],
        staff: "A",
        current: day(4, 13),
        subscribers: [
          { contract: "C5", name: "Nodira Tosheva", kind: "HOUSEHOLD", status: "NOT_RESPONDING", debt: 900, credit: 0, reading: null },
        ],
      },
    },
    violations: [
      { tp: "T2", name: "MChJ Nur", type: "LEGAL", uzs: 150000.5, kwh: 300.25, staff: "B" },
      { tp: "T4", name: "Nodira Tosheva", type: "INDIVIDUAL", uzs: 20000, kwh: 40, staff: "A", subscriber: "C5" },
      { tp: "T1", name: "Jasur Ergashev", type: "INDIVIDUAL", uzs: 10000, kwh: 10 },
    ],
    appeals: [
      { tp: "T1", name: "O‘rinboy Aliyev", status: "RESOLVED", staff: "A" },
      { tp: "T1", name: "Bekzod Karimov", status: "OVERDUE", staff: "A" },
      { tp: "T4", name: "Nodira Tosheva", status: "IN_PROGRESS", staff: "B" },
      { tp: "T2", name: "Dilnoza Rahimova", status: "REJECTED" },
    ],
  },
  {
    // Oyga faqat Podstansiyalar yuklangan: fider/TP/abonent sonlari "0" emas - null.
    month: 5,
    reportDay: 10,
    uploads: ["SUBSTATIONS"],
    substations: { S1: { energy: [12000, 10000, 2000], staff: "B" } },
    feeders: {},
    transformers: {},
    violations: [],
    appeals: [],
  },
  {
    // Qismli yuklash (malumotlar.md 5.1): Fiderlar faqat S1 ni, Transformatorlar faqat S2 ni,
    // abonentlar ro'yxati faqat S1 ni qamraydi.
    month: 6,
    reportDay: 12,
    uploads: ["SUBSTATIONS", "FEEDERS", "TRANSFORMERS", "SUBSCRIBERS"],
    substations: { S1: { energy: [9000, 8000, 1000] }, S2: { energy: [3000, 2500, 500] } },
    feeders: { F1: { energy: [5000, 4500, 500] } },
    transformers: {
      T1: {
        energy: [0, 0, 0],
        snapshot: false,
        subscribers: [
          { contract: "C8", name: "Olim Sobirov", kind: "LEGAL", status: "ONLINE", debt: 300, credit: 0, reading: 40 },
          { contract: "C9", name: "Zuhra Nazarova", kind: "HOUSEHOLD", status: "NOT_RESPONDING", debt: 0, credit: 0, reading: 7 },
        ],
      },
      T4: { energy: [2600, 2100, 500], counts: [5, 2], subscribers: [] },
    },
    violations: [],
    appeals: [],
  },
];

interface Seeded {
  periods: { id: string; month: Date; reportDate: Date }[];
  staff: Record<string, string>;
  substations: Record<string, string>;
  feeders: Record<string, string>;
  transformers: Record<string, string>;
  subscribers: Record<string, string>;
}

async function seed(tx: Db): Promise<Seeded> {
  const ids: Seeded = { periods: [], staff: {}, substations: {}, feeders: {}, transformers: {}, subscribers: {} };
  for (const key of ["A", "B"]) {
    const row = await tx.staff.create({ data: { name: `Xodim ${key} ${TAG}`, nameKey: `xodim ${key} ${TAG}`.toLowerCase() } });
    ids.staff[key] = row.id;
  }
  for (const key of ["S1", "S2"]) {
    const row = await tx.substation.create({ data: { name: `${key} ${TAG}`, nameKey: `${key} ${TAG}`.toLowerCase() } });
    ids.substations[key] = row.id;
  }
  for (const [key, parent] of Object.entries(SUBSTATION_OF)) {
    const row = await tx.feeder.create({
      data: { substationId: ids.substations[parent], name: `${key} ${TAG}`, nameKey: `${key} ${TAG}`.toLowerCase() },
    });
    ids.feeders[key] = row.id;
  }
  for (const [key, parent] of Object.entries(FEEDER_OF)) {
    const row = await tx.transformer.create({
      data: {
        substationId: ids.substations[SUBSTATION_OF[parent]],
        feederId: ids.feeders[parent],
        name: `${key} ${TAG}`,
        nameKey: `${key} ${TAG}`.toLowerCase(),
      },
    });
    ids.transformers[key] = row.id;
  }
  const staffId = (key?: "A" | "B") => (key ? ids.staff[key] : null);

  for (const spec of MONTHS) {
    const period = await tx.period.create({
      data: { month: day(spec.month, 1), reportDate: day(spec.month, spec.reportDay) },
    });
    ids.periods.push(period);
    for (const type of spec.uploads) {
      await tx.importBatch.create({
        data: { templateType: type, status: "COMPLETED", fileName: `${type}.xlsx`, fileSize: 1, periodId: period.id },
      });
    }
    // FAILED yuklash "yuklangan" deb hisoblanmasligi kerak.
    await tx.importBatch.create({
      data: { templateType: "APPEALS", status: "FAILED", fileName: "x.xlsx", fileSize: 1, periodId: period.id },
    });

    let row = 3;
    for (const [key, item] of Object.entries(spec.substations)) {
      const [totalKwh, usefulKwh, lossKwh] = item.energy;
      await tx.substationSnapshot.create({
        data: {
          periodId: period.id,
          substationId: ids.substations[key],
          rowNumber: row++,
          totalKwh,
          usefulKwh,
          lossKwh,
          latitude: 41.3,
          longitude: 69.2,
          staffId: staffId(item.staff),
        },
      });
    }
    for (const [key, item] of Object.entries(spec.feeders)) {
      const [totalKwh, usefulKwh, lossKwh] = item.energy;
      await tx.feederSnapshot.create({
        data: { periodId: period.id, feederId: ids.feeders[key], rowNumber: row++, totalKwh, usefulKwh, lossKwh, staffId: staffId(item.staff) },
      });
    }
    for (const [key, item] of Object.entries(spec.transformers)) {
      const [totalKwh, usefulKwh, lossKwh] = item.energy;
      // 4.5 qoida: TP sonlari = abonentlar ro'yxati (`counts` berilmasa).
      const online = item.subscribers.filter((sub) => sub.status === "ONLINE").length;
      const [onlineSubscribers, offlineSubscribers] = item.counts ?? [online, item.subscribers.length - online];
      if (item.snapshot !== false) {
        await tx.transformerSnapshot.create({
          data: {
            periodId: period.id,
            transformerId: ids.transformers[key],
            rowNumber: row++,
            totalKwh,
            usefulKwh,
            lossKwh,
            onlineSubscribers,
            offlineSubscribers,
            currentRepairDate: item.current ?? null,
            overhaulDate: item.overhaul ?? null,
            staffId: staffId(item.staff),
          },
        });
      }
      for (const sub of item.subscribers) {
        const contractKey = `${sub.contract}${TAG}`.replace(/\s+/g, "").toUpperCase();
        if (!ids.subscribers[sub.contract]) {
          const created = await tx.subscriber.create({ data: { contractNumber: `${sub.contract} ${TAG}`, contractKey } });
          ids.subscribers[sub.contract] = created.id;
        }
        await tx.subscriberSnapshot.create({
          data: {
            periodId: period.id,
            subscriberId: ids.subscribers[sub.contract],
            transformerId: ids.transformers[key],
            rowNumber: row++,
            fullName: sub.name,
            kind: sub.kind,
            meterStatus: sub.status,
            staffId: staffId(sub.staff),
            address: sub.address ?? null,
            meterSerial: sub.serial ?? null,
            debtUzs: sub.debt,
            creditUzs: sub.credit,
            meterReading: sub.reading,
            lastReadingAt: sub.lastReadingAt ?? null,
            lastPaymentDate: sub.lastPaymentDate ?? null,
            lastPaymentUzs: sub.lastPaymentUzs ?? null,
            contractDate: sub.contractDate ?? null,
            passport: "AA1234567",
            pinfl: "12345678901234",
          },
        });
      }
    }
    for (const item of spec.violations) {
      await tx.violation.create({
        data: {
          periodId: period.id,
          // Import kabi: TP bilan birga fider va podstansiya ham yoziladi (malumotlar.md 4.3d).
          transformerId: ids.transformers[item.tp],
          feederId: ids.feeders[FEEDER_OF[item.tp]],
          substationId: ids.substations[SUBSTATION_OF[FEEDER_OF[item.tp]]],
          subscriberId: item.subscriber ? ids.subscribers[item.subscriber] : null,
          rowNumber: row++,
          subscriberName: item.name,
          violatorType: item.type,
          date: day(spec.month, 5),
          damageUzs: item.uzs,
          damageKwh: item.kwh,
          staffId: staffId(item.staff),
        },
      });
    }
    for (const item of spec.appeals) {
      await tx.appeal.create({
        data: {
          periodId: period.id,
          transformerId: ids.transformers[item.tp],
          feederId: ids.feeders[FEEDER_OF[item.tp]],
          substationId: ids.substations[SUBSTATION_OF[FEEDER_OF[item.tp]]],
          rowNumber: row++,
          text: `Murojaat ${item.name}`,
          subscriberName: item.name,
          date: day(spec.month, 6),
          status: item.status,
          staffId: staffId(item.staff),
        },
      });
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Tekshiruvlar
// ---------------------------------------------------------------------------

async function checkSummaryAgainstLists(tx: Db, periodId: string, scope: Scope, label: string, summary: ScopeSummary) {
  const subscribers = await listSubscribers(periodId, { scope, take: 500 }, tx);
  expectEqual(`${label}: abonentlar ro'yxati yuklangan`, subscribers.uploaded, summary.subscriberList.uploaded);
  expectEqual(`${label}: TP abonent jami = ro'yxat jami`, summary.subscribers?.total, subscribers.total);
  expectEqual(`${label}: summary.subscriberList.total = ro'yxat`, summary.subscriberList.total, subscribers.total);
  expectEqual(`${label}: aloqada = ONLINE holat`, summary.subscribers?.online, summary.subscriberList.byStatus.ONLINE);
  expectEqual(
    `${label}: aloqadan chiqqan = qolgan holatlar`,
    summary.subscribers?.offline,
    summary.subscriberList.byStatus.NOT_RESPONDING + summary.subscriberList.byStatus.SCHEME_CHANGED,
  );
  expectEqual(`${label}: byKind = ro'yxat chiplari`, summary.subscriberList.byKind, subscribers.counts.byKind);
  expectEqual(`${label}: byStatus = ro'yxat chiplari`, summary.subscriberList.byStatus, subscribers.counts.byStatus);
  expectEqual(`${label}: qarzdorlar`, summary.subscriberList.debtors, subscribers.counts.debtors);
  expectEqual(`${label}: qarzdorlik yig'indisi`, summary.subscriberList.debtUzs, sumOf(subscribers.rows, (row) => row.debtUzs));
  expectEqual(`${label}: haqdorlik yig'indisi`, summary.subscriberList.creditUzs, sumOf(subscribers.rows, (row) => row.creditUzs));
  expectEqual(
    `${label}: debtors = debtUzs > 0 qatorlar`,
    summary.subscriberList.debtors,
    subscribers.rows.filter((row) => row.debtUzs > 0).length,
  );

  const violations = await listViolations(periodId, { scope }, tx);
  expectEqual(`${label}: qoidabuzarliklar yuklangan`, violations.uploaded, summary.violations.uploaded);
  expectEqual(`${label}: qoidabuzarliklar soni`, summary.violations.total, violations.totals.total);
  expectEqual(`${label}: qoidabuzarlik turlari`, summary.violations.byType, violations.totals.byType);
  expectEqual(`${label}: zarar so'm`, summary.violations.damageUzs, violations.totals.damageUzs);
  expectEqual(`${label}: zarar kWh`, summary.violations.damageKwh, violations.totals.damageKwh);
  expectEqual(`${label}: qoidabuzarlik qatorlari = total`, violations.rows.length, violations.totals.total);

  const appeals = await listAppeals(periodId, { scope }, tx);
  expectEqual(`${label}: murojaatlar yuklangan`, appeals.uploaded, summary.appeals.uploaded);
  expectEqual(`${label}: murojaatlar soni`, summary.appeals.total, appeals.totals.total);
  expectEqual(`${label}: murojaat holatlari`, summary.appeals.byStatus, appeals.totals.byStatus);

  const filter =
    scope.kind === "substation" ? { substationId: scope.id } : scope.kind === "feeder" ? { feederId: scope.id } : {};
  if (scope.kind !== "transformer") {
    const transformers = await listTransformers(periodId, filter, tx);
    expectEqual(`${label}: TP soni = TP ro'yxati`, summary.counts.transformers, transformers.length);
    expectEqual(
      `${label}: TP ro'yxati abonentlari`,
      summary.subscribers?.total,
      sumOf(transformers, (row) => row.onlineSubscribers + row.offlineSubscribers),
    );
    expectEqual(
      `${label}: TP ro'yxati qarzdorligi`,
      summary.subscriberList.debtUzs,
      sumOf(transformers, (row) => row.debtUzs ?? 0),
    );
    expectEqual(`${label}: TP ro'yxati qoidabuzarliklari`, summary.violations.total, sumOf(transformers, (row) => row.violations ?? 0));
    expectEqual(`${label}: TP ro'yxati murojaatlari`, summary.appeals.total, sumOf(transformers, (row) => row.appeals ?? 0));
    // Yuklanmagan shablon soni - null (0 emas).
    expectEqual(
      `${label}: TP qatoridagi qoidabuzarlik/murojaat soni null = yuklanmagan`,
      transformers.map((row) => [row.violations === null, row.appeals === null]),
      transformers.map(() => [!summary.violations.uploaded, !summary.appeals.uploaded]),
    );
  }
  if (scope.kind === "district" || scope.kind === "substation") {
    const feeders = await listFeeders(periodId, scope.kind === "substation" ? { substationId: scope.id } : {}, tx);
    expectEqual(`${label}: fiderlar soni = fider ro'yxati`, summary.counts.feeders, feeders.length);
  }
}

async function run(tx: Db) {
  const ids = await seed(tx);
  const [p1, p2, p3, p4] = ids.periods.map(toPeriodInfo);
  const S = (key: string): Scope => ({ kind: "substation", id: ids.substations[key] });
  const F = (key: string): Scope => ({ kind: "feeder", id: ids.feeders[key] });
  const T = (key: string): Scope => ({ kind: "transformer", id: ids.transformers[key] });
  const district: Scope = { kind: "district" };

  for (const [period, spec] of [
    [p1, MONTHS[0]],
    [p2, MONTHS[1]],
  ] as const) {
    const tag = period.key;

    // Tuman energiyasi = Σ podstansiyalar; foiz = Σ yo'qotish / Σ umumiy.
    const summary = await getScopeSummary(period.id, district, tx);
    const substations = await listSubstations(period.id, tx);
    expectEqual(`${tag} tuman: podstansiyalar soni`, summary.counts.substations, substations.length);
    expectEqual(`${tag} tuman: umumiy oqim`, summary.energy?.totalKwh, sumOf(substations, (row) => row.totalKwh));
    expectEqual(`${tag} tuman: foydali oqim`, summary.energy?.usefulKwh, sumOf(substations, (row) => row.usefulKwh));
    expectEqual(`${tag} tuman: yo'qotish`, summary.energy?.lossKwh, sumOf(substations, (row) => row.lossKwh));
    const sums = Object.values(spec.substations).reduce((acc, item) => [acc[0] + item.energy[0], acc[1] + item.energy[2]], [0, 0]);
    expectEqual(`${tag} tuman: yo'qotish foizi (vaznli)`, summary.energy?.lossPercent, lossPercent(sums[0], sums[1]));
    expectEqual(`${tag} tuman: fiderlar soni`, summary.counts.feeders, Object.keys(spec.feeders).length);
    expectEqual(`${tag} tuman: TP soni`, summary.counts.transformers, Object.keys(spec.transformers).length);
    expectEqual(
      `${tag} tuman: abonentlar (spec)`,
      summary.subscribers?.total,
      sumOf(Object.values(spec.transformers), (item) => item.subscribers.length),
    );
    expectEqual(`${tag} tuman: yuklanganlar`, [summary.subscriberList.uploaded, summary.violations.uploaded, summary.appeals.uploaded], [
      spec.uploads.includes("SUBSCRIBERS"),
      spec.uploads.includes("VIOLATIONS"),
      spec.uploads.includes("APPEALS"),
    ]);
    expectEqual(`${tag} tuman: uploads (FAILED hisobga olinmaydi)`, summary.uploads, uploadsOf(spec));
    await checkSummaryAgainstLists(tx, period.id, district, `${tag} tuman`, summary);

    // Podstansiyalar: o'z holati va qator sonlari.
    for (const row of substations) {
      const key = Object.keys(ids.substations).find((item) => ids.substations[item] === row.id)!;
      const scoped = await getScopeSummary(period.id, S(key), tx);
      expectEqual(`${tag} ${key}: energiya = qator`, scoped.energy, {
        totalKwh: row.totalKwh,
        usefulKwh: row.usefulKwh,
        lossKwh: row.lossKwh,
        lossPercent: row.lossPercent,
      });
      expectEqual(`${tag} ${key}: fiderlar soni = qator`, scoped.counts.feeders, row.feederCount);
      expectEqual(`${tag} ${key}: TP soni = qator`, scoped.counts.transformers, row.transformerCount);
      expectEqual(`${tag} ${key}: abonentlar = qator`, scoped.subscribers, row.subscribers);
      expectEqual(`${tag} ${key}: podstansiya soni`, scoped.counts.substations, 1);
      await checkSummaryAgainstLists(tx, period.id, S(key), `${tag} ${key}`, scoped);

      const detail = await getSubstation(row.id, period.id, tx);
      expectEqual(`${tag} ${key}: getSubstation energiya`, detail?.snapshot?.lossPercent, row.lossPercent);
      expectEqual(`${tag} ${key}: getSubstation staff`, detail?.snapshot?.staff, row.staff);
    }

    const feeders = await listFeeders(period.id, {}, tx);
    for (const row of feeders) {
      const key = Object.keys(ids.feeders).find((item) => ids.feeders[item] === row.id)!;
      const scoped = await getScopeSummary(period.id, F(key), tx);
      expectEqual(`${tag} ${key}: energiya = qator`, scoped.energy?.lossPercent, row.lossPercent);
      expectEqual(`${tag} ${key}: TP soni = qator`, scoped.counts.transformers, row.transformerCount);
      expectEqual(`${tag} ${key}: abonentlar = qator`, scoped.subscribers, row.subscribers);
      expectEqual(`${tag} ${key}: ota podstansiya`, row.substation.id, ids.substations[SUBSTATION_OF[key]]);
      await checkSummaryAgainstLists(tx, period.id, F(key), `${tag} ${key}`, scoped);
    }

    const transformers = await listTransformers(period.id, {}, tx);
    for (const row of transformers) {
      const key = Object.keys(ids.transformers).find((item) => ids.transformers[item] === row.id)!;
      const scoped = await getScopeSummary(period.id, T(key), tx);
      expectEqual(`${tag} ${key}: energiya`, scoped.energy?.totalKwh, row.totalKwh);
      expectEqual(`${tag} ${key}: abonentlar`, [scoped.subscribers?.online, scoped.subscribers?.offline], [
        row.onlineSubscribers,
        row.offlineSubscribers,
      ]);
      expectEqual(`${tag} ${key}: qarzdorlik`, scoped.subscriberList.debtUzs, row.debtUzs);
      expectEqual(`${tag} ${key}: sonlar`, scoped.counts, { substations: 1, feeders: 1, transformers: 1 });
      await checkSummaryAgainstLists(tx, period.id, T(key), `${tag} ${key}`, scoped);
      const detail = await getTransformer(row.id, period.id, tx);
      expectEqual(`${tag} ${key}: getTransformer`, [detail?.feeder.id, detail?.snapshot?.subscribers], [
        row.feeder.id,
        row.onlineSubscribers + row.offlineSubscribers,
      ]);
    }

    // Xodimlar: yig'indilar holatlar/yozuvlar bilan mos.
    const staff = await listStaffActivity(period.id, tx);
    const allTs = Object.values(spec.transformers);
    expectEqual(`${tag} xodimlar: TP`, staff.totals.transformers, allTs.filter((item) => item.staff).length);
    expectEqual(
      `${tag} xodimlar: abonentlar`,
      staff.totals.subscribers,
      sumOf(allTs, (item) => item.subscribers.filter((sub) => sub.staff).length),
    );
    expectEqual(`${tag} xodimlar: qoidabuzarliklar`, staff.totals.violations, spec.violations.filter((item) => item.staff).length);
    expectEqual(
      `${tag} xodimlar: zarar`,
      staff.totals.damageUzs,
      sumOf(spec.violations.filter((item) => item.staff), (item) => item.uzs),
    );
    expectEqual(
      `${tag} xodimlar: muddati buzilgan`,
      staff.totals.appealsOverdue,
      spec.appeals.filter((item) => item.staff && item.status === "OVERDUE").length,
    );
    expectEqual(`${tag} xodimlar: soni`, staff.totals.staff, staff.rows.length);
    expectEqual(`${tag} xodimlar: uploads`, staff.uploads, uploadsOf(spec));
  }

  // --- Faqat Podstansiyalar yuklangan oy (P3): "0" o'rniga null ---------------------
  {
    const spec = MONTHS[2];
    const summary = await getScopeSummary(p3.id, district, tx);
    expectEqual("P3 tuman: uploads", summary.uploads, uploadsOf(spec));
    expectEqual("P3 tuman: energiya = S1", summary.energy, {
      totalKwh: 12000,
      usefulKwh: 10000,
      lossKwh: 2000,
      lossPercent: lossPercent(12000, 2000),
    });
    expectEqual("P3 tuman: fider/TP soni null", summary.counts, { substations: 1, feeders: null, transformers: null });
    expectEqual("P3 tuman: TP abonentlari null", summary.subscribers, null);
    expectEqual(
      "P3 tuman: ro'yxat/qoidabuzarlik/murojaat yuklanmagan",
      [summary.subscriberList.uploaded, summary.violations.uploaded, summary.appeals.uploaded],
      [false, false, false],
    );
    const s1 = await getScopeSummary(p3.id, S("S1"), tx);
    expectEqual("P3 S1: sonlar", [s1.counts, s1.subscribers], [{ substations: 1, feeders: null, transformers: null }, null]);
    const f1 = await getScopeSummary(p3.id, F("F1"), tx);
    expectEqual("P3 F1: energiya yo'q, sonlar null", [f1.energy, f1.counts], [
      null,
      { substations: 1, feeders: null, transformers: null },
    ]);
    const substations = await listSubstations(p3.id, tx);
    expectEqual(
      "P3 podstansiyalar ro'yxati: fider/TP/abonent null",
      substations.map((row) => [row.id, row.feederCount, row.transformerCount, row.subscribers]),
      [[ids.substations.S1, null, null, null]],
    );
    expectEqual("P3 fiderlar/TP ro'yxati bo'sh", [(await listFeeders(p3.id, {}, tx)).length, (await listTransformers(p3.id, {}, tx)).length], [0, 0]);
    const subscribers = await listSubscribers(p3.id, { take: 10 }, tx);
    expectEqual("P3 abonentlar: yuklanmagan", [subscribers.uploaded, subscribers.total], [false, 0]);
    expectEqual("P3 qoidabuzarlik/murojaat: yuklanmagan", [
      (await listViolations(p3.id, {}, tx)).uploaded,
      (await listAppeals(p3.id, {}, tx)).uploaded,
    ], [false, false]);
    const staff = await listStaffActivity(p3.id, tx);
    expectEqual("P3 xodimlar: faqat podstansiya", [staff.uploads, staff.totals.substations, staff.totals.transformers], [
      uploadsOf(spec),
      1,
      0,
    ]);

    // P2 da fider/TP bor, lekin abonent yo'q ro'yxat qatori - null emas, son.
    const p2Feeders = await listFeeders(p2.id, {}, tx);
    expectTrue("P2 fider qatorlari: sonlar null emas", p2Feeders.every((row) => row.transformerCount !== null && row.subscribers !== null));

    const comparison = await getScopeComparison(district, p3, tx);
    expectEqual("P3 taqqoslash: o'tgan davr = P2", comparison.previousPeriod?.id, p2.id);
    expectEqual("P3 taqqoslash: joriy abonentlar null, o'tgan oy son", [comparison.current.subscribers, comparison.previous?.subscribers?.total], [
      null,
      sumOf(Object.values(MONTHS[1].transformers), (item) => item.subscribers.length),
    ]);
  }

  // --- Qismli yuklash (P4): shablon faqat ayrim podstansiyalarni qamraydi ------------
  {
    const summary = await getScopeSummary(p4.id, district, tx);
    expectEqual("P4 tuman: uploads oy darajasida", summary.uploads, uploadsOf(MONTHS[3]));
    expectEqual("P4 tuman: sonlar", summary.counts, { substations: 2, feeders: 1, transformers: 1 });
    expectEqual("P4 tuman: abonentlar = S1 ro'yxati + S2 TP holati", summary.subscribers, { total: 9, online: 6, offline: 3 });
    expectEqual("P4 tuman: ro'yxat faqat S1", [summary.subscriberList.uploaded, summary.subscriberList.total], [true, 2]);

    const coverageOf = (item: ScopeSummary) => [item.uploads.FEEDERS, item.uploads.TRANSFORMERS, item.uploads.SUBSCRIBERS];
    const s1 = await getScopeSummary(p4.id, S("S1"), tx);
    const s2 = await getScopeSummary(p4.id, S("S2"), tx);
    expectEqual("P4 S1: qamrov (fider, TP, ro'yxat)", coverageOf(s1), [true, false, true]);
    expectEqual("P4 S2: qamrov (fider, TP, ro'yxat)", coverageOf(s2), [false, true, false]);
    expectEqual("P4 S1: sonlar", [s1.counts, s1.subscribers], [
      { substations: 1, feeders: 1, transformers: null },
      { total: 2, online: 1, offline: 1 },
    ]);
    expectEqual("P4 S2: sonlar", [s2.counts, s2.subscribers], [
      { substations: 1, feeders: null, transformers: 1 },
      { total: 7, online: 5, offline: 2 },
    ]);
    expectEqual("P4 S2: ro'yxat qamramagan", [s2.subscriberList.uploaded, s2.subscriberList.total], [false, 0]);

    const substations = await listSubstations(p4.id, tx);
    expectEqual(
      "P4 podstansiyalar ro'yxati = qamrov xulosasi",
      substations.map((row) => [row.id, row.feederCount, row.transformerCount, row.subscribers]),
      [
        [ids.substations.S1, s1.counts.feeders, s1.counts.transformers, s1.subscribers],
        [ids.substations.S2, s2.counts.feeders, s2.counts.transformers, s2.subscribers],
      ],
    );
    expectEqual(
      "P4 podstansiyalar abonentlari yig'indisi = tuman",
      sumOf(substations, (row) => row.subscribers?.total ?? 0),
      summary.subscribers?.total,
    );

    const f1 = await getScopeSummary(p4.id, F("F1"), tx);
    const feeders = await listFeeders(p4.id, {}, tx);
    expectEqual(
      "P4 F1 qatori = xulosa",
      feeders.map((row) => [row.id, row.transformerCount, row.subscribers]),
      [[ids.feeders.F1, f1.counts.transformers, f1.subscribers]],
    );
    expectEqual("P4 F1: TP null, abonentlar ro'yxatdan", [f1.counts.transformers, f1.subscribers?.total], [null, 2]);
    const f3 = await getScopeSummary(p4.id, F("F3"), tx);
    expectEqual("P4 F3: fider holati yo'q, abonentlar TP holatidan", [f3.energy, f3.uploads.FEEDERS, f3.subscribers?.total], [
      null,
      false,
      7,
    ]);

    const t4 = await getScopeSummary(p4.id, T("T4"), tx);
    const transformers = await listTransformers(p4.id, {}, tx);
    expectEqual(
      "P4 TP qatori: ro'yxat qamramagan - TP holatidagi sonlar, qarzdorlik null",
      transformers.map((row) => [row.id, row.onlineSubscribers, row.offlineSubscribers, row.debtUzs]),
      [[ids.transformers.T4, 5, 2, null]],
    );
    expectEqual("P4 T4 xulosa = qator", [t4.subscribers, t4.counts], [
      { total: 7, online: 5, offline: 2 },
      { substations: 1, feeders: null, transformers: 1 },
    ]);

    expectEqual(
      "P4 abonentlar ro'yxati: yuklangan qamrov bo'yicha (tuman, S1, S2, T4)",
      [
        (await listSubscribers(p4.id, { take: 10 }, tx)).uploaded,
        (await listSubscribers(p4.id, { scope: S("S1"), take: 10 }, tx)).uploaded,
        (await listSubscribers(p4.id, { scope: S("S2"), take: 10 }, tx)).uploaded,
        (await listSubscribers(p4.id, { scope: T("T4"), take: 10 }, tx)).uploaded,
      ],
      [true, true, false, false],
    );

    const series = await getScopeSeries(district, [p3, p4], tx);
    expectEqual("P4 dinamika: tuman abonentlari va qarzdorlik", series.map((point) => [point.subscribers, point.debtUzs]), [
      [null, null],
      [9, 300],
    ]);
    for (const [label, scope] of [
      ["S1", S("S1")],
      ["S2", S("S2")],
      ["F1", F("F1")],
      ["F3", F("F3")],
      ["T4", T("T4")],
    ] as const) {
      const [point] = await getScopeSeries(scope, [p4], tx);
      const scoped = await getScopeSummary(p4.id, scope, tx);
      expectEqual(`P4 dinamika ${label} = xulosa`, [point.subscribers, point.debtUzs], [
        scoped.subscribers?.total ?? null,
        scoped.subscriberList.uploaded ? scoped.subscriberList.debtUzs : null,
      ]);
    }
  }

  // --- Abonentlar ro'yxati: filtrlar, chiplar, qidiruv, sahifalash -----------
  {
    const all = await listSubscribers(p2.id, { take: 500 }, tx);
    expectEqual("P2 abonentlar: all = total (filtrsiz)", all.counts.all, all.total);
    for (const kind of ["HOUSEHOLD", "LEGAL"] as const) {
      const filtered = await listSubscribers(p2.id, { kind, take: 500 }, tx);
      expectEqual(`P2 abonentlar: kind=${kind} total = chip`, filtered.total, all.counts.byKind[kind]);
      expectEqual(`P2 abonentlar: kind=${kind} qatorlar`, filtered.rows.length, filtered.total);
      expectTrue(`P2 abonentlar: kind=${kind} faqat shu tur`, filtered.rows.every((row) => row.kind === kind));
    }
    const debtors = await listSubscribers(p2.id, { debtorsOnly: true, kind: "HOUSEHOLD", take: 500 }, tx);
    expectEqual("P2 qarzdor aholi: total = qatorlar", debtors.total, debtors.rows.length);
    expectEqual("P2 qarzdor aholi: debtors chip = total", debtors.counts.debtors, debtors.total);
    expectEqual("P2 qarzdor aholi: byKind.HOUSEHOLD = total", debtors.counts.byKind.HOUSEHOLD, debtors.total);
    expectEqual("P2 qarzdor aholi: all tur/qarzdorlik filtrisiz", debtors.counts.all, all.total);
    const byStatusSum = Object.values(debtors.counts.byStatus).reduce((a, b) => a + b, 0);
    expectEqual("P2 qarzdor aholi: byStatus yig'indisi = total", byStatusSum, debtors.total);

    const page1 = await listSubscribers(p2.id, { take: 2, skip: 0, sort: "debt" }, tx);
    const page2 = await listSubscribers(p2.id, { take: 2, skip: 2, sort: "debt" }, tx);
    const page3 = await listSubscribers(p2.id, { take: 2, skip: 4, sort: "debt" }, tx);
    const paged = [...page1.rows, ...page2.rows, ...page3.rows];
    expectEqual("P2 sahifalash: jami qatorlar", paged.length, all.total);
    expectEqual("P2 sahifalash: takrorsiz", new Set(paged.map((row) => row.id)).size, all.total);
    expectTrue(
      "P2 sort=debt kamayish tartibida",
      paged.every((row, index) => index === 0 || paged[index - 1].debtUzs >= row.debtUzs),
    );

    const apostrophe = await listSubscribers(p2.id, { q: "o'rinboy", take: 10 }, tx);
    expectEqual("qidiruv: apostrof farq qilmaydi", apostrophe.rows.map((row) => row.contractNumber.startsWith("AB 104 512")), [true]);
    const contract = await listSubscribers(p2.id, { q: "ab104", take: 10 }, tx);
    expectEqual("qidiruv: shartnoma raqami bo'shliqsiz", contract.total, 1);
    const address = await listSubscribers(p2.id, { q: "CHINOBOD KO`CHASI", take: 10 }, tx);
    expectEqual("qidiruv: manzil", address.total, 1);
    const serial = await listSubscribers(p2.id, { q: "sn-777", take: 10 }, tx);
    expectEqual("qidiruv: hisoblagich raqami", serial.total, 1);
    const wildcard = await listSubscribers(p2.id, { q: "%", take: 10 }, tx);
    expectEqual("qidiruv: % belgisi wildcard emas", wildcard.total, 0);
    expectEqual("qidiruv: counts.all qidiruvga bog'liq", apostrophe.counts.all, 1);
    const rowKeys = Object.keys(all.rows[0] ?? {});
    expectTrue("abonent qatorida passport/pinfl yo'q", !rowKeys.includes("passport") && !rowKeys.includes("pinfl"));
  }

  // --- Qoidabuzarlik / murojaat filtrlari ---------------------------------------
  {
    const all = await listViolations(p2.id, {}, tx);
    const individual = await listViolations(p2.id, { type: "INDIVIDUAL" }, tx);
    expectEqual("qoidabuzarlik: tur filtri = chip", individual.totals.total, all.totals.byType.INDIVIDUAL);
    expectEqual("qoidabuzarlik: byType tur filtrisiz", individual.totals.byType, all.totals.byType);
    expectEqual("qoidabuzarlik: zarar filtrdan keyin", individual.totals.damageUzs, 30000);
    const searched = await listViolations(p2.id, { q: "nur" }, tx);
    expectEqual("qoidabuzarlik: qidiruv", searched.totals.total, 1);
    const linked = all.rows.filter((row) => row.subscriber).map((row) => row.subscriber!.id);
    expectEqual("qoidabuzarlik: abonent bog'lanishi", linked, [ids.subscribers.C5]);
    const overdue = await listAppeals(p2.id, { status: "OVERDUE" }, tx);
    expectEqual("murojaat: holat filtri", overdue.totals.total, 1);
    expectEqual("murojaat: byStatus holat filtrisiz", overdue.totals.byStatus, { RESOLVED: 1, REJECTED: 1, IN_PROGRESS: 1, OVERDUE: 1 });
  }

  // --- Dinamika: har bir nuqta = shu oy xulosasi --------------------------------
  const scopes: [string, Scope][] = [
    ["tuman", district],
    ["S1", S("S1")],
    ["S2", S("S2")],
    ["F1", F("F1")],
    ["F2", F("F2")],
    ["F3", F("F3")],
    ["T1", T("T1")],
    ["T3", T("T3")],
    ["T4", T("T4")],
  ];
  const allPeriods = [p1, p2, p3];
  for (const [label, scope] of scopes) {
    const series = await getScopeSeries(scope, allPeriods, tx);
    expectEqual(`dinamika ${label}: nuqtalar tartibi`, series.map((point) => point.key), allPeriods.map((period) => period.key));
    expectEqual(`dinamika ${label}: qisqa oy nomlari`, series.map((point) => point.label), ["Mar", "Apr", "May"]);
    for (const [index, period] of allPeriods.entries()) {
      const point = series[index];
      const summary = await getScopeSummary(period.id, scope, tx);
      expectEqual(`dinamika ${label} ${period.key}: = xulosa`, point, {
        periodId: period.id,
        key: period.key,
        label: monthShort(period.month),
        fullLabel: period.label,
        hasData: summary.energy !== null,
        totalKwh: summary.energy?.totalKwh ?? null,
        usefulKwh: summary.energy?.usefulKwh ?? null,
        lossKwh: summary.energy?.lossKwh ?? null,
        lossPercent: summary.energy?.lossPercent ?? null,
        subscribers: summary.subscribers?.total ?? null,
        debtUzs: summary.subscriberList.uploaded ? summary.subscriberList.debtUzs : null,
        violations: summary.violations.uploaded ? summary.violations.total : null,
        damageUzs: summary.violations.uploaded ? summary.violations.damageUzs : null,
        appeals: summary.appeals.uploaded ? summary.appeals.total : null,
      });
    }
  }
  const f2Series = await getScopeSeries(F("F2"), [p1, p2], tx);
  expectEqual("dinamika F2: P2 da holat yo'q", f2Series.map((point) => point.hasData), [true, false]);
  const districtSeries = await getScopeSeries(district, allPeriods, tx);
  expectEqual("dinamika: P1 murojaatlar yuklanmagan (FAILED hisobga olinmaydi)", districtSeries[0].appeals, null);
  expectEqual(
    "dinamika: P3 faqat podstansiyalar - energiya bor, abonentlar null (0 ga tushmaydi)",
    districtSeries.map((point) => [point.key, point.hasData, point.subscribers, point.debtUzs]),
    [
      [p1.key, true, 6, 4200.5],
      [p2.key, true, 6, 4400],
      [p3.key, true, null, null],
    ],
  );
  expectEqual("dinamika: bo'sh davrlar ro'yxati", await getScopeSeries(district, [], tx), []);

  // --- O'tgan oy ------------------------------------------------------------------
  {
    const comparison = await getScopeComparison(S("S1"), p2, tx);
    expectEqual("taqqoslash: o'tgan davr = P1", comparison.previousPeriod?.id, p1.id);
    expectEqual("taqqoslash: previous = P1 xulosasi", comparison.previous, await getScopeSummary(p1.id, S("S1"), tx));
    expectEqual("taqqoslash: current = P2 xulosasi", comparison.current, await getScopeSummary(p2.id, S("S1"), tx));
    const first = await getScopeComparison(district, p1, tx);
    expectEqual("taqqoslash: P1 dan oldingi oy yo'q", [first.previousPeriod, first.previous], [null, null]);
  }

  // --- Ta'mir ishlari ---------------------------------------------------------------
  {
    const repairs = await listRepairs(p2.id, undefined, tx);
    expectEqual("ta'mir: bajarilgan / rejalashtirilgan", repairs.counts, { done: 2, planned: 2 });
    expectEqual(
      "ta'mir: sana tartibi va holat",
      repairs.rows.map((row) => [row.transformer.id, row.type, row.done]),
      [
        [ids.transformers.T1, "CURRENT", true],
        [ids.transformers.T4, "CURRENT", true],
        [ids.transformers.T2, "OVERHAUL", false],
        [ids.transformers.T1, "OVERHAUL", false],
      ],
    );
    expectEqual("ta'mir: yorliqlar", repairs.rows.map((row) => row.label).slice(1, 3), ["Joriy ta’mir", "To’la ta’mir"]);
    const f3 = await listRepairs(p2.id, F("F3"), tx);
    expectEqual("ta'mir: qamrov filtri", f3.rows.map((row) => row.transformer.id), [ids.transformers.T4]);
    const p1Repairs = await listRepairs(p1.id, undefined, tx);
    expectEqual("ta'mir: P1", p1Repairs.counts, { done: 1, planned: 0 });
  }

  // --- Obyekt sahifalari --------------------------------------------------------------
  {
    const feeder = await getFeeder(ids.feeders.F2, p2.id, tx);
    expectEqual("getFeeder: P2 da holat yo'q", [feeder?.name.startsWith("F2"), feeder?.snapshot], [true, null]);
    expectEqual("getFeeder: noma'lum id", await getFeeder("missing-id", p2.id, tx), null);
    const f3 = await getFeeder(ids.feeders.F3, p2.id, tx);
    expectEqual("getFeeder: F3 energiya", f3?.snapshot?.totalKwh, 4700.75);
    const transformer = await getTransformer(ids.transformers.T1, p2.id, tx);
    expectEqual("getTransformer: ta'mir sanalari", [transformer?.snapshot?.currentRepairDate, transformer?.snapshot?.overhaulDate], [
      day(4, 1).toISOString(),
      day(5, 20).toISOString(),
    ]);
    expectEqual("getSubstation: koordinata", [(await getSubstation(ids.substations.S1, p2.id, tx))?.snapshot?.lat], [41.3]);

    const c7 = await getSubscriber(ids.subscribers.C7, p2.id, tx);
    expectEqual("getSubscriber: P2 da holat yo'q, nom so'nggi holatdan", [c7?.snapshot, c7?.fullName, c7?.sourcePeriodKey], [
      null,
      "Aziza Qodirova",
      p1.key,
    ]);
    const c4 = await getSubscriber(ids.subscribers.C4, p2.id, tx);
    expectEqual("getSubscriber: TP almashgan (P2 = T2)", [c4?.transformer.id, c4?.substation.id], [
      ids.transformers.T2,
      ids.substations.S1,
    ]);
    const c4InP1 = await getSubscriber(ids.subscribers.C4, p1.id, tx);
    expectEqual("getSubscriber: P1 holati (T3), keyingi oy emas", [c4InP1?.transformer.id, c4InP1?.feeder.id, c4InP1?.sourcePeriodKey], [
      ids.transformers.T3,
      ids.feeders.F2,
      p1.key,
    ]);
    const c4InP3 = await getSubscriber(ids.subscribers.C4, p3.id, tx);
    expectEqual(
      "getSubscriber: P3 da holat yo'q - oldingi eng so'nggi (P2, T2), P1 emas",
      [c4InP3?.snapshot, c4InP3?.sourcePeriodKey, c4InP3?.transformer.id],
      [null, p2.key, ids.transformers.T2],
    );
    const c6InP1 = await getSubscriber(ids.subscribers.C6, p1.id, tx);
    expectEqual(
      "getSubscriber: tanlangan oy birinchi holatdan oldin - keyingi eng birinchi holat",
      [c6InP1?.snapshot, c6InP1?.sourcePeriodKey, c6InP1?.fullName, c6InP1?.transformer.id],
      [null, p2.key, "Jasur Ergashev", ids.transformers.T1],
    );

    // Xom SQL (listSubscribers) va Prisma model (getSubscriber) yo'llari bir xil qiymat beradi.
    const p2List = await listSubscribers(p2.id, { take: 500 }, tx);
    for (const row of p2List.rows) {
      const detail = await getSubscriber(row.id, p2.id, tx);
      const snap = detail?.snapshot;
      expectEqual(`abonent ${row.fullName}: ro'yxat qatori = getSubscriber`, row, {
        id: detail?.id,
        contractNumber: detail?.contractNumber,
        fullName: snap?.fullName,
        kind: snap?.kind,
        meterStatus: snap?.meterStatus,
        transformer: detail?.transformer,
        feeder: detail?.feeder,
        substation: detail?.substation,
        meterSerial: snap?.meterSerial,
        meterReading: snap?.meterReading,
        lastReadingAt: snap?.lastReadingAt,
        debtUzs: snap?.debtUzs,
        creditUzs: snap?.creditUzs,
        address: snap?.address,
        staff: snap?.staff,
      });
    }
    const c1Row = p2List.rows.find((row) => row.id === ids.subscribers["AB 104 512"]);
    const c2Row = p2List.rows.find((row) => row.id === ids.subscribers.C2);
    expectEqual("ro'yxat: lastReadingAt millisekundi bilan", [c1Row?.lastReadingAt, c2Row?.lastReadingAt], [
      moment(4, 12).toISOString(),
      new Date(Date.UTC(YEAR, 3, 1, 23, 59, 59, 999)).toISOString(),
    ]);
    const c1 = await getSubscriber(ids.subscribers["AB 104 512"], p2.id, tx);
    const snapshotKeys = Object.keys(c1?.snapshot ?? {});
    expectTrue("getSubscriber: passport/pinfl yo'q", !snapshotKeys.includes("passport") && !snapshotKeys.includes("pinfl"));
    expectEqual("getSubscriber: qarzdorlik", c1?.snapshot?.debtUzs, 800);
    expectEqual(
      "getSubscriber: sanalar va to'lov",
      [c1?.snapshot?.lastReadingAt, c1?.snapshot?.lastPaymentDate, c1?.snapshot?.lastPaymentUzs, c1?.snapshot?.contractDate],
      [moment(4, 12).toISOString(), day(4, 2).toISOString(), 150000.5, day(1, 15).toISOString()],
    );
    expectEqual("getSubscriber: noma'lum id", await getSubscriber("missing-id", p2.id, tx), null);

    const history = await getSubscriberHistory(ids.subscribers["AB 104 512"], tx);
    expectEqual("tarix: ko'rsatkich farqi", history.map((point) => [point.key, point.meterReading, point.readingDiff]), [
      [p1.key, 100, null],
      [p2.key, 130, 30],
    ]);
    expectEqual(
      "tarix: sanalar va qisqa oy nomi",
      history.map((point) => [point.shortLabel, point.lastReadingAt, point.lastPaymentDate, point.lastPaymentUzs]),
      [
        ["Mar", moment(3, 12).toISOString(), day(3, 2).toISOString(), 150000.5],
        ["Apr", moment(4, 12).toISOString(), day(4, 2).toISOString(), 150000.5],
      ],
    );
    const c5 = await getSubscriberHistory(ids.subscribers.C5, tx);
    expectEqual("tarix: bo'sh ko'rsatkichda farq null", c5.map((point) => point.readingDiff), [null, null]);
    const c4History = await getSubscriberHistory(ids.subscribers.C4, tx);
    expectEqual("tarix: TP almashishi", c4History.map((point) => point.transformer.id), [ids.transformers.T3, ids.transformers.T2]);
  }

  // --- Abonent sahifasi: yashirilgan raqamlar, oylar bo'yicha sonlar, manba, rasmlar ---
  {
    const c1Id = ids.subscribers["AB 104 512"];
    const c1 = await getSubscriber(c1Id, p2.id, tx);
    expectEqual("abonent: passport va PINFL qisman yashirilgan", [c1?.snapshot?.maskedPassport, c1?.snapshot?.maskedPinfl], [
      "AA*****67",
      "1***********34",
    ]);
    const c1Json = JSON.stringify(c1);
    expectTrue("abonent: to'liq passport/PINFL natijada yo'q", !c1Json.includes("1234567") && !c1Json.includes("12345678901234"));
    expectEqual(
      "maskIdentifier: manbada yashirilgan, bo'sh, qisqa",
      [maskIdentifier("AB*", 2, 2), maskIdentifier("  ", 2, 2), maskIdentifier("AB12", 2, 2), maskIdentifier("123456789", 2, 0)],
      ["AB*", null, "****", "12*******"],
    );

    expectEqual(
      "sanalar farqi: kun (vaqt qismi hisobga olinmaydi), to'liq oylar",
      [
        daysBetween("2026-09-08T00:00:00Z", "2026-09-10T00:00:00Z"),
        daysBetween("2026-09-08T23:59:59Z", "2026-09-10T00:00:00Z"),
        daysBetween("2026-09-12", "2026-09-10"),
        monthsBetween("2020-09-20", "2026-09-10"),
        monthsBetween("2026-09-10", "2020-09-20"),
        durationText(monthsBetween("2020-09-20", "2026-09-10")),
        durationText(0),
        daysBeforeReport(daysBetween("2020-12-18", "2026-09-10"), monthsBetween("2020-12-18", "2026-09-10")),
        daysBeforeReport(daysBetween("2026-09-08", "2026-09-10"), monthsBetween("2026-09-08", "2026-09-10")),
        daysBeforeReport(0),
      ],
      [2, 2, -2, 71, null, "5 yil 11 oy", "1 oydan kam", "5 yil 8 oy oldin", "2 kun oldin", "hisobot kuni"],
    );

    // Oylar bo'yicha sonlar = shu oy ro'yxati (sahifadagi jadval) uzunligi; yuklanmagan - null.
    const events = await getSubscriberEventSeries(c1Id, [p1.id, p2.id, p3.id], tx);
    const expectedEvents = [];
    for (const period of [p1, p2, p3]) {
      const related = await getSubscriberRelated(c1Id, period.id, tx);
      expectedEvents.push({
        periodId: period.id,
        violations: related.violations.uploaded ? related.violations.rows.length : null,
        appeals: related.appeals.uploaded ? related.appeals.rows.length : null,
      });
    }
    expectEqual("abonent: oylar bo'yicha qoidabuzarlik/murojaat = ro'yxat", events, expectedEvents);
    expectEqual("abonent: P1 da 1 ta qoidabuzarlik, murojaatlar yuklanmagan", [events[0].violations, events[0].appeals], [1, null]);

    // Manba: faqat ruxsat etilgan "(manba)" ustunlari, tozalangan qiymatga teng bo'lsa - ko'rsatilmaydi.
    await tx.subscriberSnapshot.update({
      where: { periodId_subscriberId: { periodId: p2.id, subscriberId: c1Id } },
      data: {
        sourceRow: {
          FISH: "O‘rinboy Aliyev",
          "FISH (manba)": " O'RINBOY  ALIYEV ",
          Manzil: "Chinobod ko‘chasi 5",
          "Manzil (manba)": "Chinobod ko‘chasi 5",
          Passport: "AA1234567",
          "Passport (manba)": "AA 1234567",
          "Manba (fayl, qator)": "baliqchi/Elektr Abonentlar.xlsx, 12-qator",
          Eslatma: "Sinov izohi",
        },
      },
    });
    const source = await getSubscriberSource(c1Id, p2.id, tx);
    expectEqual("abonent manbasi", source, {
      upload: null,
      rowNumber: source?.rowNumber,
      origin: "baliqchi/Elektr Abonentlar.xlsx, 12-qator",
      note: "Sinov izohi",
      originals: [{ label: "FISH", value: "O'RINBOY  ALIYEV" }],
    });
    expectTrue("abonent manbasi: passport chiqmaydi", !JSON.stringify(source).includes("1234567"));
    expectEqual("abonent manbasi: holat yo'q oy - null", await getSubscriberSource(c1Id, p3.id, tx), null);

    // Rasmlar: saqlash, almashtirish, o'qish, o'chirish.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expectEqual(
      "rasm turi baytlardan",
      [detectPhotoType(png), detectPhotoType(webp), detectPhotoType(new TextEncoder().encode("GIF89a")), detectPhotoType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))],
      ["image/png", "image/webp", null, "image/jpeg"],
    );
    expectEqual("rasm: noma'lum segment", [photoKindFromSegment("meter"), photoKindFromSegment("passport")], ["METER", null]);
    expectEqual("rasm: abonent topilmasa - null", await saveSubscriberPhoto("missing-id", "METER", "image/png", png, tx), null);
    const saved = await saveSubscriberPhoto(c1Id, "METER", "image/png", png, tx);
    expectTrue("rasm: versiyali manzil", saved?.url.startsWith(photoUrl(c1Id, "METER") + "?v=") === true);
    await saveSubscriberPhoto(c1Id, "METER", "image/webp", webp, tx);
    const stored = await readSubscriberPhoto(c1Id, "METER", tx);
    expectEqual("rasm: qayta yuklash almashtiradi", [stored?.mimeType, stored?.size, Array.from(stored?.data ?? [])], [
      "image/webp",
      webp.byteLength,
      Array.from(webp),
    ]);
    expectEqual("rasm: har turdan bitta", await tx.subscriberPhoto.count({ where: { subscriberId: c1Id } }), 1);
    const photos = await getSubscriberPhotos(c1Id, tx);
    expectEqual("rasm: ro'yxat", [photos.SUBSCRIBER, photos.METER?.size], [null, webp.byteLength]);
    expectEqual("rasm: o'chirish", [await deleteSubscriberPhoto(c1Id, "METER", tx), await deleteSubscriberPhoto(c1Id, "METER", tx)], [
      true,
      false,
    ]);
    expectEqual("rasm: o'chirilgach yo'q", await getSubscriberPhotos(c1Id, tx), { SUBSCRIBER: null, METER: null });
  }

  // --- Noma'lum qamrov --------------------------------------------------------------
  {
    const missing = await getScopeSummary(p2.id, { kind: "feeder", id: "missing-id" }, tx);
    expectEqual("noma'lum qamrov: bo'sh, sonlar null", [missing.energy, missing.counts, missing.subscribers], [
      null,
      { substations: null, feeders: null, transformers: null },
      null,
    ]);
  }

  // Natija serializable bo'lishi kerak (Decimal / Date yo'q).
  const c1Detail = await getSubscriber(ids.subscribers["AB 104 512"], p2.id, tx);
  expectTrue(
    "JSON tekshiruvida sanalar null emas",
    c1Detail?.snapshot?.lastReadingAt != null && c1Detail.snapshot.lastPaymentDate != null && c1Detail.snapshot.contractDate != null,
  );
  const serializable = [
    await getScopeSummary(p2.id, district, tx),
    await listSubstations(p2.id, tx),
    await listTransformers(p2.id, {}, tx),
    await getSubscriber(ids.subscribers.C4, p2.id, tx),
    c1Detail,
    await getSubscriberHistory(ids.subscribers["AB 104 512"], tx),
    await listSubscribers(p2.id, { take: 5, sort: "debt" }, tx),
    await listViolations(p2.id, {}, tx),
    await getScopeSeries(district, allPeriods, tx),
    await listSubstations(p3.id, tx),
    await getSubscriberSource(ids.subscribers["AB 104 512"], p2.id, tx),
    await getSubscriberEventSeries(ids.subscribers["AB 104 512"], [p1.id, p2.id], tx),
    await getSubscriberPhotos(ids.subscribers["AB 104 512"], tx),
  ];
  const roundTrip = JSON.parse(JSON.stringify(serializable));
  expectEqual("natijalar JSON orqali o'zgarmaydi", roundTrip, serializable);
  const hasObject = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(hasObject);
    if (value == null || typeof value !== "object") return false;
    return Object.getPrototypeOf(value) !== Object.prototype || Object.values(value).some(hasObject);
  };
  expectTrue("natijalarda Date/Decimal/klass obyekt yo'q", !hasObject(serializable));

  return ids;
}

/*
 * `scope.ts` dagi "yuklangan" / "o'tgan oy" / `toPeriodInfo` va
 * `src/lib/period.ts` dagi `getPeriodUploads` / `getPreviousPeriod` /
 * `listPeriods` bir xil natija berishi - tranzaksiyadan TASHQARIDA, bazadagi
 * haqiqiy davrlarda (period.ts faqat asosiy klient bilan ishlaydi). Faqat
 * o'qiladi. Qaytaradi: solishtirilgan davrlar soni.
 */
async function checkAgainstPeriodModule(): Promise<number> {
  const [fromModule, rows] = await Promise.all([
    listPeriods(),
    prisma.period.findMany({ orderBy: { month: "desc" }, select: { id: true, month: true, reportDate: true } }),
  ]);
  expectEqual("period.ts: listPeriods = toPeriodInfo", fromModule, rows.map(toPeriodInfo));
  const many = await uploadsMany(
    fromModule.map((period) => period.id),
    prisma,
  );
  for (const period of fromModule) {
    const expected = await getPeriodUploads(period.id);
    expectEqual(`period.ts ${period.key}: uploadsMany = getPeriodUploads`, many.get(period.id), expected);
    expectEqual(`period.ts ${period.key}: periodUploads = getPeriodUploads`, await periodUploads(period.id), expected);
    expectEqual(
      `period.ts ${period.key}: previousPeriodOf = getPreviousPeriod`,
      await previousPeriodOf(period),
      await getPreviousPeriod(period),
    );
  }
  // Bazada yo'q oy uchun ham ikkalasi null.
  const probe = toPeriodInfo({ id: "probe", month: new Date(Date.UTC(1800, 0, 1)), reportDate: new Date(Date.UTC(1800, 0, 1)) });
  expectEqual("period.ts: bazada yo'q oy - ikkalasi null", [await previousPeriodOf(probe), await getPreviousPeriod(probe)], [null, null]);
  expectEqual("period.ts: noma'lum davr id - hech narsa yuklanmagan", await periodUploads("missing-id"), await getPeriodUploads("missing-id"));
  return fromModule.length;
}

async function main() {
  const started = Date.now();
  let seededMonth: Date | null = null;
  try {
    await prisma.$transaction(
      async (tx) => {
        const ids = await run(tx);
        seededMonth = ids.periods[0].month;
        throw new Rollback("rollback");
      },
      { timeout: 120_000, maxWait: 30_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }

  // Tranzaksiya bekor qilinganini tekshirish.
  const leftover = seededMonth ? await prisma.period.findUnique({ where: { month: seededMonth } }) : null;
  expectTrue("tranzaksiya bekor qilindi (bazada test davri qolmadi)", seededMonth !== null && leftover === null);

  const compared = await checkAgainstPeriodModule();

  console.log(
    `\n${passed} ta tekshiruv o'tdi, ${failures.length} ta xato (${Date.now() - started} ms; ` +
      `period.ts bilan moslik: bazadagi ${compared} ta davr)`,
  );
  for (const failure of failures) console.log(`  x ${failure}`);
  await prisma.$disconnect();
  process.exitCode = failures.length > 0 ? 1 : 0;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
