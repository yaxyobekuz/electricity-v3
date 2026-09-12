"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
// Portal ekranidagi qulflangan, dekorativ xarita. `MapCanvas` kengaytirilmadi:
// u marker drill-down uchun qurilgan (har renderda `JSON.stringify` solishtirish,
// `panTo` recenter, `overlayMouseTarget` panellari) va poligon, `fitBounds`
// hamda `ResizeObserver` mantig'i unda umuman yo'q.

import { useEffect, useRef, useState } from "react";

import { MAP_STYLE } from "@/components/map/MapCanvas";
import { ANDIJON_REGION, BALIQCHI_DISTRICT } from "@/lib/geo/boundaries";
import { simplifyPoints, pointsToPath } from "@/lib/geo/project";
import { growBbox, MASK_RECT, orient, toPath } from "@/lib/geo/rings";
import { loadGoogleMaps, onAuthFailure } from "@/lib/maps/loader";
import { cn } from "@/lib/ui/cn";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();

/** `BoundaryFigure` bilan bir xil kadr - almashganda tuman sakramaydi. */
const FRAME = growBbox(BALIQCHI_DISTRICT.bbox, 0.6);

/** Tepada kontekst chipi, pastda Google logotipi uchun joy. */
const FIT_PADDING = { top: 88, right: 24, bottom: 32, left: 24 };

/** Tuman markazi - yorliq shu nuqtaga bog'lanadi. */
const LABEL_POINT = { lat: 40.85315, lng: 71.94708 };

/** Jim osilib qolgan yuklanishni (proksi 200 + bo'sh tana) ushlash uchun. */
const WATCHDOG_MS = 8000;

/**
 * Maketning ochiq uslubi ustiga to'rtta tuzatish. Oxirgi styler g'olib
 * bo'lgani uchun bular `MAP_STYLE` dan keyin turadi.
 */
const PORTAL_MAP_STYLE: any[] = [
  ...MAP_STYLE,
  // Baland ovozli sariq magistrallar tanlov ekranida axborot emas, tekstura.
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  // Aholi punktlari nomlari qoladi - tumanni o'qishli qiladigan narsa shu.
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8d96a3" }],
  },
  // Suv oqargan qog'oz kabi - brend ko'ki bilan raqobatlashmasin.
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#dce8f2" }] },
];

interface BoundaryMapProps {
  /** Xarita birinchi marta chizilganda - ota komponent uni ochadi. */
  onReady?: () => void;
  /** Kalit rad etildi yoki skript yuklanmadi - ota komponent zaxiraga qaytadi. */
  onFail?: () => void;
  className?: string;
}

