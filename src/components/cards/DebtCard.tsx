import { RingStatsCard, type StatRing } from "@/components/cards/RingStatsCard";

/**
 * Legenda va jadval tartibi: tashqi halqadan ichkariga.
 * Summalardagi apostrof - maketdagi egri U+2019 (&rsquo;).
 *
 * Yoy uzunligi 0-375 shkalada. Maketda yoylar summaga proporsional emas -
 * qiymatlar Figma'dagi burchaklardan (185 / 225 / 250 gradus) hisoblangan.
 */
const RINGS: readonly StatRing[] = [
  { id: "umumiy", label: "Umumiy", amount: "361,7 mln so’m", arc: 348, color: "#3cc3df" },
  { id: "aholi", label: "Aholi", amount: "261,6 mln so’m", arc: 312, color: "#ff928a" },
  { id: "yuridik", label: "Yuridik", amount: "100,1 mln so’m", arc: 256, color: "#8979ff" },
];

/** Maketda 0-375 oralig'i 6 ta bo'linmaga ajratilgan (qadam 75). */
const TICK_LABELS = ["0", "75", "150", "225", "300", "375"] as const;

/**
 * "Qarzdorlik" (Figma `4055:178`, 322x336) - fider sahifasining 3-qatori.
 * Karta tuzilmasi va diagramma geometriyasi `RingStatsCard` da.
 */
export function DebtCard({ className }: { className?: string }) {
  return (
    <RingStatsCard
      className={className}
      title="Qarzdorlik"
      rings={RINGS}
      max={375}
      tickLabels={TICK_LABELS}
      columns={["Turi", "Summa"]}
    />
  );
}
