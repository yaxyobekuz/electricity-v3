/** Yuklab olinadigan hisobot davri. */
export type ReportPeriod = "daily" | "weekly" | "monthly" | "yearly";

export const REPORT_PERIODS: ReportPeriod[] = ["daily", "weekly", "monthly", "yearly"];

export function isReportPeriod(value: string): value is ReportPeriod {
  return (REPORT_PERIODS as string[]).includes(value);
}

export type ReportFormat = "xlsx" | "pdf";

/** Dinamika jadvalining bitta qatori (barcha qiymatlar ming kWh da). */
export interface ReportSeriesRow {
  /** "03:00", "5-sentabr" yoki "Mart" - davrga qarab. */
  label: string;
  billed: number;
  consumed: number;
  loss: number;
}

export interface ReportSummaryItem {
  label: string;
  value: string;
  /** Qiymat ostidagi kichik izoh (o'tgan davrga nisbatan o'zgarish). */
  hint: string;
  /** `true` - ijobiy o'zgarish (yashil), `false` - salbiy (qizil). */
  positive: boolean;
}

export interface ReportTransformerRow {
  name: string;
  status: "Faol" | "Nofaol" | "Ta’mirda";
  billed: number;
  consumed: number;
  loss: number;
}

export interface ReportViolationRow {
  kind: string;
  count: number;
  /** "12,4 mln so'm" ko'rinishida. */
  amount: string;
}

export interface ReportWorkRow {
  transformer: string;
  work: string;
  date: string;
  status: string;
}

/** Bitta fider bo'yicha to'liq hisobot - PDF va Excel uchun yagona manba. */
export interface FeederReport {
  period: ReportPeriod;
  /** "Kunlik hisobot". */
  title: string;
  /** "9-sentabr, 2026" yoki "3-sentabr - 9-sentabr, 2026". */
  range: string;
  feeder: string;
  substation: string;
  responsible: string;
  generatedAt: string;
  summary: ReportSummaryItem[];
  /** Dinamika jadvalining birinchi ustuni nomi ("Soat", "Sana", "Oy"). */
  seriesColumn: string;
  series: ReportSeriesRow[];
  transformers: ReportTransformerRow[];
  violations: ReportViolationRow[];
  works: ReportWorkRow[];
}
