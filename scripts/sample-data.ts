/*
 * Namunaviy (FAQAT TEST uchun) Excel fayllar generatori. Ilova buni hech
 * qachon ishga tushirmaydi va bazaga tegmaydi.
 *
 *   npx tsx scripts/sample-data.ts
 *
 * Natija (`.samples/`, gitignore'da):
 *   2026-07/, 2026-08/, 2026-09/  har birida 6 ta TO'LIQ TO'G'RI shablon fayli
 *                                 (fayl nomlari `data_template/` dagi kabi);
 *   invalid/                      har biri bitta aniq xato beradigan fayllar
 *                                 va README.txt (kutilgan xato tavsifi).
 *
 * Fayllar `data_template/` dagi bo'sh shablondan quriladi - sarlavha uslubi va
 * birlashtirilgan 1-qator saqlanadi. Tasodifiylik urug'li PRNG orqali: har
 * safar aynan bir xil ma'lumot chiqadi.
 *
 * Yozib bo'lingach har bir fayl exceljs bilan QAYTA O'QILADI va
 * `.claude/docs/malumotlar.md` 4-bo'lim qoidalari (hamda namunaning o'z
 * shartlari) tekshiriladi. Biror qoida buzilsa - skript xato kodi bilan
 * to'xtaydi.
 */

import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

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
  TEMPLATE_FILE_NAME,
  TEMPLATE_ORDER,
  VIOLATOR_TYPE_LABEL,
} from "@/lib/domain/labels";
import { cleanText, contractKey, nameKey } from "@/lib/domain/normalize";
import { MONTHS_UZ } from "@/lib/format";
import { BALIQCHI_DISTRICT } from "@/lib/geo/boundaries";

const ROOT = process.cwd();
const TEMPLATE_DIR = path.join(ROOT, "data_template");
const OUTPUT_DIR = path.join(ROOT, ".samples");

/* ---------------------------------------------------------------------------
   Urug'li tasodifiylik
   --------------------------------------------------------------------------- */

const SEED = "baliqchi-2026";

function hashText(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * mulberry32. Har bir obyekt o'z oqimidan foydalanadi (`new Rng("tp:12")`) -
 * bitta obyekt qo'shilsa qolganlarining qiymatlari surilib ketmaydi.
 */
class Rng {
  private state: number;

  constructor(stream: string) {
    this.state = hashText(`${SEED}:${stream}`);
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] oralig'idagi butun son. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick: bo'sh ro'yxat");
    return items[Math.floor(this.next() * items.length)];
  }

  weighted<T>(weights: readonly (readonly [T, number])[]): T {
    const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.next() * total;
    for (const [value, weight] of weights) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return weights[weights.length - 1][0];
  }
}

/* ---------------------------------------------------------------------------
   Sanalar va oylar
   --------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;

/** Sanalar UTC da: exceljs Date ni UTC maydonlari bo'yicha Excel seriyasiga yozadi. */
function utcDate(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hours, minutes));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function dateBetween(rng: Rng, from: Date, to: Date): Date {
  return addDays(from, rng.int(0, Math.round((to.getTime() - from.getTime()) / DAY_MS)));
}

function hasTime(date: Date): boolean {
  return date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0;
}

