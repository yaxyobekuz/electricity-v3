"use client";

import { ResponsiveLine } from "@nivo/line";
import { ChartNoAxesColumn, FileDown, Table } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type TableColumn, type TableRow } from "@/components/ui/DataTable";
import { IconPill } from "@/components/ui/IconPill";
import { type SegmentItem, SegmentedIcons } from "@/components/ui/Toggle";
import { cn } from "@/lib/ui/cn";

type ViewMode = "chart" | "table";
type MetricId = "billed" | "consumed" | "loss";

interface DayRow {
  day: number;
  billed: number;
  consumed: number;
  loss: number;
}

/**
 * Dastlabki 7 kun - maketdagi egri chiziqlarning tugun koordinatalaridan
 * teskari hisoblangan qiymatlar (o'q 0 / 500 / 2000 da teng bo'linadi -
 * pastdagi symlog shkala). Qolgan kunlar shu xarakterdagi namuna ma'lumot:
 * slayder 30 kungacha cho'zilganda grafik to'lib turishi kerak.
 */
const DAYS: readonly DayRow[] = [
  { day: 1, billed: 1146, consumed: 27, loss: 236 },
  { day: 2, billed: 1836, consumed: 600, loss: 67 },
  { day: 3, billed: 128, consumed: 1791, loss: 563 },
  { day: 4, billed: 16, consumed: 147, loss: 159 },
  { day: 5, billed: 937, consumed: 408, loss: 415 },
  { day: 6, billed: 578, consumed: 765, loss: 24 },
  { day: 7, billed: 1008, consumed: 298, loss: 209 },
  { day: 8, billed: 1425, consumed: 913, loss: 341 },
  { day: 9, billed: 742, consumed: 1502, loss: 96 },
  { day: 10, billed: 1663, consumed: 470, loss: 528 },
  { day: 11, billed: 331, consumed: 1188, loss: 152 },
  { day: 12, billed: 1279, consumed: 654, loss: 387 },
  { day: 13, billed: 96, consumed: 1936, loss: 61 },
  { day: 14, billed: 1547, consumed: 219, loss: 473 },
  { day: 15, billed: 863, consumed: 1074, loss: 128 },
  { day: 16, billed: 1912, consumed: 542, loss: 596 },
  { day: 17, billed: 204, consumed: 1361, loss: 87 },
  { day: 18, billed: 1096, consumed: 738, loss: 302 },
  { day: 19, billed: 1758, consumed: 165, loss: 441 },
  { day: 20, billed: 487, consumed: 1623, loss: 113 },
  { day: 21, billed: 1341, consumed: 826, loss: 519 },
  { day: 22, billed: 68, consumed: 1247, loss: 174 },
  { day: 23, billed: 1584, consumed: 391, loss: 368 },
  { day: 24, billed: 918, consumed: 1795, loss: 45 },
  { day: 25, billed: 1467, consumed: 583, loss: 492 },
  { day: 26, billed: 259, consumed: 1128, loss: 137 },
  { day: 27, billed: 1836, consumed: 702, loss: 561 },
  { day: 28, billed: 613, consumed: 1471, loss: 78 },
  { day: 29, billed: 1223, consumed: 336, loss: 415 },
  { day: 30, billed: 1691, consumed: 984, loss: 247 },
];

/** Slayder chegaralari: butun oy (30 kun), qadam - 1 kun, eng kami 7 kun. */
const TOTAL_DAYS = DAYS.length;
const MIN_DAYS = 7;
const MAX_DAYS = 30;

/** Yo'lakning ichki chekkasi (maketda tanlov 6px ichkaridan boshlanadi). */
const TRACK_PADDING = 6;

/**
 * `total` - maketdagi 7 kunlik yig'indi (mln kWh). Oraliq uzayganda yorliq
 * shunga mutanosib o'sadi, ya'ni standart 7 kunlik holatda maketdagi
 * qiymatlar aynan chiqadi.
 */
const SERIES = [
  { id: "billed", label: "Hisoblangan", total: 1.234, color: "#467acf" },
  { id: "consumed", label: "Iste’mol", total: 1.02, color: "#46cf61" },
  { id: "loss", label: "Yo’qotish", total: 0.214, color: "#cf4646" },
] as const satisfies ReadonlyArray<{
  id: MetricId;
  label: string;
  total: number;
  color: string;
}>;

