import { cn } from "@/lib/ui/cn";

import { DistrictMap } from "./DistrictMap";

/* ---------------------------------------------------------------------------
   Xarita paneli.

   Google xaritasi bu ekranda ISHLATILMAYDI: portal tasviri qorong'i
   "boshqaruv markazi" uslubida va rastr plitkalarni unga keltirib bo'lmaydi.
   Shu sababli panel butunlay server tomonida chiziladi - mijozda bironta
   ham baytlik JS, tashqi so'rov yoki API kaliti talab qilinmaydi.

   Ish xaritalari (`/map`, boshqaruv paneli kartalari) avvalgidek Google
   ustida qoladi - u yerda plitkalar, ko'chalar va drill-down kerak.
   --------------------------------------------------------------------------- */

/** Legendadagi bitta qator. */
function LegendRow({ swatch, children }: { swatch: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-[11px] leading-3.5 text-[#9db3c7]">
      {swatch}
      {children}
    </p>
  );
}

export function PortalMap({ className }: { className?: string }) {
  return (
    <section
      className={cn(
        "portal-map-enter relative h-65 min-h-0 min-w-0 overflow-hidden rounded-2xl bg-[#151e28] sm:h-80 lg:h-auto",
        className,
      )}
      style={{ animationDelay: "60ms" }}
    >
      <p className="sr-only">
        Xarita: Andijon viloyati tumanlari chegarasi, har bir tuman o&rsquo;z
        rangida, Baliqchi tumani esa yorqin ajratib ko&rsquo;rsatilgan. Bu
        tasvir — bezak;
        yo&rsquo;nalishlar o&rsquo;ngdagi ro&rsquo;yxatda.
      </p>

      <DistrictMap className="absolute inset-0" />

      {/* Kontekst chipi. Telefonda pastda: panel past (260px) va yuqorida
          "Baliqchi" yorlig'i bilan to'qnashadi. */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl sm:top-3 sm:bottom-auto border border-white/12 bg-[#0e1620]/72 px-3.5 py-2.5 lg:top-4 lg:left-4">
        <p className="text-[11px] leading-3.5 font-medium tracking-widest text-[#8ea6bd] uppercase">
          Nazorat hududi
        </p>
        <p className="mt-1 text-sm leading-5 font-bold text-white">Baliqchi tumani</p>
        <p className="text-[11px] leading-4 text-[#9db3c7]">Andijon viloyati tarkibida</p>
      </div>

      {/* Legenda. */}
      <div className="pointer-events-none absolute top-3 right-3 hidden w-53 flex-col gap-1.5 rounded-xl border border-white/12 bg-[#0e1620]/72 px-3 py-2.5 sm:flex lg:top-4 lg:right-4">
        <p className="text-[11px] leading-3.5 font-medium tracking-widest text-[#8ea6bd] uppercase">
          Chegaralar
        </p>
        <LegendRow
          swatch={<span aria-hidden className="w-4 border-t border-dashed border-[#8fb0d0]" />}
        >
          Viloyat chegarasi
        </LegendRow>
        <LegendRow
          swatch={
            <span
              aria-hidden
              className="h-2 w-4 rounded-xs border border-[#c4d8ea]/55 bg-linear-to-r from-[#34d399]/60 via-[#f472b6]/60 to-[#a78bfa]/60"
            />
          }
        >
          Qo&rsquo;shni tumanlar
        </LegendRow>
        <LegendRow
          swatch={
            <span
              aria-hidden
              className="h-2 w-4 rounded-xs border border-white bg-[#c7e6f9] shadow-[0_0_6px_#7ec8f0]"
            />
          }
        >
          Baliqchi tumani
        </LegendRow>
        <span aria-hidden className="h-px bg-white/10" />
        <p className="text-[11px] leading-3.5 text-[#7f95aa]">
          Chegara ma&rsquo;lumotlari: OpenStreetMap (ODbL)
        </p>
      </div>
    </section>
  );
}
