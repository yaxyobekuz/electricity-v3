import { ArrowDown, ArrowUp, Factory, Workflow } from "lucide-react";

import { KpiCard, type KpiCardProps } from "@/components/cards/KpiCard";
import { DAILY_CALCULATED, DAILY_CONSUMED } from "@/components/cards/KpiRow";
import { cn } from "@/lib/ui/cn";

/**
 * Maketdagi ikkita KPI kartasi (Figma `4179:2`, "KPI cards 2", 321.78x402).
 *
 * Ular 1-qatordagi oltita KPI kartasi bilan **bir xil komponent**: ichki
 * qator balandliklari ham aynan mos (32 + 41 + 26 + 26 + 39). Farqi faqat
 * kenglikda - bu yerda span-4, yuqorida span-3.
 *
 * Ustun balandliklari maketda `Hisoblangan` va `Iste'mol` kartalaridagi bilan
 * bir xil massivlar, shuning uchun `KpiRow` dan qayta ishlatiladi.
 *
 * Kartalar orasidagi oraliq 10px (206 - 196), sahifaning odatdagi 8px
 * oralig'idan farq qiladi - shuning uchun `gap-2.5`.
 */
const CARDS: readonly (Omit<KpiCardProps, "className"> & { id: string })[] = [
  {
    id: "substations",
    title: "Podstansiyalar",
    value: "220,1",
    unit: "ming kWh",
    icon: Factory,
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
    id: "feeders",
    title: "Fiderlar",
    value: "190,5",
    unit: "ming kWh",
    icon: Workflow,
    deltaIcon: ArrowDown,
    deltaText: "10,5 ming kWh ga kam",
    deltaTone: "good",
    previous: "O’tgan oy: 180,0 kWh",
    bars: DAILY_CONSUMED,
    barsLabel: "30 kun",
    tint: "bg-tint-green",
    accent: "bg-accent-green",
  },
];

export function HomeKpiStack({ className }: { className?: string }) {
  return (
    <div className={cn("grid min-h-0 grid-rows-2 gap-2.5", className)}>
      {CARDS.map(({ id, ...card }) => (
        <KpiCard key={id} {...card} />
      ))}
    </div>
  );
}
