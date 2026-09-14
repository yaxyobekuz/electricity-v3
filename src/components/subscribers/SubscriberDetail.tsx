import { Gauge, HandCoins, PiggyBank, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { AppealStatus } from "@/generated/prisma";
import { ReadingDiffChart } from "@/components/subscribers/ReadingDiffChart";
import {
  METER_STATUS_TEXT,
  METER_STATUS_TONE,
  exactMoney,
  reading,
  signedMoney,
  signedReading,
} from "@/components/subscribers/subscriber-ui";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone, DataTable, type TableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoGrid, type InfoItem } from "@/components/ui/InfoGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard, type StatTone, StatRow } from "@/components/ui/StatCard";
import {
  APPEAL_STATUS_LABEL,
  METER_STATUS_LABEL,
  SUBSCRIBER_KIND_LABEL,
  VIOLATOR_TYPE_LABEL,
} from "@/lib/domain/labels";
import { delta, sum } from "@/lib/domain/metrics";
import { dec, EMPTY, formatDate, formatDateTime, money, monthLabel, num, parseMonthKey } from "@/lib/format";
import type { PeriodInfo } from "@/lib/period";
import type { SubscriberHistoryPoint, SubscriberDetail as SubscriberEntity } from "@/lib/queries/entities";
import type { SubscriberRelated } from "@/lib/queries/subscribers-related";
import { scopedHref } from "@/lib/scope-param";

// O'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, string proplarda ’.

const LINK_CLASS = "text-brand transition-opacity hover:opacity-70";

const APPEAL_STATUS_TONE: Record<AppealStatus, BadgeTone> = {
  RESOLVED: "green",
  IN_PROGRESS: "blue",
  REJECTED: "amber",
  OVERDUE: "red",
};

const HISTORY_COLUMNS: TableColumn[] = [
  { key: "month", label: "Oy", grow: 1.1, align: "left" },
  { key: "transformer", label: "TP", grow: 0.8 },
  { key: "reading", label: "Ko’rsatkich", grow: 0.9, align: "right" },
  { key: "diff", label: "Farq", grow: 0.7, align: "right" },
  { key: "debt", label: "Qarzdorlik", grow: 1.1, align: "right" },
  { key: "credit", label: "Haqdorlik", grow: 1, align: "right" },
  { key: "status", label: "Holati", grow: 1.4 },
  { key: "payment-date", label: "To’lov sanasi", grow: 1.1, align: "right" },
  { key: "payment-sum", label: "To’lov summasi", grow: 1.1, align: "right" },
];

/** Tor katakdagi matn: kesilib qolsa to'liq qiymat `title` da ko'rinadi. */
function Cell({ text, className }: { text: string; className?: string }) {
  return (
    <span title={text === EMPTY ? undefined : text} className={className}>
      {text}
    </span>
  );
}

const VIOLATION_COLUMNS: TableColumn[] = [
  { key: "date", label: "Sana", grow: 1.2, align: "left" },
  { key: "type", label: "Turi", grow: 0.9 },
  { key: "uzs", label: "Zarar, so’m", grow: 1.2, align: "right" },
  { key: "kwh", label: "Zarar, kWh", grow: 1, align: "right" },
];

const APPEAL_COLUMNS: TableColumn[] = [
  { key: "date", label: "Sana", grow: 1.1, align: "left" },
  { key: "text", label: "Murojaat", grow: 2, align: "left" },
  { key: "status", label: "Holati", grow: 1.3 },
];

/** O'tgan oyga nisbatan pul farqi uchun izoh va ohang. */
function moneyTrend(
  current: number,
  previous: number | undefined,
  increaseTone: StatTone,
): { hint: string; tone: StatTone } | null {
  const change = delta(current, previous);
  if (!change) return null;
  if (change.diff === 0) return { hint: "O’tgan oyga nisbatan o’zgarmagan", tone: "flat" };
  const decreaseTone: StatTone = increaseTone === "bad" ? "good" : increaseTone === "good" ? "bad" : "flat";
  return {
    hint: `O’tgan oyga nisbatan: ${signedMoney(change.diff)}`,
    tone: change.diff > 0 ? increaseTone : decreaseTone,
  };
}

function staffHref(name: string): string {
  return `/staff?${new URLSearchParams({ q: name })}`;
}

/** Kichik jadvalli karta ichidagi bo'sh / yuklanmagan holat. */
function InlineNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-md bg-canvas px-3 text-center text-xs text-ink-muted">
      {children}
    </div>
  );
}

