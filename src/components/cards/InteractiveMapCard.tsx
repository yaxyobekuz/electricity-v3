"use client";

import { Expand, Info, MapPinOff } from "lucide-react";
import type { ReactNode } from "react";

import { escapeHtml, MapCanvas, type MapMarker, type MarkerRenderer } from "@/components/map/MapCanvas";
import { markerObjectKind, objectChip } from "@/components/map/marker-glyphs";
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

/**
 * Maketdagi marker: oq yumaloq kvadrat (26px) ichida obyekt glifi - chap
 * paneldagi ikonka (kartalardagi markerlar TP, `kind: "tp"`). Tanlangani
 * kattaroq (40px) va tepasida qora yorliq + strelka.
 */
const chipMarker: MarkerRenderer = (marker, selected) => {
  const kind = markerObjectKind(marker.kind) ?? "transformer";
  if (!selected) return objectChip(kind, { size: 26, radius: 7, glyph: 18, color: "#333333" });

  return (
    '<div style="display:flex;flex-direction:column;align-items:center;">' +
    '<div style="background:rgba(15,15,20,.88);color:#fff;padding:6px 10px;border-radius:8px;' +
    "font-family:var(--font-geist-sans),system-ui,sans-serif;font-size:11px;font-weight:500;" +
    'line-height:13px;white-space:nowrap;">' +
    escapeHtml(marker.label) +
    "</div>" +
    '<svg width="12" height="6" viewBox="0 0 12 6" style="display:block">' +
    '<path d="M0 0L6 6L12 0H0Z" fill="#0F0F14" fill-opacity="0.88"/></svg>' +
    `<div style="margin-top:11px">${objectChip(kind, { size: 40, radius: 8, glyph: 24, color: "#ff383c" })}</div>` +
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
