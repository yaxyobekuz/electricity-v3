/*
 * Qidiruv sahifasi (server) va `SearchScreen` (mijoz) orasidagi oddiy
 * (serializable) ma'lumot shakllari. Matnlar serverda `format.ts` orqali
 * tayyorlanadi - mijoz faqat chizadi.
 */

/** Natija turi - guruhlash, filtr va nishon rangi shu bo'yicha. */
export type SearchKind =
  | "substation"
  | "feeder"
  | "transformer"
  | "subscriber"
  | "violation"
  | "appeal"
  | "staff";

/** Chap paneldagi filtr qiymati. */
export type SearchFilter = "all" | SearchKind;

export interface SearchHit {
  id: string;
  title: string;
  /** Shablon maydonlari " · " bilan birlashtirilgan. */
  subtitle: string;
  href: string;
}

export interface SearchHitGroup {
  kind: SearchKind;
  /** Aniq son; shablon shu oyga yuklanmagan bo'lsa - null. */
  total: number | null;
  /** Birinchi 20 tasi. */
  hits: SearchHit[];
  /** Shu so'rov bilan filtrlangan reyestr; reyestrda qidiruv bo'lmasa - null. */
  registryHref: string | null;
}
