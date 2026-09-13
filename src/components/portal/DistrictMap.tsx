import { ANDIJON_REGION, BALIQCHI_DISTRICT, type Ring } from "@/lib/geo/boundaries";
import { NEIGHBOUR_DISTRICTS } from "@/lib/geo/districts";
import { fitBbox, ringToPath, type Projector } from "@/lib/geo/project";
import { growBbox } from "@/lib/geo/rings";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Portal ekranining bosh tasviri: Andijon viloyati tumanlari qorong'i
   "boshqaruv markazi" uslubida chizilgan vektor xarita.

   Google xaritasi ATAYLAB ishlatilmaydi - rastr plitkalarni bu ko'rinishga
   keltirib bo'lmaydi. Tasvir sof SVG (ustidagi tuman yorlig'i - oddiy HTML),
   server tomonida bir marta hisoblanadi va mijozda hech qanday JS talab
   qilmaydi.

   Geometriya haqiqiy: OpenStreetMap chegaralari, Web Merkator proyeksiyasi.
   Tugunlar - tumanlarning geometrik markazlari, o'ylab topilgan obyektlar
   emas.
   --------------------------------------------------------------------------- */

/**
 * Tuman bbox'i har tomonga 120% kengaytiriladi. `slice` konteyner nisbatiga
 * qarab kenglikning yarmiga yaqinini kesadi, shuning uchun qo'shni tumanlar
 * kadrga tushishi uchun shuncha uzoqlashtirish kerak.
 */
const FRAME = growBbox(BALIQCHI_DISTRICT.bbox, 1.2);

const VIEW_W = 1000;
/** 1000 / 2.629 - FRAME ning Merkatordagi nisbati. */
const VIEW_H = 380;

const project: Projector = fitBbox(FRAME, VIEW_W, VIEW_H, 16);

const REGION_PATH = ANDIJON_REGION.rings.map((ring) => ringToPath(ring, project)).join(" ");
const DISTRICT_PATH = BALIQCHI_DISTRICT.rings.map((ring) => ringToPath(ring, project)).join(" ");

/**
 * Qo'shni tumanlarning ranglari. Qo'lda, chegaradoshlik bo'yicha tanlangan:
 * umumiy chegarasi bor ikki tumanga bir oiladagi rang (sariq-to'q sariq,
 * pushti-qizil, binafsha, yashil) tushmaydi.
 *
 * Baliqchining muzli havorangi bu yerda ATAYLAB yo'q - faol tuman xaritadagi
 * yagona och-ko'k shakl bo'lib qolishi kerak.
 */
const TINTS: Readonly<Record<string, string>> = {
  andijon: "#2dd4bf",
  "andijon-shahri": "#facc15",
  asaka: "#818cf8",
  boston: "#e879f9",
  buloqboshi: "#f87171",
  izboskan: "#a78bfa",
  jalaquduq: "#fb923c",
  marhamat: "#a3e635",
  oltinkol: "#f472b6",
  paxtaobod: "#f59e0b",
  qorgontepa: "#fb7185",
  shahrixon: "#34d399",
  ulugnor: "#fdba74",
  xojaobod: "#c084fc",
  "xonobod-shahri": "#4ade80",
};

/** Generator yangi tuman qo'shsa - neytral kulrang, xarita buzilmaydi. */
const FALLBACK_TINT = "#94a3b8";

const NEIGHBOUR_PATHS = NEIGHBOUR_DISTRICTS.map((n) => ({
  id: n.id,
  tint: TINTS[n.id] ?? FALLBACK_TINT,
  d: n.rings.map((ring) => ringToPath(ring, project)).join(" "),
}));

/** Halqaning yuza markazi (shoelace) - [lng, lat]. */
function ringCentroid(ring: Ring): readonly [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const f = x1 * y2 - x2 * y1;
    area += f;
    cx += (x1 + x2) * f;
    cy += (y1 + y2) * f;
  }
  area /= 2;
  return [cx / (6 * area), cy / (6 * area)];
}

/** Eng katta halqa bo'yicha markaz - anklavlar markazni tortib ketmasin. */
function biggestRing(rings: ReadonlyArray<Ring>): Ring {
  return rings.reduce((a, b) => (b.length > a.length ? b : a));
}

const HUB = project(...ringCentroid(biggestRing(BALIQCHI_DISTRICT.rings)));

const NODES = NEIGHBOUR_DISTRICTS.map((n) => {
  const [x, y] = project(...ringCentroid(biggestRing(n.rings)));
  return {
    id: n.id,
    tint: TINTS[n.id] ?? FALLBACK_TINT,
    x,
    y,
    dist: Math.hypot(x - HUB[0], y - HUB[1]),
  };
});

