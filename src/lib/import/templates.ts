import type {
  AppealStatus,
  MeterStatus,
  SubscriberKind,
  TemplateType,
  ViolatorType,
} from "@/generated/prisma";
import {
  APPEAL_STATUS_LABEL,
  METER_STATUS_LABEL,
  SUBSCRIBER_KIND_LABEL,
  VIOLATOR_TYPE_LABEL,
} from "@/lib/domain/labels";
import { contractKey, nameKey } from "@/lib/domain/normalize";
import { num } from "@/lib/format";

import {
  type CellRead,
  type EnumSpec,
  type PlainValue,
  readDate,
  readEnum,
  readInteger,
  readNumber,
  readText,
} from "./cells";

/*
 * 6 ta shablonning ustunlari: sarlavha matni (data_template/*.xlsx dagi kabi),
 * majburiyligi va o'qish qoidasi. Jadval: `.claude/docs/shablonlar.md`.
 */

/* ---------------------------------------------------------------------------
   Qator tiplari (bitta Excel qatori, tekshirilgan qiymatlar)
   --------------------------------------------------------------------------- */

/** Excel qatorining asl ko'rinishi: sarlavha matni -> qiymat (sana - ISO matn). */
export type SourceRow = Record<string, string | number | boolean>;

interface BaseRow {
  /** Excel qator raqami. */
  row: number;
  /**
   * Qatordagi BARCHA to'ldirilgan kataklar, shablonda yo'q ustunlar ham
   * (`sourceRow` ustuniga yoziladi - platformada ko'rsatilmasa ham saqlanadi).
   */
  sourceRow: SourceRow;
}

export interface SubstationRow extends BaseRow {
  name: string;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  capacityKva: number | null;
  staffName: string | null;
}

export interface FeederRow extends BaseRow {
  substationName: string;
  name: string;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  address: string | null;
  capacityKva: number | null;
  staffName: string | null;
}

export interface TransformerRow extends BaseRow {
  substationName: string;
  feederName: string;
  name: string;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  onlineSubscribers: number;
  offlineSubscribers: number;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  capacityKva: number | null;
  currentRepairDate: Date | null;
  overhaulDate: Date | null;
  staffName: string | null;
}

export interface SubscriberRow extends BaseRow {
  fullName: string;
  substationName: string;
  feederName: string;
  transformerName: string;
  kind: SubscriberKind;
  staffName: string | null;
  meterStatus: MeterStatus;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  contractNumber: string;
  meterSerial: string | null;
  meterType: string | null;
  debtUzs: number;
  creditUzs: number;
  meterReading: number | null;
  lastReadingAt: Date | null;
  lastPaymentDate: Date | null;
  lastPaymentUzs: number | null;
  contractDate: Date | null;
  passport: string | null;
  pinfl: string | null;
  meterInstalledAt: Date | null;
}

/** Hodisa qayerda: ixtiyoriy "Podstansiya" / "Fider" (bir xil raqamli TP larni ajratadi, 4.3d). */
interface EventPlace {
  substationName: string | null;
  feederName: string | null;
}

export interface ViolationRow extends BaseRow, EventPlace {
  /** "TP Nomi" - bo'sh bo'lishi mumkin (TP abonent orqali aniqlanadi, 4.3d). */
  transformerName: string | null;
  subscriberName: string;
  violatorType: ViolatorType;
  date: Date;
  address: string | null;
  damageUzs: number;
  damageKwh: number;
  staffName: string | null;
}

export interface AppealRow extends BaseRow, EventPlace {
  /** "TP Nomi" - bo'sh bo'lishi mumkin (TP abonent orqali aniqlanadi, 4.3d). */
  transformerName: string | null;
  text: string;
  subscriberName: string;
  date: Date;
  address: string | null;
  status: AppealStatus;
  staffName: string | null;
}

