import type { GlyphIcon } from "@/components/ui/Icon";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/**
 * Delta qatorining ohangi. Yo'qotish kontekstida "o'sish" yomon,
 * shuning uchun rang nomi trend emas, baho bo'yicha.
 */
export type KpiTone = "bad" | "good";

/**
 * Maketdagi yashil - `trend-down` tokeni (#31ae5f).
 */
const TONE_TEXT: Record<KpiTone, string> = {
  bad: "text-trend-up",
  good: "text-trend-down",
};

export type KpiCardProps = {
  title: string;
  /** Asosiy son, maketdagi formatda: "220,1", "2,253". */
  value: string;
  /** Sondan keyingi o'lchov birligi: "ming kWh", "ta faol". */
  unit: string;
  /** Sarlavhadagi nishon ikonkasi. */
  icon: GlyphIcon;
  deltaIcon: GlyphIcon;
  deltaText: string;
  deltaTone: KpiTone;
  /** "O'tgan oy: ..." qatori. */
  previous: string;
  /** Ustunlar balandligi 0..1 ulushda (39px trek = 1). */
  bars: readonly number[];
  /** Ustunlar o'ngidagi yorliq: "30 kun" yoki "12 oy". */
  barsLabel: string;
  /** Karta foni, masalan `bg-tint-blue`. */
  tint: string;
  /** Nishon va ustunlar rangi, masalan `bg-accent-blue`. */
  accent: string;
  className?: string;
};

/**
 * KPI kartasidagi mayda ustunli diagramma. Ustunlar soni har xil (30 kun /
 * 12 oy), shuning uchun ustunlar grid orqali teng bo'linadi va balandlik
 * foizda beriladi - trek balandligi ota katakdan keladi.
 */
export function MiniBars({
  values,
  barClassName,
  className,
}: {
  values: readonly number[];
  barClassName: string;
  className?: string;
}) {
  return (
    <div
      className={cn("grid h-full min-w-0 flex-1 items-end gap-x-[2px]", className)}
      style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}
    >
      {values.map((fraction, index) => (
        <div
          key={index}
          className={cn("w-full self-end rounded-[1px]", barClassName)}
          style={{ height: `${fraction * 100}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Fider sahifasining 1-qatoridagi KPI kartasi (Figma `4029:986`, 240x196).
 *
 * Umumiy `Card` ishlatilmaydi: KPI kartasining foni oq emas, aksent tusi.
 * Qator balandliklari maketdan aynan: 32 + 41 + 26 + 26 + 39 = 164 (+32 padding).
 * Shuning uchun matnlarga Figma'dagi qator qutisi (`leading-[18px]` /
 * `leading-[31px]`) qo'lda beriladi - Tailwind standarti 20/32 bo'lib,
 * diagramma trekini 3px yeb qo'yadi.
 */
export function KpiCard({
  title,
  value,
  unit,
  icon,
  deltaIcon,
  deltaText,
  deltaTone,
  previous,
  bars,
  barsLabel,
  tint,
  accent,
  className,
}: KpiCardProps) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl p-4",
        tint,
        className,
      )}
    >
      <header className="flex h-8 shrink-0 items-start justify-between gap-2">
        <h2 className="truncate text-sm leading-[18px] font-medium text-ink">{title}</h2>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md text-white",
            accent,
          )}
        >
          <Icon icon={icon} size={20} />
        </span>
      </header>

      <div className="flex shrink-0 items-center gap-1 pt-1 pb-1.5">
        <span className="text-2xl leading-[31px] font-bold text-ink">{value}</span>
        <span className="text-sm leading-[18px] font-medium text-ink-muted">{unit}</span>
      </div>

      <div className={cn("flex shrink-0 items-center gap-1 pb-1.5", TONE_TEXT[deltaTone])}>
        <Icon icon={deltaIcon} size={20} />
        <span className="truncate text-sm leading-[18px] font-medium">{deltaText}</span>
      </div>

      <p className="shrink-0 truncate pb-2 text-sm leading-[18px] text-ink-muted">
        {previous}
      </p>

      <div className="flex min-h-0 flex-1 items-end gap-2">
        <MiniBars values={bars} barClassName={accent} />
        <span className="shrink-0 self-end text-sm leading-[18px] text-ink-muted">
          {barsLabel}
        </span>
      </div>
    </section>
  );
}
