import { DatabaseZap, Upload } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/ui/cn";

/**
 * Ma'lumot yo'q holati. Ikki xil ishlatiladi:
 *   - sahifa darajasida (`variant="page"`): bazada birorta davr yo'q -
 *     yuklash sahifasiga havola bilan;
 *   - karta ichida (`variant="inline"`): shu oy/qamrov uchun yozuv yo'q.
 *
 * Server komponent - istalgan joyda ishlatsa bo'ladi.
 */
export function EmptyState({
  title = "Ma’lumot hali yuklanmagan",
  description,
  action = true,
  variant = "page",
  className,
}: {
  title?: string;
  description?: string;
  /** `/imports` ga havola ko'rsatilsinmi. */
  action?: boolean;
  variant?: "inline" | "page";
  className?: string;
}) {
  const page = variant === "page";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 text-center",
        page ? "h-full min-h-60 rounded-2xl bg-surface p-8" : "h-full min-h-0 p-4",
        className,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-2xl bg-canvas text-brand",
          page ? "size-14" : "size-9 rounded-xl",
        )}
      >
        <DatabaseZap className={page ? "size-7" : "size-4"} strokeWidth={page ? 1.8 : 2} />
      </span>
      <p className={cn("font-semibold text-ink", page ? "text-base" : "text-sm")}>{title}</p>
      {description && (
        <p className={cn("max-w-sm text-ink-muted", page ? "text-sm" : "text-xs")}>{description}</p>
      )}
      {action && (
        <Link
          href="/imports"
          className={cn(
            "mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand font-semibold text-white transition-opacity hover:opacity-90",
            page ? "h-9 px-4 text-sm" : "h-7 px-3 text-xs",
          )}
        >
          <Upload className="size-4" strokeWidth={2} />
          Ma’lumot yuklash
        </Link>
      )}
    </div>
  );
}
