import type {
  FeederReport,
  ReportPeriod,
  ReportSeriesRow,
  ReportSummaryItem,
} from "./types";

/*
 * Maket bosqichida hisobot mazmuni namunaviy. Ma'lumot **determinlashgan**
 * (tasodifiy emas): bir xil davr har doim bir xil faylni beradi, shuning
 * uchun natijani solishtirib tekshirish mumkin.
 */

const MONTHS = [
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
];

/** 0..1 oralig'idagi takrorlanuvchi "shovqin" - seed bo'yicha barqaror. */
function noise(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function formatUzDate(date: Date): string {
  return `${date.getDate()}-${MONTHS[date.getMonth()].toLowerCase()}, ${date.getFullYear()}`;
}

function formatUzDateTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${formatUzDate(date)} ${hh}:${mm}`;
}

/** "1 234,5" - mingliklar probel bilan, kasr - vergul. */
export function formatNumber(value: number, digits = 1): string {
  const fixed = value.toFixed(digits);
  const [whole, fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fraction ? `${grouped},${fraction}` : grouped;
}

const PERIOD_META: Record<
  ReportPeriod,
  { title: string; seriesColumn: string; points: number; scale: number }
> = {
  daily: { title: "Kunlik hisobot", seriesColumn: "Soat", points: 24, scale: 1 },
  weekly: { title: "Haftalik hisobot", seriesColumn: "Sana", points: 7, scale: 24 },
  monthly: { title: "Oylik hisobot", seriesColumn: "Sana", points: 30, scale: 24 },
  yearly: { title: "Yillik hisobot", seriesColumn: "Oy", points: 12, scale: 720 },
};

function seriesLabel(period: ReportPeriod, index: number, today: Date): string {
  if (period === "daily") return `${String(index).padStart(2, "0")}:00`;
  if (period === "yearly") return MONTHS[index];

  const day = new Date(today);
  const back = PERIOD_META[period].points - 1 - index;
  day.setDate(day.getDate() - back);
  return `${day.getDate()}-${MONTHS[day.getMonth()].toLowerCase()}`;
}

function buildSeries(period: ReportPeriod, today: Date): ReportSeriesRow[] {
  const { points, scale } = PERIOD_META[period];

  return Array.from({ length: points }, (_, index) => {
    // Sutkalik egri chiziq: kechqurun pik, tunda pasayish.
    const hourOfDay = period === "daily" ? index : 12;
    const daylight = 0.62 + 0.38 * Math.sin(((hourOfDay - 6) / 24) * Math.PI * 2);
    const billed = (5.6 + noise(index + 1) * 2.4) * daylight * scale;
    const lossRate = 0.11 + noise(index + 41) * 0.06;
    const loss = billed * lossRate;

    return {
      label: seriesLabel(period, index, today),
      billed: Number(billed.toFixed(1)),
      consumed: Number((billed - loss).toFixed(1)),
      loss: Number(loss.toFixed(1)),
    };
  });
}

function buildSummary(series: ReportSeriesRow[]): ReportSummaryItem[] {
  const billed = series.reduce((sum, row) => sum + row.billed, 0);
  const consumed = series.reduce((sum, row) => sum + row.consumed, 0);
  const loss = series.reduce((sum, row) => sum + row.loss, 0);
  const lossShare = (loss / billed) * 100;

  return [
    {
      label: "Hisoblangan",
      value: `${formatNumber(billed)} ming kWh`,
      hint: "O’tgan davrga nisbatan +4,8%",
      positive: false,
    },
    {
      label: "Iste’mol",
      value: `${formatNumber(consumed)} ming kWh`,
      hint: "O’tgan davrga nisbatan +3,1%",
      positive: true,
    },
    {
      label: "Yo’qotish",
      value: `${formatNumber(loss)} ming kWh`,
      hint: "O’tgan davrga nisbatan -1,6%",
      positive: true,
    },
    {
      label: "Yo’qotish ulushi",
      value: `${formatNumber(lossShare, 2)}%`,
      hint: "Me’yor: 12,00%",
      positive: lossShare <= 12,
    },
    {
      label: "Abonentlar",
      value: "2 253 ta",
      hint: "25 tasi aloqada emas",
      positive: false,
    },
    {
      label: "Qarzdorlik",
      value: "42,1 mln so’m",
      hint: "O’tgan davrga nisbatan -14,7 mln so’m",
      positive: true,
    },
  ];
}

const TRANSFORMERS: FeederReport["transformers"] = [
  { name: "TP-001", status: "Faol", billed: 51.5, consumed: 41.4, loss: 10.1 },
  { name: "TP-002", status: "Faol", billed: 51.0, consumed: 41.0, loss: 10.0 },
  { name: "TP-003", status: "Nofaol", billed: 40.6, consumed: 30.0, loss: 10.6 },
  { name: "TP-004", status: "Faol", billed: 31.3, consumed: 21.3, loss: 10.0 },
  { name: "TP-005", status: "Ta’mirda", billed: 15.1, consumed: 8.1, loss: 7.0 },
  { name: "TP-A303", status: "Faol", billed: 62.4, consumed: 52.9, loss: 9.5 },
  { name: "TP-B86", status: "Faol", billed: 44.8, consumed: 37.2, loss: 7.6 },
  { name: "TP-T34", status: "Faol", billed: 28.9, consumed: 24.1, loss: 4.8 },
];

const VIOLATIONS: FeederReport["violations"] = [
  { kind: "Ma’muriy holat", count: 4, amount: "18,6 mln so’m" },
  { kind: "Jinoiy holat", count: 1, amount: "31,2 mln so’m" },
  { kind: "Aybsiz deb topilgan", count: 3, amount: "0,0 mln so’m" },
];

const WORKS: FeederReport["works"] = [
  {
    transformer: "TP-01",
    work: "Xatlov o’tkazish",
    date: "21-avgust, 2026",
    status: "Bajarilgan",
  },
  {
    transformer: "TP-004",
    work: "Toka transformatorni ta’mirlash",
    date: "1-avgust, 2026",
    status: "Bajarilgan",
  },
  {
    transformer: "TP-005",
    work: "Hisoblagich o’rnatish",
    date: "18-avgust, 2026",
    status: "Bajarilgan",
  },
  {
    transformer: "TP-A303",
    work: "Transformatorni tekshirish",
    date: "7-sentabr, 2026",
    status: "Yangi",
  },
  {
    transformer: "TP-33",
    work: "Toka transformatorni ta’mirlash",
    date: "23-avgust, 2026",
    status: "Bajarilmoqda",
  },
];

function buildRange(period: ReportPeriod, today: Date): string {
  if (period === "daily") return formatUzDate(today);
  if (period === "yearly") return `${today.getFullYear()}-yil`;

  const from = new Date(today);
  from.setDate(from.getDate() - (PERIOD_META[period].points - 1));
  return `${from.getDate()}-${MONTHS[from.getMonth()].toLowerCase()} – ${formatUzDate(today)}`;
}

/** Tanlangan davr uchun to'liq namunaviy hisobotni yig'adi. */
export function buildDemoReport(period: ReportPeriod, now: Date): FeederReport {
  const meta = PERIOD_META[period];
  const series = buildSeries(period, now);

  return {
    period,
    title: meta.title,
    range: buildRange(period, now),
    feeder: "Xaqulobod fideri",
    substation: "A404-SKJ podstansiyasi",
    responsible: "Karimov Egamberdi",
    generatedAt: formatUzDateTime(now),
    summary: buildSummary(series),
    seriesColumn: meta.seriesColumn,
    series,
    transformers: TRANSFORMERS,
    violations: VIOLATIONS,
    works: WORKS,
  };
}

/** Yuklanadigan fayl nomi: "xaqulobod-fideri-oylik-hisobot.xlsx". */
export function reportFileName(period: ReportPeriod, extension: string): string {
  const slug: Record<ReportPeriod, string> = {
    daily: "kunlik",
    weekly: "haftalik",
    monthly: "oylik",
    yearly: "yillik",
  };
  return `xaqulobod-fideri-${slug[period]}-hisobot.${extension}`;
}
