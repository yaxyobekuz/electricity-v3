"use client";

import { ResponsiveBar } from "@nivo/bar";
import Link from "next/link";
import { Coins, Gauge, Phone, PlugZap, Wallet, Wifi, WifiOff } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  Badge,
  type BadgeTone,
  DataTable,
  type TableColumn,
} from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { InfoGrid, type InfoItem } from "@/components/ui/InfoGrid";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { between, dec, MONTHS_SHORT_UZ, MONTHS_UZ, money, num } from "@/lib/data/seed";
import {
  SUBSCRIBER_KIND_LABEL,
  SUBSCRIBER_STATUS_LABEL,
  type Subscriber,
  type SubscriberStatus,
} from "@/lib/data/subscribers";

// O'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, string proplarda ’.

const STATUS_TONE: Record<SubscriberStatus, BadgeTone> = {
  active: "green",
  debtor: "red",
  disconnected: "amber",
};

const STATUS_TEXT: Record<SubscriberStatus, string> = {
  active: "text-state-ok",
  debtor: "text-state-bad",
  disconnected: "text-state-warn",
};

/**
 * Maketdagi "bugun" - 10-avgust, 2026 (`seed.ts` dagi `TODAY`). Grafik va
 * jadvallardagi oylar shu nuqtadan orqaga sanaladi.
 */
const CURRENT_MONTH = 7;
const CURRENT_YEAR = 2026;
const TODAY_DAY = 10;

/** To'lovlar tarixidagi qatorlar soni. */
const PAYMENT_ROWS = 8;
/** Hisoblagich ko'rsatkichlari jadvalidagi qatorlar soni. */
const READING_ROWS = 6;

const PAYMENT_METHODS = ["Click", "Payme", "Uzum Bank", "Bank o’tkazmasi", "Naqd pul"] as const;

interface PaymentRow {
  key: string;
  date: string;
  amount: number;
  method: string;
  status: { label: string; tone: BadgeTone };
}

interface ReadingRow {
  key: string;
  date: string;
  reading: number;
  diff: number;
}

/** "12-iyul, 2026" ko'rinishidagi sana - oy nomi kichik harflar bilan. */
function formatDate(day: number, monthIndex: number): string {
  return `${day}-${MONTHS_UZ[monthIndex].toLowerCase()}, ${CURRENT_YEAR}`;
}

/**
 * To'lovlar tarixi - oxirgi 8 oy. Summalar oylik hisob (`monthlyKwh * tariff`)
 * atrofida tebranadi, hammasi seed'dan hisoblanadi: server va mijoz bir xil
 * markup chizadi.
 */
function buildPayments(subscriber: Subscriber, seed: number): PaymentRow[] {
  const invoice = subscriber.monthlyKwh * subscriber.tariff;

  return Array.from({ length: PAYMENT_ROWS }, (_, index) => {
    const monthIndex = CURRENT_MONTH - index;
    // Joriy oyda to'lov bugundan keyingi sanaga tushib qolmasligi kerak.
    const lastDay = monthIndex === CURRENT_MONTH ? TODAY_DAY - 1 : 27;
    const day = between(seed * 3.7 + index * 11.3, 3, lastDay, 1);
    const amount = between(seed * 5.3 + index * 13.7, invoice * 0.6, invoice * 1.25, 1_000);
    const roll = between(seed * 7.9 + index * 17.1, 0, 9, 1);

    // Joriy oy qarzdorda hali yopilmagan, ba'zi oylar esa qisman to'langan.
    const status =
      subscriber.status !== "active" && index === 0
        ? { label: "Kutilmoqda", tone: "blue" as BadgeTone }
        : roll < 2
          ? { label: "Qisman", tone: "amber" as BadgeTone }
          : { label: "To’landi", tone: "green" as BadgeTone };

    return {
      key: `payment-${index}`,
      date: formatDate(day, monthIndex),
      amount,
      method: PAYMENT_METHODS[(seed + index) % PAYMENT_METHODS.length],
      status,
    };
  });
}

