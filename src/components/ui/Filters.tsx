"use client";

import { Search } from "lucide-react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/** Ro'yxat sahifalaridagi qidiruv maydoni. */
export function SearchField({
  value,
  onChange,
  placeholder = "Qidiruv...",
  label = "Ro’yxatdan qidirish",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-soft">
        <Icon icon={Search} size={16} />
      </span>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        placeholder={placeholder}
        className="h-8 w-full rounded-lg bg-canvas pr-3 pl-8 text-xs text-ink outline-none placeholder:text-ink-soft focus:ring-1 focus:ring-brand/40"
      />
    </div>
  );
}

export interface FilterChip<T extends string> {
  value: T;
  label: string;
  /** Yonidagi son - odatda shu filtrga tushadigan qatorlar soni. */
  count?: number;
  /** Nishon rangi, masalan `bg-accent-red`. Berilmasa nuqta chizilmaydi. */
  dot?: string;
}

/**
 * Holat bo'yicha filtr tugmalari. Faol tugma - brend ko'k fon.
 * `SegmentedIcons` dan farqi: bu yerda matn va son bor, ikonka emas.
 */
export function FilterChips<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: ReadonlyArray<FilterChip<T>>;
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      className={cn("flex items-center gap-1.5 overflow-x-auto scrollbar-none", className)}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
              active ? "bg-brand text-white" : "bg-canvas text-ink-muted hover:bg-black/5",
            )}
          >
            {item.dot ? (
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  // Faol pill ko'k fonda - o'z rangidagi nuqta ko'rinmay qolardi.
                  active ? "bg-white" : item.dot,
                )}
              />
            ) : null}
            <span className="whitespace-nowrap">{item.label}</span>
            {item.count !== undefined ? (
              <span className={cn("font-semibold", active ? "text-white" : "text-ink")}>
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Kichik "select" tugmasi - bosilganda variantlarni aylantiradi. */
export function CycleSelect({
  label,
  value,
  onCycle,
  className,
}: {
  /** "Davr" kabi old qo'shimcha; berilmasa faqat qiymat ko'rsatiladi. */
  label?: string;
  value: string;
  onCycle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={label ? `${label}ni o’zgartirish` : "Qiymatni o’zgartirish"}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-canvas px-3 text-xs font-medium text-ink transition-colors hover:bg-black/5",
        className,
      )}
    >
      {label ? <span className="text-ink-soft">{label}:</span> : null}
      {value}
    </button>
  );
}
