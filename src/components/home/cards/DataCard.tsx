import { Card } from "@/components/ui/Card";

interface DataRow {
  id: string;
  label: string;
  /** Maketdagi formatda: "1,020 mln kWh". */
  value: string;
  color: string;
}

/**
 * Qiymatlar "Iste'mol dinamikasi" kartasidagi jamlanmalar bilan bir xil -
 * maketda ham shu karta "1,020 mln kWh" ni ko'rsatadi.
 */
const ROWS: readonly DataRow[] = [
  { id: "billed", label: "Hisoblangan", value: "1,234 mln kWh", color: "#467acf" },
  { id: "consumed", label: "Iste’mol", value: "1,020 mln kWh", color: "#46cf61" },
  { id: "loss", label: "Yo’qotish", value: "0,214 mln kWh", color: "#cf4646" },
];

/**
 * "Ma'lumotlar" kartasi (Figma `4179:497`, 321.78x197).
 *
 * MAKETDA BU KARTA TUGALLANMAGAN: unda sarlavha va bitta yolg'iz "Chart
 * label" (12px doira + "1,020 mln kWh") bor, 139px lik tananing qolgani esa
 * bo'sh. Shuning uchun bu yerda o'sha nishon dizayn tizimidagi legenda
 * ko'rinishida (`ConsumptionDynamicsCard` dagi bilan bir xil: 12px doira,
 * 10px izoh, 12px yarim qalin qiymat) uch qatorga kengaytirilgan - uchala
 * qiymat ham sahifada allaqachon bor va bir-biriga mos.
 */
export function DataCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <h2 className="shrink-0 text-sm leading-[18px] font-bold text-ink">
        Ma&rsquo;lumotlar
      </h2>

      <div className="mt-2 flex min-h-0 flex-1 flex-col justify-center gap-2">
        {ROWS.map((row) => (
          <div key={row.id} className="flex h-[35px] shrink-0 items-center gap-2.5">
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="flex min-w-0 flex-col gap-1.5">
              <span className="truncate text-[10px] leading-[13px] text-[#999999]">
                {row.label}
              </span>
              <span className="truncate text-xs leading-4 font-semibold text-ink">
                {row.value}
              </span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
