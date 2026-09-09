import type { ComponentType } from "react";

/** Lucide ikonkasi ham, mahalliy SVG glifi ham mos keladigan umumiy tip. */
export type GlyphIcon = ComponentType<{
  width?: number | string;
  height?: number | string;
  strokeWidth?: number | string;
  className?: string;
}>;

/**
 * Figma maketida barcha ikonkalar **1.5px absolyut** chiziq qalinligida
 * chizilgan (o'lchamdan qat'i nazar). Lucide viewBox'i 24 birlik, shuning
 * uchun ekrandagi qalinlik `1.5 * 24 / size` bo'lishi kerak.
 *
 * 32px -> 1.125 | 24px -> 1.5 | 20px -> 1.8 | 18px -> 2 | 16px -> 2.25
 */
export function strokeFor(size: number): number {
  return 36 / size;
}

/** Maketga mos qalinlikni avtomatik hisoblab beruvchi ikonka o'ramchisi. */
export function Icon({
  icon: Glyph,
  size = 24,
  className,
}: {
  icon: GlyphIcon;
  size?: number;
  className?: string;
}) {
  return (
    <Glyph width={size} height={size} strokeWidth={strokeFor(size)} className={className} />
  );
}
