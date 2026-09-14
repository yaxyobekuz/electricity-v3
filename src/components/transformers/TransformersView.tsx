import { CircuitBoard, ExternalLink, UserCheck, UserMinus, X, Zap, ZapOff } from "lucide-react";

import { TransformersTable } from "@/components/transformers/TransformersTable";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { share } from "@/lib/domain/metrics";
import { EMPTY, count, energy, num, percent, scaled } from "@/lib/format";
import type { PeriodInfo } from "@/lib/period";
import type { RegistryScopeInfo, TransformerRegistry } from "@/lib/queries/transformers-registry";

/*
 * "Transformatorlar" reestri: sarlavha, qamrov statistikasi va jadval.
 *
 * Statistika faqat `getScopeSummary` dan (reestr qatorlarini qayta yig'maydi):
 * TP soni va abonentlar - shu qamrovdagi TP holatlari yig'indisi, oqim va
 * yo'qotish esa qamrov obyektining O'Z holati (tuman - podstansiyalar
 * yig'indisi). Shuning uchun oqim kartasining nomi qamrovni aytadi - u TP
 * qatorlari yig'indisiga teng bo'lishi shart emas (liniya yo'qotishlari).
 */

/** Oqim kartasi nomi - qaysi obyekt holatidan olingani. */
const ENERGY_LABEL: Record<RegistryScopeInfo["kind"], string> = {
  district: "Tuman umumiy oqimi",
  substation: "Podstansiya umumiy oqimi",
  feeder: "Fider umumiy oqimi",
  transformer: "TP umumiy oqimi",
};

/** Yo'qotish ulushi kartasi nomi - oqim kartasi bilan bir xil obyekt (TP qatorlari emas). */
const LOSS_LABEL: Record<RegistryScopeInfo["kind"], string> = {
  district: "Tuman yo’qotish ulushi",
  substation: "Podstansiya yo’qotish ulushi",
  feeder: "Fider yo’qotish ulushi",
  transformer: "TP yo’qotish ulushi",
};

/**
 * Oqim kartasi qiymati: milliondan boshlab 2 xona - izohdagi "1,85 mln kWh"
 * (`energy`) bilan mos keladi va `/substations`, `/feeders` reestrlaridagi
 * xuddi shu jami bilan bir xil yoziladi.
 */
function flowValue(kwh: number) {
  return scaled(kwh, "kWh", Math.abs(kwh) >= 1_000_000 ? 2 : 1);
}

/** Qamrov obyektining oqim holati yo'q bo'lsa - sababi. */
function energyMissing({ scope, summary }: TransformerRegistry): string {
  switch (scope.kind) {
    case "district":
      return summary.uploads.SUBSTATIONS ? "Oqim ma’lumoti yo’q" : "Podstansiyalar yuklanmagan";
    case "substation":
      return summary.uploads.SUBSTATIONS ? "Shu oyda podstansiya holati yo’q" : "Podstansiyalar yuklanmagan";
    case "feeder":
      return summary.uploads.FEEDERS ? "Shu oyda fider holati yo’q" : "Fiderlar yuklanmagan";
    case "transformer":
      return "Shu oyda TP holati yo’q";
  }
}

function scopeSubtitle(scope: RegistryScopeInfo): string {
  switch (scope.kind) {
    case "district":
      return "Tuman bo’yicha";
    case "substation":
      return `${scope.substation.name} podstansiyasi`;
    case "feeder":
      return `${scope.substation.name} podstansiyasi · ${scope.feeder.name} fideri`;
    case "transformer":
      return `${scope.substation.name} podstansiyasi · ${scope.feeder.name} fideri · ${scope.transformer.name}`;
  }
}

