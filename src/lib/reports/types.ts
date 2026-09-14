/*
 * Hisobot modeli - PDF (`pdf.ts`) va Excel (`excel.ts`) uchun yagona manba.
 * Model `src/lib/queries/reports-data.ts` da faqat shablon ma'lumotidan
 * (so'rovlar orqali) tuziladi; generatorlar bazani bilmaydi.
 */

/** Yuklab olinadigan hisobot davri. Ma'lumot oylik yuklanadi - faqat oy va yil. */
export type ReportPeriod = "monthly" | "yearly";

export const REPORT_PERIODS: readonly ReportPeriod[] = ["monthly", "yearly"];

export function isReportPeriod(value: string): value is ReportPeriod {
  return (REPORT_PERIODS as readonly string[]).includes(value);
}

export type ReportFormat = "xlsx" | "pdf";

export const REPORT_FORMATS: readonly ReportFormat[] = ["xlsx", "pdf"];

export function isReportFormat(value: string): value is ReportFormat {
  return (REPORT_FORMATS as readonly string[]).includes(value);
}

export const REPORT_PERIOD_LABEL: Record<ReportPeriod, string> = {
  monthly: "Oylik",
  yearly: "Yillik",
};

/** Qamrov turi (`Scope["kind"]` bilan bir xil). */
export type ReportScopeKind = "district" | "substation" | "feeder" | "transformer";

/**
 * Oylik hisobotdagi oqim jadvali: qamrovning shu oydagi bola obyektlari.
 * Hisobot fayli va `/reports` sahifasidagi tarkib bir xil nomni ko'rsatadi.
 */
export const MONTHLY_SERIES_TITLE: Record<ReportScopeKind, string> = {
  district: "Podstansiyalar kesimi",
  substation: "Fiderlar kesimi",
  feeder: "Transformatorlar kesimi",
  transformer: "Transformator ko’rsatkichlari",
};

/** Yillik hisobotdagi oqim jadvali. */
export const YEARLY_SERIES_TITLE = "Oylik dinamika";

/** Izoh rangi: `bad` qizil, `good` yashil, `neutral` kulrang. */
export type ReportTone = "bad" | "good" | "neutral";

export interface ReportSummaryItem {
  label: string;
  /** Tayyor matn: "1,89 mln kWh", "2,13%"; yuklanmagan bo'lsa - "—". */
  value: string;
  /** O'tgan oyga nisbatan o'zgarish yoki "... yuklanmagan". */
  hint: string;
  tone: ReportTone;
}

/** Oqim jadvalining bitta qatori (kWh). */
export interface ReportSeriesRow {
  /** Obyekt nomi (oylik) yoki "Sentabr 2026" (yillik). */
  label: string;
  totalKwh: number;
  usefulKwh: number;
  /** Manfiy bo'lishi mumkin. */
  lossKwh: number;
  /** Umumiy oqim ≤ 0 bo'lsa - null. */
  lossPercent: number | null;
}

export interface ReportSeries {
  /** "Podstansiyalar kesimi" yoki "Oylik dinamika". */
  title: string;
  /** Birinchi ustun nomi: "Podstansiya", "Fider", "Transformator", "Oy". */
  column: string;
  /** Tegishli shablon shu oyga yuklanmagan bo'lsa - null. */
  rows: ReportSeriesRow[] | null;
  /** Qatorlar yig'indisi (bitta qatorli jadvalda - null). */
  totals: (ReportSeriesRow & { label: string }) | null;
  /** `rows` bo'sh bo'lganda ko'rsatiladigan matn. */
  emptyText: string;
}

export interface ReportTransformerRow {
  name: string;
  substation: string;
  feeder: string;
  totalKwh: number;
  usefulKwh: number;
  lossKwh: number;
  lossPercent: number | null;
  /** Aloqadagi + aloqadan chiqqan abonentlar. */
  subscribers: number;
}

export interface ReportViolationRow {
  /** "Yuridik", "Jismoniy", "Aybisiz" yoki "Jami". */
  label: string;
  count: number;
  damageUzs: number;
  damageKwh: number;
}

export interface ReportAppealRow {
  /** "Ijobiy hal etilgan" ... yoki "Jami". */
  label: string;
  count: number;
}

/** Bitta qamrov (tuman / podstansiya / fider / TP) bo'yicha hisobot. */
export interface ScopeReport {
  period: ReportPeriod;
  scopeKind: ReportScopeKind;
  /** "Oylik hisobot" / "Yillik hisobot". */
  title: string;
  /** "Baliqchi tumani", "Bo’ston podstansiyasi", "Markaz fideri", "07 transformatori". */
  scopeName: string;
  /** Ota obyektlar: "Baliqchi podstansiyasi · Markaz fideri"; tuman uchun izoh. */
  scopeContext: string;
  /** "2026-09" - tanlangan hisobot oyi. */
  monthKey: string;
  /** Tanlangan oy: "Sentabr 2026". */
  monthLabel: string;
  /** Hisobot qamragan oylar: "Sentabr 2026" yoki "Oktabr 2025 – Sentabr 2026". */
  periodLabel: string;
  /** Davrning hisobot sanasi: "13-sentabr, 2026". */
  reportDate: string;
  /** Qamrov obyektining shu oydagi "Ma'sul xodim"i; tuman yoki bo'sh bo'lsa - null. */
  responsible: string | null;
  /** Toshkent vaqti: "14-sentabr, 2026 10:05". */
  generatedAt: string;
  /** Aynan 6 ta karta. */
  summary: ReportSummaryItem[];
  series: ReportSeries;
  /** Transformatorlar shu oyga yuklanmagan bo'lsa - null. */
  transformers: ReportTransformerRow[] | null;
  /** Qoidabuzarliklar yuklanmagan bo'lsa - null. `total` - "Jami" qatori. */
  violations: { rows: ReportViolationRow[]; total: ReportViolationRow } | null;
  /** Murojaatlar yuklanmagan bo'lsa - null. */
  appeals: { rows: ReportAppealRow[]; total: ReportAppealRow } | null;
  /** Fayl nomlari (kengaytmasiz): ASCII zaxira va asl ko'rinish. */
  fileName: { ascii: string; unicode: string };
}

/** Bo'sh bo'lim matni. */
export const NOT_UPLOADED = "Ma’lumot yuklanmagan";
