import { KpiCard, type KpiCardProps } from "@/components/cards/KpiCard";

export type KpiItem = KpiCardProps & { id: string };

/**
 * Fider / transformator sahifasining 1-qatori: KPI kartalari (maketda 6 ta).
 * Fragment qaytaradi - kartalar 18 ustunli gridning bevosita farzandlari.
 *
 * Ko'rsatkichlar sahifadan keladi (so'rov -> `format.ts` matni); bu yerda
 * standart qiymat yo'q.
 */
export function KpiRow({ kpis }: { kpis: readonly KpiItem[] }) {
  return (
    <>
      {kpis.map(({ id, ...kpi }) => (
        <KpiCard key={id} className="col-span-3" {...kpi} />
      ))}
    </>
  );
}
