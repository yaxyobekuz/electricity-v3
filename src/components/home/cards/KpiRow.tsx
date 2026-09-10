import {
  ArrowDown,
  ArrowUp,
  CircuitBoard,
  Minus,
  Percent,
  PlugZap,
  TriangleAlert,
  Unplug,
  Users,
  Zap,
  ZapOff,
} from "lucide-react";

import { HomeKpiCard, type HomeKpiCardProps } from "@/components/home/HomeKpiCard";

/**
 * Sparkline qatorlari - HAQIQIY o'lchov birligida (kWh, foiz, dona), ulush
 * emas: shkalani `KpiSparkline` ichidagi nivo grafigi o'zi hisoblaydi va har
 * bir qator o'z diapazonida chiziladi. Oxirgi nuqta doim kartada ko'rsatilgan
 * qiymatga teng.
 *
 * Har bir ko'rsatkich o'z ohangida: iste'mol va abonentlar o'sadi,
 * yo'qotishlar tushadi, transformatorlar deyarli tekis, ogohlantirishlar esa
 * oxirida keskin sakraydi.
 */

/** Jami iste'mol, kunlik kWh - notekis, ammo aniq o'suvchi trend (15 kun). */
const TOTAL_CONSUMPTION = [
  912_000, 904_000, 928_000, 921_000, 947_000, 940_000, 966_000, 973_000,
  961_000, 990_000, 999_000, 986_000, 1_017_000, 1_035_000, 1_048_000,
] as const;

/** Foydali energiya, kunlik kWh - iste'molga hamohang, biroq silliqroq. */
const USEFUL_ENERGY = [
  631_000, 638_000, 634_000, 648_000, 654_000, 647_000, 660_000, 666_000,
  662_000, 675_000, 681_000, 674_000, 697_000, 710_000, 722_500,
] as const;

/** Texnik yo'qotishlar, kunlik kWh - sekin, pog'onali kamayish (16 kun). */
const TECHNICAL_LOSS = [
  92_400, 94_000, 90_900, 89_300, 91_600, 87_700, 86_100, 88_000, 84_500,
  82_200, 83_700, 80_200, 78_300, 79_400, 76_800, 75_200,
] as const;

/** Tijorat yo'qotishlar, kunlik kWh - kuchli tebranish fonida tushish. */
const COMMERCIAL_LOSS = [
  64_900, 60_100, 67_000, 59_200, 62_800, 57_300, 61_100, 55_400, 59_300,
  53_600, 57_200, 51_800, 55_600, 50_300,
] as const;

/** Umumiy yo'qotish, foiz - barqaror pasayish (15 kun). */
const TOTAL_LOSS = [
  14.9, 14.7, 14.8, 14.4, 14.1, 14.2, 13.8, 13.5, 13.6, 13.2, 12.9, 13.0,
  12.5, 12.3, 12.0,
] as const;

/** Faol iste'molchilar, dona - pog'onali o'sish, orada turg'unlik (16 kun). */
const ACTIVE_CONSUMERS = [
  66_180, 66_290, 66_620, 66_680, 66_620, 67_060, 67_390, 67_450, 67_390,
  67_890, 68_160, 68_270, 68_210, 68_710, 69_150, 69_420,
] as const;

/**
 * Soz transformatorlar, dona - son deyarli o'zgarmaydi. `KpiSparkline`
 * bunday qatorni ataylab keng shkalada chizadi (o'rtacha qiymatning 6% i),
 * aks holda 50-52 oralig’idagi tebranish tishli arraga aylanib ketardi.
 */
const TRANSFORMERS = [
  51, 52, 51, 50, 51, 51, 52, 51, 50, 51, 51, 51, 50, 51,
] as const;

/** Kritik ogohlantirishlar, dona - past fon, oxirida ko'tarilish (15 kun). */
const CRITICAL_ALERTS = [0, 0, 1, 1, 0, 1, 1, 0, 2, 1, 1, 2, 2, 1, 3] as const;

/**
 * `className` ataylab chiqarib tashlangan: grid ustuni (`col-span-3`) faqat shu
 * fayldagi `KpiRow` tomonidan beriladi, ma'lumot jadvalidan emas.
 */