/**
 * Hisoblagich ko'rsatkichlari - oxirgi 6 oy. Eng yangi qator `lastReading`,
 * har bir oldingi qator undan o'sha oyning iste'moli ayirilgan holda olinadi
 * (ya'ni "Farq" ustuni doim yuqoridagi qatorga mos keladi).
 *
 * `lastReading` (hisoblagichning jami soni) va `monthly` (oylik iste'mol)
 * seed'da bir-biridan mustaqil hosil bo'ladi, shuning uchun yirik yuridik
 * iste'molchida 5 oylik iste'mol jami sondan katta chiqib qolishi mumkin.
 * Shunday holatda farqlar bitta koeffitsiyent bilan siqiladi: hisoblagich
 * orqaga aylanmaydi, jadvalda manfiy ko'rsatkich chiqmasligi kerak.
 */
function buildReadings(subscriber: Subscriber, seed: number): ReadingRow[] {
  const diffs = Array.from(
    { length: READING_ROWS },
    (_, index) => subscriber.monthly[subscriber.monthly.length - 1 - index],
  );
  // Oxirgi qatordan pastda qator yo'q - undan ayirilmaydi ham.
  const drop = diffs.slice(0, READING_ROWS - 1).reduce((sum, value) => sum + value, 0);
  // Eng eski qator ham ishonchli musbat qolsin: pasayish 80% dan oshmaydi.
  const limit = subscriber.lastReading * 0.8;
  const scale = drop > limit ? limit / drop : 1;

  let reading = subscriber.lastReading;

  return diffs.map((value, index) => {
    const diff = Math.round(value * scale);
    const row: ReadingRow = {
      key: `reading-${index}`,
      // Birinchi qator - aynan `lastReading`, demak sanasi ham o'shaniki
      // (ro'yxat sahifasi va yuqoridagi ko'rsatkich bilan bir xil bo'lsin).
      date:
        index === 0
          ? subscriber.lastReadingDate
          : formatDate(
              between(seed * 19.1 + index * 7.3, 2, 9, 1),
              CURRENT_MONTH - index,
            ),
      reading,
      diff,
    };
    reading -= diff;
    return row;
  });
}

const PAYMENT_COLUMNS: TableColumn[] = [
  { key: "date", label: "Sana", grow: 1.3, align: "left" },
  { key: "amount", label: "Summa", grow: 1.2, align: "right" },
  { key: "method", label: "Usul", grow: 1.3 },
  { key: "status", label: "Holat", grow: 1 },
];

const READING_COLUMNS: TableColumn[] = [
  { key: "date", label: "Sana", grow: 1.4, align: "left" },
  { key: "reading", label: "Ko’rsatkich", grow: 1.2, align: "right" },
  { key: "diff", label: "Farq (kWh)", grow: 1.1, align: "right" },
];

