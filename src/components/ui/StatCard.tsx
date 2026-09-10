import type { ReactNode } from "react";

import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/** Izoh qatorining ohangi - `good` yashil, `bad` qizil, `flat` kulrang. */
export type StatTone = "bad" | "flat" | "good";

const TONE_TEXT: Record<StatTone, string> = {
  good: "text-trend-down",
  bad: "text-trend-up",
  flat: "text-ink-soft",
};

export interface StatCardProps {
  label: string;
  /** Asosiy son, tayyor formatda: "1 048 000", "12,4%". */
  value: string;
  /** Sondan keyingi o'lchov birligi. */
  unit?: string;
  icon: GlyphIcon;
  /** Ikonka plitkasining foni, masalan `bg-accent-blue`. */
  accent: string;
  /** Kartaning yumshoq foni, masalan `bg-tint-blue`. Berilmasa - oq. */
  tint?: string;
  /** Pastdagi izoh qatori. */
  hint?: ReactNode;
  hintTone?: StatTone;
  className?: string;
}

/**
 * Ro'yxat sahifalarining yuqorisidagi statistika bloki (~366x104).
 *
 * Bosh sahifadagi `HomeKpiCard` dan farqi: bu yerda sparkline yo'q va quti
 * kengroq, shuning uchun ikonka 36px va qiymat 22px. Balandlik qat'iy -
 * sahifa gridida `104px` qator sifatida ishlatiladi.
 */
export function StatCard({
  label,
  value,
  unit,
  icon,
  accent,
  tint,
  hint,
  hintTone = "flat",
  className,
}: StatCardProps) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col justify-center gap-2 overflow-hidden rounded-xl p-4",
        tint ?? "bg-surface",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
            accent,
          )}
        >
          <Icon icon={icon} size={20} />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[11px] font-medium text-ink-muted">{label}</span>
          <span className="mt-0.5 flex items-baseline gap-1">
            <span className="truncate text-[22px] leading-none font-bold tracking-tight text-ink">
              {value}
            </span>
            {unit ? (
              <span className="shrink-0 text-[11px] font-medium text-ink-soft">{unit}</span>
            ) : null}
          </span>
        </div>
      </div>

      {hint ? (
        <p className={cn("truncate text-[10px] leading-tight", TONE_TEXT[hintTone])}>
          {hint}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Statistika bloklari qatori - teng kengliklarda, 8px oraliq bilan.
 * Balandligi qat'iy 104px, sahifa balandligi hisobiga kirmaydi.
 */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid h-[104px] shrink-0 auto-cols-fr grid-flow-col gap-2">
      {children}
    </div>
  );
}
