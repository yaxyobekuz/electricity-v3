"use client";

import { Layers, Minus, Navigation, Plus } from "lucide-react";
import { useState } from "react";

import {
  MapCanvas,
  type MapCircle,
  type MapMarker,
  type MapPolyline,
  type MapTypeId,
  type MarkerRenderer,
} from "@/components/map/MapCanvas";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Geografiya

   Obyektlar hali bazadan kelmaydi, shuning uchun ularning o'rni maketdagi
   640x300 sxemadan olinadi va shu yerda haqiqiy koordinataga o'giriladi.
   Shunda sxemadagi tarmoq tuzilmasi saqlanadi, xarita esa Google Maps'ning
   o'zi bo'ladi (fider sahifasidagi `InteractiveMapCard` bilan bir xil qatlam).

   `SPAN` qiymatlari 12-masshtabda 640x300 nisbatini beradi: 0.2011 gradus
   uzunlik ~ 16.95 km, 0.0712 gradus kenglik ~ 7.90 km, ya'ni
   16.95 / 7.90 = 2.14 ~ 640 / 300.
   --------------------------------------------------------------------------- */

const VIEW = { width: 640, height: 300 } as const;
const CENTER = { lat: 40.8789, lng: 71.9792 } as const;
const SPAN = { lat: 0.0712, lng: 0.2011 } as const;

const DEFAULT_ZOOM = 12;
const ZOOM_MIN = 10;
const ZOOM_MAX = 15;

/** 40.88 kenglikda 1 gradus uzunlik ~ 84.3 km. */
const METERS_PER_LNG_DEGREE = 84_300;
const METERS_PER_UNIT = (SPAN.lng * METERS_PER_LNG_DEGREE) / VIEW.width;

function toLatLng(x: number, y: number): { lat: number; lng: number } {
  return {
    lat: CENTER.lat + ((VIEW.height / 2 - y) / VIEW.height) * SPAN.lat,
    lng: CENTER.lng + ((x - VIEW.width / 2) / VIEW.width) * SPAN.lng,
  };
}

/** "112,96 216,116" ko'rinishidagi sxema yo'lini koordinatalar zanjiriga. */
function toPath(points: string): Array<{ lat: number; lng: number }> {
  return points.split(" ").map((pair) => {
    const [x, y] = pair.split(",").map(Number);
    return toLatLng(x, y);
  });
}

/* ---------------------------------------------------------------------------
   Xarita ma'lumotlari (mock)
   --------------------------------------------------------------------------- */

type MarkerKind = "critical" | "ok" | "substation" | "warn";

interface DistrictObject {
  id: string;
  x: number;
  y: number;
  kind: MarkerKind;
  /** Marker bosilganda chiqadigan yorliq (va ekran o’quvchisi uchun nom). */
  label: string;
}

const OBJECTS: readonly DistrictObject[] = [
  // Podstansiyalar (110/35/10 kV tugunlari)
  { id: "ps-1", x: 112, y: 96, kind: "substation", label: "Baliqchi podstansiyasi" },
  { id: "ps-2", x: 330, y: 152, kind: "substation", label: "Markaz podstansiyasi" },
  { id: "ps-3", x: 520, y: 196, kind: "substation", label: "Fayzobod podstansiyasi" },

  // Kritik holatdagi transformatorlar
  { id: "tp-c1", x: 196, y: 216, kind: "critical", label: "TP-114 Sarnovul" },
  { id: "tp-c2", x: 412, y: 238, kind: "critical", label: "TP-207 Fayzobod" },
  { id: "tp-c3", x: 86, y: 176, kind: "critical", label: "TP-042 Qorako’l" },

  // Ogohlantirish holatidagi transformatorlar
  { id: "tp-w1", x: 152, y: 128, kind: "warn", label: "TP-051 Chinobod" },
  { id: "tp-w2", x: 262, y: 76, kind: "warn", label: "TP-063 Markaz" },
  { id: "tp-w3", x: 392, y: 108, kind: "warn", label: "TP-128 Chinobod" },
  { id: "tp-w4", x: 472, y: 252, kind: "warn", label: "TP-233 Fayzobod" },
  { id: "tp-w5", x: 596, y: 230, kind: "warn", label: "TP-286 Qorako’l" },

  // Sog'lom transformatorlar
  { id: "tp-1", x: 58, y: 116, kind: "ok", label: "TP-011 Qorako’l" },
  { id: "tp-2", x: 72, y: 244, kind: "ok", label: "TP-018 Qorako’l" },
  { id: "tp-3", x: 140, y: 62, kind: "ok", label: "TP-026 Sarnovul" },
  { id: "tp-4", x: 176, y: 172, kind: "ok", label: "TP-034 Sarnovul" },
  { id: "tp-5", x: 216, y: 116, kind: "ok", label: "TP-047 Markaz" },
  { id: "tp-6", x: 232, y: 250, kind: "ok", label: "TP-055 Sarnovul" },
  { id: "tp-7", x: 296, y: 52, kind: "ok", label: "TP-072 Chinobod" },
  { id: "tp-8", x: 300, y: 214, kind: "ok", label: "TP-081 Markaz" },
  { id: "tp-9", x: 356, y: 182, kind: "ok", label: "TP-096 Markaz" },
  { id: "tp-10", x: 368, y: 60, kind: "ok", label: "TP-103 Chinobod" },
  { id: "tp-11", x: 424, y: 168, kind: "ok", label: "TP-119 Markaz" },
  { id: "tp-12", x: 440, y: 66, kind: "ok", label: "TP-134 Chinobod" },
  { id: "tp-13", x: 462, y: 190, kind: "ok", label: "TP-152 Fayzobod" },
  { id: "tp-14", x: 556, y: 172, kind: "ok", label: "TP-178 Fayzobod" },
  { id: "tp-15", x: 616, y: 178, kind: "ok", label: "TP-194 Qorako’l" },
  { id: "tp-16", x: 632, y: 218, kind: "ok", label: "TP-211 Qorako’l" },
];

