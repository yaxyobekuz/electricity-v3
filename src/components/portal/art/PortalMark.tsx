import type { SVGProps } from "react";

/**
 * Portal sarlavhasidagi belgi: asbob retikuli (nishon halqasi) uslubida.
 * Davlat gerbi EMAS - bu shunchaki tizim belgisi. Rang `currentColor` dan.
 */
export function PortalMark({ width = 24, height = 24, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      <circle
        cx="12"
        cy="12"
        r="10.5"
        stroke="currentColor"
        strokeWidth={1.2}
        strokeOpacity={0.35}
      />
      <path
        d="M12 5.6 L17.54 8.8 L17.54 15.2 L12 18.4 L6.46 15.2 L6.46 8.8 Z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth={1.1} strokeOpacity={0.55} strokeLinecap="round">
        <path d="M18.6 5.4 L20.3 3.7" />
        <path d="M18.6 18.6 L20.3 20.3" />
        <path d="M5.4 18.6 L3.7 20.3" />
        <path d="M5.4 5.4 L3.7 3.7" />
      </g>
    </svg>
  );
}