/** "13.08.2026" */
function dmyText(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getUTCFullYear()}`;
}

/** "2026-08-13" */
function isoText(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface MonthInfo {
  index: number;
  /** "2026-09" */
  key: string;
  /** "Sentabr" - sarlavha qatori uchun. */
  name: string;
  /** "13-sentabr, 2026" */
  sheetName: string;
  reportDate: Date;
}

const MONTHS: readonly MonthInfo[] = [7, 8, 9].map((month, index) => ({
  index,
  key: `2026-${String(month).padStart(2, "0")}`,
  name: MONTHS_UZ[month - 1],
  sheetName: `13-${MONTHS_UZ[month - 1].toLowerCase()}, 2026`,
  reportDate: utcDate(2026, month, 13),
}));

/** Iste'mol mavsumiyligi: iyul-avgust issiq (konditsioner), sentabr pasayadi. */
const SEASON = [1.12, 1.18, 0.96] as const;

/* ---------------------------------------------------------------------------
   Nomlar
   --------------------------------------------------------------------------- */

/** 10 ta xodim - barcha shablonlarda shular ishlatiladi. */
const STAFF = [
  "Karimov Egamberdi",
  "Yusupov Sardor",
  "Tursunov Bekzod",
  "Aliyev Jasur",
  "Nazarov Oybek",
  "Rahimov Shuhrat",
  "Sobirov Dilshod",
  "Yo’ldoshev Ulug’bek",
  "Qodirova Nodira",
  "Ergashev Rustam",
] as const;

const SUBSTATION_SPECS = [
  {
    name: "Baliqchi",
    mahalla: "Baliqchi shaharchasi",
    center: { lon: 71.84, lat: 40.875 },
    capacityKva: 40000,
    feeders: ["Markaz", "Navbahor", "Paxtakor", "Guliston", "Yangi hayot"],
  },
  {
    name: "Chinobod",
    mahalla: "Chinobod",
    center: { lon: 71.9, lat: 40.845 },
    capacityKva: 25000,
    feeders: ["Chinobod-1", "Chinobod-2", "Istiqlol", "Do’stlik"],
  },
  {
    name: "Bo’ston",
    mahalla: "Bo’ston",
    center: { lon: 71.95, lat: 40.815 },
    capacityKva: 16000,
    feeders: ["Markaz", "Bog’ishamol", "Tinchlik", "Mustaqillik", "Sohil", "Qo’shariq"],
  },
  {
    name: "Oqtepa",
    mahalla: "Oqtepa",
    center: { lon: 72.13, lat: 40.838 },
    capacityKva: 10000,
    feeders: ["Oqtepa-1", "Oqtepa-2", "Uchqun", "Bunyodkor", "Tong"],
  },
] as const;

/** Avgustda qo'shiladigan fider (Chinobod podstansiyasiga). */
const LATER_FEEDER = { substation: "Chinobod", name: "Yangiobod", fromMonth: 1 } as const;

const MAHALLAS = [
  "Navbahor", "Guliston", "Paxtaobod", "Istiqlol", "Do’stlik", "Uchqun", "Sohil",
  "Tinchlik", "Yangiobod", "Qo’shariq", "Bog’ishamol", "Mustaqillik", "Oqtepa",
  "Chinobod", "Bo’ston", "Kattaerkin",
] as const;

const STREETS = [
  "Navoiy", "Amir Temur", "Mustaqillik", "Bog’", "Tinchlik", "Yoshlik", "Bobur",
  "Istiqlol", "Paxtakor", "Guliston", "Ulug’bek", "Chinor",
] as const;

const SURNAMES = [
  "Karimov", "Yusupov", "Tursunov", "Aliyev", "Nazarov", "Rahimov", "Sobirov",
  "Ergashev", "Xolmatov", "Qodirov", "Sultonov", "Mirzayev", "Umarov",
  "Toshpo’latov", "Yo’ldoshev", "Hasanov", "Abdullayev", "Nurmatov", "Islomov",
  "Saidov", "Tolipov", "Bekmurodov", "Ismoilov", "Jo’rayev",
] as const;

const MALE_NAMES = [
  "Egamberdi", "Bekzod", "Oybek", "Dilshod", "Rustam", "Aziz", "Sanjar", "Akmal",
  "Jahongir", "Farrux", "Ilhom", "Otabek", "Sardor", "Jasur", "Shuhrat", "Ulug’bek",
] as const;

const FEMALE_NAMES = [
  "Nodira", "Malika", "Zulfiya", "Nilufar", "Dilnoza", "Gulnora", "Sevara", "Feruza",
  "Shahzoda", "Mohira", "Zilola", "Nargiza", "Munira", "Kamola", "Ozoda", "Ra’no",
] as const;

const FATHER_NAMES = [
  "Xolmat", "Rustam", "Anvar", "Baxtiyor", "Ravshan", "Shavkat", "Abdulla",
  "Ismoil", "Tohir", "Murod", "Hamid", "Zokir", "Olim", "Karim",
] as const;

const FIRM_PREFIX = [
  "Baliqchi", "Andijon", "Sharq", "Oq Oltin", "Chinobod", "Universal", "Yangi",
  "Agro", "Nur", "Zamin", "Farovon", "Buyuk", "Oltin Vodiy", "Marvarid", "Diyor",
  "Hamkor",
] as const;

const FIRM_SUFFIX = ["Non", "Teks", "Savdo", "Qurilish", "Servis", "Sut", "Logistika", "Yulduzi"] as const;

const FIRM_FORM = ["MChJ", "QK", "XK"] as const;

const BUDGET_KINDS = [
  "umumta’lim maktabi",
  "bolalar bog’chasi",
  "oilaviy poliklinika",
  "kasb-hunar maktabi",
] as const;

const METER_TYPES_HOUSEHOLD = ["CE102 R5.1", "Mercury 201.8", "TE-73", "Energomera CE101"] as const;
const METER_TYPES_LEGAL = ["CE301 R33", "Mercury 230 ART", "TE-73 3F"] as const;

const APPEAL_TEXTS = [
  "Kuchlanish pastligi bo’yicha shikoyat",
  "Elektr ta’minoti uzilishi",
  "Hisoblagich ko’rsatkichi noto’g’ri hisoblangan",
  "Qayta hisob-kitob qilish so’rovi",
  "Yangi hisoblagich o’rnatish",
  "Liniya simi uzilgan",
  "Transformator shovqini",
  "To’lov hisobga olinmagan",
  "Yangi ulanish uchun ariza",
  "Hisoblagich plombasi buzilgan",
] as const;

function asciiApostrophes(text: string): string {
  return text.replace(/’/g, "'");
}

function personName(rng: Rng): string {
  const female = rng.chance(0.4);
  const surname = rng.pick(SURNAMES);
  const father = rng.pick(FATHER_NAMES);
  const fatherStem = father.endsWith("a") ? `${father}y` : father;
  return female
    ? `${surname}a ${rng.pick(FEMALE_NAMES)} ${fatherStem}${father.endsWith("a") ? "evna" : "ovna"}`
    : `${surname} ${rng.pick(MALE_NAMES)} ${fatherStem}${father.endsWith("a") ? "evich" : "ovich"}`;
}

function legalName(rng: Rng): string {
  if (rng.chance(0.25)) return `${rng.int(1, 60)}-son ${rng.pick(BUDGET_KINDS)}`;
  return `“${rng.pick(FIRM_PREFIX)} ${rng.pick(FIRM_SUFFIX)}” ${rng.pick(FIRM_FORM)}`;
}

/* ---------------------------------------------------------------------------
   Geografiya
   --------------------------------------------------------------------------- */

interface Point {
  lat: number;
  lon: number;
}

const DISTRICT_RING = BALIQCHI_DISTRICT.rings[0];
const [BBOX_MIN_LON, BBOX_MIN_LAT, BBOX_MAX_LON, BBOX_MAX_LAT] = BALIQCHI_DISTRICT.bbox;

/** Nuqta Baliqchi tumani chegarasi (ko'pburchak) ichidami - ray casting. */
function insideDistrict(point: Point): boolean {
  let inside = false;
  for (let i = 0, j = DISTRICT_RING.length - 1; i < DISTRICT_RING.length; j = i++) {
    const [xi, yi] = DISTRICT_RING[i];
    const [xj, yj] = DISTRICT_RING[j];
    if (yi > point.lat !== yj > point.lat && point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function insideBbox(point: Point): boolean {
  return (
    point.lon >= BBOX_MIN_LON && point.lon <= BBOX_MAX_LON &&
    point.lat >= BBOX_MIN_LAT && point.lat <= BBOX_MAX_LAT
  );
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Markaz atrofida tuman ichidagi tasodifiy nuqta (topilmasa - markazning o'zi). */
function scatter(rng: Rng, center: Point, radius: number): Point {
  for (let attempt = 0; attempt < 60; attempt++) {
    const point = {
      lat: round6(center.lat + rng.float(-radius, radius)),
      lon: round6(center.lon + rng.float(-radius, radius) * 1.3),
    };
    if (insideDistrict(point)) return point;
  }
  return center;
}

/* ---------------------------------------------------------------------------
   Tuman modeli (oydan oyga barqaror obyektlar + oylik holatlar)
   --------------------------------------------------------------------------- */

interface EnergyMonth {
  totalCents: number;
  usefulCents: number;
  staff: string | null;
}

interface SubstationEntity {
  index: number;
  name: string;
  mahalla: string;
  point: Point;
  capacityKva: number;
  lossRate: number;
  feeders: FeederEntity[];
  months: EnergyMonth[];
}

interface FeederEntity {
  id: number;
  substation: SubstationEntity;
  name: string;
  fromMonth: number;
  point: Point;
  capacityKva: number;
  address: string | null;
  lineLoss: number;
  staff: string;
  transformers: TransformerEntity[];
  months: (EnergyMonth | null)[];
}

interface TransformerMonth extends EnergyMonth {
  online: number;
  offline: number;
  currentRepairDate: Date | null;
}

interface TransformerEntity {
  id: number;
  feeder: FeederEntity;
  name: string;
  /** Excel'da son sifatida yoziladi (TP nomi `7`). */
  numericName: boolean;
  fromMonth: number;
  address: string;
  mahalla: string;
  point: Point | null;
  capacityKva: number;
  baseLoss: number;
  overhaulDate: Date | null;
  months: (TransformerMonth | null)[];
}

interface SubscriberMonth {
  status: MeterStatus;
  consumptionKwh: number;
  readingTenths: number;
  debtCents: number;
  creditCents: number;
  lastReadingAt: Date | null;
  lastPaymentDate: Date | null;
  lastPaymentCents: number | null;
}

interface SubscriberEntity {
  id: number;
  contract: string;
  kind: SubscriberKind;
  fullName: string;
  /** Har oy qaysi TP da (null - shu oyda ro'yxatda yo'q). */
  tpByMonth: (TransformerEntity | null)[];
  staff: string | null;
  address: string;
  point: Point | null;
  meterSerial: string;
  meterType: string;
  contractDate: Date;
  installedAt: Date;
  passport: string | null;
  pinfl: string | null;
  pinflAsNumber: boolean;
  /** Hech qachon o'chirilmaydi (maxsus katak formatlari shu abonentlarda). */
  pinned: boolean;
  baseReadingTenths: number;
  monthlyKwh: number;
  months: (SubscriberMonth | null)[];
}

interface District {
  substations: SubstationEntity[];
  feeders: FeederEntity[];
  transformers: TransformerEntity[];
  subscribers: SubscriberEntity[];
  /** Barcha abonent nomlarining kalitlari - "begona" qoidabuzar nomi to'qnashmasin. */
  subscriberNameKeys: Set<string>;
  duplicatedTpName: string;
}

/** Maxsus TP nomlari: boshlovchi nol ("07") va son sifatida yoziladigan `7`. */
const SPECIAL_TP_NAMES = new Map<number, { name: string; numeric: boolean }>([
  [4, { name: "07", numeric: false }],
  [17, { name: "04", numeric: false }],
  [23, { name: "7", numeric: true }],
  [30, { name: "09", numeric: false }],
]);

const CAPACITIES_TP = [63, 100, 160, 250, 400, 630] as const;
const CAPACITIES_FEEDER = [2500, 4000, 6300, 10000] as const;

function activeIn<T extends { fromMonth: number }>(items: readonly T[], month: number): T[] {
  return items.filter((item) => item.fromMonth <= month);
}

function buildDistrict(): District {
  const feeders: FeederEntity[] = [];
  const transformers: TransformerEntity[] = [];
  let tpSeq = 0;

  const createTransformer = (feeder: FeederEntity, fromMonth: number): TransformerEntity => {
    tpSeq += 1;
    const rng = new Rng(`tp:${tpSeq}`);
    const special = SPECIAL_TP_NAMES.get(tpSeq);
    const name = special?.name ?? (tpSeq % 7 === 3 ? `A${300 + tpSeq}` : `TP-${tpSeq + 10}`);
    const mahalla = rng.pick(MAHALLAS);
    const tp: TransformerEntity = {
      id: tpSeq,
      feeder,
      name,
      numericName: special?.numeric ?? false,
      fromMonth,
      mahalla,
      address: `${mahalla} MFY, ${rng.pick(STREETS)} ko’chasi`,
      point: rng.chance(0.94) ? scatter(rng, feeder.point, 0.012) : null,
      capacityKva: rng.pick(CAPACITIES_TP),
      baseLoss: rng.float(0.04, 0.16),
      overhaulDate: rng.chance(0.65)
        ? dateBetween(rng, utcDate(2018, 1, 1), utcDate(2027, 6, 30))
        : null,
      months: [null, null, null],
    };
    feeder.transformers.push(tp);
    transformers.push(tp);
    return tp;
  };

  const createFeeder = (substation: SubstationEntity, name: string, fromMonth: number, tpCount: number) => {
    const id = feeders.length + 1;
    const rng = new Rng(`feeder:${id}`);
    const feeder: FeederEntity = {
      id,
      substation,
      name,
      fromMonth,
      point: scatter(rng, substation.point, 0.02),
      capacityKva: rng.pick(CAPACITIES_FEEDER),
      address: rng.chance(0.8) ? `Baliqchi tumani, ${rng.pick(MAHALLAS)} MFY` : null,
      lineLoss: rng.float(0.02, 0.05),
      staff: rng.pick(STAFF),
      transformers: [],
      months: [null, null, null],
    };
    substation.feeders.push(feeder);
    feeders.push(feeder);
    for (let index = 0; index < tpCount; index++) createTransformer(feeder, fromMonth);
    return feeder;
  };

  const substations: SubstationEntity[] = SUBSTATION_SPECS.map((spec, index) => ({
    index,
    name: spec.name,
    mahalla: spec.mahalla,
    point: spec.center,
    capacityKva: spec.capacityKva,
    lossRate: new Rng(`substation:${index}`).float(0.01, 0.03),
    feeders: [],
    months: [],
  }));

  SUBSTATION_SPECS.forEach((spec, index) => {
    for (const feederName of spec.feeders) {
      const rng = new Rng(`feeder-size:${spec.name}:${feederName}`);
      createFeeder(substations[index], feederName, 0, rng.int(6, 10));
    }
  });

  // Avgustda yangi fider va har oy bir nechta yangi TP.
  const laterSubstation = substations.find((item) => item.name === LATER_FEEDER.substation);
  if (!laterSubstation) throw new Error("Yangi fider podstansiyasi topilmadi");
  createFeeder(laterSubstation, LATER_FEEDER.name, LATER_FEEDER.fromMonth, 6);
  for (const [month, count] of [[1, 2], [2, 3]] as const) {
    const rng = new Rng(`growth:tp:${month}`);
    for (let index = 0; index < count; index++) {
      const candidates = feeders.filter((feeder) => feeder.fromMonth === 0 && feeder.transformers.length < 10);
      createTransformer(rng.pick(candidates), month);
    }
  }

  // Yagona takroriy TP nomi: ikki xil podstansiyadagi ikki xil fiderda.
  const source = substations[0].feeders[1].transformers.find((tp) => tp.name.startsWith("TP-"));
  const target = substations[2].feeders[0].transformers.find((tp) => tp.name.startsWith("TP-"));
  if (!source || !target) throw new Error("Takroriy TP nomi uchun TP topilmadi");
  target.name = source.name;

  const district: District = {
    substations,
    feeders,
    transformers,
    subscribers: [],
    subscriberNameKeys: new Set(),
    duplicatedTpName: source.name,
  };
  buildSubscribers(district);
  computeMonths(district);
  return district;
}

/* ---------------------------------------------------------------------------
   Abonentlar: yaratish, o'chirish, qo'shish, TP almashtirish
   --------------------------------------------------------------------------- */

function buildSubscribers(district: District): void {
  const { subscribers, subscriberNameKeys } = district;

  const uniqueName = (rng: Rng, kind: SubscriberKind): string => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const name = kind === "LEGAL" ? legalName(rng) : personName(rng);
      if (!subscriberNameKeys.has(nameKey(name))) {
        subscriberNameKeys.add(nameKey(name));
        return name;
      }
    }
    throw new Error("Noyob abonent nomi topilmadi");
  };

  const create = (tp: TransformerEntity, fromMonth: number): SubscriberEntity => {
    const id = subscribers.length + 1;
    const rng = new Rng(`subscriber:${id}`);
    const kind: SubscriberKind = rng.chance(0.08) ? "LEGAL" : "HOUSEHOLD";
    const legal = kind === "LEGAL";
    const reportDate = MONTHS[fromMonth].reportDate;
    const contractDate = fromMonth === 0
      ? dateBetween(rng, utcDate(2005, 1, 1), utcDate(2025, 12, 31))
      : dateBetween(rng, addDays(reportDate, -28), addDays(reportDate, -1));
    // Hisoblagich shartnomadan keyin o'rnatilgan: eski abonentlarda shartnoma
    // sanasi va hisobotdan 30 kun oldingi kun oralig'ida teng taqsimlangan.
    const installedAt = fromMonth === 0
      ? dateBetween(rng, contractDate, addDays(reportDate, -30))
      : addDays(contractDate, rng.int(0, 1));
    const street = rng.pick(STREETS);
    const subscriber: SubscriberEntity = {
      id,
      contract: `BQ${104000 + id * 3}`,
      kind,
      fullName: uniqueName(rng, kind),
      tpByMonth: MONTHS.map((month) => (month.index >= fromMonth ? tp : null)),
      staff: rng.chance(0.88) ? (rng.chance(0.8) ? tp.feeder.staff : rng.pick(STAFF)) : null,
      address: legal
        ? `${tp.mahalla} MFY, ${street} ko’chasi, ${rng.int(1, 120)}`
        : `${tp.mahalla} MFY, ${street} ko’chasi, ${rng.int(1, 140)}-uy`,
      point: rng.chance(0.86) && tp.point ? scatter(rng, tp.point, 0.0025) : null,
      meterSerial: String(rng.int(1, 99_999_999)).padStart(10, "0"),
      meterType: rng.pick(legal ? METER_TYPES_LEGAL : METER_TYPES_HOUSEHOLD),
      contractDate,
      installedAt,
      passport: legal ? null : `${rng.pick(["AA", "AB", "AC", "AD", "AE"])}${rng.int(1_000_000, 9_999_999)}`,
      // 14 xonali; birinchi raqam 3..6 - son sifatida yozilganda ham nol yo'qolmaydi.
      pinfl: legal
        ? null
        : `${rng.int(3, 6)}${String(rng.int(0, 999_999)).padStart(6, "0")}${String(rng.int(0, 9_999_999)).padStart(7, "0")}`,
      pinflAsNumber: false,
      pinned: false,
      baseReadingTenths: fromMonth === 0 ? rng.int(10_000, legal ? 4_000_000 : 400_000) : rng.int(0, 500),
      monthlyKwh: legal ? rng.float(900, 9000) : rng.float(90, 420),
      months: [null, null, null],
    };
    subscribers.push(subscriber);
    return subscriber;
  };

  const countOn = (tp: TransformerEntity, month: number) =>
    subscribers.filter((subscriber) => subscriber.tpByMonth[month] === tp).length;

  for (const month of MONTHS) {
    const m = month.index;
    const rng = new Rng(`membership:${m}`);

    if (m > 0) {
      // Ketgan abonentlar (~1,5%): shu oydan boshlab ro'yxatda yo'q.
      for (const subscriber of subscribers) {
        const tp = subscriber.tpByMonth[m];
        if (!tp || !subscriber.tpByMonth[m - 1] || subscriber.pinned) continue;
        if (!new Rng(`leave:${subscriber.id}:${m}`).chance(0.015)) continue;
        if (countOn(tp, m) <= 5) continue;
        for (let k = m; k < MONTHS.length; k++) subscriber.tpByMonth[k] = null;
      }
    }

    // Shu oyda paydo bo'lgan TP'lar o'z abonentlari bilan keladi.
    for (const tp of district.transformers.filter((item) => item.fromMonth === m)) {
      const size = new Rng(`tp-size:${tp.id}`).int(5, 25);
      for (let index = 0; index < size; index++) create(tp, m);
    }

    if (m === 0) {
      // Maxsus katak formatlari uchun "doimiy" abonentlar.
      const firstHousehold = subscribers.find((subscriber) => subscriber.kind === "HOUSEHOLD");
      if (!firstHousehold) throw new Error("Aholi abonenti yo'q");
      firstHousehold.pinflAsNumber = true;
      firstHousehold.pinned = true;
      subscribers[11].pinned = true;
      continue;
    }

    // Yangi abonentlar (~2,5%) mavjud TP'larga.
    const present = subscribers.filter((subscriber) => subscriber.tpByMonth[m]).length;
    const newcomers = Math.round(present * 0.025);
    for (let index = 0; index < newcomers; index++) {
      const candidates = activeIn(district.transformers, m).filter(
        (tp) => tp.fromMonth < m && countOn(tp, m) < 25,
      );
      create(rng.pick(candidates), m);
    }

    if (m === 2) {
      // 3 ta abonent shu fider ichida boshqa TP ga o'tadi.
      let moved = 0;
      for (const subscriber of subscribers) {
        if (moved === 3) break;
        const from = subscriber.tpByMonth[m];
        if (!from || subscriber.tpByMonth[m - 1] !== from || subscriber.pinned) continue;
        if (subscriber.id % 150 !== 77 || countOn(from, m) <= 5) continue;
        const to = activeIn(from.feeder.transformers, m).find(
          (tp) => tp !== from && countOn(tp, m) < 25,
        );
        if (!to) continue;
        subscriber.tpByMonth[m] = to;
        moved += 1;
      }
      if (moved !== 3) throw new Error(`TP almashtirgan abonentlar soni 3 emas: ${moved}`);
    }
  }
}

/* ---------------------------------------------------------------------------
   Oylik qiymatlar
   --------------------------------------------------------------------------- */

const STATUS_WEIGHTS: readonly (readonly [MeterStatus, number])[] = [
  ["ONLINE", 80],
  ["NOT_RESPONDING", 13],
  ["SCHEME_CHANGED", 7],
];

function maxDate(first: Date, second: Date): Date {
  return first.getTime() >= second.getTime() ? first : second;
}

/** Kun boshi (UTC) - soatli sanani kun bo'yicha solishtirish uchun. */
function dayOf(date: Date): Date {
  return utcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

function withTime(rng: Rng, day: Date): Date {
  return utcDate(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), rng.int(6, 23), rng.int(0, 59));
}

function planSubscriberMonths(subscriber: SubscriberEntity): void {
  let cumulative = subscriber.baseReadingTenths;
  let previousReading: number | null = null;
  let status: MeterStatus | null = null;
  let debt = 0;
  let previous: SubscriberMonth | null = null;
  // Ko'rsatkich va to'lov sanalari shartnoma va hisoblagich o'rnatilgan kundan oldin bo'lmaydi.
  const floor = maxDate(subscriber.contractDate, subscriber.installedAt);

  for (const month of MONTHS) {
    const m = month.index;
    if (!subscriber.tpByMonth[m]) continue;
    const rng = new Rng(`subscriber:${subscriber.id}:month:${m}`);
    const legal = subscriber.kind === "LEGAL";

    status = status == null || rng.chance(0.08) ? rng.weighted(STATUS_WEIGHTS) : status;
    const consumptionKwh = Math.round(subscriber.monthlyKwh * SEASON[m] * rng.float(0.85, 1.15) * 10) / 10;
    cumulative += Math.round(consumptionKwh * 10);
    // Aloqaga chiqmayotgan hisoblagich eski ko'rsatkichni beradi - lekin kamaymaydi.
    const readingTenths: number = status === "NOT_RESPONDING" ? (previousReading ?? subscriber.baseReadingTenths) : cumulative;
    previousReading = readingTenths;

    if (debt > 0) {
      debt = rng.chance(0.4) ? 0 : Math.round(debt * rng.float(0.6, 1.5));
    } else if (rng.chance(m === 0 ? 0.35 : 0.22)) {
      debt = rng.int(5_000, legal ? 40_000_000 : 2_500_000) * 100 + (rng.chance(0.2) ? rng.int(1, 99) : 0);
    }
    const credit = debt === 0 && rng.chance(0.25) ? rng.int(1_000, legal ? 5_000_000 : 300_000) * 100 : 0;

    const reportDate = month.reportDate;
    let lastReadingAt: Date | null;
    if (status === "ONLINE") {
      lastReadingAt = withTime(rng, maxDate(addDays(reportDate, -rng.int(0, 1)), floor));
    } else if (status === "SCHEME_CHANGED") {
      lastReadingAt = withTime(rng, maxDate(addDays(reportDate, -rng.int(2, 20)), floor));
    } else {
      const drawn = rng.chance(0.9) ? maxDate(addDays(reportDate, -rng.int(25, 120)), floor) : null;
      // Aloqaga chiqmayotgan hisoblagichning ko'rsatkichi o'tgan oydagisi - sanasi ham
      // o'shanda olingan (orqaga ketmaydi va yo'qolmaydi).
      lastReadingAt = previous ? previous.lastReadingAt : drawn;
    }

    // To'lov bo'lmagan oyda oxirgi to'lov o'tgan oydagidek qoladi; yangi to'lov
    // oldingisidan keyin.
    const paid = rng.chance(0.85);
    let lastPaymentDate: Date | null;
    let lastPaymentCents: number | null;
    if (paid) {
      const after = previous?.lastPaymentDate ? addDays(previous.lastPaymentDate, 1) : floor;
      const from = maxDate(maxDate(addDays(reportDate, -45), floor), after);
      lastPaymentDate = dateBetween(rng, from, maxDate(addDays(reportDate, -1), from));
      lastPaymentCents = rng.int(10, legal ? 20_000 : 600) * 1000 * 100;
    } else if (previous) {
      lastPaymentDate = previous.lastPaymentDate;
      lastPaymentCents = previous.lastPaymentCents;
    } else {
      // Ro'yxatdagi birinchi oy: ba'zilarda avvalroq to'lov bor.
      const from = maxDate(floor, addDays(reportDate, -240));
      const to = addDays(reportDate, -46);
      const older = from.getTime() <= to.getTime() && rng.chance(0.7);
      lastPaymentDate = older ? dateBetween(rng, from, to) : null;
      lastPaymentCents = older ? rng.int(10, legal ? 20_000 : 600) * 1000 * 100 : null;
    }

    previous = {
      status,
      consumptionKwh,
      readingTenths,
      debtCents: debt,
      creditCents: credit,
      lastReadingAt,
      lastPaymentDate,
      lastPaymentCents,
    };
    subscriber.months[m] = previous;
  }
}

function computeMonths(district: District): void {
  for (const subscriber of district.subscribers) planSubscriberMonths(subscriber);

  for (const month of MONTHS) {
    const m = month.index;
    const activeTps = activeIn(district.transformers, m);

    // Har oy bir nechta TP da foydali oqim umumiydan katta (manfiy yo'qotish).
    const negativeRng = new Rng(`negative-loss:${m}`);
    const negative = new Set<TransformerEntity>();
    while (negative.size < 3) negative.add(negativeRng.pick(activeTps));

    for (const tp of activeTps) {
      const rng = new Rng(`tp:${tp.id}:month:${m}`);
      const members = district.subscribers.filter((subscriber) => subscriber.tpByMonth[m] === tp);
      const online = members.filter((subscriber) => subscriber.months[m]?.status === "ONLINE").length;
      const consumption = members.reduce((sum, subscriber) => sum + (subscriber.months[m]?.consumptionKwh ?? 0), 0);
      const usefulCents = Math.round(consumption * rng.float(1.0, 1.06) * 100);
      const lossRate = negative.has(tp)
        ? -rng.float(0.005, 0.03)
        : Math.max(0.01, tp.baseLoss + rng.float(-0.015, 0.015));
      const previous = m > 0 ? tp.months[m - 1] : null;

      // Joriy ta'mir: bajarilganidan keyin ba'zan navbatdagisi rejalashtiriladi.
      let currentRepairDate: Date | null;
      if (!previous) {
        const planned = new Rng(`tp:${tp.id}:repair`);
        currentRepairDate = planned.chance(0.82) ? addDays(month.reportDate, planned.int(-150, 120)) : null;
      } else {
        currentRepairDate = previous.currentRepairDate;
        if (currentRepairDate && currentRepairDate < addDays(MONTHS[m - 1].reportDate, -30) && rng.chance(0.3)) {
          currentRepairDate = addDays(month.reportDate, rng.int(20, 200));
        }
      }

      tp.months[m] = {
        totalCents: Math.round(usefulCents / (1 - lossRate)),
        usefulCents,
        online,
        offline: members.length - online,
        currentRepairDate,
        staff: previous && !rng.chance(0.04) ? previous.staff : rng.chance(0.92) ? rng.pick(STAFF) : null,
      };
    }

    for (const feeder of activeIn(district.feeders, m)) {
      const rng = new Rng(`feeder:${feeder.id}:month:${m}`);
      const usefulCents = activeIn(feeder.transformers, m).reduce((sum, tp) => sum + (tp.months[m]?.totalCents ?? 0), 0);
      feeder.months[m] = {
        usefulCents,
        totalCents: Math.round(usefulCents * (1 + feeder.lineLoss + rng.float(-0.005, 0.005))),
        staff: feeder.staff,
      };
    }

    for (const substation of district.substations) {
      const rng = new Rng(`substation:${substation.index}:month:${m}`);
      const usefulCents = activeIn(substation.feeders, m).reduce((sum, feeder) => sum + (feeder.months[m]?.totalCents ?? 0), 0);
      substation.months[m] = {
        usefulCents,
        totalCents: Math.round(usefulCents * (1 + substation.lossRate + rng.float(-0.004, 0.004))),
        // Sentabrda bitta podstansiyaning ma'sul xodimi almashadi.
        staff: STAFF[(substation.index + (m === 2 && substation.index === 3 ? 5 : 0)) % STAFF.length],
      };
    }
  }
}

/* ---------------------------------------------------------------------------
   Shablon ustunlari
   --------------------------------------------------------------------------- */

/**
 * Formula katagi: `minuend - subtrahend` yoki `minuend * factor` (shu qatordagi
 * ustunlar). `result` - Excel saqlagan natija; `null` - natijasiz formula
 * (xato fayl uchun).
 */
interface FormulaInput {
  formula: { minuend: string; subtrahend?: string; factor?: number };
  result: number | null;
}

/** Boy matn (bir nechta uslubli bo'lak) - o'qilganda bo'laklar matni qo'shiladi. */
interface RichTextInput {
  richText: { text: string; bold?: boolean }[];
}

type CellInput = string | number | Date | FormulaInput | RichTextInput | null;
type Row = Record<string, CellInput>;

/** [maydon, sarlavha]. Sarlavhalar `nameKey` bilan solishtiriladi ("\n", apostrof farqi yo'q). */
const COLUMNS: Record<TemplateType, readonly (readonly [field: string, header: string])[]> = {
  SUBSTATIONS: [
    ["name", "Podstansiya Nomi"],
    ["totalKwh", "Umumiy oqim"],
    ["usefulKwh", "Foydali oqim"],
    ["lossKwh", "Yo’qotish"],
    ["address", "Manzil"],
    ["latitude", "Lokatsiya (Lat)"],
    ["longitude", "Lokatsiya (Long)"],
    ["capacityKva", "Quvvati (KVA)"],
    ["staff", "Ma'sul xodim"],
  ],
  FEEDERS: [
    ["substation", "Podstansiya"],
    ["name", "Fider Nomi"],
    ["totalKwh", "Umumiy oqim"],
    ["usefulKwh", "Foydali oqim"],
    ["lossKwh", "Yo’qotish"],
    ["address", "Manzil"],
    ["capacityKva", "Quvvati (KVA)"],
    ["staff", "Ma'sul xodim"],
  ],
  TRANSFORMERS: [
    ["substation", "Podstansiya"],
    ["feeder", "Fider"],
    ["name", "TP Nomi"],
    ["totalKwh", "Umumiy oqim"],
    ["usefulKwh", "Foydali oqim"],
    ["lossKwh", "Yo’qotish"],
    ["online", "Aloqadagi abonentlar"],
    ["offline", "Aloqadan chiqqan abonentlar"],
    ["address", "Manzil"],
    ["latitude", "Lokatsiya (Lat)"],
    ["longitude", "Lokatsiya (Long)"],
    ["capacityKva", "Quvvati (KVA)"],
    ["currentRepairDate", "Joriy ta'mir sanasi"],
    ["overhaulDate", "To'la ta'mir sanasi"],
    ["staff", "Ma'sul xodim"],
  ],
  SUBSCRIBERS: [
    ["fullName", "FISH"],
    ["substation", "Podstansiya"],
    ["feeder", "Fider"],
    ["transformer", "TP"],
    ["kind", "Abonent turi (Yuridik/Aholi)"],
    ["staff", "Biriktirilgan xodim"],
    ["meterStatus", "Holati (Aloqada / Aloqaga chiqmayotgan / Sxemasi o’zgartirilgan)"],
    ["address", "Manzil"],
    ["latitude", "Lokatsiya (Lat)"],
    ["longitude", "Lokatsiya (Long)"],
    ["contract", "Shartnoma raqami"],
    ["meterSerial", "Hisoblagich zavod raqami"],
    ["meterType", "Hisoblagich turi"],
    ["debtUzs", "Qarzdorlik"],
    ["creditUzs", "Haqdorlik"],
    ["meterReading", "Hisoblagich ko'rsatgichi"],
    ["lastReadingAt", "Oxirgi olingan ma'lumot"],
    ["lastPaymentDate", "Oxirgi to'langan to'lov"],
    ["lastPaymentUzs", "Oxirgi to'langan summa"],
    ["contractDate", "Shartnoma sanasi"],
    ["passport", "Passport"],
    ["pinfl", "Pinfl"],
    ["meterInstalledAt", "Hisoblagich o'rnatilingan sana"],
  ],
  VIOLATIONS: [
    ["transformer", "TP Nomi"],
    ["subscriberName", "Abonent"],
    ["violatorType", "Turi (Yuridik/Jismoniy/Aybisiz)"],
    ["date", "Sana"],
    ["address", "Manzil"],
    ["damageUzs", "Keltirilgan zarar miqdori (UZS)"],
    ["damageKwh", "Taxminiy zarar (kWh)"],
    ["staff", "Ma'sul xodim"],
  ],
  APPEALS: [
    ["transformer", "TP Nomi"],
    ["text", "Murojaat"],
    ["subscriberName", "Abonent"],
    ["date", "Sana"],
    ["address", "Manzil"],
    ["status", "Holati (Ijobiy hal etilgan / Rad etilgan / Jarayonda / Muddati buzilgan)"],
    ["staff", "Ma'sul xodim"],
  ],
};

const REQUIRED_FIELDS: Record<TemplateType, readonly string[]> = {
  SUBSTATIONS: ["name", "totalKwh", "usefulKwh", "lossKwh"],
  FEEDERS: ["substation", "name", "totalKwh", "usefulKwh", "lossKwh"],
  TRANSFORMERS: ["substation", "feeder", "name", "totalKwh", "usefulKwh", "lossKwh"],
  SUBSCRIBERS: ["fullName", "substation", "feeder", "transformer", "kind", "meterStatus", "contract"],
  VIOLATIONS: ["transformer", "subscriberName", "violatorType", "date"],
  APPEALS: ["transformer", "text", "subscriberName", "date", "status"],
};

function headerOf(type: TemplateType, field: string): string {
  return COLUMNS[type].find(([name]) => name === field)?.[1] ?? field;
}

function fieldOfHeader(type: TemplateType, header: string): string | null {
  const key = nameKey(header);
  return COLUMNS[type].find(([, title]) => nameKey(title) === key)?.[0] ?? null;
}

/* ---------------------------------------------------------------------------
   Katak ko'rinishlari (parser qabul qilishi shart bo'lgan xilma-xil formatlar)
   --------------------------------------------------------------------------- */

/** 1234567 tiyin -> "12 345,67" (mingliklar `separator` bilan, kasr vergul bilan). */
function groupedText(cents: number, separator = " "): string {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  return `${whole},${String(cents % 100).padStart(2, "0")}`;
}

/** Uzilmas probel (U+00A0) - Excel'dan nusxa olingan sonlarda uchraydi. */
const NBSP = String.fromCharCode(0xa0);

type NumberStyle = "number" | "grouped" | "nbsp" | "dot";

function amountCell(cents: number, style: NumberStyle = "number"): CellInput {
  // Manfiy son matn ko'rinishida yozilmaydi.
  if (cents < 0 || style === "number") return cents / 100;
  if (style === "grouped") return groupedText(cents);
  if (style === "nbsp") return groupedText(cents, NBSP);
  return String(cents / 100);
}

type DateStyle = "date" | "dmy" | "iso";

function dateCell(date: Date | null, style: DateStyle = "date"): CellInput {
  if (!date) return null;
  if (style === "dmy") return dmyText(date);
  if (style === "iso") return isoText(date);
  return date;
}

/** `Yo'qotish` = `Umumiy oqim - Foydali oqim` formulasi (Excel natijasi bilan). */
function lossFormula(totalCents: number, usefulCents: number): FormulaInput {
  return { formula: { minuend: "totalKwh", subtrahend: "usefulKwh" }, result: (totalCents - usefulCents) / 100 };
}

