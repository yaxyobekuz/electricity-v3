"use client";

import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

export interface SegmentItem<T extends string> {
  value: T;
  Icon: GlyphIcon;
  /** Ekran o'quvchilari uchun o'zbekcha nom. */
  label: string;
}

/**
 * Figma "Toggle btn": #F3F3F3 kapsula, ichida 28x28 dumaloq tugmalar.
 * Faol tugma - brend ko'k fon, oq ikonka.
 */
export function SegmentedIcons<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: ReadonlyArray<SegmentItem<T>>;
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      className={cn("flex items-center gap-0.5 rounded-full bg-canvas p-0.5", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            title={item.label}
            aria-label={item.label}
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full transition-colors",
              active ? "bg-brand text-white" : "text-ink hover:bg-black/5",
            )}
          >
            <Icon icon={item.Icon} size={18} />
          </button>
        );
      })}
    </div>
  );
}
