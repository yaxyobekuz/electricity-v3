import { cn } from "@/lib/ui/cn";

import { PortalMark } from "./art/PortalMark";

/**
 * Portal sarlavhasi. Balandlik matematikasi: 14 (eyebrow) + 20 (h1) = 34,
 * 72px ichida markazlashgan. Telefonda `flex-wrap` bilan ikki qatorga
 * o'raladi va balandlik `py-3` dan keladi.
 */
export function PortalHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "portal-enter flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl bg-surface px-4 py-3 lg:h-[72px] lg:flex-nowrap lg:px-5 lg:py-0",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rail text-white">
          <PortalMark />
        </span>
        <span aria-hidden className="hidden h-9 w-px shrink-0 bg-hairline lg:block" />
        <div className="min-w-0">
          <p className="truncate text-[11px] leading-[14px] font-medium tracking-[0.12em] text-ink-muted uppercase">
            Andijon viloyati
          </p>
          <h1 className="truncate text-[15px] leading-5 font-bold text-ink lg:text-lg lg:leading-6">
            Baliqchi tumani — Yoqilg&rsquo;i-energetika tizimi
          </h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <span className="flex h-7 items-center gap-1.5 rounded-full bg-tint-green px-2.5 text-[11px] leading-4 font-medium text-[#15803d]">
          <span aria-hidden className="size-1.5 rounded-full bg-[#15803d]" />
          Tizim faol
        </span>
        <span className="hidden text-[11px] leading-4 text-ink-muted sm:block">
          Yo&rsquo;nalishni tanlang
        </span>
      </div>
    </header>
  );
}