/**
 * Impulslar bir vaqtda uchmasin: har yoy uchun notekis siljish (ms), bitta
 * 3200 ms lik tsikl ichida. Hammasi kontur chizilib bo'lgach (900 ms)
 * boshlanadi.
 */
const PULSE_DELAYS_MS = [0, 1350, 600, 2200, 950, 2650];

/**
 * Baliqchidan eng yaqin oltita tuman markazigacha bog'lovchi yoylar.
 * Ular tarmoqni emas, ma'muriy qo'shnilikni ko'rsatadi - shuning uchun
 * yorliqsiz.
 *
 * Yoy TUGUNDAN MARKAZGA qarab chiziladi: oqim animatsiyasi yo'l yo'nalishida
 * yuradi va Baliqchiga "quyiladi".
 */
const LINKS = [...NODES]
  .sort((a, b) => a.dist - b.dist)
  .slice(0, 6)
  .map((n, i) => {
    const mx = (HUB[0] + n.x) / 2;
    const my = (HUB[1] + n.y) / 2;
    // Yoyni perpendikulyar yo'nalishda biroz egamiz.
    const dx = n.x - HUB[0];
    const dy = n.y - HUB[1];
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(len * 0.16, 26);
    return {
      id: n.id,
      tint: n.tint,
      x: n.x,
      y: n.y,
      delay: `${900 + (PULSE_DELAYS_MS[i] ?? 0)}ms`,
      d: `M${n.x.toFixed(1)} ${n.y.toFixed(1)} Q${(mx - (dy / len) * bend).toFixed(1)} ${(
        my +
        (dx / len) * bend
      ).toFixed(1)} ${HUB[0].toFixed(1)} ${HUB[1].toFixed(1)}`,
    };
  });

/**
 * Fon to'rtburchagi viewBox'dan kattaroq: `preserveAspectRatio="meet"`
 * konteyner nisbati boshqacha bo'lganda bo'sh yo'l qoldiradi va u yerda
 * panel foni ko'rinib, ufqiy chok paydo bo'lardi.
 */
const BLEED = { x: -2000, y: -2000, width: 5000, height: 5000 } as const;

/**
 * `slice` rejimida bitta viewBox birligi konteynerda
 * max(W / VIEW_W, H / VIEW_H) pikselga teng. HTML yorliqni tugun ustiga
 * aynan qo'yish uchun shu formula container query birliklarida yoziladi -
 * JS o'lchovisiz, panelning har qanday nisbatida.
 *
 * Yorliq SVG ichida chizilmaydi: u yerda matn xarita bilan birga
 * kattalashib-kichrayadi va telefonda o'qib bo'lmay qoladi.
 */
const UNIT = `max(${(100 / VIEW_W).toFixed(4)}cqw, ${(100 / VIEW_H).toFixed(4)}cqh)`;

/** Yorliq uchi markaziy tugunning tashqi halqasidan (r=7) 6px yuqorida. */
const HUB_LABEL_STYLE = {
  left: `calc(50cqw + ${(HUB[0] - VIEW_W / 2).toFixed(1)} * ${UNIT})`,
  top: `calc(50cqh + ${(HUB[1] - VIEW_H / 2 - 7).toFixed(1)} * ${UNIT} - 6px)`,
} as const;

