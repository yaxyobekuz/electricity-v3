import type { Ring } from "./boundaries";

/* ---------------------------------------------------------------------------
   Lat/lng -> SVG viewBox proyeksiyasi. Google Maps ham Web Merkatorda
   chizadi, shuning uchun zaxira SVG aynan shu proyeksiyani ishlatadi -
   jonli xaritaga o'tishda tuman sakramaydi.
   --------------------------------------------------------------------------- */

const DEG = Math.PI / 180;

/**
 * Web Merkator: kenglikni "gradusga o'xshash" Y qiymatga aylantiradi.
 * Ekvatorial variant (x = lng * cos(lat0), y = lat) Baliqchi kengligida
 * deyarli bir xil natija beradi, ammo Merkator Google chizganiga aynan mos.
 */
export function mercatorY(lat: number): number {
  return (Math.log(Math.tan(Math.PI / 4 + (lat * DEG) / 2)) * 180) / Math.PI;
}

/** Geografik nuqtani viewBox koordinatasiga o'tkazuvchi funksiya. */
export type Projector = (lng: number, lat: number) => readonly [number, number];

/**
 * bbox ni `width` x `height` maydoniga nisbatni saqlagan holda sig'diradi
 * ("contain"). Jonli xaritadagi `fitBounds` ham shunday ishlaydi.
 */
export function fitBbox(
  bbox: readonly [number, number, number, number],
  width: number,
  height: number,
  pad = 0,
): Projector {
  const [minLng, minLat, , maxLat] = bbox;
  const yTop = mercatorY(maxLat);
  const w = bbox[2] - minLng;
  // `yTop` - eng KATTA kenglik, shuning uchun ayirma shu tartibda: teskarisi
  // manfiy balandlik va manfiy masshtab beradi, u esa X o'qini ko'zguga
  // aylantirib qo'yadi (Y da ikki manfiylik bir-birini yo'qotib, xato
  // ko'rinmay qoladi).
  const h = yTop - mercatorY(minLat);
  const scale = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
  const ox = (width - w * scale) / 2;
  const oy = (height - h * scale) / 2;
  return (lng, lat) => [ox + (lng - minLng) * scale, oy + (yTop - mercatorY(lat)) * scale];
}

/** Nuqtalar ro'yxatidan yopiq SVG `d` satrini yig'adi. */
function pointsToPath(
  points: ReadonlyArray<readonly [number, number]>,
  decimals = 1,
): string {
  let d = "";
  for (let i = 0; i < points.length; i++) {
    d += (i ? "L" : "M") + points[i][0].toFixed(decimals) + " " + points[i][1].toFixed(decimals);
  }
  return d + "Z";
}

/** Chegara halqasini to'g'ridan-to'g'ri SVG `d` satriga o'tkazadi. */
export function ringToPath(ring: Ring, project: Projector, decimals = 1): string {
  const points = ring.map(([lng, lat]) => project(lng, lat));
  return pointsToPath(points, decimals);
}
