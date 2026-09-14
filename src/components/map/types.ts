/*
 * Xarita sahifasi (server) va `MapScreen` (mijoz) orasidagi oddiy
 * (serializable) shakllar. Matnlar serverda `format.ts` orqali tayyorlanadi;
 * ikonkalar komponent emas, matn kalit - mijoz o'zi ikonkaga aylantiradi.
 */

/** Ikonka kaliti (`icons.ts` dagi `MAP_ICONS` jadvali). */
export type MapIconKey =
  | "district"
  | "substation"
  | "feeder"
  | "transformer"
  | "subscriber"
  | "online"
  | "offline"
  | "debt"
  | "credit"
  | "violation"
  | "appeal"
  | "kind";

/** Sidebar va "eng ko'p" ro'yxatidagi havola. */
export interface MapLink {
  key: string;
  label: string;
  href: string;
  icon: MapIconKey;
}

export interface MapChildList {
  /** "Fiderlar" */
  title: string;
  /** "12 ta"; shablon yuklanmagan bo'lsa - null. */
  countLabel: string | null;
  items: MapLink[];
  /** Ro'yxat bo'sh yoki shablon yuklanmagan bo'lsa - izoh. */
  emptyText: string | null;
  /** Ro'yxat kesilgan bo'lsa - izoh va to'liq reyestrga havola. */
  truncated: { text: string; href: string; linkLabel: string } | null;
}

/** Xaritadagi nuqta. `current` - tugunning o'zi, qolganlari - bolalar. */
export interface MapPin {
  id: string;
  lat: number;
  lng: number;
  label: string;
  kind: "current" | "substation" | "transformer" | "subscriber";
  /** Bosilganda ochiladigan `/map?node=...`; tugunning o'zida - null. */
  href: string | null;
}

export interface MapStat {
  key: string;
  label: string;
  value: string;
  icon: MapIconKey;
  /** Qiymat uzun (pul, holat) - ikki ustunni egallaydi. */
  wide?: boolean;
  /** Shu son ochiladigan reyestr. */
  href?: string | null;
}

export interface MapEnergy {
  total: string;
  useful: string;
  loss: string;
  /** "12,4%" yoki "—". */
  lossPercent: string;
  /** Donut: Foydali oqim va Yo'qotish; manfiy/nol qiymatda - null (donut chizilmaydi). */
  donut: { useful: number; loss: number } | null;
}

export interface MapTopList {
  title: string;
  items: (MapLink & { value: string })[];
  /** Ro'yxat bo'sh yoki shablon yuklanmagan bo'lsa - izoh. */
  emptyText: string | null;
  /** Qiymat rangi: qarzdorlik - qizil, energiya - oddiy. */
  tone: "neutral" | "bad";
}

export interface MapInfo {
  /** "Podstansiya" */
  kindLabel: string;
  title: string;
  /** "Sentabr 2026" */
  periodLabel: string;
  /** Tanlangan oyda holat yo'q - panel shu matnli bo'sh holatni ko'rsatadi. */
  emptyText: string | null;
  stats: MapStat[];
  /** Energiya bloki; tugunda energiya bo'lmasa (abonent) - null. */
  energy: MapEnergy | null;
  /** Energiya manbasi yuklanmagan bo'lsa - izoh (`energy` null bo'ladi). */
  energyEmptyText: string | null;
  staff: { name: string; href: string } | null;
  top: MapTopList | null;
  detail: { href: string; label: string };
}

export interface MapViewProps {
  /** Tugun kaliti ("district", "transformer:<id>") - mijoz holatini tiklash uchun. */
  nodeKey: string;
  current: { label: string; icon: MapIconKey };
  parent: MapLink | null;
  children: MapChildList | null;
  pins: MapPin[];
  /** Xarita ustidagi izoh (chizilgan markerlar, kesilgan ro'yxat, koordinatasi yo'q obyektlar). */
  mapNote: { text: string; /** Koordinatasi yo'q obyekt bor - ikonka "pin-off". */ missing: boolean } | null;
  info: MapInfo;
}