/** Vektor xaritaning o'zi - konteynerni to'liq qoplaydi. */
function MapArt() {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full"
    >
      <defs>
        <linearGradient id="pmSky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#31435a" />
          <stop offset="0.55" stopColor="#22303f" />
          <stop offset="1" stopColor="#151e28" />
        </linearGradient>

        {/* Yuqori-chapdagi yumshoq yorug'lik manbai. */}
        <radialGradient id="pmGlowTop" cx="0.28" cy="0.18" r="0.75">
          <stop offset="0" stopColor="#4d6b8c" stopOpacity="0.55" />
          <stop offset="1" stopColor="#4d6b8c" stopOpacity="0" />
        </radialGradient>

        {/* Chekkalarni qoraytiruvchi vinyetka. */}
        <radialGradient id="pmVignette" cx="0.5" cy="0.5" r="0.78">
          <stop offset="0.45" stopColor="#0b1118" stopOpacity="0" />
          <stop offset="1" stopColor="#0b1118" stopOpacity="0.75" />
        </radialGradient>

        {/* Faol tumanning muzli to'ldirmasi. */}
        <linearGradient id="pmActive" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#f2fbff" />
          <stop offset="0.5" stopColor="#c7e6f9" />
          <stop offset="1" stopColor="#8dc2e6" />
        </linearGradient>

        {/* Faol tuman atrofidagi nur. */}
        <filter id="pmHalo" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id="pmSoft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <filter id="pmBlur18" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="18" />
        </filter>

        {/* Har bir qo'shni tuman o'z shakli bilan kesiladi - rangli hoshiya
            chegaradan tashqariga, yonidagi tumanga o'tmaydi. */}
        {NEIGHBOUR_PATHS.map((n) => (
          <clipPath key={n.id} id={`pmClip-${n.id}`}>
            <path d={n.d} clipRule="evenodd" />
          </clipPath>
        ))}
      </defs>

      {/* 1. Fon */}
      <rect {...BLEED} fill="url(#pmSky)" />
      <rect {...BLEED} fill="url(#pmGlowTop)" />

      {/* 2. Relyefga o'xshash yumshoq bantlar - viloyat konturining
             kattalashtirilgan, xiralashtirilgan nusxalari. */}
      <g
        fill="none"
        stroke="#7fa0c2"
        strokeOpacity={0.07}
        strokeWidth={1.2}
        filter="url(#pmBlur18)"
      >
        {[1.06, 1.14, 1.24].map((k) => (
          <path
            key={k}
            d={REGION_PATH}
            transform={`translate(${(VIEW_W / 2) * (1 - k)} ${(VIEW_H / 2) * (1 - k)}) scale(${k})`}
          />
        ))}
      </g>

      {/* 3. Viloyat chegarasi - uzuq, xira. */}
      <path
        d={REGION_PATH}
        fill="#2a3949"
        fillOpacity={0.35}
        stroke="#8fb0d0"
        strokeOpacity={0.3}
        strokeWidth={1.2}
        strokeDasharray="6 5"
        strokeLinejoin="round"
      />

      {/* 4. Qo'shni tumanlar: har biri o'z rangida - xira to'ldirma va ichki
             nurli hoshiya, ustidan umumiy ingichka kontur. To'ldirma ataylab
             past shaffoflikda: rang tumanni ajratadi, lekin faol Baliqchi
             bilan bellashmaydi. */}
      <g>
        {NEIGHBOUR_PATHS.map((n) => (
          <g key={n.id} clipPath={`url(#pmClip-${n.id})`}>
            <path d={n.d} fill={n.tint} fillOpacity={0.3} fillRule="evenodd" />
            <path
              d={n.d}
              fill="none"
              stroke={n.tint}
              strokeOpacity={0.55}
              strokeWidth={8}
              strokeLinejoin="round"
              filter="url(#pmSoft)"
            />
          </g>
        ))}
      </g>
      <g fill="none" strokeLinejoin="round">
        <g stroke="#9cc4e8" strokeOpacity={0.16} strokeWidth={2.4} filter="url(#pmSoft)">
          {NEIGHBOUR_PATHS.map((n) => (
            <path key={n.id} d={n.d} />
          ))}
        </g>
        <g stroke="#c4d8ea" strokeOpacity={0.55} strokeWidth={0.8}>
          {NEIGHBOUR_PATHS.map((n) => (
            <path key={n.id} d={n.d} />
          ))}
        </g>
      </g>

      {/* 5. Qo'shni tuman tugunlari. Yoylar va markaziy tugun - `CurrentArt` da. */}
      <g>
        {NODES.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={5} fill={n.tint} fillOpacity={0.2} />
            <circle cx={n.x} cy={n.y} r={1.7} fill={n.tint} fillOpacity={0.95} />
          </g>
        ))}
      </g>

      {/* 6. Faol tuman: soya -> nur -> to'ldirma -> yorqin kontur. Soya uni
             rangli qo'shnilardan "ko'tarib" turadi. */}
      <path
        d={DISTRICT_PATH}
        fill="#070b10"
        fillOpacity={0.7}
        transform="translate(0 4)"
        filter="url(#pmHalo)"
      />
      <path d={DISTRICT_PATH} fill="#7ec8f0" fillOpacity={0.55} filter="url(#pmHalo)" />
      <path d={DISTRICT_PATH} fill="url(#pmActive)" fillOpacity={0.92} />
      <path
        d={DISTRICT_PATH}
        fill="none"
        stroke="#eaf7ff"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeOpacity={0.95}
      />
      <path
        d={DISTRICT_PATH}
        fill="none"
        stroke="#eaf7ff"
        strokeWidth={9}
        strokeLinejoin="round"
        className="portal-halo"
      />
      <path
        d={DISTRICT_PATH}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.6}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        className="portal-outline"
      />
      <path
        d={DISTRICT_PATH}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.6}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray="0.04 0.06"
        className="portal-sweep"
      />

      {/* 7. Vinyetka - xaritaning hamma qatlami ustidan. */}
      <rect {...BLEED} fill="url(#pmVignette)" />
    </svg>
  );
}

/**
 * Qo'shni tumanlardan Baliqchiga oqib keluvchi "elektr oqimi".
 *
 * Alohida SVG va `will-change-transform`: cheksiz animatsiya faqat shu yengil
 * qatlamni qayta chizadi. Asosiy xaritada o'nlab blur filtr bor - oqim o'sha
 * yerda bo'lsa, har kadrda ular ham qayta hisoblanardi.
 *
 * Qatlam faol tuman ustida: impuls Baliqchi chegarasidan o'tib, markaziy
 * tugungacha ko'rinib boradi.
 */
