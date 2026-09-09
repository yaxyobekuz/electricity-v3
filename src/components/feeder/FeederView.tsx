import { CompletedWorksCard } from "./cards/CompletedWorksCard";
import { ConsumptionDynamicsCard } from "./cards/ConsumptionDynamicsCard";
import { DebtCard } from "./cards/DebtCard";
import { DownloadReportsCard } from "./cards/DownloadReportsCard";
import { InteractiveMapCard } from "./cards/InteractiveMapCard";
import { KpiRow } from "./cards/KpiRow";
import { LossDamageCard } from "./cards/LossDamageCard";
import { PlannedWorksCard } from "./cards/PlannedWorksCard";
import { QuickMetricsCard } from "./cards/QuickMetricsCard";
import { ResponsibleStaffCard } from "./cards/ResponsibleStaffCard";
import { TopTransformersCard } from "./cards/TopTransformersCard";
import { ViolationsCard } from "./cards/ViolationsCard";

/**
 * Fider sahifasi (Figma `4029:930` -> "Main").
 *
 * 18 ustunli grid, 8px oraliq. Qator balandliklari maketdagi qiymatlar:
 * 196 / 298 / 336 / 209. `minmax(Npx, Nfr)` - 1064px balandlikda aynan
 * maketdagidek, balandroq ekranda mutanosib cho'ziladi.
 */
export function FeederView() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[repeat(18,minmax(0,1fr))] grid-rows-[minmax(196px,196fr)_minmax(298px,298fr)_minmax(336px,336fr)_minmax(209px,209fr)] gap-2 overflow-y-auto scrollbar-none">
      {/* 1-qator - KPI kartalari (6 x span-3) */}
      <KpiRow />

      {/* 2-qator */}
      <ConsumptionDynamicsCard className="col-span-6" />
      <div className="col-span-6 grid min-h-0 grid-rows-[minmax(0,148fr)_minmax(0,142fr)] gap-2">
        <ViolationsCard />
        <ResponsibleStaffCard />
      </div>
      <TopTransformersCard className="col-span-6" />

      {/* 3-qator */}
      <DebtCard className="col-span-4" />
      <LossDamageCard className="col-span-4" />
      <InteractiveMapCard className="col-span-6" />
      <QuickMetricsCard className="col-span-4" />

      {/* 4-qator */}
      <CompletedWorksCard className="col-span-6" />
      <PlannedWorksCard className="col-span-8" />
      <DownloadReportsCard className="col-span-4" />
    </div>
  );
}