/** Birinchi so'zi qalin boy matn: "**Navbahor** MFY, ...". */
function richText(text: string): RichTextInput {
  const space = text.indexOf(" ");
  if (space <= 0) return { richText: [{ text, bold: true }] };
  return { richText: [{ text: text.slice(0, space), bold: true }, { text: text.slice(space) }] };
}

function transformerCell(tp: TransformerEntity): CellInput {
  return tp.numericName ? Number(tp.name) : tp.name;
}

/** "BQ104036" -> "bq 104 036" (kaliti o'zgarmaydi). */
function looseContract(contract: string): string {
  return `${contract.slice(0, 2)} ${contract.slice(2, 5)} ${contract.slice(5)}`.toLowerCase();
}

/* ---------------------------------------------------------------------------
   Oylik qatorlar
   --------------------------------------------------------------------------- */

type MonthRows = Record<TemplateType, Row[]>;

function substationRows(district: District, m: number): Row[] {
  return district.substations.map((substation) => {
    const month = substation.months[m];
    return {
      name: substation.name,
      totalKwh: amountCell(month.totalCents),
      usefulKwh: amountCell(month.usefulCents),
      lossKwh: substation.index === 2
        ? lossFormula(month.totalCents, month.usefulCents)
        : amountCell(month.totalCents - month.usefulCents),
      address: `Baliqchi tumani, ${substation.mahalla}`,
      latitude: substation.point.lat,
      longitude: substation.point.lon,
      capacityKva: substation.index === 1 ? "25 000" : substation.capacityKva,
      staff: month.staff,
    };
  });
}

function feederRows(district: District, m: number): Row[] {
  return activeIn(district.feeders, m).map((feeder) => {
    const month = feeder.months[m];
    if (!month) throw new Error(`Fider holati yo'q: ${feeder.name}`);
    const totalStyle: NumberStyle = feeder.id % 5 === 1 ? "grouped" : "number";
    const usefulStyle: NumberStyle = feeder.id % 4 === 2 ? "dot" : "number";
    // Formula faqat ikkala qo'shni katak son bo'lganda (matn bo'lsa Excel #VALUE! beradi).
    const formula = feeder.id % 3 === 0 && totalStyle === "number" && usefulStyle === "number";
    return {
      // Apostrof turi fayldan faylga farq qiladi - kalit bir xil.
      substation: asciiApostrophes(feeder.substation.name),
      name: feeder.name,
      totalKwh: amountCell(month.totalCents, totalStyle),
      usefulKwh: amountCell(month.usefulCents, usefulStyle),
      lossKwh: formula
        ? lossFormula(month.totalCents, month.usefulCents)
        : amountCell(month.totalCents - month.usefulCents),
      address: feeder.address,
      capacityKva: feeder.capacityKva,
      staff: month.staff,
    };
  });
}

function transformerRows(district: District, m: number): Row[] {
  return activeIn(district.feeders, m).flatMap((feeder) =>
    activeIn(feeder.transformers, m).map((tp) => {
      const month = tp.months[m];
      if (!month) throw new Error(`TP holati yo'q: ${tp.name}`);
      const totalStyle: NumberStyle = tp.id % 11 === 5 ? "grouped" : tp.id % 23 === 9 ? "nbsp" : "number";
      const usefulStyle: NumberStyle = tp.id % 13 === 7 ? "dot" : "number";
      // Manfiy yo'qotishli TP'larda ham formula (manfiy natija) bo'lsin.
      const formula = (tp.id % 4 === 1 || month.totalCents < month.usefulCents) && totalStyle === "number" && usefulStyle === "number";
      return {
        substation: feeder.substation.name,
        feeder: feeder.name,
        name: transformerCell(tp),
        totalKwh: amountCell(month.totalCents, totalStyle),
        usefulKwh: amountCell(month.usefulCents, usefulStyle),
        lossKwh: formula
          ? lossFormula(month.totalCents, month.usefulCents)
          : amountCell(month.totalCents - month.usefulCents),
        online: month.online === 0 ? null : month.online,
        offline: month.offline === 0 && tp.id % 2 === 0 ? null : month.offline,
        address: tp.id % 17 === 3 ? richText(tp.address) : tp.address,
        latitude: tp.point ? (tp.id % 19 === 8 ? String(tp.point.lat).replace(".", ",") : tp.point.lat) : null,
        longitude: tp.point?.lon ?? null,
        capacityKva: tp.capacityKva,
        currentRepairDate: dateCell(month.currentRepairDate, tp.id % 5 === 0 ? "dmy" : tp.id % 7 === 2 ? "iso" : "date"),
        overhaulDate: dateCell(tp.overhaulDate, tp.id % 6 === 1 ? "dmy" : "date"),
        staff: month.staff,
      };
    }),
  );
}