/**
 * Abonent sahifasi. Server komponent - faqat grafik (`ReadingDiffChart`)
 * mijozda chiziladi. Barcha qiymatlar "Elektr Abonentlar.xlsx" shablonidan
 * (passport va PINFL ko'rsatilmaydi), qoidabuzarlik va murojaatlar - shu
 * abonentga bog'langan yozuvlar.
 */
export function SubscriberDetail({
  subscriber,
  period,
  history,
  previous,
  related,
}: {
  subscriber: SubscriberEntity;
  period: PeriodInfo;
  /** Tanlangan oygacha (u ham kiradi) holatlar, eskidan yangiga. */
  history: SubscriberHistoryPoint[];
  /** Aynan o'tgan oy (`month - 1`) holati; yo'q bo'lsa - null. */
  previous: SubscriberHistoryPoint | null;
  /** Holat yo'q oyda - null. */
  related: SubscriberRelated | null;
}) {
  const snapshot = subscriber.snapshot;
  const current = history.find((point) => point.key === period.key) ?? null;
  const sourceLabel = monthLabel(parseMonthKey(subscriber.sourcePeriodKey));

  const header = (
    <PageHeader
      title={subscriber.fullName}
      subtitle={`Shartnoma raqami: ${subscriber.contractNumber} · ${formatDate(period.reportDate)} holatiga`}
      backHref="/subscribers"
      backLabel="Ro’yxatga qaytish"
    >
      {snapshot ? (
        <Badge tone={METER_STATUS_TONE[snapshot.meterStatus]}>{METER_STATUS_LABEL[snapshot.meterStatus]}</Badge>
      ) : null}
    </PageHeader>
  );

  const diffPoints = history.flatMap((point) =>
    point.readingDiff == null
      ? []
      : [{ key: point.key, shortLabel: point.shortLabel, label: point.label, diff: point.readingDiff }],
  );

  const chartCard = (className: string) => (
    <Card className={className}>
      <CardHeader title="Ko’rsatkich farqi">
        {diffPoints.length > 0 ? (
          <span className="text-[11px] text-ink-soft">{num(diffPoints.length)} oy</span>
        ) : null}
      </CardHeader>
      <CardBody>
        {diffPoints.length === 0 ? (
          <EmptyState
            variant="inline"
            action={false}
            title="Farqni hisoblash uchun ma’lumot yetarli emas"
            description="Kamida ikki oylik holatda hisoblagich ko’rsatkichi bo’lishi kerak."
          />
        ) : (
          <div className="min-h-0 flex-1">
            <ReadingDiffChart points={diffPoints} />
          </div>
        )}
        <p className="shrink-0 pt-2 text-[10px] text-ink-soft">
          Farq &mdash; oldingi mavjud oy holatidagi hisoblagich ko&rsquo;rsatkichidan ayirma. Hisoblagich
          koeffitsiyenti hisobga olinmagan, shuning uchun bu kWh iste&rsquo;mol emas.
        </p>
      </CardBody>
    </Card>
  );

  const historyCard = (className: string) => (
    <Card className={className}>
      <CardHeader title="Oylar bo’yicha holat">
        <span className="text-[11px] text-ink-soft">{num(history.length)} oy</span>
      </CardHeader>
      <CardBody>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <DataTable
            columns={HISTORY_COLUMNS}
            lastRowFooter={false}
            emptyText="Holatlar yo’q"
            rows={[...history].reverse().map((point) => ({
              key: point.periodId,
              cells: [
                <Cell
                  key="month"
                  text={point.label}
                  className={point.key === period.key ? "font-semibold text-brand" : undefined}
                />,
                <Link
                  key="transformer"
                  href={`/transformers/${point.transformer.id}`}
                  title={point.transformer.name}
                  className={LINK_CLASS}
                >
                  {point.transformer.name}
                </Link>,
                <Cell key="reading" text={reading(point.meterReading)} />,
                <Cell key="diff" text={signedReading(point.readingDiff)} className="text-ink-muted" />,
                <Cell
                  key="debt"
                  text={exactMoney(point.debtUzs)}
                  className={point.debtUzs > 0 ? "font-semibold text-trend-up" : "text-ink-soft"}
                />,
                <Cell
                  key="credit"
                  text={exactMoney(point.creditUzs)}
                  className={point.creditUzs > 0 ? "text-trend-down" : "text-ink-soft"}
                />,
                <Cell
                  key="status"
                  text={METER_STATUS_LABEL[point.meterStatus]}
                  className={METER_STATUS_TEXT[point.meterStatus]}
                />,
                <Cell key="payment-date" text={formatDate(point.lastPaymentDate)} />,
                <Cell key="payment-sum" text={exactMoney(point.lastPaymentUzs)} />,
              ],
            }))}
          />
        </div>
      </CardBody>
    </Card>
  );

  if (!snapshot) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
        {header}
        <Card className="h-56 shrink-0">
          <EmptyState
            variant="inline"
            action={false}
            title={`${subscriber.fullName} uchun ${period.label} oyida ma’lumot yo’q`}
            description={`Sarlavhadagi ma’lumotlar ${sourceLabel} oyi holatidan olingan.`}
          />
        </Card>
        {history.length > 0 ? (
          <div className="grid shrink-0 grid-cols-12 grid-rows-[360px] gap-2">
            {historyCard("col-span-7")}
            {chartCard("col-span-5")}
          </div>
        ) : null}
      </div>
    );
  }

  const debtTrend = moneyTrend(snapshot.debtUzs, previous?.debtUzs, "bad");
  const creditTrend = moneyTrend(snapshot.creditUzs, previous?.creditUzs, "flat");

  const info: InfoItem[] = [
    { key: "contract", label: "Shartnoma raqami", value: subscriber.contractNumber },
    { key: "contract-date", label: "Shartnoma sanasi", value: formatDate(snapshot.contractDate) },
    { key: "kind", label: "Turi", value: SUBSCRIBER_KIND_LABEL[snapshot.kind] },
    {
      key: "status",
      label: "Holati",
      value: <span className={METER_STATUS_TEXT[snapshot.meterStatus]}>{METER_STATUS_LABEL[snapshot.meterStatus]}</span>,
    },
    {
      key: "substation",
      label: "Podstansiya",
      value: (
        <Link href={`/substations/${subscriber.substation.id}`} className={LINK_CLASS}>
          {subscriber.substation.name}
        </Link>
      ),
    },
    {
      key: "feeder",
      label: "Fider",
      value: (
        <Link href={`/feeders/${subscriber.feeder.id}`} className={LINK_CLASS}>
          {subscriber.feeder.name}
        </Link>
      ),
    },
    {
      key: "transformer",
      label: "TP",
      value: (
        <Link href={`/transformers/${subscriber.transformer.id}`} className={LINK_CLASS}>
          {subscriber.transformer.name}
        </Link>
      ),
    },
    {
      key: "staff",
      label: "Biriktirilgan xodim",
      value: snapshot.staff ? (
        <Link href={staffHref(snapshot.staff.name)} className={LINK_CLASS}>
          {snapshot.staff.name}
        </Link>
      ) : (
        EMPTY
      ),
    },
    { key: "meter-serial", label: "Hisoblagich zavod raqami", value: snapshot.meterSerial ?? EMPTY },
    { key: "meter-type", label: "Hisoblagich turi", value: snapshot.meterType ?? EMPTY },
    { key: "meter-installed", label: "O’rnatilgan sana", value: formatDate(snapshot.meterInstalledAt) },
    { key: "last-reading", label: "Oxirgi olingan ma’lumot", value: formatDateTime(snapshot.lastReadingAt) },
    { key: "payment-date", label: "Oxirgi to’lov sanasi", value: formatDate(snapshot.lastPaymentDate) },
    { key: "payment-sum", label: "Oxirgi to’lov summasi", value: exactMoney(snapshot.lastPaymentUzs) },
    {
      key: "address",
      label: "Manzil",
      value: snapshot.address ? <span title={snapshot.address}>{snapshot.address}</span> : EMPTY,
    },
    {
      key: "location",
      label: "Lokatsiya",
      value:
        snapshot.lat != null && snapshot.lng != null ? (
          <Link
            href={`/map?${new URLSearchParams({ node: `subscriber:${subscriber.id}` })}`}
            className={LINK_CLASS}
          >
            {dec(snapshot.lat, 6)} · {dec(snapshot.lng, 6)}
          </Link>
        ) : (
          EMPTY
        ),
    },
  ];

  const transformerScope = { kind: "transformer", id: subscriber.transformer.id } as const;
  const violations = related?.violations;
  const appeals = related?.appeals;

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
      {header}

      <StatRow>
        <StatCard
          label="Qarzdorlik"
          value={money(snapshot.debtUzs)}
          icon={HandCoins}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint={debtTrend?.hint ?? (snapshot.debtUzs > 0 ? "Qarzdorlik mavjud" : "Qarzdorlik yo’q")}
          hintTone={debtTrend?.tone ?? "flat"}
        />
        <StatCard
          label="Haqdorlik"
          value={money(snapshot.creditUzs)}
          icon={PiggyBank}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint={creditTrend?.hint ?? (snapshot.creditUzs > 0 ? "Haqdorlik mavjud" : "Haqdorlik yo’q")}
          hintTone={creditTrend?.tone ?? "flat"}
        />
        <StatCard
          label="Hisoblagich ko’rsatkichi"
          value={reading(snapshot.meterReading)}
          icon={Gauge}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={
            current?.readingDiff != null
              ? `Oldingi holatga nisbatan farq: ${signedReading(current.readingDiff)}`
              : `Olingan: ${formatDateTime(snapshot.lastReadingAt)}`
          }
        />
        <StatCard
          label="Oxirgi to’lov"
          value={money(snapshot.lastPaymentUzs)}
          icon={Wallet}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={snapshot.lastPaymentDate ? `Sana: ${formatDate(snapshot.lastPaymentDate)}` : "To’lov sanasi ko’rsatilmagan"}
        />
      </StatRow>

      <div className="grid shrink-0 grid-cols-12 grid-rows-[512px_372px] gap-2">
        <Card className="col-span-5">
          <CardHeader title="Umumiy ma’lumotlar">
            <span className="text-[11px] text-ink-soft">{period.label}</span>
          </CardHeader>
          <CardBody>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
              <InfoGrid items={info} columns={2} />
            </div>
          </CardBody>
        </Card>

        {chartCard("col-span-7")}

        {historyCard("col-span-7")}

        <div className="col-span-5 grid min-h-0 grid-rows-2 gap-2">
          <Card>
            <CardHeader title="Qoidabuzarliklar">
              {violations?.uploaded && violations.rows.length > 0 ? (
                <span className="text-[11px] text-ink-soft">
                  Zarar: {money(sum(violations.rows.map((row) => row.damageUzs)))}
                </span>
              ) : null}
              <Link
                href={scopedHref("/violations", transformerScope, { q: subscriber.fullName })}
                className="text-[11px] font-medium text-brand transition-opacity hover:opacity-70"
              >
                Ro&rsquo;yxat
              </Link>
            </CardHeader>
            <CardBody>
              {!violations?.uploaded ? (
                <InlineNote>{period.label} oyi uchun qoidabuzarliklar yuklanmagan</InlineNote>
              ) : violations.rows.length === 0 ? (
                <InlineNote>{period.label} oyida bu abonentga qoidabuzarlik bog&rsquo;lanmagan</InlineNote>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
                  <DataTable
                    columns={VIOLATION_COLUMNS}
                    lastRowFooter={false}
                    rows={violations.rows.map((row) => ({
                      key: row.id,
                      cells: [
                        formatDate(row.date),
                        VIOLATOR_TYPE_LABEL[row.violatorType],
                        <span key="uzs" className="font-medium">
                          {num(row.damageUzs)}
                        </span>,
                        num(row.damageKwh),
                      ],
                    }))}
                  />
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Murojaatlar">
              <Link
                href={scopedHref("/appeals", transformerScope, { q: subscriber.fullName })}
                className="text-[11px] font-medium text-brand transition-opacity hover:opacity-70"
              >
                Ro&rsquo;yxat
              </Link>
            </CardHeader>
            <CardBody>
              {!appeals?.uploaded ? (
                <InlineNote>{period.label} oyi uchun murojaatlar yuklanmagan</InlineNote>
              ) : appeals.rows.length === 0 ? (
                <InlineNote>{period.label} oyida bu abonentga murojaat bog&rsquo;lanmagan</InlineNote>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
                  <DataTable
                    columns={APPEAL_COLUMNS}
                    lastRowFooter={false}
                    rows={appeals.rows.map((row) => ({
                      key: row.id,
                      cells: [
                        formatDate(row.date),
                        <span key="text" title={row.text} className="block truncate">
                          {row.text}
                        </span>,
                        <Badge key="status" tone={APPEAL_STATUS_TONE[row.status]}>
                          {APPEAL_STATUS_LABEL[row.status]}
                        </Badge>,
                      ],
                    }))}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
