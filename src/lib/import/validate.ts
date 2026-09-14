import type { Prisma, PrismaClient, TemplateType } from "@/generated/prisma";
import { TEMPLATE_LABEL, TEMPLATE_ORDER } from "@/lib/domain/labels";
import { contractKey, nameKey } from "@/lib/domain/normalize";
import { dec, monthKey, monthLabel } from "@/lib/format";

import type { ImportFileInput, ParsedFile, ParsedRecord } from "./workbook";
import { parseWorkbook } from "./workbook";
import {
  type AppealRow,
  feederKey,
  type FeederRow,
  KEY_SEP,
  type SubscriberRow,
  substationKey,
  type SubstationRow,
  TEMPLATES,
  transformerKey,
  type TransformerRow,
  type ViolationRow,
} from "./templates";
import type { ImportFileReport, ImportMode, ImportResult } from "./types";

/*
 * Submission (1..6 fayl) tekshiruvi. Qoidalar: `.claude/docs/malumotlar.md`
 * 4.2-4.6. Bazaga faqat O'QISH uchun murojaat qiladi - `commit.ts` shu
 * funksiyani tranzaksiya ichida qayta chaqiradi.
 */

/** Oddiy klient yoki tranzaksiya klienti. */
export type Db = PrismaClient | Prisma.TransactionClient;

/* ---------------------------------------------------------------------------
   Oy holati (tabiiy kalitlar bo'yicha)
   --------------------------------------------------------------------------- */

interface SubstationState {
  name: string;
}

interface FeederState {
  substationKey: string;
  substationName: string;
  name: string;
}

interface TransformerState {
  feederKey: string;
  substationName: string;
  feederName: string;
  name: string;
  /** Faqat TP nomi kaliti - qoidabuzarlik/murojaat "TP Nomi" bo'yicha qidiriladi. */
  nameKey: string;
  onlineSubscribers: number;
  offlineSubscribers: number;
  /** Fayldan kelgan bo'lsa - Excel qatori. */
  row: number | null;
}

interface SubscriberState {
  transformerKey: string;
  online: boolean;
  fullNameKey: string;
}

/** TP kaliti bo'yicha ko'rsatish nomlari (holati bo'lmagan TP lar uchun ham). */
interface TpInfo {
  substationName: string;
  feederName: string;
  name: string;
}

/**
 * Bitta hisobot oyining holati. Avval bazadan o'qiladi, keyin submission
 * ichidagi fayllar tartib bilan ustiga yoziladi (keyingi fayl oldingisining
 * natijasini "bazada bor" deb ko'radi).
 */
interface MonthState {
  month: Date;
  label: string;
  substations: Map<string, SubstationState>;
  feeders: Map<string, FeederState>;
  transformers: Map<string, TransformerState>;
  subscribers: Map<string, SubscriberState>;
  /** TP kaliti -> nomlar: TP holatlari, abonentlar va hodisalar bog'langan TP lar. */
  tpInfo: Map<string, TpInfo>;
  /** TP kaliti -> qoidabuzarliklar soni. */
  violationsByTp: Map<string, number>;
  appealsByTp: Map<string, number>;
  violationCount: number;
  appealCount: number;
  /** Shu submission'da shu oyga yuklanayotgan shablonlar. */
  incoming: Set<TemplateType>;
}

const chunked = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

