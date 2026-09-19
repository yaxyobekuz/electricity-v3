import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

export interface TableColumn {
  key: string;
  label: string;
  /** Ustun kengligi nisbati (default 1). */
  grow?: number;
  align?: "center" | "left" | "right";
}

export interface TableRow {
  key: string;
  cells: ReactNode[];
}

const ALIGN: Record<NonNullable<TableColumn["align"]>, string> = {
  center: "text-center",
  left: "text-left",
  right: "text-right",
};

/**
 * Maketdagi jadval: ko'k sarlavha qatori, oq qatorlar (#F0F0F0 ajratgich),
 * oxirgi qator - kulrang fon va pastki burchaklari yumaloq.
 */
export function DataTable({
  columns,
  rows,
  className,
  compact = false,
  rowHeight,
  lastRowHeight,
  emptyText,
  lastRowFooter = true,
}: {
  columns: TableColumn[];
  rows: TableRow[];
  className?: string;
  /**
   * Zich variant (bosh sahifadagi kichik kartalar uchun): sarlavha 10px,
   * qator balandliklari 26/24/28. Standart variant - maketdagi 30/29/35
   * o’lcham.
   */
  compact?: boolean;
  /**
   * Maketda har bir jadvalning qator balandligi biroz farq qiladi
   * (28 / 29 / 30 px). Kerak bo'lganda aynan qiymat beriladi, aks holda
   * variant bo'yicha standart ishlatiladi.
   */
  rowHeight?: number;
  lastRowHeight?: number;
  /** Qator yo'q bo'lsa sarlavha ostida ko'rsatiladigan matn. Berilmasa - faqat sarlavha. */
  emptyText?: string;
  /**
   * `false` - oxirgi qator ham oddiy qator kabi chiziladi (kulrang fon va
   * baland "yakun" qatori yo'q). Uzun ro'yxatlarda oxirgi yozuv jami emas.
   */
  lastRowFooter?: boolean;
}) {
  const bodyHeight = rowHeight ?? (compact ? 24 : 29);
  const footHeight = lastRowFooter ? (lastRowHeight ?? (compact ? 28 : 35)) : bodyHeight;
  return (
    <div className={cn("flex min-h-0 w-full flex-col overflow-hidden", className)}>
      {/* Qator balandliklari maketdan aynan o'lchangan: sarlavha 30, oddiy
          qator 29, oxirgisi 35 (pastda kengroq bo'shliq). Balandlikni matn
          qutisiga qoldirilsa, shrift metrikasi tufayli 1px surilib ketadi. */}
      <div
        className={cn(
          "flex w-full shrink-0 items-center rounded-t-md border-b border-solid border-[#f0f0f0] bg-brand px-1.5",
          compact ? "h-[26px]" : "h-[30px]",
        )}
      >
        {columns.map((column) => (
          <span
            key={column.key}
            style={{ flex: `${column.grow ?? 1} 0 0` }}
            className={cn(
              "min-w-0 truncate leading-[14px] font-semibold text-white",
              compact ? "text-[10px]" : "text-[11px]",
              ALIGN[column.align ?? "center"],
            )}
          >
            {column.label}
          </span>
        ))}
      </div>

      {rows.length === 0 && emptyText ? (
        <div
          style={{ height: footHeight }}
          className={cn(
            "flex w-full shrink-0 items-center justify-center rounded-b-md bg-canvas px-1.5 text-ink-muted",
            compact ? "text-[11px]" : "text-xs",
          )}
        >
          <span className="min-w-0 truncate">{emptyText}</span>
        </div>
      ) : null}

      {rows.map((row, index) => {
        const last = index === rows.length - 1;
        const footer = last && lastRowFooter;
        return (
          <div
            key={row.key}
            style={{ height: last ? footHeight : bodyHeight }}
            className={cn(
              "flex w-full shrink-0 items-center px-1.5",
              footer && "rounded-b-md bg-canvas",
              !footer && "border-b border-solid border-[#f0f0f0]",
            )}
          >
            {row.cells.map((cell, cellIndex) => {
              const column = columns[cellIndex];
              return (
                <div
                  key={column?.key ?? cellIndex}
                  style={{ flex: `${column?.grow ?? 1} 0 0` }}
                  className={cn(
                    "min-w-0 truncate text-ink",
                    compact ? "text-[11px]" : "text-xs",
                    ALIGN[column?.align ?? "center"],
                  )}
                >
                  {cell}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

const BADGE_TONE = {
  green: "bg-tint-green text-accent-green",
  red: "bg-tint-red text-[#cf4646]",
  amber: "bg-tint-brown text-[#f59e0b]",
  // Maketda "Yangi" nishoni #EFF6FF fon + #3B82F6 matn (brend ko'ki emas).
  blue: "bg-tint-blue text-accent-blue",
  purple: "bg-tint-purple text-accent-purple",
} as const;

export type BadgeTone = keyof typeof BADGE_TONE;

/** Jadvaldagi holat nishoni (Faol / Nofaol / Ta'mirda ...). */
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className="flex justify-center">
      <span
        className={cn(
          // Maketda nishon 18px: 2.5px + 13px matn qutisi + 2.5px.
          "inline-flex shrink-0 rounded-full px-2 py-[2.5px] text-[10px] leading-[13px] font-semibold whitespace-nowrap",
          BADGE_TONE[tone],
        )}
      >
        {children}
      </span>
    </span>
  );
}