/** `MapCanvas` kutadigan ko'rinish - sxema koordinatalari bir marta o'giriladi. */
const MARKERS: MapMarker[] = OBJECTS.map((object) => {
  const position = toLatLng(object.x, object.y);
  return {
    id: object.id,
    lat: position.lat,
    lng: position.lng,
    label: object.label,
    kind: object.kind,
  };
});

/** Tarmoq liniyalari: kuchlanish darajasi rang va qalinlikni belgilaydi. */
type LineLevel = "feeder" | "kv10" | "kv110";

/**
 * Chiziq qalinliklari SVG dagidan yo'g'onroq: Google fonida (yo'llar, dala
 * chegaralari) 1.5px lik chiziq yo'qolib ketadi.
 */
const LINE_STYLE: Record<LineLevel, { color: string; width: number }> = {
  kv110: { color: "#ef4444", width: 3 },
  kv10: { color: "#3b82f6", width: 2.4 },
  feeder: { color: "#eab308", width: 2 },
};

const LINES: ReadonlyArray<{ id: string; level: LineLevel; points: string }> = [
  // 110 kV - podstansiyalarni bog'lovchi magistral
  { id: "l1", level: "kv110", points: "112,96 216,116 330,152 462,190 520,196" },
  { id: "l2", level: "kv110", points: "112,96 140,62 296,52 368,60 440,66" },
  { id: "l3", level: "kv110", points: "330,152 424,168 520,196 616,178" },

  // 10 kV - podstansiyadan mahalla tugunlariga
  { id: "l4", level: "kv10", points: "112,96 58,116 86,176 72,244" },
  { id: "l5", level: "kv10", points: "112,96 152,128 176,172 196,216" },
  { id: "l6", level: "kv10", points: "330,152 300,214 232,250" },
  { id: "l7", level: "kv10", points: "330,152 356,182 412,238" },
  { id: "l8", level: "kv10", points: "520,196 596,230 632,218" },
  { id: "l9", level: "kv10", points: "520,196 556,172 616,178" },

  // Feeder - oxirgi bosqich, iste'molchilarga tarqatuvchi shoxobchalar
  { id: "l10", level: "feeder", points: "216,116 262,76 296,52" },
  { id: "l11", level: "feeder", points: "424,168 392,108 368,60" },
  { id: "l12", level: "feeder", points: "462,190 472,252" },
  { id: "l13", level: "feeder", points: "176,172 216,116" },
  { id: "l14", level: "feeder", points: "86,176 152,128" },
  { id: "l15", level: "feeder", points: "300,214 356,182" },
  { id: "l16", level: "feeder", points: "440,66 462,190" },
];

const POWER_LINES: readonly MapPolyline[] = LINES.map((line) => ({
  id: line.id,
  path: toPath(line.points),
  color: LINE_STYLE[line.level].color,
  width: LINE_STYLE[line.level].width,
  // Feeder shoxobchalari uzuq chiziq - magistraldan darrov ajralib turadi.
  dashed: line.level === "feeder",
}));

/** Yo'qotish o'choqlari - kritik transformatorlar atrofidagi zonalar. */
const LOSS_ZONES: readonly MapCircle[] = [
  {
    id: "loss-1",
    center: toLatLng(196, 216),
    radius: 44 * METERS_PER_UNIT,
    color: "#ef4444",
  },
  {
    id: "loss-2",
    center: toLatLng(412, 238),
    radius: 36 * METERS_PER_UNIT,
    color: "#ef4444",
  },
];