async function loadMonthState(db: Db, month: Date, incoming: Set<TemplateType>): Promise<MonthState> {
  const state: MonthState = {
    month,
    label: monthLabel(month),
    substations: new Map(),
    feeders: new Map(),
    transformers: new Map(),
    subscribers: new Map(),
    tpInfo: new Map(),
    violationsByTp: new Map(),
    appealsByTp: new Map(),
    violationCount: 0,
    appealCount: 0,
    incoming,
  };

  const period = await db.period.findUnique({ where: { month }, select: { id: true } });
  if (!period) return state;
  const periodId = period.id;

  // Faqat kelayotgan shablonlar tekshiruvi ishlatadigan holat o'qiladi (150 ming
  // abonentli oyda Podstansiyalarni qayta yuklash abonentlarni o'qimasin):
  //   - TP lar: Fiderlar (osilib qolish), TP (farq), keyingi shablonlar (ota);
  //   - abonentlar: TP (osilib qolish, 4.5), Abonentlar (farq),
  //     qoidabuzarlik/murojaat (bir xil ism ogohlantirishi);
  //   - qoidabuzarlik/murojaatlar: TP (osilib qolish) va o'z fayli (o'chiriladi soni).
  // Ota shablon keyinroq yuklanishi mumkin (4.4) - Podstansiyalar/Fiderlar
  // yuklanganda ham TP va abonentlar o'qiladi: ular bog'langan obyekt yangi
  // faylda bo'lishi shart.
  const has = (...types: TemplateType[]) => types.some((type) => incoming.has(type));
  const needTransformers = has("SUBSTATIONS", "FEEDERS", "TRANSFORMERS", "SUBSCRIBERS", "VIOLATIONS", "APPEALS");
  const needSubscribers = has("SUBSTATIONS", "FEEDERS", "TRANSFORMERS", "SUBSCRIBERS", "VIOLATIONS", "APPEALS");
  const needViolations = has("TRANSFORMERS", "VIOLATIONS");
  const needAppeals = has("TRANSFORMERS", "APPEALS");

  // So'rovlar ketma-ket: tranzaksiya bitta ulanishda ishlaydi.
  const substations = await db.substationSnapshot.findMany({
    where: { periodId },
    select: { substation: { select: { name: true, nameKey: true } } },
  });
  const feeders = await db.feederSnapshot.findMany({
    where: { periodId },
    select: {
      feeder: {
        select: { name: true, nameKey: true, substation: { select: { name: true, nameKey: true } } },
      },
    },
  });
  const transformers = !needTransformers
    ? []
    : await db.transformerSnapshot.findMany({
        where: { periodId },
        select: {
          transformerId: true,
          onlineSubscribers: true,
          offlineSubscribers: true,
          transformer: {
            select: {
              name: true,
              nameKey: true,
              feeder: { select: { name: true, nameKey: true } },
              substation: { select: { name: true, nameKey: true } },
            },
          },
        },
      });

  for (const { substation } of substations) {
    state.substations.set(substation.nameKey, { name: substation.name });
  }
  for (const { feeder } of feeders) {
    state.feeders.set(`${feeder.substation.nameKey}${KEY_SEP}${feeder.nameKey}`, {
      substationKey: feeder.substation.nameKey,
      substationName: feeder.substation.name,
      name: feeder.name,
    });
  }

  const tpKeyById = new Map<string, string>();
  for (const snapshot of transformers) {
    const tp = snapshot.transformer;
    const fKey = `${tp.substation.nameKey}${KEY_SEP}${tp.feeder.nameKey}`;
    const key = `${fKey}${KEY_SEP}${tp.nameKey}`;
    tpKeyById.set(snapshot.transformerId, key);
    state.tpInfo.set(key, { substationName: tp.substation.name, feederName: tp.feeder.name, name: tp.name });
    state.transformers.set(key, {
      feederKey: fKey,
      substationName: tp.substation.name,
      feederName: tp.feeder.name,
      name: tp.name,
      nameKey: tp.nameKey,
      onlineSubscribers: snapshot.onlineSubscribers,
      offlineSubscribers: snapshot.offlineSubscribers,
      row: null,
    });
  }

  const subscribers = !needSubscribers
    ? []
    : await db.subscriberSnapshot.findMany({
        where: { periodId },
        select: {
          transformerId: true,
          meterStatus: true,
          fullName: true,
          subscriber: { select: { contractKey: true } },
        },
      });
  const violations = !needViolations
    ? []
    : await db.violation.groupBy({
        by: ["transformerId"],
        where: { periodId },
        _count: { _all: true },
      });
  const appeals = !needAppeals
    ? []
    : await db.appeal.groupBy({
        by: ["transformerId"],
        where: { periodId },
        _count: { _all: true },
      });

  // Holati yo'q TP ga bog'langan yozuvlar (Transformatorlar shu oyga hali
  // yuklanmagan) - kaliti va nomlari obyektdan olinadi.
  const missingIds = new Set<string>();
  for (const item of [...subscribers, ...violations, ...appeals]) {
    if (!tpKeyById.has(item.transformerId)) missingIds.add(item.transformerId);
  }
  for (const ids of chunked([...missingIds], 5000)) {
    const rows = await db.transformer.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        nameKey: true,
        feeder: { select: { name: true, nameKey: true } },
        substation: { select: { name: true, nameKey: true } },
      },
    });
    for (const tp of rows) {
      const key = `${tp.substation.nameKey}${KEY_SEP}${tp.feeder.nameKey}${KEY_SEP}${tp.nameKey}`;
      tpKeyById.set(tp.id, key);
      state.tpInfo.set(key, { substationName: tp.substation.name, feederName: tp.feeder.name, name: tp.name });
    }
  }

  for (const snapshot of subscribers) {
    state.subscribers.set(snapshot.subscriber.contractKey, {
      transformerKey: tpKeyById.get(snapshot.transformerId) ?? snapshot.transformerId,
      online: snapshot.meterStatus === "ONLINE",
      fullNameKey: nameKey(snapshot.fullName),
    });
  }
  for (const group of violations) {
    const key = tpKeyById.get(group.transformerId) ?? group.transformerId;
    state.violationsByTp.set(key, (state.violationsByTp.get(key) ?? 0) + group._count._all);
    state.violationCount += group._count._all;
  }
  for (const group of appeals) {
    const key = tpKeyById.get(group.transformerId) ?? group.transformerId;
    state.appealsByTp.set(key, (state.appealsByTp.get(key) ?? 0) + group._count._all);
    state.appealCount += group._count._all;
  }

  return state;
}

