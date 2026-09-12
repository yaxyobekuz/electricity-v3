import { Plinth } from "./Plinth";

/* ---------------------------------------------------------------------------
   Ichimlik suvi - suv minorasi.

   Bak: ust ellips z=58 (cy=26), pastki gardish z=40 (cy=44), rx=17.
   Oyoqlar bak ost halqasi r=13 (z=40) dan yer halqasi r=19 (z=0) gacha.
   --------------------------------------------------------------------------- */

const NEAR_LEGS: ReadonlyArray<readonly [number, number, number, number]> = [
  [77.26, 50.5, 82.45, 93.5],
  [54.74, 50.5, 49.55, 93.5],
];

const FAR_LEGS: ReadonlyArray<readonly [number, number, number, number]> = [
  [54.74, 37.5, 49.55, 74.5],
  [77.26, 37.5, 82.45, 74.5],
];

/** Zinapoyaning pog'onalari - yaqin-o'ng oyoq bo'ylab. */
const RUNGS = [56, 63, 70, 77, 84, 91];

export function TowerAsset() {
  return (
    <svg viewBox="0 0 132 132" fill="none" aria-hidden="true" className="size-full">
      <defs>
        <linearGradient id="watTank" x1="49" y1="0" x2="83" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#93c5fd" />
          <stop offset="0.46" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>

      <Plinth tone="water" />

      {/* Uzoq ikki oyoq. */}
      <g stroke="#1d4ed8" strokeWidth={1.5} strokeOpacity={0.5}>
        {FAR_LEGS.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>

      {/* Bog'lovchi halqalar (z=30 va z=16). */}
      <g fill="none" stroke="#1d4ed8" strokeWidth={0.8} strokeOpacity={0.4}>
        <path d="M66 61.75 L79.85 53.75 L66 45.75 L52.15 53.75 Z" />
        <path d="M66 76.5 L82.1 67.2 L66 57.9 L49.9 67.2 Z" />
      </g>

      {/* Yer manifoldi: quvur, shtutserlar va hisoblagich kubi. */}
      <g>
        <line x1="52" y1="97" x2="80" y2="81" stroke="#9aa3ad" strokeWidth={2} />
        <line x1="58" y1="93.5" x2="58" y2="88" stroke="#9aa3ad" strokeWidth={1.4} />
        <line x1="72" y1="85.5" x2="72" y2="80" stroke="#9aa3ad" strokeWidth={1.4} />
        <path d="M53.5 87 L58 84.5 L62.5 87 L58 89.5 Z" fill="#ffffff" />
        <path d="M53.5 87 L58 89.5 L58 96.5 L53.5 94 Z" fill="#eff6ff" />
        <path d="M58 89.5 L62.5 87 L62.5 94 L58 96.5 Z" fill="#cfd6dd" />
        <rect x="55" y="91" width="3" height="2" fill="#1d4ed8" fillOpacity={0.7} />
      </g>

      {/* Bak: konussimon ost, tasma va ust yuza. */}
      <path d="M49 44 L66 53 L83 44 Z" fill="#1d4ed8" />
      <path d="M49 26 L49 44 A17 9.8 0 0 0 83 44 L83 26 Z" fill="url(#watTank)" />
      <path
        d="M49 35 A17 9.8 0 0 0 83 35"
        fill="none"
        stroke="#1d4ed8"
        strokeWidth={0.8}
        strokeOpacity={0.35}
      />
      <ellipse cx="66" cy="26" rx="17" ry="9.8" fill="#a9d5ee" />
      <path
        d="M49 26 A17 9.8 0 0 1 83 26"
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.9}
        strokeOpacity={0.7}
      />

      {/* Sath oynasi - statik, animatsiya emas. */}
      <line x1="60" y1="30" x2="60" y2="42" stroke="#ffffff" strokeWidth={1.4} strokeOpacity={0.6} />
      <line x1="60" y1="37.4" x2="60" y2="42" stroke="#93c5fd" strokeWidth={1.4} />

      {/* Yaqin ikki oyoq va zinapoya. */}
      <g stroke="#1d4ed8" strokeWidth={2} strokeLinecap="round">
        {NEAR_LEGS.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <g stroke="#9aa3ad" strokeWidth={1.2}>
        <line x1="79.5" y1="52" x2="84.5" y2="93" />
        <line x1="81.9" y1="51.7" x2="86.9" y2="92.7" />
        {RUNGS.map((y) => (
          <line
            key={y}
            x1={79.9 + (y - 52) * 0.122}
            y1={y}
            x2={82.3 + (y - 52) * 0.122}
            y2={y - 0.3}
            strokeWidth={1}
          />
        ))}
      </g>
    </svg>
  );
}

/** Bak hajmi yorlig'i - alohida parallaks qatlami. */
export function TowerTag() {
  return (
    <svg viewBox="0 0 132 132" fill="none" aria-hidden="true" className="size-full">
      <line x1="78" y1="22" x2="92" y2="14" stroke="#1d4ed8" strokeWidth={1} strokeOpacity={0.5} />
      <rect x="92" y="7.5" width="34" height="13" rx="3.5" fill="#ffffff" stroke="#93c5fd" />
      <text x="109" y="16.5" textAnchor="middle" fontSize="8" fill="#1d4ed8" className="font-mono">
        250 m³
      </text>
    </svg>
  );
}