/* ---------------------------------------------------------------------------
   Marker chizuvchi

   `MapCanvas` markerni HTML satri sifatida kutadi (Google `OverlayView` ichida
   joylashadi), shuning uchun bu yerda JSX emas, tayyor markup qaytariladi.
   --------------------------------------------------------------------------- */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dot(color: string): string {
  return (
    '<span style="display:block;width:11px;height:11px;border-radius:50%;background:' +
    color +
    ';border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>'
  );
}

const SHAPES: Record<MarkerKind, string> = {
  substation:
    '<span style="display:block;width:14px;height:14px;border-radius:3px;background:#2563eb;' +
    'border:1.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></span>',
  ok: dot("#22c55e"),
  warn: dot("#f59e0b"),
  critical:
    '<svg width="14" height="13" viewBox="0 0 14 13" ' +
    'style="display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.45))">' +
    '<path d="M7 0.8 13.2 12.2 0.8 12.2Z" fill="#ef4444" stroke="#fff" stroke-width="1.3" ' +
    'stroke-linejoin="round"/></svg>',
};

/**
 * `MapCanvas` markerni `translate(-50%, -100%)` bilan joylashtiradi (yorliqli
 * ignalar uchun to'g'ri), bizda esa belgi koordinataning aynan ustida turishi
 * kerak - shuning uchun ichkarida `translateY(50%)` bilan qaytarib
 * markazlashtiriladi. Tanlanganda chiqadigan yorliq `absolute`: u tashqi
 * qutini o'zgartirmaydi, ya'ni belgi joyidan siljimaydi.
 */
const districtMarker: MarkerRenderer = (marker, selected) => {
  const shape = SHAPES[(marker.kind ?? "ok") as MarkerKind] ?? SHAPES.ok;
  const tooltip = selected
    ? '<div style="position:absolute;bottom:calc(100% + 7px);left:50%;' +
      "transform:translateX(-50%);background:rgba(15,15,20,.88);color:#fff;" +
      "font-family:var(--font-geist-sans),system-ui,sans-serif;font-size:10px;" +
      'font-weight:500;line-height:1.2;padding:4px 7px;border-radius:6px;white-space:nowrap">' +
      escapeHtml(marker.label) +
      "</div>"
    : "";

  return (
    '<div style="position:relative;transform:translateY(50%)">' +
    shape +
    tooltip +
    "</div>"
  );
};

/* ---------------------------------------------------------------------------
   Legenda
   --------------------------------------------------------------------------- */

interface LegendItem {
  id: string;
  /** Nishonlar 10px: kvadrat, doira, uchburchak yoki chiziq. */
  marks: readonly string[];
  text: string;
}

/**
 * Legenda faqat xaritada haqiqatan chiziladigan belgilarni izohlaydi va
 * qatorlar soni 6 ta bilan cheklangan.
 *
 * Sabab - panel xarita ustida suzadi: 8 qatorda uning balandligi ~150px
 * bo'lib, xarita maydonining yuqori o'ng burchagini yopib qolardi. 6 qator +
 * `gap-0.5` da balandlik ~110px. Qator qo'shishdan oldin shu hisobni qayta
 * tekshiring.
 */
const LEGEND: readonly LegendItem[] = [
  {
    id: "ps",
    marks: ["size-2.5 rounded-[2px] bg-[#2563eb]"],
    text: "Podstansiya (110/35/10 kV)",
  },
  {
    id: "ok",
    marks: ["size-2.5 rounded-full bg-[#22c55e]"],
    text: "Sog’lom transformator",
  },
  {
    id: "warn",
    marks: ["size-2.5 rounded-full bg-[#f59e0b]"],
    text: "Ogohlantirish holati",
  },
  {
    id: "critical",
    // Xaritada kritik TP uchburchak bilan chiziladi - nishon ham uchburchak.
    marks: ["size-2.5 bg-[#ef4444] [clip-path:polygon(50%_0%,100%_100%,0%_100%)]"],
    text: "Kritik transformator",
  },
  {
    id: "lines",
    // Uch kuchlanish darajasi bitta qatorda: LINE_STYLE bilan bir xil tartib.
    marks: [
      "h-0.5 w-2.5 rounded-full bg-[#ef4444]",
      "h-0.5 w-2.5 rounded-full bg-[#3b82f6]",
      "h-0.5 w-2.5 rounded-full bg-[#eab308]",
    ],
    text: "110 / 10 kV va feeder",
  },
  {
    id: "loss",
    marks: ["size-2.5 rounded-full border border-dashed border-[#ef4444] bg-[#ef4444]/20"],
    text: "Yo’qotishlar o’chog’i",
  },
];

