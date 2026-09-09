import Link from "next/link";

import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/**
 * Karta sarlavhasidagi yolg'iz amal tugmasi (yuklab olish, kengaytirish,
 * ochish): #F3F3F3 kapsula, ichida 28x28 dumaloq tugma.
 *
 * Bu **server komponenti** - shuning uchun uni server kartalaridan ham
 * chaqirsa bo'ladi (lucide ikonkasini prop sifatida uzatish RSC chegarasidan
 * o'tmaydi; `SegmentedIcons` esa faqat mijoz kartalarida ishlatiladi).
 */
export function IconPill({
  icon,
  label,
  href,
  className,
}: {
  icon: GlyphIcon;
  label: string;
  href?: string;
  className?: string;
}) {
  const shell = cn("group flex items-center rounded-full bg-canvas p-0.5", className);
  const inner = (
    <span className="flex size-7 items-center justify-center rounded-full text-ink transition-colors group-hover:bg-black/5">
      <Icon icon={icon} size={18} />
    </span>
  );

  if (href) {
    return (
      <Link href={href} title={label} aria-label={label} className={shell}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" title={label} aria-label={label} className={shell}>
      {inner}
    </button>
  );
}