export interface TemplateRowMap {
  SUBSTATIONS: SubstationRow;
  FEEDERS: FeederRow;
  TRANSFORMERS: TransformerRow;
  SUBSCRIBERS: SubscriberRow;
  VIOLATIONS: ViolationRow;
  APPEALS: AppealRow;
}

export type AnyRow = TemplateRowMap[TemplateType];

/* ---------------------------------------------------------------------------
   Ustun turlari
   --------------------------------------------------------------------------- */

/**
 * Ustun sig'imi: bazaga yozilganda ustun aniqligiga (`scale`) yuvarlangan
 * qiymatning moduli `limit` dan KICHIK bo'lishi shart. Decimal(18, 2) sig'imi
 * 10^16, lekin JS soni 2^53 dan keyin aniqligini yo'qotadi - 10^15 bilan
 * cheklanadi.
 */
const AMOUNT_LIMIT = { scale: 2, limit: 1e15 } as const;
/** Decimal(12, 2) - "Quvvati (KVA)": ko'pi bilan 9 999 999 999,99. */
const CAPACITY_LIMIT = { scale: 2, limit: 1e10 } as const;
/** Decimal(9, 6) - lokatsiya (oraliq tekshiruvi undan ham tor). */
const COORDINATE_LIMIT = { scale: 6, limit: 1000 } as const;
/** Postgres INTEGER: ko'pi bilan 2 147 483 647. */
const INT_LIMIT = { scale: 0, limit: 2_147_483_648 } as const;

interface NumberType {
  kind: "number";
  /** Ustundagi kasr xonalari (Decimal(p, s) dagi s; butun son - 0). */
  scale: number;
  /** Yuvarlangan qiymat moduli shundan kichik bo'lishi shart (ustun sig'imi). */
  limit: number;
  /** Manfiy son xato. */
  nonNegative?: boolean;
  /** Berilsa - `min..max` oraliq tekshiriladi, xabarda `label` ("-90..90"). */
  range?: { min: number; max: number; label: string };
  /** Bo'sh katak = 0. */
  emptyAsZero?: boolean;
}

export type FieldType =
  | { kind: "text" }
  | NumberType
  | ({ kind: "integer" } & Omit<NumberType, "kind">)
  | { kind: "date"; withTime?: boolean }
  | { kind: "enum"; spec: EnumSpec<string> };

/**
 * Ustun sig'imiga sig'adimi. Postgres qiymatni o'nlik ko'rinishidan (`String(n)`)
 * "yarimdan uzoqqa" yuvarlaydi: `limit - 0,5 * 10^-scale` va undan kattasi
 * `limit` ga yuvarlanib, "numeric field overflow" beradi - shuning uchun
 * chegara yuvarlashdan oldingi qiymatda shu nuqtadan olinadi.
 */
export function fitsColumn(value: number, type: Pick<NumberType, "scale" | "limit">): boolean {
  return Math.abs(value) < type.limit - 0.5 * 10 ** -type.scale;
}

export interface ColumnSpec {
  /** Qator obyektidagi maydon. */
  field: string;
  /** Xabarlarda ko'rsatiladigan sarlavha (shablondagi yozuv, apostrof ’). */
  header: string;
  /** Qo'shimcha qabul qilinadigan sarlavhalar. */
  aliases?: readonly string[];
  required: boolean;
  type: FieldType;
}

const TEXT: FieldType = { kind: "text" };
const AMOUNT: FieldType = { kind: "number", ...AMOUNT_LIMIT, nonNegative: true };
const SIGNED_AMOUNT: FieldType = { kind: "number", ...AMOUNT_LIMIT };
const AMOUNT_OR_ZERO: FieldType = { kind: "number", ...AMOUNT_LIMIT, nonNegative: true, emptyAsZero: true };
const CAPACITY: FieldType = { kind: "number", ...CAPACITY_LIMIT, nonNegative: true };
const COUNT_OR_ZERO: FieldType = { kind: "integer", ...INT_LIMIT, nonNegative: true, emptyAsZero: true };
const LATITUDE: FieldType = { kind: "number", ...COORDINATE_LIMIT, range: { min: -90, max: 90, label: "-90..90" } };
const LONGITUDE: FieldType = {
  kind: "number",
  ...COORDINATE_LIMIT,
  range: { min: -180, max: 180, label: "-180..180" },
};
const DATE: FieldType = { kind: "date" };