/** Xarita ustidagi barcha yumaloq tugmalar bir xil ko'rinishda. */
const MAP_BUTTON =
  "flex size-7 shrink-0 items-center justify-center rounded-md bg-surface/90 text-ink shadow-sm transition-colors hover:bg-surface";

/** "Qatlamlar" tugmasi asosiy qatlamni shu tartibda aylantiradi. */
const MAP_TYPES: readonly MapTypeId[] = ["roadmap", "hybrid"];

/* ---------------------------------------------------------------------------
   Karta
   --------------------------------------------------------------------------- */

/**
 * "Baliqchi tumani xaritasi" - bosh sahifaning 2-qatoridagi eng katta karta
 * (span-11, ~672x352).
 *
 * Xarita - Google Maps. Uning ustiga uch qatlam qo'yiladi: yo'qotish zonalari
 * (`Circle`), tarmoq liniyalari (`Polyline`) va obyekt markerlari. Markerlar
 * HTML overlay bo'lgani uchun ular doim geometriyadan yuqorida turadi -
 * podstansiya kvadrati liniya ostida qolib ketmaydi.
 */
export function DistrictMapCard({ className }: { className?: string }) {
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [mapTypeIndex, setMapTypeIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Har bosishda ortadi - `MapCanvas` ko'rinishni qayta markazlashtiradi.
  const [recenterKey, setRecenterKey] = useState(0);

  const changeZoom = (step: number) =>
    setZoom((prev) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + step)));

  const resetView = () => {
    setZoom(DEFAULT_ZOOM);
    setSelectedId(null);
    setRecenterKey((prev) => prev + 1);
  };

  return (
    <Card padded={false} className={cn("p-3", className)}>
      {/* 1) Sarlavha */}
      <div className="flex h-7 shrink-0 items-center justify-between gap-2">
        <h2 className="truncate text-sm font-bold text-ink">Baliqchi tumani xaritasi</h2>
        <span className="shrink-0 text-[10px] text-ink-soft">
          {OBJECTS.length} ta obyekt
        </span>
      </div>

      {/* 2) Xarita maydoni */}
      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-lg">
        <MapCanvas
          markers={MARKERS}
          center={CENTER}
          zoom={zoom}
          recenterKey={recenterKey}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId((prev) => (prev === id ? null : id))}
          renderMarker={districtMarker}
          polylines={POWER_LINES}
          circles={LOSS_ZONES}
          mapTypeId={MAP_TYPES[mapTypeIndex]}
          compactFallback
          className="absolute inset-0 h-full w-full"
        />

        {/* Boshqaruv tugmalari.

            Hammasi yuqori-chapda bitta ustunda: xaritaning pastki chetini
            Google'ning majburiy attributsiyasi egallaydi (logotip chapda,
            "Map data / Terms" o'ngda) - uni yopib qo'yish mumkin emas. */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={resetView}
            aria-label={"Ko’rinishni boshlang’ich holatga qaytarish"}
            className={cn(MAP_BUTTON, "mb-0.5")}
          >
            <Icon icon={Navigation} size={14} />
          </button>
          <button
            type="button"
            onClick={() => changeZoom(1)}
            aria-label="Kattalashtirish"
            className={MAP_BUTTON}
          >
            <Icon icon={Plus} size={14} />
          </button>
          <button
            type="button"
            onClick={() => changeZoom(-1)}
            aria-label="Kichraytirish"
            className={MAP_BUTTON}
          >
            <Icon icon={Minus} size={14} />
          </button>
          <button
            type="button"
            onClick={() => setMapTypeIndex((prev) => (prev + 1) % MAP_TYPES.length)}
            aria-label={"Xarita qatlamini almashtirish"}
            className={cn(MAP_BUTTON, "mt-0.5")}
          >
            <Icon icon={Layers} size={14} />
          </button>
        </div>

        {/* Legenda paneli */}
        <div className="absolute top-2 right-2 z-10 w-[172px] rounded-lg bg-surface/95 p-2 shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
          <span className="block text-[10px] font-bold text-ink">Xarita legendasi</span>
          <ul className="mt-1.5 flex flex-col gap-0.5 text-[9px] text-ink-muted">
            {LEGEND.map((item) => (
              <li key={item.id} className="flex items-center gap-1.5">
                <span className="flex shrink-0 items-center gap-0.5">
                  {item.marks.map((mark, markIndex) => (
                    <span key={`${item.id}-${markIndex}`} className={cn("shrink-0", mark)} />
                  ))}
                </span>
                <span className="truncate">{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
