"use client";

import { type ReactNode, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin as MapPinGlyph, MapPinOff } from "lucide-react";

import { AppShell } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

import { escapeHtml, MapCanvas, type MapMarker, type MarkerRenderer, pinMarker } from "./MapCanvas";
import { MapInfoPanel } from "./MapInfoPanel";
import { MapSidebar } from "./MapSidebar";
import type { MapPin, MapViewProps } from "./types";

/** Tugunning o'z markeri - `selectedId` sifatida ham beriladi (eng ustki qatlam). */
const CURRENT_ID = "current";

/** Bolalar shundan ko'p bo'lsa yorliqlar yashiriladi (nom sichqoncha ostida chiqadi). */
const LABEL_LIMIT = 10;

/** Bola markeri rangi - obyekt turi bo'yicha (`globals.css` tokenlari). */
const PIN_COLOR: Record<Exclude<MapPin["kind"], "current">, string> = {
  substation: "var(--color-brand)",
  transformer: "var(--color-accent-indigo)",
  subscriber: "var(--color-accent-green)",
};

/** Bola markeri: rangli nuqta, kerak bo'lsa ustida qora yorliq. */
function dotMarker(marker: MapMarker, labelled: boolean): string {
  const color = PIN_COLOR[marker.kind as keyof typeof PIN_COLOR] ?? "var(--color-brand)";
  const label = escapeHtml(marker.label);
  const dot =
    `<div title="${label}" style="width:14px;height:14px;border-radius:9999px;background:${color};` +
    'border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);"></div>';
  if (!labelled) return `<div style="transform:translateY(50%);">${dot}</div>`;
  return (
    '<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(7px);">' +
    '<div style="background:rgba(15,15,20,.88);color:#fff;padding:4px 8px;border-radius:6px;' +
    "font-family:var(--font-geist-sans),system-ui,sans-serif;font-size:11px;font-weight:500;" +
    `line-height:13px;white-space:nowrap;margin-bottom:4px;">${label}</div>` +
    dot +
    "</div>"
  );
}

/**
 * Xarita sahifasi: chapda ierarxiya bo'yicha yurish (drill-down), o'rtada
 * Google xaritasi, o'ngda joriy tugun ma'lumotlari. Ma'lumot serverda
 * tanlangan oy va `?node=` bo'yicha yuklanadi - bu komponent faqat chizadi
 * va havolalar / marker bosilishi orqali boshqa tugunga o'tadi.
 */
export function MapScreen({ view, periodSelect }: { view: MapViewProps; periodSelect: ReactNode }) {
  const router = useRouter();
  const [navigating, startTransition] = useTransition();

  const children = view.pins.filter((pin) => pin.kind !== "current");
  const labelled = children.length <= LABEL_LIMIT;
  const markers: MapMarker[] = view.pins.map((pin) => ({
    id: pin.kind === "current" ? CURRENT_ID : pin.id,
    lat: pin.lat,
    lng: pin.lng,
    label: pin.label,
    kind: pin.kind,
  }));
  const hrefs = new Map(view.pins.map((pin) => [pin.id, pin.href]));

  const renderMarker: MarkerRenderer = (marker, selected) =>
    marker.kind === "current" ? pinMarker(marker, selected) : dotMarker(marker, labelled);

  function handleSelect(id: string) {
    const href = hrefs.get(id);
    if (!href) return;
    startTransition(() => router.push(href));
  }

  return (
    <AppShell
      sidebar={
        <MapSidebar
          current={view.current}
          parent={view.parent}
          items={view.children}
          periodSelect={periodSelect}
        />
      }
    >
      <div className="flex h-full min-h-0 gap-2">
        <div className="relative h-full min-w-0 flex-1">
          <MapCanvas
            markers={markers}
            fitMarkers
            fitPadding={64}
            selectedId={CURRENT_ID}
            onSelect={handleSelect}
            renderMarker={renderMarker}
            className={cn("h-full w-full rounded-2xl transition-opacity", navigating && "opacity-70")}
          />

          {view.mapNote ? (
            <div className="pointer-events-none absolute top-3 left-1/2 flex max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1.5 rounded-lg bg-surface/95 px-3 py-1.5 text-xs font-medium text-ink-muted shadow-[0_2px_12px_rgba(0,0,0,0.12)]">
              <Icon icon={view.mapNote.missing ? MapPinOff : MapPinGlyph} size={16} className="shrink-0 text-brand" />
              <span className="truncate">{view.mapNote.text}</span>
            </div>
          ) : null}
        </div>
        <MapInfoPanel key={view.nodeKey} info={view.info} className={cn("transition-opacity", navigating && "opacity-70")} />
      </div>
    </AppShell>
  );
}
