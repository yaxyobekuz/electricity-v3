import { finite, fixedScale, moneyUnit, plainNumber } from "@/components/cards/chart-scale";
import { RingStatsCard, type StatRing } from "@/components/cards/RingStatsCard";
import { money } from "@/lib/format";

/** Halqa rangi - maketdan (tashqidan ichkariga). */
const COLORS = { total: "#3cc3df", household: "#ff928a", legal: "#8979ff" } as const;

/**
 * "Qarzdorlik" (Figma `4055:178`, 322x336) - obyekt sahifalarining 3-qatori.
 * Karta tuzilmasi va diagramma geometriyasi `RingStatsCard` da.
 *
 * Summalar Abonentlar shablonidagi "Qarzdorlik" ustunidan (so'm): umumiy va
 * "Abonent turi" bo'yicha. Shkala eng katta summadan yaxlitlanadi (5
 * bo'linma), birligi (ming / mln / mlrd so'm) oy nomi ostida.
 */
export function DebtCard({
  month,
  total,
  household,
  legal,
  uploaded,
  className,
}: {
  /** Diagrammadagi oy nomi: "Sentabr". */
  month: string;
  total: number;
  household: number;
  legal: number;
  /** Shu oyga Abonentlar fayli yuklanganmi. */
  uploaded: boolean;
  className?: string;
}) {
  const values = { total: finite(total), household: finite(household), legal: finite(legal) };
  const unit = moneyUnit(Math.max(values.total, values.household, values.legal));
  const peak = Math.max(0, values.total, values.household, values.legal) / unit.divisor;
  const scale = fixedScale(peak, 5);

  const rings: StatRing[] = [
    { id: "total", label: "Umumiy", value: values.total },
    { id: "household", label: "Aholi", value: values.household },
    { id: "legal", label: "Yuridik", value: values.legal },
  ].map((ring) => ({
    id: ring.id,
    label: ring.label,
    amount: money(ring.value),
    arc: ring.value / unit.divisor,
    color: COLORS[ring.id as keyof typeof COLORS],
  }));

  return (
    <RingStatsCard
      className={className}
      title="Qarzdorlik"
      rings={rings}
      max={scale.max}
      tickLabels={Array.from({ length: 6 }, (_, index) => plainNumber(scale.step * index))}
      month={month}
      scaleUnit={unit.unit}
      columns={["Turi", "Summa"]}
      summary={null}
      empty={uploaded ? null : "Abonentlar ro’yxati yuklanmagan"}
    />
  );
}
