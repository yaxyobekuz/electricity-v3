import {
  type RingGeometry,
  RingStatsCard,
  type StatRing,
} from "@/components/cards/RingStatsCard";

/*
 * Ikkala karta ham "Qarzdorlik" shablonidan (`RingStatsCard`) ko'chirilgan:
 * 180x169 diagramma, 0-100 shkala (qadam 20), 2x2 legenda.
 *
 * Yoy uzunligi - umumiy sonning ulushi (%), shuning uchun shkala 100 da
 * tugaydi. Maketda yoylar alohida chizilmagan (faqat `Series` guruhi bor).
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

/** Maketdagi umumiy son - ikkala kartada ham 2,253. */
const TOTAL = 2253;

const share = (count: number) => (count / TOTAL) * 100;

const METER_RINGS: readonly StatRing[] = [
  { id: "total", label: "Umumiy", amount: "2,253 ta", arc: 100, color: "#3cc3df" },
  { id: "online", label: "Aloqada", amount: "1900 ta", arc: share(1900), color: "#55c4ae" },
  {
    id: "offline",
    label: "Aloqaga chiqmayotgan",
    amount: "153 ta",
    arc: share(153),
    color: "#ff928a",
  },
  {
    id: "rewired",
    label: "Sxemasi o’zgartirilgan",
    amount: "100 ta",
    arc: share(100),
    color: "#ffae4c",
  },
];

const APPEAL_RINGS: readonly StatRing[] = [
  {
    id: "resolved",
    label: "Ijobiy hal etilgan",
    amount: "1900 ta",
    arc: share(1900),
    color: "#55c4ae",
  },
  { id: "rejected", label: "Rad etilgan", amount: "55 ta", arc: share(55), color: "#ff928a" },
  { id: "pending", label: "Jarayonda", amount: "153 ta", arc: share(153), color: "#8979ff" },
  { id: "overdue", label: "Muddati buzilgan", amount: "45 ta", arc: share(45), color: "#ffae4c" },
];

/** "Hisoblagichlar holati" (Figma `4126:680`, 321.78x336). */
export function MetersCard({ className }: { className?: string }) {
  return (
    <RingStatsCard
      className={className}
      title="Hisoblagichlar holati"
      rings={METER_RINGS}
      max={100}
      tickLabels={PERCENT_TICKS}
      columns={["Holat", "Soni"]}
      geometry={HOME_GEOMETRY}
    />
  );
}

/**
 * "Murojaatlar" (Figma `4301:2515`, 321.78x336). Umumiy son legendada emas,
 * diagramma maydonining chap yuqori burchagida nuqtasiz yorliq sifatida.
 */
export function AppealsCard({ className }: { className?: string }) {
  return (
    <RingStatsCard
      className={className}
      title="Murojaatlar"
      rings={APPEAL_RINGS}
      max={100}
      tickLabels={PERCENT_TICKS}
      columns={["Holat", "Soni"]}
      geometry={HOME_GEOMETRY}
      summary={{ label: "Umumiy murojaatlar", value: "2,253 ta" }}
    />
  );
}
