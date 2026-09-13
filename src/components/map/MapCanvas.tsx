"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Google Maps JavaScript API ustidagi yupqa qatlam. Markerlar - Figma
// maketidagi ko'rinish: qora yorliq + ostida ko'k igna (public/map/pin.svg).
// Google'ning standart markerlari ishlatilmaydi, chunki maketdagi yorliq
// shakli InfoWindow bilan mos kelmaydi.

import { useEffect, useRef, useState } from "react";
import { Map as MapGlyph } from "lucide-react";

import { BALIQCHI_DISTRICT } from "@/lib/geo/boundaries";
import { NEIGHBOUR_DISTRICTS } from "@/lib/geo/districts";
import { toPath } from "@/lib/geo/rings";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Chizuvchiga (`renderMarker`) beriladigan tur: "substation", "tp" va h.k. */
  kind?: string;
}

/** Xarita ustidagi tarmoq liniyasi (110 kV, 10 kV, feeder). */
export interface MapPolyline {
  id: string;
  path: ReadonlyArray<{ lat: number; lng: number }>;
  color: string;
  width: number;
  /** Uzuq chiziq - Google'da alohida "icons" bilan chiziladi. */
  dashed?: boolean;
}

/** Doiraviy zona (masalan yo'qotishlar o'chog'i). */
export interface MapCircle {
  id: string;
  center: { lat: number; lng: number };
  /** Radius - METRDA (Google shuni kutadi, piksel emas). */
  radius: number;
  color: string;
}

export type MapTypeId = "hybrid" | "roadmap" | "satellite";

export type MarkerRenderer = (marker: MapMarker, selected: boolean) => string;

/** Standart bo'sh ro'yxatlar - har renderda yangi massiv yaratilmasin. */
const NO_POLYLINES: readonly MapPolyline[] = [];
const NO_CIRCLES: readonly MapCircle[] = [];

/**
 * Uzuq chiziq Google Maps'da `strokeOpacity: 0` va takrorlanuvchi "icons"
 * orqali chiziladi - `strokeDasharray` ga to'g'ridan-to'g'ri mos kelmaydi.
 */
function polylineOptions(line: MapPolyline): any {
  const base = { path: line.path.map((point) => ({ ...point })), clickable: false };
  if (!line.dashed) {
    return {
      ...base,
      strokeColor: line.color,
      strokeWeight: line.width,
      strokeOpacity: 0.95,
    };
  }
  return {
    ...base,
    strokeColor: line.color,
    strokeOpacity: 0,
    icons: [
      {
        icon: {
          path: "M 0,-1 0,1",
          strokeColor: line.color,
          strokeOpacity: 0.95,
          strokeWeight: line.width,
          scale: 2,
        },
        offset: "0",
        repeat: "10px",
      },
    ],
  };
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

/** Figma maketidagi ochiq "roadmap" uslubi. */
export const MAP_STYLE: any[] = [
  { elementType: "geometry", stylers: [{ color: "#f4f2ed" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8f8f8f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }, { weight: 3 }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.neighborhood", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#e3e9d5" }, { visibility: "on" }],
  },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#eeece6" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "road.local", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#f7d979" }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#ecc85e" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#f5cd5f" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e6b94c" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#c4dcef" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9db6cc" }] },
];

let loaderPromise: Promise<void> | null = null;

function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const callbackName = "__electricityInitGmap";
    (window as any)[callbackName] = () => resolve();
    const script = document.createElement("script");
    const src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(key) +
      "&v=weekly&loading=async&callback=" +
      callbackName;
    script.src = src;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps yuklanmadi"));
    document.head.appendChild(script);
  });

  return loaderPromise;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Standart marker: qora yorliq, uchburchak strelka va ko'k igna. */
export const pinMarker: MarkerRenderer = (marker, selected) =>
  [
    '<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">',
    '<div style="display:flex;align-items:center;justify-content:center;background:rgba(15,15,20,.88);',
    "color:#fff;font-family:var(--font-geist-sans),system-ui,sans-serif;font-size:11px;font-weight:500;",
    'line-height:1.2;padding:6px 10px;border-radius:8px;white-space:nowrap;">',
    escapeHtml(marker.label),
    "</div>",
    '<svg width="12" height="6" viewBox="0 0 12 6" style="display:block;">',
    '<path d="M0 0L6 6L12 0H0Z" fill="#0F0F14" fill-opacity="0.88"/></svg>',
    '<img src="/map/pin.svg" width="27" height="41" alt="" style="display:block;margin-top:11px;',
    selected ? "filter:drop-shadow(0 0 6px rgba(0,124,210,.6));" : "",
    '" />',
    "</div>",
  ].join("");

