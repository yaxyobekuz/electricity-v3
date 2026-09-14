import {
  type RingGeometry,
  RingStatsCard,
  type StatRing,
} from "@/components/cards/RingStatsCard";
import type { HomeRingData } from "@/lib/queries/home-data";

/*
 * Ikkala karta ham "Qarzdorlik" shablonidan (`RingStatsCard`) ko'chirilgan:
 * 180x169 diagramma, 0-100 shkala (qadam 20), 2x2 legenda.
 *
 * Yoy uzunligi - shu kartaning o'z jami sonidagi ulush (%), shuning uchun
 * shkala 100 da tugaydi. Sonlar legendada va jadvalda.
 */

const PERCENT_TICKS = ["0", "20", "40", "60", "80", "100"] as const;

/**
 * Bu maketda halqa markazi 180x169 kadrning (94.84, 90.94) nuqtasida
 * (`Series` va `Annotations` qutilarining markazi) - "Qarzdorlik"dagidan
 * 1.3 / 0.9px o'ngda va pastda. Yorliqlar `PolarGrid` matn qutilarining
 * markazidan, oy nomi `DataLabels` dan olingan.
 */
const HOME_GEOMETRY: RingGeometry = {
  margin: { top: 21.94, right: 54.72, bottom: 9.06, left: 65.28 },
  ticks: [
    { x: 0.39, y: -83.99 },
    { x: 67.16, y: -53.67 },
    { x: 77.62, y: 23.88 },
    { x: 30.32, y: 71.1 },
    { x: -51.61, y: 60.66 },
    { x: -84.39, y: -4.64 },
  ],
  month: { x: -35.58, y: -49.58 },
};

/** Maketdagi ranglar, halqa kaliti bo'yicha (hisoblagich holati / murojaat holati). */
const RING_COLOR: Record<string, string> = {
  total: "#3cc3df",
  ONLINE: "#55c4ae",
  NOT_RESPONDING: "#ff928a",
  SCHEME_CHANGED: "#ffae4c",
  RESOLVED: "#55c4ae",
  REJECTED: "#ff928a",
  IN_PROGRESS: "#8979ff",
  OVERDUE: "#ffae4c",
};

function toRings(data: HomeRingData): StatRing[] {
  return data.rings.map((ring) => ({ ...ring, color: RING_COLOR[ring.id] ?? "#3cc3df" }));
}

/** "Hisoblagichlar holati" (Figma `4126:680`, 321.78x336) - abonentlar ro'yxatidagi holatlar. */
export function MetersCard({ data, className }: { data: HomeRingData; className?: string }) {
  return (
    <RingStatsCard
      className={className}
      title="Hisoblagichlar holati"
      rings={toRings(data)}
      max={100}
      tickLabels={PERCENT_TICKS}
      month={data.month}
      scaleUnit="%"
      columns={["Holat", "Soni"]}
      summary={data.summary}
      empty={data.empty}
      geometry={HOME_GEOMETRY}
    />
  );
}

/**
 * "Murojaatlar" (Figma `4301:2515`, 321.78x336). Umumiy son legendada emas,
 * diagramma maydonining chap yuqori burchagida nuqtasiz yorliq sifatida.
 */
export function AppealsCard({ data, className }: { data: HomeRingData; className?: string }) {
  return (
    <RingStatsCard
      className={className}
      title="Murojaatlar"
      rings={toRings(data)}
      max={100}
      tickLabels={PERCENT_TICKS}
      month={data.month}
      scaleUnit="%"
      columns={["Holat", "Soni"]}
      summary={data.summary}
      empty={data.empty}
      geometry={HOME_GEOMETRY}
    />
  );
}
