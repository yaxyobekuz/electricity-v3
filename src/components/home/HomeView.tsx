import {
  ArrowBigDownDash,
  Cable,
  ClockArrowUp,
  SquareCheckBig,
  WrenchOff,
  Zap,
} from "lucide-react";

import { ConsumptionDynamicsCard } from "@/components/cards/ConsumptionDynamicsCard";
import { DownloadReportsCard } from "@/components/cards/DownloadReportsCard";
import { InteractiveMapCard } from "@/components/cards/InteractiveMapCard";
import { type PlannedWork, PlannedWorksCard } from "@/components/cards/PlannedWorksCard";
import { type QuickMetric, QuickMetricsCard } from "@/components/cards/QuickMetricsCard";
import { TopBarsCard, type TopBarItem } from "@/components/cards/TopBarsCard";

import { FilterCard } from "./cards/FilterCard";
import { HomeKpiRow } from "./cards/HomeKpiRow";
import { AppealsCard, MetersCard } from "./cards/HomeRingCards";
import { HomeViolationsCard } from "./cards/HomeViolationsCard";
import { ObjectsStack } from "./cards/ObjectsStack";
import { SummaryTile } from "./cards/SummaryTile";

/*
 * Diagramma qiymatlari maketdagi ustun uzunliklaridan qayta hisoblangan:
 * `SingleBar eni / BarArea eni * shkala chegarasi`. BarArea kartaga qarab
 * farq qiladi (391.67 / 384.67 / 404.67px) - yorliq ustuni kengligi har xil.
 * Podstansiyalarniki maketda matn sifatida ham yozilgan: 47.9 va 71.05.
 */

const TOP_SUBSTATIONS: readonly TopBarItem[] = [
  { id: "chinobod", label: "Chinobod", value: 47.9 },
  { id: "baliqchi", label: "Baliqchi", value: 71.05 },
];

const TOP_FEEDERS: readonly TopBarItem[] = [
  { id: "xaqulobod", label: "Xaqulobod", value: 47.9 },
  { id: "tovuqxona", label: "Tovuqxona", value: 18.8 },
  { id: "chinobod", label: "Chinobod", value: 57.8 },
  { id: "qiyali", label: "Qiyali", value: 77 },
  { id: "maslahat", label: "Maslahat", value: 28.4 },
  { id: "baliqchi", label: "Baliqchi", value: 107.6 },
];

const TOP_TRANSFORMERS: readonly TopBarItem[] = [
  { id: "tp-303", label: "TP 303", value: 47.9 },
  { id: "tp-87", label: "TP 87", value: 18.8 },
  { id: "tp-a3", label: "TP A3", value: 57.8 },
  { id: "tp-43", label: "TP 43", value: 77 },
  { id: "tp-332", label: "TP 332", value: 28.4 },
  { id: "tp-4", label: "TP 4", value: 107.6 },
];

/** Plitka ranglari fider sahifasidagi "Tezkor ko'rsatgichlar" bilan bir xil. */
const QUICK_METRICS: readonly QuickMetric[] = [
  {
    id: "avg-usage",
    icon: Zap,
    tile: "bg-accent-blue",
    caption: "Kunlik o’rtacha iste’mol",
    value: "15,2 ming kWh",
  },
  {
    id: "avg-loss",
    icon: ArrowBigDownDash,
    tile: "bg-[#ff928a]",
    caption: "Kunlik o’rtacha yo’qotish",
    value: "3,3 ming kWh",
  },
  {
    id: "faulty",
    icon: WrenchOff,
    tile: "bg-[#ffae4c]",
    caption: "Nosoz qurilmalar",
    value: "136 ta",
  },
  {
    id: "peak-hours",
    icon: ClockArrowUp,
    tile: "bg-[#8979ff]",
    // Maketda aynan shu qatorda to'g'ri apostrof (U+0027) ishlatilgan.
    caption: "Yuqori iste'mol vaqti",
    value: "19:30 - 21:00",
  },
  {
    id: "daily-tasks",
    icon: SquareCheckBig,
    tile: "bg-[#2bb7dc]",
    caption: "Kunlik topshiriq bajarilishi",
    value: "46%",
  },
];

const CHECK_WORK = {
  tp: "TP-A303",
  work: "Transformatorni tekshirish",
  status: "new",
  date: "7-sentabr, 2026",
} as const;

