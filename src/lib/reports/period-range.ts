import { EMPTY, monthLabel, monthName } from "@/lib/format";

/*
 * Bir necha hisobot oyini qamragan oraliq yorlig'i. Statistika sahifasi va
 * yillik hisobot bir xil matn chiqarishi uchun yagona funksiya.
 */

/**
 * Oylar (ISO, eskidan yangiga) -> `"Sentabr 2026"`, `"Iyul – Sentabr 2026"`
 * yoki `"Noyabr 2025 – Sentabr 2026"`. Bo'sh ro'yxat - "—".
 */
export function periodRangeLabel(months: readonly string[]): string {
  if (months.length === 0) return EMPTY;
  const first = months[0];
  const last = months[months.length - 1];
  if (months.length === 1 || first === last) return monthLabel(last);
  const sameYear = new Date(first).getUTCFullYear() === new Date(last).getUTCFullYear();
  return `${sameYear ? monthName(first) : monthLabel(first)} – ${monthLabel(last)}`;
}