/* ---------------------------------------------------------------------------
   Natija
   --------------------------------------------------------------------------- */

export interface FileCounts {
  createdRows: number;
  updatedRows: number;
  removedRows: number;
}

export interface ValidatedSubmission {
  /** `TEMPLATE_ORDER`, keyin oy bo'yicha; turi aniqlanmaganlar oxirida. */
  files: ParsedFile[];
  counts: Map<ParsedFile, FileCounts>;
  valid: boolean;
}

/** Fayllarni o'qiydi (baza kerak emas). */
export async function parseFiles(inputs: readonly ImportFileInput[]): Promise<ParsedFile[]> {
  const parsed: ParsedFile[] = [];
  // Ketma-ket: katta fayllar xotirada bir vaqtda turmasin.
  for (const [index, input] of inputs.entries()) {
    parsed.push(await parseWorkbook(input, index));
  }
  return parsed;
}

function sortFiles(files: readonly ParsedFile[]): ParsedFile[] {
  const order = (file: ParsedFile) =>
    file.templateType ? TEMPLATE_ORDER.indexOf(file.templateType) : TEMPLATE_ORDER.length;
  return [...files].sort(
    (a, b) =>
      order(a) - order(b) ||
      (a.month?.getTime() ?? 0) - (b.month?.getTime() ?? 0) ||
      a.index - b.index,
  );
}

const quote = (text: string) => `“${text}”`;

/** "A, B, C va yana 4 ta" */
function listSample(items: readonly string[], limit = 3): string {
  const shown = items.slice(0, limit).join(", ");
  return items.length > limit ? `${shown} va yana ${items.length - limit} ta` : shown;
}

function diffCounts(previous: ReadonlySet<string> | ReadonlyMap<string, unknown>, next: ReadonlySet<string>): FileCounts {
  let updatedRows = 0;
  for (const key of next) if (previous.has(key)) updatedRows += 1;
  return {
    createdRows: next.size - updatedRows,
    updatedRows,
    removedRows: previous.size - updatedRows,
  };
}

/**
 * Bog'liqlik tekshiruvi. `db` - oddiy klient (tekshirish rejimi) yoki
 * tranzaksiya (saqlash rejimi).
 */
export async function validateSubmission(db: Db, parsedFiles: readonly ParsedFile[]): Promise<ValidatedSubmission> {
  const files = sortFiles(parsedFiles);
  const counts = new Map<ParsedFile, FileCounts>();

  // 4.2: bir xil shablon bir xil oy uchun ikki marta.
  const groups = new Map<string, ParsedFile[]>();
  for (const file of files) {
    if (!file.templateType || !file.month) continue;
    const key = `${file.templateType}:${monthKey(file.month)}`;
    groups.set(key, [...(groups.get(key) ?? []), file]);
  }
  const skipped = new Set<ParsedFile>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    const message = `Shu yuklashda ${TEMPLATE_LABEL[first.templateType!]} shabloni ${monthLabel(first.month)} uchun ${group.length} marta tanlangan (${group
      .map((file) => quote(file.fileName))
      .join(", ")})`;
    for (const file of group) file.errors.add(null, null, message);
    for (const file of group.slice(1)) skipped.add(file);
  }

  // Oylar holati.
  const incomingByMonth = new Map<string, Set<TemplateType>>();
  for (const file of files) {
    if (!file.templateType || !file.month || file.fatal) continue;
    const key = monthKey(file.month);
    const set = incomingByMonth.get(key) ?? new Set<TemplateType>();
    set.add(file.templateType);
    incomingByMonth.set(key, set);
  }
  const states = new Map<string, MonthState>();
  for (const [key, incoming] of incomingByMonth) {
    const month = new Date(`${key}-01T00:00:00.000Z`);
    states.set(key, await loadMonthState(db, month, incoming));
  }

  for (const file of files) {
    if (!file.templateType || !file.month || file.fatal || skipped.has(file)) continue;
    const state = states.get(monthKey(file.month));
    if (!state) continue;
    switch (file.templateType) {
      case "SUBSTATIONS":
        counts.set(file, checkSubstations(file, state));
        break;
      case "FEEDERS":
        counts.set(file, checkFeeders(file, state));
        break;
      case "TRANSFORMERS":
        counts.set(file, checkTransformers(file, state));
        break;
      case "SUBSCRIBERS":
        counts.set(file, checkSubscribers(file, state));
        break;
      case "VIOLATIONS":
      case "APPEALS":
        counts.set(file, checkEvents(file, state));
        break;
    }
  }

  return { files, counts, valid: files.every((file) => file.errors.empty) };
}