/** TP kartasi izohi: qamrovdagi podstansiya va fiderlar soni (`getScopeSummary().counts`). */
function countsHint({ scope, summary }: TransformerRegistry): string | undefined {
  const { substations, feeders } = summary.counts;
  const parts = [
    scope.kind === "district" && substations != null ? `${num(substations)} podstansiya` : null,
    (scope.kind === "district" || scope.kind === "substation") && feeders != null ? `${num(feeders)} fider` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function ScopeButtons({ scope }: { scope: RegistryScopeInfo }) {
  switch (scope.kind) {
    case "district":
      return null;
    case "substation":
      return (
        <HeaderButton icon={ExternalLink} href={`/substations/${scope.substation.id}`}>
          {scope.substation.name} podstansiyasi
        </HeaderButton>
      );
    case "feeder":
      return (
        <HeaderButton icon={ExternalLink} href={`/feeders/${scope.feeder.id}`}>
          {scope.feeder.name} fideri
        </HeaderButton>
      );
    case "transformer":
      return (
        <HeaderButton icon={ExternalLink} href={`/transformers/${scope.transformer.id}`}>
          {scope.transformer.name} transformatori
        </HeaderButton>
      );
  }
}

export function TransformersView({
  period,
  registry,
  initialQuery,
}: {
  period: PeriodInfo;
  registry: TransformerRegistry;
  initialQuery: string;
}) {
  const { scope, rows, summary } = registry;
  const transformers = summary.counts.transformers;

  const header = (
    <PageHeader
      title="Transformatorlar"
      subtitle={`${period.label} · ${scopeSubtitle(scope)}${
        transformers != null ? ` · ${count(transformers)} transformator` : ""
      }`}
    >
      <ScopeButtons scope={scope} />
      {scope.kind !== "district" ? (
        <HeaderButton icon={X} href="/transformers">
          Filtrni olib tashlash
        </HeaderButton>
      ) : null}
    </PageHeader>
  );

  // Transformatorlar fayli shu oyga yuklanmagan - "0 ta" emas, ma'lumot yo'q.
  if (transformers == null) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        {header}
        <div className="min-h-0 flex-1">
          <EmptyState title={`${period.label} oyi uchun Transformatorlar yuklanmagan`} />
        </div>
      </div>
    );
  }

  const flow = summary.energy ? flowValue(summary.energy.totalKwh) : null;
  const subscribers = summary.subscribers;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {header}

      <StatRow>
        <StatCard
          label="Transformatorlar"
          value={num(transformers)}
          unit="ta"
          icon={CircuitBoard}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={countsHint(registry)}
        />
        <StatCard
          label={ENERGY_LABEL[scope.kind]}
          value={flow?.value ?? EMPTY}
          unit={flow?.unit}
          icon={Zap}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={
            summary.energy ? `Foydali oqim: ${energy(summary.energy.usefulKwh)}` : energyMissing(registry)
          }
        />
        <StatCard
          label={LOSS_LABEL[scope.kind]}
          value={summary.energy ? percent(summary.energy.lossPercent) : EMPTY}
          icon={ZapOff}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint={summary.energy ? `Yo’qotish: ${energy(summary.energy.lossKwh)}` : energyMissing(registry)}
        />
        <StatCard
          label="Aloqadagi abonentlar"
          value={subscribers ? num(subscribers.online) : EMPTY}
          unit="ta"
          icon={UserCheck}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint={subscribers ? `Jami abonentlar: ${count(subscribers.total)}` : undefined}
        />
        <StatCard
          label="Aloqadan chiqqan abonentlar"
          value={subscribers ? num(subscribers.offline) : EMPTY}
          unit="ta"
          icon={UserMinus}
          accent="bg-accent-amber"
          tint="bg-tint-amber"
          hint={subscribers ? `Ulushi: ${percent(share(subscribers.offline, subscribers.total))}` : undefined}
        />
      </StatRow>

      <Card className="min-h-0 flex-1">
        <TransformersTable
          rows={rows}
          initialQuery={initialQuery}
          violationsUploaded={summary.uploads.VIOLATIONS}
          appealsUploaded={summary.uploads.APPEALS}
        />
      </Card>
    </div>
  );
}
