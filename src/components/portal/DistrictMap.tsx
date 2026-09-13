import { ANDIJON_REGION, BALIQCHI_DISTRICT, type Ring } from "@/lib/geo/boundaries";
import { NEIGHBOUR_DISTRICTS } from "@/lib/geo/districts";
import { fitBbox, ringToPath, type Projector } from "@/lib/geo/project";
import { growBbox } from "@/lib/geo/rings";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Portal ekranining bosh tasviri: Andijon viloyati tumanlari qorong'i
   "boshqaruv markazi" uslubida chizilgan vektor xarita.

   Google xaritasi ATAYLAB ishlatilmaydi - rastr plitkalarni bu ko'rinishga
   keltirib bo'lmaydi. Butun tasvir sof SVG, server tomonida bir marta
   hisoblanadi va mijozda hech qanday JS talab qilmaydi.

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

const NEIGHBOUR_PATHS = NEIGHBOUR_DISTRICTS.map((n) => ({
  id: n.id,
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
  return { id: n.id, x, y, dist: Math.hypot(x - HUB[0], y - HUB[1]) };
});

/**
 * Baliqchidan eng yaqin oltita tuman markazigacha bog'lovchi yoylar.
 * Ular tarmoqni emas, ma'muriy qo'shnilikni ko'rsatadi - shuning uchun
 * ataylab xira va yorliqsiz.
 */
const LINKS = [...NODES]
  .sort((a, b) => a.dist - b.dist)
  .slice(0, 6)
  .map((n) => {
    const mx = (HUB[0] + n.x) / 2;
    const my = (HUB[1] + n.y) / 2;
    // Yoyni perpendikulyar yo'nalishda biroz egamiz.
    const dx = n.x - HUB[0];
    const dy = n.y - HUB[1];
    const len = Math.hypot(dx, dy) || 1;
    const bend = Math.min(len * 0.16, 26);
    return {
      id: n.id,
      d: `M${HUB[0].toFixed(1)} ${HUB[1].toFixed(1)} Q${(mx - (dy / len) * bend).toFixed(1)} ${(
        my +
        (dx / len) * bend
      ).toFixed(1)} ${n.x.toFixed(1)} ${n.y.toFixed(1)}`,
    };
  });

/**
 * Fon to'rtburchagi viewBox'dan kattaroq: `preserveAspectRatio="meet"`
 * konteyner nisbati boshqacha bo'lganda bo'sh yo'l qoldiradi va u yerda
 * panel foni ko'rinib, ufqiy chok paydo bo'lardi.
 */
const BLEED = { x: -2000, y: -2000, width: 5000, height: 5000 } as const;

export function DistrictMap({ className }: { className?: string }) {
  return (
    // Panelni `PortalMap` dagi `sr-only` matn ta'riflaydi - bu sof bezak.
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className={cn("size-full", className)}
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

      {/* 4. Qo'shni tumanlar - ingichka nurli konturlar. */}
      <g fill="none" strokeLinejoin="round">
        <g stroke="#9cc4e8" strokeOpacity={0.16} strokeWidth={2.4} filter="url(#pmSoft)">
          {NEIGHBOUR_PATHS.map((n) => (
            <path key={n.id} d={n.d} />
          ))}
        </g>
        <g stroke="#a8c6e2" strokeOpacity={0.62} strokeWidth={0.8}>
          {NEIGHBOUR_PATHS.map((n) => (
            <path key={n.id} d={n.d} />
          ))}
        </g>
      </g>

      {/* 5. Qo'shnilik yoylari va tugunlari. */}
      <g fill="none" stroke="#9fd4f5" strokeOpacity={0.22} strokeWidth={0.8}>
        {LINKS.map((l) => (
          <path key={l.id} d={l.d} />
        ))}
      </g>
      <g>
        {NODES.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={5} fill="#9fd4f5" fillOpacity={0.16} />
            <circle cx={n.x} cy={n.y} r={1.7} fill="#cfeaff" fillOpacity={0.75} />
          </g>
        ))}
      </g>

      {/* 6. Faol tuman: nur -> to'ldirma -> yorqin kontur. */}
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

      {/* 7. Markaziy tugun. */}
      <circle cx={HUB[0]} cy={HUB[1]} r={7} fill="#2b6f9c" fillOpacity={0.3} />
      <circle cx={HUB[0]} cy={HUB[1]} r={3} fill="#1d5c86" fillOpacity={0.85} />
      <circle cx={HUB[0]} cy={HUB[1]} r={1.4} fill="#eaf7ff" />

      {/* 8. Vinyetka - hamma narsaning ustidan. */}
      <rect {...BLEED} fill="url(#pmVignette)" />
    </svg>
  );
}
