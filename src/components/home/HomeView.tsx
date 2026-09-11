import { CompletedWorksCard } from "@/components/cards/CompletedWorksCard";
import { ConsumptionDynamicsCard } from "@/components/cards/ConsumptionDynamicsCard";
import { DebtCard } from "@/components/cards/DebtCard";
import { DownloadReportsCard } from "@/components/cards/DownloadReportsCard";
import { InteractiveMapCard } from "@/components/cards/InteractiveMapCard";
import { KpiRow } from "@/components/cards/KpiRow";
import { LossDamageCard } from "@/components/cards/LossDamageCard";
import { PlannedWorksCard } from "@/components/cards/PlannedWorksCard";
import { QuickMetricsCard } from "@/components/cards/QuickMetricsCard";
import { ResponsibleStaffCard } from "@/components/cards/ResponsibleStaffCard";
import { TopBarsCard, type TopBarItem } from "@/components/cards/TopBarsCard";
import { ViolationsCard } from "@/components/cards/ViolationsCard";

import { DataCard } from "./cards/DataCard";
import { FilterCard } from "./cards/FilterCard";
import { HomeKpiStack } from "./cards/HomeKpiStack";

/*
 * Diagramma qiymatlari maketdagi ustun uzunliklaridan qayta hisoblangan
 * (ustun eni / 391.67 * shkala chegarasi), podstansiyalarniki esa maketda
 * matn sifatida ham yozilgan: 47.9 va 71.05.
 */

const TOP_SUBSTATIONS: readonly TopBarItem[] = [
  { id: "chinobod", label: "Chinobod", value: 47.9 },
  { id: "baliqchi", label: "Baliqchi", value: 71.05 },
];

const TOP_FEEDERS: readonly TopBarItem[] = [
  { id: "xaqulobod", label: "Xaqulobod", value: 47 },
  { id: "tovuqxona", label: "Tovuqxona", value: 18.5 },
  { id: "chinobod", label: "Chinobod", value: 56.8 },
  { id: "qiyali", label: "Qiyali", value: 75.6 },
  { id: "maslahat", label: "Maslahat", value: 27.9 },
  { id: "baliqchi", label: "Baliqchi", value: 105.7 },
];

/**
 * "Asosiy" (Bosh sahifa) - Figma `4126:47` ("Home", 1920x1080).
 *
 * Maket fider sahifasi bilan bir xil tarmoqda qurilgan: `Main` 1476px, 18
 * ustun, 8px oraliq. Shuning uchun kartalarning ko'pi aynan o'sha komponent
 * (`@/components/cards/`), faqat KPI ustuni, filtr va ikkita "Eng ko'p sarf"
 * diagrammasi shu sahifaga xos.
 *
 * Qator balandliklari maketdan aynan:
 *
 *   196  KPI kartalari (6 x span-3)
 *   402  KPI ustuni (span-4) | Interaktiv xarita (span-10) | Filtr+Ma'lumot (span-4)
 *   336  Qoidabuzarlik+Ma'sul xodim (span-6) | Qarzdorlik | Yo'qotish zarari | Tezkor (span-4)
 *   298  Iste'mol dinamikasi | Top podstansiyalar | Top fiderlar (span-6)
 *   209  Rejalashtirilgan ishlar (span-8) | Bajarilgan ishlar (span-6) | Hisobotlar (span-4)
 *
 * Jami 1441 + 4x8 = 1473px, ya'ni 1064px lik ish maydoniga sig'maydi va
 * sahifa VERTIKAL SKROLL qilinadi - maketda ham shunday (`Main` balandligi
 * 1699px).
 */
export function HomeView() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[repeat(18,minmax(0,1fr))] grid-rows-[196px_402px_336px_298px_209px] gap-2 overflow-y-auto scrollbar-none">
      {/* 1-qator - 6 ta KPI kartasi */}
      <KpiRow />

      {/* 2-qator */}
      <HomeKpiStack className="col-span-4" />
      <InteractiveMapCard className="col-span-10" />
      {/* Ikki karta 8px oraliq bilan: 197 + 8 + 197 = 402. */}
      <div className="col-span-4 grid min-h-0 grid-rows-2 gap-2">
        <FilterCard />
        <DataCard />
      </div>

      {/* 3-qator. Chapdagi ustunda oraliq 10px (158 - 148), 148 + 10 + 178 = 336. */}
      <div className="col-span-6 grid min-h-0 grid-rows-[148px_minmax(0,1fr)] gap-2.5">
        <ViolationsCard />
        <ResponsibleStaffCard
          title={"Energetika rahbari (Ma’sul xodim)"}
          footerLabel={"Barcha xodimlarni ko’rsatish"}
          footerHref="/staff"
        />
      </div>
      <DebtCard className="col-span-4" />
      <LossDamageCard className="col-span-4" />
      <QuickMetricsCard className="col-span-4" />

      {/* 4-qator */}
      <ConsumptionDynamicsCard className="col-span-6" />
      <TopBarsCard
        className="col-span-6"
        title={"Eng ko’p sarfga ega podstansiyalar"}
        items={TOP_SUBSTATIONS}
        max={100}
        tickStep={20}
        unit="mln kWh"
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
        // Maketda bu kartada ham "Podstansiyalar sahifasini ochish" yozilgan -
        // aftidan nusxa ko'chirishda qolib ketgan. Havola fiderlar sahifasiga
        // olib borgani uchun matn ham shunga moslashtirildi.
        footerLabel={"Fiderlar sahifasini ochish"}
        footerHref="/feeders"
      />

      {/* 5-qator */}
      <PlannedWorksCard className="col-span-8" />
      <CompletedWorksCard className="col-span-6" />
      <DownloadReportsCard className="col-span-4" />
    </div>
  );
}
