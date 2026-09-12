import { Plinth } from "./Plinth";

/* ---------------------------------------------------------------------------
   Elektr energiyasi - panjarali elektr uzatish tayanchi.

   Barcha cho'qqilar `Plinth.tsx` dagi izometrik formuladan hisoblangan:
   oyoq asosi yarim tomoni 13 (z=0), tepasi 5 (z=62). Uzoqlik BLUR bilan
   emas, chiziq qalinligi va shaffofligi bilan beriladi.
   --------------------------------------------------------------------------- */

/** Gorizontal bog'lovchi halqalar: [z, old, o'ng, orqa, chap] ekran nuqtalari. */
const BRACE_RINGS: ReadonlyArray<string> = [
  "M66 81.2 L85.4 70 L66 58.8 L46.6 70 Z",
  "M66 60.87 L81.36 52 L66 43.13 L50.64 52 Z",
  "M66 42.81 L77.8 36 L66 29.19 L54.2 36 Z",
];

/** Yaqin ikki oyoq orasidagi X-bog'lash (pastdan yuqoriga uch band). */
const CROSS_BRACES: ReadonlyArray<string> = [
  "M66 97 L88.5 70 M88.5 84 L66 81.2",
  "M66 81.2 L81.36 52 M85.4 70 L66 60.87",
  "M66 60.87 L77.8 36 M81.36 52 L66 42.81",
];

/** Izolyator: 4.5px vertikal shtir va ostidagi disk. */
function Insulator({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 4.5} stroke="#9aa3ad" strokeWidth={1.1} />
      <circle cx={x} cy={y + 4.5} r={1.6} fill="#cfd6dd" />
    </g>
  );
}

export function PylonAsset() {
  return (
    <svg viewBox="0 0 132 132" fill="none" aria-hidden="true" className="size-full">
      <Plinth tone="power" />

      {/* O'tkazgichlar - jism ortida, poydevor siluetida tugaydi. */}
      <g stroke="#15803d" strokeWidth={0.9} strokeOpacity={0.4} strokeLinecap="round" fill="none">
        <path d="M40.02 19 Q52 30 66 32" />
        <path d="M91.98 49 Q108 58 132 68" />
        <path d="M48.68 12 Q60 22 72 24" />
      </g>

      {/* Uzoq ikki oyoq - ingichka va shaffofroq. */}
      <g stroke="#15803d" strokeWidth={1.6} strokeOpacity={0.5}>
        <line x1="66" y1="71" x2="66" y2="17" />
        <line x1="43.5" y1="84" x2="57.34" y2="22" />
      </g>

      {/* Bog'lovchi halqalar va X-bog'lashlar. */}
      <g fill="none" stroke="#15803d">
        {BRACE_RINGS.map((d) => (
          <path key={d} d={d} strokeWidth={0.9} strokeOpacity={0.45} />
        ))}
        {CROSS_BRACES.map((d) => (
          <path key={d} d={d} strokeWidth={0.7} strokeOpacity={0.32} />
        ))}
      </g>

      {/* Yaqin ikki oyoq - qalin va to'yingan. */}
      <g stroke="#22c55e" strokeWidth={2.2} strokeLinecap="round">
        <line x1="66" y1="97" x2="66" y2="27" />
        <line x1="88.5" y1="84" x2="74.66" y2="22" />
      </g>

      {/* Traversalar: asosiy chiziq + ustida yorug' qirra. */}
      <g strokeLinecap="round">
        <line x1="40.02" y1="19" x2="91.98" y2="49" stroke="#22c55e" strokeWidth={2.6} />
        <line x1="40.02" y1="18" x2="91.98" y2="48" stroke="#86efac" strokeWidth={1} />
        <line x1="48.68" y1="12" x2="83.32" y2="32" stroke="#22c55e" strokeWidth={2.2} />
        <line x1="48.68" y1="11" x2="83.32" y2="31" stroke="#86efac" strokeWidth={1} />
      </g>

      {/* Izolyatorlar - har traversada markaz va ikki uch. */}
      <Insulator x={40.02} y={19} />
      <Insulator x={66} y={34} />
      <Insulator x={91.98} y={49} />
      <Insulator x={48.68} y={12} />
      <Insulator x={83.32} y={32} />
    </svg>
  );
}

/** Obyekt yonidagi texnik yorliq - alohida qatlam (kuchliroq parallaks). */
export function PylonTag() {
  return (
    <svg viewBox="0 0 132 132" fill="none" aria-hidden="true" className="size-full">
      <line x1="66" y1="27" x2="92" y2="14" stroke="#15803d" strokeWidth={1} strokeOpacity={0.5} />
      <rect x="92" y="7.5" width="34" height="13" rx="3.5" fill="#ffffff" stroke="#86efac" />
      <text x="109" y="16.5" textAnchor="middle" fontSize="8" fill="#15803d" className="font-mono">
        10 kV
      </text>
    </svg>
  );
}
