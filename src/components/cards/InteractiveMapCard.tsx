"use client";

import { Expand, Info } from "lucide-react";

import { MapCanvas, type MapMarker, type MarkerRenderer } from "@/components/map/MapCanvas";
import { Card, CardBody, CardFooterLink, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { IconPill } from "@/components/ui/IconPill";
import { cn } from "@/lib/ui/cn";

/** Maketdagi xarita markazi - Xaqulobod fideri hududi. */
const CENTER = { lat: 40.8789, lng: 71.9792 };
const ZOOM = 14;

/** Yorliq ko'rsatiladigan (tanlangan) transformator. */
const SELECTED_ID = "tp-a303";

/**
 * Koordinatalar maketdagi piksel joylashuvidan hisoblangan: zoom 14 da
 * 1px ~ 0,00008583° uzunlik va ~0,00006490° kenglik (cos 40,88°).
 */
const MARKERS: MapMarker[] = [
  { id: "tp-a301", lat: 40.88481, lng: 71.96315, label: "TP A301" },
  { id: "tp-a302", lat: 40.8826, lng: 71.97723, label: "TP A302" },
  { id: SELECTED_ID, lat: 40.87734, lng: 71.96435, label: "TP A303" },
  { id: "tp-a304", lat: 40.88442, lng: 71.99199, label: "TP A304" },
  { id: "tp-a305", lat: 40.87183, lng: 71.9677, label: "TP A305" },
  { id: "tp-a306", lat: 40.87098, lng: 71.9792, label: "TP A306" },
];

/** `lucide-react/factory` ning path'lari - renderer JSX emas, HTML matn qaytaradi. */
const FACTORY_PATHS = [
  "M12 16h.01",
  "M16 16h.01",
  "M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z",
  "M8 16h.01",
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Maketdagi 1.5px absolyut chiziq: viewBox 24 bo'lgani uchun 36/size. */
function factorySvg(size: number, color: string): string {
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" ` +
    `stroke-width="${36 / size}" stroke-linecap="round" stroke-linejoin="round" ` +
    'style="display:block">' +
    FACTORY_PATHS.map((d) => `<path d="${d}"/>`).join("") +
    "</svg>"
  );
}

function chip(size: number, radius: number, glyph: number, color: string): string {
  return (
    `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;` +
    `justify-content:center;border-radius:${radius}px;background:#ffffff;` +
    'box-shadow:0 2px 6px rgba(0,0,0,.18);">' +
    factorySvg(glyph, color) +
    "</div>"
  );
}

/**
 * Maketdagi marker: oq yumaloq kvadrat (26px) ichida transformator glifi.
 * Tanlangani kattaroq (40px) va tepasida qora yorliq + strelka.
 */
const chipMarker: MarkerRenderer = (marker, selected) => {
  if (!selected) return chip(26, 7, 18, "#333333");

  return (
    '<div style="display:flex;flex-direction:column;align-items:center;">' +
    '<div style="background:rgba(15,15,20,.88);color:#fff;padding:6px 10px;border-radius:8px;' +
    "font-family:var(--font-geist-sans),system-ui,sans-serif;font-size:11px;font-weight:500;" +
    'line-height:13px;white-space:nowrap;">' +
    escapeHtml(marker.label) +
    "</div>" +
    '<svg width="12" height="6" viewBox="0 0 12 6" style="display:block">' +
    '<path d="M0 0L6 6L12 0H0Z" fill="#0F0F14" fill-opacity="0.88"/></svg>' +
    `<div style="margin-top:11px">${chip(40, 8, 24, "#ff383c")}</div>` +
    "</div>"
  );
};

/**
 * "Interaktiv ko'rinish" kartasi (Figma `4060:1285`, 487x336).
 *
 * Xarita ustidagi tultip maketda statik: o'ngdan 12px, pastdan 14px,
 * eni 215px, ichki bo'shliq 10px.
 *
 * Pastki ichki bo'shliq maketda 8px (yuqorisi 16): 16 + 32 + 8 + 248 + 8 + 16
 * + 8 = 336. Sarlavha rangi bu kartada `#000000` - `ink` (#333333) emas
 * (o'lchangan; qo'shni "Qarzdorlik"/"Yo'qotish" kartalarida esa #333333).
 */
export function InteractiveMapCard({ className }: { className?: string }) {
  return (
    <Card className={cn("pb-2", className)}>
      <CardHeader title="Interaktiv ko&rsquo;rinish" titleClassName="text-black">
        <IconPill icon={Expand} label="Kengaytirish" href="/map" />
      </CardHeader>
      <CardBody>
        <div className="relative min-h-0 flex-1">
          <MapCanvas
            markers={MARKERS}
            center={CENTER}
            zoom={ZOOM}
            fitDistrict
            selectedId={SELECTED_ID}
            compactFallback
            renderMarker={chipMarker}
            className="h-full w-full rounded-sm"
          />
          <div className="absolute right-3 bottom-3.5 w-[215px] rounded-lg bg-surface p-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.12)]">
            <p className="text-xs leading-4 font-semibold text-ink">
              Yuqori sarfga ega transformator
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-accent-red" />
              <span className="text-[10px] leading-[13px] font-medium text-[#999999]">
                TP A303
              </span>
            </div>
            {/* Maketda kulrang qism 10px, faqat qiymat 12px bold; qator qutisi 16px. */}
            <p className="mt-2 text-[10px] leading-4 text-[#999999]">
              Bu oygi iste&rsquo;mol:{" "}
              <span className="text-xs font-bold text-ink">51,5</span> ming kWh
            </p>
            {/* Ogohlantirish bloki: maketda tokeni yo'q - aniq hex (#f59e0b / #fefaf2) */}
            <div className="mt-2 flex items-start gap-1 rounded-md bg-[#fefaf2] p-1 pb-[7px] text-[#f59e0b]">
              <Icon icon={Info} size={12} className="shrink-0" />
              <p className="w-[167px] text-[10px] leading-[13px]">
                Ushbu transformator o&rsquo;tgan oyga nisbatan{" "}
                <span className="font-bold">20,1</span> ming kWh ga ko&rsquo;p energiya
                iste&rsquo;mol qilmoqda.
              </p>
            </div>
          </div>
        </div>
      </CardBody>
      <CardFooterLink href="/map">Asosiy xaritani ochish</CardFooterLink>
    </Card>
  );
}
