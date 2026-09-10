import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

export interface RegistryColumn {
  key: string;
  label: string;
  /** Ustun kengligi nisbati (default 1). */
  grow?: number;
  align?: "center" | "left" | "right";
}

export interface RegistryRow {
  key: string;
  cells: ReactNode[];
  /**
   * Berilsa, butun qator havolaga aylanadi va ustiga borilganda ajralib
   * turadi. Detal sahifasiga o'tish shu orqali ishlaydi.
   */
  href?: string;
}

const ALIGN: Record<NonNullable<RegistryColumn["align"]>, string> = {
  center: "justify-center text-center",
  left: "justify-start text-left",
  right: "justify-end text-right",
};

/**
 * To'liq sahifali ro'yxat jadvali.
 *
 * `DataTable` (kartalar ichidagi kichik jadval) dan farqi:
 *   - sarlavha qatori **yopishqoq** (`sticky`), ro'yxat uzun bo'lsa ham
 *     ustunlar nomi ko'rinib turadi;
 *   - qatorlar 44px va bosiladigan (`href`), ustiga borilganda fon o'zgaradi;
 *   - oxirgi qatorning maxsus kulrang foni yo'q - bu yerda ro'yxat tugamaydi,
 *     u skroll qilinadi.
 *
 * Konteyner o'zi skroll qilinadigan bo'lishi kerak:
 * `<div className="min-h-0 flex-1 overflow-y-auto">`.
 */
export function RegistryTable({
  columns,
  rows,
  emptyText = "Ma’lumot topilmadi",
  className,
}: {
  columns: RegistryColumn[];
  rows: RegistryRow[];
  emptyText?: string;
  className?: string;
}) {
  // Bosiladigan jadvalda oxirgi ustun - strelka (12px), u sarlavhada nomsiz.
  const clickable = rows.some((row) => row.href);

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div className="sticky top-0 z-10 flex h-9 w-full shrink-0 items-center rounded-md bg-brand px-3">
        {columns.map((column) => (
          <span
            key={column.key}
            style={{ flex: `${column.grow ?? 1} 0 0` }}
            className={cn(
              "flex min-w-0 items-center truncate text-[11px] leading-4 font-semibold text-white",
              ALIGN[column.align ?? "center"],
            )}
          >
            <span className="truncate">{column.label}</span>
          </span>
        ))}
        {clickable ? <span className="w-4 shrink-0" aria-hidden /> : null}
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-xs text-ink-soft">{emptyText}</p>
      ) : (
        rows.map((row) => {
          const cells = (
            <>
              {row.cells.map((cell, index) => {
                const column = columns[index];
                return (
                  <span
                    key={column?.key ?? index}
                    style={{ flex: `${column?.grow ?? 1} 0 0` }}
                    className={cn(
                      "flex min-w-0 items-center gap-1.5 truncate text-xs text-ink",
                      ALIGN[column?.align ?? "center"],
                    )}
                  >
                    {cell}
                  </span>
                );
              })}
              {clickable ? (
                <span className="flex w-4 shrink-0 items-center justify-end text-ink-soft opacity-0 transition-opacity group-hover:opacity-100">
                  <Icon icon={ChevronRight} size={14} />
                </span>
              ) : null}
            </>
          );

          const rowClass =
            "group flex h-11 w-full shrink-0 items-center border-b border-solid border-[#f0f0f0] px-3 transition-colors";

          return row.href ? (
            <Link key={row.key} href={row.href} className={cn(rowClass, "hover:bg-canvas")}>
              {cells}
            </Link>
          ) : (
            <div key={row.key} className={rowClass}>
              {cells}
            </div>
          );
        })
      )}
    </div>
  );
}