interface MapCanvasProps {
  markers: MapMarker[];
  center: { lat: number; lng: number };
  zoom: number;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  renderMarker?: MarkerRenderer;
  /** Tarmoq liniyalari - markerlar ostida chiziladi. */
  polylines?: readonly MapPolyline[];
  /** Doiraviy zonalar - eng pastki qatlam. */
  circles?: readonly MapCircle[];
  /** Asosiy qatlam turi; standart - uslublangan "roadmap". */
  mapTypeId?: MapTypeId;
  /**
   * Qiymati o'zgarganda ko'rinish `center`/`zoom` ga qaytariladi.
   * Foydalanuvchi xaritani surganidan keyin "boshlang'ich holat" tugmasi
   * ishlashi uchun kerak: `center` o'zgarmagani uchun effekt o'z-o'zidan
   * qayta ishga tushmaydi.
   */
  recenterKey?: number;
  className?: string;
  /** Kichik kartalarda qisqaroq xato matni ko'rsatiladi. */
  compactFallback?: boolean;
  /**
   * Baliqchi tumani chegarasini chizish. Standart - yoqilgan: platformadagi
   * barcha interaktiv xaritalar nazorat hududini ko'rsatishi kerak.
   */
  district?: boolean;
  /**
   * Ko'rinishni `center`/`zoom` o'rniga tuman chegarasiga moslaydi -
   * butun Baliqchi tumani kadrga sig'adi.
   */
  fitDistrict?: boolean;
  /** `fitDistrict` uchun piksel to'ldirma. */
  fitPadding?: number;
}

