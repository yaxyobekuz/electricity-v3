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
}: {
  columns: TableColumn[];
  rows: TableRow[];
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 w-full flex-col overflow-hidden", className)}>
      {/* Qator balandliklari maketdan aynan o'lchangan: sarlavha 30, oddiy
          qator 29, oxirgisi 35 (pastda kengroq bo'shliq). Balandlikni matn
          qutisiga qoldirilsa, shrift metrikasi tufayli 1px surilib ketadi. */}
      <div className="flex h-[30px] w-full shrink-0 items-center rounded-t-md border-b border-solid border-[#f0f0f0] bg-brand px-1.5">
        {columns.map((column) => (
          <span
            key={column.key}
            style={{ flex: `${column.grow ?? 1} 0 0` }}
            className={cn(
              "min-w-0 truncate text-[11px] leading-[14px] font-semibold text-white",
              ALIGN[column.align ?? "center"],
            )}
          >
            {column.label}
          </span>
        ))}
      </div>

      {rows.map((row, index) => {
        const last = index === rows.length - 1;
        return (
          <div
            key={row.key}
            className={cn(
              "flex w-full shrink-0 items-center px-1.5",
              last
                ? "h-[35px] rounded-b-md bg-canvas"
                : "h-[29px] border-b border-solid border-[#f0f0f0]",
            )}
          >
            {row.cells.map((cell, cellIndex) => {
              const column = columns[cellIndex];
              return (
                <div
                  key={column?.key ?? cellIndex}
                  style={{ flex: `${column?.grow ?? 1} 0 0` }}
                  className={cn(
                    "min-w-0 truncate text-xs text-ink",
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
  blue: "bg-tint-blue text-brand",
  purple: "bg-tint-purple text-accent-purple",
} as const;

export type BadgeTone = keyof typeof BADGE_TONE;

/** Jadvaldagi holat nishoni (Faol / Nofaol / Ta'mirda ...). */
export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className="flex justify-center">
      <span
        className={cn(
          // Maketda nishon 17px: 2px + 13px matn qutisi + 2px.
          "inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] leading-[13px] font-semibold whitespace-nowrap",
          BADGE_TONE[tone],
        )}
      >
        {children}
      </span>
    </span>
  );
}
