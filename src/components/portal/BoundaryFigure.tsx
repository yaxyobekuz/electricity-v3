import { ANDIJON_REGION, BALIQCHI_DISTRICT } from "@/lib/geo/boundaries";
import { fitBbox, ringToPath } from "@/lib/geo/project";
import { growBbox } from "@/lib/geo/rings";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Chegaralarning sof SVG tasviri - mijoz tomonida hech qanday JS ishlamaydi.

   U jonli Google xaritasining OSTIDA turadi va xarita tayyor bo'lganda uning
   ustidan so'nib chiqadi, shuning uchun kulrang bo'shliq hech qachon
   ko'rinmaydi. Kalit sozlanmagan bo'lsa yoki xarita yuklanmasa - shu tasvir
   qoladi va ekran baribir to'liq ko'rinadi.

   Proyeksiya jonli xaritanikiga aynan mos (Web Merkator + "contain"), shuning
   uchun ikkalasi almashganda tuman sakramaydi.
   --------------------------------------------------------------------------- */

/** Tuman bbox'i har tomonga 60% kengaytiriladi - viloyat konturi ham tushsin. */
const FRAME = growBbox(BALIQCHI_DISTRICT.bbox, 0.6);

const VIEW_W = 1000;
/** 1000 / 2.629 - FRAME ning Merkatordagi nisbati. */
const VIEW_H = 380;

const project = fitBbox(FRAME, VIEW_W, VIEW_H, 16);

const REGION_PATH = ANDIJON_REGION.rings.map((ring) => ringToPath(ring, project)).join(" ");
const DISTRICT_PATH = BALIQCHI_DISTRICT.rings.map((ring) => ringToPath(ring, project)).join(" ");

/** Tuman markazi - yorliq shu nuqtada turadi. */
const [LABEL_X, LABEL_Y] = project(71.94708, 40.85315);

/**
 * Fon va niqob to'rtburchagi viewBox'dan ancha kattaroq chiziladi.
 * `preserveAspectRatio="meet"` konteyner nisbati boshqacha bo'lganda
 * bo'sh yo'l qoldiradi; usiz o'sha yo'lda panel foni ko'rinib, ufqiy chok
 * paydo bo'lardi.
 */
const BLEED = { x: -2000, y: -2000, width: 5000, height: 5000 } as const;

export function BoundaryFigure({ className }: { className?: string }) {
  return (
    // Panelni `PortalMap` dagi `sr-only` matn ta'riflaydi, shuning uchun bu
    // tasvir sof bezak - aks holda bir xil ta'rif ikki marta e'lon qilinardi.
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      className={cn("size-full", className)}
    >
      <defs>
        {/* Projektor: teshik SVG niqobidan tekin keladi - jonli xaritadagi
            winding hiylasi bu yerda kerak emas. */}
        <mask id="portalSpotlight">
          <rect {...BLEED} fill="#ffffff" />
          <path d={DISTRICT_PATH} fill="#000000" />
        </mask>
      </defs>

      <rect {...BLEED} fill="#f4f2ed" />

      {/* Uzuq = kontekst. Viloyat konturi. */}
      <path
        d={REGION_PATH}
        fill="#ffffff"
        stroke="#6b7480"
        strokeWidth={1.4}
        strokeDasharray="5 4"
        strokeLinejoin="round"
      />

      {/* Tumandan tashqarisi xiralashadi. */}
      <rect {...BLEED} fill="#e7ebf0" fillOpacity={0.8} mask="url(#portalSpotlight)" />

      {/* To'liq = subyekt. Tuman. */}
      <path d={DISTRICT_PATH} fill="#007cd2" fillOpacity={0.18} />
      <path
        d={DISTRICT_PATH}
        fill="none"
        stroke="#007cd2"
        strokeWidth={11}
        strokeLinejoin="round"
        className="portal-halo"
      />
      <path
        d={DISTRICT_PATH}
        fill="none"
        stroke="#007cd2"
        strokeWidth={2.5}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        className="portal-outline"
      />
      <path
        d={DISTRICT_PATH}
        fill="none"
        stroke="#007cd2"
        strokeWidth={2.5}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="0.04 0.06"
        className="portal-sweep"
      />

      {/*
        Bu yerda matnli yorliq YO'Q. viewBox 1000 birlik keng, telefonda esa
        panel ~384px - ya'ni 11 birlikli matn ekranda ~4px ga aylanib,
        o'qib bo'lmas dog'ga aylanardi. Tumanni panel tepasidagi
        "Nazorat hududi / Baliqchi tumani" chipi nomlaydi (u HTML, shuning
        uchun har qanday kenglikda bir xil o'lchamda qoladi).
      */}
      <circle cx={LABEL_X} cy={LABEL_Y} r={4} fill="#007cd2" />
      <circle cx={LABEL_X} cy={LABEL_Y} r={9} fill="#007cd2" fillOpacity={0.18} />
    </svg>
  );
}
