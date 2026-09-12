import type { SectorId } from "../sectors";

/* ---------------------------------------------------------------------------
   Uchala obyekt turadigan umumiy izometrik poydevor.

   Izometrik proyeksiya (butun `art/` papkasida bir xil):
     X (sharq)  = (+cos30, +sin30)
     Y (shimol) = (-cos30, +sin30)
     Z (yuqori) = (0, -1)
     screenX = 66 + (x - y) * 0.866
     screenY = 84 + (x + y) * 0.5 - z
   Yer sathining markazi - (66, 84).

   Yorug'lik yuqori-chapdan. Uch tekis qiymat: ust yuza yorug', chap yuza
   asosiy, o'ng yuza quyuq. Spekular yorqinlik va `drop-shadow` yo'q -
   material matte bo'lib qolsin.
   --------------------------------------------------------------------------- */

/** Ust yuzadagi kadastr to'ri - diagonal o'qlarga parallel 3+3 chiziq. */
const GRID_LINES: ReadonlyArray<readonly [number, number, number, number]> = [
  // X o'qiga parallel (b = -0.25, 0, +0.25)
  [52, 60, 108, 92],
  [38, 68, 94, 100],
  [24, 76, 80, 108],
  // Y o'qiga parallel (a = -0.25, 0, +0.25)
  [80, 60, 24, 92],
  [94, 68, 38, 100],
  [108, 76, 52, 108],
];

export function Plinth({ tone }: { tone: SectorId }) {
  const topId = `plinthTop-${tone}`;
  const clipId = `plinthClip-${tone}`;

  return (
    <g>
      <defs>
        <linearGradient id={topId} x1="10" y1="52" x2="122" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f4f6f8" />
          <stop offset="1" stopColor="#eceff2" />
        </linearGradient>
        <clipPath id={clipId}>
          <path d="M66 52 L122 84 L66 116 L10 84 Z" />
        </clipPath>
      </defs>

      {/* Ust yuza + kadastr to'ri */}
      <path d="M66 52 L122 84 L66 116 L10 84 Z" fill={`url(#${topId})`} />
      <g clipPath={`url(#${clipId})`}>
        {GRID_LINES.map(([x1, y1, x2, y2]) => (
          <line
            key={`${x1}-${y1}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#d8dee4"
            strokeWidth={0.5}
          />
        ))}
      </g>

      {/* Ekstruziya: chap yuza asosiy, o'ng yuza quyuq */}
      <path d="M10 84 L66 116 L66 127 L10 95 Z" fill="#dfe4e9" />
      <path d="M66 116 L122 84 L122 95 L66 127 Z" fill="#cdd4da" />

      {/* Qirralar */}
      <path
        d="M10 84 L66 52 L122 84"
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.9}
        strokeOpacity={0.8}
      />
      <path d="M10 95 L66 127 L122 95" fill="none" stroke="#b9c1c9" strokeWidth={0.7} />
    </g>
  );
}

/** Obyekt ostidagi kontakt soyasi - alohida DOM qatlamida (parallaks uchun). */
export function ContactShadow({ tone }: { tone: SectorId }) {
  const blurId = `artBlur-${tone}`;

  return (
    <svg viewBox="0 0 132 132" fill="none" aria-hidden="true" className="size-full">
      <defs>
        {/* Blur SVG ICHIDA - CSS `filter` bo'lsa Safari 3D ni tekislaydi. */}
        <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <ellipse
        cx="66"
        cy="88"
        rx="30"
        ry="14"
        fill="#101828"
        fillOpacity="0.2"
        filter={`url(#${blurId})`}
      />
    </svg>
  );
}
