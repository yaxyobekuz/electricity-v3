import type { MeterStatus } from "@/generated/prisma";
import type { BadgeTone } from "@/components/ui/DataTable";
import { dec, EMPTY, money, num } from "@/lib/format";

/*
 * Abonent sahifalari uchun umumiy ko'rinish qoidalari: holat ranglari va
 * hisoblagich ko'rsatkichi formati. Server va mijoz komponentlari ikkalasi
 * ham ishlatadi (`import type` - Prisma runtime mijozga tushmaydi).
 */

/** "Holati" nishoni: aloqada - yashil, aloqaga chiqmayotgan - sariq, sxema o'zgargan - qizil. */
export const METER_STATUS_TONE: Record<MeterStatus, BadgeTone> = {
  ONLINE: "green",
  NOT_RESPONDING: "amber",
  SCHEME_CHANGED: "red",
};

/** Filtr tugmasidagi nuqta rangi - nishon rangi bilan bir xil. */
export const METER_STATUS_DOT: Record<MeterStatus, string> = {
  ONLINE: "bg-accent-green",
  NOT_RESPONDING: "bg-accent-amber",
  SCHEME_CHANGED: "bg-accent-red",
};

/** Ma'lumotlar jadvalidagi rangli matn. */
export const METER_STATUS_TEXT: Record<MeterStatus, string> = {
  ONLINE: "text-state-ok",
  NOT_RESPONDING: "text-state-warn",
  SCHEME_CHANGED: "text-state-bad",
};

/**
 * Hisoblagich ko'rsatkichi - shablonda 2 xonagacha kasr bo'lishi mumkin:
 * "4 143,9", "12 500". Ortiqcha nollar yozilmaydi.
 */
export function reading(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  const hundredths = Math.round(value * 100);
  if (hundredths % 100 === 0) return num(hundredths / 100);
  return dec(hundredths / 100, hundredths % 10 === 0 ? 1 : 2);
}

/** Ishorali ko'rsatkich farqi: "+123,4", "-12". */
export function signedReading(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  const text = reading(value);
  return value > 0 && text !== "0" ? `+${text}` : text;
}

/** Aniq summa (jadval katagi uchun): "1 734 598 so’m". */
export function exactMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return EMPTY;
  return `${num(value)} so’m`;
}

/** Ishorali pul farqi: "+1,2 mln so’m", "-812,4 ming so’m". */
export function signedMoney(value: number): string {
  return value > 0 ? `+${money(value)}` : money(value);
}
