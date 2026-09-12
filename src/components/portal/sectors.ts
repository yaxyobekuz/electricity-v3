/* ---------------------------------------------------------------------------
   Portal ekranidagi uchta tarmoq yo'nalishi.

   Ranglar SVG'ga PROP sifatida uzatiladi, `var()` orqali emas: SVG
   presentatsiya atributlarida (`fill="var(--x)"`) o'zgaruvchi hal
   qilinmaydi va shakl umuman chizilmaydi.
   --------------------------------------------------------------------------- */

export type SectorId = "power" | "gas" | "water";

export interface Sector {
  id: SectorId;
  /** Panel tepasidagi tartib raqami. */
  index: string;
  title: string;
  subtitle: string;
  /** Panel tepasidagi holat nishoni. */
  badge: string;
  /** `null` - platforma hali qurilmagan, havola o'rniga tugma chiziladi. */
  href: string | null;
  /** Futerdagi amal matni (faqat `href` mavjud bo'lsa). */
  cta: string | null;
  /** Tugma bosilganda ko'rsatiladigan izoh (faqat `href` `null` bo'lsa). */
  note: string | null;
  /** Futerdagi izoh (faqat `href` `null` bo'lsa). */
  footnote: string | null;
  /** Asosiy material rangi - yuklanish chizig'i va tugma foni uchun. */
  base: string;
  deep: string;
  tint: string;
}

export const SECTORS: readonly Sector[] = [
  {
    id: "power",
    index: "01",
    title: "Elektr energiyasi",
    subtitle:
      "Iste’mol, yo’qotish va hisoblagich ko’rsatkichlari bo’yicha to’liq tahlil.",
    badge: "Ishga tushgan",
    href: "/dashboard",
    cta: "Platformaga kirish",
    note: null,
    footnote: null,
    base: "#22c55e",
    deep: "#15803d",
    tint: "#effff0",
  },
  {
    id: "gas",
    index: "02",
    title: "Tabiiy gaz",
    subtitle: "Gaz taqsimoti, bosim va abonent hisobi moduli tayyorlanmoqda.",
    badge: "Tez orada",
    href: null,
    cta: null,
    note: "Tabiiy gaz platformasi hali ishga tushirilmagan.",
    footnote: "Modul ishlab chiqilmoqda",
    base: "#f59e0b",
    deep: "#b45309",
    tint: "#fff7ed",
  },
  {
    id: "water",
    index: "03",
    title: "Ichimlik suvi",
    subtitle:
      "Suv ta’minoti, sarf hisobi va tarmoq yo’qotishlari moduli tayyorlanmoqda.",
    badge: "Tez orada",
    href: null,
    cta: null,
    note: "Ichimlik suvi platformasi hali ishga tushirilmagan.",
    footnote: "Modul ishlab chiqilmoqda",
    base: "#3b82f6",
    deep: "#1d4ed8",
    tint: "#eff6ff",
  },
];

/** Kirish animatsiyasining pog'onali kechikishi (ms). */
export const SECTOR_DELAYS: readonly number[] = [140, 210, 280];
