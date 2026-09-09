import { ConsumptionLossCard } from "./cards/ConsumptionLossCard";
import { DebtStructureCard } from "./cards/DebtStructureCard";
import { DistrictMapCard } from "./cards/DistrictMapCard";
import { EnergyDistributionCard } from "./cards/EnergyDistributionCard";
import { EventLogCard } from "./cards/EventLogCard";
import { ForecastCard } from "./cards/ForecastCard";
import { KpiRow } from "./cards/KpiRow";
import { NetworkTopologyCard } from "./cards/NetworkTopologyCard";
import { QuickIndicatorsCard } from "./cards/QuickIndicatorsCard";
import { RecommendationsCard } from "./cards/RecommendationsCard";
import { SituationCenterCard } from "./cards/SituationCenterCard";
import { TransformerStatusCard } from "./cards/TransformerStatusCard";
import { HomeTopBar } from "./HomeTopBar";

/**
 * "Asosiy" (Bosh sahifa) - tuman darajasidagi umumiy boshqaruv paneli.
 *
 * 24 ustunli grid, 8px oraliq. Makro tuzilma uch ustunli: chapda tahlil
 * (span-7), o'rtada xarita va uning ostidagi kartalar (span-11 = 6 + 5),
 * o'ngda vaziyatlar/tavsiyalar ustuni (span-6).
 *
 * Qator balandliklari `minmax(Npx, Nfr)`: 60 + 144 + 352 + 226 + 250 va 4 ta
 * 8px oraliq = 1064px, ya'ni 1080px ekranda hamma narsa skrollsiz sig'adi;
 * balandroq ekranda qatorlar mutanosib cho'ziladi.
 *
 * Balandliklar kartalarning eng zich kontentiga qarab tanlangan: 352px -
 * "Vaziyatlar markazi" dagi 6 ta hodisa (6 x 37 + 5 x 4 = 242px) uchun,
 * 226/250px - `compact` jadvallarning 5 tadan qatori (150px) uchun.
 */
export function HomeView() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[repeat(24,minmax(0,1fr))] grid-rows-[60px_minmax(144px,144fr)_minmax(352px,352fr)_minmax(226px,226fr)_minmax(250px,250fr)] gap-2 overflow-y-auto scrollbar-none">
      {/* Yuqori sarlavha yo'lagi */}
      <HomeTopBar className="col-span-24" />

      {/* 1-qator - 8 ta KPI kartasi (8 x span-3) */}
      <KpiRow />

      {/* 2-qator */}
      <ConsumptionLossCard className="col-span-7" />
      <DistrictMapCard className="col-span-11" />
      <SituationCenterCard className="col-span-6" />

      {/* 3-qator */}
      <TransformerStatusCard className="col-span-7" />
      <EnergyDistributionCard className="col-span-6" />
      <DebtStructureCard className="col-span-5" />
      <QuickIndicatorsCard className="col-span-6" />

      {/* 4-qator */}
      <NetworkTopologyCard className="col-span-7" />
      <EventLogCard className="col-span-6" />
      <ForecastCard className="col-span-5" />
      <RecommendationsCard className="col-span-6" />
    </div>
  );
}
