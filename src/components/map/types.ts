import type { GlyphIcon } from "@/components/ui/Icon";

/** Xarita ierarxiyasi darajasi: Podstansiya > Fider > TP > Abonent. */
export type MapLevel = "substation" | "feeder" | "tp" | "subscriber";

export interface MapStat {
  key: string;
  label: string;
  value: string;
  Icon: GlyphIcon;
}

export interface MapReportSlice {
  key: string;
  label: string;
  /** Donut segmenti uchun son. */
  value: number;
  /** Ekranda ko'rsatiladigan matn, masalan "1,234 mln kWh". */
  display: string;
  color: string;
}

export interface MapTopConsumer {
  id: string;
  label: string;
  value: string;
}

/** O'ng paneldagi ("Ma'lumotlar") to'liq ma'lumot to'plami. */
export interface MapNodeInfo {
  title: string;
  /** Birinchisi - katta rasm, qolganlari kichik eskizlar. */
  gallery: string[];
  stats: MapStat[];
  report: MapReportSlice[];
  responsible: string;
  topConsumers: MapTopConsumer[];
}

export interface MapLocation {
  id: string;
  label: string;
  level: MapLevel;
  lat: number;
  lng: number;
  zoom: number;
  info: MapNodeInfo;
  children?: MapLocation[];
}