const col = (
  field: string,
  header: string,
  required: boolean,
  type: FieldType,
  aliases?: readonly string[],
): ColumnSpec => ({ field, header, required, type, aliases });

/* ---------------------------------------------------------------------------
   Shablonlar
   --------------------------------------------------------------------------- */

export interface TemplateSpec {
  type: TemplateType;
  columns: readonly ColumnSpec[];
  /** Ma'lumot qatorisiz fayl ruxsat etiladimi ("bu oyda yo'q"). */
  allowEmpty: boolean;
  /** Fayl ichidagi noyoblik kaliti; null - tekshirilmaydi. */
  rowKey: ((row: AnyRow) => string) | null;
  /** Takroriy kalit xabari uchun ustun nomi. */
  keyColumn: string | null;
  /** Takroriy kalitni odam o'qiydigan ko'rinishi. */
  keyLabel: ((row: AnyRow) => string) | null;
}

/** Kompozit kalit ajratuvchisi - boshqaruv belgisi, nomlarda uchramaydi. */
export const KEY_SEP = String.fromCharCode(31);

export const substationKey = (substation: string) => nameKey(substation);
export const feederKey = (substation: string, feeder: string) =>
  `${nameKey(substation)}${KEY_SEP}${nameKey(feeder)}`;
export const transformerKey = (substation: string, feeder: string, transformer: string) =>
  `${nameKey(substation)}${KEY_SEP}${nameKey(feeder)}${KEY_SEP}${nameKey(transformer)}`;

const SUBSCRIBER_KIND: EnumSpec<SubscriberKind> = { labels: SUBSCRIBER_KIND_LABEL };
const METER_STATUS: EnumSpec<MeterStatus> = { labels: METER_STATUS_LABEL };
const VIOLATOR_TYPE: EnumSpec<ViolatorType> = {
  labels: VIOLATOR_TYPE_LABEL,
  aliases: { Aybsiz: "INNOCENT" },
};
const APPEAL_STATUS: EnumSpec<AppealStatus> = { labels: APPEAL_STATUS_LABEL };

const STAFF = col("staffName", "Ma’sul xodim", false, TEXT);
const ADDRESS = col("address", "Manzil", false, TEXT);
const TOTAL = col("totalKwh", "Umumiy oqim", true, AMOUNT);
const USEFUL = col("usefulKwh", "Foydali oqim", true, AMOUNT);
const LOSS = col("lossKwh", "Yo’qotish", true, SIGNED_AMOUNT);
const LAT = col("latitude", "Lokatsiya (Lat)", false, LATITUDE);
const LONG = col("longitude", "Lokatsiya (Long)", false, LONGITUDE);
const KVA = col("capacityKva", "Quvvati (KVA)", false, CAPACITY);
const EVENT_SUBSTATION = col("substationName", "Podstansiya", false, TEXT);
const EVENT_FEEDER = col("feederName", "Fider", false, TEXT);

