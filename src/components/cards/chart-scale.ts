import { dec, num } from "@/lib/format";

/*
 * Kartalardagi diagrammalar uchun shkala yordamchilari. Qiymatlar shablondan
 * keladi, shuning uchun har qanday holatga chidamli bo'lishi shart: bo'sh
 * ro'yxat, hammasi nol (nolga bo'lish yo'q), manfiy yo'qotish, NaN.
 */

/** Chiziqli o'qlar uchun qadam ko'paytuvchilari. */
const AXIS_FACTORS = [1, 2, 2.5, 5, 10] as const;

/**
 * Halqali diagrammalar uchun (bo'linmalar soni qat'iy - 5 yoki 8): 7,5 ham
 * ruxsat, aks holda 0..375 kabi maketdagi shkala 0..500 ga sakraydi.
 */
export const RING_FACTORS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10] as const;

/** Son yoki 0 - NaN/Infinity diagrammaga tushmasin. */
export function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** `value` dan katta yoki teng eng kichik "yaxlit" qadam (1-2-2,5-5 qatori). */
export function niceStep(value: number, factors: readonly number[] = AXIS_FACTORS): number {
  if (!(value > 0) || !Number.isFinite(value)) return 1;
  const base = 10 ** Math.floor(Math.log10(value));
  const factor = factors.find((item) => item * base >= value * (1 - 1e-9)) ?? 10;
  return Number((factor * base).toPrecision(6));
}

export interface LinearScale {
  min: number;
  max: number;
  step: number;
  /** `min` dan `max` gacha, qadam `step`. */
  ticks: number[];
}

/**
 * Barcha qiymatlarni (va nolni) o'z ichiga oluvchi yaxlit chiziqli shkala.
 * Hammasi nol (yoki ro'yxat bo'sh) bo'lsa - `0..1` (bo'sh diagramma ham o'qqa ega).
 */
export function linearScale(values: readonly number[], steps: number): LinearScale {
  const clean = values.map(finite);
  const lo = Math.min(0, ...clean);
  const hi = Math.max(0, ...clean);
  const step = hi - lo > 0 ? niceStep((hi - lo) / steps) : 1;
  const min = Math.floor(lo / step) * step;
  const max = Math.max(Math.ceil(hi / step) * step, min + step);
  const ticks: number[] = [];
  // Suzuvchi nuqta xatosi to'planmasin - har bir bo'linma alohida hisoblanadi.
  for (let index = 0; index <= Math.round((max - min) / step) && index <= 50; index += 1) {
    ticks.push(Number((min + step * index).toPrecision(12)));
  }
  return { min, max, step, ticks };
}

/**
 * Qat'iy `divisions` bo'linmali shkala (halqali diagrammalar): `max` doim
 * `step * divisions`. Eng katta qiymat nol yoki manfiy bo'lsa - qadam 1.
 */
export function fixedScale(peak: number, divisions: number): { max: number; step: number } {
  const step = niceStep(finite(peak) / divisions, RING_FACTORS);
  return { max: step * divisions, step };
}

/** Pul summasi uchun shkala birligi: eng katta qiymatga qarab so'm / ming / mln / mlrd. */
export function moneyUnit(peak: number): { divisor: number; unit: string } {
  const abs = Math.abs(finite(peak));
  if (abs >= 1_000_000_000) return { divisor: 1_000_000_000, unit: "mlrd so’m" };
  if (abs >= 1_000_000) return { divisor: 1_000_000, unit: "mln so’m" };
  if (abs >= 1_000) return { divisor: 1_000, unit: "ming so’m" };
  return { divisor: 1, unit: "so’m" };
}

/** "1 250", "12,5", "0,25" - ortiqcha nollarsiz, eng ko'pi 2 xona. */
export function plainNumber(value: number): string {
  const rounded = Number(finite(value).toFixed(2));
  if (Number.isInteger(rounded)) return num(rounded);
  const digits = String(rounded).split(".")[1]?.length ?? 1;
  return dec(rounded, Math.min(digits, 2));
}

/** Qisqa birliklar - kattasidan kichigiga. */
const COMPACT_UNITS = [
  { divisor: 1e9, suffix: "B" },
  { divisor: 1e6, suffix: "M" },
  { divisor: 1e3, suffix: "K" },
] as const;

/**
 * Tor o'q ustuni uchun: 12 500 -> "12,5K", 1 250 000 -> "1,25M".
 *
 * `plainNumber` ning 2 xonasi saqlanadi (1 xonagacha yumaloqlanmaydi) - aks
 * holda 2,5 qadamli shkaladagi 1 250 000 bo'linmasi "1,3M" bo'lib, jadval va
 * tultipdagi qiymatga zid chiqardi.
 */
export function compactNumber(value: number): string {
  const clean = finite(value);
  const abs = Math.abs(clean);
  if (abs < 10_000) return plainNumber(clean);
  for (const [index, unit] of COMPACT_UNITS.entries()) {
    if (abs < unit.divisor) continue;
    const scaled = clean / unit.divisor;
    // 999 999 -> "1 000K" emas, "1M": yumaloqlangach katta birlikka o'tadi.
    const bigger = COMPACT_UNITS[index - 1];
    if (bigger && Math.abs(Number(scaled.toFixed(2))) >= 1000) {
      return `${plainNumber(clean / bigger.divisor)}${bigger.suffix}`;
    }
    return `${plainNumber(scaled)}${unit.suffix}`;
  }
  return plainNumber(clean);
}
