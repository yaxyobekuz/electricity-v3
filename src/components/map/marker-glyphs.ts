/*
 * Google xaritasi markerlari React emas, HTML matn - shuning uchun obyekt
 * ikonkalari shu yerda SVG matn sifatida chiziladi. Glif'lar chap panel
 * (`shell/nav.ts`) bilan bir xil: lucide-react 1.41 dagi `Factory`,
 * `Workflow`, `CircuitBoard` va `Users` ning `__iconNode` qiymatlari.
 */

export type MarkerObjectKind = "substation" | "feeder" | "transformer" | "subscriber";

type GlyphNode = readonly [tag: "path" | "rect" | "circle", attrs: Readonly<Record<string, string>>];

const GLYPHS: Record<MarkerObjectKind, readonly GlyphNode[]> = {
  substation: [
    ["path", { d: "M12 16h.01" }],
    ["path", { d: "M16 16h.01" }],
    [
      "path",
      {
        d: "M3 19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a.5.5 0 0 0-.769-.422l-4.462 2.844A.5.5 0 0 1 15 10.5v-2a.5.5 0 0 0-.769-.422L9.77 10.922A.5.5 0 0 1 9 10.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2z",
      },
    ],
    ["path", { d: "M8 16h.01" }],
  ],
  feeder: [
    ["rect", { width: "8", height: "8", x: "3", y: "3", rx: "2" }],
    ["path", { d: "M7 11v4a2 2 0 0 0 2 2h4" }],
    ["rect", { width: "8", height: "8", x: "13", y: "13", rx: "2" }],
  ],
  transformer: [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
    ["path", { d: "M11 9h4a2 2 0 0 0 2-2V3" }],
    ["circle", { cx: "9", cy: "9", r: "2" }],
    ["path", { d: "M7 21v-4a2 2 0 0 1 2-2h4" }],
    ["circle", { cx: "15", cy: "15", r: "2" }],
  ],
  subscriber: [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
    ["path", { d: "M16 3.128a4 4 0 0 1 0 7.744" }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }],
    ["circle", { cx: "9", cy: "7", r: "4" }],
  ],
};

/** Marker `kind` qiymati ("tp", "transformer", ...) -> obyekt turi; noma'lumi - null. */
export function markerObjectKind(kind: string | undefined): MarkerObjectKind | null {
  if (kind === "tp") return "transformer";
  return kind && kind in GLYPHS ? (kind as MarkerObjectKind) : null;
}

/** Maketdagi 1.5px absolyut chiziq: viewBox 24 bo'lgani uchun 36/size. */
export function objectGlyphSvg(kind: MarkerObjectKind, size: number, color: string): string {
  const shapes = GLYPHS[kind]
    .map(([tag, attrs]) => {
      const list = Object.entries(attrs)
        .map(([name, value]) => `${name}="${value}"`)
        .join(" ");
      return `<${tag} ${list}/>`;
    })
    .join("");
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="${36 / size}" stroke-linecap="round" stroke-linejoin="round" ` +
    `style="display:block;color:${color}">${shapes}</svg>`
  );
}

/** Oq yumaloq kvadrat ichida obyekt glifi. */
export function objectChip(
  kind: MarkerObjectKind,
  { size, radius, glyph, color, background = "#ffffff" }: {
    size: number;
    radius: number;
    glyph: number;
    color: string;
    background?: string;
  },
): string {
  return (
    `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;` +
    `justify-content:center;border-radius:${radius}px;background:${background};` +
    'box-shadow:0 2px 6px rgba(0,0,0,.18);">' +
    objectGlyphSvg(kind, glyph, color) +
    "</div>"
  );
}
