"use client";

// @nivo grafiklari faqat brauzerda ishlaydi, shuning uchun butun detal
// ko'rinishi mijoz komponenti. Sahifaning o'zi (`page.tsx`) server bo'lib
// qoladi - ma'lumot va metadata o'sha yerda tanlanadi.

import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import { Activity, Gauge, MapPin, Thermometer, Zap } from "lucide-react";
import { useMemo } from "react";

import { Card, CardBody, CardFooterLink, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeTone, DataTable, type TableColumn } from "@/components/ui/DataTable";
import { InfoGrid, type InfoItem, ProgressBar } from "@/components/ui/InfoGrid";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { subscriberCount } from "@/lib/data/relations";
import { between, dec, energy, money, num } from "@/lib/data/seed";
import {
  type Subscriber,
  SUBSCRIBER_KIND_LABEL,
  SUBSCRIBER_STATUS_LABEL,
  type SubscriberStatus,
} from "@/lib/data/subscribers";
import {
  type Transformer,
  TRANSFORMER_STATUS_LABEL,
  type TransformerStatus,
} from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

/**
 * Holat nishonining ranglari. Umumiy `Badge` da neytral (kulrang) ohang yo'q,
 * "O'chirilgan" esa aynan shunday ko'rinishi kerak - shuning uchun mahalliy
 * nishon (xuddi ro'yxat sahifasidagidek).
 */
const STATUS_PILL: Record<TransformerStatus, string> = {
  ok: "bg-tint-green text-accent-green",
  warning: "bg-tint-amber text-accent-amber",
  critical: "bg-tint-red text-accent-red",
  offline: "bg-canvas text-ink-soft",
};

function StatusPill({ status }: { status: TransformerStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-1 text-[11px] leading-[13px] font-semibold whitespace-nowrap",
        STATUS_PILL[status],
      )}
    >
      {TRANSFORMER_STATUS_LABEL[status]}
    </span>
  );
}

/** Yuklama chizig'ining rangi: 100% dan yuqori - qizil, 85% dan - sariq. */
function loadTone(load: number): string {
  if (load > 100) return "bg-accent-red";
  if (load > 85) return "bg-accent-amber";
  return "bg-accent-green";
}

/**
 * Oxirgi 30 kunning yorliqlari. Maketdagi "bugun" - 10-avgust, ya'ni oraliq
 * 12-iyuldan boshlanadi (iyulda 20 kun + avgustda 10 kun). Sana `new Date()`
 * bilan hisoblanmaydi: server va mijoz bir xil markup chizishi shart.
 */
const DAY_LABELS: readonly string[] = Array.from({ length: 30 }, (_, index) =>
  index < 20 ? `${12 + index}-iyul` : `${index - 19}-avgust`,
);

/** O'qda joy tor - oy nomi qisqartiriladi, to'liq sana maslahatda qoladi. */
const SHORT_MONTH: Record<string, string> = { iyul: "iyl", avgust: "avg" };

/** O’q yorliqlari: har 5-kun va oxirgi kun (qalashib ketmasligi uchun). */
const DAILY_TICKS: readonly string[] = DAY_LABELS.filter(
  (_, index) => index % 5 === 0 || index === DAY_LABELS.length - 1,
);

function formatDayLabel(label: string): string {
  const [day, month] = label.split("-");
  return `${day}-${SHORT_MONTH[month] ?? month}`;
}

/** "3,2K" yoki "840" - o'qda to'liq son sig'maydi. */
function formatAxisKwh(value: number): string {
  if (value === 0) return "0";
  return value >= 1000 ? `${dec(value / 1000)}K` : num(value);
}

/** Maslahatdagi to'liq qiymat. */
function formatTooltipKwh(value: number): string {
  return energy(value);
}

