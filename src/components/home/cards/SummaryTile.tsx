import Image from "next/image";
import Link from "next/link";

import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/**
 * Bitta ko'rsatkich va amal tugmasi bor oq karta (Figma `4285:3` - 80px,
 * `4289:294` - 108px).
 *
 * Tarkib vertikal markazda: 48px belgi + 12px + matn ustuni (qatorlar orasi
 * 4px), o'ngda 32px kapsula ("Ochish" / "Ba'tafsil", 20px yon bo'shliq).
 *
 * Maketda chap pastki burchakda karta chetidan chiqib turgan 106px aylana
 * ("Rectangle 18", tepadan 27px) bor - u bezak, karta chegarasida kesiladi.
 *
 * Maketdagi 48px belgi svgrepo illyustratsiyasi bo'lsa `image` bilan
 * beriladi (masalan zarar kartasi); berilmasa - dizayn tizimi uslubidagi
 * lucide glifi (`icon`) rangli kvadrat ichida.
 */
export function SummaryTile({
  icon,
  image,
  value,
  label,
  valueFirst = true,
  actionLabel,
  href,
  tint,
  accent,
  glow,
  className,
}: {
  icon: GlyphIcon;
  /** Maketdagi 48px illyustratsiya (`public/home/...`); berilsa `icon` o'rniga. */
  image?: string;
  /** Qalin qator: "4ta", "635,1 mln so'm". */
  value: string;
  /** Izoh qatori: "Podstansiyalar". */
  label: string;
  /** `false` bo'lsa izoh tepada, son pastda (zarar kartasidagidek). */
  valueFirst?: boolean;
  actionLabel: string;
  href: string;
  /** Belgi foni, masalan `bg-tint-blue`. */
  tint: string;
  /** Belgi rangi, masalan `text-accent-blue`. */
  accent: string;
  /** Bezak aylanasining rangi, masalan `bg-accent-blue`. */
  glow: string;
  className?: string;
}) {
  const valueNode = (
    <span className="truncate text-base leading-[21px] font-bold text-ink">{value}</span>
  );
  const labelNode = (
    <span className="truncate text-sm leading-[18px] font-medium text-[#999999]">{label}</span>
  );

  return (
    <section
      className={cn(
        "relative flex h-full min-h-0 items-center overflow-hidden rounded-2xl bg-surface px-4",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-[27px] -left-[53px] size-[106px] rounded-full opacity-20 blur-2xl",
          glow,
        )}
      />

      <div className="relative flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {image ? (
            <Image src={image} alt="" width={48} height={48} className="size-12 shrink-0" />
          ) : (
            <span
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-xl",
                tint,
                accent,
              )}
            >
              <Icon icon={icon} size={28} />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-1">
            {valueFirst ? valueNode : labelNode}
            {valueFirst ? labelNode : valueNode}
          </div>
        </div>

        <Link
          href={href}
          className="flex h-8 shrink-0 items-center rounded-full bg-canvas px-5 text-xs leading-4 font-semibold text-brand transition-colors hover:bg-black/5"
        >
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}
