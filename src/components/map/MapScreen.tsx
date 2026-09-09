"use client";

import { useState } from "react";

import { AppShell } from "@/components/shell/AppShell";

import { defaultNodeId, findNode, findParent, mapRoot } from "./data";
import { MapCanvas, type MapMarker } from "./MapCanvas";
import { MapInfoPanel } from "./MapInfoPanel";
import { MapSidebar } from "./MapSidebar";

/**
 * Xarita sahifasi: chapda ierarxiya bo'yicha yurish (drill-down), o'rtada
 * Google xaritasi, o'ngda joriy tugun ma'lumotlari.
 */
export function MapScreen() {
  const [currentId, setCurrentId] = useState<string>(defaultNodeId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const current = findNode(currentId) ?? mapRoot;
  const parent = findParent(current.id);
  const children = current.children ?? [];

  // Bolalari bo'lmasa (abonent) - tugunning o'zi marker sifatida ko'rsatiladi.
  const source = children.length > 0 ? children : [current];
  const markers: MapMarker[] = source.map((node) => ({
    id: node.id,
    lat: node.lat,
    lng: node.lng,
    label: node.label,
  }));

  // Ro'yxatdan yoki markerdan pastga tushilganda tanlov tozalanadi.
  function handleNavigate(id: string) {
    setCurrentId(id);
    setSelectedId(null);
  }

  return (
    <AppShell
      sidebar={
        <MapSidebar
          current={current}
          parent={parent}
          onNavigate={handleNavigate}
          selectedId={selectedId}
        />
      }
    >
      <div className="flex h-full min-h-0 gap-2">
        <MapCanvas
          markers={markers}
          center={{ lat: current.lat, lng: current.lng }}
          zoom={current.zoom}
          selectedId={selectedId}
          onSelect={setSelectedId}
          className="h-full flex-1 rounded-2xl"
        />
        <MapInfoPanel node={current.info} />
      </div>
    </AppShell>
  );
}
