import { FEEDERS } from "./feeders";
import { between, noise, series } from "./seed";
import { type Subscriber, subscribersOfTransformer } from "./subscribers";
import type { Transformer, TransformerStatus } from "./transformers";
import { type Verdict, violationsOfTransformer } from "./violations";

/*
 * Bitta transformator punkti (TP) qamrovidagi ko'rsatkichlar.
 *
 * TP detal sahifasi fider sahifasi bilan bir xil kartalardan tuzilgan, lekin
 * har bir son faqat SHU TP ga tegishli bo'lishi kerak. Imkon qadar haqiqiy
 * ro'yxatlardan olinadi:
 *   - abonentlar, qarzdorlik, aloqasiz hisoblagichlar - `subscribers.ts`;
 *   - qoidabuzarliklar - `violations.ts` (ro'yxat sahifasi bilan bir xil);
 *   - iste'mol, yo'qotish, yuklama, harorat - `transformers.ts`.
 * Reestrlarda yo'q narsa (o'tgan oy, sutkalik profil, TP ish jurnali) TP
 * kodidan determinlashgan tarzda hosil qilinadi.
 *
 * Modul faqat son va ro'yxat qaytaradi - matn formati va ikonkalar
 * `TransformerDetail` da.
 */

export interface ScopeDay {
  day: number;
  /** TP balans hisoblagichi bo'yicha, kWh. */
  billed: number;
  /** Abonentlar hisoblagichlari yig'indisi (foydali oqim), kWh. */
  consumed: number;
  loss: number;
}

export type ScopeWorkStatus = "inProgress" | "new" | "planned";

export interface ScopeWork {
  id: string;
  work: string;
  date: string;
  status?: ScopeWorkStatus;
}

/**
 * Sutkalik yuklama shakli (0..23 soat): tunda pasayish, ertalabki va kechki
 * pik. Nisbiy koeffitsiyent - TP ning joriy yuklamasiga ko'paytiriladi.
 */
const HOUR_SHAPE: readonly number[] = [
  0.42, 0.38, 0.35, 0.34, 0.36, 0.44, 0.58, 0.72, 0.8, 0.78, 0.74, 0.72, 0.7, 0.68,
  0.7, 0.74, 0.82, 0.92, 1, 0.98, 0.9, 0.78, 0.62, 0.5,
];

/** Mas'ul xodim uchun rasm - maketdagi yagona erkak portreti. */
const STAFF_PHOTO = "/map/abonent-male.jpg";

/**
 * `lastCheck` ning eng erta qiymati (9-iyun) dan ham oldingi sanalar - jurnalda
 * so'nggi ko'rik doim eng yangi yakunlangan ish bo'lib qoladi.
 */
const OLDER_DATES = ["28-may, 2026", "12-may, 2026", "21-aprel, 2026", "3-aprel, 2026"] as const;

/** Maket "bugun"idan (10-avgust) keyingi sanalar, o'sish tartibida. */
const FUTURE_DATES = ["12-avgust, 2026", "15-avgust, 2026", "21-avgust, 2026", "28-avgust, 2026"] as const;

const DONE_WORKS = [
  "Xatlov o’tkazish",
  "Yog’ tahlili",
  "Hisoblagich o’rnatish",
  "Izolyator almashtirish",
  "Rele himoyasini sozlash",
  "Kontaktlarni tortish",
] as const;

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** 0..1 ulushlar - KPI kartasidagi mayda ustunlar uchun. */
function fractions(values: readonly number[], floor = 0.08): number[] {
  const max = Math.max(...values);
  if (max <= 0) return values.map(() => floor);
  return values.map((value) => Math.max(floor, value / max));
}

function debtOf(subscribers: readonly Subscriber[]): number {
  return sum(subscribers.filter((item) => item.balance < 0).map((item) => -item.balance));
}

