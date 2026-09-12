import { Plinth } from "./Plinth";

/* ---------------------------------------------------------------------------
   Tabiiy gaz - sferik gazgolder.

   Sfera markazi (x=0, y=0, z=42) -> ekranda (66, 42), radius 26. Egrilik
   bitta sof radial ramp bilan beriladi: yaltiroq oq nuqta yo'q, chunki
   material matte.
   --------------------------------------------------------------------------- */

/** Oyoqlar: yer halqasi r=18 (z=0) -> sfera pastki halqasi r=13 (z=20). */
const NEAR_LEGS: ReadonlyArray<readonly [number, number, number, number]> = [
  [81.59, 93, 77.26, 70.5],
  [50.41, 93, 54.74, 70.5],
];

const FAR_LEGS: ReadonlyArray<readonly [number, number, number, number]> = [
  [50.41, 75, 54.74, 57.5],
  [81.59, 75, 77.26, 57.5],
];

export function SphereAsset() {
  return (
    <svg viewBox="0 0 132 132" fill="none" aria-hidden="true" className="size-full">
      <defs>
        <radialGradient
          id="gasSphere"
          cx="54"
          cy="30"
          r="34"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="0.52" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </radialGradient>
      </defs>

      <Plinth tone="gas" />

      {/* Uzoq ikki oyoq va z=10 dagi bog'lovchi halqa - sferadan orqada. */}
      <g stroke="#b45309" strokeWidth={1.5} strokeOpacity={0.5}>
        {FAR_LEGS.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      <path
        d="M66 89.5 L79.42 81.75 L66 74 L52.58 81.75 Z"
        fill="none"
        stroke="#b45309"
        strokeWidth={0.8}
        strokeOpacity={0.4}
      />

      {/* Quvur stoykasi va qo'l g'ildirakli ventil (x=24, y=0). */}
      <g>
        <path d="M87 79 L87 61 L91.5 63.5 L91.5 81.5 Z" fill="#b6bec7" />
        <path d="M91.5 63.5 L96 61 L96 79 L91.5 81.5 Z" fill="#9aa3ad" />
        <path d="M87 61 L91.5 58.5 L96 61 L91.5 63.5 Z" fill="#cfd6dd" />
        <line x1="91.5" y1="58.5" x2="80" y2="52" stroke="#9aa3ad" strokeWidth={1.6} />
        <ellipse
          cx="91.5"
          cy="55"
          rx="7"
          ry="4"
          fill="none"
          stroke="#b45309"
          strokeWidth={1.6}
        />
        <g stroke="#b45309" strokeWidth={1} strokeOpacity={0.7}>
          <line x1="84.5" y1="55" x2="98.5" y2="55" />
          <line x1="91.5" y1="51" x2="91.5" y2="59" />
        </g>
        <circle cx="91.5" cy="55" r="1.4" fill="#b45309" />
      </g>

      {/* Tana. */}
      <circle cx="66" cy="42" r="26" fill="url(#gasSphere)" />
      {/* Terminator - shakl o'qilishini kuchaytiradi. */}
      <ellipse
        cx="66"
        cy="42"
        rx="26"
        ry="9"
        fill="none"
        stroke="#b45309"
        strokeWidth={0.8}
        strokeOpacity={0.28}
      />
      <ellipse
        cx="66"
        cy="42"
        rx="9"
        ry="26"
        fill="none"
        stroke="#b45309"
        strokeWidth={0.8}
        strokeOpacity={0.28}
      />
      <circle
        cx="66"
        cy="42"
        r="26"
        fill="none"
        stroke="#b45309"
        strokeWidth={0.75}
        strokeOpacity={0.35}
      />

      {/* Yaqin ikki oyoq - sferaning oldida. */}
      <g stroke="#b45309" strokeWidth={2} strokeLinecap="round">
        {NEAR_LEGS.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>

      {/* Bosim manometri - kameraga qaragan eng yaqin obyekt. */}
      <g>
        <circle cx="52" cy="58" r="6.5" fill="#ffffff" stroke="#b45309" strokeWidth={1.2} />
        <g stroke="#b45309" strokeWidth={1} strokeOpacity={0.55}>
          <line x1="47.5" y1="55" x2="48.4" y2="55.9" />
          <line x1="50" y1="53.2" x2="50.4" y2="54.4" />
          <line x1="52" y1="52.5" x2="52" y2="53.8" />
          <line x1="54" y1="53.2" x2="53.6" y2="54.4" />
          <line x1="56.5" y1="55" x2="55.6" y2="55.9" />
        </g>
        <line x1="52" y1="58" x2="55.6" y2="55" stroke="#f59e0b" strokeWidth={1.1} />
      </g>
    </svg>
  );
}

/** Ish bosimi yorlig'i - alohida parallaks qatlami. */
export function SphereTag() {
  return (
    <svg viewBox="0 0 132 132" fill="none" aria-hidden="true" className="size-full">
      <line x1="80" y1="24" x2="92" y2="14" stroke="#b45309" strokeWidth={1} strokeOpacity={0.5} />
      <rect x="92" y="7.5" width="34" height="13" rx="3.5" fill="#ffffff" stroke="#fcd34d" />
      <text x="109" y="16.5" textAnchor="middle" fontSize="8" fill="#b45309" className="font-mono">
        6 bar
      </text>
    </svg>
  );
}
