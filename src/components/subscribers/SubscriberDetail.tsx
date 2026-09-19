import { Gauge, Gavel, HandCoins, Info, MessagesSquare, PiggyBank, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { InteractiveMapCard } from "@/components/cards/InteractiveMapCard";
import {
  KpiBars,
  KpiFigure,
  type KpiLine,
  KpiLines,
  KpiShell,
  TONE_TEXT,
  TREND_ICON,
} from "@/components/home/cards/HomeKpiRow";
import { PhotoSlot } from "@/components/subscribers/PhotoSlot";
import { ReadingDiffChart } from "@/components/subscribers/ReadingDiffChart";
import {
  METER_STATUS_TEXT,
  METER_STATUS_TONE,
  exactMoney,
  reading,
  signedReading,
} from "@/components/subscribers/subscriber-ui";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone, DataTable, type TableColumn } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { InfoGrid, type InfoItem } from "@/components/ui/InfoGrid";
import type { AppealStatus } from "@/generated/prisma";
import {
  APPEAL_STATUS_LABEL,
  METER_STATUS_LABEL,
  SUBSCRIBER_KIND_LABEL,
  VIOLATOR_TYPE_LABEL,
} from "@/lib/domain/labels";
import { daysBetween, delta, fractions, monthsBetween, sum } from "@/lib/domain/metrics";
import {
  count,
  daysBeforeReport,
  durationText,
  EMPTY,
  energy,
  formatDate,
  formatDateTime,
  formatLocalDate,
  money,
  monthLabel,
  num,
  parseMonthKey,
  scaled,
} from "@/lib/format";
import type { PeriodInfo } from "@/lib/period";
import type { SubscriberHistoryPoint, SubscriberDetail as SubscriberEntity } from "@/lib/queries/entities";
import type { SubscriberPhotos } from "@/lib/queries/subscriber-photos";
import type {
  SubscriberEventPoint,
  SubscriberRelated,
  SubscriberSource,
} from "@/lib/queries/subscribers-related";
import type { HomeTone } from "@/lib/queries/home-data";
import { scopedHref } from "@/lib/scope-param";

// O'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, string proplarda ’.

/*
 * Abonent sahifasi - bosh sahifa uslubida (18 ustunli tarmoq, 8px oraliq,
 * rangli KPI kartalari). Qatorlar:
 *
 *   344  Abonent (7, rasm) | Hisoblagich (6, rasm) | Joylashuv (5)
 *   196  6 ta KPI (span-3)
 *   336  Oylar bo'yicha holat (12) | Ko'rsatkich farqi (6)
 *   280  Qoidabuzarliklar (6) | Murojaatlar (6) | Ma'lumot manbasi (6)
 *
 * Qiymatlar "Elektr Abonentlar.xlsx" shablonidan va undan hisoblangan
 * (farq, sanalar orasi); passport va PINFL qisman yashirilgan holda
 * serverdan keladi. Rasmlar - sahifadan qo'lda yuklanadigan yagona ma'lumot
 * (`malumotlar.md` 1-bo'lim).
 */

const GRID = "scrollbar-none grid h-full min-h-0 grid-cols-18 gap-2 overflow-y-auto";

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

/** Xarita: abonent ko'cha darajasida. */
const MAP_ZOOM = 16;

/** Tor katakdagi matn: kesilib qolsa to'liq qiymat `title` da ko'rinadi. */
function Cell({ text, className }: { text: string; className?: string }) {
  return (
    <span title={text === EMPTY ? undefined : text} className={className}>
      {text}
    </span>
  );
}

/** Kichik jadvalli karta ichidagi bo'sh / yuklanmagan holat. */
function InlineNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center rounded-md bg-canvas px-3 text-center text-xs text-ink-muted">
      {children}
    </div>
  );
}

/** Kesiladigan matn qiymati: to'liq ko'rinishi `title` da. */
function Truncated({ text }: { text: string | null | undefined }) {
  return text ? <span title={text}>{text}</span> : EMPTY;
}

function staffHref(name: string): string {
  return `/staff?${new URLSearchParams({ q: name })}`;
}

/** Rasm o'rinbosari: FISH ning birinchi ikki so'zi bosh harflari. */
function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <span className="flex size-16 items-center justify-center rounded-full bg-tint-purple text-xl font-bold text-accent-purple">
      {letters || "?"}
    </span>
  );
}

function MeterGlyph() {
  return (
    <span className="flex size-16 items-center justify-center rounded-full bg-tint-indigo text-accent-indigo">
      <Icon icon={Gauge} size={30} />
    </span>
  );
}