export const TEMPLATES: Record<TemplateType, TemplateSpec> = {
  SUBSTATIONS: {
    type: "SUBSTATIONS",
    columns: [col("name", "Podstansiya Nomi", true, TEXT), TOTAL, USEFUL, LOSS, ADDRESS, LAT, LONG, KVA, STAFF],
    allowEmpty: false,
    rowKey: (row) => substationKey((row as SubstationRow).name),
    keyColumn: "Podstansiya Nomi",
    keyLabel: (row) => `“${(row as SubstationRow).name}”`,
  },
  FEEDERS: {
    type: "FEEDERS",
    columns: [
      col("substationName", "Podstansiya", true, TEXT),
      col("name", "Fider Nomi", true, TEXT),
      TOTAL,
      USEFUL,
      LOSS,
      ADDRESS,
      KVA,
      STAFF,
    ],
    allowEmpty: false,
    rowKey: (row) => feederKey((row as FeederRow).substationName, (row as FeederRow).name),
    keyColumn: "Fider Nomi",
    keyLabel: (row) => `“${(row as FeederRow).substationName} / ${(row as FeederRow).name}”`,
  },
  TRANSFORMERS: {
    type: "TRANSFORMERS",
    columns: [
      col("substationName", "Podstansiya", true, TEXT),
      col("feederName", "Fider", true, TEXT),
      col("name", "TP Nomi", true, TEXT),
      TOTAL,
      USEFUL,
      LOSS,
      col("onlineSubscribers", "Aloqadagi abonentlar", false, COUNT_OR_ZERO),
      col("offlineSubscribers", "Aloqadan chiqqan abonentlar", false, COUNT_OR_ZERO),
      ADDRESS,
      LAT,
      LONG,
      KVA,
      col("currentRepairDate", "Joriy ta’mir sanasi", false, DATE),
      col("overhaulDate", "To’la ta’mir sanasi", false, DATE),
      STAFF,
    ],
    allowEmpty: false,
    rowKey: (row) => {
      const tp = row as TransformerRow;
      return transformerKey(tp.substationName, tp.feederName, tp.name);
    },
    keyColumn: "TP Nomi",
    keyLabel: (row) => {
      const tp = row as TransformerRow;
      return `“${tp.substationName} / ${tp.feederName} / ${tp.name}”`;
    },
  },
  SUBSCRIBERS: {
    type: "SUBSCRIBERS",
    columns: [
      col("fullName", "FISH", true, TEXT),
      col("substationName", "Podstansiya", true, TEXT),
      col("feederName", "Fider", true, TEXT),
      col("transformerName", "TP", true, TEXT, ["TP Nomi"]),
      col("kind", "Abonent turi (Yuridik/Aholi)", true, { kind: "enum", spec: SUBSCRIBER_KIND }, [
        "Abonent turi",
      ]),
      col("staffName", "Biriktirilgan xodim", false, TEXT),
      col(
        "meterStatus",
        "Holati (Aloqada / Aloqaga chiqmayotgan / Sxemasi o’zgartirilgan)",
        true,
        { kind: "enum", spec: METER_STATUS },
        ["Holati"],
      ),
      ADDRESS,
      LAT,
      LONG,
      col("contractNumber", "Shartnoma raqami", true, TEXT),
      col("meterSerial", "Hisoblagich zavod raqami", false, TEXT),
      col("meterType", "Hisoblagich turi", false, TEXT),
      col("debtUzs", "Qarzdorlik", false, AMOUNT_OR_ZERO),
      col("creditUzs", "Haqdorlik", false, AMOUNT_OR_ZERO),
      col("meterReading", "Hisoblagich ko’rsatgichi", false, AMOUNT),
      col("lastReadingAt", "Oxirgi olingan ma’lumot", false, { kind: "date", withTime: true }),
      col("lastPaymentDate", "Oxirgi to’langan to’lov", false, DATE),
      col("lastPaymentUzs", "Oxirgi to’langan summa", false, AMOUNT),
      col("contractDate", "Shartnoma sanasi", false, DATE),
      col("passport", "Passport", false, TEXT),
      col("pinfl", "Pinfl", false, TEXT),
      col("meterInstalledAt", "Hisoblagich o’rnatilingan sana", false, DATE),
    ],
    allowEmpty: false,
    rowKey: (row) => contractKey((row as SubscriberRow).contractNumber),
    keyColumn: "Shartnoma raqami",
    keyLabel: (row) => `“${(row as SubscriberRow).contractNumber}”`,
  },
  VIOLATIONS: {
    type: "VIOLATIONS",
    columns: [
      EVENT_SUBSTATION,
      EVENT_FEEDER,
      col("transformerName", "TP Nomi", false, TEXT),
      col("subscriberName", "Abonent", true, TEXT),
      col("violatorType", "Turi (Yuridik/Jismoniy/Aybisiz)", true, { kind: "enum", spec: VIOLATOR_TYPE }, [
        "Turi",
      ]),
      col("date", "Sana", true, DATE),
      ADDRESS,
      col("damageUzs", "Keltirilgan zarar miqdori (UZS)", false, AMOUNT_OR_ZERO),
      col("damageKwh", "Taxminiy zarar (kWh)", false, AMOUNT_OR_ZERO),
      STAFF,
    ],
    allowEmpty: true,
    rowKey: null,
    keyColumn: null,
    keyLabel: null,
  },
  APPEALS: {
    type: "APPEALS",
    columns: [
      EVENT_SUBSTATION,
      EVENT_FEEDER,
      col("transformerName", "TP Nomi", false, TEXT),
      col("text", "Murojaat", true, TEXT),
      col("subscriberName", "Abonent", true, TEXT),
      col("date", "Sana", true, DATE),
      ADDRESS,
      col(
        "status",
        "Holati (Ijobiy hal etilgan / Rad etilgan / Jarayonda / Muddati buzilgan)",
        true,
        { kind: "enum", spec: APPEAL_STATUS },
        ["Holati"],
      ),
      STAFF,
    ],
    allowEmpty: true,
    rowKey: null,
    keyColumn: null,
    keyLabel: null,
  },
};