export function MapCanvas({
  markers,
  center,
  zoom,
  selectedId = null,
  onSelect,
  renderMarker = pinMarker,
  polylines = NO_POLYLINES,
  circles = NO_CIRCLES,
  mapTypeId = "roadmap",
  recenterKey = 0,
  className,
  compactFallback = false,
  district = true,
  fitDistrict = false,
  fitPadding = 12,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<Record<string, { overlay: any; el: HTMLElement }>>({});
  /** Polyline/Circle obyektlari - qayta chizishdan oldin tozalanadi. */
  const shapesRef = useRef<any[]>([]);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const renderRef = useRef(renderMarker);
  renderRef.current = renderMarker;

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    API_KEY ? "loading" : "idle",
  );

  // `kind` ham ko'rinishga ta'sir qiladi, shuning uchun kalit butun
  // obyektdan olinadi (markerlar soni kam - narxi sezilmaydi).
  const markersKey = JSON.stringify(markers);
  const polylinesKey = JSON.stringify(polylines);
  const circlesKey = JSON.stringify(circles);

  useEffect(() => {
    if (!API_KEY) return;
    (window as any).gm_authFailure = () => setStatus("error");
  }, []);

  useEffect(() => {
    if (!API_KEY) return;
    let cancelled = false;
    loadGoogleMaps(API_KEY)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const g = (window as any).google;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center,
          zoom,
          mapTypeId,
          disableDefaultUI: true,
          clickableIcons: false,
          // Uslub faqat "roadmap" ga tegishli - sun'iy yo'ldosh qatlamida
          // Google uni baribir e'tiborsiz qoldiradi.
          styles: mapTypeId === "roadmap" ? MAP_STYLE : null,
          backgroundColor: "#f4f2ed",
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marker to'plami o'zgarsa - qayta chizish.
  useEffect(() => {
    if (status !== "ready") return;
    const g = (window as any).google;
    const map = mapRef.current;
    if (!g || !map) return;

    Object.values(overlaysRef.current).forEach(({ overlay }) => overlay.setMap(null));
    overlaysRef.current = {};

    class HtmlMarker extends g.maps.OverlayView {
      position: any;
      el: HTMLElement;
      constructor(position: any, el: HTMLElement) {
        super();
        this.position = position;
        this.el = el;
      }
      onAdd() {
        this.getPanes().overlayMouseTarget.appendChild(this.el);
      }
      draw() {
        const point = this.getProjection()?.fromLatLngToDivPixel(this.position);
        if (point) {
          this.el.style.left = point.x + "px";
          this.el.style.top = point.y + "px";
        }
      }
      onRemove() {
        this.el.remove();
      }
    }

    markers.forEach((marker) => {
      const el = document.createElement("div");
      el.style.position = "absolute";
      el.style.transform = "translate(-50%, -100%)";
      el.style.cursor = onSelectRef.current ? "pointer" : "default";
      el.style.zIndex = marker.id === selectedId ? "999" : "1";
      el.innerHTML = renderRef.current(marker, marker.id === selectedId);
      el.addEventListener("click", () => onSelectRef.current?.(marker.id));
      const overlay = new HtmlMarker(new g.maps.LatLng(marker.lat, marker.lng), el);
      overlay.setMap(map);
      overlaysRef.current[marker.id] = { overlay, el };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, markersKey]);

  // Tanlov o'zgarsa - faqat ko'rinishni yangilash.
  useEffect(() => {
    if (status !== "ready") return;
    Object.entries(overlaysRef.current).forEach(([id, { el }]) => {
      const marker = markers.find((m) => m.id === id);
      if (!marker) return;
      el.style.zIndex = id === selectedId ? "999" : "1";
      el.innerHTML = renderRef.current(marker, id === selectedId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, selectedId]);

  // Qatlam turi o'zgarsa - uslubni ham birga almashtirish kerak.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    mapRef.current.setOptions({
      mapTypeId,
      styles: mapTypeId === "roadmap" ? MAP_STYLE : null,
    });
  }, [status, mapTypeId]);

  // Liniyalar va zonalar. Markerlar HTML qatlamida (`overlayMouseTarget`)
  // chizilgani uchun bu geometriya doim ularning ostida qoladi.
  useEffect(() => {
    if (status !== "ready") return;
    const g = (window as any).google;
    const map = mapRef.current;
    if (!g || !map) return;

    shapesRef.current.forEach((shape) => shape.setMap(null));
    shapesRef.current = [];

    // Baliqchi tumani chegarasi - platformadagi HAR BIR interaktiv xaritada
    // ko'rinadi (nazorat hududi doim bir xil). Eng pastki qatlamda va
    // bosilmaydigan, aks holda markerlarni to'sib qo'yardi.
    if (district) {
      // Qo'shni tumanlar - kontekst: ingichka, to'ldirmasiz kontur.
      NEIGHBOUR_DISTRICTS.forEach((neighbour) => {
        neighbour.rings.forEach((ring) => {
          shapesRef.current.push(
            new g.maps.Polygon({
              map,
              paths: toPath(ring),
              fillOpacity: 0,
              strokeColor: "#6b7480",
              strokeOpacity: 0.5,
              strokeWeight: 1,
              clickable: false,
              geodesic: false,
              zIndex: 0,
            }),
          );
        });
      });

      // Baliqchi - faol hudud, shuning uchun to'ldirma va quyuqroq kontur.
      BALIQCHI_DISTRICT.rings.forEach((ring) => {
        shapesRef.current.push(
          new g.maps.Polygon({
            map,
            paths: toPath(ring),
            fillColor: "#007cd2",
            fillOpacity: 0.05,
            strokeColor: "#007cd2",
            strokeOpacity: 0.9,
            strokeWeight: 2,
            clickable: false,
            geodesic: false,
            zIndex: 1,
          }),
        );
      });
    }

    circles.forEach((circle) => {
      shapesRef.current.push(
        new g.maps.Circle({
          map,
          center: { ...circle.center },
          radius: circle.radius,
          fillColor: circle.color,
          fillOpacity: 0.18,
          strokeColor: circle.color,
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          clickable: false,
        }),
      );
    });

    polylines.forEach((line) => {
      shapesRef.current.push(new g.maps.Polyline({ ...polylineOptions(line), map }));
    });

    return () => {
      shapesRef.current.forEach((shape) => shape.setMap(null));
      shapesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, polylinesKey, circlesKey, district]);

  // Markaz/zoom o'zgarsa - silliq o'tish.
  useEffect(() => {
    if (status !== "ready" || !mapRef.current) return;
    if (fitDistrict) {
      const g = (window as any).google;
      const bounds = new g.maps.LatLngBounds();
      BALIQCHI_DISTRICT.rings.forEach((ring) => {
        ring.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
      });
      mapRef.current.fitBounds(bounds, fitPadding);
      return;
    }
    mapRef.current.panTo(center);
    mapRef.current.setZoom(zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, center.lat, center.lng, zoom, recenterKey, fitDistrict, fitPadding]);

  if (!API_KEY || status === "error") {
    return (
      <div
        className={
          "relative flex flex-col items-center justify-center gap-2 overflow-hidden bg-[#eef0f3] " +
          (className ?? "")
        }
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(#dcdfe4_1px,transparent_1px),linear-gradient(90deg,#dcdfe4_1px,transparent_1px)] [background-size:48px_48px]"
        />
        <span className="relative flex size-10 items-center justify-center rounded-xl bg-white text-brand">
          <MapGlyph className="size-5" strokeWidth={1.8} />
        </span>
        <p className="relative px-4 text-center text-xs text-ink-muted">
          {compactFallback
            ? "Xarita kaliti sozlanmagan"
            : "Google Maps kaliti sozlanmagan (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)"}
        </p>
      </div>
    );
  }

  return (
    <div className={"relative overflow-hidden bg-[#f4f2ed] " + (className ?? "")}>
      <div ref={containerRef} className="size-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#eef0f3] text-xs text-ink-muted">
          Xarita yuklanmoqda…
        </div>
      )}
    </div>
  );
}
