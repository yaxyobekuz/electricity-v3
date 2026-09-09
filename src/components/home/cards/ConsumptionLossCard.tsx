"use client";

import { ResponsiveLine } from "@nivo/line";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { IconPill } from "@/components/ui/IconPill";

/** Grafikdagi uch qator - `DayPoint` maydonlari bilan bir xil nomlanadi. */
type MetricId = "total" | "useful" | "loss";

interface DayPoint {
  /** X o'qi yorlig'i: "12-iyul" ko'rinishida (o'zbekcha oy nomi). */
  label: string;
  total: number;
  useful: number;
  loss: number;
}

/**
 * 30 kunlik mock qator (12-iyul ... 10-avgust). Har bir kunda balans
 * saqlanadi: `total = useful + loss`, ya'ni uch chiziq bir-biriga zid
 * bo'lmaydi. Oxirgi hafta o'sish trendida - o'ng ustundagi "bugungi"
 * qiymatlar shu qatorning oxirgi elementiga to'g'ri keladi.
 */
const DAYS: readonly DayPoint[] = [
  { label: "12-iyul", total: 18400, useful: 14700, loss: 3700 },
  { label: "13-iyul", total: 19100, useful: 15250, loss: 3850 },
  { label: "14-iyul", total: 18700, useful: 14940, loss: 3760 },
  { label: "15-iyul", total: 19600, useful: 15680, loss: 3920 },
  { label: "16-iyul", total: 20300, useful: 16250, loss: 4050 },
  { label: "17-iyul", total: 19800, useful: 15820, loss: 3980 },
  { label: "18-iyul", total: 18900, useful: 15090, loss: 3810 },
  { label: "19-iyul", total: 20100, useful: 16080, loss: 4020 },
  { label: "20-iyul", total: 21200, useful: 17020, loss: 4180 },
  { label: "21-iyul", total: 20600, useful: 16490, loss: 4110 },
  { label: "22-iyul", total: 19400, useful: 15500, loss: 3900 },
  { label: "23-iyul", total: 20900, useful: 16750, loss: 4150 },
  { label: "24-iyul", total: 21500, useful: 17270, loss: 4230 },
  { label: "25-iyul", total: 20400, useful: 16330, loss: 4070 },
  { label: "26-iyul", total: 19700, useful: 15740, loss: 3960 },
  { label: "27-iyul", total: 20800, useful: 16660, loss: 4140 },
  { label: "28-iyul", total: 21700, useful: 17440, loss: 4260 },
  { label: "29-iyul", total: 21000, useful: 16840, loss: 4160 },
  { label: "30-iyul", total: 20200, useful: 16160, loss: 4040 },
  { label: "31-iyul", total: 21400, useful: 17190, loss: 4210 },
  { label: "1-avgust", total: 22000, useful: 17710, loss: 4290 },
  { label: "2-avgust", total: 21300, useful: 17110, loss: 4190 },
  { label: "3-avgust", total: 21600, useful: 17360, loss: 4240 },
  { label: "4-avgust", total: 21800, useful: 17600, loss: 4200 },
  { label: "5-avgust", total: 22400, useful: 18100, loss: 4300 },
  { label: "6-avgust", total: 23100, useful: 18600, loss: 4500 },
  { label: "7-avgust", total: 23600, useful: 19000, loss: 4600 },
  { label: "8-avgust", total: 24200, useful: 19400, loss: 4800 },
  { label: "9-avgust", total: 24800, useful: 19800, loss: 5000 },
  { label: "10-avgust", total: 25200, useful: 20143, loss: 5057 },
];

interface MetricSeries {
  id: MetricId;
  label: string;
  color: string;
}

/** Legenda ham, chiziq ranglari ham shu ro'yxatdan olinadi (bitta manba). */
const SERIES: readonly MetricSeries[] = [
  { id: "total", label: "Jami iste’mol (kWh)", color: "#3b82f6" },
  { id: "useful", label: "Foydali energiya (kWh)", color: "#22c55e" },
  { id: "loss", label: "Yo’qotish (kWh)", color: "#ef4444" },
];

const LINE_COLORS = SERIES.map((series) => series.color);

interface RangeOption {
  days: number;
  label: string;
  /**
   * X yorliqlari qalashib ketmasligi uchun har `tickStep`-inchi kun
   * ko'rsatiladi (30 kunda 6 ta, 14 kunda 7 ta yorliq qoladi).
   */
  tickStep: number;
}