/** Maketda birinchi qator to'rt marta takrorlangan (Figma `4301:2711`...). */
const PLANNED_WORKS: readonly PlannedWork[] = [
  { id: "a303-check-1", ...CHECK_WORK },
  { id: "a303-check-2", ...CHECK_WORK },
  { id: "a303-check-3", ...CHECK_WORK },
  { id: "a303-check-4", ...CHECK_WORK },
  {
    id: "33-repair",
    tp: "TP-33",
    work: "Toka transformatorni ta’mirlash",
    status: "inProgress",
    date: "23-avgust, 2026",
  },
  {
    id: "08-chip",
    tp: "TP-08",
    work: "Hisoblagich chipini almashtirish. Hamda, qayta texnik ko’rikdan o’tkazish",
    status: "planned",
    date: "Bugun",
  },
];

/**
 * "Asosiy" (Bosh sahifa) - Figma `4126:47` ("Home", 1920x1080).
 *
 * `Main` 1476px, 18 ustun, 8px oraliq. Qator balandliklari maketdan aynan:
 *
 *   196  6 ta KPI kartasi (span-3)
 *   402  Ob'ektlar ustuni (4) | Interaktiv xarita (10) | Filtratsiya (4)
 *   336  Qoidabuzarlik + Zarar (6) | Hisoblagichlar (4) | Murojaatlar (4) | Tezkor (4)
 *   298  Top podstansiyalar (6) | Top fiderlar (6) | Top transformatorlar (6)
 *   298  Foydali oqim dinamikasi (6) | Rejalashtirilgan ishlar (8) | Hisobotlar (4)
 *
 * Jami 1530 + 4x8 = 1562px, ya'ni 1064px lik ish maydoniga sig'maydi va
 * sahifa VERTIKAL SKROLL qilinadi.
 */
export function HomeView() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[repeat(18,minmax(0,1fr))] grid-rows-[196px_402px_336px_298px_298px] gap-2 overflow-y-auto scrollbar-none">
      {/* 1-qator - 6 ta KPI kartasi */}
      <HomeKpiRow />

      {/* 2-qator */}
      <ObjectsStack className="col-span-4" />
      <InteractiveMapCard
        className="col-span-10"
        monthlyLabel="Bu oygi Foydali oqim"
        tooltipBottom={12}
      />
      <FilterCard className="col-span-4" />

      {/* 3-qator. Chap ustun: 220 + 8 + 108 = 336. */}
      <div className="col-span-6 grid min-h-0 grid-rows-[220px_minmax(0,1fr)] gap-2">
        <HomeViolationsCard />
        <SummaryTile
          icon={Cable}
          label="Umumiy keltirilgan zarar miqdori"
          value="635,1 mln so’m"
          valueFirst={false}
          actionLabel="Ba’tafsil"
          href="/violations"
          tint="bg-tint-red"
          accent="text-accent-red"
          glow="bg-accent-red"
        />
      </div>
      <MetersCard className="col-span-4" />
      <AppealsCard className="col-span-4" />
      <QuickMetricsCard className="col-span-4" metrics={QUICK_METRICS} />

      {/* 4-qator */}
      <TopBarsCard
        className="col-span-6"
        title={"Eng ko’p sarfga ega podstansiyalar"}
        items={TOP_SUBSTATIONS}
        max={100}
        tickStep={20}
        unit="mln kWh"
        labelWidth={59}
        footerLabel={"Podstansiyalar sahifasini ochish"}
        footerHref="/substations"
      />
      <TopBarsCard
        className="col-span-6"
        title={"Eng ko’p sarfga ega fiderlar"}
        items={TOP_FEEDERS}
        max={200}
        tickStep={25}
        unit="mln kWh"
        labelWidth={66}
        // Maketda uchala kartada ham "Podstansiyalar sahifasini ochish" yozilgan -
        // nusxa ko'chirishda qolib ketgan. Havola o'z sahifasiga olib borgani
        // uchun matn ham shunga moslashtirildi.
        footerLabel={"Fiderlar sahifasini ochish"}
        footerHref="/feeders"
      />
      <TopBarsCard
        className="col-span-6"
        title={"Eng ko’p sarfga ega transformatorlar"}
        items={TOP_TRANSFORMERS}
        max={200}
        tickStep={25}
        unit="mln kWh"
        labelWidth={46}
        footerLabel={"Transformatorlar sahifasini ochish"}
        footerHref="/transformers"
      />

      {/* 5-qator */}
      <ConsumptionDynamicsCard
        className="col-span-6"
        title="Foydali oqim dinamikasi"
        labels={{ billed: "Umumiy oqim", consumed: "Foydali oqim", loss: "Yo’qotish" }}
      />
      <PlannedWorksCard className="col-span-8" works={PLANNED_WORKS} />
      <DownloadReportsCard className="col-span-4" stretchPeriods={false} />
    </div>
  );
}