/** O'zbekcha son formati: kasr ajratgichi - vergul ("1,234 mln kWh"). */
function formatTotal(value: number): string {
  return `${value.toFixed(3).replace(".", ",")} mln kWh`;
}

const LINE_COLORS = SERIES.map((series) => series.color);

/**
 * Maketda o'q yorliqlari 0 / 500 / 2000 da **teng** oraliqda turadi, ya'ni
 * shkala chiziqli emas. `symlog` + constant 250 aynan shuni beradi:
 * ln(1+500/250) / ln(1+2000/250) = 1/2.
 */
const Y_SCALE = {
  type: "symlog",
  constant: 250,
  min: 0,
  max: 2000,
  nice: false,
} as const;

/**
 * Grafik chekkalari: chapda o'q ustuni 33px (Figma `yAxisLeft`), o'ngda
 * 28px, tepada 6px, pastda 24px yorliq qatori + 4px oraliq.
 */
const CHART_MARGIN = { top: 6, right: 28, bottom: 28, left: 33 } as const;

/** Maketda o'q matni 10px, rangi #4d4d4d (yorliq ustunidagi #999999 emas). */
const AXIS_FONT_SIZE = 10;
const AXIS_TEXT_COLOR = "#4d4d4d";

/** Figma theme: o'q matni #4d4d4d/10px, to'r - 2/2 uzuq #d9d9dd. */
const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: AXIS_FONT_SIZE, fill: AXIS_TEXT_COLOR },
  axis: {
    ticks: { text: { fill: AXIS_TEXT_COLOR, fontSize: AXIS_FONT_SIZE } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#d9d9dd", strokeDasharray: "2 2" } },
} as const;

/** Pastki o'q chizig'i maketda uzluksiz va to'qroq - grid uslubiga sig'maydi. */
function BaselineRule({
  innerWidth,
  innerHeight,
}: {
  innerWidth: number;
  innerHeight: number;
}) {
  return (
    <line x1={0} x2={innerWidth} y1={innerHeight} y2={innerHeight} stroke="#b3b3bb" />
  );
}

/**
 * Maketda tik to'r chiziqlari (`yLines`, Figma `4029:1249`) grafik
 * balandligini to'liq egallamaydi: ularning uzunligi 147.49px, ya'ni 166px
 * lik maydonda yuqoridan ham, pastdan ham 9.26px ichkarida turadi. Nivo'ning
 * `enableGridX` i ularni 2000 chizig'idan 0 chizig'igacha tortadi, shuning
 * uchun u o'chirilib, qator alohida qatlam sifatida chiziladi.
 */
const X_GRID_INSET = 9.26;

/**
 * 7 kunda har bir kun o'z chizig'i va yorlig'iga ega (maketdagidek). Oraliq
 * uzayganda 10px raqamlar bir-biriga tegib ketadi, shuning uchun qadam
 * kattalashadi: 8 tadan ko'p yorliq chizilmaydi.
 */
function tickStride(count: number): number {
  return Math.max(1, Math.ceil(count / 8));
}

function XGridLines({
  innerWidth,
  innerHeight,
  days,
}: {
  innerWidth: number;
  innerHeight: number;
  days: readonly DayRow[];
}) {
  const step = innerWidth / (days.length - 1);
  const stride = tickStride(days.length);

  return (
    // `strokeDashoffset` uzuq naqshni maydon tepasiga bog'laydi - maketdagidek
    // (chiziq 9.26px pastdan boshlansa ham, uzuqlar 0/4/8... da turadi).
    <g stroke="#d9d9dd" strokeDasharray="2 2" strokeDashoffset={X_GRID_INSET}>
      {days.map((row, index) =>
        index % stride === 0 ? (
          <line
            key={row.day}
            x1={step * index}
            x2={step * index}
            y1={X_GRID_INSET}
            y2={innerHeight - X_GRID_INSET}
          />
        ) : null,
      )}
    </g>
  );
}

/**
 * Maketda x yorliqlari tugun ustida turmaydi: `xAxis` (Figma `4029:1310`)
 * butun grafik kengligini 7 ta teng "xLabelBox" ga bo'ladi (birinchisi
 * x=1.02 dan, har biri 49.23px) va raqam quti markazida turadi. Nivo'ning
 * `axisBottom` i yorliqni nuqta ustiga qo'yadi - farq chekkalarda 7px gacha,
 * shuning uchun qatorni alohida qatlam chizadi.
 */
const X_LABEL_INSET = 1.024;
/** Yorliq qutisining tepasi 0 chizig'idan 4px pastda. */
const X_LABEL_GAP = 4;

function XAxisLabels({
  innerWidth,
  innerHeight,
  days,
}: {
  innerWidth: number;
  innerHeight: number;
  days: readonly DayRow[];
}) {
  const chartWidth = innerWidth + CHART_MARGIN.left + CHART_MARGIN.right;
  const boxWidth = (chartWidth - X_LABEL_INSET) / days.length;
  const stride = tickStride(days.length);

  return (
    <g transform={`translate(0,${innerHeight + X_LABEL_GAP})`}>
      {days.map((row, index) =>
        index % stride === 0 ? (
          <text
            key={row.day}
            x={X_LABEL_INSET + boxWidth * (index + 0.5) - CHART_MARGIN.left}
            textAnchor="middle"
            dominantBaseline="text-before-edge"
            fill={AXIS_TEXT_COLOR}
            style={{ fontSize: AXIS_FONT_SIZE }}
          >
            {row.day}
          </text>
        ) : null,
      )}
    </g>
  );
}

const VIEW_ITEMS: ReadonlyArray<SegmentItem<ViewMode>> = [
  { value: "chart", Icon: ChartNoAxesColumn, label: "Grafik" },
  { value: "table", Icon: Table, label: "Jadval" },
];

const COLUMNS: TableColumn[] = [
  { key: "day", label: "Kun", grow: 12 },
  { key: "billed", label: "Hisoblangan", grow: 24 },
  { key: "consumed", label: "Iste’mol", grow: 24 },
  { key: "loss", label: "Yo’qotish", grow: 24 },
];

function buildRows(days: readonly DayRow[]): TableRow[] {
  return days.map((row) => ({
    key: String(row.day),
    cells: [
      <span key="day" className="font-medium">
        {row.day}
      </span>,
      row.billed,
      row.consumed,
      row.loss,
    ],
  }));
}

type DragMode = "start" | "end" | "pan";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Maketdagi "Slider" (18px) - endi haqiqiy ikki tutqichli oraliq tanlagich.
 *
 * Yo'lak butun oyni (30 kun) ifodalaydi; tanlov `start..end` kunlarni **ichiga
 * olib** qamraydi, shuning uchun eni `(end - start + 1) / 30`. Qadam - 1 kun,
 * oraliq 7 kundan qisqa va 30 kundan uzun bo'lolmaydi.
 *
 * Tutqichlar chekkalarni suradi, tanlovning o'zini sudrasa oraliq uzunligini
 * saqlab siljiydi. Qadam 1 kun bo'lgani uchun harakat sakrab qolmasin deb
 * `left/width` ga qisqa o'tish (100ms) berilgan.
 */
function RangeSlider({
  start,
  end,
  onChange,
}: {
  start: number;
  end: number;
  onChange: (next: { start: number; end: number }) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  /** Sudrash tugaganda tinglovchilarni olib tashlaydigan funksiya. */
  const stopDragRef = useRef<(() => void) | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);

  /** Kursor ostidagi kun (1..30). */
  const dayAt = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return 1;
    const rect = track.getBoundingClientRect();
    const inner = rect.width - TRACK_PADDING * 2;
    if (inner <= 0) return 1;
    const ratio = (clientX - rect.left - TRACK_PADDING) / inner;
    return clamp(Math.floor(ratio * TOTAL_DAYS) + 1, 1, TOTAL_DAYS);
  }, []);

  /**
   * Rejim `data-mode` dan o'qiladi. Tinglovchilar effektda emas, aynan shu
   * yerda ulanadi: aks holda `pointerdown` dan keyingi birinchi kadrdagi
   * `pointermove` lar e'tiborsiz qolib, sudrash kechikib boshlanadi.
   */
  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      // Matn belgilanishi va rasm sudralishining oldini oladi.
      event.preventDefault();
      // Tutqichdagi hodisa tanlov qutisiga ko'tarilmasin: aks holda darhol
      // "pan" rejimi ustidan yozib yuboradi.
      event.stopPropagation();
      stopDragRef.current?.();

      const mode = (event.currentTarget.dataset.mode ?? "pan") as DragMode;
      const origin = { grabDay: dayAt(event.clientX), start, end };

      const handleMove = (moveEvent: PointerEvent) => {
        const day = dayAt(moveEvent.clientX);

        if (mode === "start") {
          onChange({
            start: clamp(
              day,
              Math.max(1, origin.end - MAX_DAYS + 1),
              origin.end - MIN_DAYS + 1,
            ),
            end: origin.end,
          });
          return;
        }
        if (mode === "end") {
          onChange({
            start: origin.start,
            end: clamp(
              day,
              origin.start + MIN_DAYS - 1,
              Math.min(TOTAL_DAYS, origin.start + MAX_DAYS - 1),
            ),
          });
          return;
        }

        // Sudrash: uzunlik saqlanadi, oraliq chetlarga tiralganda to'xtaydi.
        const span = origin.end - origin.start;
        const shifted = clamp(
          origin.start + (day - origin.grabDay),
          1,
          TOTAL_DAYS - span,
        );
        onChange({ start: shifted, end: shifted + span });
      };

      const previousCursor = document.body.style.cursor;
      const previousSelect = document.body.style.userSelect;

      const stop = () => {
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousSelect;
        stopDragRef.current = null;
        setDragMode(null);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
      // Sudrash paytida kursor butun sahifada bir xil turadi.
      document.body.style.cursor = mode === "pan" ? "grabbing" : "ew-resize";
      document.body.style.userSelect = "none";

      stopDragRef.current = stop;
      setDragMode(mode);
    },
    [dayAt, start, end, onChange],
  );

  // Komponent yo'q qilinsa, tinglovchilar va kursor qolib ketmasin.
  useEffect(() => () => stopDragRef.current?.(), []);

  const nudge = (mode: "start" | "end", delta: number) => {
    if (mode === "start") {
      onChange({
        start: clamp(start + delta, Math.max(1, end - MAX_DAYS + 1), end - MIN_DAYS + 1),
        end,
      });
      return;
    }
    onChange({
      start,
      end: clamp(end + delta, start + MIN_DAYS - 1, Math.min(TOTAL_DAYS, start + MAX_DAYS - 1)),
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    nudge(event.currentTarget.dataset.mode === "start" ? "start" : "end", step);
  };

  const days = end - start + 1;
  const left = (start - 1) / TOTAL_DAYS;
  const width = days / TOTAL_DAYS;
  const inner = `(100% - ${TRACK_PADDING * 2}px)`;

  return (
    <div
      ref={trackRef}
      className="relative mt-2 h-[18px] w-full shrink-0 rounded-full bg-tint-blue"
    >
      <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-[#d5eafc]" />

      {/* Fon yarim shaffof - ostidagi chiziq maketdagidek to'qroq ko'rinadi */}
      <div
        data-mode="pan"
        onPointerDown={beginDrag}
        style={{
          left: `calc(${TRACK_PADDING}px + ${inner} * ${left})`,
          width: `calc(${inner} * ${width})`,
        }}
        className={cn(
          "absolute inset-y-0 touch-none rounded-xs border border-solid border-brand bg-[#49abf5]/30",
          // Qadam 1 kun - qisqa o'tish sakrashni silliqlaydi.
          "transition-[left,width] duration-100 ease-out",
          dragMode === "pan" ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <span className="pointer-events-none flex h-full items-center justify-center text-[11px] font-medium text-brand select-none">
          {days} kun
        </span>

        {(["start", "end"] as const).map((mode) => (
          <span
            key={mode}
            role="slider"
            tabIndex={0}
            aria-label={mode === "start" ? "Oraliq boshi" : "Oraliq oxiri"}
            aria-valuemin={1}
            aria-valuemax={TOTAL_DAYS}
            aria-valuenow={mode === "start" ? start : end}
            aria-valuetext={`${mode === "start" ? start : end}-kun`}
            data-mode={mode}
            onPointerDown={beginDrag}
            onKeyDown={handleKeyDown}
            className={cn(
              "absolute top-1/2 flex size-3 -translate-y-1/2 cursor-ew-resize touch-none items-center justify-center rounded-[3px] bg-surface shadow-sm",
              "outline-brand focus-visible:outline-2",
              mode === "start" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
            )}
          >
            <span className="pointer-events-none block h-1 w-px bg-[#dddddd]" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * "Iste'mol dinamikasi" kartasi (Figma `4029:1221`, 487x298).
 *
 * Tana 200px: chapda 345.67px grafik (o'q uchun 33px chap, 28px o'ng chekka),
 * o'ngda 109px yorliq ustuni. Pastda 18px oraliq yo'lagi.
 */
export function ConsumptionDynamicsCard({ className }: { className?: string }) {
  const [view, setView] = useState<ViewMode>("chart");
  // Standart holat - maketdagidek birinchi 7 kun.
  const [range, setRange] = useState({ start: 1, end: MIN_DAYS });

  const visibleDays = useMemo(
    () => DAYS.slice(range.start - 1, range.end),
    [range.start, range.end],
  );

  const chartData = useMemo(
    () =>
      SERIES.map((series) => ({
        id: series.label,
        data: visibleDays.map((row) => ({ x: row.day, y: row[series.id] })),
      })),
    [visibleDays],
  );

  // Nivo qatlamlari ko'rinib turgan kunlarni bilishi kerak.
  const chartLayers = useMemo(
    () => [
      "grid" as const,
      (props: { innerWidth: number; innerHeight: number }) => (
        <XGridLines key="x-grid" {...props} days={visibleDays} />
      ),
      "axes" as const,
      BaselineRule,
      (props: { innerWidth: number; innerHeight: number }) => (
        <XAxisLabels key="x-labels" {...props} days={visibleDays} />
      ),
      "lines" as const,
      "points" as const,
      "mesh" as const,
    ],
    [visibleDays],
  );

  const rows = useMemo(() => buildRows(visibleDays), [visibleDays]);

  // Yorliqdagi yig'indi tanlangan kunlar soniga mutanosib.
  const totalScale = visibleDays.length / MIN_DAYS;

  return (
    <Card className={className}>
      <CardHeader title="Iste’mol dinamikasi">
        <SegmentedIcons items={VIEW_ITEMS} value={view} onChange={setView} />
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody>
        {view === "chart" ? (
          <>
            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1">
                <ResponsiveLine
                  data={chartData}
                  margin={CHART_MARGIN}
                  xScale={{ type: "point" }}
                  yScale={Y_SCALE}
                  curve="monotoneX"
                  colors={LINE_COLORS}
                  lineWidth={2}
                  theme={CHART_THEME}
                  axisTop={null}
                  axisRight={null}
                  // x yorliqlarini `XAxisLabels` chizadi (maketda ular nuqta ustida emas).
                  axisBottom={null}
                  axisLeft={{
                    tickSize: 0,
                    tickPadding: 4,
                    tickValues: [0, 500, 2000],
                  }}
                  // 0 chizig'ini `BaselineRule` chizadi, shuning uchun to'rda yo'q.
                  gridYValues={[500, 2000]}
                  // Tik chiziqlarni `XGridLines` chizadi (maketda ular kaltaroq).
                  enableGridX={false}
                  layers={chartLayers}
                  pointSize={6}
                  pointColor="#ffffff"
                  pointBorderWidth={2}
                  pointBorderColor={{ from: "seriesColor" }}
                  enableTouchCrosshair={false}
                  enableCrosshair={false}
                  useMesh
                  isInteractive
                  animate={false}
                  tooltip={({ point }) => (
                    <div className="flex items-center gap-1.5 rounded-md bg-surface px-2 py-1 text-[11px] whitespace-nowrap text-ink shadow-md">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: point.seriesColor }}
                      />
                      <span className="text-ink-soft">{point.seriesId}</span>
                      <span className="font-semibold">{point.data.yFormatted}</span>
                    </div>
                  )}
                />
              </div>

              {/* Yorliq ustuni: 109px, 35px qatorlar, oralig'i 8px */}
              <div className="flex w-[109px] shrink-0 flex-col justify-center gap-2">
                {SERIES.map((series) => (
                  <div key={series.id} className="flex h-[35px] items-center gap-2.5">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: series.color }}
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-[10px] leading-[13px] text-[#999999]">
                        {series.label}
                      </span>
                      <span className="mt-1.5 block truncate text-xs leading-4 font-semibold text-ink">
                        {formatTotal(series.total * totalScale)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Oraliq yo'lagi (Figma "Slider", 18px) */}
            <RangeSlider start={range.start} end={range.end} onChange={setRange} />
          </>
        ) : (
          <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
            <DataTable columns={COLUMNS} rows={rows} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
