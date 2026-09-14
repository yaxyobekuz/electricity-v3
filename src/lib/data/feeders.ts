import { between, noise, pick } from "./seed";
import { SUBSTATIONS } from "./substations";

/** Fider holati - jadvaldagi nishon rangini belgilaydi. */
export type FeederStatus = "active" | "maintenance" | "offline";

export const FEEDER_STATUS_LABEL: Record<FeederStatus, string> = {
  active: "Faol",
  maintenance: "Ta’mirda",
  offline: "O’chirilgan",
};

export interface Feeder {
  id: string;
  /**
   * "F-03" - podstansiya ICHIDAGI tartib raqami (tuman bo'yicha takrorlanadi).
   * Transformatorning `feeder` maydoni aynan shu kodga ishora qiladi.
   */
  code: string;
  /** "Xaqulobod fideri". */
  name: string;
  substationId: string;
  substationName: string;
  /** "10 kV". */
  voltage: string;
  status: FeederStatus;
  /** Havo va kabel liniyasining umumiy uzunligi, km. */
  lengthKm: number;
  /** Joriy yuklama, foiz. */
  loadPercent: number;
  /** Oylik iste'mol, kWh. Bir podstansiya fiderlarining yig'indisi - podstansiya iste'moli. */
  consumptionKwh: number;
  /** Yo'qotish ulushi, foiz. */
  lossPercent: number;
}

/**
 * Fider nomlari - odatda liniya boradigan qishloq yoki mahalla nomi bilan
 * ataladi. Birinchi oltitasi bosh sahifadagi "Eng ko'p sarfga ega fiderlar"
 * diagrammasidan; ro'yxat tugagach nomlar "-2" qo'shimchasi bilan qaytadi.
 */
const NAMES = [
  "Xaqulobod", "Tovuqxona", "Chinobod", "Qiyali", "Maslahat", "Baliqchi",
  "Paxtakor", "Guliston", "Bog’ishamol", "Yangi hayot", "Istiqlol", "Mehnatobod",
  "Shodlik", "Zarbdor", "Obod", "Tinchlik", "Ittifoq", "Madaniyat",
  "Ko’kterak", "Uchtol", "Navro’z", "Oltinko’l", "Do’rmon", "Qo’shariq",
  "Nurafshon", "Sohil", "Bunyodkor", "Ma’rifat", "Olmazor", "Yulduz",
  "G’alaba", "Bahor", "Chorbog’", "Oqariq", "Sayxon", "Kamolot",
  "Sharq", "Oydin", "Qayrag’och", "Beshkapa", "Tolzor", "Karvon",
  "Shohimardon", "Chinor", "Mustaqillik", "Farovon", "Ziyokor", "Ipakyo’l",
  "Dehqonobod", "Sarbon", "Umid", "Samarqand", "Fazilat", "Mingtut",
  "Poytug’", "Qoraqum", "Yakkatut", "Obihayot",
] as const;

const VOLTAGES = ["10 kV", "10 kV", "6 kV"] as const;

function nameAt(index: number): string {
  const base = NAMES[index % NAMES.length];
  const round = Math.floor(index / NAMES.length);
  return round === 0 ? base : `${base}-${round + 1}`;
}

/**
 * Har bir podstansiyaga aynan `substation.feeders` ta fider biriktiriladi -
 * shunda podstansiyalar jadvalidagi "Fider" ustuni shu ro'yxat bilan mos
 * keladi. Holat podstansiyadan meros: nosoz podstansiya fiderlari
 * o'chirilgan, ta'mirdagisida esa bittasi ta'mirda.
 */
export const FEEDERS: readonly Feeder[] = SUBSTATIONS.flatMap((substation, stationIndex) => {
  const stationSeed = stationIndex + 1;
  const count = substation.feeders;
  // Tuman bo'yicha tartib raqami - nomlar takrorlanmasligi uchun.
  const offset = SUBSTATIONS.slice(0, stationIndex).reduce((sum, item) => sum + item.feeders, 0);

  // Iste'mol ulushlari: yig'indi podstansiya iste'moliga teng bo'lishi uchun
  // normallanadi, yaxlitlash qoldig'i oxirgi fiderga yoziladi.
  const weights = Array.from({ length: count }, (_, k) => 0.4 + noise(stationSeed * 71.3 + k * 5.9));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const shares = weights.map(
    (weight) => Math.round((substation.consumptionKwh * weight) / weightSum / 100) * 100,
  );
  shares[count - 1] = substation.consumptionKwh - shares.slice(0, -1).reduce((a, b) => a + b, 0);

  const repairIndex = Math.floor(noise(stationSeed * 83.1) * count);

  return shares.map((consumptionKwh, k): Feeder => {
    const seed = stationSeed * 100 + k;
    const status: FeederStatus =
      substation.status === "fault"
        ? "offline"
        : substation.status === "maintenance" && k === repairIndex
          ? "maintenance"
          : "active";

    const loadPercent =
      status === "offline"
        ? 0
        : status === "maintenance"
          ? between(seed * 11.9, 12, 34, 1)
          : Math.min(98, Math.max(22, substation.loadPercent + between(seed * 13.7, -18, 14, 1)));

    return {
      id: `fd-${String(offset + k + 1).padStart(3, "0")}`,
      code: `F-${String(k + 1).padStart(2, "0")}`,
      name: `${nameAt(offset + k)} fideri`,
      substationId: substation.id,
      substationName: substation.name,
      voltage: pick(seed * 17.3, VOLTAGES),
      status,
      lengthKm: Number((2.4 + noise(seed * 19.1) * 16.2).toFixed(1)),
      loadPercent,
      consumptionKwh,
      lossPercent: Number(Math.max(3, substation.lossPercent + (noise(seed * 23.9) - 0.5) * 5).toFixed(1)),
    };
  });
});

export function findFeeder(id: string): Feeder | undefined {
  return FEEDERS.find((item) => item.id === id);
}

/** Ro'yxat sahifasining yuqorisidagi umumiy ko'rsatkichlar. */
export function feederTotals() {
  const byStatus = (status: FeederStatus) =>
    FEEDERS.filter((item) => item.status === status).length;
  const length = FEEDERS.reduce((sum, item) => sum + item.lengthKm, 0);
  const consumption = FEEDERS.reduce((sum, item) => sum + item.consumptionKwh, 0);
  const load = FEEDERS.reduce((sum, item) => sum + item.loadPercent, 0) / FEEDERS.length;
  const loss = FEEDERS.reduce((sum, item) => sum + item.lossPercent, 0) / FEEDERS.length;

  return {
    total: FEEDERS.length,
    active: byStatus("active"),
    maintenance: byStatus("maintenance"),
    offline: byStatus("offline"),
    length,
    consumption,
    load,
    loss,
  };
}
