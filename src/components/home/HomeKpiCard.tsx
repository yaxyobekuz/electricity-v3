import { KpiSparkline } from "@/components/home/KpiSparkline";
import { Card } from "@/components/ui/Card";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/**
 * Delta qatorining ohangi. Yo'qotish/iste'mol kontekstida "o'sish" har doim
 * ham yomon emas, shuning uchun rang yo'nalish bo'yicha emas, baho bo'yicha
 * tanlanadi. `flat` - o'zgarish yo'q (kulrang).
 */
export type DeltaTone = "good" | "bad" | "flat";

/** Maketdagi yashil - `trend-down` (#31ae5f), qizil - `trend-up` (#cf4646). */
const TONE_TEXT: Record<DeltaTone, string> = {
  good: "text-trend-down",
  bad: "text-trend-up",
  flat: "text-ink-soft",
};

export interface HomeKpiCardProps {
  title: string;
  /** Asosiy son, maketdagi formatda: "1 048 000", "12.0%". */
  value: string;
  /** Sondan keyingi izoh: "kWh" yoki "(me'yor <= 15%)". */
  unit?: string;
  /** Chapdagi 28px rangli plitkadagi ikonka. */
  icon: GlyphIcon;
  /** Plitka foni, masalan `bg-accent-blue`. */
  accent: string;
  /** Sparkline chizig'ining rangi - aniq hex ("#3b82f6"), SVG `stroke` uchun. */
  stroke: string;
  deltaIcon: GlyphIcon;
  /** O'zgarish qiymati: "8.3%", "2 ta". */
  deltaText: string;
  deltaTone: DeltaTone;
  /** Pastdagi kulrang izoh qatori. */
  note: string;
  /**
   * Trend grafigining qatori - haqiqiy o'lchov birligida (kWh, foiz,
   * dona). Shkalani `KpiSparkline` ning o'zi hisoblaydi.
   */
  points: readonly number[];
  className?: string;
}

/**
 * "Bosh sahifa" 1-qatoridagi KPI kartasi (span-3, ~177x148).
 *
 * `Card` primitivi `padded={false}` bilan ishlatiladi: bu kartada `CardHeader`
 * yo'q va ichki bo'shliq 16px emas, 12px (quti juda tor). Qator balandliklari
 * 148px ga sig'ishi uchun hisoblangan: 12 + 28 + 8+20 + 6+14 + 2+13 + qolgani
 * sparkline + 12.
 *
 * Barcha matn qatorlari `shrink-0`, faqat sparkline `flex-1` - shuning uchun
 * uzun sarlavha yoki izoh kartani cho'zib yubormaydi (`truncate` kesadi).
 */
export function HomeKpiCard({
  title,
  value,
  unit,
  icon,
  accent,
  stroke,
  deltaIcon,
  deltaText,
  deltaTone,
  note,
  points,
  className,
}: HomeKpiCardProps) {
  return (
    // Umumiy `Card` ning 16px bo'shlig'i bu tor qutiga sig'maydi, shuning uchun
    // `padded={false}` va o'zimizning 12px. Qolgan tuzilma (h-full/min-h-0/
    // overflow-hidden) primitivdan meros - takrorlanmaydi.
    <Card padded={false} className={cn("p-3", className)}>
      <header className="flex h-7 shrink-0 items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-lg text-white",
            accent,
          )}
        >
          <Icon icon={icon} size={16} />
        </span>
        {/* Daraja `CardHeader` bilan bir xil (h2) - sarlavhalar ketma-ketligi
            buzilmasin: KPI qatori boshqa kartalardan oldin keladi. */}
        <h2 className="truncate text-[11px] font-medium text-ink-muted">{title}</h2>
      </header>

      <div className="mt-2 flex shrink-0 items-baseline gap-1">
        {/* `whitespace-nowrap` - "1 048 000" dagi ming ajratuvchi bo'shliqlar
            qatorni ikkiga bo'lib yubormasin (balandlik 20px ga qat'iy). */}
        <span className="text-xl leading-none font-bold tracking-tight whitespace-nowrap text-ink">
          {value}
        </span>
        {unit ? (
          <span className="truncate text-[10px] font-medium text-ink-soft">{unit}</span>
        ) : null}
      </div>

      <div
        className={cn("mt-1.5 flex shrink-0 items-center gap-1", TONE_TEXT[deltaTone])}
      >
        <Icon icon={deltaIcon} size={14} className="shrink-0" />
        <span className="truncate text-[11px] font-semibold">{deltaText}</span>
      </div>

      <p className="mt-0.5 shrink-0 truncate text-[10px] text-ink-soft">{note}</p>

      {/* Yagona `flex-1` element - qolgan balandlikni to'liq egallaydi va
          kartaning tubiga yopishadi. `min-h-0` shart: nivo ota elementning
          balandligini o'lchaydi, cheklovsiz u kartani cho'zib yuborardi. */}
      <div className="min-h-0 flex-1 pt-1.5">
        <KpiSparkline points={points} stroke={stroke} />
      </div>
    </Card>
  );
}
