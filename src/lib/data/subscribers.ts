import { between, noise, pick, series } from "./seed";
import { TRANSFORMERS } from "./transformers";

/** Iste'molchi turi - tarif va hisob-kitob shu bo'yicha farqlanadi. */
export type SubscriberKind = "budget" | "household" | "legal";

export const SUBSCRIBER_KIND_LABEL: Record<SubscriberKind, string> = {
  household: "Aholi",
  legal: "Yuridik",
  budget: "Budjet",
};

/** To'lov holati. */
export type SubscriberStatus = "active" | "debtor" | "disconnected";

export const SUBSCRIBER_STATUS_LABEL: Record<SubscriberStatus, string> = {
  active: "Faol",
  debtor: "Qarzdor",
  disconnected: "O’chirilgan",
};

export interface Subscriber {
  id: string;
  /** Shartnoma raqami: "AB-104512". */
  code: string;
  name: string;
  kind: SubscriberKind;
  status: SubscriberStatus;
  transformerId: string;
  transformerCode: string;
  area: string;
  address: string;
  phone: string;
  meterNo: string;
  meterType: string;
  /** So'nggi ko'rsatkich, kWh. */
  lastReading: number;
  lastReadingDate: string;
  /** Oylik iste'mol, kWh. */
  monthlyKwh: number;
  /** Balans, so'm. Manfiy - qarzdorlik. */
  balance: number;
  /** Tarif, so'm/kWh. */
  tariff: number;
  contractDate: string;
  /** Hisoblagich ma'lumot yuborayaptimi. */
  online: boolean;
  /** 12 oylik iste'mol, kWh - detal sahifasidagi grafik uchun. */
  monthly: readonly number[];
}

/*
 * Nomlar tayyor ro'yxatdan olinmaydi, balki bo'laklardan yig'iladi: 306 ta
 * yozuvda bir xil ism sakkiz marta takrorlanib qolmasligi kerak.
 */

const SURNAMES = [
  "Karimov", "Yusupov", "Tursunov", "Aliyev", "Nazarov", "Rahimov",
  "Sobirov", "Ergashev", "Xolmatov", "Qodirov", "Sultonov", "Mirzayev",
  "Umarov", "Toshpo’latov", "Yo’ldoshev", "Hasanov", "Abdullayev", "Nurmatov",
  "Islomov", "Saidov", "Tolipov", "Bekmurodov", "Xasanov", "Ismoilov",
] as const;

const MALE_NAMES = [
  "Egamberdi", "Bekzod", "Oybek", "Dilshod", "Rustam", "Aziz", "Sanjar", "Akmal",
  "Jahongir", "Farrux", "Ilhom", "Otabek", "Sardor", "Jasur", "Shuhrat", "Ulug’bek",
] as const;

const FEMALE_NAMES = [
  "Nodira", "Malika", "Zulfiya", "Nilufar", "Dilnoza", "Gulnora", "Sevara", "Feruza",
  "Shahzoda", "Mohira", "Zilola", "Nargiza", "Munira", "Kamola", "Ozoda", "Ra’no",
] as const;

const FIRM_PREFIX = [
  "Baliqchi", "Andijon", "Sharq", "Oq Oltin", "Chinobod", "Universal",
  "Yangi", "Agro", "Nur", "Zamin", "Farovon", "Buyuk",
  "Oltin Vodiy", "Marvarid", "Diyor", "Hamkor",
] as const;

const FIRM_SUFFIX = [
  "Non", "Teks", "Savdo", "Qurilish", "Servis", "Sut", "Logistika", "Yulduzi",
] as const;

const FIRM_FORM = ["MChJ", "QK", "XK"] as const;

const BUDGET_TEMPLATES = [
  "{n}-son umumta’lim maktabi",
  "{n}-son bolalar bog’chasi",
  "{n}-son oilaviy poliklinika",
  "{n}-son kasb-hunar maktabi",
  "Tuman markaziy shifoxonasi",
  "Tuman hokimligi binosi",
  "Madaniyat va istirohat bog’i",
  "Sport majmuasi",
] as const;

const METER_TYPES = ["Mercury 230", "Энергомера CE102", "Itron ACE6000", "Iskra ME382"] as const;

const READING_DATES = [
  "9-avgust, 2026",
  "8-avgust, 2026",
  "7-avgust, 2026",
  "5-avgust, 2026",
  "1-avgust, 2026",
] as const;

const CONTRACT_MONTHS = ["mart", "aprel", "may", "iyun", "iyul"] as const;

/** Tarif, so'm/kWh - turga qarab. */
const TARIFF: Record<SubscriberKind, number> = {
  household: 450,
  legal: 1_150,
  budget: 900,
};

/**
 * Har bir transformatorga o'rtacha 6 tadan iste'molchi to'g'ri kelsin:
 * detal sahifasidagi "Ulangan iste'molchilar" jadvali bo'sh ko'rinmasligi va
 * ekrandagi son bilan qatorlar soni mos kelishi uchun.
 */