const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" },
  axis: {
    ticks: { text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#f0f0f0", strokeDasharray: "2 2" } },
} as const;

/**
 * Sutkalik yuklama shakli (0..23 soat): tunda pasayish, ertalabki va kechki
 * pik. Nisbiy koeffitsiyent - TP ning joriy yuklamasiga ko'paytiriladi.
 */
const HOUR_SHAPE: readonly number[] = [
  0.42, 0.38, 0.35, 0.34, 0.36, 0.44, 0.58, 0.72, 0.8, 0.78, 0.74, 0.72, 0.7, 0.68,
  0.7, 0.74, 0.82, 0.92, 1, 0.98, 0.9, 0.78, 0.62, 0.5,
];

const SUBSCRIBER_TONE: Record<SubscriberStatus, BadgeTone> = {
  active: "green",
  debtor: "amber",
  disconnected: "red",
};

const SUBSCRIBER_COLUMNS: TableColumn[] = [
  { key: "code", label: "Shartnoma", grow: 14, align: "left" },
  { key: "name", label: "Nomi", grow: 26, align: "left" },
  { key: "kind", label: "Turi", grow: 12 },
  { key: "status", label: "Holat", grow: 14 },
  { key: "usage", label: "Oylik kWh", grow: 16, align: "right" },
  { key: "balance", label: "Balans", grow: 18, align: "right" },
];

export function TransformerDetail({
  transformer,
  subscribers,
}: {
  transformer: Transformer;
  subscribers: readonly Subscriber[];
}) {
  // 30 kunlik qator TP ma'lumotidan keladi, yorliqlar esa qat'iy - shuning
  // uchun ular faqat TP o'zgarganda qayta yig'iladi.
  const dailyData = useMemo(
    () => [
      {
        id: "Kunlik iste\u2019mol",
        data: transformer.daily.map((value, index) => ({
          x: DAY_LABELS[index],
          y: value,
        })),
      },
    ],
    [transformer.daily],
  );

  // Sutkalik profil: shakl + determinlashgan kichik tebranish. Kod raqami
  // seed sifatida ishlatiladi, shunda har bir TP o'z profiliga ega bo'ladi.
  const profile = useMemo(() => {
    const seed = Number(transformer.code.slice(3)) + 7;
    const values = HOUR_SHAPE.map((factor, hour) =>
      // O'chirilgan TP umuman yuklama bermaydi - tebranish ham qo'shilmaydi.
      transformer.loadPercent === 0
        ? 0
        : Math.max(
            0,
            Math.round(
              transformer.loadPercent * factor + between(seed * 3.1 + hour * 7.13, -4, 4),
            ),
          ),
    );
    const peakValue = Math.max(...values);
    const peakHour = peakValue > 0 ? values.indexOf(peakValue) : -1;

    return {
      peakHour,
      peakValue,
      // Pik ustun alohida kalitga yoziladi: nivo `colors` massivini kalitlar
      // tartibida qo'llaydi, shu bilan funksiyasiz ikki rang olinadi.
      bars: values.map((value, hour) => ({
        hour: String(hour),
        load: hour === peakHour ? 0 : value,
        peak: hour === peakHour ? value : 0,
      })),
    };
  }, [transformer.code, transformer.loadPercent]);

  const hourTicks = useMemo(
    () => profile.bars.filter((_, hour) => hour % 3 === 0).map((bar) => bar.hour),
    [profile.bars],
  );

  // Joriy yuklamaning kVA dagi qiymati - foizning o'zi kam narsa aytadi.
  const loadKva = Math.round((transformer.powerKva * transformer.loadPercent) / 100);

  const info: readonly InfoItem[] = [
    { key: "code", label: "Kod", value: transformer.code },
    { key: "substation", label: "Podstansiya", value: transformer.substationName },
    { key: "feeder", label: "Fider", value: transformer.feeder },
    { key: "voltage", label: "Kuchlanish", value: transformer.voltage },
    {
      key: "status",
      label: "Holat",
      value: TRANSFORMER_STATUS_LABEL[transformer.status],
    },
    {
      key: "power",
      label: "Nominal quvvat",
      value: `${num(transformer.powerKva)} kVA`,
    },
    {
      key: "commissioned",
      label: "Ishga tushirilgan",
      value: `${transformer.commissioned}-yil`,
    },
    { key: "check", label: "So\u2019nggi tekshiruv", value: transformer.lastCheck },
    {
      key: "subscribers",
      label: "Abonentlar soni",
      value: `${num(subscriberCount(transformer.id))} ta`,
    },
    {
      key: "offline-meters",
      label: "Aloqada emas (hisoblagich)",
      value: (
        <span
          className={transformer.offlineMeters > 0 ? "text-accent-red" : "text-ink"}
        >
          {num(transformer.offlineMeters)} ta
        </span>
      ),
    },
    { key: "responsible", label: "Mas\u2019ul xodim", value: transformer.responsible },
    {
      key: "loss",
      label: "Yo\u2019qotish",
      value: `${dec(transformer.lossPercent)}%`,
    },
    { key: "address", label: "Manzil", value: transformer.address, wide: true },
    {
      key: "coords",
      label: "Koordinatalar",
      // Koordinata - o'lchov emas, balki texnik identifikator: `dec` dagi
      // vergul bu yerda noto'g'ri bo'lardi, shuning uchun nuqta saqlanadi.
      value: `${transformer.lat.toFixed(5)}, ${transformer.lng.toFixed(5)}`,
      wide: true,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
      <PageHeader
        title={transformer.code}
        subtitle={`${transformer.substationName} \u00b7 ${transformer.feeder} \u00b7 ${transformer.area}`}
        backHref="/transformers"
        backLabel={"Ro\u2019yxatga qaytish"}
      >
        <StatusPill status={transformer.status} />
        <HeaderButton icon={MapPin} href="/map">
          Xaritada
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Joriy yuklama"
          value={dec(transformer.loadPercent)}
          unit="%"
          icon={Gauge}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hintTone={transformer.loadPercent > 100 ? "bad" : "flat"}
          hint={
            // `StatCard` izohni <p> ichida chizadi, u yerga <div> qo'yib
            // bo'lmaydi (brauzer <p> ni yopib yuboradi va gidratatsiya
            // buziladi) - shuning uchun chiziq span'lardan yasalgan.
            <span className="flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded-full bg-black/10">
                <span
                  className={cn("block h-full rounded-full", loadTone(transformer.loadPercent))}
                  style={{ width: `${Math.min(100, transformer.loadPercent)}%` }}
                />
              </span>
              <span className="shrink-0">{num(loadKva)} kVA</span>
            </span>
          }
        />
        <StatCard
          label="Nominal quvvat"
          value={num(transformer.powerKva)}
          unit="kVA"
          icon={Zap}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={transformer.voltage}
        />
        <StatCard
          label="Harorat"
          value={num(transformer.temperature)}
          unit={"\u00b0C"}
          icon={Thermometer}
          accent={transformer.temperature > 75 ? "bg-accent-red" : "bg-accent-amber"}
          tint={transformer.temperature > 75 ? "bg-tint-red" : "bg-tint-amber"}
          hintTone={transformer.temperature > 75 ? "bad" : "flat"}
          hint={
            transformer.temperature > 75
              ? "Chulg\u2019am qizib ketgan - tekshiruv kerak"
              : "Chulg\u2019am harorati me\u2019yorda"
          }
        />
        <StatCard
          label={"Oylik iste\u2019mol"}
          value={energy(transformer.consumptionKwh)}
          icon={Activity}
          accent="bg-accent-teal"
          tint="bg-tint-teal"
          hint={`Yo\u2019qotish: ${dec(transformer.lossPercent)}%`}
        />
      </StatRow>

      {/* Qatorlar `minmax(Npx, Nfr)`: 1064px ish maydonida ular mutanosib
          cho'ziladi (sahifa pastida bo'sh kulrang yo'lak qolmaydi), pastroq
          ekranda esa eng kichik balandlikda qolib, sahifa skroll bo'ladi.
          `min-h-0` berilmaydi - shunda grid o'z mazmunidan pastga siqilmaydi. */}
      <div className="grid flex-1 grid-cols-12 grid-rows-[minmax(416px,416fr)_minmax(300px,300fr)] gap-2">
        <Card className="col-span-5">
          <CardHeader title={"Umumiy ma\u2019lumotlar"} />
          <CardBody className="overflow-y-auto scrollbar-none">
            <InfoGrid items={info} columns={3} />
          </CardBody>
        </Card>

        <Card className="col-span-7">
          <CardHeader title={"30 kunlik iste\u2019mol"}>
            <span className="text-[11px] text-ink-soft">
              Jami: {energy(transformer.consumptionKwh)}
            </span>
          </CardHeader>
          <CardBody>
            <div className="min-h-0 flex-1">
              <ResponsiveLine
                data={dailyData}
                margin={{ top: 8, right: 16, bottom: 24, left: 46 }}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: 0, max: "auto" }}
                curve="monotoneX"
                colors={["#007cd2"]}
                lineWidth={2}
                theme={CHART_THEME}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 8,
                  tickValues: DAILY_TICKS,
                  format: formatDayLabel,
                }}
                axisLeft={{ tickSize: 0, tickPadding: 8, format: formatAxisKwh }}
                enableGridX={false}
                // Maydon to'ldirish: yuqorida quyuqroq, pastda shaffof.
                enableArea
                areaOpacity={1}
                defs={[
                  {
                    id: "dailyFill",
                    type: "linearGradient",
                    colors: [
                      { offset: 0, color: "#007cd2", opacity: 0.3 },
                      { offset: 100, color: "#007cd2", opacity: 0 },
                    ],
                  },
                ]}
                fill={[{ match: "*", id: "dailyFill" }]}
                pointSize={4}
                pointColor="#ffffff"
                pointBorderWidth={1.5}
                pointBorderColor={{ from: "seriesColor" }}
                enableCrosshair
                useMesh
                animate={false}
                yFormat={formatTooltipKwh}
                tooltip={({ point }) => (
                  <div className="rounded-md bg-surface px-2 py-1 whitespace-nowrap shadow-md">
                    <div className="text-[10px] text-ink-soft">{point.data.xFormatted}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-ink">
                      {point.data.yFormatted}
                    </div>
                  </div>
                )}
              />
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-7">
          <CardHeader title={"Ulangan iste\u2019molchilar"}>
            <span className="text-[11px] text-ink-soft">{subscribers.length} ta</span>
          </CardHeader>
          <CardBody>
            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
              {subscribers.length === 0 ? (
                <p className="py-8 text-center text-xs text-ink-soft">
                  Bu transformatorga iste&rsquo;molchi biriktirilmagan
                </p>
              ) : (
                <DataTable
                  columns={SUBSCRIBER_COLUMNS}
                  rowHeight={30}
                  lastRowHeight={34}
                  rows={subscribers.map((item) => ({
                    key: item.id,
                    cells: [
                      <span key="code" className="truncate font-medium">
                        {item.code}
                      </span>,
                      <span key="name" className="truncate">
                        {item.name}
                      </span>,
                      SUBSCRIBER_KIND_LABEL[item.kind],
                      <Badge key="status" tone={SUBSCRIBER_TONE[item.status]}>
                        {SUBSCRIBER_STATUS_LABEL[item.status]}
                      </Badge>,
                      num(item.monthlyKwh),
                      <span
                        key="balance"
                        className={item.balance < 0 ? "font-semibold text-accent-red" : "text-ink"}
                      >
                        {money(item.balance)}
                      </span>,
                    ],
                  }))}
                />
              )}
            </div>
          </CardBody>
          <CardFooterLink href="/subscribers">Barcha iste&rsquo;molchilar</CardFooterLink>
        </Card>

        <Card className="col-span-5">
          <CardHeader title="Yuklama profili">
            <span className="text-[11px] text-ink-soft">Sutkalik, %</span>
          </CardHeader>
          <CardBody>
            <div className="min-h-0 flex-1">
              {/* Karta "overflow-hidden" - kichik grafikda nivo maslahati
                  kesilib qolardi, shuning uchun u o'chirilgan. Pik soat
                  ostidagi qatorda matn bilan ko'rsatiladi. */}
              <ResponsiveBar
                data={profile.bars}
                keys={["load", "peak"]}
                indexBy="hour"
                margin={{ top: 6, right: 6, bottom: 22, left: 30 }}
                padding={0.28}
                // O'q barqaror qolsin: o'chirilgan TP da ham (hamma qiymat 0)
                // shkala buzilmaydi, haddan tashqari yuklangani esa sig'adi.
                // @nivo/bar da `maxValue` propi yo'q - chegara `valueScale`
                // orqali beriladi (`maxValue` faqat `ResponsiveRadialBar` da).
                valueScale={{
                  type: "linear",
                  min: 0,
                  max: Math.max(110, profile.peakValue + 10),
                }}
                colors={["#007cd2", "#f59e0b"]}
                borderRadius={2}
                enableLabel={false}
                enableGridX={false}
                theme={CHART_THEME}
                axisTop={null}
                axisRight={null}
                axisBottom={{
                  tickSize: 0,
                  tickPadding: 6,
                  tickValues: hourTicks,
                  format: (value: string) => `${value}:00`,
                }}
                axisLeft={{ tickSize: 0, tickPadding: 6, tickValues: 4 }}
                isInteractive={false}
                animate={false}
              />
            </div>

            <div className="mt-2 flex shrink-0 items-center gap-2">
              <span className="shrink-0 text-[10px] text-ink-soft">Joriy</span>
              <ProgressBar
                value={transformer.loadPercent}
                tone={loadTone(transformer.loadPercent)}
                className="flex-1"
              />
              <span className="shrink-0 text-[10px] font-semibold text-ink">
                {dec(transformer.loadPercent)}%
              </span>
            </div>
            <p className="mt-1.5 shrink-0 text-[10px] text-ink-soft">
              Pik soat:{" "}
              <span className="font-semibold text-accent-amber">
                {profile.peakHour >= 0 ? `${profile.peakHour}:00` : "\u2014"}
              </span>{" "}
              {profile.peakHour >= 0 ? `\u00b7 ${num(profile.peakValue)}% yuklama` : ""}
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
