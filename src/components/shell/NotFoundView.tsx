import Link from "next/link";
import { SearchX } from "lucide-react";

import { Icon } from "@/components/ui/Icon";

/** "Sahifa topilmadi" kartasi - `not-found.tsx` fayllari uchun umumiy. */
export function NotFoundView({ href, linkLabel }: { href: string; linkLabel: string }) {
  return (
    <div className="flex h-full min-h-60 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-surface p-8 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-canvas text-brand">
        <Icon icon={SearchX} size={28} />
      </span>
      <p className="text-base font-semibold text-ink">Sahifa topilmadi</p>
      <p className="max-w-sm text-sm text-ink-muted">
        Manzil noto’g’ri yoki so’ralgan obyekt topilmadi.
      </p>
      <Link
        href={href}
        className="mt-1 inline-flex h-9 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