const KPIS: readonly (Omit<HomeKpiCardProps, "className"> & { id: string })[] = [
  {
    id: "total-consumption",
    title: "Jami iste\u2019mol",
    value: "1 048 000",
    unit: "kWh",
    icon: Zap,
    accent: "bg-accent-blue",
    stroke: "#3b82f6",
    deltaIcon: ArrowUp,
    deltaText: "8.3%",
    deltaTone: "good",
    note: "Bugungi (soat 13:00)",
    points: TOTAL_CONSUMPTION,
  },
  {
    id: "useful-energy",
    title: "Foydali energiya",
    value: "722 500",
    unit: "kWh",
    icon: PlugZap,
    accent: "bg-accent-green",
    stroke: "#22c55e",
    deltaIcon: ArrowUp,
    deltaText: "6.1%",
    deltaTone: "good",
    note: "TP bo\u2019yicha: 722.5 ming kWh",
    points: USEFUL_ENERGY,
  },
  {
    id: "technical-loss",
    title: "Texnik yo\u2019qotishlar",
    value: "75 200",
    unit: "kWh",
    icon: ZapOff,
    accent: "bg-accent-amber",
    stroke: "#f59e0b",
    deltaIcon: ArrowDown,
    deltaText: "1.3%",
    deltaTone: "good",
    note: "TP bo\u2019yicha: 922.8 ming kWh",
    points: TECHNICAL_LOSS,
  },
  {
    id: "commercial-loss",
    title: "Tijorat yo\u2019qotishlar",
    value: "50 300",
    unit: "kWh",
    icon: Unplug,
    accent: "bg-accent-red",
    stroke: "#ff383c",
    deltaIcon: ArrowDown,
    deltaText: "0.8%",
    deltaTone: "good",
    note: "Aholi: 3 496 ta | Yuridik: 69 ta",
    points: COMMERCIAL_LOSS,
  },
  {
    id: "total-loss",
    title: "Umumiy yo\u2019qotish",
    value: "12.0%",
    unit: "(me\u2019yor \u2264 15%)",
    icon: Percent,
    accent: "bg-accent-purple",
    stroke: "#cb30e0",
    deltaIcon: ArrowDown,
    deltaText: "2.1%",
    deltaTone: "good",
    note: "Me\u2019yordan 3.0% past",
    points: TOTAL_LOSS,
  },
  {
    id: "active-consumers",
    title: "Faol iste\u2019molchilar",
    value: "69 420",
    unit: "ta",
    icon: Users,
    accent: "bg-accent-teal",
    stroke: "#14b8a6",
    deltaIcon: ArrowUp,
    deltaText: "2.4%",
    deltaTone: "good",
    note: "Jami: 71 940 ta",
    points: ACTIVE_CONSUMERS,
  },
  {
    id: "transformers",
    title: "Transformatorlar",
    value: "51",
    unit: "ta",
    icon: CircuitBoard,
    accent: "bg-accent-indigo",
    stroke: "#6155f5",
    deltaIcon: Minus,
    deltaText: "0.0%",
    deltaTone: "flat",
    note: "Nosoz: 0 ta | Soz: 51 ta",
    points: TRANSFORMERS,
  },
  {
    id: "critical-alerts",
    title: "Kritik ogohlantirishlar",
    value: "3",
    unit: "ta",
    icon: TriangleAlert,
    accent: "bg-accent-red",
    stroke: "#ff383c",
    deltaIcon: ArrowUp,
    deltaText: "2 ta",
    deltaTone: "bad",
    note: "So\u2019nggi 24 soatda",
    points: CRITICAL_ALERTS,
  },
];

/**
 * "Bosh sahifa" 1-qatori: 8 ta KPI kartasi (8 x span-3 = 24 ustun).
 * Fragment qaytaradi - kartalar `HomeView` gridining bevosita farzandlari
 * bo'lishi kerak, aks holda `col-span-3` ishlamaydi.
 */
export function KpiRow() {
  return (
    <>
      {KPIS.map(({ id, ...kpi }) => (
        <HomeKpiCard key={id} {...kpi} className="col-span-3" />
      ))}
    </>
  );
}
