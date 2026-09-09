"use client";

import { ChevronDown, Layers, Minus, Navigation, Plus, Search } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Filtr qatori
   --------------------------------------------------------------------------- */

interface MapFilter {
  id: string;
  /** Tugmadagi "Tuman: ..." ko'rinishidagi old qo'shimcha. */
  prefix: string;
  options: readonly string[];
}

const FILTERS: readonly MapFilter[] = [
  { id: "district", prefix: "Tuman", options: ["Baliqchi", "Chinobod", "Fayzobod"] },
  {
    id: "area",
    prefix: "Hudud",
    options: ["Barchasi", "Markaz", "Sarnovul", "Qorako\u2019l"],
  },
  {
    id: "transformer",
    prefix: "Transformator",
    options: ["Barchasi", "Sog\u2019lom", "Ogohlantirish", "Kritik"],
  },
];

/* ---------------------------------------------------------------------------
   Xarita ma'lumotlari (mock) - barcha koordinatalar 640x300 viewBox uchun
   qo'lda tanlangan. Tasodifiy son ishlatilmaydi: server va mijoz bir xil
   markup chizishi shart (gidratsiya xatosi bo'lmasligi uchun).
   --------------------------------------------------------------------------- */

type MarkerKind = "critical" | "ok" | "substation" | "warn";

interface MapMarker {
  id: string;
  x: number;
  y: number;
  kind: MarkerKind;
  /** Qidiruv va ekran o'quvchisi uchun o'zbekcha nom. */
  label: string;
}

const MARKERS: readonly MapMarker[] = [
  // Podstansiyalar (110/35/10 kV tugunlari)
  { id: "ps-1", x: 112, y: 96, kind: "substation", label: "Baliqchi podstansiyasi" },
  { id: "ps-2", x: 330, y: 152, kind: "substation", label: "Markaz podstansiyasi" },
  { id: "ps-3", x: 520, y: 196, kind: "substation", label: "Fayzobod podstansiyasi" },

  // Kritik holatdagi transformatorlar
  { id: "tp-c1", x: 196, y: 216, kind: "critical", label: "TP-114 Sarnovul" },
  { id: "tp-c2", x: 412, y: 238, kind: "critical", label: "TP-207 Fayzobod" },
  { id: "tp-c3", x: 86, y: 176, kind: "critical", label: "TP-042 Qorako\u2019l" },

  // Ogohlantirish holatidagi transformatorlar
  { id: "tp-w1", x: 152, y: 128, kind: "warn", label: "TP-051 Chinobod" },
  { id: "tp-w2", x: 262, y: 76, kind: "warn", label: "TP-063 Markaz" },
  { id: "tp-w3", x: 392, y: 108, kind: "warn", label: "TP-128 Chinobod" },
  { id: "tp-w4", x: 472, y: 252, kind: "warn", label: "TP-233 Fayzobod" },
  { id: "tp-w5", x: 596, y: 230, kind: "warn", label: "TP-286 Qorako\u2019l" },

  // Sog'lom transformatorlar
  { id: "tp-1", x: 58, y: 116, kind: "ok", label: "TP-011 Qorako\u2019l" },
  { id: "tp-2", x: 72, y: 244, kind: "ok", label: "TP-018 Qorako\u2019l" },
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
  { id: "tp-15", x: 616, y: 178, kind: "ok", label: "TP-194 Qorako\u2019l" },
  { id: "tp-16", x: 632, y: 218, kind: "ok", label: "TP-211 Qorako\u2019l" },
];

/** Tarmoq liniyalari: kuchlanish darajasi rang va qalinlikni belgilaydi. */
interface PowerLine {
  id: string;
  level: "feeder" | "kv10" | "kv110";
  points: string;
}

const LINE_STYLE: Record<PowerLine["level"], { color: string; width: number }> = {
  kv110: { color: "#ef4444", width: 2 },
  kv10: { color: "#3b82f6", width: 1.6 },
  feeder: { color: "#eab308", width: 1.4 },
};

