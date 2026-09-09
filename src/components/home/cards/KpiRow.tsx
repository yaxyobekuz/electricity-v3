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
 * Sparkline qiymatlari 0..1 ulushda (0 - eng past, 1 - eng baland nuqta).
 * Har bir ko'rsatkich o'z ohangida: iste'mol va abonentlar o'sadi,
 * yo'qotishlar tushadi, transformatorlar deyarli tekis, ogohlantirishlar esa
 * oxirida keskin sakraydi. Bir xil massivlar ishlatilmaydi - aks holda
 * sakkiz karta bir xil grafik bilan ko'rinardi.
 */

/** Jami iste'mol - notekis, ammo aniq o'suvchi trend (15 nuqta). */
const TOTAL_CONSUMPTION = [
  0.32, 0.28, 0.41, 0.38, 0.5, 0.46, 0.58, 0.62, 0.55, 0.68, 0.72, 0.66, 0.81,
  0.88, 0.94,
] as const;

/** Foydali energiya - iste'molga hamohang, biroq silliqroq (15 nuqta). */
const USEFUL_ENERGY = [
  0.4, 0.45, 0.42, 0.52, 0.56, 0.51, 0.6, 0.64, 0.61, 0.7, 0.73, 0.69, 0.78,
  0.84, 0.9,
] as const;

/** Texnik yo'qotishlar - sekin, pog'onali kamayish (16 nuqta). */
const TECHNICAL_LOSS = [
  0.86, 0.9, 0.82, 0.78, 0.84, 0.74, 0.7, 0.75, 0.66, 0.6, 0.64, 0.55, 0.5,
  0.53, 0.44, 0.38,
] as const;

/** Tijorat yo'qotishlar - kuchli tebranish fonida tushish (14 nuqta). */
const COMMERCIAL_LOSS = [
  0.78, 0.62, 0.85, 0.58, 0.7, 0.5, 0.66, 0.44, 0.6, 0.38, 0.52, 0.3, 0.46,
  0.26,
] as const;

/** Umumiy yo'qotish foizi - barqaror pasayish (15 nuqta). */
const TOTAL_LOSS = [
  0.92, 0.88, 0.9, 0.81, 0.76, 0.79, 0.7, 0.64, 0.67, 0.58, 0.52, 0.55, 0.45,
  0.4, 0.34,
] as const;

/** Faol iste'molchilar - pog'onali o'sish, orada turg'unlik (16 nuqta). */
const ACTIVE_CONSUMERS = [
  0.22, 0.24, 0.3, 0.31, 0.3, 0.38, 0.44, 0.45, 0.44, 0.53, 0.58, 0.6, 0.59,
  0.68, 0.76, 0.82,
] as const;

/** Transformatorlar - soni o'zgarmaydi, chiziq deyarli tekis (14 nuqta). */
const TRANSFORMERS = [
  0.5, 0.52, 0.5, 0.49, 0.51, 0.5, 0.52, 0.5, 0.48, 0.5, 0.51, 0.5, 0.49, 0.5,
] as const;

/** Kritik ogohlantirishlar - past fon, oxirida keskin ko'tarilish (15 nuqta). */
const CRITICAL_ALERTS = [
  0.12, 0.1, 0.18, 0.14, 0.1, 0.22, 0.16, 0.12, 0.3, 0.2, 0.16, 0.42, 0.55,
  0.48, 0.86,
] as const;

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
