import { Card, CardFooterLink } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/ui/cn";

/** Shablondagi "Ma’sul xodim" - faqat F.I.Sh. (telefon/rasm shablonda yo'q). */
export interface Staff {
  name: string;
}

/** "Karimov Egamberdi" -> "KE". Apostrof va tire hisobga olinmaydi. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => Array.from(word.replace(/[^\p{L}\p{N}]/gu, ""))[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Obyekt uchun mas'ul xodim (Figma `4029:1371`, 486.67x140).
 *
 * Sarlavha bu kartada 18px - 32px lik `CardHeader` emas, oddiy `h2`.
 * Tana: 48px bosh harflar doirasi + 12px + ism.
 *
 * Pastki ichki bo'shliq maketda 8px (yuqorisi 16): 16 + 18 + 73 + 25 + 8 = 140.
 * Footer faqat `footerHref` berilganda chiziladi; xodim ko'rsatilmagan bo'lsa
 * (`staff={null}`) - bo'sh holat.
 */
export function ResponsibleStaffCard({
  staff,
  title = "Ma’sul xodim",
  caption,
  footerLabel = "Ba’tafsil",
  footerHref,
  className,
}: {
  staff: Staff | null;
  title?: string;
  /** Ism ostidagi ixtiyoriy izoh (masalan, obyekt nomi). */
  caption?: string;
  footerLabel?: string;
  footerHref?: string;
  className?: string;
}) {
  return (
    <Card className={cn("pb-2", className)}>
      <h2 className="shrink-0 truncate text-sm leading-[18px] font-bold text-ink">{title}</h2>

      {staff ? (
        <div className="flex min-h-0 flex-1 items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-tint-blue text-base font-semibold text-brand"
          >
            {initials(staff.name)}
          </span>

          {/* Maketda ikki qator orasidagi masofa 10px (28 - 18px qator qutisi). */}
          <div className="flex min-w-0 flex-col gap-2.5">
            <span className="truncate text-sm leading-[18px] font-bold text-ink">{staff.name}</span>
            {caption ? (
              <span className="truncate text-sm leading-[18px] text-ink-muted">{caption}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <EmptyState variant="inline" action={false} title="Ma’sul xodim ko’rsatilmagan" />
        </div>
      )}

      {/* Maketdagi 1px ajratgich (#dddddd) - `CardFooterLink` da yo'q. */}
      {staff && footerHref ? (
        <div className="shrink-0 border-t border-[#dddddd]">
          <CardFooterLink href={footerHref}>{footerLabel}</CardFooterLink>
        </div>
      ) : null}
    </Card>
  );
}