const LINES: readonly PowerLine[] = [
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

/** Yo'qotish o'choqlari - kritik transformatorlar atrofidagi zonalar. */
const LOSS_ZONES = [
  { id: "loss-1", cx: 196, cy: 216, r: 44 },
  { id: "loss-2", cx: 412, cy: 238, r: 36 },
] as const;

/** Hudud nomlari - to'q fonda o'qilishi uchun ostiga qora soya chiziladi. */
const REGION_LABELS = [
  { id: "sarnovul", name: "Sarnovul", x: 60, y: 88 },
  { id: "chinobod", name: "Chinobod", x: 300, y: 98 },
  { id: "baliqchi", name: "Baliqchi", x: 214, y: 196 },
  { id: "qorakol", name: "Qorako\u2019l", x: 380, y: 140 },
  { id: "fayzobod", name: "Fayzobod", x: 466, y: 216 },
] as const;

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
 * bo'lib, 220px lik xarita maydonining yuqori o'ng burchagini yopib qolardi
 * (TP-152, TP-178, TP-194 va Fayzobod podstansiyasi ko'rinmay qolardi).
 * 6 qator + `gap-0.5` da balandlik ~110px, ya'ni eng past marker qatoridan
 * yuqorida tugaydi. Qator qo'shishdan oldin shu hisobni qayta tekshiring.
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
    text: "Sog\u2019lom transformator",
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
    text: "Yo\u2019qotishlar o\u2019chog\u2019i",
  },
];

/** Xarita ustidagi barcha yumaloq tugmalar bir xil ko'rinishda. */
const MAP_BUTTON =
  "flex size-7 shrink-0 items-center justify-center rounded-md bg-surface/90 text-ink shadow-sm transition-colors hover:bg-surface";

const ZOOM_MIN = 1;
const ZOOM_MAX = 1.8;

/* ---------------------------------------------------------------------------
   Marker shakllari
   --------------------------------------------------------------------------- */

function MarkerShape({ marker }: { marker: MapMarker }) {
  if (marker.kind === "substation") {
    // Podstansiya - 14x14 yumaloq burchakli kvadrat (transformatordan yirikroq).
    return (
      <rect
        x={marker.x - 7}
        y={marker.y - 7}
        width={14}
        height={14}
        rx={3}
        fill="#2563eb"
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    );
  }

  if (marker.kind === "critical") {
    // Kritik holat - uchburchak: shakl orqali ham (nafaqat rang bilan) farqlanadi.
    return (
      <path
        d={`M${marker.x} ${marker.y - 7} L${marker.x + 6.5} ${marker.y + 5} L${marker.x - 6.5} ${marker.y + 5} Z`}
        fill="#ef4444"
        stroke="#ffffff"
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
    );
  }

  return (
    <circle
      cx={marker.x}
      cy={marker.y}
      r={5}
      fill={marker.kind === "warn" ? "#f59e0b" : "#22c55e"}
      stroke="#ffffff"
      strokeWidth={1.5}
    />
  );
}

/* ---------------------------------------------------------------------------
   Karta
   --------------------------------------------------------------------------- */

/**
 * "Bosh sahifa" ning eng katta kartasi (672x316): tuman xaritasi.
 *
 * Xarita Google Maps emas - to'liq inline SVG. Sabab: panel ichki tarmoqda
 * ham, API kalitisiz ham ishlashi kerak, ustiga qo'yiladigan qatlam esa
 * baribir o'zimizniki (podstansiya, feeder, yo'qotish o'chog'i).
 */