/* ---------------------------------------------------------------------------
   Sarlavha solishtirish
   --------------------------------------------------------------------------- */

/**
 * Sarlavha kaliti: `\n`, ortiqcha bo'shliq, apostrof turi va registr farq
 * qilmaydi; qavs va "/" atrofidagi bo'shliqlar ham e'tiborsiz.
 */
export function headerKey(text: string): string {
  return nameKey(text)
    .replace(/'/g, "")
    .replace(/\s*([()/])\s*/g, "$1")
    .trim();
}

/** Ustun sarlavhaga mos keladimi. */
export function columnMatches(column: ColumnSpec, key: string): boolean {
  if (headerKey(column.header) === key) return true;
  return (column.aliases ?? []).some((alias) => headerKey(alias) === key);
}

/* ---------------------------------------------------------------------------
   Katakni ustun turi bo'yicha o'qish
   --------------------------------------------------------------------------- */

const fmt = (value: number) => String(value).replace(".", ",");

export function readField(
  type: FieldType,
  value: PlainValue | null,
  context: { date1904: boolean },
): CellRead<unknown> {
  switch (type.kind) {
    case "text":
      return readText(value);
    case "date":
      return readDate(value, { withTime: type.withTime, date1904: context.date1904 });
    case "enum":
      return readEnum(value, type.spec);
    case "number":
    case "integer": {
      const result = type.kind === "integer" ? readInteger(value) : readNumber(value);
      if (!result.ok) return result;
      const number = result.value;
      if (number == null) return { ok: true, value: type.emptyAsZero ? 0 : null };
      if (type.range && (number < type.range.min || number > type.range.max)) {
        return { ok: false, message: `Qiymat ${type.range.label} oralig’ida bo’lishi kerak: ${fmt(number)}` };
      }
      if (type.nonNegative && number < 0) {
        return { ok: false, message: `Manfiy bo’lishi mumkin emas: ${fmt(number)}` };
      }
      if (!fitsColumn(number, type)) {
        return {
          ok: false,
          message: `Qiymat juda katta: ${fmt(number)} (${num(type.limit)} dan kichik bo’lishi kerak)`,
        };
      }
      return result;
    }
  }
}