/* ---------------------------------------------------------------------------
   Umumiy tekshiruvlar
   --------------------------------------------------------------------------- */

/** Fayl ichida takroriy kalit. Qaytaradi: kalit -> birinchi yozuv. */
function checkDuplicates<R extends ParsedRecord>(
  file: ParsedFile,
  records: readonly R[],
  keyOf: (record: R) => string | null,
): Map<string, R> {
  const spec = TEMPLATES[file.templateType!];
  const firstByKey = new Map<string, R>();
  for (const record of records) {
    const key = keyOf(record);
    if (key == null) continue;
    const first = firstByKey.get(key);
    if (!first) {
      firstByKey.set(key, record);
      continue;
    }
    const label = spec.keyLabel ? spec.keyLabel(record.data as never) : key;
    file.errors.add(
      record.data.row,
      spec.keyColumn,
      `Takroriy qator: ${label} ${first.data.row}-qatorda ham bor`,
    );
  }
  return firstByKey;
}

/** 4.6: `Umumiy oqim - Foydali oqim` bilan `Yo'qotish` farqi. */
function checkLossBalance(file: ParsedFile, records: readonly ParsedRecord<SubstationRow | FeederRow | TransformerRow>[]) {
  for (const { data } of records) {
    if (data.totalKwh == null || data.usefulKwh == null || data.lossKwh == null) continue;
    const expected = data.totalKwh - data.usefulKwh;
    const diff = Math.abs(expected - data.lossKwh);
    if (diff > 1 && diff > data.totalKwh * 0.005) {
      file.warnings.add(
        data.row,
        "Yo’qotish",
        `Umumiy oqim − Foydali oqim = ${dec(expected, 2)} kWh, Yo’qotish = ${dec(data.lossKwh, 2)} kWh (farq ${dec(diff, 2)} kWh)`,
      );
    }
  }
}

/*
 * 4.4 ota qoidasi. Har bir daraja (podstansiya, fider, TP) faqat o'z shabloni
 * shu oyga YUKLANGAN bo'lsa tekshiriladi - shunda nom ro'yxatda bo'lishi
 * shart. Yuklanmagan bo'lsa, obyekt nomidan yaratiladi (`commit.ts`), shablon
 * esa keyinroq yuklanganda o'sha obyektlarni o'z ichiga olishi shart
 * (`referencedBy*` - osilib qolish tekshiruvi).
 */

/** "podstansiya|fider|tp" kalitidan ota kalitlar. */
const tpKeyParts = (tpKey: string) => {
  const [substation, feeder] = tpKey.split(KEY_SEP);
  return { substationKey: substation, feederKey: `${substation}${KEY_SEP}${feeder}` };
};

interface Dependents {
  label: string;
  feeders: string[];
  transformers: string[];
  subscribers: number;
}

