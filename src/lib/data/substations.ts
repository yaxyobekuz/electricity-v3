import { between, noise, pick, series } from "./seed";

/** Podstansiya holati - jadvaldagi nishon va detal sahifasidagi rang. */
export type SubstationStatus = "active" | "fault" | "maintenance";

export const SUBSTATION_STATUS_LABEL: Record<SubstationStatus, string> = {
  active: "Faol",
  maintenance: "Ta’mirda",
  fault: "Nosoz",
};

export interface Substation {
  id: string;
  /** Hujjatlardagi qisqa kod: "PS-01". */
  code: string;
  name: string;
  /** Mahalla yoki qishloq. */
  area: string;
  /** "110/35/10 kV". */
  voltage: string;
  status: SubstationStatus;
  /** Umumiy quvvat, MVA. */
  capacityMva: number;
  /** Joriy yuklama, foiz. */
  loadPercent: number;
  feeders: number;
  /** Oylik iste'mol, kWh. */
  consumptionKwh: number;
  /** Yo'qotish ulushi, foiz. */
  lossPercent: number;
  /** Ishga tushirilgan yil. */
  commissioned: number;
  responsible: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  /** 12 oylik iste'mol, ming kWh - detal sahifasidagi grafik uchun. */
  monthly: readonly number[];
}

/**
 * Podstansiyalar ro'yxatining "suyagi": nom, hudud va kuchlanish darajasi
 * qo'lda yozilgan, qolgan ko'rsatkichlar `seed.ts` yordamida determinlashgan
 * tarzda hisoblanadi.
 */
const BASE: ReadonlyArray<{
  name: string;
  area: string;
  voltage: string;
  status: SubstationStatus;
}> = [
  { name: "Baliqchi", area: "Baliqchi shaharchasi", voltage: "110/35/10 kV", status: "active" },
  { name: "Markaz", area: "Markaz mahallasi", voltage: "110/10 kV", status: "active" },
  { name: "Chinobod", area: "Chinobod mahallasi", voltage: "35/10 kV", status: "active" },
  { name: "Sarnovul", area: "Sarnovul mahallasi", voltage: "35/10 kV", status: "maintenance" },
  { name: "Fayzobod", area: "Fayzobod mahallasi", voltage: "110/35/10 kV", status: "active" },
  { name: "Qorako’l", area: "Qorako’l qishlog’i", voltage: "35/10 kV", status: "active" },
  { name: "Oqtepa", area: "Oqtepa mahallasi", voltage: "35/10 kV", status: "active" },
  { name: "Yangiobod", area: "Yangiobod qishlog’i", voltage: "35/10 kV", status: "fault" },
  { name: "Do’stlik", area: "Do’stlik mahallasi", voltage: "110/10 kV", status: "active" },
  { name: "Navbahor", area: "Navbahor qishlog’i", voltage: "35/10 kV", status: "active" },
  { name: "Gulzor", area: "Gulzor mahallasi", voltage: "35/10 kV", status: "maintenance" },
  { name: "Bo’ston", area: "Bo’ston qishlog’i", voltage: "35/10 kV", status: "active" },
];

const RESPONSIBLE = [
  "Karimov Egamberdi",
  "Yusupov Sardor",
  "Tursunov Bekzod",
  "Aliyev Jasur",
  "Nazarov Oybek",
  "Rahimov Shuhrat",
] as const;

const STREETS = [
  "Navoiy ko’chasi",
  "Amir Temur ko’chasi",
  "Mustaqillik ko’chasi",
  "Bog’ ko’chasi",
  "Tinchlik ko’chasi",
  "Yoshlik ko’chasi",
] as const;

/** Baliqchi tumani markazi - koordinatalar shu nuqta atrofida tarqatiladi. */
const CENTER = { lat: 40.8789, lng: 71.9792 };

export const SUBSTATIONS: readonly Substation[] = BASE.map((base, index) => {
  const seed = index + 1;
  const capacityMva = between(seed * 3.1, 10, 63, 1);
  const consumptionKwh = between(seed * 9.1, 180_000, 1_240_000, 100);

  return {
    id: `ps-${String(index + 1).padStart(3, "0")}`,
    code: `PS-${String(index + 1).padStart(2, "0")}`,
    name: `${base.name} podstansiyasi`,
    area: base.area,
    voltage: base.voltage,
    status: base.status,
    capacityMva,
    // Nosoz podstansiya yuklama bermaydi, ta'mirdagisi past yuklamada ishlaydi.
    loadPercent:
      base.status === "fault" ? 0 : between(seed * 11.7, base.status === "maintenance" ? 18 : 46, 94, 1),
    feeders: between(seed * 13.3, 3, 14, 1),
    consumptionKwh,
    lossPercent: Number((7.4 + noise(seed * 17.9) * 8.2).toFixed(1)),
    commissioned: between(seed * 19.1, 1978, 2021, 1),
    responsible: pick(seed * 23.3, RESPONSIBLE),
    phone: `+998 ${between(seed * 29.7, 90, 99, 1)} ${between(seed * 31.1, 100, 999, 1)} ${between(seed * 37.3, 10, 99, 1)} ${between(seed * 41.9, 10, 99, 1)}`,
    address: `${base.area}, ${pick(seed * 43.1, STREETS)}, ${between(seed * 47.3, 1, 96, 1)}-uy`,
    lat: CENTER.lat + (noise(seed * 53.1) - 0.5) * 0.07,
    lng: CENTER.lng + (noise(seed * 59.7) - 0.5) * 0.2,
    monthly: series(seed * 61.3, 12, consumptionKwh / 1000, 0.18, 0.22),
  };
});

export function findSubstation(id: string): Substation | undefined {
  return SUBSTATIONS.find((item) => item.id === id);
}

/**
 * Podstansiyalarning O'Z ko'rsatkichlari. Transformator va iste'molchi
 * sonlari bu yerda yo'q: ular boshqa modullardagi haqiqiy ro'yxatlardan
 * hisoblanadi (`@/lib/data/relations`), aks holda ekrandagi son bilan
 * jadvaldagi qatorlar soni bir-biriga to'g'ri kelmasdi.
 */
export function substationTotals() {
  const active = SUBSTATIONS.filter((item) => item.status === "active").length;
  const capacity = SUBSTATIONS.reduce((sum, item) => sum + item.capacityMva, 0);
  const consumption = SUBSTATIONS.reduce((sum, item) => sum + item.consumptionKwh, 0);
  const load =
    SUBSTATIONS.reduce((sum, item) => sum + item.loadPercent, 0) / SUBSTATIONS.length;
  const loss =
    SUBSTATIONS.reduce((sum, item) => sum + item.lossPercent, 0) / SUBSTATIONS.length;

  return { total: SUBSTATIONS.length, active, capacity, consumption, load, loss };
}