const RANGES: readonly RangeOption[] = [
  { days: 7, label: "7 kun", tickStep: 1 },
  { days: 14, label: "14 kun", tickStep: 2 },
  { days: 30, label: "30 kun", tickStep: 5 },
];

/** O'q ham, to'r ham bir xil qadamda - 0 dan 25 000 gacha 5 000 lik. */
const Y_TICKS = [0, 5000, 10000, 15000, 20000, 25000];

/**
 * Karta past bo'lgani uchun o'q matni 9px: `text` ham, `axis.ticks` ham
 * belgilanadi (nivo ba'zi qatlamlarda faqat birinchisini o'qiydi).
 */
const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 9, fill: "#767676" },
  axis: {
    ticks: { text: { fontFamily: "inherit", fontSize: 9, fill: "#767676" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#e8e8ec", strokeDasharray: "2 2" } },
} as const;

/**
 * Chap chekka 34px - "25K" yorlig'i sig'adigan eng tor qiymat. O'ngda 16px:
 * `point` shkalasi oxirgi nuqtani maydon chetiga qo'yadi, chekka 8px bo'lsa
 * oxirgi sana yorlig'ining yarmi SVG chegarasidan tashqarida qolib kesiladi.
 */
const CHART_MARGIN = { top: 6, right: 16, bottom: 20, left: 34 } as const;

/** O'qda joy tor: minglar "5K" ko'rinishida qisqartiriladi, nol esa "0". */
function formatAxisValue(value: number): string {
  return value === 0 ? "0" : `${value / 1000}K`;
}

/** O'q yorlig'i uchun oy nomining qisqartmasi (to'liq nomi maslahatda qoladi). */
const SHORT_MONTH: Record<string, string> = { iyul: "iyl", avgust: "avg" };

/**
 * 7 kunlik ko'rinishda yorliqlar orasi ~39px, "10-avgust" esa ~38px joy
 * oladi - shuning uchun o'qda oy qisqartiriladi ("10-avg").
 */
function formatDayLabel(label: string): string {
  const [day, month] = label.split("-");
  return `${day}-${SHORT_MONTH[month] ?? month}`;
}

/**
 * Ming ajratgichi - uzilmas bo'shliq (U+00A0). `toLocaleString` ishlatilmadi:
 * server va brauzer lokali farq qilsa gidratatsiya xatosi chiqadi.
 */
function formatKwh(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

interface TodayStat {
  id: string;
  label: string;
  value: string;
  /** Faqat yo'qotish qatorida: iste'moldagi ulush. */
  share?: string;
}

/** Qutidagi qiymat: "25 200 kWh" (ajratgich - U+00A0). */
function formatKwhValue(value: number): string {
  return `${formatKwh(value)} kWh`;
}

/**
 * O'ng ustundagi "bugungi kesim" qatorning oxirgi ikki kunidan hisoblanadi:
 * qo'lda yozilgan qiymat grafik maslahatidagi son bilan farq qilib qolmaydi
 * (avval "kecha" qatorida 5 018 turardi, grafikda esa 5 000).
 */
const TODAY = DAYS[DAYS.length - 1];
const YESTERDAY = DAYS[DAYS.length - 2];

const TODAY_STATS: readonly TodayStat[] = [
  { id: "total", label: "Bugungi iste’mol", value: formatKwhValue(TODAY.total) },
  {
    id: "useful",
    label: "Bugungi foydali energiya",
    value: formatKwhValue(TODAY.useful),
  },
  {
    id: "loss",
    label: "Bugungi yo’qotish",
    value: formatKwhValue(TODAY.loss),
    share: `${((TODAY.loss / TODAY.total) * 100).toFixed(1)}%`,
  },
  { id: "loss-prev", label: "Kecha yo’qotish", value: formatKwhValue(YESTERDAY.loss) },
];

/**
 * "Iste'mol va yo'qotishlar dinamikasi" - Bosh sahifa 2-qatori (425x316).
 *
 * Tana ikki ustunga bo'linadi: chapda cho'ziluvchi grafik (`min-w-0 flex-1`,
 * aks holda nivo SVG'si kartani kengaytirib yuboradi), o'ngda 96px qat'iy
 * ko'rsatkich ustuni.
 */
export function ConsumptionLossCard({ className }: { className?: string }) {
  const [rangeIndex, setRangeIndex] = useState(0);
  const range = RANGES[rangeIndex];

  // Sarlavhadagi tugma uchta oraliqni aylantiradi (ochiluvchi menyu maketda yo'q).
  const cycleRange = () => setRangeIndex((index) => (index + 1) % RANGES.length);

  // Tanlangan oraliq - qatorning oxirgi N kuni (eng yangi ma'lumot doim ko'rinadi).
  const points = DAYS.slice(DAYS.length - range.days);
  const chartData = SERIES.map((series) => ({
    id: series.label,
    data: points.map((point) => ({ x: point.label, y: point[series.id] })),
  }));
  const xTickValues = points
    .filter((_, index) => index % range.tickStep === 0)
    .map((point) => point.label);

  return (
    <Card className={className}>
      <CardHeader title="Iste&rsquo;mol va yo&rsquo;qotishlar dinamikasi">
        <button
          type="button"
          onClick={cycleRange}
          aria-label={`Oraliq: ${range.label}. O’zgartirish uchun bosing`}
          className="flex h-7 items-center gap-1 rounded-full bg-canvas px-2.5 text-[11px] font-medium text-ink transition-colors hover:bg-black/5"
        >
          {range.label}
          <Icon icon={ChevronDown} size={14} />
        </button>
        <IconPill icon={CalendarDays} label="Kalendar" />
      </CardHeader>

      <CardBody>
        {/* Legenda grafik ustida: nivo legendasi 425px kartada ortiqcha joy oladi. */}
        <div className="flex shrink-0 items-center gap-3 text-[10px] text-ink-soft">
          {SERIES.map((series) => (
            <span key={series.id} className="flex items-center gap-1 whitespace-nowrap">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: series.color }}
              />
              {series.label}
            </span>
          ))}
        </div>

        <div className="mt-2 flex min-h-0 flex-1 gap-2">
          <div className="min-w-0 flex-1">
            <ResponsiveLine
              data={chartData}
              margin={CHART_MARGIN}
              xScale={{ type: "point" }}
              yScale={{ type: "linear", min: 0, max: 26000, stacked: false }}
              curve="monotoneX"
              colors={LINE_COLORS}
              lineWidth={2}
              theme={CHART_THEME}
              axisTop={null}
              axisRight={null}
              axisBottom={{
                tickSize: 0,
                tickPadding: 6,
                tickValues: xTickValues,
                format: formatDayLabel,
              }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 6,
                tickValues: Y_TICKS,
                format: formatAxisValue,
              }}
              enableGridX={false}
              gridYValues={Y_TICKS}
              pointSize={5}
              pointColor="#ffffff"
              pointBorderWidth={1.5}
              pointBorderColor={{ from: "seriesColor" }}
              enableCrosshair={false}
              enableTouchCrosshair={false}
              useMesh
              animate={false}
              yFormat={formatKwh}
              // Maslahatda sana to'liq ko'rinadi (o'qda u qisqartirilgan).
              tooltip={({ point }) => (
                <div className="rounded-md bg-surface px-2 py-1 whitespace-nowrap shadow-md">
                  <div className="text-[9px] text-ink-soft">{point.data.xFormatted}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: point.seriesColor }}
                    />
                    <span className="text-ink-soft">{point.seriesId}</span>
                    <span className="font-semibold">{point.data.yFormatted}</span>
                  </div>
                </div>
              )}
            />
          </div>

          {/* Ko'rsatkich ustuni: qutilar `flex-1` bilan balandlikni teng bo'lishadi,
              `overflow-hidden` esa past ekranda kontentni kartadan chiqarmaydi. */}
          <div className="flex w-[96px] shrink-0 flex-col gap-1.5 overflow-hidden">
            {TODAY_STATS.map((stat) => (
              <div
                key={stat.id}
                className="flex min-h-0 flex-1 flex-col justify-center rounded-lg bg-canvas px-2 py-1.5"
              >
                <span className="text-[9px] leading-[11px] text-ink-soft">
                  {stat.label}
                </span>
                {/* 96px qutida "5 057 kWh" + "20.1%" bir qatorga sig'maydi:
                    `flex-wrap` ulushni pastki qatorga tushiradi (kesib tashlamaydi). */}
                <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1">
                  <span className="text-[11px] leading-[14px] font-bold whitespace-nowrap text-ink">
                    {stat.value}
                  </span>
                  {stat.share ? (
                    <span className="text-[9px] font-semibold text-trend-up">
                      {stat.share}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
