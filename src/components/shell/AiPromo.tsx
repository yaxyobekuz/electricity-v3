import Image from "next/image";
import { Sparkles } from "lucide-react";

import { Icon } from "@/components/ui/Icon";

/**
 * Ikkilamchi panel pastidagi reklama kartasi: rasm foni, oq matn va gradient
 * yozuvli oq tugma.
 */
export function AiPromo() {
  return (
    <div className="relative flex w-full shrink-0 flex-col justify-end gap-4 overflow-hidden rounded-xl p-4">
      <Image src="/brand/ai-promo.png" alt="" fill sizes="308px" priority className="object-cover" />
      <p className="relative text-base font-semibold leading-[1.3] text-white">
        Sun&rsquo;iy intellekt funksiyalarini sinab ko&rsquo;ring va ishingizni
        tezlashtiring!
      </p>
      <button
        type="button"
        className="relative flex h-9 w-full items-center justify-center gap-3 rounded-lg bg-white transition-opacity hover:opacity-90"
      >
        <span className="text-[#0b1f5b]">
          <Icon icon={Sparkles} size={20} />
        </span>
        <span className="bg-gradient-to-r from-brand to-brand-deep bg-clip-text text-sm font-medium text-transparent">
          Sinab ko&rsquo;rish
        </span>
      </button>
    </div>
  );
}
