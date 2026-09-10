import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/**
 * Sahifaning yuqori yo'lagi: chapda sarlavha va izoh, o'ngda amal tugmalari.
 *
 * Balandligi 56px - bosh sahifadagi `HomeTopBar` (60px) dan bir oz pastroq,
 * chunki bu yerda logotip yo'q. `shrink-0`: sahifa gridida qat'iy qator.
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  /** Berilsa, sarlavha oldida "orqaga" tugmasi chiqadi (detal sahifalari). */
  backHref?: string;
  backLabel?: string;
  /** O'ng tarafdagi tugmalar. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-14 shrink-0 items-center justify-between gap-4 overflow-hidden rounded-xl bg-surface px-4",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {backHref ? (
          <Link
            href={backHref}
            aria-label={backLabel ?? "Orqaga"}
            title={backLabel ?? "Orqaga"}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-ink transition-colors hover:bg-black/5"
          >
            <Icon icon={ChevronLeft} size={18} />
          </Link>
        ) : null}
        <div className="min-w-0">
          <h1 className="truncate text-base leading-tight font-bold text-ink">{title}</h1>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] leading-tight text-ink-soft">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}

/**
 * Sahifa yo'lagidagi standart tugma. `tone`:
 *   - `muted` - kulrang fon (ikkilamchi amal),
 *   - `brand` - ko'k fon (asosiy amal).
 */
export function HeaderButton({
  icon,
  children,
  href,
  tone = "muted",
  onClick,
}: {
  icon?: Parameters<typeof Icon>[0]["icon"];
  children: ReactNode;
  href?: string;
  tone?: "brand" | "muted";
  onClick?: () => void;
}) {
  const className = cn(
    "flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors",
    tone === "brand"
      ? "bg-brand text-white hover:opacity-90"
      : "bg-canvas text-ink hover:bg-black/5",
  );

  const content = (
    <>
      {icon ? <Icon icon={icon} size={16} /> : null}
      {children}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
