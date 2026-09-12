/* eslint-disable @typescript-eslint/no-explicit-any */

/* ---------------------------------------------------------------------------
   Google Maps JS API yuklovchisi. `MapCanvas.tsx` dagi variantdan ikkita
   farqi bor: rad etilgan promise keshlanmaydi (qayta urinish mumkin) va
   `gm_authFailure` bitta uyacha emas, obunachilar to'plami.
   `MapCanvas` ni shu modulga o'tkazish - alohida ish.
   --------------------------------------------------------------------------- */

let loaderPromise: Promise<void> | null = null;

const authSubscribers = new Set<() => void>();

/** Skriptni bir marta yuklaydi; keyingi chaqiruvlar o'sha promise'ni oladi. */
export function loadGoogleMaps(key: string): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).google?.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    // MapCanvas o'z yuklovchisida `__electricityInitGmap` ni ishlatadi - bir
    // sahifada ikkalasi uchrasa, keyingisi oldingisining callback'ini bosib
    // ketardi va o'sha promise abadiy hal bo'lmay qolardi.
    const callbackName = "__portalInitGmap";
    (window as any)[callbackName] = () => resolve();
    const script = document.createElement("script");
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(key) +
      "&v=weekly&loading=async&callback=" +
      callbackName;
    script.async = true;
    script.onerror = () => reject(new Error("Google Maps yuklanmadi"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // Muvaffaqiyatsiz promise keshlanib qolsa, keyingi urinish ham darrov
    // rad etiladi - shuning uchun keshni tozalaymiz.
    loaderPromise = null;
    throw error;
  });

  return loaderPromise;
}

/**
 * Kalit rad etilganda (`gm_authFailure`) chaqiriladi. Bir nechta xarita bir
 * vaqtda ochiq bo'lishi mumkin, shuning uchun obuna to'plam orqali.
 */
export function onAuthFailure(handler: () => void): () => void {
  authSubscribers.add(handler);
  (window as any).gm_authFailure = () => {
    authSubscribers.forEach((fn) => fn());
  };
  return () => {
    authSubscribers.delete(handler);
  };
}