function CurrentArt() {
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 size-full will-change-transform"
    >
      <defs>
        {/* Rang manba tumandan Baliqchining elektr ko'kiga o'tadi. Ko'k ataylab
            to'q: yoy oxiri och muzli to'ldirma ustida yotadi. */}
        {LINKS.map((l) => (
          <linearGradient
            key={l.id}
            id={`pmCurrent-${l.id}`}
            gradientUnits="userSpaceOnUse"
            x1={l.x}
            y1={l.y}
            x2={HUB[0]}
            y2={HUB[1]}
          >
            <stop offset="0" stopColor={l.tint} />
            <stop offset="1" stopColor="#0a7cc9" />
          </linearGradient>
        ))}
      </defs>

      {LINKS.map((l) => (
        <g key={l.id} fill="none" stroke={`url(#pmCurrent-${l.id})`} strokeLinecap="round">
          {/* Sim. */}
          <path d={l.d} strokeOpacity={0.35} strokeWidth={0.9} />
          {/* Doimiy oqim - sim bo'ylab sirpanuvchi zarrachalar. */}
          <path
            d={l.d}
            strokeOpacity={0.75}
            strokeWidth={1.3}
            strokeDasharray="0.6 5.4"
            className="portal-current-flow"
          />
          {/* Impuls: keng xira nur, rangli o'zak va oq "qizigan" markaz. */}
          <path
            d={l.d}
            pathLength={1}
            strokeDasharray="0.2 2"
            strokeOpacity={0.3}
            strokeWidth={5}
            className="portal-current-pulse"
            style={{ animationDelay: l.delay }}
          />
          <path
            d={l.d}
            pathLength={1}
            strokeDasharray="0.2 2"
            strokeWidth={1.8}
            className="portal-current-pulse"
            style={{ animationDelay: l.delay }}
          />
          <path
            d={l.d}
            pathLength={1}
            strokeDasharray="0.2 2"
            stroke="#ffffff"
            strokeOpacity={0.9}
            strokeWidth={0.6}
            className="portal-current-pulse"
            style={{ animationDelay: l.delay }}
          />
        </g>
      ))}

      {/* Markaziy tugun. Har impuls yetib kelganda undan to'lqin tarqaladi -
          to'lqin o'z yoyining kechikishi bilan sinxron. */}
      {LINKS.map((l) => (
        <circle
          key={l.id}
          cx={HUB[0]}
          cy={HUB[1]}
          r={7}
          fill="none"
          stroke="#0a7cc9"
          strokeWidth={1.2}
          className="portal-hub-arrive"
          style={{ animationDelay: l.delay }}
        />
      ))}
      <circle cx={HUB[0]} cy={HUB[1]} r={7} fill="#2b6f9c" fillOpacity={0.3} />
      <circle cx={HUB[0]} cy={HUB[1]} r={3} fill="#1d5c86" fillOpacity={0.85} />
      <circle cx={HUB[0]} cy={HUB[1]} r={1.4} fill="#eaf7ff" />
    </svg>
  );
}

/**
 * Markaziy tugun ustidagi tuman yorlig'i - HAR DOIM ko'rinadi: kirish
 * animatsiyasi ham, hover holati ham yo'q, birinchi kadrdanoq joyida.
 */
function HubLabel() {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full"
      style={HUB_LABEL_STYLE}
    >
      <div className="relative rounded-lg border border-white/12 bg-[#0e1620] px-2.5 py-1.5 whitespace-nowrap shadow-[0_6px_18px_rgb(7_11_16/0.5)]">
        <p className="flex items-center gap-1.5 text-xs leading-4 font-semibold text-white">
          <span className="size-1.5 rounded-full bg-[#7ec8f0] shadow-[0_0_6px_#7ec8f0]" />
          Baliqchi tumani
        </p>
        {/* Pastga qaragan uch: 45° burilgan kvadrat, yuqori yarmi pufak
            ostida yashirinadi. */}
        <span className="absolute top-full left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 border-r border-b border-white/12 bg-[#0e1620]" />
      </div>
    </div>
  );
}

export function DistrictMap({ className }: { className?: string }) {
  return (
    // Panelni `PortalMap` dagi `sr-only` matn ta'riflaydi - bu sof bezak.
    // `size` konteyner - `HUB_LABEL_STYLE` dagi cqw/cqh shu qutiga tayanadi.
    <div aria-hidden="true" className={cn("@container-size", className)}>
      <MapArt />
      <CurrentArt />
      <HubLabel />
    </div>
  );
}