function subscriberRows(district: District, m: number): Row[] {
  const rows: Row[] = [];
  for (const tp of district.transformers) {
    for (const subscriber of district.subscribers) {
      if (subscriber.tpByMonth[m] !== tp) continue;
      const month = subscriber.months[m];
      if (!month) throw new Error(`Abonent holati yo'q: ${subscriber.contract}`);
      const id = subscriber.id;
      const substation = tp.feeder.substation.name;
      rows.push({
        fullName: id % 97 === 12 ? richText(subscriber.fullName) : subscriber.fullName,
        substation: id % 3 === 0 ? asciiApostrophes(substation) : substation,
        feeder: tp.feeder.name,
        transformer: tp.numericName && id % 2 === 1 ? tp.name : transformerCell(tp),
        kind: SUBSCRIBER_KIND_LABEL[subscriber.kind],
        staff: subscriber.staff ? asciiApostrophes(subscriber.staff) : null,
        meterStatus: month.status === "SCHEME_CHANGED" && id % 2 === 0
          ? asciiApostrophes(METER_STATUS_LABEL[month.status])
          : METER_STATUS_LABEL[month.status],
        address: subscriber.address,
        latitude: subscriber.point?.lat ?? null,
        longitude: subscriber.point?.lon ?? null,
        contract: id === 12 && m === 1 ? looseContract(subscriber.contract) : subscriber.contract,
        meterSerial: subscriber.meterSerial,
        meterType: subscriber.meterType,
        debtUzs: month.debtCents === 0 ? (id % 2 === 0 ? null : 0) : amountCell(month.debtCents, id % 29 === 13 ? "grouped" : "number"),
        creditUzs: month.creditCents === 0 ? (id % 2 === 0 ? null : 0) : month.creditCents / 100,
        meterReading: amountCell(month.readingTenths * 10, id % 41 === 3 ? "grouped" : "number"),
        lastReadingAt: dateCell(month.lastReadingAt, id % 31 === 7 ? "dmy" : "date"),
        lastPaymentDate: dateCell(month.lastPaymentDate, id % 9 === 0 ? "dmy" : "date"),
        lastPaymentUzs: month.lastPaymentCents == null ? null : month.lastPaymentCents / 100,
        contractDate: dateCell(subscriber.contractDate),
        passport: subscriber.passport,
        pinfl: subscriber.pinfl && subscriber.pinflAsNumber ? Number(subscriber.pinfl) : subscriber.pinfl,
        meterInstalledAt: dateCell(subscriber.installedAt, id % 17 === 4 ? "iso" : "date"),
      });
    }
  }
  return rows;
}

interface IncidentPool {
  /** Shu oyda nomi bir ma'noli (faqat bitta fiderda) bo'lgan TP'lar. */
  transformers: TransformerEntity[];
  members: SubscriberEntity[];
}

function incidentPool(district: District, m: number): IncidentPool {
  const active = activeIn(district.transformers, m);
  const counts = new Map<string, number>();
  for (const tp of active) counts.set(nameKey(tp.name), (counts.get(nameKey(tp.name)) ?? 0) + 1);
  const transformers = active.filter((tp) => counts.get(nameKey(tp.name)) === 1);
  const allowed = new Set(transformers);
  const members = district.subscribers.filter((subscriber) => {
    const tp = subscriber.tpByMonth[m];
    return tp != null && allowed.has(tp);
  });
  return { transformers, members };
}

/** Abonent bo'lmagan shaxs nomi (hech bir abonent nomiga mos kelmaydi). */
function outsiderName(rng: Rng, district: District): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const name = personName(rng);
    if (!district.subscriberNameKeys.has(nameKey(name))) return name;
  }
  throw new Error("Begona shaxs nomi topilmadi");
}

/** Aybdor qoidabuzar turiga mos abonent turi (Aybisiz - har qanday). */
function subscriberKindOf(type: ViolatorType): SubscriberKind | null {
  return type === "LEGAL" ? "LEGAL" : type === "INDIVIDUAL" ? "HOUSEHOLD" : null;
}

interface IncidentBase {
  tp: TransformerEntity;
  subscriber: SubscriberEntity | null;
  name: string;
  date: Date;
}

function violationRows(district: District, month: MonthInfo): Row[] {
  const m = month.index;
  const rng = new Rng(`violations:${m}`);
  const pool = incidentPool(district, m);
  const legal = pool.members.filter((subscriber) => subscriber.kind === "LEGAL");
  const household = pool.members.filter((subscriber) => subscriber.kind === "HOUSEHOLD");
  const numericTp = pool.transformers.find((tp) => tp.numericName);
  const count = rng.int(15, 40);

  const items: (IncidentBase & { type: ViolatorType; kwh: number; uzs: number })[] = [];
  for (let index = 0; index < count; index++) {
    let type: ViolatorType =
      index === 0 ? "INNOCENT"
        : index === 1 ? "LEGAL"
          : index === 2 ? "INDIVIDUAL"
            : rng.weighted<ViolatorType>([["INDIVIDUAL", 55], ["LEGAL", 25], ["INNOCENT", 20]]);

    let subscriber: SubscriberEntity | null;
    if (index === 3 && numericTp) {
      // `7` TP abonenti: turi abonent turiga mos (Yuridik - yuridik, Jismoniy - aholi).
      const onTp = pool.members.filter((item) => item.tpByMonth[m] === numericTp);
      subscriber = onTp.find((item) => type === "INNOCENT" || item.kind === subscriberKindOf(type)) ?? onTp[0] ?? null;
      if (subscriber && type !== "INNOCENT") type = subscriber.kind === "LEGAL" ? "LEGAL" : "INDIVIDUAL";
    } else if (type === "LEGAL") {
      subscriber = rng.pick(legal);
    } else if (type === "INDIVIDUAL") {
      subscriber = rng.chance(0.85) ? rng.pick(household) : null;
    } else {
      subscriber = rng.chance(0.5) ? rng.pick(pool.members) : null;
    }
    const tp = index === 3 && numericTp ? numericTp : (subscriber?.tpByMonth[m] ?? rng.pick(pool.transformers));
    const kwh = type === "INNOCENT"
      ? (rng.chance(0.6) ? 0 : rng.int(20, 300))
      : type === "LEGAL" ? rng.int(800, 12_000) : rng.int(60, 2_500);
    items.push({
      tp,
      subscriber,
      type,
      name: subscriber?.fullName ?? outsiderName(rng, district),
      date: dateBetween(rng, addDays(month.reportDate, -30), month.reportDate),
      kwh,
      uzs: kwh * (type === "LEGAL" ? 1350 : 1000),
    });
  }
  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  let aliasUsed = false;
  return items.map((item, index) => {
    // Avgustda bitta "Aybsiz" yozuvi - hujjatdagi muqobil shakl.
    const useAlias = m === 1 && item.type === "INNOCENT" && !aliasUsed;
    if (useAlias) aliasUsed = true;
    const damageKwh = item.kwh === 0 || index % 7 === 5 ? null : item.kwh;
    return {
      transformer: transformerCell(item.tp),
      subscriberName: item.name,
      violatorType: useAlias ? "Aybsiz" : VIOLATOR_TYPE_LABEL[item.type],
      date: dateCell(item.date, index % 4 === 1 ? "dmy" : "date"),
      address: item.subscriber?.address ?? item.tp.address,
      // Ba'zi qatorlarda zarar summasi formula: kWh * tarif.
      damageUzs: item.uzs === 0
        ? null
        : damageKwh != null && index % 3 === 0
          ? { formula: { minuend: "damageKwh", factor: item.uzs / item.kwh }, result: item.uzs }
          : item.uzs,
      damageKwh,
      staff: item.tp.months[m]?.staff ?? null,
    };
  });
}

function appealRows(district: District, month: MonthInfo): Row[] {
  const m = month.index;
  const rng = new Rng(`appeals:${m}`);
  const pool = incidentPool(district, m);
  const count = rng.int(30, 70);
  const forced: AppealStatus[] = ["RESOLVED", "REJECTED", "IN_PROGRESS", "OVERDUE"];

  const items: (IncidentBase & { status: AppealStatus; text: string })[] = [];
  for (let index = 0; index < count; index++) {
    const subscriber = rng.chance(0.9) ? rng.pick(pool.members) : null;
    const tp = subscriber?.tpByMonth[m] ?? rng.pick(pool.transformers);
    const date = dateBetween(rng, addDays(month.reportDate, -30), month.reportDate);
    const old = month.reportDate.getTime() - date.getTime() > 15 * DAY_MS;
    const status = forced[index] ?? rng.weighted<AppealStatus>(
      old
        ? [["RESOLVED", 55], ["REJECTED", 15], ["OVERDUE", 20], ["IN_PROGRESS", 10]]
        : [["IN_PROGRESS", 60], ["RESOLVED", 30], ["REJECTED", 10]],
    );
    items.push({
      tp,
      subscriber,
      status,
      text: rng.pick(APPEAL_TEXTS),
      name: subscriber?.fullName ?? outsiderName(rng, district),
      date,
    });
  }
  items.sort((a, b) => a.date.getTime() - b.date.getTime());

  return items.map((item, index) => ({
    transformer: transformerCell(item.tp),
    text: item.text,
    subscriberName: item.name,
    date: dateCell(item.date, index % 5 === 2 ? "dmy" : "date"),
    address: item.subscriber?.address ?? item.tp.address,
    // Registr farqi ham qabul qilinadi.
    status: index === 6 ? APPEAL_STATUS_LABEL[item.status].toLowerCase() : APPEAL_STATUS_LABEL[item.status],
    staff: item.tp.months[m]?.staff ?? (index % 3 === 0 ? null : STAFF[index % STAFF.length]),
  }));
}

function buildMonthRows(district: District, month: MonthInfo): MonthRows {
  return {
    SUBSTATIONS: substationRows(district, month.index),
    FEEDERS: feederRows(district, month.index),
    TRANSFORMERS: transformerRows(district, month.index),
    SUBSCRIBERS: subscriberRows(district, month.index),
    VIOLATIONS: violationRows(district, month),
    APPEALS: appealRows(district, month),
  };
}

/* ---------------------------------------------------------------------------
   Excel yozish
   --------------------------------------------------------------------------- */

/** Sarlavha qatoridagi oy nomi: "Abonentlar Sentabr Holatiga Ko'ra". */
const TITLE_MONTH = new RegExp(`\\b(${MONTHS_UZ.join("|")})\\b`, "i");
/** Fayl xususiyatlaridagi sana - har ishga tushirishda bir xil. */
const FIXED_TIMESTAMP = utcDate(2026, 9, 13);

interface WriteOptions {
  sheetName: string;
  monthName: string;
  /** Sarlavha matnini almashtirish (maydon -> yangi sarlavha) - xato fayllar uchun. */
  renameHeaders?: Record<string, string>;
}

function isFormulaInput(value: CellInput): value is FormulaInput {
  return typeof value === "object" && value !== null && "formula" in value;
}

function isRichTextInput(value: CellInput): value is RichTextInput {
  return typeof value === "object" && value !== null && "richText" in value;
}

/** Namuna katagi -> exceljs qiymati (formula ustun harflari shu qator bo'yicha). */
function toExcelValue(value: CellInput, rowNumber: number, letterOf: (field: string) => string): ExcelJS.CellValue {
  if (isFormulaInput(value)) {
    const { minuend, subtrahend, factor } = value.formula;
    const formula = subtrahend
      ? `${letterOf(minuend)}${rowNumber}-${letterOf(subtrahend)}${rowNumber}`
      : `${letterOf(minuend)}${rowNumber}*${factor ?? 1}`;
    // Natijasiz formula: Excel'da hisoblanmay saqlangan fayl kabi (`<v>` yo'q).
    return value.result == null ? ({ formula } as ExcelJS.CellFormulaValue) : { formula, result: value.result };
  }
  if (isRichTextInput(value)) {
    return { richText: value.richText.map((part) => (part.bold ? { text: part.text, font: { bold: true } } : { text: part.text })) };
  }
  return value;
}

async function writeWorkbook(file: string, type: TemplateType, rows: readonly Row[], options: WriteOptions): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path.join(TEMPLATE_DIR, TEMPLATE_FILE_NAME[type]));
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`${TEMPLATE_FILE_NAME[type]}: varaq yo'q`);

  sheet.name = options.sheetName;
  const title = sheet.getCell("A1");
  if (typeof title.value !== "string" || !TITLE_MONTH.test(title.value)) {
    throw new Error(`${TEMPLATE_FILE_NAME[type]}: sarlavhada oy nomi topilmadi`);
  }
  title.value = title.value.replace(TITLE_MONTH, options.monthName);

  // Ustunlar tartibi - shablonning 2-qatoridan.
  const headerRow = sheet.getRow(2);
  const fields: string[] = [];
  for (let column = 1; column <= sheet.columnCount; column++) {
    const header = headerRow.getCell(column).value;
    if (typeof header !== "string") throw new Error(`${TEMPLATE_FILE_NAME[type]}: ${column}-ustun sarlavhasi yo'q`);
    const field = fieldOfHeader(type, header);
    if (!field) throw new Error(`${TEMPLATE_FILE_NAME[type]}: noma'lum sarlavha "${header}"`);
    fields.push(field);
  }
  const missing = COLUMNS[type].filter(([field]) => !fields.includes(field));
  if (missing.length > 0) {
    throw new Error(`${TEMPLATE_FILE_NAME[type]}: shablonda sarlavha yo'q: ${missing.map(([, header]) => header).join(", ")}`);
  }

  // Shablonda 1001-qatorgacha uslub bor; undan keyingi qatorlarga 3-qator uslubi ko'chiriladi.
  const styledRows = sheet.rowCount;
  const baseStyles = fields.map((_, index) => sheet.getRow(3).getCell(index + 1).style);

  rows.forEach((row, index) => {
    const rowNumber = 3 + index;
    const excelRow = sheet.getRow(rowNumber);
    const fresh = rowNumber > styledRows;
    if (fresh) excelRow.height = 30;
    fields.forEach((field, column) => {
      const cell = excelRow.getCell(column + 1);
      const value = row[field] ?? null;
      // Uslub obyektlari kataklar orasida umumiy - faqat yangi obyekt beriladi.
      const style = fresh ? baseStyles[column] : cell.style;
      if (value instanceof Date) {
        cell.style = { ...style, numFmt: hasTime(value) ? "dd.mm.yyyy hh:mm" : "dd.mm.yyyy" };
      } else if (fresh) {
        cell.style = { ...style };
      }
      cell.value = toExcelValue(value, rowNumber, (name) => {
        const index = fields.indexOf(name);
        if (index < 0) throw new Error(`${TEMPLATE_FILE_NAME[type]}: formula ustuni yo'q: ${name}`);
        return sheet.getColumn(index + 1).letter;
      });
    });
  });

  if (options.renameHeaders) {
    for (const [field, header] of Object.entries(options.renameHeaders)) {
      headerRow.getCell(fields.indexOf(field) + 1).value = header;
    }
  }

  workbook.created = FIXED_TIMESTAMP;
  workbook.modified = FIXED_TIMESTAMP;
  await workbook.xlsx.writeFile(file);
}

/* ---------------------------------------------------------------------------
   Qayta o'qish
   --------------------------------------------------------------------------- */

interface InvalidCell {
  invalid: string;
  code: IssueCode;
}

type RawValue = string | number | boolean | Date | InvalidCell | null;

/** Katak exceljs'da qanday ko'rinishda kelgan (format xilma-xilligi tekshiruvi uchun). */
type CellSource = "plain" | "formula" | "richText" | "hyperlink";

interface SheetRow {
  row: number;
  values: Record<string, RawValue>;
  sources: Record<string, CellSource>;
}

