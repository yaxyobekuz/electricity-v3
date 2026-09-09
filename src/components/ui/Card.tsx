import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Maketdagi asosiy konteyner: oq fon, 12px radius, 16px ichki bo'shliq.
 * Balandlik doim ota grid katagiga to'liq bo'ysunadi (`h-full`).
 */
export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  /** `false` bo'lsa ichki 16px bo'shliq berilmaydi (masalan xarita kartasi). */
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl bg-surface",
        padded && "p-4",
        className,
      )}
    >
      {children}
    </section>
  );
}

/** Karta sarlavhasi: chapda nom, o'ngda amal tugmalari. Balandligi 32px. */
export function CardHeader({
  title,
  children,
  className,
}: {
  title: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("flex h-8 shrink-0 items-center justify-between gap-2", className)}
    >
      <h2 className="truncate text-sm font-bold text-ink">{title}</h2>
      {children ? <div className="flex shrink-0 items-center gap-2">{children}</div> : null}
    </header>
  );
}

/** Karta tanasi - sarlavhadan keyin 8px bo'shliq bilan qolgan joyni egallaydi. */
export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col pt-2", className)}>{children}</div>
  );
}

/** Kartaning pastidagi markazlashgan "Ba'tafsil" havolasi. */
export function CardFooterLink({
  children,
  href = "#",
}: {
  children: ReactNode;
  href?: string;
}) {
  return (
    <div className="flex shrink-0 items-center justify-center pt-2">
      <a
        href={href}
        className="text-xs leading-4 font-medium text-brand transition-opacity hover:opacity-70"
      >
        {children}
      </a>
    </div>
  );
}
