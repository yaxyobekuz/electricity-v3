/*
 * UI dagi barcha son va sanalar shu funksiyalar orqali o'tadi.
 *
 * Qoidalar:
 *   - mingliklar bo'shliq bilan ("1 234"), kasr - vergul ("12,4");
 *   - qiymat yo'q (null / NaN) bo'lsa - "—";
 *   - sanalar UTC maydonlaridan o'qiladi: Postgres `DATE` ustuni Prisma'da UTC
 *     yarim tunda keladi, mahalliy vaqt zonasi kunni surib yubormasin.
 *     Server va mijoz bir xil matn chiqarishi ham shunga bog'liq.
 */

/** Qiymat yo'qligini bildiruvchi belgi. */
export const EMPTY = "—";

type Numeric = number | null | undefined;

function isNumber(value: Numeric): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** "1 048 000" - butun songa yaxlitlaydi. */
export function num(value: Numeric): string {
  if (!isNumber(value)) return EMPTY;
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return sign + group(String(Math.abs(rounded)));
}

/** "1 234,5" - `digits` xonagacha, kasr qismi vergul bilan. */
export function dec(value: Numeric, digits = 1): string {
  if (!isNumber(value)) return EMPTY;
  const fixed = Math.abs(value).toFixed(digits);
  const [whole, fraction] = fixed.split(".");
  // "-0,0" chiqmasin.
  const sign = value < 0 && Number(fixed) !== 0 ? "-" : "";
  return sign + group(whole) + (fraction ? `,${fraction}` : "");
}

/** "12,4%" */
export function percent(value: Numeric, digits = 1): string {
  if (!isNumber(value)) return EMPTY;
  return `${dec(value, digits)}%`;
}

/** "12 ta" */
export function count(value: Numeric): string {
  if (!isNumber(value)) return EMPTY;
  return `${num(value)} ta`;
}

/** Katta sonni KPI kartasi uchun qiymat + birlikka ajratadi. */
export interface ScaledValue {
  value: string;
  unit: string;
}

const SCALES = [
  { factor: 1_000_000_000, prefix: "mlrd" },
  { factor: 1_000_000, prefix: "mln" },
  { factor: 1_000, prefix: "ming" },
] as const;

/**
 * `scaled(1_234_567, "kWh")` -> `{ value: "1,2", unit: "mln kWh" }`.
 * Mingdan kichik qiymat masshtablanmaydi.
 */
export function scaled(value: Numeric, unit: string, digits = 1): ScaledValue {
  if (!isNumber(value)) return { value: EMPTY, unit };
  const abs = Math.abs(value);
  for (const scale of SCALES) {
    if (abs >= scale.factor) {
      return { value: dec(value / scale.factor, digits), unit: `${scale.prefix} ${unit}` };
    }
  }
  return { value: num(value), unit };
}

/** "126 026 kWh" yoki "1,05 mln kWh". */
export function energy(kwh: Numeric): string {
  if (!isNumber(kwh)) return EMPTY;
  if (Math.abs(kwh) >= 1_000_000) {
    const parts = scaled(kwh, "kWh", 2);
    return `${parts.value} ${parts.unit}`;
  }
  return `${num(kwh)} kWh`;
}

/** "42,1 mln so’m", "5,6 mlrd so’m", "812,4 ming so’m", "900 so’m". */
export function money(uzs: Numeric): string {
  if (!isNumber(uzs)) return EMPTY;
  const parts = scaled(uzs, "so’m");
  return `${parts.value} ${parts.unit}`;
}

/* ---------------------------------------------------------------------------
   Sanalar va oylar
   --------------------------------------------------------------------------- */

/** O'zbekcha oy nomlari. */
export const MONTHS_UZ = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentabr",
  "Oktabr",
  "Noyabr",
  "Dekabr",
] as const;

/**
 * O'qlar uchun qisqartma. Noyob bo'lishi shart: "Iyun" va "Iyul" ikkalasi ham
 * "Iyu" bo'lsa, nivo band shkalasi ularni bitta ustunga birlashtiradi.
 */
export const MONTHS_SHORT_UZ = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "Iyn",
  "Iyl",
  "Avg",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
] as const;

type DateInput = Date | string | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "13-sentabr, 2026" */
export function formatDate(value: DateInput): string {
  const date = toDate(value);
  if (!date) return EMPTY;
  const month = MONTHS_UZ[date.getUTCMonth()].toLowerCase();
  return `${date.getUTCDate()}-${month}, ${date.getUTCFullYear()}`;
}

/** O'zbekiston vaqti (UTC+5, yozgi vaqt yo'q). */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** "13-sentabr, 2026 14:05" - Toshkent vaqti bilan. */
export function formatDateTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return EMPTY;
  const local = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${formatDate(local)} ${hh}:${mm}`;
}

/** "Sentabr 2026" */
export function monthLabel(value: DateInput): string {
  const date = toDate(value);
  if (!date) return EMPTY;
  return `${MONTHS_UZ[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "Sentabr" */
export function monthName(value: DateInput): string {
  const date = toDate(value);
  if (!date) return EMPTY;
  return MONTHS_UZ[date.getUTCMonth()];
}

/** "Sen" - diagramma o'qi uchun. */
export function monthShort(value: DateInput): string {
  const date = toDate(value);
  if (!date) return EMPTY;
  return MONTHS_SHORT_UZ[date.getUTCMonth()];
}

/** "2026-09" - URL va cookie'dagi davr kaliti. */
export function monthKey(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" -> 2026-09-01T00:00:00Z. Noto'g'ri kalit - null. */
export function parseMonthKey(key: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key ?? "");
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(Number(match[1]), month - 1, 1));
}

/** Oydagi kunlar soni. */
export function daysInMonth(value: Date): number {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate();
}