interface SheetData {
  file: string;
  type: TemplateType;
  sheetName: string;
  title: string;
  merges: string[];
  columnCount: number;
  missingRequired: string[];
  rows: SheetRow[];
}

function isInvalidCell(value: RawValue): value is InvalidCell {
  return typeof value === "object" && value !== null && !(value instanceof Date);
}

/** exceljs katagi -> oddiy qiymat (formula -> natija, boy matn -> matn). */
function rawValue(value: ExcelJS.CellValue): RawValue {
  if (value == null) return null;
  if (typeof value === "string") return value.trim() === "" ? null : value;
  if (typeof value === "number" || typeof value === "boolean" || value instanceof Date) return value;
  if ("error" in value) return { invalid: `Excel xatosi ${value.error}`, code: "NUMBER" };
  if ("formula" in value || "sharedFormula" in value) {
    const result = value.result;
    if (result == null) return { invalid: "Formula natijasi yo'q", code: "FORMULA" };
    if (typeof result === "object" && !(result instanceof Date)) return { invalid: "Formula xatosi", code: "FORMULA" };
    return result;
  }
  if ("richText" in value) return rawValue(value.richText.map((part) => part.text).join(""));
  if ("hyperlink" in value) return rawValue(value.text);
  return { invalid: "katak tushunilmadi", code: "NUMBER" };
}

function cellSource(value: ExcelJS.CellValue): CellSource {
  if (value == null || typeof value !== "object" || value instanceof Date) return "plain";
  if ("formula" in value || "sharedFormula" in value) return "formula";
  if ("richText" in value) return "richText";
  if ("hyperlink" in value) return "hyperlink";
  return "plain";
}

async function readSheet(file: string, type: TemplateType): Promise<SheetData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(file);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error(`${file}: varaq yo'q`);

  const headerRow = sheet.getRow(2);
  const columns = new Map<number, string>();
  headerRow.eachCell((cell, column) => {
    const field = typeof cell.value === "string" ? fieldOfHeader(type, cell.value) : null;
    if (field) columns.set(column, field);
  });
  const found = new Set(columns.values());

  const rows: SheetRow[] = [];
  for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber++) {
    const excelRow = sheet.getRow(rowNumber);
    const values: Record<string, RawValue> = {};
    const sources: Record<string, CellSource> = {};
    let empty = true;
    for (const [column, field] of columns) {
      const cellValue = excelRow.getCell(column).value;
      const value = rawValue(cellValue);
      values[field] = value;
      sources[field] = cellSource(cellValue);
      if (value !== null) empty = false;
    }
    if (!empty) rows.push({ row: rowNumber, values, sources });
  }

  const title = sheet.getCell("A1").value;
  return {
    file,
    type,
    sheetName: sheet.name,
    title: typeof title === "string" ? title : "",
    merges: [...sheet.model.merges],
    columnCount: sheet.columnCount,
    missingRequired: REQUIRED_FIELDS[type].filter((field) => !found.has(field)),
    rows,
  };
}

/* ---------------------------------------------------------------------------
   Katak qiymatlarini tushunish (`shablonlar.md` qoidalari)
   --------------------------------------------------------------------------- */