export function BoundaryMap({ onReady, onFail, className }: BoundaryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  /** Oxirgi chizilgan `d` - bir xil bo'lsa `setState` chaqirilmaydi. */
  const lastPathRef = useRef<string>("");
  /** Yorliqning oxirgi piksel joylashuvi - xuddi shu maqsadda. */
  const lastLabelRef = useRef<{ x: number; y: number } | null>(null);

  const [districtPath, setDistrictPath] = useState<string>("");
  const [label, setLabel] = useState<{ x: number; y: number } | null>(null);
  /**
   * So'nib chiqish holati ATAYLAB shu komponentda: ota komponentda bo'lsa,
   * ekran kengligi 640px dan o'tib-qaytganda eski "tayyor" qiymati saqlanib
   * qolib, yangi (hali chizilmagan) xarita to'liq shaffofsizlikda paydo
   * bo'lardi.
   */
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!API_KEY) {
      onFailRef.current?.();
      return;
    }

    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    const shapes: any[] = [];
    let overlay: any = null;
    let map: any = null;

    const fail = () => {
      if (cancelled) return;
      cancelled = true;
      onFailRef.current?.();
    };

    const unsubscribe = onAuthFailure(fail);
    const watchdog = setTimeout(fail, WATCHDOG_MS);

    loadGoogleMaps(API_KEY)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        clearTimeout(watchdog);

        const g = (window as any).google;
        const el = containerRef.current;

        map = new g.maps.Map(el, {
          mapTypeId: "roadmap",
          // `mapId` QO'SHILMAYDI: u bo'lsa vektor render ishga tushadi va
          // `styles` jimgina e'tiborsiz qoldiriladi - butun ochiq mavzu ketadi.
          styles: PORTAL_MAP_STYLE,
          backgroundColor: "#f4f2ed",
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "none",
          keyboardShortcuts: false,
          disableDoubleClickZoom: true,
          scrollwheel: false,
          // Rastr xaritalarda standart `false`, u holda `fitBounds` zoomni
          // butun songa pastga yaxlitlaydi va kadr bo'sh qoladi.
          isFractionalZoomEnabled: true,
        });

        const bounds = new g.maps.LatLngBounds(
          { lat: FRAME[1], lng: FRAME[0] },
          { lat: FRAME[3], lng: FRAME[2] },
        );

        const region = ANDIJON_REGION.rings[0];
        const district = BALIQCHI_DISTRICT.rings[0];

        // Teshik tashqi konturga TESKARI yo'nalishda bo'lishi shart - shunda
        // teshik nonzero va even-odd qoidalarining ikkalasida ham ochiladi.
        // Wash poligonlarida `strokeWeight: 0`, chunki Google `paths` dagi
        // HAR BIR halqani, teshiklarni ham chizib qo'yadi.
        shapes.push(
          new g.maps.Polygon({
            map,
            paths: [toPath(orient(MASK_RECT, false)), toPath(orient(region, true))],
            fillColor: "#e7ebf0",
            fillOpacity: 0.86,
            strokeWeight: 0,
            clickable: false,
            geodesic: false,
            zIndex: 10,
          }),
          new g.maps.Polygon({
            map,
            paths: [toPath(orient(region, false)), toPath(orient(district, true))],
            fillColor: "#f3f3f3",
            fillOpacity: 0.42,
            strokeWeight: 0,
            clickable: false,
            geodesic: false,
            zIndex: 20,
          }),
          // Uzuq = kontekst. `Polygon` da uzuq chiziq yo'q, shuning uchun
          // repo'ning mavjud usuli: `strokeOpacity: 0` + takroriy "icons".
          new g.maps.Polyline({
            map,
            path: toPath(region),
            strokeOpacity: 0,
            clickable: false,
            geodesic: false,
            zIndex: 30,
            icons: [
              {
                icon: {
                  path: "M 0,-1 0,1",
                  strokeColor: "#6b7480",
                  strokeOpacity: 0.9,
                  strokeWeight: 1.4,
                  scale: 2,
                },
                offset: "0",
                repeat: "11px",
              },
            ],
          }),
          new g.maps.Polygon({
            map,
            paths: [toPath(district)],
            // Tuman och ko'k bilan belgilanadi - kontur bilan bir oilada.
            fillColor: "#007cd2",
            fillOpacity: 0.18,
            strokeWeight: 0,
            clickable: false,
            geodesic: false,
            zIndex: 40,
          }),
        );

        // OverlayView faqat PROYEKSIYA ORAKULI sifatida: hech narsa
        // qo'shmaydi, faqat tuman halqasini konteyner pikseliga o'tkazadi.
        // Urg'u (halo, kontur, sweep) qardosh SVG'da, CSS bilan chiziladi.
        class ProjectionProbe extends g.maps.OverlayView {
          onAdd() {}
          onRemove() {}
          draw() {
            const projection = this.getProjection();
            if (!projection) return;

            const points = district.map((point) => {
              const pixel = projection.fromLatLngToContainerPixel(
                new g.maps.LatLng(point[1], point[0]),
              );
              return [pixel.x, pixel.y] as const;
            });
            const next = pointsToPath(simplifyPoints(points, 2));
            // `draw()` har viewport o'zgarishida chaqiriladi - o'zgarmagan
            // yo'l uchun render halqasini boshlamaymiz.
            if (next !== lastPathRef.current) {
              lastPathRef.current = next;
              setDistrictPath(next);
            }

            // Yorliq ham xuddi shunday himoyalanadi: har `draw()` da yangi
            // obyekt yozilsa, yuqoridagi tekshiruv ma'nosini yo'qotardi va
            // xarita har qimirlaganda qayta render boshlanardi.
            const center = projection.fromLatLngToContainerPixel(
              new g.maps.LatLng(LABEL_POINT.lat, LABEL_POINT.lng),
            );
            const x = Math.round(center.x);
            const y = Math.round(center.y);
            const last = lastLabelRef.current;
            if (!last || last.x !== x || last.y !== y) {
              lastLabelRef.current = { x, y };
              setLabel({ x, y });
            }
          }
        }

        overlay = new ProjectionProbe();
        overlay.setMap(map);

        g.maps.event.addListenerOnce(map, "idle", () => {
          if (cancelled) return;
          setReady(true);
          onReadyRef.current?.();
        });

        map.fitBounds(bounds, FIT_PADDING);

        // Zamonaviy Maps JS o'lcham o'zgarishini o'zi sezadi, lekin markaz va
        // zoomni saqlaydi - SIG'DIRISHNI emas. Shuning uchun qayta sig'diramiz.
        observer = new ResizeObserver(() => {
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => {
            // 0x0 konteynerga `fitBounds` chaqirilsa zoom 0 (butun dunyo)
            // chiqadi; flex kataklarida birinchi tick'da bu haqiqatan bo'ladi.
            if (el.clientWidth < 2 || el.clientHeight < 2) return;
            map.fitBounds(bounds, FIT_PADDING);
          });
        });
        observer.observe(el);
      })
      .catch(fail);

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
      unsubscribe();
      cancelAnimationFrame(frame);
      observer?.disconnect();
      overlay?.setMap(null);
      shapes.forEach((shape) => shape.setMap(null));
      // Google o'z tinglovchilarini o'zi tozalamaydi: ular xarita
      // nusxasiga bog'lanib qoladi va komponent qayta mount qilinsa
      // to'planib boradi.
      const gm = (window as any).google?.maps;
      if (gm && map) gm.event.clearInstanceListeners(map);
      if (gm && overlay) gm.event.clearInstanceListeners(overlay);
    };
  }, []);

  return (
    <div
      className={cn(
        "transition-opacity duration-[400ms]",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
    >
      {/* Google'ning o'z logotipi va Terms havolasi ishlashi kerak (ToS),
          shuning uchun bu o'ramda `pointer-events-none` YO'Q. */}
      <div ref={containerRef} className="size-full" />

      {districtPath ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full overflow-visible"
        >
          <path
            d={districtPath}
            fill="none"
            stroke="#007cd2"
            strokeWidth={11}
            strokeLinejoin="round"
            className="portal-halo"
          />
          <path
            d={districtPath}
            fill="none"
            stroke="#007cd2"
            strokeWidth={2.25}
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            className="portal-outline"
          />
          <path
            d={districtPath}
            fill="none"
            stroke="#007cd2"
            strokeWidth={2.25}
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray="0.04 0.06"
            className="portal-sweep"
          />
        </svg>
      ) : null}

      {label ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute flex -translate-x-1/2 flex-col items-center"
          style={{ left: label.x, top: label.y - 40 }}
        >
          <span className="rounded-lg bg-[#1c1c22] px-2 py-1 text-[11px] leading-3.5 font-medium text-white">
            Baliqchi tumani
          </span>
          <span className="h-4.5 w-px bg-[#1c1c22]/50" />
        </div>
      ) : null}
    </div>
  );
}
