/*
 * Maket bosqichidagi ma'lumotlar uchun umumiy yordamchilar.
 *
 * Ma'lumot **determinlashgan**: `Math.random` ishlatilmaydi, hamma qiymat
 * seed'dan hisoblanadi. Bu ikki sababga ko'ra shart:
 *   1. Server va mijoz bir xil markup chizishi kerak (gidratsiya xatosi
 *      bo'lmasligi uchun);
 *   2. Ro'yxat va detal sahifasi bir xil sonni ko'rsatishi kerak.
 *
 * Xuddi shu yondashuv `src/lib/reports/demo.ts` da ham ishlatilgan.
 */

/** 0..1 oralig'idagi takrorlanuvchi "shovqin" - seed bo'yicha barqaror. */
export function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** `min`..`max` oralig'idagi son, `step` ga yaxlitlangan. */
export function between(seed: number, min: number, max: number, step = 1): number {
  const raw = min + noise(seed) * (max - min);
  return Math.round(raw / step) * step;
}

/** Ro'yxatdan seed bo'yicha barqaror element tanlaydi. */
export function pick<T>(seed: number, items: readonly T[]): T {
  return items[Math.floor(noise(seed) * items.length) % items.length];
}

/**
 * `count` ta qiymatdan iborat qator. `drift` - umumiy yo'nalish (musbat -
 * o'sish), `jitter` - qator ustidagi tebranish ulushi.
 */
export function series(
  seed: number,
  count: number,
  base: number,
  drift: number,
  jitter: number,
): number[] {
  return Array.from({ length: count }, (_, index) => {
    const trend = base * (1 + (drift * index) / count);
    const wobble = 1 + (noise(seed + index * 7.13) - 0.5) * jitter;
    return Math.round(trend * wobble);
  });
}

/* ---------------------------------------------------------------------------
   Formatlash - UI dagi barcha sonlar shu funksiyalar orqali o'tadi
   --------------------------------------------------------------------------- */

/** "1 048 000" - ming ajratuvchi sifatida uzilmas bo'shliq. */
export function num(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** "12,4" - o'nlik ajratuvchi vergul (o'zbek tilida shunday). */
export function dec(value: number, digits = 1): string {
  return value.toFixed(digits).replace(".", ",");
}

/** "42,1 mln so'm" yoki "812,4 ming so'm" - kattaligiga qarab. */
export function money(sum: number): string {
  const abs = Math.abs(sum);
  if (abs >= 1_000_000) return `${dec(sum / 1_000_000)} mln so’m`;
  if (abs >= 1_000) return `${dec(sum / 1_000)} ming so’m`;
  return `${num(sum)} so’m`;
}

/** "126 026 kWh" yoki "1,05 mln kWh". */
export function energy(kwh: number): string {
  if (Math.abs(kwh) >= 1_000_000) return `${dec(kwh / 1_000_000, 2)} mln kWh`;
  return `${num(kwh)} kWh`;
}

/** O'zbekcha oy nomlari - sana va o'q yorliqlari uchun. */
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

/** O'qlar uchun qisqartma: "Yan", "Fev", ... */
export const MONTHS_SHORT_UZ = MONTHS_UZ.map((month) => month.slice(0, 3));

/**
 * Maket sanasi. Barcha sahifalarda bir xil "bugun" ko'rsatilishi uchun
 * qat'iy qiymat - `new Date()` ishlatilmaydi (server/mijoz farqi va
 * skrinshotlarning o'zgarib turishi oldini oladi).
 */
export const TODAY = "10-avgust, 2026";
export const TODAY_TIME = "13:42";
