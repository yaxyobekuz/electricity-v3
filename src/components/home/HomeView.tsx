import {
  Cable,
  ClockAlert,
  Hourglass,
  UserX,
  Wallet,
  WifiOff,
  ZapOff,
} from "lucide-react";

import { ConsumptionDynamicsCard } from "@/components/cards/ConsumptionDynamicsCard";
import { DownloadReportsCard } from "@/components/cards/DownloadReportsCard";
import { InteractiveMapCard } from "@/components/cards/InteractiveMapCard";
import { PlannedWorksCard } from "@/components/cards/PlannedWorksCard";
import { type QuickMetric, QuickMetricsCard } from "@/components/cards/QuickMetricsCard";
import { TopBarsCard } from "@/components/cards/TopBarsCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GlyphIcon } from "@/components/ui/Icon";
import type { HomeData, HomeQuickMetric } from "@/lib/queries/home-data";

import { FilterCard } from "./cards/FilterCard";
import { HomeKpiRow } from "./cards/HomeKpiRow";
import { AppealsCard, MetersCard } from "./cards/HomeRingCards";
import { HomeViolationsCard } from "./cards/HomeViolationsCard";
import { ObjectsStack } from "./cards/ObjectsStack";
import { SummaryTile } from "./cards/SummaryTile";

/** Plitka ranglari - "Tezkor ko'rsatgichlar" maketidagi (`QuickMetricsCard`) ranglar. */
const QUICK_STYLE: Record<HomeQuickMetric["id"], { icon: GlyphIcon; tile: string }> = {
  offline: { icon: WifiOff, tile: "bg-[#ff928a]" },
  debtors: { icon: UserX, tile: "bg-[#ffae4c]" },
  credit: { icon: Wallet, tile: "bg-accent-blue" },
  appealsInProgress: { icon: Hourglass, tile: "bg-[#8979ff]" },
  appealsOverdue: { icon: ClockAlert, tile: "bg-[#2bb7dc]" },
  damageKwh: { icon: ZapOff, tile: "bg-accent-red" },
};

/**
 * "Asosiy" (Bosh sahifa) - Figma `4126:47` ("Home", 1920x1080). Tuman
 * (`/dashboard`), podstansiya (`/substations/[id]`), fider (`/feeders/[id]`)
 * va TP (`/transformers/[id]`) sahifalari bir xil maketda; ma'lumot
 * `loadHomeData` dan tayyor holda keladi (kartalar tarkibi qamrovga qarab
 * o'sha yerda tanlanadi).
 *
 * `Main` 1476px, 18 ustun, 8px oraliq. Qator balandliklari maketdan aynan:
 *
 *   196  6 ta KPI kartasi (span-3)
 *   402  Ob'ektlar ustuni (4) | Interaktiv xarita (10) | Filtratsiya (4)
 *   336  Qoidabuzarlik + Zarar (6) | Hisoblagichlar (4) | Murojaatlar (4) | Tezkor (4)
 *   298  Uchta reyting (6 + 6 + 6)
 *   298  Oqim dinamikasi (6) | Rejalashtirilgan ishlar (8) | Hisobotlar (4)
 *
 * Jami 1530 + 4x8 = 1562px, ya'ni 1064px lik ish maydoniga sig'maydi va
 * sahifa VERTIKAL SKROLL qilinadi.
 */
export function HomeView({ data }: { data: HomeData }) {
  const quickMetrics: QuickMetric[] = data.quickMetrics.map((metric) => ({
    ...metric,
    ...QUICK_STYLE[metric.id],
  }));

  return (
    <div className="grid h-full min-h-0 grid-cols-[repeat(18,minmax(0,1fr))] grid-rows-[196px_402px_336px_298px_298px] gap-2 overflow-y-auto scrollbar-none">
      {/* 1-qator - 6 ta KPI kartasi */}
      <HomeKpiRow kpis={data.kpis} />

      {/* 2-qator */}
      <ObjectsStack
        className="col-span-4"
        tiles={data.objects.tiles}
        repairs={data.objects.repairs}
      />
      <InteractiveMapCard
        className="col-span-10"
        markers={data.map.markers}
        selectedId={data.map.selectedId}
        tooltip={
          data.map.tooltip
            ? { ...data.map.tooltip, dot: "bg-accent-red", note: data.map.tooltip.note ?? undefined }
            : null
        }
        tooltipBottom={12}
        fitDistrict={data.map.view == null}
        center={data.map.view?.center}
        zoom={data.map.view?.zoom}
        footerHref={data.map.href}
      />
      <FilterCard key={data.stateKey} className="col-span-4" data={data.filter} />

      {/* 3-qator. Chap ustun: 220 + 8 + 108 = 336. */}
      <div className="col-span-6 grid min-h-0 grid-rows-[220px_minmax(0,1fr)] gap-2">
        <HomeViolationsCard data={data.violations} />
        <SummaryTile
          icon={Cable}
          label="Umumiy keltirilgan zarar miqdori"
          value={data.violations.damage ?? "Qoidabuzarliklar yuklanmagan"}
          valueFirst={false}
          actionLabel="Ba’tafsil"
          href={data.violations.href}
          tint="bg-tint-red"
          accent="text-accent-red"
          glow="bg-accent-red"
        />
      </div>
      <MetersCard className="col-span-4" data={data.meters} />
      <AppealsCard className="col-span-4" data={data.appeals} />
      <QuickMetricsCard className="col-span-4" metrics={quickMetrics} />

      {/* 4-qator - reytinglar (tanlangan oy) */}
      {data.topBars.map((bars) => (
        <TopBarsCard
          key={bars.id}
          className="col-span-6"
          title={bars.title}
          items={bars.items}
          unit={bars.unit}
          valueColumn={bars.valueColumn}
          labelColumn={bars.labelColumn}
          labelWidth={bars.labelWidth}
          footerLabel={bars.footerLabel}
          footerHref={bars.footerHref}
          emptyText={bars.emptyText}
        />
      ))}

      {/* 5-qator */}
      <ConsumptionDynamicsCard
        className="col-span-6"
        title="Oqim dinamikasi"
        months={data.dynamics}
      />
      {data.plannedWorks.uploaded ? (
        <PlannedWorksCard className="col-span-8" works={data.plannedWorks.works} />
      ) : (
        <Card className="col-span-8">
          <CardHeader title="Rejalashtirilgan ishlar" />
          <CardBody>
            <EmptyState variant="inline" action={false} title="Transformatorlar yuklanmagan" />
          </CardBody>
        </Card>
      )}
      <DownloadReportsCard
        className="col-span-4"
        query={data.reportQuery}
        stretchPeriods={false}
      />
    </div>
  );
}