/** Ulanish yo'li: Podstansiya › Fider › TP (har biri o'z sahifasiga). */
function NetworkPath({ subscriber }: { subscriber: SubscriberEntity }) {
  const steps = [
    { href: `/substations/${subscriber.substation.id}`, name: subscriber.substation.name },
    { href: `/feeders/${subscriber.feeder.id}`, name: subscriber.feeder.name },
    { href: `/transformers/${subscriber.transformer.id}`, name: subscriber.transformer.name },
  ];
  return (
    <span title={steps.map((step) => step.name).join(" › ")}>
      {steps.map((step, index) => (
        <span key={step.href}>
          {index > 0 ? <span className="text-ink-soft"> › </span> : null}
          <Link href={step.href} className={LINK_CLASS}>
            {step.name}
          </Link>
        </span>
      ))}
    </span>
  );
}

/** Rasm va ma'lumotlar ustuni bor profil kartasi (Abonent / Hisoblagich). */
function ProfileCard({
  title,
  badges,
  photo,
  items,
  className,
}: {
  title: string;
  badges?: ReactNode;
  photo: ReactNode;
  items: readonly InfoItem[];
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title}>{badges}</CardHeader>
      <div className="flex min-h-0 flex-1 gap-4 pt-2">
        {photo}
        <div className="scrollbar-none min-h-0 min-w-0 flex-1 overflow-y-auto">
          <InfoGrid items={items} columns={2} />
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// KPI
// ---------------------------------------------------------------------------

/**
 * O'tgan oy bilan pul farqi - bosh sahifadagi yozuv: mutlaq farq, ko'rsatilgan
 * aniqlikda ("0 so’m ga ko’p" chiqmasin). O'tgan oy holati yo'q - qator yo'q.
 */
function moneyTrend(current: number, previous: number | undefined, risingIsBad: boolean): KpiLine | null {
  const change = delta(current, previous);
  if (!change) return null;
  if (money(Math.abs(change.diff)) === money(0)) {
    return { id: "trend", text: "O’zgarmagan", icon: TREND_ICON.flat, tone: TONE_TEXT.neutral };
  }
  const up = change.diff > 0;
  const tone: HomeTone = risingIsBad ? (up ? "bad" : "good") : "neutral";
  return {
    id: "trend",
    text: `${money(Math.abs(change.diff))} ga ${up ? "ko’p" : "kam"}`,
    icon: up ? TREND_ICON.up : TREND_ICON.down,
    tone: TONE_TEXT[tone],
  };
}

function lines(...items: (KpiLine | null | false)[]): KpiLine[] {
  return items.filter((item): item is KpiLine => Boolean(item));
}

interface KpiSpec {
  id: string;
  title: string;
  icon: GlyphIcon;
  tint: string;
  accent: string;
  value: string;
  unit: string;
  lines: KpiLine[];
  /** Oylar bo'yicha xom qiymatlar (ustunchalar uchun). */
  series: readonly (number | null)[];
}

function SubscriberKpis({ specs, months }: { specs: readonly KpiSpec[]; months: number }) {
  return (
    <>
      {specs.map((spec) => (
        <KpiShell
          key={spec.id}
          className="col-span-3"
          title={spec.title}
          icon={spec.icon}
          tint={spec.tint}
          accent={spec.accent}
        >
          <KpiFigure value={spec.value} unit={spec.unit} />
          <KpiLines lines={spec.lines} />
          <KpiBars
            values={fractions(spec.series.map((value) => value ?? 0))}
            accent={spec.accent}
            label={`${months} oy`}
          />
        </KpiShell>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sahifa
// ---------------------------------------------------------------------------

/**
 * Abonent sahifasi. Server komponent - grafik (`ReadingDiffChart`), xarita va
 * rasm yuklash (`PhotoSlot`) mijozda.
 */
export function SubscriberDetail({
  subscriber,
  period,
  history,
  previous,
  related,
  photos,
  source,
  events,
}: {
  subscriber: SubscriberEntity;
  period: PeriodInfo;
  /** Tanlangan oygacha (u ham kiradi) holatlar, eskidan yangiga. */
  history: SubscriberHistoryPoint[];
  /** Aynan o'tgan oy (`month - 1`) holati; yo'q bo'lsa - null. */
  previous: SubscriberHistoryPoint | null;
  /** Holat yo'q oyda - null. */
  related: SubscriberRelated | null;
  photos: SubscriberPhotos;
  /** Holat yo'q oyda - null. */
  source: SubscriberSource | null;
  /** `history` bilan bir xil tartibda. */
  events: SubscriberEventPoint[];
}) {
  const snapshot = subscriber.snapshot;
  const current = history.find((point) => point.key === period.key) ?? null;

  const subscriberPhoto = (
    <PhotoSlot
      className="w-36 shrink-0"
      subscriberId={subscriber.id}
      kind="SUBSCRIBER"
      photo={photos.SUBSCRIBER}
      placeholder={<Initials name={subscriber.fullName} />}
    />
  );
  const meterPhoto = (
    <PhotoSlot
      className="w-36 shrink-0"
      subscriberId={subscriber.id}
      kind="METER"
      photo={photos.METER}
      placeholder={<MeterGlyph />}
    />
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
          Farq &mdash; oldingi mavjud oy holatidagi ko&rsquo;rsatkichdan ayirma. Hisoblagich koeffitsiyenti
          hisobga olinmagan, shuning uchun bu kWh iste&rsquo;mol emas.
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
        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
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

  const basicItems: InfoItem[] = [
    { key: "contract", label: "Shartnoma raqami", value: subscriber.contractNumber },
    { key: "network", label: "Ulanish", value: <NetworkPath subscriber={subscriber} />, wide: true },
  ];

  if (!snapshot) {
    const sourceLabel = monthLabel(parseMonthKey(subscriber.sourcePeriodKey));
    return (
      <div className={`${GRID} grid-rows-[344px_336px]`}>
        <ProfileCard className="col-span-7" title={subscriber.fullName} photo={subscriberPhoto} items={basicItems} />
        <ProfileCard
          className="col-span-6"
          title="Hisoblagich"
          photo={meterPhoto}
          items={[{ key: "none", label: "Hisoblagich", value: `${period.label} oyida ma’lumot yo’q`, wide: true }]}
        />
        <Card className="col-span-5">
          <EmptyState
            variant="inline"
            action={false}
            title={`${period.label} oyida ma’lumot yo’q`}
            description={`Abonent nomi va ulanishi ${sourceLabel} oyi holatidan olingan. Yon paneldan boshqa oyni tanlang.`}
          />
        </Card>
        {history.length > 0 ? (
          <>
            {historyCard("col-span-12")}
            {chartCard("col-span-6")}
          </>
        ) : null}
      </div>
    );
  }

  const reportDate = period.reportDate;
  const profileItems: InfoItem[] = [
    basicItems[0],
    { key: "contract-date", label: "Shartnoma sanasi", value: formatDate(snapshot.contractDate) },
    { key: "passport", label: "Passport", value: snapshot.maskedPassport ?? EMPTY },
    { key: "pinfl", label: "PINFL", value: snapshot.maskedPinfl ?? EMPTY },
    { key: "address", label: "Manzil", value: <Truncated text={snapshot.address} />, wide: true },
    basicItems[1],
    {
      key: "staff",
      label: "Biriktirilgan xodim",
      value: snapshot.staff ? (
        <Link href={staffHref(snapshot.staff.name)} title={snapshot.staff.name} className={LINK_CLASS}>
          {snapshot.staff.name}
        </Link>
      ) : (
        EMPTY
      ),
    },
    {
      key: "contract-age",
      label: "Shartnoma muddati",
      value: durationText(monthsBetween(snapshot.contractDate, reportDate)),
    },
  ];

  const meterItems: InfoItem[] = [
    { key: "serial", label: "Zavod raqami", value: <Truncated text={snapshot.meterSerial} /> },
    { key: "type", label: "Turi", value: <Truncated text={snapshot.meterType} /> },
    { key: "installed", label: "O’rnatilgan sana", value: formatDate(snapshot.meterInstalledAt) },
    {
      key: "age",
      label: "Xizmat muddati",
      value: durationText(monthsBetween(snapshot.meterInstalledAt, reportDate)),
    },
    { key: "reading", label: "Ko’rsatkich", value: reading(snapshot.meterReading) },
    { key: "diff", label: "Oldingi holatdan farq", value: signedReading(current?.readingDiff) },
    {
      key: "status",
      label: "Aloqa holati",
      value: (
        <span className={METER_STATUS_TEXT[snapshot.meterStatus]}>{METER_STATUS_LABEL[snapshot.meterStatus]}</span>
      ),
    },
    { key: "last-reading", label: "Oxirgi olingan ma’lumot", value: formatDateTime(snapshot.lastReadingAt) },
  ];

  const violations = related?.violations;
  const appeals = related?.appeals;
  const debt = scaled(snapshot.debtUzs, "so’m");
  const credit = scaled(snapshot.creditUzs, "so’m");
  const payment = scaled(snapshot.lastPaymentUzs, "so’m");
  const appealCount = (status: AppealStatus) => appeals?.rows.filter((row) => row.status === status).length ?? 0;

  const kpis: KpiSpec[] = [
    {
      id: "debt",
      title: "Qarzdorlik",
      icon: HandCoins,
      tint: "bg-tint-red",
      accent: "bg-accent-red",
      value: debt.value,
      unit: debt.unit,
      lines: lines(
        previous
          ? { id: "previous", text: `O’tgan oy: ${money(previous.debtUzs)}` }
          : { id: "state", text: snapshot.debtUzs > 0 ? "Qarzdor abonent" : "Qarzdorlik yo’q" },
        moneyTrend(snapshot.debtUzs, previous?.debtUzs, true),
      ),
      series: history.map((point) => point.debtUzs),
    },
    {
      id: "credit",
      title: "Haqdorlik",
      icon: PiggyBank,
      tint: "bg-tint-green",
      accent: "bg-accent-green",
      value: credit.value,
      unit: credit.unit,
      lines: lines(
        previous
          ? { id: "previous", text: `O’tgan oy: ${money(previous.creditUzs)}` }
          : { id: "state", text: snapshot.creditUzs > 0 ? "Oldindan to’langan" : "Haqdorlik yo’q" },
        moneyTrend(snapshot.creditUzs, previous?.creditUzs, false),
      ),
      series: history.map((point) => point.creditUzs),
    },
    {
      id: "payment",
      title: "Oxirgi to’lov",
      icon: Wallet,
      tint: "bg-tint-blue",
      accent: "bg-accent-blue",
      value: payment.value,
      unit: snapshot.lastPaymentUzs != null ? payment.unit : "ma’lumot yo’q",
      lines: snapshot.lastPaymentDate
        ? [
            { id: "date", text: formatDate(snapshot.lastPaymentDate) },
            {
              id: "ago",
              text: daysBeforeReport(
                daysBetween(snapshot.lastPaymentDate, reportDate),
                monthsBetween(snapshot.lastPaymentDate, reportDate),
              ),
            },
          ]
        : [{ id: "date", text: "To’lov sanasi ko’rsatilmagan" }],
      series: history.map((point) => point.lastPaymentUzs),
    },
    {
      id: "reading",
      title: "Hisoblagich ko’rsatkichi",
      icon: Gauge,
      tint: "bg-tint-indigo",
      accent: "bg-accent-indigo",
      value: reading(snapshot.meterReading),
      unit: "",
      lines: [
        { id: "diff", text: `Farq: ${signedReading(current?.readingDiff)}` },
        {
          id: "taken",
          text: snapshot.lastReadingAt ? `Olingan: ${formatLocalDate(snapshot.lastReadingAt)}` : "Olingan sana yo’q",
        },
      ],
      series: history.map((point) => point.readingDiff),
    },
    {
      id: "violations",
      title: "Qoidabuzarliklar",
      icon: Gavel,
      tint: "bg-tint-amber",
      accent: "bg-accent-amber",
      value: violations?.uploaded ? num(violations.rows.length) : EMPTY,
      unit: violations?.uploaded ? "ta" : "yuklanmagan",
      lines: violations?.uploaded
        ? [
            { id: "uzs", text: `Zarar: ${money(sum(violations.rows.map((row) => row.damageUzs)))}` },
            { id: "kwh", text: `Taxminiy: ${energy(sum(violations.rows.map((row) => row.damageKwh)))}` },
          ]
        : [{ id: "missing", text: `${period.label} uchun yuklanmagan` }],
      series: events.map((point) => point.violations),
    },
    {
      id: "appeals",
      title: "Murojaatlar",
      icon: MessagesSquare,
      tint: "bg-tint-purple",
      accent: "bg-accent-purple",
      value: appeals?.uploaded ? num(appeals.rows.length) : EMPTY,
      unit: appeals?.uploaded ? "ta" : "yuklanmagan",
      lines: appeals?.uploaded
        ? [
            { id: "progress", text: `Jarayonda: ${count(appealCount("IN_PROGRESS"))}` },
            { id: "overdue", text: `Muddati buzilgan: ${count(appealCount("OVERDUE"))}` },
          ]
        : [{ id: "missing", text: `${period.label} uchun yuklanmagan` }],
      series: events.map((point) => point.appeals),
    },
  ];

  const transformerScope = { kind: "transformer", id: subscriber.transformer.id } as const;
  const coordinates = snapshot.lat != null && snapshot.lng != null ? { lat: snapshot.lat, lng: snapshot.lng } : null;

  return (
    <div className={`${GRID} grid-rows-[196px_344px_336px_280px]`}>
      {/* 1-qator - pul va hisoblagich ko'rsatkichlari, oylar bo'yicha (bosh sahifadagi kabi eng yuqorida) */}
      <SubscriberKpis specs={kpis} months={history.length} />

      {/* 2-qator - kim va nima: abonent, hisoblagich, joylashuv */}
      <ProfileCard
        className="col-span-7"
        title={subscriber.fullName}
        badges={
          <>
            <Badge tone={snapshot.kind === "LEGAL" ? "purple" : "blue"}>{SUBSCRIBER_KIND_LABEL[snapshot.kind]}</Badge>
            <Badge tone={METER_STATUS_TONE[snapshot.meterStatus]}>{METER_STATUS_LABEL[snapshot.meterStatus]}</Badge>
          </>
        }
        photo={subscriberPhoto}
        items={profileItems}
      />
      <ProfileCard
        className="col-span-6"
        title="Hisoblagich"
        badges={snapshot.meterType ? <Badge tone="blue">{snapshot.meterType}</Badge> : null}
        photo={meterPhoto}
        items={meterItems}
      />
      <InteractiveMapCard
        className="col-span-5"
        markers={
          coordinates
            ? [{ id: subscriber.id, ...coordinates, label: subscriber.fullName, kind: "subscriber" }]
            : []
        }
        selectedId={subscriber.id}
        fitDistrict={!coordinates}
        center={coordinates ?? undefined}
        zoom={MAP_ZOOM}
        footerHref={`/map?${new URLSearchParams({ node: `subscriber:${subscriber.id}` })}`}
      />

      {/* 3-qator */}
      {historyCard("col-span-12")}
      {chartCard("col-span-6")}

      {/* 4-qator */}
      <Card className="col-span-6">
        <CardHeader title="Qoidabuzarliklar">
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
            <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
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

      <Card className="col-span-6">
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
            <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
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

      <SourceCard className="col-span-6" source={source} period={period} />
    </div>
  );
}

/** Ixcham "yorliq - qiymat" ro'yxati: qiymat ustuni qolgan kenglikni oladi, kesilsa `title` da. */
function SourceList({ items }: { items: readonly { label: string; value: string | null }[] }) {
  return (
    <dl className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs">
      {items.map((item) => (
        <div key={item.label} className="contents">
          <dt className="text-ink-soft">{item.label}</dt>
          <dd className="truncate font-medium text-ink" title={item.value ?? undefined}>
            {item.value ?? EMPTY}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "Ma'lumot manbasi": shu oy holati qaysi fayl va qatordan kelgani,
 * konvertatsiya izohi va tozalashdan oldingi asl yozuvlar (`sourceRow`,
 * malumotlar.md 4.3c). Shaxsiy ustunlar bu yerga kelmaydi.
 */
function SourceCard({
  source,
  period,
  className,
}: {
  source: SubscriberSource | null;
  period: PeriodInfo;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title="Ma’lumot manbasi">
        <span className="text-[11px] text-ink-soft">{period.label}</span>
      </CardHeader>
      <CardBody>
        {!source ? (
          <InlineNote>Manba ma&rsquo;lumoti yo&rsquo;q</InlineNote>
        ) : (
          <div className="scrollbar-none flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            <SourceList
              items={[
                {
                  label: "Yuklangan fayl",
                  // Qator raqami - fayldagi yozuv ("3399-qator"), ming ajratgichsiz.
                  value: source.upload ? `${source.upload.fileName}, ${source.rowNumber}-qator` : null,
                },
                { label: "Yuklangan vaqt", value: source.upload?.uploadedAt ? formatDateTime(source.upload.uploadedAt) : null },
                { label: "Asl manba", value: source.origin },
              ]}
            />
            {source.note ? (
              <div className="flex shrink-0 items-start gap-1.5 rounded-md bg-tint-amber p-2 text-[11px] leading-4 text-state-warn">
                <Icon icon={Info} size={14} className="mt-px shrink-0" />
                <p>{source.note}</p>
              </div>
            ) : null}
            {source.originals.length > 0 ? (
              <div className="shrink-0">
                <p className="pb-1 text-[10px] text-ink-soft">Fayldagi asl yozuv (tozalashdan oldin)</p>
                <SourceList items={source.originals} />
              </div>
            ) : null}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