function parseNumberText(input: string): number | null {
  // JS `\s` uzilmas (U+00A0) va ingichka probellarni ham qamraydi.
  let text = input.replace(/\s/g, "");
  if (text.includes(",") && text.includes(".")) text = text.replace(/,/g, "");
  else if (/^[+-]?\d+,\d+$/.test(text)) text = text.replace(",", ".");
  if (!/^[+-]?\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

const MONTH_WORDS: Record<string, number> = {
  yanvar: 0, fevral: 1, mart: 2, aprel: 3, may: 4, iyun: 5, iyul: 6, avgust: 7,
  sentabr: 8, sentyabr: 8, oktabr: 9, oktyabr: 9, noyabr: 10, dekabr: 11,
};

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? date : null;
}

function parseDateText(input: string): Date | null {
  const text = cleanText(input) ?? "";
  let match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:\s+\d{1,2}:\d{2})?$/.exec(text);
  if (match) return validDate(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (match) return validDate(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  match = /^(\d{1,2})-([a-z’']+),?\s+(\d{4})$/i.exec(text);
  if (match) {
    const month = MONTH_WORDS[match[2].toLowerCase().replace(/[’']/g, "")];
    return month == null ? null : validDate(Number(match[3]), month, Number(match[1]));
  }
  return null;
}

function findTitleMonth(title: string): number | null {
  for (const word of title.split(/[\s,.]+/)) {
    const month = MONTH_WORDS[word.toLowerCase()];
    if (month != null) return month;
  }
  return null;
}

/* ---------------------------------------------------------------------------
   Tekshiruv (`malumotlar.md` 4-bo'lim)
   --------------------------------------------------------------------------- */

type IssueCode =
  | "HEADERS"
  | "SHEET_DATE"
  | "NO_ROWS"
  | "REQUIRED"
  | "NUMBER"
  | "DATE"
  | "FORMULA"
  | "ENUM"
  | "NEGATIVE"
  | "INTEGER"
  | "COORDS"
  | "DUPLICATE"
  | "PARENT"
  | "DANGLING"
  | "AMBIGUOUS_TP"
  | "COUNT_MISMATCH"
  | "TITLE_MONTH"
  | "LOSS_MISMATCH"
  | "DUPLICATE_TP_NAME"
  | "SUBSCRIBER_NAME_AMBIGUOUS";

interface Issue {
  code: IssueCode;
  row: number | null;
  column: string | null;
  message: string;
}

class Report {
  readonly errors: Issue[] = [];
  readonly warnings: Issue[] = [];

  error(code: IssueCode, message: string, row: number | null = null, column: string | null = null): void {
    this.errors.push({ code, message, row, column });
  }

  warn(code: IssueCode, message: string, row: number | null = null, column: string | null = null): void {
    this.warnings.push({ code, message, row, column });
  }
}

/** Qator tekshiruvidan o'tgan yozuvlar (faqat namuna shartlari uchun kerakli maydonlar). */
interface EnergyRec {
  key: string;
  row: number;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  staff: string | null;
}

interface SubstationRec extends EnergyRec {
  latitude: number | null;
  longitude: number | null;
}

interface FeederRec extends EnergyRec {
  substationKey: string;
}

interface TransformerRec extends EnergyRec {
  feederKey: string;
  nameKey: string;
  online: number;
  offline: number;
  latitude: number | null;
  longitude: number | null;
  currentRepairDate: Date | null;
  overhaulDate: Date | null;
}

interface SubscriberRec {
  key: string;
  row: number;
  fullName: string;
  transformerKey: string;
  kind: SubscriberKind;
  meterStatus: MeterStatus;
  staff: string | null;
  latitude: number | null;
  longitude: number | null;
  debtUzs: number;
  meterReading: number | null;
  lastReadingAt: Date | null;
  lastPaymentDate: Date | null;
  lastPaymentUzs: number | null;
  contractDate: Date | null;
  meterInstalledAt: Date | null;
}

interface IncidentRec {
  row: number;
  transformerKey: string;
  subscriberName: string;
  /** Qoidabuzar turi yoki murojaat holati. */
  value: string;
  date: Date;
  staff: string | null;
}

interface MonthData {
  substations?: Map<string, SubstationRec>;
  feeders?: Map<string, FeederRec>;
  transformers?: Map<string, TransformerRec>;
  subscribers?: Map<string, SubscriberRec>;
  violations?: IncidentRec[];
  appeals?: IncidentRec[];
}

const joinKey = (...parts: string[]) => parts.join(" | ");

class RowReader {
  failed = false;

  constructor(
    private readonly sheet: SheetData,
    private readonly source: SheetRow,
    private readonly report: Report,
  ) {}

  get row(): number {
    return this.source.row;
  }

  private fail(code: IssueCode, field: string, message: string): null {
    this.failed = true;
    this.report.error(code, message, this.source.row, headerOf(this.sheet.type, field));
    return null;
  }

  private raw(field: string): RawValue | undefined {
    const value = this.source.values[field] ?? null;
    if (isInvalidCell(value)) {
      this.fail(value.code, field, value.invalid);
      return undefined;
    }
    return value;
  }

  text(field: string, required = false): string | null {
    const value = this.raw(field);
    if (value === undefined) return null;
    const text = value == null ? null : cleanText(value instanceof Date ? dmyText(value) : String(value));
    if (text == null && required) return this.fail("REQUIRED", field, "Majburiy katak bo'sh");
    return text;
  }

  number(field: string, options: { required?: boolean; nonNegative?: boolean; integer?: boolean } = {}): number | null {
    const value = this.raw(field);
    if (value === undefined) return null;
    if (value == null) return options.required ? this.fail("REQUIRED", field, "Majburiy katak bo'sh") : null;
    const parsed = typeof value === "number" ? value : typeof value === "string" ? parseNumberText(value) : null;
    if (parsed == null || !Number.isFinite(parsed)) return this.fail("NUMBER", field, `Son tushunilmadi: ${String(value)}`);
    if (options.nonNegative && parsed < 0) return this.fail("NEGATIVE", field, `Manfiy son: ${parsed}`);
    if (options.integer && !Number.isInteger(parsed)) return this.fail("INTEGER", field, `Butun son kutilgan: ${parsed}`);
    return parsed;
  }

  date(field: string, required = false): Date | null {
    const value = this.raw(field);
    if (value === undefined) return null;
    if (value == null) return required ? this.fail("REQUIRED", field, "Majburiy katak bo'sh") : null;
    const parsed = value instanceof Date ? value : typeof value === "string" ? parseDateText(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return this.fail("DATE", field, `Sana tushunilmadi: ${String(value)}`);
    return parsed;
  }

  enumOf<E extends string>(field: string, labels: Record<E, string>, aliases: Record<string, E> = {}): E | null {
    const text = this.text(field, true);
    if (text == null) return null;
    const key = text.toLowerCase().replace(/[’'\s]/g, "");
    for (const [code, label] of Object.entries(labels) as [E, string][]) {
      if (label.toLowerCase().replace(/[’'\s]/g, "") === key) return code;
    }
    const alias = aliases[key];
    return alias ?? this.fail("ENUM", field, `Qiymat tushunilmadi: ${text}`);
  }

  coordinates(): { latitude: number | null; longitude: number | null } {
    const latitude = this.number("latitude");
    const longitude = this.number("longitude");
    if ((latitude == null) !== (longitude == null)) {
      this.fail("COORDS", latitude == null ? "latitude" : "longitude", "Lat/Long faqat bittasi berilgan");
      return { latitude: null, longitude: null };
    }
    if (latitude != null && (latitude < -90 || latitude > 90)) this.fail("COORDS", "latitude", "Lat diapazondan tashqarida");
    if (longitude != null && (longitude < -180 || longitude > 180)) this.fail("COORDS", "longitude", "Long diapazondan tashqarida");
    return { latitude, longitude };
  }

  energy(): { totalKwh: number | null; usefulKwh: number | null; lossKwh: number | null } {
    const totalKwh = this.number("totalKwh", { required: true, nonNegative: true });
    const usefulKwh = this.number("usefulKwh", { required: true, nonNegative: true });
    const lossKwh = this.number("lossKwh", { required: true });
    if (totalKwh != null && usefulKwh != null && lossKwh != null) {
      const diff = Math.abs(totalKwh - usefulKwh - lossKwh);
      if (diff > 1 && diff > totalKwh * 0.005) {
        this.report.warn("LOSS_MISMATCH", `Umumiy - Foydali != Yo'qotish (${diff})`, this.row, headerOf(this.sheet.type, "lossKwh"));
      }
    }
    return { totalKwh, usefulKwh, lossKwh };
  }
}

/**
 * Bitta faylni `context` (shu oyning bazadagi yoki shu submission'dagi oldingi
 * fayllar ma'lumoti) ga nisbatan tekshiradi. Natija: hisobot va shu faylning
 * o'qilgan yozuvlari (`patch`).
 */
function validateSheet(sheet: SheetData, context: MonthData): { report: Report; patch: MonthData } {
  const report = new Report();
  const patch: MonthData = {};

  if (sheet.missingRequired.length > 0) {
    report.error("HEADERS", `Majburiy sarlavha yo'q: ${sheet.missingRequired.map((field) => headerOf(sheet.type, field)).join(", ")}`);
    return { report, patch };
  }
  const sheetDate = parseDateText(sheet.sheetName);
  if (!sheetDate) {
    report.error("SHEET_DATE", `Varaq nomidan sana o'qilmadi: "${sheet.sheetName}"`);
  } else {
    const titleMonth = findTitleMonth(sheet.title);
    if (titleMonth != null && titleMonth !== sheetDate.getUTCMonth()) {
      report.warn("TITLE_MONTH", "Sarlavhadagi oy varaq oyiga mos emas");
    }
  }
  if (sheet.rows.length === 0 && sheet.type !== "VIOLATIONS" && sheet.type !== "APPEALS") {
    report.error("NO_ROWS", "Ma'lumot qatori yo'q");
  }

  const seen = new Set<string>();
  const duplicate = (key: string, reader: RowReader, field: string) => {
    if (seen.has(key)) {
      reader.failed = true;
      report.error("DUPLICATE", `Takroriy kalit: ${key}`, reader.row, headerOf(sheet.type, field));
    }
    seen.add(key);
  };
  const readers = sheet.rows.map((row) => new RowReader(sheet, row, report));

  switch (sheet.type) {
    case "SUBSTATIONS": {
      const records = new Map<string, SubstationRec>();
      for (const reader of readers) {
        const name = reader.text("name", true);
        const { totalKwh, usefulKwh, lossKwh } = reader.energy();
        const { latitude, longitude } = reader.coordinates();
        reader.text("address");
        reader.number("capacityKva", { nonNegative: true });
        const staff = reader.text("staff");
        if (name != null) duplicate(nameKey(name), reader, "name");
        if (reader.failed || name == null || totalKwh == null || usefulKwh == null || lossKwh == null) continue;
        records.set(nameKey(name), { key: nameKey(name), row: reader.row, totalKwh, usefulKwh, lossKwh, latitude, longitude, staff });
      }
      for (const feeder of context.feeders?.values() ?? []) {
        if (!records.has(feeder.substationKey)) report.error("DANGLING", `Fideri bor podstansiya yangi faylda yo'q: ${feeder.substationKey}`);
      }
      patch.substations = records;
      break;
    }

    case "FEEDERS": {
      const records = new Map<string, FeederRec>();
      for (const reader of readers) {
        const substation = reader.text("substation", true);
        const name = reader.text("name", true);
        const { totalKwh, usefulKwh, lossKwh } = reader.energy();
        reader.text("address");
        reader.number("capacityKva", { nonNegative: true });
        const staff = reader.text("staff");
        if (substation != null && !context.substations?.has(nameKey(substation))) {
          reader.failed = true;
          report.error("PARENT", `Podstansiya shu oyda yo'q: ${substation}`, reader.row, headerOf(sheet.type, "substation"));
        }
        if (substation == null || name == null) continue;
        const key = joinKey(nameKey(substation), nameKey(name));
        duplicate(key, reader, "name");
        if (reader.failed || totalKwh == null || usefulKwh == null || lossKwh == null) continue;
        records.set(key, { key, substationKey: nameKey(substation), row: reader.row, totalKwh, usefulKwh, lossKwh, staff });
      }
      for (const tp of context.transformers?.values() ?? []) {
        if (!records.has(tp.feederKey)) report.error("DANGLING", `TP si bor fider yangi faylda yo'q: ${tp.feederKey}`);
      }
      patch.feeders = records;
      break;
    }

    case "TRANSFORMERS": {
      const records = new Map<string, TransformerRec>();
      for (const reader of readers) {
        const substation = reader.text("substation", true);
        const feeder = reader.text("feeder", true);
        const name = reader.text("name", true);
        const { totalKwh, usefulKwh, lossKwh } = reader.energy();
        const online = reader.number("online", { nonNegative: true, integer: true }) ?? 0;
        const offline = reader.number("offline", { nonNegative: true, integer: true }) ?? 0;
        reader.text("address");
        const { latitude, longitude } = reader.coordinates();
        reader.number("capacityKva", { nonNegative: true });
        const currentRepairDate = reader.date("currentRepairDate");
        const overhaulDate = reader.date("overhaulDate");
        const staff = reader.text("staff");
        if (substation == null || feeder == null || name == null) continue;
        const feederKey = joinKey(nameKey(substation), nameKey(feeder));
        if (!context.feeders?.has(feederKey)) {
          reader.failed = true;
          report.error("PARENT", `Fider shu oyda, shu podstansiyada yo'q: ${substation} / ${feeder}`, reader.row, headerOf(sheet.type, "feeder"));
        }
        const key = joinKey(feederKey, nameKey(name));
        duplicate(key, reader, "name");
        if (reader.failed || totalKwh == null || usefulKwh == null || lossKwh == null) continue;
        records.set(key, { key, feederKey, nameKey: nameKey(name), row: reader.row, totalKwh, usefulKwh, lossKwh, online, offline, latitude, longitude, currentRepairDate, overhaulDate, staff });
      }
      const feedersByName = new Map<string, Set<string>>();
      for (const tp of records.values()) {
        feedersByName.set(tp.nameKey, (feedersByName.get(tp.nameKey) ?? new Set()).add(tp.feederKey));
      }
      for (const [name, feeders] of feedersByName) {
        if (feeders.size > 1) report.warn("DUPLICATE_TP_NAME", `TP nomi bir nechta fiderda: ${name}`);
      }
      const dependents = [
        ...[...(context.subscribers?.values() ?? [])].map((item) => item.transformerKey),
        ...(context.violations ?? []).map((item) => item.transformerKey),
        ...(context.appeals ?? []).map((item) => item.transformerKey),
      ];
      for (const key of new Set(dependents)) {
        if (!records.has(key)) report.error("DANGLING", `Abonenti/qoidabuzarligi/murojaati bor TP yangi faylda yo'q: ${key}`);
      }
      if (context.subscribers) checkSubscriberCounts(records, context.subscribers, report);
      patch.transformers = records;
      break;
    }

    case "SUBSCRIBERS": {
      const records = new Map<string, SubscriberRec>();
      for (const reader of readers) {
        const fullName = reader.text("fullName", true);
        const substation = reader.text("substation", true);
        const feeder = reader.text("feeder", true);
        const transformer = reader.text("transformer", true);
        const kind = reader.enumOf("kind", SUBSCRIBER_KIND_LABEL);
        const staff = reader.text("staff");
        const meterStatus = reader.enumOf("meterStatus", METER_STATUS_LABEL);
        reader.text("address");
        const { latitude, longitude } = reader.coordinates();
        const contract = reader.text("contract", true);
        reader.text("meterSerial");
        reader.text("meterType");
        const debtUzs = reader.number("debtUzs", { nonNegative: true }) ?? 0;
        reader.number("creditUzs", { nonNegative: true });
        const meterReading = reader.number("meterReading", { nonNegative: true });
        const lastReadingAt = reader.date("lastReadingAt");
        const lastPaymentDate = reader.date("lastPaymentDate");
        const lastPaymentUzs = reader.number("lastPaymentUzs", { nonNegative: true });
        const contractDate = reader.date("contractDate");
        reader.text("passport");
        reader.text("pinfl");
        const meterInstalledAt = reader.date("meterInstalledAt");
        let transformerKey: string | null = null;
        if (substation != null && feeder != null && transformer != null) {
          transformerKey = joinKey(nameKey(substation), nameKey(feeder), nameKey(transformer));
          if (!context.transformers?.has(transformerKey)) {
            reader.failed = true;
            report.error("PARENT", `TP shu oyda yo'q: ${substation} / ${feeder} / ${transformer}`, reader.row, headerOf(sheet.type, "transformer"));
          }
        }
        if (contract != null) duplicate(contractKey(contract), reader, "contract");
        if (reader.failed || fullName == null || transformerKey == null || kind == null || meterStatus == null || contract == null) continue;
        records.set(contractKey(contract), {
          key: contractKey(contract), row: reader.row, fullName, transformerKey, kind, meterStatus, staff, latitude, longitude, debtUzs, meterReading,
          lastReadingAt, lastPaymentDate, lastPaymentUzs, contractDate, meterInstalledAt,
        });
      }
      if (context.transformers) checkSubscriberCounts(context.transformers, records, report);
      patch.subscribers = records;
      break;
    }

    case "VIOLATIONS":
    case "APPEALS": {
      const violations = sheet.type === "VIOLATIONS";
      const records: IncidentRec[] = [];
      for (const reader of readers) {
        const transformer = reader.text("transformer", true);
        const text = violations ? null : reader.text("text", true);
        const subscriberName = reader.text("subscriberName", true);
        const value = violations
          ? reader.enumOf("violatorType", VIOLATOR_TYPE_LABEL, { aybsiz: "INNOCENT" })
          : reader.enumOf("status", APPEAL_STATUS_LABEL);
        const date = reader.date("date", true);
        reader.text("address");
        if (violations) {
          reader.number("damageUzs", { nonNegative: true });
          reader.number("damageKwh", { nonNegative: true });
        }
        const staff = reader.text("staff");
        let transformerKey: string | null = null;
        if (transformer != null) {
          const matches = [...(context.transformers?.values() ?? [])].filter((tp) => tp.nameKey === nameKey(transformer));
          if (matches.length === 0) {
            reader.failed = true;
            report.error("PARENT", `TP shu oyda yo'q: ${transformer}`, reader.row, headerOf(sheet.type, "transformer"));
          } else if (matches.length > 1) {
            reader.failed = true;
            report.error("AMBIGUOUS_TP", `TP nomi bir nechta fiderda uchraydi: ${transformer}`, reader.row, headerOf(sheet.type, "transformer"));
          } else {
            transformerKey = matches[0].key;
          }
        }
        if (transformerKey != null && subscriberName != null && context.subscribers) {
          const same = [...context.subscribers.values()].filter(
            (subscriber) => subscriber.transformerKey === transformerKey && nameKey(subscriber.fullName) === nameKey(subscriberName),
          );
          if (same.length > 1) report.warn("SUBSCRIBER_NAME_AMBIGUOUS", `Abonent nomi bir nechta abonentga mos: ${subscriberName}`, reader.row, headerOf(sheet.type, "subscriberName"));
        }
        if (reader.failed || transformerKey == null || subscriberName == null || value == null || date == null || (!violations && text == null)) continue;
        records.push({ row: reader.row, transformerKey, subscriberName, value, date, staff });
      }
      if (violations) patch.violations = records;
      else patch.appeals = records;
      break;
    }
  }

  if (!sheetDate) {
    // Oyi noma'lum fayl (fatal): bog'liqlik tekshirilmaydi va uning qatorlari
    // shu submission'dagi keyingi fayllar uchun "bor" hisoblanmaydi.
    const fileErrors = report.errors.filter((issue) => !DEPENDENCY_CODES.has(issue.code));
    report.errors.splice(0, report.errors.length, ...fileErrors);
    return { report, patch: {} };
  }
  return { report, patch };
}

/** Oyning boshqa fayllariga bog'liq xatolar. */
const DEPENDENCY_CODES: ReadonlySet<IssueCode> = new Set(["PARENT", "DANGLING", "AMBIGUOUS_TP", "COUNT_MISMATCH"]);

/** 4.5-qoida: TP ustunlaridagi abonent sonlari = abonentlar ro'yxati. */
function checkSubscriberCounts(transformers: Map<string, TransformerRec>, subscribers: Map<string, SubscriberRec>, report: Report): void {
  const actual = new Map<string, { online: number; offline: number }>();
  for (const subscriber of subscribers.values()) {
    const counts = actual.get(subscriber.transformerKey) ?? { online: 0, offline: 0 };
    if (subscriber.meterStatus === "ONLINE") counts.online += 1;
    else counts.offline += 1;
    actual.set(subscriber.transformerKey, counts);
  }
  for (const tp of transformers.values()) {
    const counts = actual.get(tp.key) ?? { online: 0, offline: 0 };
    if (counts.online !== tp.online || counts.offline !== tp.offline) {
      report.error(
        "COUNT_MISMATCH",
        `${tp.key}: TP da ${tp.online}/${tp.offline}, ro'yxatda ${counts.online}/${counts.offline} (aloqada/aloqadan chiqqan)`,
        // Xato ikki fayl orasida - qator raqami yo'q.
        null,
      );
    }
  }
}

/* ---------------------------------------------------------------------------
   Namunaning o'z shartlari
   --------------------------------------------------------------------------- */

const failures: string[] = [];

function check(condition: boolean, message: string): void {
  if (!condition) failures.push(message);
}

function cents(value: number): number {
  return Math.round(value * 100);
}

function formatIssues(issues: readonly Issue[]): string {
  return issues
    .slice(0, 5)
    .map((issue) => `[${issue.code}] ${issue.row ?? "-"}:${issue.column ?? "-"} ${issue.message}`)
    .join("; ");
}

function exactLoss(label: string, records: Iterable<{ row: number; totalKwh: number; usefulKwh: number; lossKwh: number }>): void {
  for (const record of records) {
    check(
      cents(record.totalKwh) - cents(record.usefulKwh) === cents(record.lossKwh),
      `${label} ${record.row}-qator: Yo'qotish != Umumiy - Foydali`,
    );
  }
}

function checkPoint(label: string, latitude: number | null, longitude: number | null): void {
  if (latitude == null || longitude == null) return;
  const point = { lat: latitude, lon: longitude };
  check(insideBbox(point), `${label}: koordinata Baliqchi bbox dan tashqarida (${latitude}, ${longitude})`);
  check(insideDistrict(point), `${label}: koordinata tuman chegarasidan tashqarida (${latitude}, ${longitude})`);
}

function checkMonth(month: MonthInfo, sheets: Record<TemplateType, SheetData>, data: Required<MonthData>, warnings: Issue[], district: District): void {
  const tag = month.key;

  for (const type of TEMPLATE_ORDER) {
    const sheet = sheets[type];
    const lastColumn = String.fromCharCode(64 + sheet.columnCount);
    check(sheet.sheetName === month.sheetName, `${tag} ${type}: varaq nomi "${sheet.sheetName}"`);
    check(sheet.title.includes(`${month.name} Holatiga`), `${tag} ${type}: sarlavhada oy yo'q: "${sheet.title}"`);
    check(sheet.merges.includes(`A1:${lastColumn}1`), `${tag} ${type}: birlashtirilgan sarlavha yo'qolgan`);
  }

  // Ogohlantirishlar: faqat bitta - takroriy TP nomi.
  check(
    warnings.length === 1 && warnings[0].code === "DUPLICATE_TP_NAME" && warnings[0].message.endsWith(nameKey(district.duplicatedTpName)),
    `${tag}: kutilgan yagona ogohlantirish (takroriy TP nomi) o'rniga: ${formatIssues(warnings)}`,
  );

  // Hajmlar.
  check(data.substations.size === 4, `${tag}: podstansiyalar soni ${data.substations.size}`);
  const feedersPerSubstation = new Map<string, number>();
  for (const feeder of data.feeders.values()) {
    feedersPerSubstation.set(feeder.substationKey, (feedersPerSubstation.get(feeder.substationKey) ?? 0) + 1);
  }
  for (const [key, count] of feedersPerSubstation) check(count >= 4 && count <= 6, `${tag}: ${key} da ${count} ta fider`);
  const tpsPerFeeder = new Map<string, number>();
  for (const tp of data.transformers.values()) tpsPerFeeder.set(tp.feederKey, (tpsPerFeeder.get(tp.feederKey) ?? 0) + 1);
  check(tpsPerFeeder.size === data.feeders.size, `${tag}: TP siz fider bor`);
  for (const [key, count] of tpsPerFeeder) check(count >= 6 && count <= 10, `${tag}: ${key} da ${count} ta TP`);
  const subscribersPerTp = new Map<string, number>();
  for (const subscriber of data.subscribers.values()) {
    subscribersPerTp.set(subscriber.transformerKey, (subscribersPerTp.get(subscriber.transformerKey) ?? 0) + 1);
  }
  check(subscribersPerTp.size === data.transformers.size, `${tag}: abonentsiz TP bor`);
  for (const [key, count] of subscribersPerTp) check(count >= 5 && count <= 25, `${tag}: ${key} da ${count} ta abonent`);
  check(data.subscribers.size >= 2200 && data.subscribers.size <= 2900, `${tag}: abonentlar soni ${data.subscribers.size}`);
  check(data.violations.length >= 15 && data.violations.length <= 40, `${tag}: qoidabuzarliklar soni ${data.violations.length}`);
  check(data.appeals.length >= 30 && data.appeals.length <= 70, `${tag}: murojaatlar soni ${data.appeals.length}`);

  // Yo'qotish aniq: Umumiy - Foydali (2 xona).
  exactLoss(`${tag} Podstansiyalar`, data.substations.values());
  exactLoss(`${tag} Fiderlar`, data.feeders.values());
  exactLoss(`${tag} Transformatorlar`, data.transformers.values());
  const negative = [...data.transformers.values()].filter((tp) => tp.lossKwh < 0).length;
  check(negative >= 1 && negative <= 5, `${tag}: manfiy yo'qotishli TP lar soni ${negative}`);

  // Koordinatalar.
  for (const item of data.substations.values()) checkPoint(`${tag} podstansiya ${item.row}`, item.latitude, item.longitude);
  for (const item of data.transformers.values()) checkPoint(`${tag} TP ${item.row}`, item.latitude, item.longitude);
  for (const item of data.subscribers.values()) checkPoint(`${tag} abonent ${item.row}`, item.latitude, item.longitude);

  // Takroriy TP nomi: aynan bitta va qoidabuzarlik/murojaatda ishlatilmagan.
  const namesByFeeders = new Map<string, Set<string>>();
  for (const tp of data.transformers.values()) {
    namesByFeeders.set(tp.nameKey, (namesByFeeders.get(tp.nameKey) ?? new Set()).add(tp.feederKey));
  }
  const duplicated = [...namesByFeeders].filter(([, feeders]) => feeders.size > 1).map(([name]) => name);
  check(duplicated.length === 1, `${tag}: takroriy TP nomlari: ${duplicated.join(", ")}`);
  for (const sheet of [sheets.VIOLATIONS, sheets.APPEALS]) {
    for (const row of sheet.rows) {
      const raw = row.values.transformer;
      check(
        raw == null || isInvalidCell(raw) || nameKey(String(raw)) !== nameKey(district.duplicatedTpName),
        `${tag} ${sheet.type} ${row.row}: takroriy TP nomi ishlatilgan`,
      );
    }
  }

  // Har bir enum qiymati uchraydi.
  const statuses = new Set([...data.subscribers.values()].map((item) => item.meterStatus));
  check(statuses.size === 3, `${tag}: abonent holatlari ${[...statuses].join(", ")}`);
  const kinds = new Set([...data.subscribers.values()].map((item) => item.kind));
  check(kinds.size === 2, `${tag}: abonent turlari ${[...kinds].join(", ")}`);
  const violatorTypes = new Set(data.violations.map((item) => item.value));
  check(violatorTypes.size === 3, `${tag}: qoidabuzar turlari ${[...violatorTypes].join(", ")}`);
  const appealStatuses = new Set(data.appeals.map((item) => item.value));
  check(appealStatuses.size === 4, `${tag}: murojaat holatlari ${[...appealStatuses].join(", ")}`);

  // Ta'mir sanalari hisobot sanasidan oldin ham, keyin ham.
  for (const field of ["currentRepairDate", "overhaulDate"] as const) {
    const dates = [...data.transformers.values()].map((tp) => tp[field]).filter((date): date is Date => date != null);
    check(dates.some((date) => date <= month.reportDate), `${tag}: ${field} bajarilgan sana yo'q`);
    check(dates.some((date) => date > month.reportDate), `${tag}: ${field} rejalashtirilgan sana yo'q`);
  }

  // 10 ta xodim barcha fayllarda jami.
  const staff = new Set<string>();
  const addStaff = (value: string | null) => {
    if (value) staff.add(nameKey(value));
  };
  for (const item of data.substations.values()) addStaff(item.staff);
  for (const item of data.feeders.values()) addStaff(item.staff);
  for (const item of data.transformers.values()) addStaff(item.staff);
  for (const item of data.subscribers.values()) addStaff(item.staff);
  for (const item of [...data.violations, ...data.appeals]) addStaff(item.staff);
  check(staff.size === STAFF.length, `${tag}: xodimlar soni ${staff.size}`);

  // Katak formatlarining xilma-xilligi (parser qabul qilishi shart).
  const rawOf = (type: TemplateType, field: string) => sheets[type].rows.map((row) => row.values[field]);
  const anyRaw = (type: TemplateType, field: string, test: (value: RawValue) => boolean) => rawOf(type, field).some((value) => value != null && test(value));
  const groupedPattern = /^\d{1,3}(\s\d{3})+,\d{2}$/;
  check(anyRaw("TRANSFORMERS", "totalKwh", (value) => typeof value === "string" && /^\d{1,3}( \d{3})+,\d{2}$/.test(value)), `${tag}: "1 020,60" ko'rinishidagi son yo'q`);
  check(anyRaw("TRANSFORMERS", "totalKwh", (value) => typeof value === "string" && value.includes(NBSP) && groupedPattern.test(value)), `${tag}: uzilmas probelli son yo'q`);
  check(anyRaw("TRANSFORMERS", "usefulKwh", (value) => typeof value === "string" && /^\d+\.\d+$/.test(value)), `${tag}: "1020.6" ko'rinishidagi son yo'q`);
  check(anyRaw("SUBSCRIBERS", "debtUzs", (value) => typeof value === "string" && groupedPattern.test(value)), `${tag}: matnli qarzdorlik yo'q`);
  check(anyRaw("TRANSFORMERS", "currentRepairDate", (value) => value instanceof Date), `${tag}: Date katak yo'q`);
  check(anyRaw("TRANSFORMERS", "currentRepairDate", (value) => typeof value === "string" && /^\d{2}\.\d{2}\.\d{4}$/.test(value)), `${tag}: "13.08.2026" matnli sana yo'q`);
  check(anyRaw("TRANSFORMERS", "currentRepairDate", (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)), `${tag}: ISO matnli sana yo'q`);
  check(anyRaw("SUBSCRIBERS", "lastReadingAt", (value) => value instanceof Date && hasTime(value)), `${tag}: vaqtli sana yo'q`);
  check(anyRaw("SUBSCRIBERS", "pinfl", (value) => typeof value === "number"), `${tag}: son sifatidagi Pinfl yo'q`);
  check(anyRaw("TRANSFORMERS", "name", (value) => value === 7), `${tag}: son sifatidagi TP nomi 7 yo'q`);
  check(anyRaw("TRANSFORMERS", "name", (value) => value === "07"), `${tag}: "07" TP nomi yo'q`);
  check(anyRaw("TRANSFORMERS", "latitude", (value) => typeof value === "string"), `${tag}: matnli koordinata yo'q`);
  check(anyRaw("VIOLATIONS", "transformer", (value) => value === 7), `${tag}: qoidabuzarlikda TP nomi 7 (son) yo'q`);
  const anySource = (type: TemplateType, field: string, source: CellSource) =>
    sheets[type].rows.some((row) => row.sources[field] === source && row.values[field] != null && !isInvalidCell(row.values[field]));
  for (const type of ["SUBSTATIONS", "FEEDERS", "TRANSFORMERS"] as const) {
    check(anySource(type, "lossKwh", "formula"), `${tag} ${type}: natijali formula (Yo'qotish) yo'q`);
  }
  check(anySource("VIOLATIONS", "damageUzs", "formula"), `${tag}: qoidabuzarlikda natijali formula (zarar summasi) yo'q`);
  check(anySource("TRANSFORMERS", "address", "richText"), `${tag}: TP manzilida boy matn yo'q`);
  check(anySource("SUBSCRIBERS", "fullName", "richText"), `${tag}: abonent FISH da boy matn yo'q`);
  check(
    [...data.transformers.values()].some((tp) => tp.lossKwh < 0 && sheets.TRANSFORMERS.rows.some((row) => row.row === tp.row && row.sources.lossKwh === "formula")),
    `${tag}: manfiy natijali formula yo'q`,
  );

  checkSubscriberDates(tag, month, data);
  checkViolatorKinds(tag, data);
}

/** Abonent sanalari: shartnoma <= o'rnatish <= ko'rsatkich/to'lov <= hisobot sanasi. */
function checkSubscriberDates(tag: string, month: MonthInfo, data: Required<MonthData>): void {
  const reportEnd = addDays(month.reportDate, 1);
  const installedPerDay = new Map<number, number>();
  for (const subscriber of data.subscribers.values()) {
    const where = `${tag} abonent ${subscriber.row} (${subscriber.key})`;
    const { contractDate, meterInstalledAt, lastReadingAt, lastPaymentDate } = subscriber;
    check(contractDate != null && meterInstalledAt != null, `${where}: shartnoma yoki o'rnatish sanasi yo'q`);
    if (!contractDate || !meterInstalledAt) continue;
    installedPerDay.set(meterInstalledAt.getTime(), (installedPerDay.get(meterInstalledAt.getTime()) ?? 0) + 1);
    check(meterInstalledAt >= contractDate, `${where}: hisoblagich shartnomadan oldin o'rnatilgan`);
    check(meterInstalledAt < reportEnd, `${where}: o'rnatish sanasi hisobotdan keyin`);
    const floor = maxDate(contractDate, meterInstalledAt);
    if (lastReadingAt) {
      check(dayOf(lastReadingAt) >= floor, `${where}: oxirgi ko'rsatkich ${isoText(lastReadingAt)} shartnoma/o'rnatishdan oldin`);
      check(lastReadingAt < reportEnd, `${where}: oxirgi ko'rsatkich hisobotdan keyin`);
    }
    if (lastPaymentDate) {
      check(lastPaymentDate >= floor, `${where}: oxirgi to'lov ${isoText(lastPaymentDate)} shartnoma/o'rnatishdan oldin`);
      check(lastPaymentDate < reportEnd, `${where}: oxirgi to'lov hisobotdan keyin`);
    }
    check((lastPaymentDate == null) === (subscriber.lastPaymentUzs == null), `${where}: to'lov sanasi va summasi faqat birga`);
    check(subscriber.meterStatus !== "ONLINE" || lastReadingAt != null, `${where}: aloqadagi hisoblagichda oxirgi ko'rsatkich sanasi yo'q`);
  }
  const busiest = Math.max(...installedPerDay.values());
  check(busiest <= 20, `${tag}: bir kunda ${busiest} ta hisoblagich o'rnatilgan (sana qisilib qolgan)`);
}

/** Abonentga bog'langan qoidabuzarlik turi abonent turiga mos (Yuridik - yuridik, Jismoniy - aholi). */
function checkViolatorKinds(tag: string, data: Required<MonthData>): void {
  const kindByName = new Map<string, SubscriberKind[]>();
  for (const subscriber of data.subscribers.values()) {
    const key = joinKey(subscriber.transformerKey, nameKey(subscriber.fullName));
    kindByName.set(key, [...(kindByName.get(key) ?? []), subscriber.kind]);
  }
  let linked = 0;
  for (const violation of data.violations) {
    const kinds = kindByName.get(joinKey(violation.transformerKey, nameKey(violation.subscriberName)));
    if (!kinds) continue;
    linked += 1;
    const expected = subscriberKindOf(violation.value as ViolatorType);
    check(
      expected == null || kinds.every((kind) => kind === expected),
      `${tag} qoidabuzarlik ${violation.row}: ${violation.value} turi ${kinds.join("/")} abonentga bog'langan`,
    );
  }
  check(linked > 0, `${tag}: abonentga bog'langan qoidabuzarlik yo'q`);
}

function checkMonthPair(previous: MonthInfo, current: MonthInfo, before: Required<MonthData>, after: Required<MonthData>): void {
  const tag = `${previous.key} -> ${current.key}`;
  check([...before.feeders.keys()].every((key) => after.feeders.has(key)), `${tag}: fider yo'qolgan`);
  check([...before.transformers.keys()].every((key) => after.transformers.has(key)), `${tag}: TP yo'qolgan`);
  check(after.transformers.size > before.transformers.size, `${tag}: yangi TP qo'shilmagan`);
  if (current.index === 1) check(after.feeders.size === before.feeders.size + 1, `${tag}: avgustda bitta yangi fider kutilgan`);

  const removed = [...before.subscribers.keys()].filter((key) => !after.subscribers.has(key)).length;
  const added = [...after.subscribers.keys()].filter((key) => !before.subscribers.has(key)).length;
  check(removed > 0 && added > 0, `${tag}: abonentlar qo'shilgan ${added}, o'chirilgan ${removed}`);

  let debtChanged = 0;
  let moved = 0;
  for (const [key, subscriber] of after.subscribers) {
    const old = before.subscribers.get(key);
    if (!old) continue;
    if (old.meterReading != null && subscriber.meterReading != null) {
      check(subscriber.meterReading >= old.meterReading, `${tag}: ${key} hisoblagich ko'rsatkichi kamaygan`);
    }
    check(old.fullName === subscriber.fullName, `${tag}: ${key} nomi o'zgargan`);
    checkSubscriberDatePair(tag, key, old, subscriber);
    if (old.debtUzs !== subscriber.debtUzs) debtChanged += 1;
    if (old.transformerKey !== subscriber.transformerKey) moved += 1;
  }
  check(debtChanged > 50, `${tag}: qarzdorlik o'zgargan abonentlar ${debtChanged}`);
  if (current.index === 2) check(moved === 3, `${tag}: TP almashtirgan abonentlar ${moved}`);
}

const sameDate = (a: Date | null, b: Date | null) => (a == null ? b == null : b != null && a.getTime() === b.getTime());

/** Bir abonentning ketma-ket ikki oyi: sanalar barqaror, orqaga ketmaydi va yo'qolmaydi. */
function checkSubscriberDatePair(tag: string, key: string, old: SubscriberRec, current: SubscriberRec): void {
  const where = `${tag}: ${key}`;
  check(sameDate(old.contractDate, current.contractDate), `${where} shartnoma sanasi o'zgargan`);
  check(sameDate(old.meterInstalledAt, current.meterInstalledAt), `${where} hisoblagich o'rnatilgan sana o'zgargan`);

  if (old.lastReadingAt) {
    check(current.lastReadingAt != null, `${where} oxirgi ko'rsatkich sanasi yo'qolgan`);
    if (current.lastReadingAt) check(current.lastReadingAt >= old.lastReadingAt, `${where} oxirgi ko'rsatkich sanasi orqaga ketgan`);
  }
  if (current.meterStatus === "NOT_RESPONDING") {
    // Aloqaga chiqmayotgan hisoblagich: ko'rsatkich ham, sanasi ham o'tgan oydagidek.
    check(sameDate(old.lastReadingAt, current.lastReadingAt), `${where} aloqaga chiqmayotgan hisoblagich sanasi o'zgargan`);
    check(old.meterReading === current.meterReading, `${where} aloqaga chiqmayotgan hisoblagich ko'rsatkichi o'zgargan`);
  }

  if (old.lastPaymentDate) {
    check(current.lastPaymentDate != null, `${where} oxirgi to'lov yo'qolgan`);
    if (current.lastPaymentDate) {
      check(current.lastPaymentDate >= old.lastPaymentDate, `${where} oxirgi to'lov sanasi orqaga ketgan`);
      if (sameDate(old.lastPaymentDate, current.lastPaymentDate)) {
        check(old.lastPaymentUzs === current.lastPaymentUzs, `${where} o'sha to'lovning summasi o'zgargan`);
      }
    }
  }
}

/* ---------------------------------------------------------------------------
   Xato fayllar
   --------------------------------------------------------------------------- */

interface InvalidCase {
  file: string;
  type: TemplateType;
  rows: Row[];
  sheetName?: string;
  renameHeaders?: Record<string, string>;
  expected: IssueCode;
  row: number | null;
  column: string | null;
  description: string;
  /**
   * 2026-09 ning qolgan 5 ta fayli bilan BIRGA yuborilganda ham aynan shu bitta
   * xato chiqadimi. Fayl darajasidagi (fatal) xatoda yo'q: fayl oyi/turi
   * noma'lum bo'lib qoladi va keyingi fayllar ota ma'lumotsiz qoladi.
   */
  alongsideMonth: boolean;
}

function buildInvalidCases(district: District, september: MonthRows): InvalidCase[] {
  const substations = september.SUBSTATIONS;
  const feeders = september.FEEDERS;

  // 07: TP'si nomi bir ma'noli, qoidabuzarlik/murojaatda nomi yo'q aloqadagi abonent.
  const referenced = new Set([...september.VIOLATIONS, ...september.APPEALS].map((row) => nameKey(String(row.subscriberName))));
  const pool = incidentPool(district, 2);
  const allowedTps = new Set(pool.transformers);
  const victim = district.subscribers.find((subscriber) => {
    const tp = subscriber.tpByMonth[2];
    return tp && allowedTps.has(tp) && !tp.numericName && subscriber.months[2]?.status === "ONLINE" && !referenced.has(nameKey(subscriber.fullName));
  });
  const victimTp = victim?.tpByMonth[2];
  if (!victim || !victimTp) throw new Error("07-holat uchun abonent topilmadi");
  const victimMonth = victimTp.months[2];
  if (!victimMonth) throw new Error("07-holat TP holati yo'q");

  const ambiguous = september.VIOLATIONS[0];

  // 09: taxminiy zarari (kWh) bor qator - zarar summasi natijasiz formula bo'ladi.
  const unsaved = september.VIOLATIONS.slice(3).find((row) => typeof row.damageKwh === "number");
  if (!unsaved) throw new Error("09-holat uchun qoidabuzarlik topilmadi");
  const damageKwhLetter = String.fromCharCode(65 + COLUMNS.VIOLATIONS.findIndex(([field]) => field === "damageKwh"));
  const unsavedFormula = `${damageKwhLetter}6*1000`;

  return [
    {
      file: "01-unknown-headers.xlsx",
      type: "FEEDERS",
      rows: feeders,
      renameHeaders: { name: "Fider raqami", totalKwh: "Jami oqim" },
      alongsideMonth: false,
      expected: "HEADERS",
      row: null,
      column: null,
      description:
        "Fiderlar (2026-09). 2-qatorda \"Fider Nomi\" -> \"Fider raqami\" va \"Umumiy oqim\" -> \"Jami oqim\" deb o'zgartirilgan.\n" +
        "Kutilgan xato (fayl darajasida): shablon turi aniqlanmadi / majburiy sarlavha yo'q (\"Fider Nomi\", \"Umumiy oqim\").",
    },
    {
      file: "02-bad-sheet-date.xlsx",
      type: "SUBSTATIONS",
      rows: substations,
      sheetName: "Sentabr hisoboti",
      alongsideMonth: false,
      expected: "SHEET_DATE",
      row: null,
      column: null,
      description:
        "Podstansiyalar (2026-09 ma'lumoti). Varaq nomi \"Sentabr hisoboti\" - sana yo'q.\n" +
        "Kutilgan xato (fayl darajasida): varaq nomidan sana o'qilmadi.",
    },
    {
      file: "03-bad-number.xlsx",
      type: "SUBSTATIONS",
      rows: [
        ...substations,
        {
          name: "Sarvontepa",
          totalKwh: "4 51O 220,50",
          usefulKwh: 4_100_000,
          lossKwh: 410_220.5,
          address: "Baliqchi tumani, Sarvontepa",
          latitude: 40.86,
          longitude: 71.95,
          capacityKva: 6300,
          staff: STAFF[0],
        },
      ],
      alongsideMonth: true,
      expected: "NUMBER",
      row: 3 + substations.length,
      column: headerOf("SUBSTATIONS", "totalKwh"),
      description:
        "Podstansiyalar (2026-09), oxiriga yangi \"Sarvontepa\" qatori qo'shilgan: \"Umumiy oqim\" = \"4 51O 220,50\" (0 o'rniga O harfi).\n" +
        "Kutilgan xato: son tushunilmadi.",
    },
    {
      file: "04-missing-required-cell.xlsx",
      type: "FEEDERS",
      rows: [
        ...feeders,
        { substation: "Baliqchi", name: null, totalKwh: 52_000, usefulKwh: 50_500.25, lossKwh: 1_499.75, address: null, capacityKva: 4000, staff: STAFF[1] },
      ],
      alongsideMonth: true,
      expected: "REQUIRED",
      row: 3 + feeders.length,
      column: headerOf("FEEDERS", "name"),
      description:
        "Fiderlar (2026-09), oxiriga \"Fider Nomi\" bo'sh qator qo'shilgan.\n" +
        "Kutilgan xato: majburiy katak bo'sh.",
    },
    {
      file: "05-feeder-unknown-substation.xlsx",
      type: "FEEDERS",
      rows: [
        ...feeders,
        { substation: "Sarvontepa", name: "Yangi hayot", totalKwh: 41_000, usefulKwh: 39_800, lossKwh: 1_200, address: null, capacityKva: 2500, staff: STAFF[2] },
      ],
      alongsideMonth: true,
      expected: "PARENT",
      row: 3 + feeders.length,
      column: headerOf("FEEDERS", "substation"),
      description:
        "Fiderlar (2026-09), oxiriga podstansiyasi \"Sarvontepa\" bo'lgan fider qo'shilgan (2026-09 podstansiyalarida yo'q).\n" +
        "Kutilgan xato: ota obyekt shu oyda yo'q (fider -> podstansiya).",
    },
    {
      file: "06-duplicate-substation.xlsx",
      type: "SUBSTATIONS",
      rows: [
        ...substations,
        { ...substations[1], name: String(substations[1].name).toUpperCase() },
      ],
      alongsideMonth: true,
      expected: "DUPLICATE",
      row: 3 + substations.length,
      column: headerOf("SUBSTATIONS", "name"),
      description:
        `Podstansiyalar (2026-09), oxiriga "${String(substations[1].name).toUpperCase()}" qatori qo'shilgan - "${String(substations[1].name)}" bilan bir xil kalit.\n` +
        "Kutilgan xato: fayl ichida takroriy kalit (podstansiya nomi).",
    },
    {
      file: "07-tp-subscriber-count-mismatch.xlsx",
      type: "SUBSCRIBERS",
      rows: september.SUBSCRIBERS.filter((row) => row.contract !== victim.contract),
      alongsideMonth: true,
      expected: "COUNT_MISMATCH",
      row: null,
      column: null,
      description:
        `Abonentlar (2026-09) - "${victim.contract}" shartnomali (Aloqada) abonent qatori olib tashlangan.\n` +
        `Kutilgan xato: ${victimTp.feeder.substation.name} / ${victimTp.feeder.name} / ${victimTp.name} TP sida ` +
        `"Aloqadagi abonentlar" = ${victimMonth.online}, ro'yxatda esa ${victimMonth.online - 1} (aloqadan chiqqan: ${victimMonth.offline} = ${victimMonth.offline}).\n` +
        "Faqat 2026-09 Transformatorlar bazada bo'lsa (yoki shu submission'da bo'lsa) ishlaydi.",
    },
    {
      file: "08-violation-ambiguous-tp.xlsx",
      type: "VIOLATIONS",
      rows: [
        ...september.VIOLATIONS.slice(0, 3),
        { ...ambiguous, transformer: district.duplicatedTpName, subscriberName: "Hasanov Aziz Olimovich" },
      ],
      alongsideMonth: true,
      expected: "AMBIGUOUS_TP",
      row: 6,
      column: headerOf("VIOLATIONS", "transformer"),
      description:
        `Qoidabuzarliklar (2026-09): 3 ta to'g'ri qator + "TP Nomi" = "${district.duplicatedTpName}" bo'lgan qator.\n` +
        `"${district.duplicatedTpName}" 2026-09 da ikki fiderda bor - qaysi TP ekanini aniqlab bo'lmaydi.\n` +
        "Kutilgan xato: \"TP Nomi\" shu oyda bir nechta fiderda uchraydi (noaniq).",
    },
    {
      file: "09-formula-no-result.xlsx",
      type: "VIOLATIONS",
      rows: [
        ...september.VIOLATIONS.slice(0, 3),
        { ...unsaved, damageUzs: { formula: { minuend: "damageKwh", factor: 1000 }, result: null } },
      ],
      alongsideMonth: true,
      expected: "FORMULA",
      row: 6,
      column: headerOf("VIOLATIONS", "damageUzs"),
      description:
        `Qoidabuzarliklar (2026-09): 3 ta to'g'ri qator + "Keltirilgan zarar miqdori (UZS)" katagi natijasiz formula (=${unsavedFormula}) bo'lgan qator.\n` +
        "Fayl formulani hisoblamaydigan dasturda yozilgandek - katakda saqlangan natija (<v>) yo'q.\n" +
        "Kutilgan xato: formula natijasi yo'q.",
    },
  ];
}

function invalidReadme(cases: readonly InvalidCase[]): string {
  const alongside = cases.filter((item) => item.alongsideMonth);
  const standalone = cases.filter((item) => !item.alongsideMonth);
  const lines = [
    "Xato namunaviy fayllar (scripts/sample-data.ts yaratgan, qo'lda tahrirlamang)",
    "===========================================================================",
    "",
    "Har bir fayl importni BITTA aniq xato bilan rad etishi kerak (butun yuklash",
    "rad etiladi, bazaga hech narsa yozilmaydi).",
    "",
    "Asosiy kontekst (BARCHA fayllar uchun): avval .samples/2026-09/ dagi 6 ta",
    "faylni yuklang (Saqlash), keyin shu papkadagi faylni YAKKA o'zi tekshiring.",
    "",
    `Muqobil (faqat ${alongside.map((item) => item.file.slice(0, 2)).join(", ")}): bazada 2026-09 bo'lmasa ham, faylni`,
    ".samples/2026-09/ dagi qolgan 5 ta fayl bilan BIRGA yuboring (shu faylning",
    "shablonidagi to'g'ri faylni chiqarib tashlang - bir shablon bir oyda ikki",
    "marta bo'lmasin). Natija ham aynan bitta xato.",
    "",
    `${standalone.map((item) => item.file.slice(0, 2)).join(" va ")} - faqat YAKKA (2026-09 saqlangandan keyin): bu xato fayl`,
    "darajasida (shablon turi yoki oyi aniqlanmaydi), shuning uchun boshqa fayllar",
    "bilan birga yuborilsa, keyingi fayllar ham ota ma'lumotsiz qolib, ko'plab",
    "qo'shimcha xato chiqadi.",
    "",
    "Qator raqami - Excel qatori (ma'lumot 3-qatordan boshlanadi).",
    "",
  ];
  for (const item of cases) {
    lines.push(`${item.file}`);
    lines.push(`  Shablon: ${TEMPLATE_FILE_NAME[item.type]}`);
    lines.push(`  Tekshirish: ${item.alongsideMonth ? "yakka yoki 2026-09 ning qolgan 5 ta fayli bilan birga" : "faqat yakka (2026-09 saqlangandan keyin)"}`);
    if (item.row != null) lines.push(`  Joyi: ${item.row}-qator, "${item.column}" ustuni`);
    for (const line of item.description.split("\n")) lines.push(`  ${line}`);
    lines.push("");
  }
  return lines.join("\r\n");
}

/* ---------------------------------------------------------------------------
   Asosiy oqim
   --------------------------------------------------------------------------- */

interface FileStat {
  file: string;
  rows: number;
  bytes: number;
}

async function fileStat(file: string, rows: number): Promise<FileStat> {
  return { file: path.relative(ROOT, file).replace(/\\/g, "/"), rows, bytes: (await stat(file)).size };
}

async function main(): Promise<void> {
  const district = buildDistrict();
  const stats: FileStat[] = [];

  for (const folder of [...MONTHS.map((month) => month.key), "invalid"]) {
    await rm(path.join(OUTPUT_DIR, folder), { recursive: true, force: true });
    await mkdir(path.join(OUTPUT_DIR, folder), { recursive: true });
  }

  // 1. To'g'ri oylar.
  const monthRows: MonthRows[] = [];
  for (const month of MONTHS) {
    const rows = buildMonthRows(district, month);
    monthRows.push(rows);
    for (const type of TEMPLATE_ORDER) {
      const file = path.join(OUTPUT_DIR, month.key, TEMPLATE_FILE_NAME[type]);
      await writeWorkbook(file, type, rows[type], { sheetName: month.sheetName, monthName: month.name });
      stats.push(await fileStat(file, rows[type].length));
    }
  }

  // 2. Qayta o'qib tekshirish.
  const monthData: Required<MonthData>[] = [];
  for (const month of MONTHS) {
    const sheets = {} as Record<TemplateType, SheetData>;
    const context: MonthData = {};
    const warnings: Issue[] = [];
    for (const type of TEMPLATE_ORDER) {
      const sheet = await readSheet(path.join(OUTPUT_DIR, month.key, TEMPLATE_FILE_NAME[type]), type);
      sheets[type] = sheet;
      check(sheet.rows.length === monthRows[month.index][type].length, `${month.key} ${type}: qatorlar soni mos emas`);
      // Yangi oy: fayllar TEMPLATE_ORDER bo'yicha, har biri oldingilariga tayanadi.
      const { report, patch } = validateSheet(sheet, context);
      check(report.errors.length === 0, `${month.key} ${type}: xatolar: ${formatIssues(report.errors)}`);
      warnings.push(...report.warnings);
      Object.assign(context, patch);
    }
    const data = context as Required<MonthData>;
    // Oy to'liq yuklangandan keyin har bir faylni qayta yuklash ham xatosiz.
    for (const type of TEMPLATE_ORDER) {
      const { report } = validateSheet(sheets[type], data);
      check(report.errors.length === 0, `${month.key} ${type} (qayta yuklash): xatolar: ${formatIssues(report.errors)}`);
    }
    checkMonth(month, sheets, data, warnings, district);
    monthData.push(data);
  }
  for (let index = 1; index < MONTHS.length; index++) {
    checkMonthPair(MONTHS[index - 1], MONTHS[index], monthData[index - 1], monthData[index]);
  }

  // 3. Xato fayllar: README dagi ikkala kontekstda tekshiriladi.
  const september = MONTHS[2];
  const cases = buildInvalidCases(district, monthRows[2]);
  const septemberSheets = new Map<TemplateType, SheetData>();
  for (const type of TEMPLATE_ORDER) {
    septemberSheets.set(type, await readSheet(path.join(OUTPUT_DIR, september.key, TEMPLATE_FILE_NAME[type]), type));
  }
  for (const item of cases) {
    const file = path.join(OUTPUT_DIR, "invalid", item.file);
    await writeWorkbook(file, item.type, item.rows, {
      sheetName: item.sheetName ?? september.sheetName,
      monthName: september.name,
      renameHeaders: item.renameHeaders,
    });
    stats.push(await fileStat(file, item.rows.length));
    const sheet = await readSheet(file, item.type);
    const matches = (errors: readonly Issue[]) =>
      errors.length === 1 && errors[0].code === item.expected && errors[0].row === item.row && errors[0].column === item.column;
    const expected = `kutilgan ${item.expected} ${item.row ?? "-"}:${item.column ?? "-"}`;

    // a) 2026-09 bazada saqlangan, fayl yakka o'zi.
    const alone = validateSheet(sheet, monthData[2]).report.errors;
    check(matches(alone), `invalid/${item.file} (yakka): ${expected}, olingan: ${formatIssues(alone) || "xato yo'q"}`);

    // b) Bazada 2026-09 yo'q; fayl 2026-09 ning qolgan 5 ta fayli bilan bitta submission'da.
    const context: MonthData = {};
    const together: Issue[] = [];
    for (const type of TEMPLATE_ORDER) {
      const current = type === item.type ? sheet : septemberSheets.get(type);
      if (!current) throw new Error(`2026-09 ${type} o'qilmagan`);
      const { report, patch } = validateSheet(current, context);
      together.push(...report.errors);
      Object.assign(context, patch);
    }
    if (item.alongsideMonth) {
      check(matches(together), `invalid/${item.file} (5 ta fayl bilan birga): ${expected}, olingan: ${formatIssues(together) || "xato yo'q"}`);
    } else {
      // README "faqat yakka" deydi - birga yuborilsa haqiqatan ko'p xato chiqishi kerak.
      check(together.length > 1, `invalid/${item.file} (5 ta fayl bilan birga): README "faqat yakka" deydi, lekin ${together.length} ta xato`);
    }
  }
  await writeFile(path.join(OUTPUT_DIR, "invalid", "README.txt"), invalidReadme(cases), "utf8");

  // 4. Hisobot.
  console.log("Fayl".padEnd(58), "Qatorlar".padStart(8), "Hajm".padStart(10));
  for (const item of stats) {
    console.log(item.file.padEnd(58), String(item.rows).padStart(8), `${(item.bytes / 1024).toFixed(1)} KB`.padStart(10));
  }
  for (const [index, month] of MONTHS.entries()) {
    const data = monthData[index];
    console.log(
      `${month.key}: ${data.substations.size} podstansiya, ${data.feeders.size} fider, ${data.transformers.size} TP, ` +
      `${data.subscribers.size} abonent, ${data.violations.length} qoidabuzarlik, ${data.appeals.length} murojaat`,
    );
  }
  console.log(`Takroriy TP nomi (ogohlantirish uchun): ${district.duplicatedTpName}`);

  if (failures.length > 0) {
    console.error(`\nTEKSHIRUV MUVAFFAQIYATSIZ (${failures.length}):`);
    for (const failure of failures.slice(0, 50)) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log("\nTekshiruv: barcha qoidalar bajarildi.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