const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" },
  axis: {
    ticks: { text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#e8e8ec", strokeDasharray: "2 2" } },
} as const;

/** O'qda joy tor: mingdan katta qiymatlar "12,4K" ko'rinishida qisqaradi. */
function formatAxisValue(value: number): string {
  return Math.abs(value) >= 1_000 ? `${dec(value / 1_000)}K` : num(value);
}

/**
 * Abonent kartochkasi: yuqorida to'lov va iste'mol ko'rsatkichlari, pastda
 * ikki qator karta (ma'lumotlar + grafik, to'lovlar + ko'rsatkichlar).
 *
 * Grafik uchun `@nivo/bar` ishlatilgani sababli fayl mijoz komponenti; sahifa
 * (`page.tsx`) esa serverda qoladi va metadata beradi.
 */
export function SubscriberDetail({ subscriber }: { subscriber: Subscriber }) {
  // Mock jadvallar uchun barqaror seed - abonent id'sidagi tartib raqami.
  const seed = Number.parseInt(subscriber.id.replace(/\D/g, ""), 10) || 1;

  const payments = buildPayments(subscriber, seed);
  const readings = buildReadings(subscriber, seed);
  const paidTotal = payments.reduce((sum, item) => sum + item.amount, 0);
  const averageKwh = Math.round(
    subscriber.monthly.reduce((sum, value) => sum + value, 0) / subscriber.monthly.length,
  );
  const debtor = subscriber.balance < 0;

  const chartData = subscriber.monthly.map((value, index) => ({
    month: MONTHS_SHORT_UZ[index],
    value,
  }));

  const info: InfoItem[] = [
    { key: "code", label: "Shartnoma raqami", value: subscriber.code },
    { key: "kind", label: "Turi", value: SUBSCRIBER_KIND_LABEL[subscriber.kind] },
    {
      key: "status",
      label: "Holat",
      value: (
        <span className={STATUS_TEXT[subscriber.status]}>
          {SUBSCRIBER_STATUS_LABEL[subscriber.status]}
        </span>
      ),
    },
    { key: "contract", label: "Shartnoma sanasi", value: subscriber.contractDate },
    {
      key: "transformer",
      label: "Transformator",
      value: (
        <Link
          href={`/transformers/${subscriber.transformerId}`}
          className="text-brand transition-opacity hover:opacity-70"
        >
          {subscriber.transformerCode}
        </Link>
      ),
    },
    { key: "area", label: "Hudud", value: subscriber.area },
    { key: "phone", label: "Telefon", value: subscriber.phone },
    { key: "meter-no", label: "Hisoblagich raqami", value: subscriber.meterNo },
    { key: "meter-type", label: "Hisoblagich turi", value: subscriber.meterType },
    {
      key: "online",
      label: "Aloqa holati",
      value: (
        <span
          className={`flex items-center gap-1 ${
            subscriber.online ? "text-state-ok" : "text-state-warn"
          }`}
        >
          <Icon icon={subscriber.online ? Wifi : WifiOff} size={14} />
          {subscriber.online ? "Aloqada" : "Aloqada emas"}
        </span>
      ),
    },
    { key: "tariff", label: "Tarif", value: `${num(subscriber.tariff)} so’m/kWh` },
    { key: "average", label: "Oylik o’rtacha", value: `${num(averageKwh)} kWh` },
    { key: "address", label: "Manzil", value: subscriber.address, wide: true },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
      <PageHeader
        title={subscriber.name}
        subtitle={`${subscriber.code} · ${SUBSCRIBER_KIND_LABEL[subscriber.kind]} · ${subscriber.area}`}
        backHref="/subscribers"
        backLabel="Ro’yxatga qaytish"
      >
        <Badge tone={STATUS_TONE[subscriber.status]}>
          {SUBSCRIBER_STATUS_LABEL[subscriber.status]}
        </Badge>
        <HeaderButton icon={Phone}>Bog&rsquo;lanish</HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label={"Oylik iste’mol"}
          value={num(subscriber.monthlyKwh)}
          unit="kWh"
          icon={PlugZap}
          accent="bg-accent-teal"
          tint="bg-tint-teal"
          hint={`12 oylik o’rtacha: ${num(averageKwh)} kWh`}
        />
        <StatCard
          label="Balans"
          value={money(subscriber.balance)}
          icon={Wallet}
          accent={debtor ? "bg-accent-red" : "bg-accent-green"}
          tint={debtor ? "bg-tint-red" : "bg-tint-green"}
          hint={debtor ? "Qarzdorlik mavjud" : "Qarzdorlik yo’q"}
          hintTone={debtor ? "bad" : "good"}
        />
        <StatCard
          label="Tarif"
          value={num(subscriber.tariff)}
          unit={"so’m/kWh"}
          icon={Coins}
          accent="bg-accent-purple"
          tint="bg-tint-purple"
          hint={`Oylik hisob: ${money(subscriber.monthlyKwh * subscriber.tariff)}`}
        />
        <StatCard
          label={"So’nggi ko’rsatkich"}
          value={num(subscriber.lastReading)}
          unit="kWh"
          icon={Gauge}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`Olingan sana: ${subscriber.lastReadingDate}`}
        />
      </StatRow>

      {/* Qator balandliklari qat'iy: 468px ma'lumot/grafik, 372px jadvallar -
          shunda 1064px ish maydoniga ikkala qator ham sig'adi. */}
      <div className="grid shrink-0 grid-cols-12 grid-rows-[468px_372px] gap-2">
        <Card className="col-span-5">
          <CardHeader title="Umumiy ma&rsquo;lumotlar" />
          <CardBody>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
              <InfoGrid items={info} columns={2} />
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-7">
          <CardHeader title="12 oylik iste&rsquo;mol">
            <span className="text-[11px] text-ink-soft">kWh</span>
          </CardHeader>
          <CardBody>
            {/* Nivo SVG'si ota elementdan balandlik oladi - `min-h-0 flex-1`
                bo'lmasa grafik umuman chizilmaydi. */}
            <div className="min-h-0 flex-1">
              <ResponsiveBar
                data={chartData}
                keys={["value"]}
                indexBy="month"
                margin={{ top: 8, right: 8, bottom: 24, left: 48 }}
                padding={0.35}
                colors={["#007cd2"]}
                borderRadius={4}
                enableLabel={false}
                enableGridX={false}
                axisTop={null}
                axisRight={null}
                axisBottom={{ tickSize: 0, tickPadding: 8 }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 8,
                  tickValues: 5,
                  format: (value) => formatAxisValue(Number(value)),
                }}
                theme={CHART_THEME}
                animate={false}
                tooltip={({ indexValue, value }) => (
                  <div className="rounded-md bg-surface px-2 py-1 whitespace-nowrap shadow-md">
                    <div className="text-[9px] text-ink-soft">{indexValue}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-ink">
                      {num(value)} kWh
                    </div>
                  </div>
                )}
              />
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-7">
          <CardHeader title="To&rsquo;lovlar tarixi">
            <span className="text-[11px] text-ink-soft">Jami: {money(paidTotal)}</span>
          </CardHeader>
          <CardBody>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
              <DataTable
                columns={PAYMENT_COLUMNS}
                rows={payments.map((row) => ({
                  key: row.key,
                  cells: [
                    row.date,
                    <span key="amount" className="font-medium">
                      {money(row.amount)}
                    </span>,
                    row.method,
                    <Badge key="status" tone={row.status.tone}>
                      {row.status.label}
                    </Badge>,
                  ],
                }))}
              />
            </div>
            <p className="shrink-0 pt-2 text-[10px] text-ink-soft">
              So&rsquo;nggi 8 oy uchun to&rsquo;lovlar ko&rsquo;rsatilgan.
            </p>
          </CardBody>
        </Card>

        <Card className="col-span-5">
          <CardHeader title="Hisoblagich ko&rsquo;rsatkichlari">
            <span className="text-[11px] text-ink-soft">{subscriber.meterNo}</span>
          </CardHeader>
          <CardBody>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
              <DataTable
                columns={READING_COLUMNS}
                rows={readings.map((row) => ({
                  key: row.key,
                  cells: [
                    row.date,
                    <span key="reading" className="font-medium">
                      {num(row.reading)}
                    </span>,
                    <span key="diff" className="text-ink-muted">
                      +{num(row.diff)}
                    </span>,
                  ],
                }))}
              />
            </div>
            <p className="shrink-0 pt-2 text-[10px] text-ink-soft">
              Farq &mdash; oldingi ko&rsquo;rsatkichga nisbatan oylik iste&rsquo;mol.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
