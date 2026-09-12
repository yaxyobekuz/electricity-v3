import { PortalHeader } from "./PortalHeader";
import { PortalMap } from "./PortalMap";
import { SectorRail } from "./SectorRail";

/**
 * Tarmoq yo'nalishini tanlash ekrani - ilovaning kirish nuqtasi (`/`).
 *
 * Maket: tepada sarlavha, chapda tuman xaritasi, o'ngda uchta yo'nalish
 * paneli. Telefonda ustunlar bir ustunga yig'iladi.
 */
export function PortalScreen() {
  return (
    <div className="portal-frame relative flex min-h-dvh w-full flex-col gap-2 bg-canvas p-2">
      <a href="#portal-rail" className="portal-skip">
        Tarmoq tanlashga o&rsquo;tish
      </a>

      <PortalHeader />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_clamp(340px,27vw,420px)]">
        <PortalMap />
        <SectorRail />
      </div>
    </div>
  );
}
