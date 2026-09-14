/*
 * Reestr sahifalari (qoidabuzarliklar, murojaatlar) URL parametrlari uchun
 * yordamchilar. Bu modulda "use client" yo'q: qiymatlari server sahifada ham,
 * mijoz yo'lagida ham oddiy qiymat bo'lib qoladi (mijoz modulidan server
 * komponentga import qilingan konstanta mijoz havolasiga aylanib qoladi).
 */

/** "Barchasi" chipining qiymati - URL da parametr yo'q. */
export const ALL_CHIP = "all";

/** Sahifa `searchParams` qiymatining birinchi satri. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Joriy parametrlardan `scope` siz havola - "Butun tuman" tugmasi uchun. */
export function withoutScopeHref(path: string, params: Record<string, string | undefined>): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== "scope" && value) next.set(key, value);
  }
  const query = next.toString();
  return query ? `${path}?${query}` : path;
}
