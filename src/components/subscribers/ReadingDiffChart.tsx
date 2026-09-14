"use client";

import { ResponsiveBar } from "@nivo/bar";

import { compactNumber } from "@/components/cards/chart-scale";
import { signedReading } from "@/components/subscribers/subscriber-ui";

/** Bitta ustun - bitta hisobot oyi. */
export interface ReadingDiffPoint {
  /** "2026-09" - o'q indeksi (bir necha yilda ham noyob). */
  key: string;
  /** "Sen" */
  shortLabel: string;
  /** "Sentabr 2026" */
  label: string;
  /** Oldingi mavjud holatdagi ko'rsatkichdan farq. */
  diff: number;
}

const POSITIVE_COLOR = "#007cd2";
/** Manfiy farq (hisoblagich almashtirilgan bo'lishi mumkin) - qizil. */
const NEGATIVE_COLOR = "#cf4646";

const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" },
  axis: {
    ticks: { text: { fontFamily: "inherit", fontSize: 10, fill: "#767676" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#e8e8ec", strokeDasharray: "2 2" } },
} as const;

/**
 * Oylar bo'yicha hisoblagich ko'rsatkichi farqi. Bu kWh iste'mol emas -
 * hisoblagich koeffitsiyenti shablonda yo'q, shuning uchun birlik yozilmaydi.
 * Nivo SVG'si ota elementdan balandlik oladi: ota `min-h-0 flex-1` bo'lsin.
 */
export function ReadingDiffChart({ points }: { points: ReadingDiffPoint[] }) {
  const labels = new Map(points.map((point) => [point.key, point]));
  // Birinchi yorliqda va yil almashganda yil ham yoziladi.
  const tickLabel = (key: string) => {
    const index = points.findIndex((point) => point.key === key);
    const point = points[index];
    if (!point) return key;
    const year = key.slice(0, 4);
    const newYear = index === 0 || points[index - 1].key.slice(0, 4) !== year;
    const multiYear = points[0].key.slice(0, 4) !== points[points.length - 1].key.slice(0, 4);
    return multiYear && newYear ? `${point.shortLabel} ${year}` : point.shortLabel;
  };

  return (
    <ResponsiveBar
      data={points.map((point) => ({ key: point.key, diff: point.diff }))}
      keys={["diff"]}
      indexBy="key"
      margin={{ top: 8, right: 8, bottom: 24, left: 52 }}
      padding={0.4}
      colors={(bar) => (Number(bar.value) < 0 ? NEGATIVE_COLOR : POSITIVE_COLOR)}
      borderRadius={4}
      enableLabel={false}
      enableGridX={false}
      axisTop={null}
      axisRight={null}
      axisBottom={{ tickSize: 0, tickPadding: 8, format: (value) => tickLabel(String(value)) }}
      axisLeft={{
        tickSize: 0,
        tickPadding: 8,
        tickValues: 5,
        format: (value) => compactNumber(Number(value)),
      }}
      theme={CHART_THEME}
      animate={false}
      role="img"
      ariaLabel="Oylar bo’yicha hisoblagich ko’rsatkichi farqi"
      tooltip={({ indexValue, value }) => (
        <div className="rounded-md bg-surface px-2 py-1 whitespace-nowrap shadow-md">
          <div className="text-[9px] text-ink-soft">{labels.get(String(indexValue))?.label ?? indexValue}</div>
          <div className="mt-0.5 text-[11px] font-semibold text-ink">{signedReading(Number(value))}</div>
        </div>
      )}
    />
  );
}
