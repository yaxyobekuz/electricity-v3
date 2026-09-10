import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

export interface InfoItem {
  key: string;
  label: string;
  value: ReactNode;
  /** `true` bo'lsa katak butun qatorni egallaydi (uzun manzil kabi). */
  wide?: boolean;
}

/**
 * Detal sahifasidagi "Umumiy ma'lumotlar" jadvali: chapda kulrang izoh,
 * ostida qiymat. Kataklar `#f0f0f0` chiziq bilan ajratiladi.
 *
 * Ustunlar soni `columns` bilan beriladi - tor kartada 2, kengida 3-4.
 */
export function InfoGrid({
  items,
  columns = 2,
  className,
}: {
  items: readonly InfoItem[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const template: Record<number, string> = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  };

  return (
    <dl className={cn("grid gap-x-4 gap-y-3", template[columns], className)}>
      {items.map((item) => (
        <div
          key={item.key}
          className={cn(
            "flex min-w-0 flex-col gap-1 border-b border-solid border-[#f0f0f0] pb-2",
            item.wide && "col-span-full",
          )}
        >
          <dt className="truncate text-[10px] text-ink-soft">{item.label}</dt>
          <dd className="truncate text-xs font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Detal sahifasidagi kichik ko'rsatkich plitkasi - `StatCard` ga qaraganda
 * ixchamroq, karta ichida 2-4 tadan joylashadi.
 */
export function MetricTile({
  label,
  value,
  hint,
  tone,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Qiymat rangi; berilmasa oddiy matn rangi. */
  tone?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col justify-center gap-1 rounded-lg bg-canvas p-3",
        className,
      )}
    >
      <span className="truncate text-[10px] text-ink-soft">{label}</span>
      <span className={cn("truncate text-base leading-none font-bold", tone ?? "text-ink")}>
        {value}
      </span>
      {hint ? <span className="truncate text-[10px] text-ink-soft">{hint}</span> : null}
    </div>
  );
}

/**
 * Foizli chiziq - yuklama, bajarilish darajasi va shunga o'xshash
 * ko'rsatkichlar uchun. `value` 0..100 oralig'ida.
 */
export function ProgressBar({
  value,
  tone = "bg-brand",
  className,
}: {
  value: number;
  tone?: string;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-canvas", className)}
    >
      <div className={cn("h-full rounded-full", tone)} style={{ width: `${clamped}%` }} />
    </div>
  );
}
