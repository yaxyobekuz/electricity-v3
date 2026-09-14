import { HandCoins, UserCheck, Users, UserX } from "lucide-react";

import type { MeterStatus, SubscriberKind } from "@/generated/prisma";
import {
  SubscribersRegistry,
  type SubscribersRegistryProps,
} from "@/components/subscribers/SubscribersRegistry";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { METER_STATUS_LABEL, SUBSCRIBER_KIND_LABEL } from "@/lib/domain/labels";
import { share } from "@/lib/domain/metrics";
import { EMPTY, formatDate, money, num, percent } from "@/lib/format";
import type { PeriodInfo } from "@/lib/period";

// O'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, string proplarda ’.

/** Qamrov bo'yicha yig'ma sonlar (`getScopeSummary` dan, sahifada tanlab olingan). */
export interface SubscribersSummary {
  /** Σ TP holatlari (aloqada / aloqadan chiqqan); Transformatorlar yuklanmagan - null. */
  subscribers: { total: number; online: number; offline: number } | null;
  /** Abonentlar ro'yxati shu oyga yuklangan. */
  listUploaded: boolean;
  byKind: Record<SubscriberKind, number>;
  byStatus: Record<MeterStatus, number>;
  debtUzs: number;
  debtors: number;
}

const TRANSFORMERS_MISSING = "Transformatorlar yuklanmagan";
const LIST_MISSING = "Abonentlar ro’yxati yuklanmagan";

/**
 * Abonentlar reestri: yuqorida qamrov bo'yicha 4 ta ko'rsatkich, pastda
 * filtrlar, jadval va sahifalash. Ko'rsatkichlar faqat qamrovga bog'liq
 * (qidiruv va chiplar ularni o'zgartirmaydi) - "Jami abonent" boshqa
 * sahifalardagi abonent soni bilan aynan bir xil.
 */
export function SubscribersView({
  period,
  summary,
  registry,
}: {
  period: PeriodInfo;
  summary: SubscribersSummary;
  registry: SubscribersRegistryProps;
}) {
  const counts = summary.subscribers;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader title="Abonentlar" subtitle={`${formatDate(period.reportDate)} holatiga`} />

      <StatRow>
        <StatCard
          label="Jami abonent"
          value={counts ? num(counts.total) : EMPTY}
          unit={counts ? "ta" : undefined}
          icon={Users}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={
            !counts
              ? TRANSFORMERS_MISSING
              : summary.listUploaded
                ? `${SUBSCRIBER_KIND_LABEL.HOUSEHOLD}: ${num(summary.byKind.HOUSEHOLD)} · ${SUBSCRIBER_KIND_LABEL.LEGAL}: ${num(summary.byKind.LEGAL)}`
                : LIST_MISSING
          }
        />
        <StatCard
          label={METER_STATUS_LABEL.ONLINE}
          value={counts ? num(counts.online) : EMPTY}
          unit={counts ? "ta" : undefined}
          icon={UserCheck}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint={counts ? `Ulushi: ${percent(share(counts.online, counts.total))}` : TRANSFORMERS_MISSING}
        />
        <StatCard
          label="Aloqadan chiqqan"
          value={counts ? num(counts.offline) : EMPTY}
          unit={counts ? "ta" : undefined}
          icon={UserX}
          accent="bg-accent-amber"
          tint="bg-tint-amber"
          hint={
            !counts
              ? TRANSFORMERS_MISSING
              : summary.listUploaded
                ? `${METER_STATUS_LABEL.NOT_RESPONDING}: ${num(summary.byStatus.NOT_RESPONDING)} · ${METER_STATUS_LABEL.SCHEME_CHANGED}: ${num(summary.byStatus.SCHEME_CHANGED)}`
                : LIST_MISSING
          }
        />
        <StatCard
          label="Umumiy qarzdorlik"
          value={summary.listUploaded ? money(summary.debtUzs) : EMPTY}
          icon={HandCoins}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint={summary.listUploaded ? `Qarzdorlar: ${num(summary.debtors)} ta` : LIST_MISSING}
          hintTone={summary.listUploaded && summary.debtors > 0 ? "bad" : "flat"}
        />
      </StatRow>

      <SubscribersRegistry {...registry} />
    </div>
  );
}
