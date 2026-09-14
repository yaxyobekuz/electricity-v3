import type { GlyphIcon } from "@/components/ui/Icon";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/**
 * Delta qatorining ohangi. Yo'qotish kontekstida "o'sish" yomon,
 * shuning uchun rang nomi trend emas, baho bo'yicha. `neutral` - o'zgarish
 * yo'q yoki bahosi aniq emas.
 */
export type KpiTone = "bad" | "good" | "neutral";

/**
 * Maketdagi yashil - `trend-down` tokeni (#31ae5f).
 */
const TONE_TEXT: Record<KpiTone, string> = {
  bad: "text-trend-up",
  good: "text-trend-down",
  neutral: "text-ink-muted",
};

export type KpiCardProps = {
  title: string;
  /** Asosiy son, `format.ts` orqali: "220,1", "2 253". */
  value: string;
  /** Sondan keyingi o'lchov birligi: "ming kWh", "ta umumiy". */
  unit: string;
  /** Sarlavhadagi nishon ikonkasi. */
  icon: GlyphIcon;
  /** Delta qatori ikonkasi; berilmasa faqat matn. */
  deltaIcon?: GlyphIcon;
  /** Delta matni; berilmasa (o'tgan oy bazada yo'q) qator chizilmaydi. */
  deltaText?: string;
  deltaTone?: KpiTone;
  /** "O’tgan oy: ..." qatori; `null` - qator chizilmaydi. */
  previous?: string | null;
  /** Ustunlar balandligi 0..1 ulushda (istalgan soni, 0..12). Bo'sh - diagramma yo'q. */
  bars: readonly number[];
  /** Ustunlar o'ngidagi yorliq: "12 oy". */
  barsLabel?: string;
  /** Karta foni, masalan `bg-tint-blue`. */
  tint: string;
  /** Nishon va ustunlar rangi, masalan `bg-accent-blue`. */
  accent: string;
  className?: string;
};

/** 0..1 oralig'iga siqadi; NaN - 0. */
function toFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * KPI kartasidagi mayda ustunli diagramma. Ustunlar soni har xil (1..12 oy),
 * shuning uchun ustunlar grid orqali teng bo'linadi va balandlik foizda
 * beriladi - trek balandligi ota katakdan keladi.
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
  if (values.length === 0) return null;

  return (
    <div
      className={cn("grid h-full min-w-0 flex-1 items-end gap-x-[2px]", className)}
      style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}
    >
      {values.map((fraction, index) => (
        <div
          key={index}
          className={cn("w-full self-end rounded-[1px]", barClassName)}
          style={{ height: `${toFraction(fraction) * 100}%` }}
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
 *
 * O'tgan oy bazada bo'lmasa delta va "O’tgan oy" qatorlari chizilmaydi -
 * boshqa oy bilan almashtirilmaydi (`malumotlar.md`, 2-bo'lim).
 */
export function KpiCard({
  title,
  value,
  unit,
  icon,
  deltaIcon,
  deltaText,
  deltaTone = "neutral",
  previous = null,
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
        <span className="truncate text-sm leading-[18px] font-medium text-ink-muted">{unit}</span>
      </div>

      {deltaText ? (
        <div className={cn("flex shrink-0 items-center gap-1 pb-1.5", TONE_TEXT[deltaTone])}>
          {deltaIcon ? <Icon icon={deltaIcon} size={20} /> : null}
          <span className="truncate text-sm leading-[18px] font-medium">{deltaText}</span>
        </div>
      ) : null}

      {previous ? (
        <p className="shrink-0 truncate pb-2 text-sm leading-[18px] text-ink-muted">{previous}</p>
      ) : null}

      {bars.length > 0 ? (
        <div className="flex min-h-0 flex-1 items-end gap-2">
          <MiniBars values={bars} barClassName={accent} />
          {barsLabel ? (
            <span className="shrink-0 self-end text-sm leading-[18px] text-ink-muted">
              {barsLabel}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
