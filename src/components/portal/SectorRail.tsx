import type { ReactNode } from "react";

import { cn } from "@/lib/ui/cn";

import { ContactShadow } from "./art/Plinth";
import { PylonAsset, PylonTag } from "./art/PylonAsset";
import { SphereAsset, SphereTag } from "./art/SphereAsset";
import { TowerAsset, TowerTag } from "./art/TowerAsset";
import { SectorPanel } from "./SectorPanel";
import { SECTOR_DELAYS, SECTORS, type SectorId } from "./sectors";

/* ---------------------------------------------------------------------------
   O'ng ustundagi uchta yo'nalish paneli.

   `display: contents` ISHLATILMAYDI - WebKit'da u ro'yxat semantikasini
   yo'qotadi, ya'ni ekran o'quvchi "3 elementli ro'yxat" deb e'lon qilmaydi.
   Shuning uchun `<ul>` ning o'zi grid, `<li>` esa haqiqiy grid elementi.
   --------------------------------------------------------------------------- */

const BODIES: Record<SectorId, ReactNode> = {
  power: <PylonAsset />,
  gas: <SphereAsset />,
  water: <TowerAsset />,
};

const TAGS: Record<SectorId, ReactNode> = {
  power: <PylonTag />,
  gas: <SphereTag />,
  water: <TowerTag />,
};

export function SectorRail({ className }: { className?: string }) {
  return (
    <nav
      id="portal-rail"
      aria-labelledby="portal-rail-title"
      className={cn("min-h-0 min-w-0", className)}
    >
      <h2 id="portal-rail-title" className="sr-only">
        Tarmoq yo&rsquo;nalishini tanlang
      </h2>
      <ul className="grid min-h-0 grid-cols-1 gap-2 lg:h-full lg:grid-rows-3">
        {SECTORS.map((sector, index) => (
          <SectorPanel
            key={sector.id}
            sector={sector}
            delay={SECTOR_DELAYS[index] ?? 140}
            art={
              <>
                <div className="absolute inset-0">
                  <ContactShadow tone={sector.id} />
                </div>
                <div className="absolute inset-0">{BODIES[sector.id]}</div>
              </>
            }
            tag={TAGS[sector.id]}
          />
        ))}
      </ul>
    </nav>
  );
}
