import Image from "next/image";
import { Sparkles } from "lucide-react";

import { Icon } from "@/components/ui/Icon";

/**
 * Yon panel pastidagi sun'iy intellekt kartasi (Figma `4126:125`, 308x148).
 *
 * Sun'iy intellekt sahifasining Excel shablonlarida manbasi yo'q
 * (`malumotlar.md` 8-bo'lim), shuning uchun tugma hozircha bosilmaydi -
 * foydalanuvchi qaroriga ko'ra (2026-09-21) maket to'liq chiziladi, lekin
 * bo'sh sahifaga olib bormaydi.
 *
 * Fon - maketdagi rasm (`public/home/promo.png`), matn uning ustida.
 */
export function AiPromoCard() {
  return (
    <div className="relative shrink-0 overflow-hidden rounded-xl p-4">
      <Image
        src="/home/promo.png"
        alt=""
        fill
        sizes="308px"
        className="object-cover"
        priority={false}
      />
      <div className="relative flex flex-col gap-4">
        <p className="text-base leading-[21px] font-semibold text-white">
          Sun&rsquo;iy intellekt funksiyalarini sinab ko&rsquo;ring va ishingizni tezlashtiring!
        </p>
        <button
          type="button"
          disabled
          title="Sahifa tayyor emas"
          className="flex h-9 cursor-not-allowed items-center justify-center gap-3 rounded-lg bg-white/95"
        >
          <Icon icon={Sparkles} size={20} className="shrink-0 text-brand" />
          {/* Maketda yozuv ko'kdan siyohrangga o'tuvchi gradient bilan. */}
          <span className="bg-gradient-to-r from-brand to-brand-deep bg-clip-text text-sm leading-[18px] font-medium text-transparent">
            Sinab ko&rsquo;rish
          </span>
        </button>
      </div>
    </div>
  );
}
