import { between, noise, pick, series } from "./seed";
import { SUBSTATIONS } from "./substations";

/** Transformator holati - jadvaldagi nishon rangini belgilaydi. */
export type TransformerStatus = "critical" | "offline" | "ok" | "warning";

export const TRANSFORMER_STATUS_LABEL: Record<TransformerStatus, string> = {
  ok: "Sog’lom",
  warning: "Ogohlantirish",
  critical: "Kritik",
  offline: "O’chirilgan",
};

export interface Transformer {
  id: string;
  /** "TP-066" - hujjatlarda va xaritada shu kod ishlatiladi. */
  code: string;
  substationId: string;
  substationName: string;
  area: string;
  feeder: string;
  status: TransformerStatus;
  /** Nominal quvvat, kVA. */
  powerKva: number;
  /** Joriy yuklama, foiz (100 dan oshsa - haddan tashqari yuklangan). */
  loadPercent: number;
  voltage: string;
  /** Oylik iste'mol, kWh. */
  consumptionKwh: number;
  lossPercent: number;
  /** Chulg'am harorati, °C. */
  temperature: number;
  /** Aloqada bo'lmagan hisoblagichlar soni. */
  offlineMeters: number;
  lastCheck: string;
  commissioned: number;
  responsible: string;
  address: string;
  lat: number;
  lng: number;
  /** 30 kunlik iste'mol, kWh - detal sahifasidagi grafik uchun. */
  daily: readonly number[];
}

const POWER_STEPS = [63, 100, 160, 250, 400, 630, 1000] as const;
const VOLTAGES = ["10/0,4 kV", "6/0,4 kV", "35/10 kV"] as const;

const RESPONSIBLE = [
  "Karimov Egamberdi",
  "Yusupov Sardor",
  "Tursunov Bekzod",
  "Aliyev Jasur",
  "Nazarov Oybek",
  "Rahimov Shuhrat",
  "Sobirov Dilshod",
  "Ergashev Ulug’bek",
] as const;

const STREETS = [
  "Navoiy ko’chasi",
  "Amir Temur ko’chasi",
  "Mustaqillik ko’chasi",
  "Bog’ ko’chasi",
  "Tinchlik ko’chasi",
  "Yoshlik ko’chasi",
  "Guliston ko’chasi",
] as const;

const CHECK_DATES = [
  "2-avgust, 2026",
  "28-iyul, 2026",
  "14-iyul, 2026",
  "5-iyul, 2026",
  "21-iyun, 2026",
  "9-iyun, 2026",
] as const;

/** Maketdagi kod raqamlari - xarita va bosh sahifadagi TP nomlariga mos. */
const CODES = [
  "TP-011", "TP-018", "TP-026", "TP-034", "TP-042", "TP-047",
  "TP-051", "TP-055", "TP-063", "TP-066", "TP-072", "TP-081",
  "TP-089", "TP-096", "TP-103", "TP-114", "TP-119", "TP-128",
  "TP-134", "TP-152", "TP-166", "TP-178", "TP-194", "TP-207",
  "TP-211", "TP-226", "TP-233", "TP-241", "TP-258", "TP-266",
  "TP-274", "TP-286", "TP-291", "TP-303", "TP-318", "TP-327",
  "TP-334", "TP-342", "TP-355", "TP-361", "TP-370", "TP-388",
  "TP-394", "TP-402", "TP-411", "TP-425", "TP-433", "TP-446",
  "TP-458", "TP-467", "TP-479",
] as const;

/**
 * Holatlar qo'lda taqsimlangan: maketdagi "3 ta kritik, 5 ta ogohlantirish"
 * hisobi saqlanishi kerak, shuning uchun tasodifiy tanlanmaydi.
 */
const STATUS_BY_INDEX: Record<number, TransformerStatus> = {
  9: "warning", // TP-066 - bosh sahifada "yuklama 92%"
  15: "critical", // TP-114
  4: "critical", // TP-042
  23: "critical", // TP-207
  6: "warning", // TP-051
  8: "warning", // TP-063
  17: "warning", // TP-128
  26: "warning", // TP-233
  31: "warning", // TP-286
  28: "offline", // TP-258
};

export const TRANSFORMERS: readonly Transformer[] = CODES.map((code, index) => {
  const seed = index + 101;
  const substation = SUBSTATIONS[index % SUBSTATIONS.length];
  const status = STATUS_BY_INDEX[index] ?? "ok";
  const powerKva = pick(seed * 3.7, POWER_STEPS);
  const consumptionKwh = between(seed * 7.9, 18_000, 168_000, 1);

  // Yuklama holatga bog'liq: kritik TP haddan tashqari yuklangan, o'chirilgani
  // umuman yuklama bermaydi.
  const loadPercent =
    status === "offline"
      ? 0
      : status === "critical"
        ? between(seed * 11.3, 104, 152, 1)
        : status === "warning"
          ? between(seed * 11.3, 84, 98, 1)
          : between(seed * 11.3, 28, 78, 1);

  return {
    id: `tp-${code.slice(3).toLowerCase()}`,
    code,
    substationId: substation.id,
    substationName: substation.name,
    area: substation.area,
    feeder: `F-${String((index % 9) + 1).padStart(2, "0")}`,
    status,
    powerKva,
    loadPercent,
    voltage: pick(seed * 13.1, VOLTAGES),
    consumptionKwh,
    lossPercent: Number((4.1 + noise(seed * 17.3) * 11.4).toFixed(1)),
    temperature: status === "offline" ? 21 : between(seed * 19.7, 42, 84, 1),
    offlineMeters: between(seed * 23.9, 0, 9, 1),
    lastCheck: pick(seed * 29.1, CHECK_DATES),
    commissioned: between(seed * 31.7, 1985, 2024, 1),
    responsible: pick(seed * 37.1, RESPONSIBLE),
    address: `${substation.area}, ${pick(seed * 41.3, STREETS)}, ${between(seed * 43.7, 1, 84, 1)}-uy`,
    lat: substation.lat + (noise(seed * 47.1) - 0.5) * 0.02,
    lng: substation.lng + (noise(seed * 53.3) - 0.5) * 0.05,
    daily: series(seed * 59.1, 30, consumptionKwh / 30, 0.08, 0.34),
  };
});

export function findTransformer(id: string): Transformer | undefined {
  return TRANSFORMERS.find((item) => item.id === id);
}

export function transformersOfSubstation(substationId: string): Transformer[] {
  return TRANSFORMERS.filter((item) => item.substationId === substationId);
}

/** Ro'yxat sahifasining yuqorisidagi umumiy ko'rsatkichlar. */
export function transformerTotals() {
  const byStatus = (status: TransformerStatus) =>
    TRANSFORMERS.filter((item) => item.status === status).length;
  const consumption = TRANSFORMERS.reduce((sum, item) => sum + item.consumptionKwh, 0);
  const load =
    TRANSFORMERS.reduce((sum, item) => sum + item.loadPercent, 0) / TRANSFORMERS.length;
  const loss =
    TRANSFORMERS.reduce((sum, item) => sum + item.lossPercent, 0) / TRANSFORMERS.length;
  const power = TRANSFORMERS.reduce((sum, item) => sum + item.powerKva, 0);

  return {
    total: TRANSFORMERS.length,
    ok: byStatus("ok"),
    warning: byStatus("warning"),
    critical: byStatus("critical"),
    offline: byStatus("offline"),
    consumption,
    load,
    loss,
    power,
  };
}