function describeDependents(entry: Dependents): string {
  return [
    entry.feeders.length > 0 ? `${entry.feeders.length} ta fider (${listSample(entry.feeders)})` : null,
    entry.transformers.length > 0 ? `${entry.transformers.length} ta TP (${listSample(entry.transformers)})` : null,
    entry.subscribers > 0 ? `${entry.subscribers} ta abonent` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Shu oyda podstansiyaga bog'langan fider, TP va abonentlar (shu yuklashda qayta kelmayotganlari). */
function referencedBySubstation(state: MonthState): Map<string, Dependents> {
  const result = new Map<string, Dependents>();
  const touch = (key: string, label: string) => {
    const entry = result.get(key) ?? { label, feeders: [], transformers: [], subscribers: 0 };
    result.set(key, entry);
    return entry;
  };
  if (!state.incoming.has("FEEDERS")) {
    for (const feeder of state.feeders.values()) touch(feeder.substationKey, feeder.substationName).feeders.push(feeder.name);
  }
  if (!state.incoming.has("TRANSFORMERS")) {
    for (const [key, tp] of state.transformers) {
      touch(tpKeyParts(key).substationKey, tp.substationName).transformers.push(tp.name);
    }
  }
  if (!state.incoming.has("SUBSCRIBERS")) {
    for (const subscriber of state.subscribers.values()) {
      const info = state.tpInfo.get(subscriber.transformerKey);
      touch(tpKeyParts(subscriber.transformerKey).substationKey, info?.substationName ?? "").subscribers += 1;
    }
  }
  return result;
}

/** Shu oyda fiderga bog'langan TP va abonentlar (shu yuklashda qayta kelmayotganlari). */
function referencedByFeeder(state: MonthState): Map<string, Dependents> {
  const result = new Map<string, Dependents>();
  const touch = (key: string, label: string) => {
    const entry = result.get(key) ?? { label, feeders: [], transformers: [], subscribers: 0 };
    result.set(key, entry);
    return entry;
  };
  if (!state.incoming.has("TRANSFORMERS")) {
    for (const tp of state.transformers.values()) {
      touch(tp.feederKey, `${tp.substationName} / ${tp.feederName}`).transformers.push(tp.name);
    }
  }
  if (!state.incoming.has("SUBSCRIBERS")) {
    for (const subscriber of state.subscribers.values()) {
      const info = state.tpInfo.get(subscriber.transformerKey);
      const label = info ? `${info.substationName} / ${info.feederName}` : "";
      touch(tpKeyParts(subscriber.transformerKey).feederKey, label).subscribers += 1;
    }
  }
  return result;
}

/** Podstansiya / fider / TP nomlarini shu oyda yuklangan darajalar bo'yicha tekshiradi. */
function checkHierarchy(
  file: ParsedFile,
  state: MonthState,
  row: number,
  names: { substation: string; feeder?: string; transformer?: string },
): boolean {
  if (state.substations.size > 0 && !state.substations.has(substationKey(names.substation))) {
    file.errors.add(
      row,
      "Podstansiya",
      `${quote(names.substation)} podstansiyasi ${state.label} uchun Podstansiyalar ro’yxatida topilmadi`,
    );
    return false;
  }
  if (names.feeder == null) return true;
  if (state.feeders.size > 0 && !state.feeders.has(feederKey(names.substation, names.feeder))) {
    file.errors.add(
      row,
      "Fider",
      `${quote(names.feeder)} fideri ${quote(names.substation)} podstansiyasida (${state.label} Fiderlar ro’yxati) topilmadi`,
    );
    return false;
  }
  if (names.transformer == null) return true;
  if (
    state.transformers.size > 0 &&
    !state.transformers.has(transformerKey(names.substation, names.feeder, names.transformer))
  ) {
    file.errors.add(
      row,
      "TP",
      `${quote(names.transformer)} TP ${quote(`${names.substation} / ${names.feeder}`)} fiderida (${state.label} Transformatorlar ro’yxati) topilmadi`,
    );
    return false;
  }
  return true;
}

/* ---------------------------------------------------------------------------
   Shablonlar
   --------------------------------------------------------------------------- */

function checkSubstations(file: ParsedFile, state: MonthState): FileCounts {
  const records = file.records as ParsedRecord<SubstationRow>[];
  const byKey = checkDuplicates(file, records, (r) => (r.data.name ? substationKey(r.data.name) : null));
  checkLossBalance(file, records);

  const next = new Set(byKey.keys());
  const counts = diffCounts(state.substations, next);

  // 4.3 / 4.4: shu oyda fideri, TP si yoki abonenti bor podstansiya yangi faylda bo'lishi shart.
  for (const [key, entry] of referencedBySubstation(state)) {
    if (next.has(key)) continue;
    file.errors.add(
      null,
      "Podstansiya Nomi",
      `${quote(entry.label)} podstansiyasi faylda yo’q, lekin ${state.label} da unga ${describeDependents(entry)} bog’langan. Podstansiyani faylga qo’shing yoki bog’liq fayllarni ham qayta yuklang`,
    );
  }

  state.substations = new Map([...byKey].map(([key, record]) => [key, { name: record.data.name! }]));
  return counts;
}

function checkFeeders(file: ParsedFile, state: MonthState): FileCounts {
  const records = file.records as ParsedRecord<FeederRow>[];
  const byKey = checkDuplicates(file, records, (r) =>
    r.data.substationName && r.data.name ? feederKey(r.data.substationName, r.data.name) : null,
  );
  checkLossBalance(file, records);

  // Ota: podstansiya (Podstansiyalar shu oyga yuklangan bo'lsa).
  for (const { data } of records) {
    if (data.substationName) checkHierarchy(file, state, data.row, { substation: data.substationName });
  }

  const next = new Set(byKey.keys());
  const counts = diffCounts(state.feeders, next);

  // 4.3 / 4.4: shu oyda TP si yoki abonenti bor fider yangi faylda bo'lishi shart.
  for (const [key, entry] of referencedByFeeder(state)) {
    if (next.has(key)) continue;
    file.errors.add(
      null,
      "Fider Nomi",
      `${quote(entry.label)} fideri faylda yo’q, lekin ${state.label} da unga ${describeDependents(entry)} bog’langan. Fiderni faylga qo’shing yoki bog’liq fayllarni ham qayta yuklang`,
    );
  }

  state.feeders = new Map(
    [...byKey].map(([key, { data }]) => [
      key,
      { substationKey: substationKey(data.substationName!), substationName: data.substationName!, name: data.name! },
    ]),
  );
  return counts;
}

/** TP bo'yicha abonentlar ro'yxatidan hisoblangan sonlar. */
function countSubscribersByTp(subscribers: Iterable<SubscriberState>): Map<string, { online: number; offline: number }> {
  const result = new Map<string, { online: number; offline: number }>();
  for (const subscriber of subscribers) {
    const entry = result.get(subscriber.transformerKey) ?? { online: 0, offline: 0 };
    if (subscriber.online) entry.online += 1;
    else entry.offline += 1;
    result.set(subscriber.transformerKey, entry);
  }
  return result;
}

function checkTransformers(file: ParsedFile, state: MonthState): FileCounts {
  const records = file.records as ParsedRecord<TransformerRow>[];
  const byKey = checkDuplicates(file, records, (r) =>
    r.data.substationName && r.data.feederName && r.data.name
      ? transformerKey(r.data.substationName, r.data.feederName, r.data.name)
      : null,
  );
  checkLossBalance(file, records);

  // Ota: podstansiya va fider (o'z shablonlari shu oyga yuklangan bo'lsa).
  for (const { data } of records) {
    if (!data.substationName || !data.feederName) continue;
    checkHierarchy(file, state, data.row, { substation: data.substationName, feeder: data.feederName });
  }

  const next = new Set(byKey.keys());
  const counts = diffCounts(state.transformers, next);

  // 4.3: shu oyda abonenti, qoidabuzarligi yoki murojaati bor TP yangi faylda bo'lishi shart.
  const dependents = new Map<string, { subscribers: number; violations: number; appeals: number }>();
  const touch = (key: string) => {
    const entry = dependents.get(key) ?? { subscribers: 0, violations: 0, appeals: 0 };
    dependents.set(key, entry);
    return entry;
  };
  if (!state.incoming.has("SUBSCRIBERS")) {
    for (const subscriber of state.subscribers.values()) {
      if (!next.has(subscriber.transformerKey)) touch(subscriber.transformerKey).subscribers += 1;
    }
  }
  if (!state.incoming.has("VIOLATIONS")) {
    for (const [key, count] of state.violationsByTp) if (!next.has(key)) touch(key).violations += count;
  }
  if (!state.incoming.has("APPEALS")) {
    for (const [key, count] of state.appealsByTp) if (!next.has(key)) touch(key).appeals += count;
  }
  for (const [key, entry] of dependents) {
    const tp = state.tpInfo.get(key);
    const label = tp ? `${tp.substationName} / ${tp.feederName} / ${tp.name}` : key.split(KEY_SEP).join(" / ");
    const parts = [
      entry.subscribers > 0 ? `${entry.subscribers} ta abonent` : null,
      entry.violations > 0 ? `${entry.violations} ta qoidabuzarlik` : null,
      entry.appeals > 0 ? `${entry.appeals} ta murojaat` : null,
    ].filter(Boolean);
    file.errors.add(
      null,
      "TP Nomi",
      `${quote(label)} TP faylda yo’q, lekin ${state.label} da unga ${parts.join(", ")} bog’langan. TP ni faylga qo’shing yoki bog’liq fayllarni ham qayta yuklang`,
    );
  }

  // 4.6: bir xil "TP Nomi" bir nechta fiderda.
  const byName = new Map<string, ParsedRecord<TransformerRow>[]>();
  for (const record of byKey.values()) {
    const key = nameKey(record.data.name!);
    byName.set(key, [...(byName.get(key) ?? []), record]);
  }
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    const places = group.map(({ data }) => `${data.substationName} / ${data.feederName}`);
    file.warnings.add(
      group[0].data.row,
      "TP Nomi",
      `${quote(group[0].data.name!)} nomli TP ${group.length} ta fiderda uchraydi (${listSample(places)}): qoidabuzarlik va murojaatlarni bu TP ga “TP Nomi” bo’yicha bog’lab bo’lmaydi`,
    );
  }

  // 4.5: abonentlar ro'yxati bu oyda bor (va qayta yuklanmayapti) - sonlar mos bo'lishi shart.
  if (!state.incoming.has("SUBSCRIBERS") && state.subscribers.size > 0) {
    const actual = countSubscribersByTp(state.subscribers.values());
    for (const [key, { data }] of byKey) {
      const real = actual.get(key) ?? { online: 0, offline: 0 };
      if (data.onlineSubscribers != null && data.onlineSubscribers !== real.online) {
        file.errors.add(
          data.row,
          "Aloqadagi abonentlar",
          `Faylda ${data.onlineSubscribers}, ${state.label} abonentlar ro’yxatida shu TP da “Aloqada” holatidagi abonentlar ${real.online} ta`,
        );
      }
      if (data.offlineSubscribers != null && data.offlineSubscribers !== real.offline) {
        file.errors.add(
          data.row,
          "Aloqadan chiqqan abonentlar",
          `Faylda ${data.offlineSubscribers}, ${state.label} abonentlar ro’yxatida shu TP da aloqada bo’lmagan abonentlar ${real.offline} ta`,
        );
      }
    }
  }

  for (const [key, { data }] of byKey) {
    state.tpInfo.set(key, { substationName: data.substationName!, feederName: data.feederName!, name: data.name! });
  }
  state.transformers = new Map(
    [...byKey].map(([key, { data }]) => [
      key,
      {
        feederKey: feederKey(data.substationName!, data.feederName!),
        substationName: data.substationName!,
        feederName: data.feederName!,
        name: data.name!,
        nameKey: nameKey(data.name!),
        onlineSubscribers: data.onlineSubscribers ?? 0,
        offlineSubscribers: data.offlineSubscribers ?? 0,
        row: data.row,
      },
    ]),
  );
  return counts;
}

function checkSubscribers(file: ParsedFile, state: MonthState): FileCounts {
  const records = file.records as ParsedRecord<SubscriberRow>[];
  const byKey = checkDuplicates(file, records, (r) =>
    r.data.contractNumber ? contractKey(r.data.contractNumber) : null,
  );

  // Ota: podstansiya, fider, TP (o'z shablonlari shu oyga yuklangan bo'lsa).
  let parentsOk = true;
  for (const { data } of records) {
    if (!data.substationName || !data.feederName || !data.transformerName) {
      parentsOk = false;
      continue;
    }
    const ok = checkHierarchy(file, state, data.row, {
      substation: data.substationName,
      feeder: data.feederName,
      transformer: data.transformerName,
    });
    if (!ok) parentsOk = false;
  }

  const next = new Set(byKey.keys());
  const counts = diffCounts(state.subscribers, next);

  const subscribers = new Map<string, SubscriberState>();
  let complete = parentsOk;
  for (const [key, { data }] of byKey) {
    if (data.meterStatus == null || !data.substationName || !data.feederName || !data.transformerName) {
      complete = false;
      continue;
    }
    const tpKey = transformerKey(data.substationName, data.feederName, data.transformerName);
    subscribers.set(key, {
      transformerKey: tpKey,
      online: data.meterStatus === "ONLINE",
      fullNameKey: data.fullName ? nameKey(data.fullName) : "",
    });
    if (!state.tpInfo.has(tpKey)) {
      state.tpInfo.set(tpKey, {
        substationName: data.substationName,
        feederName: data.feederName,
        name: data.transformerName,
      });
    }
  }

  // 4.5: TP jadvalidagi sonlar = ro'yxat. Qatorlarda holat/TP xatosi bo'lsa
  // sanash noto'g'ri chiqadi - avval o'sha xatolar tuzatiladi.
  if (complete) {
    const actual = countSubscribersByTp(subscribers.values());
    for (const [key, tp] of state.transformers) {
      const real = actual.get(key) ?? { online: 0, offline: 0 };
      const label = `${tp.substationName} / ${tp.feederName} / ${tp.name}`;
      if (tp.onlineSubscribers !== real.online) {
        file.errors.add(
          null,
          "TP",
          `${quote(label)} TP: Transformatorlar faylida “Aloqadagi abonentlar” = ${tp.onlineSubscribers}, abonentlar faylida “Aloqada” holatidagilar ${real.online} ta`,
        );
      }
      if (tp.offlineSubscribers !== real.offline) {
        file.errors.add(
          null,
          "TP",
          `${quote(label)} TP: Transformatorlar faylida “Aloqadan chiqqan abonentlar” = ${tp.offlineSubscribers}, abonentlar faylida aloqada bo’lmaganlar ${real.offline} ta`,
        );
      }
    }
  }

  state.subscribers = subscribers;
  return counts;
}

/** Qoidabuzarliklar va murojaatlar: TP "TP Nomi" bo'yicha bir ma'noli topilishi shart. */
function checkEvents(file: ParsedFile, state: MonthState): FileCounts {
  const records = file.records as ParsedRecord<ViolationRow | AppealRow>[];
  const isViolations = file.templateType === "VIOLATIONS";
  const counts: FileCounts = {
    createdRows: file.totalRows,
    updatedRows: 0,
    removedRows: isViolations ? state.violationCount : state.appealCount,
  };

  // TP lar: Transformatorlar shu oyga yuklangan bo'lsa - uning ro'yxati, aks
  // holda shu oy abonentlari bog'langan TP lar (4.4). Ikkalasi ham yo'q bo'lsa -
  // "TP Nomi" ni hech narsaga bog'lab bo'lmaydi.
  const tpKeys =
    state.transformers.size > 0
      ? [...state.transformers.keys()]
      : [...new Set([...state.subscribers.values()].map((subscriber) => subscriber.transformerKey))];
  if (tpKeys.length === 0) {
    file.errors.add(
      null,
      null,
      `${state.label} uchun Transformatorlar ham, Abonentlar ham yuklanmagan - “TP Nomi” ni bog’lab bo’lmaydi. Avval shu oy uchun Transformatorlar yoki Abonentlar faylini yuklang (yoki shu yuklashga qo’shing)`,
    );
    return counts;
  }

  const tpsByName = new Map<string, string[]>();
  for (const key of tpKeys) {
    const tpNameKey = key.split(KEY_SEP)[2];
    tpsByName.set(tpNameKey, [...(tpsByName.get(tpNameKey) ?? []), key]);
  }
  const subscribersByName = new Map<string, number>();
  for (const subscriber of state.subscribers.values()) {
    const key = `${subscriber.transformerKey}${KEY_SEP}${subscriber.fullNameKey}`;
    subscribersByName.set(key, (subscribersByName.get(key) ?? 0) + 1);
  }

  const byTp = new Map<string, number>();
  for (const { data } of records) {
    if (!data.transformerName) continue;
    const matches = tpsByName.get(nameKey(data.transformerName)) ?? [];
    if (matches.length === 0) {
      const source = state.transformers.size > 0 ? "Transformatorlar ro’yxatida" : "abonentlar bog’langan TP lar orasida";
      file.errors.add(
        data.row,
        "TP Nomi",
        `${quote(data.transformerName)} nomli TP ${state.label} uchun ${source} topilmadi`,
      );
      continue;
    }
    if (matches.length > 1) {
      const places = matches.map((key) => {
        const tp = state.tpInfo.get(key);
        return tp ? `${tp.substationName} / ${tp.feederName}` : key.split(KEY_SEP).slice(0, 2).join(" / ");
      });
      file.errors.add(
        data.row,
        "TP Nomi",
        `${quote(data.transformerName)} nomli TP ${state.label} da ${matches.length} ta fiderda uchraydi (${listSample(places)}) - qaysi biri ekani noaniq`,
      );
      continue;
    }
    const tpKey = matches[0];
    byTp.set(tpKey, (byTp.get(tpKey) ?? 0) + 1);

    if (data.subscriberName) {
      const same = subscribersByName.get(`${tpKey}${KEY_SEP}${nameKey(data.subscriberName)}`) ?? 0;
      if (same > 1) {
        file.warnings.add(
          data.row,
          "Abonent",
          `${quote(data.subscriberName)} nomi shu TP da ${same} ta abonentga mos keladi - abonent kartasiga bog’lanmaydi`,
        );
      }
    }
  }

  if (isViolations) state.violationsByTp = byTp;
  else state.appealsByTp = byTp;
  return counts;
}

/* ---------------------------------------------------------------------------
   Hisobot
   --------------------------------------------------------------------------- */

export function buildReport(
  mode: ImportMode,
  validated: ValidatedSubmission,
  options: { committed: boolean; batchIds?: Map<ParsedFile, string>; message?: string | null },
): ImportResult {
  const files: ImportFileReport[] = validated.files.map((file) => {
    const counts = validated.counts.get(file) ?? { createdRows: 0, updatedRows: 0, removedRows: 0 };
    return {
      index: file.index,
      fileName: file.fileName,
      fileSize: file.fileSize,
      sheetName: file.sheetName,
      templateType: file.templateType,
      reportDate: file.reportDate?.toISOString() ?? null,
      month: file.month ? monthKey(file.month) : null,
      totalRows: file.totalRows,
      ...counts,
      errors: file.errors.items,
      errorCount: file.errors.count,
      warnings: file.warnings.items,
      warningCount: file.warnings.count,
      batchId: options.batchIds?.get(file) ?? null,
    };
  });
  return {
    mode,
    valid: validated.valid,
    committed: options.committed,
    files,
    message: options.message ?? null,
  };
}

/** Tekshirish rejimi: bazaga hech narsa yozilmaydi. */
export async function validateImport(db: Db, inputs: readonly ImportFileInput[]): Promise<ImportResult> {
  const parsed = await parseFiles(inputs);
  const validated = await validateSubmission(db, parsed);
  return buildReport("validate", validated, { committed: false });
}
