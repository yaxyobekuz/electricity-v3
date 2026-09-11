import {
  ArrowDown,
  ArrowUp,
  CircuitBoard,
  HandCoins,
  PlugZap,
  SquareExclamationPoint,
  UserMinus,
  Users,
  Zap,
  ZapOff,
} from "lucide-react";

import { KpiCard, type KpiCardProps } from "@/components/feeder/KpiCard";

/**
 * Ustun balandliklari maketdan aynan ko'chirilgan (39px trek = 1).
 * Ritm "silliq" emas: to'la balandlikdagi ustunlar qisqalari bilan aralash.
 */
const DAILY_CALCULATED = [
  1, 1, 0.744, 1, 0.513, 0.821, 0.821, 1, 0.231, 1, 0.564, 0.615, 1, 1, 1, 1, 1,
  0.615, 0.744, 0.821, 1, 0.359, 0.667, 1, 0.821, 0.744, 0.282, 0.667, 1, 1,
] as const;

const DAILY_CONSUMED = [
  1, 1, 0.744, 1, 0.513, 0.821, 0.821, 1, 0.231, 1, 0.564, 0.615, 0.744, 0.667,
  1, 0.744, 0.744, 0.615, 0.744, 0.821, 1, 0.359, 0.667, 1, 0.821, 0.744, 0.282,
  0.667, 0.282, 1,
] as const;

const DAILY_LOSS = [
  1, 1, 0.744, 1, 0.513, 0.821, 0.821, 1, 0.667, 1, 0.564, 0.615, 1, 1, 1, 1, 1,
  0.615, 0.744, 0.821, 1, 0.744, 0.667, 1, 0.821, 0.744, 0.282, 0.667, 1, 1,
] as const;

const MONTHLY_SUBSCRIBERS = [
  1, 1, 1, 0.744, 0.667, 1, 0.821, 0.744, 0.282, 0.667, 1, 1,
] as const;

const MONTHLY_TRANSFORMERS = [
  0.282, 0.282, 0.41, 0.744, 0.667, 0.41, 0.821, 0.744, 1, 0.667, 0.41, 1,
] as const;

const MONTHLY_DEBT = [
  0.282, 0.282, 0.41, 0.41, 0.179, 0.41, 1, 0.744, 0.41, 0.667, 0.41, 0.282,
] as const;

const KPIS: readonly (KpiCardProps & { id: string })[] = [
  {
    id: "calculated",
    title: "Hisoblangan",
    value: "220,1",
    unit: "ming kWh",
    icon: Zap,
    deltaIcon: ArrowUp,
    deltaText: "28,2 ming kWh ga ko’p",
    deltaTone: "bad",
    previous: "O’tgan oy: 198,1 kWh",
    bars: DAILY_CALCULATED,
    barsLabel: "30 kun",
    tint: "bg-tint-blue",
    accent: "bg-accent-blue",
  },
  {
    id: "consumed",
    title: "Iste’mol",
    value: "190,5",
    unit: "ming kWh",
    icon: PlugZap,
    deltaIcon: ArrowDown,
    deltaText: "10,5 ming kWh ga kam",
    deltaTone: "good",
    previous: "O’tgan oy: 180,0 kWh",
    bars: DAILY_CONSUMED,
    barsLabel: "30 kun",
    tint: "bg-tint-green",
    accent: "bg-accent-green",
  },
  {
    id: "loss",
    title: "Yo’qotish",
    value: "30,4",
    unit: "ming kWh",
    icon: ZapOff,
    deltaIcon: ArrowDown,
    deltaText: "5,5 ming kWh ga kam",
    deltaTone: "good",
    previous: "O’tgan oy: 35,9 kWh",
    bars: DAILY_LOSS,
    barsLabel: "30 kun",
    tint: "bg-tint-red",
    accent: "bg-accent-red",
  },
  {
    id: "subscribers",
    title: "Abonentlar",
    value: "2,253",
    unit: "ta umumiy",
    icon: Users,
    deltaIcon: UserMinus,
    deltaText: "25 ta aloqada emas",
    deltaTone: "bad",
    previous: "O’tgan oy: 2,227 ta",
    bars: MONTHLY_SUBSCRIBERS,
    barsLabel: "12 oy",
    tint: "bg-tint-purple",
    accent: "bg-accent-purple",
  },
  {
    id: "transformers",
    title: "Transformatorlar",
    value: "50",
    unit: "ta faol",
    icon: CircuitBoard,
    deltaIcon: SquareExclamationPoint,
    deltaText: "1 ta nofaol",
    deltaTone: "bad",
    previous: "O’tgan oy: 51 ta",
    bars: MONTHLY_TRANSFORMERS,
    barsLabel: "12 oy",
    tint: "bg-tint-indigo",
    accent: "bg-accent-indigo",
  },
  {
    id: "debt",
    title: "Qarzdorlik",
    value: "42,1",
    unit: "mln so’m",
    icon: HandCoins,
    deltaIcon: ArrowDown,
    deltaText: "14,7 mln so’m ga kam",
    deltaTone: "good",
    previous: "O’tgan oy: 56,8 mln so’m",
    bars: MONTHLY_DEBT,
    barsLabel: "12 oy",
    tint: "bg-tint-brown",
    accent: "bg-accent-brown",
  },
];

/**
 * Fider sahifasining 1-qatori: 6 ta KPI kartasi.
 * Fragment qaytaradi - kartalar 18 ustunli gridning bevosita farzandlari.
 */
export function KpiRow() {
  return (
    <>
      {KPIS.map(({ id, ...kpi }) => (
        <KpiCard key={id} className="col-span-3" {...kpi} />
      ))}
    </>
  );
}
