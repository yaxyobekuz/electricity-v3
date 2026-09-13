import { BALIQCHI_DISTRICT, type Ring } from "./boundaries";

/* ---------------------------------------------------------------------------
   Chegara halqalari ustidagi geometrik yordamchilar. Halqalar `boundaries.ts`
   da GeoJSON tartibida ([lng, lat]) saqlanadi, Google Maps esa {lat, lng}
   kutadi - almashtirish faqat shu yerdagi `toPath` orqali bajariladi.
   --------------------------------------------------------------------------- */

/**
 * [lng, lat] -> Google `{lat, lng}`. Tartib almashtirilsa xato chiqmaydi
 * (71.9 kenglik ham, 40.8 uzunlik ham qonuniy qiymat), shuning uchun
 * konvertatsiya butun loyihada faqat shu funksiya orqali o'tadi.
 */
export function toPath(ring: Ring): Array<{ lat: number; lng: number }> {
  return ring.map(([lng, lat]) => ({ lat, lng }));
}

/** bbox ni har tomonga o'z o'lchamining `k` ulushicha kengaytiradi. */
export function growBbox(
  bbox: readonly [number, number, number, number],
  k: number,
): readonly [number, number, number, number] {
  const dx = (bbox[2] - bbox[0]) * k;
  const dy = (bbox[3] - bbox[1]) * k;
  return [bbox[0] - dx, bbox[1] - dy, bbox[2] + dx, bbox[3] + dy];
}

// Ma'lumot fayli qo'lda tahrirlanib koordinata tartibi almashib qolsa, buni
// ekranda emas, konsolda darrov ko'rish uchun.
if (process.env.NODE_ENV !== "production") {
  const [lng, lat] = BALIQCHI_DISTRICT.rings[0][0];
  console.assert(
    lng > 70 && lng < 74 && lat > 40 && lat < 42,
    "boundaries.ts: [lng, lat] tartibi buzilgan",
  );
}