export function DistrictMapCard({ className }: { className?: string }) {
  // Har bir filtr o'z ro'yxatini aylantiradi (maketda ochiluvchi ro'yxat yo'q).
  const [filterIndexes, setFilterIndexes] = useState<readonly number[]>([0, 0, 0]);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const [showLines, setShowLines] = useState(true);

  const cycleFilter = (index: number) =>
    setFilterIndexes((prev) =>
      prev.map((value, position) =>
        position === index ? (value + 1) % FILTERS[index].options.length : value,
      ),
    );

  const changeZoom = (step: number) =>
    setZoom((prev) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + step)));

  // Qidiruv markerlarni yashirmaydi, mos kelmaganini xiralashtiradi -
  // shunda tarmoq tuzilmasi ko'rinishida qoladi.
  const needle = query.trim().toLowerCase();

  return (
    <Card padded={false} className={cn("p-3", className)}>
      {/* 1) Sarlavha */}
      <div className="flex h-7 shrink-0 items-center justify-between gap-2">
        <h2 className="truncate text-sm font-bold text-ink">Baliqchi tumani xaritasi</h2>
        <span className="shrink-0 text-[10px] text-ink-soft">
          {MARKERS.length} ta obyekt
        </span>
      </div>

      {/* 2) Filtrlar va qidiruv */}
      <div className="mt-2 flex shrink-0 items-center gap-2">
        {FILTERS.map((filter, index) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => cycleFilter(index)}
            aria-label={`${filter.prefix}ni o\u2019zgartirish`}
            className="flex h-7 items-center gap-1 rounded-md bg-canvas px-2 text-[10px] font-medium text-ink transition-colors hover:bg-black/5"
          >
            {filter.prefix}: {filter.options[filterIndexes[index]]}
            <Icon icon={ChevronDown} size={12} />
          </button>
        ))}

        <div className="relative ml-auto w-[150px]">
          <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-ink-soft">
            <Icon icon={Search} size={14} />
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Xaritadan qidirish"
            placeholder="Qidiruv..."
            className="h-7 w-full rounded-md bg-canvas pr-2 pl-7 text-[10px] text-ink outline-none placeholder:text-ink-soft"
          />
        </div>
      </div>

      {/* 3) Xarita maydoni */}
      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden rounded-lg">
        <svg
          viewBox="0 0 640 300"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={"Baliqchi tumani elektr tarmog\u2019i sxematik xaritasi"}
        >
          <defs>
            <linearGradient id="map-ground" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4a5f3a" />
              <stop offset="100%" stopColor="#2f3f28" />
            </linearGradient>
            <linearGradient id="map-water" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#3f5a63" />
              <stop offset="100%" stopColor="#33484f" />
            </linearGradient>
            <radialGradient id="map-glow" cx="0.42" cy="0.38" r="0.75">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
            </radialGradient>
          </defs>

          {/* Fon - sun'iy yo'ldosh tasviri taassuroti */}
          <rect x="0" y="0" width="640" height="300" fill="url(#map-ground)" />

          {/* a) Dala maydonlari va suv oqimlari */}
          <g>
            <path d="M0 0 L180 0 L210 58 L120 104 L0 72 Z" fill="#56693f" opacity="0.65" />
            <path d="M182 0 L360 0 L392 46 L300 88 L206 60 Z" fill="#3e4f31" opacity="0.7" />
            <path d="M362 0 L560 0 L590 52 L470 96 L396 44 Z" fill="#6b7c4a" opacity="0.55" />
            <path d="M562 0 L640 0 L640 88 L594 54 Z" fill="#56693f" opacity="0.6" />
            <ellipse
              cx="120"
              cy="170"
              rx="96"
              ry="58"
              fill="#6b7c4a"
              opacity="0.5"
              transform="rotate(-14 120 170)"
            />
            <path d="M0 110 L96 132 L128 206 L44 258 L0 232 Z" fill="#3e4f31" opacity="0.6" />
            <path d="M0 262 L70 246 L162 272 L200 300 L0 300 Z" fill="#56693f" opacity="0.65" />
            <path
              d="M214 232 L330 208 L400 246 L372 300 L212 300 Z"
              fill="#3e4f31"
              opacity="0.55"
            />
            <path d="M232 96 L340 118 L352 176 L246 196 L196 146 Z" fill="#6b7c4a" opacity="0.45" />
            <ellipse
              cx="470"
              cy="150"
              rx="110"
              ry="64"
              fill="#56693f"
              opacity="0.5"
              transform="rotate(8 470 150)"
            />
            <path
              d="M406 248 L520 214 L604 244 L620 300 L392 300 Z"
              fill="#6b7c4a"
              opacity="0.5"
            />
            <path d="M596 108 L640 96 L640 214 L568 196 L560 140 Z" fill="#3e4f31" opacity="0.6" />

            {/* Suv oqimlari - kanal va ariqlar */}
            <g fill="none" stroke="url(#map-water)" strokeLinecap="round">
              <path
                d="M-8 128 C 70 112, 118 158, 196 150 C 268 142, 316 190, 396 178 C 470 168, 520 202, 648 188"
                strokeWidth="8"
                opacity="0.85"
              />
              <path
                d="M84 -8 C 96 60, 62 96, 78 158 C 92 210, 60 246, 72 308"
                strokeWidth="6"
                opacity="0.7"
              />
              <path d="M470 -8 C 486 48, 448 82, 462 132" strokeWidth="5" opacity="0.65" />
            </g>

            {/* Yorug'lik gradienti - tekis fonni "suratga" yaqinlashtiradi */}
            <rect x="0" y="0" width="640" height="300" fill="url(#map-glow)" />
          </g>

          {/* Yaqinlashtirish markazdan amalga oshadi - tugmalar shu guruhni kattalashtiradi */}
          <g transform={`translate(320 150) scale(${zoom}) translate(-320 -150)`}>
            {/* b) Tarmoq liniyalari */}
            {showLines ? (
              <g fill="none" strokeLinecap="round" strokeLinejoin="round">
                {LINES.map((line) => (
                  <polyline
                    key={line.id}
                    points={line.points}
                    stroke={LINE_STYLE[line.level].color}
                    strokeWidth={LINE_STYLE[line.level].width}
                    opacity={0.92}
                  />
                ))}
              </g>
            ) : null}

            {/* c) Yo'qotish o'choqlari */}
            {LOSS_ZONES.map((zone) => (
              <circle
                key={zone.id}
                cx={zone.cx}
                cy={zone.cy}
                r={zone.r}
                fill="#ef4444"
                fillOpacity={0.18}
                stroke="#ef4444"
                strokeDasharray="4 3"
              />
            ))}

            {/* d) Markerlar */}
            {MARKERS.map((marker) => (
              <g
                key={marker.id}
                opacity={needle && !marker.label.toLowerCase().includes(needle) ? 0.3 : 1}
              >
                <title>{marker.label}</title>
                <MarkerShape marker={marker} />
              </g>
            ))}

            {/* e) Hudud nomlari: avval qora soya, ustiga oq matn */}
            <g fontSize={11} fontWeight={600}>
              {REGION_LABELS.map((region) => (
                <g key={region.id}>
                  <text x={region.x + 1} y={region.y + 1} fill="#000000" opacity={0.45}>
                    {region.name}
                  </text>
                  <text x={region.x} y={region.y} fill="#ffffff">
                    {region.name}
                  </text>
                </g>
              ))}
            </g>
          </g>
        </svg>

        {/* Joylashuv tugmasi - ko'rinishni boshlang'ich holatga qaytaradi */}
        <button
          type="button"
          onClick={() => setZoom(ZOOM_MIN)}
          aria-label={"Ko\u2019rinishni boshlang\u2019ich holatga qaytarish"}
          className={cn(MAP_BUTTON, "absolute top-2 left-2")}
        >
          <Icon icon={Navigation} size={14} />
        </button>

        {/* Masshtab va qatlam tugmalari */}
        <div className="absolute bottom-2 left-2 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => changeZoom(0.2)}
            aria-label="Kattalashtirish"
            className={MAP_BUTTON}
          >
            <Icon icon={Plus} size={14} />
          </button>
          <button
            type="button"
            onClick={() => changeZoom(-0.2)}
            aria-label="Kichraytirish"
            className={MAP_BUTTON}
          >
            <Icon icon={Minus} size={14} />
          </button>
          <button
            type="button"
            onClick={() => setShowLines((prev) => !prev)}
            aria-label={"Tarmoq qatlamini yoqish yoki o\u2019chirish"}
            aria-pressed={showLines}
            className={cn(MAP_BUTTON, "mt-0.5")}
          >
            <Icon icon={Layers} size={14} />
          </button>
        </div>

        {/* Legenda paneli */}
        <div className="absolute top-2 right-2 w-[172px] rounded-lg bg-surface/95 p-2 shadow-[0_2px_10px_rgba(0,0,0,0.15)]">
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
