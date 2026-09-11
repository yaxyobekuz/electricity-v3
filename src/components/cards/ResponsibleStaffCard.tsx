import Image from "next/image";

import { Card, CardFooterLink } from "@/components/ui/Card";
import { cn } from "@/lib/ui/cn";

interface Staff {
  name: string;
  phone: string;
  photo: string;
}

const STAFF: Staff = {
  name: "Karimov Egamberdi",
  phone: "+998 20 007 77 83",
  photo: "/map/abonent-male.jpg",
};

/** `tel:` sxemasi bo'shliqlarni qabul qilmaydi. */
const TEL_HREF = `tel:${STAFF.phone.replace(/\s/g, "")}`;

/**
 * Fider uchun mas'ul xodim (Figma `4029:1371`, 486.67x140).
 *
 * Sarlavha bu kartada 18px - 32px lik `CardHeader` emas, oddiy `h2`.
 * Tana: 48px avatar + 12px + ism/telefon ustuni, o'ngga surilgan kapsula.
 *
 * Pastki ichki bo'shliq maketda 8px (yuqorisi 16): 16 + 18 + 73 + 25 + 8 = 140.
 *
 * Bosh sahifada xuddi shu karta balandroq (178px) va sarlavhasi boshqacha
 * ("Energetika rahbari"), shuning uchun matnlar propga chiqarilgan. Ichki
 * blok `flex-1` bo'lgani uchun qo'shimcha balandlik o'z-o'zidan taqsimlanadi.
 */
export function ResponsibleStaffCard({
  title = "Ma’sul xodim",
  footerLabel = "Ba’tafsil",
  footerHref,
  className,
}: {
  title?: string;
  footerLabel?: string;
  footerHref?: string;
  className?: string;
}) {
  return (
    <Card className={cn("pb-2", className)}>
      <h2 className="shrink-0 truncate text-sm leading-[18px] font-bold text-ink">{title}</h2>

      <div className="flex min-h-0 flex-1 items-center gap-3">
        <Image
          src={STAFF.photo}
          alt=""
          width={48}
          height={48}
          className="size-12 shrink-0 rounded-full object-cover"
        />

        {/* Maketda ikki qator orasidagi masofa 10px (28 - 18px qator qutisi). */}
        <div className="flex min-w-0 flex-col gap-2.5">
          <span className="truncate text-sm leading-[18px] font-bold text-ink">{STAFF.name}</span>
          <a
            href={TEL_HREF}
            className="truncate text-sm leading-[18px] font-medium text-brand transition-opacity hover:opacity-70"
          >
            {STAFF.phone}
          </a>
        </div>

        {/* Server komponent bo'lgani uchun tugma emas - o'sha `tel:` havolasi. */}
        <a
          href={TEL_HREF}
          className="ml-auto flex h-8 shrink-0 items-center rounded-full bg-canvas px-5 text-xs font-semibold text-brand transition-colors hover:bg-black/5"
        >
          Bog&rsquo;lanish
        </a>
      </div>

      {/* Maketdagi 1px ajratgich (#dddddd) - `CardFooterLink` da yo'q. */}
      <div className="shrink-0 border-t border-[#dddddd]">
        <CardFooterLink href={footerHref}>{footerLabel}</CardFooterLink>
      </div>
    </Card>
  );
}