const TOTAL = TRANSFORMERS.length * 6;

function buildName(index: number, kind: SubscriberKind, seed: number): string {
  if (kind === "legal") {
    const prefix = FIRM_PREFIX[index % FIRM_PREFIX.length];
    const suffix = FIRM_SUFFIX[(index * 5) % FIRM_SUFFIX.length];
    const form = FIRM_FORM[(index * 7) % FIRM_FORM.length];
    return `“${prefix} ${suffix}” ${form}`;
  }
  if (kind === "budget") {
    const template = BUDGET_TEMPLATES[index % BUDGET_TEMPLATES.length];
    return template.replace("{n}", String(between(seed * 3.7, 1, 45, 1)));
  }
  // Aholi: familiya + ism; har uchinchisi ayol (familiyaga "a" qo'shiladi).
  const female = index % 3 === 1;
  const surname = SURNAMES[index % SURNAMES.length];
  const given = female
    ? FEMALE_NAMES[(index * 7) % FEMALE_NAMES.length]
    : MALE_NAMES[(index * 5) % MALE_NAMES.length];
  return `${surname}${female ? "a" : ""} ${given}`;
}

export const SUBSCRIBERS: readonly Subscriber[] = Array.from({ length: TOTAL }, (_, index) => {
  const seed = index + 501;
  // Har 11-chi budjet, har 6-chi yuridik, qolgani aholi.
  const kind: SubscriberKind =
    index % 11 === 5 ? "budget" : index % 6 === 4 ? "legal" : "household";

  const transformer = TRANSFORMERS[index % TRANSFORMERS.length];
  const monthlyKwh =
    kind === "household"
      ? between(seed * 3.3, 120, 640, 1)
      : kind === "legal"
        ? between(seed * 3.3, 1_800, 14_500, 10)
        : between(seed * 3.3, 900, 8_200, 10);

  // Har 7-chi qarzdor, har 17-chi o'chirilgan.
  const status: SubscriberStatus =
    index % 17 === 9 ? "disconnected" : index % 7 === 3 ? "debtor" : "active";
  const balance =
    status === "active"
      ? between(seed * 5.9, 0, 240_000, 100)
      : -between(seed * 5.9, 180_000, 4_200_000, 100);

  return {
    id: `ab-${String(index + 1).padStart(4, "0")}`,
    code: `AB-${between(seed * 7.1, 100_000, 199_999, 1)}`,
    name: buildName(index, kind, seed),
    kind,
    status,
    transformerId: transformer.id,
    transformerCode: transformer.code,
    area: transformer.area,
    address: transformer.address,
    phone: `+998 ${between(seed * 11.3, 90, 99, 1)} ${between(seed * 13.7, 100, 999, 1)} ${between(seed * 17.1, 10, 99, 1)} ${between(seed * 19.3, 10, 99, 1)}`,
    meterNo: String(between(seed * 23.7, 10_000_000, 99_999_999, 1)),
    meterType: pick(seed * 29.3, METER_TYPES),
    lastReading: between(seed * 31.9, 4_800, 98_400, 1),
    lastReadingDate: pick(seed * 37.7, READING_DATES),
    monthlyKwh,
    balance,
    tariff: TARIFF[kind],
    contractDate: `${between(seed * 41.1, 1, 28, 1)}-${CONTRACT_MONTHS[index % CONTRACT_MONTHS.length]}, ${between(seed * 43.3, 2009, 2025, 1)}`,
    // O'chirilgan iste'molchining hisoblagichi aloqada bo'lmaydi.
    online: status !== "disconnected" && noise(seed * 47.9) > 0.12,
    monthly: series(seed * 53.1, 12, monthlyKwh, 0.1, 0.3),
  };
});

export function findSubscriber(id: string): Subscriber | undefined {
  return SUBSCRIBERS.find((item) => item.id === id);
}

export function subscribersOfTransformer(transformerId: string): Subscriber[] {
  return SUBSCRIBERS.filter((item) => item.transformerId === transformerId);
}

/** Ro'yxat sahifasining yuqorisidagi umumiy ko'rsatkichlar. */
export function subscriberTotals() {
  const byStatus = (status: SubscriberStatus) =>
    SUBSCRIBERS.filter((item) => item.status === status).length;
  const byKind = (kind: SubscriberKind) =>
    SUBSCRIBERS.filter((item) => item.kind === kind).length;
  const debt = SUBSCRIBERS.filter((item) => item.balance < 0).reduce(
    (sum, item) => sum + Math.abs(item.balance),
    0,
  );

  return {
    total: SUBSCRIBERS.length,
    active: byStatus("active"),
    debtor: byStatus("debtor"),
    disconnected: byStatus("disconnected"),
    household: byKind("household"),
    legal: byKind("legal"),
    budget: byKind("budget"),
    offline: SUBSCRIBERS.filter((item) => !item.online).length,
    consumption: SUBSCRIBERS.reduce((sum, item) => sum + item.monthlyKwh, 0),
    debt,
  };
}