/**
 * TP ning birinchi (holatga bog'liq) rejadagi ishi. Sana keyingi ikki ishdan
 * oldin turadi - jadval muddat bo'yicha o'sib boradi.
 */
function statusWork(status: TransformerStatus): Omit<ScopeWork, "id"> {
  if (status === "critical") return { work: "Transformatorni ta’mirlash", status: "new", date: "Bugun" };
  if (status === "offline") {
    return { work: "Transformatorni qayta ishga tushirish", status: "inProgress", date: "Bugun" };
  }
  if (status === "warning") {
    return { work: "Yuklamani qo’shni TP ga taqsimlash", status: "new", date: FUTURE_DATES[0] };
  }
  return { work: "Profilaktik ko’rik", status: "planned", date: FUTURE_DATES[0] };
}

export function transformerScope(transformer: Transformer) {
  const seed = Number.parseInt(transformer.code.slice(3), 10) || 1;
  const subscribers = subscribersOfTransformer(transformer.id);

  /* --- Energiya: 30 kun va oy yig'indisi bir-biriga mos --------------- */

  // Kunlik qator oylik iste'molga moslab masshtablanadi, yaxlitlash qoldig'i
  // oxirgi kunga yoziladi - grafik yig'indisi KPI dagi son bilan bir xil.
  const factor = transformer.consumptionKwh / sum(transformer.daily);
  const billedDaily = transformer.daily.map((value) => Math.round(value * factor));
  billedDaily[billedDaily.length - 1] += transformer.consumptionKwh - sum(billedDaily);

  const days: ScopeDay[] = billedDaily.map((billed, index) => {
    const share = Math.max(0.5, transformer.lossPercent + (noise(seed * 5.3 + index * 1.7) - 0.5) * 4) / 100;
    const loss = Math.round(billed * share);
    return { day: index + 1, billed, consumed: billed - loss, loss };
  });

  const billed = transformer.consumptionKwh;
  const loss = sum(days.map((row) => row.loss));
  const consumed = billed - loss;

  const billedPrev = Math.round(billed * (1 + (noise(seed * 3.1) - 0.5) * 0.24));
  const lossPrev = Math.round(
    (billedPrev * Math.max(1, transformer.lossPercent + (noise(seed * 4.7) - 0.5) * 3)) / 100,
  );

  /* --- Abonentlar va qarzdorlik (haqiqiy ro'yxatdan) ------------------- */

  const offlineMeters = subscribers.filter((item) => !item.online).length;
  const debtors = subscribers.filter((item) => item.balance < 0);
  const debt = debtOf(subscribers);
  const debtPrev = Math.round((debt || 120_000) * (1 + (noise(seed * 6.1) - 0.3) * 0.5) / 100) * 100;

  const monthlyUsage = Array.from({ length: 12 }, (_, month) =>
    sum(subscribers.map((item) => item.monthly[month] ?? 0)),
  );

  const debtByKind = {
    total: debt,
    household: debtOf(subscribers.filter((item) => item.kind === "household")),
    other: debtOf(subscribers.filter((item) => item.kind !== "household")),
  };

  /* --- Yuklama profili ------------------------------------------------- */

  const hourly = HOUR_SHAPE.map((shape, hour) =>
    transformer.loadPercent === 0
      ? 0
      : Math.max(0, Math.round(transformer.loadPercent * shape + between(seed * 3.1 + hour * 7.13, -4, 4))),
  );
  const peakValue = Math.max(...hourly);
  const peakHour = peakValue > 0 ? hourly.indexOf(peakValue) : -1;

  /* --- Yo'qotish zarari: yo'qotilgan kWh x o'rtacha tarif --------------- */

  const usage = sum(subscribers.map((item) => item.monthlyKwh));
  const tariff = usage > 0 ? sum(subscribers.map((item) => item.monthlyKwh * item.tariff)) / usage : 450;
  const damage = loss * tariff;
  const natural = between(seed * 7.7, 48, 60, 1) / 100;
  const technological = between(seed * 9.1, 20, 30, 1) / 100;
  const damageByKind = {
    natural: damage * natural,
    technological: damage * technological,
    theft: damage * (1 - natural - technological),
  };

  /* --- Qoidabuzarliklar (haqiqiy reestrdan) ---------------------------- */

  const violations = violationsOfTransformer(transformer.code);
  const violationCounts = (["administrative", "criminal", "innocent"] as const).reduce(
    (counts, verdict) => ({
      ...counts,
      [verdict]: violations.filter((item) => item.verdict === verdict).length,
    }),
    {} as Record<Verdict, number>,
  );

  /* --- TP ish jurnali -------------------------------------------------- */

  const firstOld = Math.floor(noise(seed * 8.3) * OLDER_DATES.length);
  const secondOld = (firstOld + 1 + Math.floor(noise(seed * 8.9) * (OLDER_DATES.length - 1))) % OLDER_DATES.length;
  const firstWork = Math.floor(noise(seed * 9.7) * DONE_WORKS.length);

  const completedWorks: ScopeWork[] = [
    { id: "check", work: "Profilaktik ko’rik", date: transformer.lastCheck },
    ...[firstOld, secondOld]
      // Sanalar ro'yxati yangidan eskiga - jadval ham shu tartibda.
      .sort((a, b) => a - b)
      .map((dateIndex, order) => ({
        id: `done-${order}`,
        work: DONE_WORKS[(firstWork + order * 2) % DONE_WORKS.length],
        date: OLDER_DATES[dateIndex],
      })),
  ];

  const plannedWorks: ScopeWork[] = [
    { id: "status", ...statusWork(transformer.status) },
    offlineMeters > 0
      ? {
          id: "meters",
          work: `Aloqasiz hisoblagichlarni tekshirish (${offlineMeters} ta)`,
          status: "inProgress",
          date: FUTURE_DATES[1],
        }
      : { id: "meters", work: "Hisoblagich ko’rsatkichlarini yig’ish", status: "planned", date: FUTURE_DATES[1] },
    debtors.length > 0
      ? {
          id: "debt",
          work: `Qarzdor abonentlarni ogohlantirish (${debtors.length} ta)`,
          status: "planned",
          date: FUTURE_DATES[2],
        }
      : { id: "debt", work: "Xatlov o’tkazish", status: "planned", date: FUTURE_DATES[3] },
  ];

  /* --- Fider va mas'ul xodim ------------------------------------------- */

  const feeder = FEEDERS.find(
    (item) => item.substationId === transformer.substationId && item.code === transformer.feeder,
  );

  const staff = {
    name: transformer.responsible,
    phone: `+998 ${between(seed * 11.3, 90, 99, 1)} ${between(seed * 13.7, 100, 999, 1)} ${between(seed * 17.1, 10, 99, 1)} ${between(seed * 19.3, 10, 99, 1)}`,
    photo: STAFF_PHOTO,
  };

  return {
    feeder,
    days,
    energy: { billed, consumed, loss, billedPrev, lossPrev, consumedPrev: billedPrev - lossPrev },
    bars: {
      billed: fractions(days.map((row) => row.billed)),
      consumed: fractions(days.map((row) => row.consumed)),
      loss: fractions(days.map((row) => row.loss)),
      usage: fractions(monthlyUsage),
      hourly: fractions(hourly),
      debt: fractions(series(seed * 21.7, 12, Math.max(debt, 50_000), 0.2, 0.6)),
    },
    subscribers: [...subscribers].sort((a, b) => b.monthlyKwh - a.monthlyKwh),
    offlineMeters,
    debtors: debtors.length,
    debt,
    debtPrev,
    debtByKind,
    peakHour,
    damage,
    damageByKind,
    violationCounts,
    completedWorks,
    plannedWorks,
    staff,
  };
}

export type TransformerScope = ReturnType<typeof transformerScope>;
