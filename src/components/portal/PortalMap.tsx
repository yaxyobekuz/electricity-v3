"use client";

import { useState } from "react";

import { cn } from "@/lib/ui/cn";
import { useMediaQuery } from "@/lib/ui/useMediaQuery";

import { BoundaryFigure } from "./BoundaryFigure";
import { BoundaryMap } from "./BoundaryMap";

/* ---------------------------------------------------------------------------
   Xarita paneli. Uch qatlam:

     1. `BoundaryFigure` - sof SVG, doim eng ostida turadi;
     2. jonli Google xaritasi - tayyor bo'lganda ustidan so'nib chiqadi;
     3. HTML chiplar - kontekst va legenda.

   Shu tartib tufayli xarita hech qachon "buzuq" ko'rinmaydi: kalit yo'q
   bo'lsa ham, skript yuklanmasa ham ekranda to'liq chegara tasviri qoladi.
   --------------------------------------------------------------------------- */

/** Telefon ekranida jonli xarita umuman yuklanmaydi - faqat SVG. */
const LIVE_QUERY = "(min-width: 640px)";

type MapState = "loading" | "ready" | "failed";

export function PortalMap({ className }: { className?: string }) {
  // Serverda `false`, mount'da to'g'rilanadi. Oyna kengaytirilsa yoki
  // planshet aylantirilsa jonli xarita keyin ham yuklanadi.
  const wide = useMediaQuery(LIVE_QUERY);
  const [state, setState] = useState<MapState>("loading");

  const live = wide && state !== "failed";

  return (
    <section
      className={cn(
        "portal-map-enter relative h-[260px] min-h-0 min-w-0 overflow-hidden rounded-2xl bg-[#f4f2ed] sm:h-[320px] lg:h-auto",
        className,
      )}
      style={{ animationDelay: "60ms" }}
    >
      <p className="sr-only">
        Xarita: Andijon viloyati chegarasi ichida Baliqchi tumani ajratib
        ko&rsquo;rsatilgan. Bu tasvir — bezak; yo&rsquo;nalishlar
        o&rsquo;ngdagi ro&rsquo;yxatda.
      </p>

      <BoundaryFigure className="absolute inset-0" />

      {live ? (
        <BoundaryMap
          className="absolute inset-0"
          onReady={() => setState("ready")}
          onFail={() => setState("failed")}
        />
      ) : null}

      {/* Kontekst chipi. Pastdagi 28px chizig'i Google logotipi va Terms
          havolasi uchun bo'sh qoldiriladi - bu ToS talabi. */}
      <div className="pointer-events-none absolute top-3 left-3 rounded-xl border border-hairline bg-surface px-3.5 py-2.5 lg:top-4 lg:left-4">
        <p className="text-[11px] leading-[14px] font-medium tracking-[0.1em] text-ink-muted uppercase">
          Nazorat hududi
        </p>
        <p className="mt-1 text-sm leading-5 font-bold text-ink">Baliqchi tumani</p>
        <p className="text-[11px] leading-4 text-ink-muted">Andijon viloyati tarkibida</p>
      </div>

      <div className="pointer-events-none absolute top-3 right-3 hidden w-[200px] flex-col gap-1.5 rounded-xl border border-hairline bg-surface px-3 py-2.5 sm:flex lg:top-4 lg:right-4">
        <p className="text-[11px] leading-[14px] font-medium tracking-[0.1em] text-ink-muted uppercase">
          Chegaralar
        </p>
        <p className="flex items-center gap-2 text-[11px] leading-[14px] text-ink-muted">
          <span aria-hidden className="w-4 border-t border-dashed border-[#6b7480]" />
          Viloyat chegarasi
        </p>
        <p className="flex items-center gap-2 text-[11px] leading-[14px] text-ink-muted">
          <span aria-hidden className="w-4 border-t-2 border-brand" />
          Tuman chegarasi
        </p>
        <span aria-hidden className="h-px bg-hairline" />
        {state === "failed" ? (
          <p className="text-[11px] leading-[14px] text-ink-muted">
            Xarita xizmati ulanmagan — chegara sxematik ko&rsquo;rsatilmoqda
          </p>
        ) : null}
        <p className="text-[11px] leading-[14px] text-ink-muted">
          Chegara ma&rsquo;lumotlari: OpenStreetMap (ODbL) · Xarita: Google
        </p>
      </div>

      {live && state === "loading" ? (
        <p className="pointer-events-none absolute right-3 bottom-3 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[11px] leading-4 text-ink-muted lg:right-4">
          Xarita yuklanmoqda…
        </p>
      ) : null}
    </section>
  );
}
