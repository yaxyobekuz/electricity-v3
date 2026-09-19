import type { Prisma, PrismaClient, TemplateType } from "@/generated/prisma";
import { TEMPLATE_LABEL, TEMPLATE_ORDER } from "@/lib/domain/labels";
import { contractKey, nameKey } from "@/lib/domain/normalize";
import { dec, monthKey, monthLabel } from "@/lib/format";

import { emptyLinkIndex, type EventLinkIndex, loadGlobalLinks, pushUnique, resolveEventLink } from "./event-links";
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
  /** "Ma'sul xodim" kaliti - qoidabuzarlik/murojaatni podstansiyaga bog'lash uchun (4.3d). */
  staffKey: string | null;
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
  /** Barcha oylar bo'yicha bog'lash ma'lumoti (qoidabuzarlik/murojaat kelayotgan bo'lsa). */
  links: EventLinkIndex | null;
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
    links: null,
    tpInfo: new Map(),
    violationsByTp: new Map(),
    appealsByTp: new Map(),
    violationCount: 0,
    appealCount: 0,
    incoming,
  };

  if (incoming.has("VIOLATIONS") || incoming.has("APPEALS")) {
    state.links = emptyLinkIndex();
    await loadGlobalLinks(db, state.links);
  }

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
    select: { substation: { select: { name: true, nameKey: true } }, staff: { select: { nameKey: true } } },
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

  for (const { substation, staff } of substations) {
    state.substations.set(substation.nameKey, { name: substation.name, staffKey: staff?.nameKey ?? null });
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
    if (item.transformerId && !tpKeyById.has(item.transformerId)) missingIds.add(item.transformerId);
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
  // TP ga bog'lanmagan yozuvlar (4.3d) faqat umumiy songa kiradi.
  for (const group of violations) {
    state.violationCount += group._count._all;
    if (!group.transformerId) continue;
    const key = tpKeyById.get(group.transformerId) ?? group.transformerId;
    state.violationsByTp.set(key, (state.violationsByTp.get(key) ?? 0) + group._count._all);
  }
  for (const group of appeals) {
    state.appealCount += group._count._all;
    if (!group.transformerId) continue;
    const key = tpKeyById.get(group.transformerId) ?? group.transformerId;
    state.appealsByTp.set(key, (state.appealsByTp.get(key) ?? 0) + group._count._all);
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

/**
 * Bir xil ogohlantirish (masalan, bitta fider yuzlab qatorda ro'yxatda yo'q)
 * bir marta, qatorlar soni bilan yoziladi.
 */
class GroupedWarnings {
  private readonly items = new Map<string, { row: number | null; column: string | null; text: string; count: number }>();

  add(key: string, row: number | null, column: string | null, text: string): void {
    const item = this.items.get(key);
    if (item) item.count += 1;
    else this.items.set(key, { row, column, text, count: 1 });
  }

  flush(file: ParsedFile): void {
    for (const item of this.items.values()) {
      file.warnings.add(item.row, item.column, item.count > 1 ? `${item.text} (${item.count} ta qator)` : item.text);
    }
    this.items.clear();
  }
}

const hierarchyWarnings = new WeakMap<ParsedFile, GroupedWarnings>();
const warningsOf = (file: ParsedFile) => {
  const existing = hierarchyWarnings.get(file);
  if (existing) return existing;
  const created = new GroupedWarnings();
  hierarchyWarnings.set(file, created);
  return created;
};

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

/*
 * Birlashgan fider: "Jo'jaxona/Qiyali". Abonentlar (yoki TP) faylida TP ikki
 * fiderdan ta'minlanganda shunday yoziladi. Fiderlar shu oyga yuklangan
 * bo'lsa, qismlaridan KAMIDA BITTASI ro'yxatda bo'lishi shart; ro'yxatda yo'q
 * qismlar ogohlantirishda aytiladi. Birlashgan fider alohida obyekt bo'lib
 * yaratiladi (holatsiz).
 */
function combinedFeederParts(feeder: string): string[] | null {
  if (!feeder.includes("/")) return null;
  const parts = feeder
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length >= 2 ? parts : null;
}

/** `feederKey` birlashgan fiderniki bo'lsa - qismlaridan biri to'plamda bormi. */
function combinedKeyCovered(keys: ReadonlySet<string>, key: string): boolean {
  const [substation, feeder] = key.split(KEY_SEP);
  const parts = combinedFeederParts(feeder ?? "");
  return parts != null && parts.some((part) => keys.has(`${substation}${KEY_SEP}${nameKey(part)}`));
}

/** Shu oy fiderlari bor podstansiyalar va TP lari bor fiderlar (ota darajasi tekshiruvi uchun). */
function parentsWithChildren(state: MonthState): { substations: Set<string>; feeders: Set<string> } {
  return {
    substations: new Set([...state.feeders.values()].map((feeder) => feeder.substationKey)),
    feeders: new Set([...state.transformers.values()].map((tp) => tp.feederKey)),
  };
}

/**
 * Podstansiya / fider / TP nomlarini shu oyning ro'yxatlari bilan solishtiradi
 * (4.3a). Ro'yxatda yo'q nom XATO emas: obyekt nomidan yaratiladi, lekin
 * ogohlantiriladi. Fider faqat o'sha podstansiyaning fiderlari shu oyda
 * yuklangan bo'lsa, TP esa o'sha fiderning TP lari yuklangan bo'lsa tekshiriladi
 * (fayllar tuman bo'yicha qisman bo'lishi mumkin).
 */
function checkHierarchy(
  file: ParsedFile,
  state: MonthState,
  row: number,
  names: { substation: string; feeder?: string; transformer?: string },
  parents: { substations: Set<string>; feeders: Set<string> },
): void {
  const warnings = warningsOf(file);
  const subKey = substationKey(names.substation);
  if (state.substations.size > 0 && !state.substations.has(subKey)) {
    warnings.add(
      `s:${subKey}`,
      row,
      "Podstansiya",
      `${quote(names.substation)} podstansiyasi ${state.label} Podstansiyalar ro’yxatida yo’q - obyekt nomidan yaratiladi`,
    );
  }
  if (names.feeder == null) return;
  const fKey = feederKey(names.substation, names.feeder);
  if (parents.substations.has(subKey) && !state.feeders.has(fKey)) {
    const parts = combinedFeederParts(names.feeder);
    const present = (parts ?? []).filter((part) => state.feeders.has(feederKey(names.substation, part)));
    if (parts && present.length > 0) {
      const missing = parts.filter((part) => !present.includes(part));
      warnings.add(
        `c:${fKey}`,
        row,
        "Fider",
        `${quote(names.feeder)} birlashgan fider sifatida qabul qilindi (Fiderlar ro’yxatida: ${present.join(", ")})` +
          (missing.length > 0 ? `; ${missing.map(quote).join(", ")} ${state.label} Fiderlar ro’yxatida yo’q` : "") +
          ". Bu TP lar alohida fiderlarning sahifasida ko’rinmaydi",
      );
    } else {
      warnings.add(
        `f:${fKey}`,
        row,
        "Fider",
        `${quote(names.feeder)} fideri ${quote(names.substation)} podstansiyasining ${state.label} Fiderlar ro’yxatida yo’q - obyekt nomidan yaratiladi`,
      );
    }
  }
  if (names.transformer == null) return;
  const tKey = transformerKey(names.substation, names.feeder, names.transformer);
  if (parents.feeders.has(fKey) && !state.transformers.has(tKey)) {
    warnings.add(
      `t:${fKey}`,
      row,
      "TP",
      `${quote(`${names.substation} / ${names.feeder}`)} fiderining ayrim TP lari ${state.label} Transformatorlar ro’yxatida yo’q (masalan ${quote(names.transformer)}) - obyekt nomidan yaratiladi`,
    );
  }
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

  // 4.3: shu oyda fideri, TP si yoki abonenti bor podstansiya yangi faylda bo'lmasa - ogohlantirish.
  for (const [key, entry] of referencedBySubstation(state)) {
    if (next.has(key)) continue;
    file.warnings.add(
      null,
      "Podstansiya Nomi",
      `${quote(entry.label)} podstansiyasi faylda yo’q, lekin ${state.label} da unga ${describeDependents(entry)} bog’langan - bu oyda uning oqim ko’rsatkichlari bo’lmaydi`,
    );
  }

  state.substations = new Map(
    [...byKey].map(([key, record]) => [
      key,
      { name: record.data.name!, staffKey: record.data.staffName ? nameKey(record.data.staffName) : null },
    ]),
  );
  return counts;
}

function checkFeeders(file: ParsedFile, state: MonthState): FileCounts {
  const records = file.records as ParsedRecord<FeederRow>[];
  const byKey = checkDuplicates(file, records, (r) =>
    r.data.substationName && r.data.name ? feederKey(r.data.substationName, r.data.name) : null,
  );
  checkLossBalance(file, records);

  // Ota: podstansiya (Podstansiyalar shu oyga yuklangan bo'lsa).
  const parents = parentsWithChildren(state);
  for (const { data } of records) {
    if (data.substationName) checkHierarchy(file, state, data.row, { substation: data.substationName }, parents);
  }
  warningsOf(file).flush(file);

  const next = new Set(byKey.keys());
  const counts = diffCounts(state.feeders, next);

  // 4.3: shu oyda TP si yoki abonenti bor fider yangi faylda bo'lmasa - ogohlantirish.
  for (const [key, entry] of referencedByFeeder(state)) {
    if (next.has(key) || combinedKeyCovered(next, key)) continue;
    file.warnings.add(
      null,
      "Fider Nomi",
      `${quote(entry.label)} fideri faylda yo’q, lekin ${state.label} da unga ${describeDependents(entry)} bog’langan - bu oyda uning oqim ko’rsatkichlari bo’lmaydi`,
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
  const parents = parentsWithChildren(state);
  for (const { data } of records) {
    if (!data.substationName || !data.feederName) continue;
    checkHierarchy(file, state, data.row, { substation: data.substationName, feeder: data.feederName }, parents);
  }
  warningsOf(file).flush(file);

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
    file.warnings.add(
      null,
      "TP Nomi",
      `${quote(label)} TP faylda yo’q, lekin ${state.label} da unga ${parts.join(", ")} bog’langan - bu oyda uning ko’rsatkichlari bo’lmaydi`,
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
      `${quote(group[0].data.name!)} nomli TP ${group.length} ta fiderda uchraydi (${listSample(places)}): qoidabuzarlik va murojaatlar bu TP ga faqat abonent, “Podstansiya” / “Fider” ustunlari yoki ma’sul xodim podstansiyasi orqali bog’lanadi`,
    );
  }

  // 4.5: abonentlar ro'yxati bu oyda bor (va qayta yuklanmayapti) - sonlar solishtiriladi.
  if (!state.incoming.has("SUBSCRIBERS") && state.subscribers.size > 0) {
    warnCountMismatch(
      file,
      state,
      [...byKey].map(([key, { data }]) => ({
        key,
        online: data.onlineSubscribers ?? 0,
        offline: data.offlineSubscribers ?? 0,
      })),
      countSubscribersByTp(state.subscribers.values()),
    );
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
  const parents = parentsWithChildren(state);
  let parentsOk = true;
  for (const { data } of records) {
    if (!data.substationName || !data.feederName || !data.transformerName) {
      parentsOk = false;
      continue;
    }
    checkHierarchy(
      file,
      state,
      data.row,
      { substation: data.substationName, feeder: data.feederName, transformer: data.transformerName },
      parents,
    );
  }
  warningsOf(file).flush(file);

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

  // 4.5: TP jadvalidagi sonlar va ro'yxat solishtiriladi (mos kelmasa - ogohlantirish).
  if (complete && state.transformers.size > 0) {
    warnCountMismatch(
      file,
      state,
      [...state.transformers].map(([key, tp]) => ({ key, online: tp.onlineSubscribers, offline: tp.offlineSubscribers })),
      countSubscribersByTp(subscribers.values()),
    );
  }

  state.subscribers = subscribers;
  return counts;
}

/**
 * 4.5: TP jadvalidagi abonent sonlari abonentlar ro'yxati bilan solishtiriladi.
 * Mos kelmasa XATO emas (real fayllar turli manbadan) - bitta umumlashgan
 * ogohlantirish. Platformada abonent soni ro'yxatdan olinadi (5-bo'lim).
 */
function warnCountMismatch(
  file: ParsedFile,
  state: MonthState,
  tps: readonly { key: string; online: number; offline: number }[],
  actual: Map<string, { online: number; offline: number }>,
): void {
  const mismatched = tps.filter((tp) => {
    const real = actual.get(tp.key) ?? { online: 0, offline: 0 };
    return real.online !== tp.online || real.offline !== tp.offline;
  });
  if (mismatched.length === 0) return;
  const examples = mismatched.slice(0, 3).map((tp) => {
    const real = actual.get(tp.key) ?? { online: 0, offline: 0 };
    const info = state.tpInfo.get(tp.key);
    const label = info ? `${info.substationName} / ${info.feederName} / ${info.name}` : tp.key.split(KEY_SEP).join(" / ");
    return `${label}: TP faylida ${tp.online}+${tp.offline}, ro’yxatda ${real.online}+${real.offline}`;
  });
  file.warnings.add(
    null,
    "Aloqadagi abonentlar",
    `${state.label}: ${mismatched.length} ta TP da abonentlar soni (aloqada + aloqadan chiqqan) Transformatorlar fayli va abonentlar ro’yxatida farq qiladi, masalan ${examples.join("; ")}. Platformada abonentlar soni ro’yxatdan olinadi`,
  );
}

/**
 * Qoidabuzarliklar va murojaatlar: bog'lanish `event-links.ts` dagi yagona
 * qoida bilan (4.3d). TP topilmasa ham yozuv saqlanadi - ogohlantirish.
 */
function checkEvents(file: ParsedFile, state: MonthState): FileCounts {
  const records = file.records as ParsedRecord<ViolationRow | AppealRow>[];
  const isViolations = file.templateType === "VIOLATIONS";
  const counts: FileCounts = {
    createdRows: file.totalRows,
    updatedRows: 0,
    removedRows: isViolations ? state.violationCount : state.appealCount,
  };

  // Global ma'lumot (loadMonthState) + shu oy holati (submission ichidagi fayllar bilan).
  const index = emptyLinkIndex();
  if (state.links) {
    for (const [key, value] of state.links.allContracts) index.allContracts.set(key, value);
    for (const [key, values] of state.links.allTps) index.allTps.set(key, [...values]);
    for (const key of state.links.feeders) index.feeders.add(key);
    for (const key of state.links.substations) index.substations.add(key);
  }
  // Shu submission fayllaridagi obyektlar ham saqlashda bazada bo'ladi.
  const addPlace = (tpOrFeederKey: string) => {
    const [substation, feeder] = tpOrFeederKey.split(KEY_SEP);
    index.substations.add(substation);
    if (feeder != null) index.feeders.add(`${substation}${KEY_SEP}${feeder}`);
  };
  for (const key of state.substations.keys()) index.substations.add(key);
  for (const key of state.feeders.keys()) addPlace(key);
  for (const [contract, subscriber] of state.subscribers) {
    index.monthContracts.set(contract, subscriber.transformerKey);
    const tpName = subscriber.transformerKey.split(KEY_SEP)[2] ?? "";
    pushUnique(index.monthTps, tpName, subscriber.transformerKey);
    pushUnique(index.allTps, tpName, subscriber.transformerKey);
    pushUnique(index.subscriberNames, `${subscriber.transformerKey}${KEY_SEP}${subscriber.fullNameKey}`, contract);
    addPlace(subscriber.transformerKey);
  }
  for (const [key, tp] of state.transformers) {
    pushUnique(index.monthTps, tp.nameKey, key);
    pushUnique(index.allTps, tp.nameKey, key);
    addPlace(key);
  }
  for (const [key, substation] of state.substations) {
    if (substation.staffKey) pushUnique(index.staffSubstations, substation.staffKey, key);
  }

  const warnings = new GroupedWarnings();
  const byTp = new Map<string, number>();
  let feederOnly = 0;
  let substationOnly = 0;
  let unlinked = 0;
  for (const { data } of records) {
    const link = resolveEventLink(index, {
      substationName: data.substationName,
      feederName: data.feederName,
      transformerName: data.transformerName,
      subscriberName: data.subscriberName,
      staffName: data.staffName,
    });
    if (link.warning) warnings.add(`w:${link.warning}`, data.row, "TP Nomi", link.warning);
    if (link.tpKey) byTp.set(link.tpKey, (byTp.get(link.tpKey) ?? 0) + 1);
    else if (link.feederKey) feederOnly += 1;
    else if (link.substationKey) substationOnly += 1;
    else unlinked += 1;
  }
  warnings.flush(file);
  if (feederOnly + substationOnly + unlinked > 0) {
    const parts = [
      feederOnly > 0 ? `${feederOnly} tasi faqat fiderga bog’landi` : null,
      substationOnly > 0 ? `${substationOnly} tasi faqat podstansiyaga bog’landi` : null,
      unlinked > 0 ? `${unlinked} tasi hech qaysi obyektga bog’lanmadi` : null,
    ].filter(Boolean);
    file.warnings.add(
      null,
      "TP Nomi",
      `${feederOnly + substationOnly + unlinked} ta yozuvning TP si aniqlanmadi (${parts.join(", ")}) - yozuvlar baribir saqlanadi va tuman bo’yicha sonlarga kiradi`,
    );
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
