"use client";

import { Check, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

export interface SelectOption {
  value: string;
  label: string;
}

/** Ro'yxat panelining o'lchamlari. */
const GAP = 4;
const MAX_PANEL_HEIGHT = 220;
/** Bitta variant: 6px + 16px matn qutisi + 6px. Panel balandligini
 *  oldindan hisoblash uchun kerak (tepaga ochilish qarorida). */
const OPTION_HEIGHT = 28;

interface PanelRect {
  left: number;
  top: number;
  width: number;
  /** `true` bo'lsa panel tugmaning USTIDA ochiladi (pastda joy yetmagan). */
  flipped: boolean;
}

/**
 * Ochiluvchi ro'yxatli tanlov maydoni.
 *
 * Panel `document.body` ga PORTAL orqali chiqariladi. Sabab: `Card` da
 * `overflow-hidden` bor (kartalar burchaklari yumaloq bo'lgani uchun shart),
 * ya'ni oddiy `absolute` panel karta chegarasida kesilib qolardi. Portal esa
 * uni butunlay tashqariga chiqaradi, shuning uchun joylashuv `fixed` va
 * tugmaning ekrandagi o'rnidan hisoblanadi.
 *
 * Sahifaning ichki skroll konteyneri bor, shuning uchun o'rin `scroll`
 * hodisasida (capture bosqichida - ichki konteynerlarni ham ushlash uchun)
 * qayta hisoblanadi.
 */
export function SelectField({
  value,
  options,
  placeholder,
  onChange,
  disabled = false,
  className,
}: {
  /** Tanlangan variant qiymati; `null` - hech narsa tanlanmagan. */
  value: string | null;
  options: readonly SelectOption[];
  placeholder: string;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<PanelRect | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selected = options.find((option) => option.value === value) ?? null;

  const place = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    const below = window.innerHeight - box.bottom - GAP;
    const panelHeight = Math.min(MAX_PANEL_HEIGHT, options.length * OPTION_HEIGHT + 8);
    const flipped = below < panelHeight && box.top > below;
    setRect({
      left: box.left,
      top: flipped ? box.top - GAP - panelHeight : box.bottom + GAP,
      width: box.width,
      flipped,
    });
  }, [options.length]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    // `capture` - sahifaning ichki skroll konteyneri ham hisobga olinsin.
    const onScroll = () => place();

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  function choose(option: SelectOption) {
    // Tanlangan variantni qayta bosish - tanlovni bekor qiladi.
    onChange(option.value === value ? null : option.value);
    setOpen(false);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-8 shrink-0 items-center justify-between gap-2 rounded-full bg-canvas pr-2.5 pl-3 transition-colors",
          disabled ? "cursor-not-allowed opacity-50" : "hover:bg-black/5",
          open && "ring-1 ring-brand/40",
          className,
        )}
      >
        <span
          className={cn(
            "truncate text-sm leading-[18px]",
            selected ? "font-medium text-ink" : "text-ink-muted",
          )}
        >
          {selected ? selected.label : placeholder}
        </span>
        {/* Maketda yopiq holatda strelka o'ngga qaraydi; ochilganda 90 daraja
            burilib pastga qaraydi - yopiq ko'rinish maketdagidek qoladi. */}
        <span
          className={cn(
            "shrink-0 text-ink-soft transition-transform",
            open && "rotate-90",
          )}
        >
          <Icon icon={ChevronRight} size={18} />
        </span>
      </button>

      {open && rect
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              aria-label={placeholder}
              style={{
                left: rect.left,
                top: rect.top,
                width: rect.width,
                maxHeight: MAX_PANEL_HEIGHT,
              }}
              className="scrollbar-none fixed z-50 overflow-y-auto rounded-xl bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
            >
              {options.length === 0 ? (
                <p className="px-2 py-2 text-xs text-ink-soft">Variant yo&rsquo;q</p>
              ) : (
                options.map((option) => {
                  const active = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => choose(option)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors",
                        active ? "bg-tint-blue" : "hover:bg-canvas",
                      )}
                    >
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-xs leading-4",
                          active ? "font-semibold text-brand" : "text-ink",
                        )}
                      >
                        {option.label}
                      </span>
                      {active ? (
                        <span className="shrink-0 text-brand">
                          <Icon icon={Check} size={14} />
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
