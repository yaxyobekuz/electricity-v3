/*
 * Hisoblangan ko'rsatkichlar uchun YAGONA formulalar. Sahifalar foizni o'zi
 * hisoblamaydi - shu funksiyalarni chaqiradi, aks holda bir ko'rsatkich ikki
 * sahifada ikki xil chiqadi (masalan, oddiy o'rtacha va vaznli o'rtacha).
 */

/** Prisma `Decimal`, son yoki null -> son yoki null. */
export function toNumber(value: { toNumber(): number } | number | string | null | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return value.toNumber();
}

export function sum(values: readonly (number | null | undefined)[]): number {
  let total = 0;
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) total += value;
  }
  return total;
}

/**
 * Ulush, foizda. Butun nol yoki manfiy bo'lsa - null (nolga bo'lish yo'q).
 */
export function share(part: number | null | undefined, whole: number | null | undefined): number | null {
  if (part == null || whole == null || !(whole > 0)) return null;
  return (part / whole) * 100;
}

/**
 * Yo'qotish foizi = Yo'qotish / Umumiy oqim * 100.
 * Yig'ma qiymatlarda ham faqat YIG'INDILAR bo'linadi (Σ yo'qotish / Σ umumiy),
 * foizlarning o'rtachasi olinmaydi. Manfiy bo'lishi mumkin.
 */
export function lossPercent(totalKwh: number | null | undefined, lossKwh: number | null | undefined): number | null {
  return share(lossKwh, totalKwh);
}

export interface Delta {
  /** current - previous */
  diff: number;
  /** O'zgarish foizi; oldingi qiymat nol bo'lsa - null. */
  percent: number | null;
}

/** Oldingi davr bilan farq. Oldingi qiymat yo'q bo'lsa - null. */
export function delta(current: number | null | undefined, previous: number | null | undefined): Delta | null {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  return { diff, percent: previous !== 0 ? (diff / Math.abs(previous)) * 100 : null };
}

/** 0..1 ulushlar - kichik ustunli diagrammalar uchun (eng kattasi = 1). */
export function fractions(values: readonly number[]): number[] {
  const max = Math.max(0, ...values);
  if (max <= 0) return values.map(() => 0);
  return values.map((value) => Math.max(0, value) / max);
}
