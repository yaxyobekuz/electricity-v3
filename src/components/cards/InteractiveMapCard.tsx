"use client";

import { Expand, Info, MapPinOff } from "lucide-react";
import type { ReactNode } from "react";

import { MapCanvas, type MapMarker, type MarkerRenderer } from "@/components/map/MapCanvas";
import { Card, CardBody, CardFooterLink, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { IconPill } from "@/components/ui/IconPill";
import { BALIQCHI_DISTRICT } from "@/lib/geo/boundaries";
import { cn } from "@/lib/ui/cn";

/** Tuman chegarasi (bbox) markazi - koordinata berilmaganda xarita shu yerda. */
const DISTRICT_CENTER = {
  lat: (BALIQCHI_DISTRICT.bbox[1] + BALIQCHI_DISTRICT.bbox[3]) / 2,
  lng: (BALIQCHI_DISTRICT.bbox[0] + BALIQCHI_DISTRICT.bbox[2]) / 2,
};
const DISTRICT_ZOOM = 11;

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

/** Xarita ustidagi tultip mazmuni - hammasi sahifadan (shablon qiymatlari). */
export interface MapTooltip {
  title: string;
  /** Obyekt nomi (rangli nuqta yonida). */
  label: string;
  /** Nuqta rangi, masalan `bg-accent-red`. */
  dot: string;
  /** Qiymat oldidagi izoh: "Bu oygi Foydali oqim". */
  caption: string;
  value: string;
  unit?: string;
  /** Pastdagi ogohlantirish matni; berilmasa blok chizilmaydi. */
  note?: ReactNode;
}

/**
 * "Interaktiv ko'rinish" kartasi (Figma `4060:1285`, 487x336).
 *
 * Xarita ustidagi tultip maketda statik: o'ngdan 12px, pastdan 14px,
 * eni 215px, ichki bo'shliq 10px. Tultip berilmasa chizilmaydi.
 *
 * Pastki ichki bo'shliq maketda 8px (yuqorisi 16): 16 + 32 + 8 + 248 + 8 + 16
 * + 8 = 336. Sarlavha rangi bu kartada `#000000` - `ink` (#333333) emas.
 *
 * Markerlar - shablondagi "Lokatsiya (Lat/Long)" bor obyektlar. Birortasida
 * ham koordinata bo'lmasa xarita butun tumanni ko'rsatadi va ustida
 * "Koordinatalar yuklanmagan" yozuvi turadi.
 */
export function InteractiveMapCard({
  markers,
  tooltip = null,
  tooltipBottom = 14,
  selectedId = null,
  fitDistrict = true,
  center,
  zoom,
  footerHref = "/map",
  footerLabel = "Asosiy xaritani ochish",
  className,
}: {
  /** Koordinatasi bor obyektlar; bo'sh bo'lishi mumkin. */
  markers: MapMarker[];
  tooltip?: MapTooltip | null;
  /** Tultipning xarita pastki chetidan masofasi, px. */
  tooltipBottom?: number;
  selectedId?: string | null;
  /** `true` - ko'rinish tuman chegarasiga moslanadi (`center`/`zoom` e'tiborsiz). */
  fitDistrict?: boolean;
  center?: { lat: number; lng: number };
  zoom?: number;
  footerHref?: string;
  footerLabel?: string;
  className?: string;
}) {
  const hasCoordinates = markers.length > 0;

  return (
    <Card className={cn("pb-2", className)}>
      <CardHeader title="Interaktiv ko&rsquo;rinish" titleClassName="text-black">
        <IconPill icon={Expand} label="Kengaytirish" href={footerHref} />
      </CardHeader>
      <CardBody>
        <div className="relative min-h-0 flex-1">
          <MapCanvas
            markers={markers}
            center={center ?? DISTRICT_CENTER}
            zoom={zoom ?? DISTRICT_ZOOM}
            fitDistrict={fitDistrict || !hasCoordinates}
            selectedId={selectedId}
            compactFallback
            renderMarker={chipMarker}
            className="h-full w-full rounded-sm"
          />

          {hasCoordinates ? null : (
            <div className="pointer-events-none absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-lg bg-surface/95 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-ink-muted shadow-[0_2px_12px_rgba(0,0,0,0.12)]">
              <Icon icon={MapPinOff} size={16} className="shrink-0 text-brand" />
              Koordinatalar yuklanmagan
            </div>
          )}

          {tooltip ? (
            <div
              style={{ bottom: tooltipBottom }}
              className="absolute right-3 w-[215px] rounded-lg bg-surface p-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
            >
              <p className="truncate text-xs leading-4 font-semibold text-ink">{tooltip.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn("size-2 shrink-0 rounded-full", tooltip.dot)} />
                <span className="truncate text-[10px] leading-[13px] font-medium text-[#999999]">
                  {tooltip.label}
                </span>
              </div>
              {/* Maketda kulrang qism 10px, faqat qiymat 12px bold; qator qutisi 16px. */}
              <p className="mt-2 text-[10px] leading-4 text-[#999999]">
                {tooltip.caption}:{" "}
                <span className="text-xs font-bold text-ink">{tooltip.value}</span>
                {tooltip.unit ? ` ${tooltip.unit}` : null}
              </p>
              {/* Ogohlantirish bloki: maketda tokeni yo'q - aniq hex (#f59e0b / #fefaf2) */}
              {tooltip.note ? (
                <div className="mt-2 flex items-start gap-1 rounded-md bg-[#fefaf2] p-1 pb-[7px] text-[#f59e0b]">
                  <Icon icon={Info} size={12} className="shrink-0" />
                  <p className="w-[167px] text-[10px] leading-[13px]">{tooltip.note}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardBody>
      <CardFooterLink href={footerHref}>{footerLabel}</CardFooterLink>
    </Card>
  );
}
