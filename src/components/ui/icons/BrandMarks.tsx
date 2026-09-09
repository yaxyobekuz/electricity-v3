import type { SVGProps } from "react";

/*
 * Maketda "Excel" va "PDF" tugmalaridagi belgilar lucide emas, to'liq rangli
 * brend SVG'lari (`excel-svgrepo-com`, `pdf-svgrepo-com`). Figma MCP kvotasi
 * tugagani uchun original fayllar eksport qilinmadi - quyidagi geometriya
 * `.claude/figma/feeder/00-full.png` dan piksel bo'yicha o'lchab olingan
 * (belgi katagi 24x24, maketdagi o'rni 1641.44,993 va 1795.83,993).
 */

/**
 * Microsoft Excel belgisi: o'ngda 2 ustun x 4 qator katakli varaq (ranglar
 * diagonal bo'yicha quyuqlashadi), chapda varaqdan chiqib turgan, ichida oq
 * "X" bo'lgan plitka.
 */
export function ExcelMark({ width = 24, height = 24, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...rest}
    >
      <defs>
        {/* Plitka tekis emas: chap-yuqoridan o'ng-pastga quyuqlashadi. */}
        <linearGradient
          id="excelMarkTile"
          gradientUnits="userSpaceOnUse"
          x1="1.7"
          y1="6.62"
          x2="12.75"
          y2="17.44"
        >
          <stop stopColor="#178650" />
          <stop offset="1" stopColor="#0A6531" />
        </linearGradient>
      </defs>
      {/* Varaq 6.55,2.25 - 22.65,21.75; katak 8.05 x 4.875. */}
      <rect x="6.55" y="2.25" width="16.1" height="19.5" fill="#185C37" />
      <rect x="6.55" y="2.25" width="8.05" height="4.875" fill="#21A366" />
      <rect x="14.6" y="2.25" width="8.05" height="4.875" fill="#33C481" />
      <rect x="6.55" y="7.125" width="8.05" height="4.875" fill="#107C41" />
      <rect x="14.6" y="7.125" width="8.05" height="4.875" fill="#21A366" />
      <rect x="14.6" y="12" width="8.05" height="4.875" fill="#107C41" />
      {/* Plitka varaqning chap chetidan 4.85px chiqib turadi. */}
      <rect
        x="1.7"
        y="6.62"
        width="11.05"
        height="10.82"
        rx="1"
        fill="url(#excelMarkTile)"
      />
      <path
        d="M5.55 9.43 8.65 14.58M8.65 9.43 5.55 14.58"
        stroke="#fff"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** PDF belgisi: butun katakni egallagan qizil kvadrat, ichida oq "A". */
export function PdfMark({ width = 24, height = 24, ...rest }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      {...rest}
    >
      <rect width="24" height="24" rx="4" fill="#C80A0A" />
      {/* Glif kvadratning ~67% ini egallaydi va markazlashgan. */}
      <g transform="translate(-0.92 -2.98) scale(1.19)">
        <path
          d="M17.9 16.8c-.5.5-1.7.3-2.6.1-.9-.2-1.9-.5-3-.9-1.9.4-3.7 1-5.2 1.9-1.2.7-2.1 1.2-2.6.7-.2-.2-.2-.5-.1-.8.3-.7 1.4-1.4 3.2-2.1.9-1.5 1.8-3.3 2.5-5.1-.5-1.4-.9-2.9-.6-3.9.1-.4.4-.7.8-.7.3 0 .6.1.8.4.5.7.3 2.3-.2 4 .6 1.6 1.6 3 2.7 4 1.7 0 3.1.2 3.7.7.3.2.4.5.4.8 0 .3-.1.6-.3.9Zm-1-1c-.4-.3-1.3-.4-2.4-.4.8.6 1.6 1 2.2 1.1.4.1.6 0 .6-.1.1-.2 0-.4-.4-.6ZM9.2 15.7c1-.4 2.1-.7 3.2-.9-.8-.7-1.5-1.6-2-2.6-.4 1.2-.9 2.4-1.5 3.5h.3v0Zm2-8.2c-.1 0-.2.1-.2.2-.1.5 0 1.2.2 2 .2-.8.3-1.6.2-2-.1-.1-.1-.2-.2-.2Zm-5 10.7c.4-.1 1-.4 1.8-.9-.9.5-1.5.9-1.8 1.1v-.2Z"
          fill="#fff"
        />
      </g>
    </svg>
  );
}
