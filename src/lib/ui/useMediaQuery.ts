"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * CSS media so'roviga obuna bo'ladi.
 *
 * `useEffect` + `setState` emas, `useSyncExternalStore`: `matchMedia` tashqi
 * manba va uni shu yo'l bilan o'qish serverdagi qiymat bilan mos keladi
 * hamda ortiqcha qayta renderni keltirib chiqarmaydi.
 *
 * Serverda doim `false` qaytadi, shuning uchun media so'rovga bog'liq
 * ko'rinish CSS bilan ham qoplangan bo'lishi kerak.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
