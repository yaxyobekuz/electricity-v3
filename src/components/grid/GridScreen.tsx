"use client";

import { ResponsiveLine } from "@nivo/line";
import {
  Activity,
  Cable,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Waves,
  Zap,
  ZapOff,
} from "lucide-react";
import { useState } from "react";

import { AppShell, SidebarPanel } from "@/components/shell/AppShell";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import {
  Badge,
  type BadgeTone,
  DataTable,
  type TableColumn,
} from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/InfoGrid";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { between, dec, num } from "@/lib/data/seed";
import { cn } from "@/lib/ui/cn";

/* ===========================================================================
   Holat va kuchlanish darajalari
   =========================================================================== */

/** Tarmoq elementining joriy holati - rang, nishon va nuqta shu yerdan. */
type GridStatus = "bad" | "ok" | "warn";

const STATUS_LABEL: Record<GridStatus, string> = {
  ok: "Me’yorda",
  warn: "Ogohlantirish",
  bad: "Nosozlik",
};

/**
 * SVG ichida Tailwind sinflari ishlamaydi (stroke/fill atributlari),
 * shuning uchun sxema uchun aynan hex kerak. Qiymatlar `globals.css` dagi
 * `state-ok | state-warn | state-bad` tokenlari bilan bir xil.
 */
const STATUS_HEX: Record<GridStatus, string> = {
  ok: "#16a34a",
  warn: "#d97706",
  bad: "#dc2626",
};

const STATUS_DOT: Record<GridStatus, string> = {
  ok: "bg-state-ok",
  warn: "bg-state-warn",
  bad: "bg-state-bad",
};

const STATUS_BADGE: Record<GridStatus, BadgeTone> = {
  ok: "green",
  warn: "amber",
  bad: "red",
};

/** Kuchlanish darajasi kodi - daraxt, jadval va sxema shu kod bo'yicha bog'lanadi. */
type LevelId = "l04" | "l10" | "l110" | "l35";

const LEVEL_LABEL: Record<LevelId, string> = {
  l110: "110 kV",
  l35: "35 kV",
  l10: "10 kV",
  l04: "0,4 kV",
};

interface VoltageLevel {
  id: LevelId;
  /** Daraxtdagi qisqa izoh. */
  note: string;
}

const LEVELS: readonly VoltageLevel[] = [
  { id: "l110", note: "Kirish liniyalari" },
  { id: "l35", note: "Taqsimlash tarmog’i" },
  { id: "l10", note: "Fiderlar" },
  { id: "l04", note: "Past kuchlanish" },
];

/* ===========================================================================
   Liniyalar (mock) - determinlashgan: `between` seed bo'yicha hisoblaydi,
   shuning uchun server va mijoz bir xil markup chizadi.
   =========================================================================== */

interface GridLine {
  id: string;
  name: string;
  level: LevelId;
  /** Joriy yuklama, foiz. */
  loadPercent: number;
  status: GridStatus;
}

/**
 * Liniya "suyagi": nom va daraja qo'lda, holat esa faqat muammoli
 * liniyalarda qo'lda (ular "So'nggi uzilishlar" jadvali bilan bir xil
 * bo'lishi shart), qolganida yuklamadan kelib chiqadi.
 */
const BASE_LINES: ReadonlyArray<{
  level: LevelId;
  name: string;
  status?: GridStatus;
}> = [
  { level: "l110", name: "L-110-1 Andijon" },
  { level: "l110", name: "L-110-2 Marhamat" },
  { level: "l110", name: "L-110-3 Xo’jaobod" },
  { level: "l110", name: "L-110-4 Paxtaobod" },

  { level: "l35", name: "L-35-1 Chinobod" },
  { level: "l35", name: "L-35-2 Oqtepa" },
  { level: "l35", name: "L-35-3 Sarnovul", status: "warn" },
  { level: "l35", name: "L-35-4 Fayzobod" },
  { level: "l35", name: "L-35-5 Qorako’l" },
  { level: "l35", name: "L-35-6 Yangiobod" },

  { level: "l10", name: "F-10-01 Markaz" },
  { level: "l10", name: "F-10-02 Navoiy" },
  { level: "l10", name: "F-10-03 Chinobod" },
  { level: "l10", name: "F-10-04 Sanoat" },
  { level: "l10", name: "F-10-05 Sarnovul" },
  { level: "l10", name: "F-10-06 Fayzobod" },
  { level: "l10", name: "F-10-07 Qorako’l", status: "bad" },
  { level: "l10", name: "F-10-08 Oqtepa" },
  { level: "l10", name: "F-10-09 Yangiobod" },
  { level: "l10", name: "F-10-10 Do’stlik" },

  { level: "l04", name: "F-04-1 Markaz" },
  { level: "l04", name: "F-04-2 Guliston" },
  { level: "l04", name: "F-04-3 Navbahor", status: "bad" },
  { level: "l04", name: "F-04-4 Bo’ston" },
  { level: "l04", name: "F-04-5 Yangiobod" },
  { level: "l04", name: "F-04-6 Gulzor" },
  { level: "l04", name: "F-04-7 Do’stlik" },
  { level: "l04", name: "F-04-8 Oqtepa" },
];

/** 90% dan oshgan yuklama - ogohlantirish chegarasi (dispetcher qoidasi). */
const LOAD_WARN_PERCENT = 90;

const LINES: readonly GridLine[] = BASE_LINES.map((base, index) => {
  const loadPercent = between(index * 4.3 + 7, 38, 92);
  return {
    id: `line-${index + 1}`,
    name: base.name,
    level: base.level,
    loadPercent,
    status: base.status ?? (loadPercent >= LOAD_WARN_PERCENT ? "warn" : "ok"),
  };
});

function linesOfLevel(level: LevelId): GridLine[] {
  return LINES.filter((line) => line.level === level);
}

/**
 * Darajaning holati - eng og'ir liniya holati bo'yicha. Qo'lda yozilsa,
 * liniyalar ro'yxati o'zgarganda daraxt bilan jadval bir-biriga zid bo'lardi.
 */
function levelStatus(level: LevelId): GridStatus {
  const lines = linesOfLevel(level);
  if (lines.some((line) => line.status === "bad")) return "bad";
  if (lines.some((line) => line.status === "warn")) return "warn";
  return "ok";
}

/**
 * Bir marta hisoblanadi va ikki joyda ishlatiladi: ikkilamchi paneldagi
 * daraxt nuqtalari va sxemadagi shina ranglari. Sxemada rang qo'lda
 * yozilganda daraxt "10 kV - nosozlik" deb turib, shina ogohlantirish
 * rangida qolib ketardi.
 */
const LEVEL_STATUS: Record<LevelId, GridStatus> = {
  l110: levelStatus("l110"),
  l35: levelStatus("l35"),
  l10: levelStatus("l10"),
  l04: levelStatus("l04"),
};

/* ===========================================================================
   Umumiy ko'rsatkichlar
   =========================================================================== */

const NETWORK_LOAD_MW = 62.4;
const NETWORK_CAPACITY_MW = 90;
const NETWORK_LOAD_PERCENT = (NETWORK_LOAD_MW / NETWORK_CAPACITY_MW) * 100;

const LINES_TOTAL = LINES.length;
const LINES_ENERGIZED = LINES.filter((line) => line.status !== "bad").length;

/** Podstansiyaga kiruvchi 110 kV liniyalar - sxemadagi yorliq shundan. */
const INCOMING_LINES = linesOfLevel("l110").length;

/** Chastota va o'rtacha kuchlanish - dispetcher pultidagi joriy o'lchov. */
const FREQUENCY_HZ = 49.98;
const AVERAGE_KV = 10.12;

/* ===========================================================================
   Sutkalik kuchlanish profili (10 kV shina)
   =========================================================================== */

interface HourPoint {
  hour: string;
  kv: number;
}

/**
 * 24 soatlik o'lchov: kechasi kuchlanish yuqori, kechki maksimumda (19:00 -
 * 21:00) pasayadi va 20:00 da quyi me'yordan chiqib ketadi.
 */
const VOLTAGE_PROFILE: readonly HourPoint[] = [
  { hour: "00", kv: 10.42 },
  { hour: "01", kv: 10.45 },
  { hour: "02", kv: 10.48 },
  { hour: "03", kv: 10.47 },
  { hour: "04", kv: 10.44 },
  { hour: "05", kv: 10.38 },
  { hour: "06", kv: 10.22 },
  { hour: "07", kv: 10.05 },
  { hour: "08", kv: 9.94 },
  { hour: "09", kv: 9.88 },
  { hour: "10", kv: 9.92 },
  { hour: "11", kv: 9.96 },
  { hour: "12", kv: 10.02 },
  { hour: "13", kv: 10.08 },
  { hour: "14", kv: 10.05 },
  { hour: "15", kv: 9.98 },
  { hour: "16", kv: 9.9 },
  { hour: "17", kv: 9.82 },
  { hour: "18", kv: 9.68 },
  { hour: "19", kv: 9.54 },
  { hour: "20", kv: 9.46 },
  { hour: "21", kv: 9.62 },
  { hour: "22", kv: 9.95 },
  { hour: "23", kv: 10.24 },
];

const PROFILE_VALUES = VOLTAGE_PROFILE.map((point) => point.kv);
const PROFILE_MIN = Math.min(...PROFILE_VALUES);
const PROFILE_MAX = Math.max(...PROFILE_VALUES);
const PROFILE_AVG =
  PROFILE_VALUES.reduce((sum, value) => sum + value, 0) / PROFILE_VALUES.length;

/** O'q ham, to'r ham bir xil qadamda - 9,4 dan 10,6 gacha 0,3 lik. */
const KV_TICKS = [9.4, 9.7, 10.0, 10.3, 10.6];

/** Yorliqlar qalashib ketmasligi uchun o'qda har 3-soat ko'rsatiladi. */
const HOUR_TICKS = VOLTAGE_PROFILE.filter((_, index) => index % 3 === 0).map(
  (point) => point.hour,
);

const NORM_MIN_KV = 9.5;
const NORM_MAX_KV = 10.5;

/**
 * Me'yor chegaralari - nivo `markers` qatlami (uzuq chiziq). `as const`
 * kerak: `axis` maydoni "y" literal tipida qolishi shart.
 */
const NORM_MARKERS = [
  {
    axis: "y",
    value: NORM_MAX_KV,
    lineStyle: { stroke: "#d97706", strokeWidth: 1, strokeDasharray: "4 4" },
  },
  {
    axis: "y",
    value: NORM_MIN_KV,
    lineStyle: { stroke: "#d97706", strokeWidth: 1, strokeDasharray: "4 4" },
  },
] as const;

/** Karta past bo'lgani uchun o'q matni 9px (bosh sahifadagi grafiklar bilan bir xil). */
const CHART_THEME = {
  text: { fontFamily: "inherit", fontSize: 9, fill: "#767676" },
  axis: {
    ticks: { text: { fontFamily: "inherit", fontSize: 9, fill: "#767676" } },
    domain: { line: { stroke: "transparent" } },
  },
  grid: { line: { stroke: "#e8e8ec", strokeDasharray: "2 2" } },
} as const;

/** Chap chekka 30px - "10,6" yorlig'i sig'adigan eng tor qiymat. */
const CHART_MARGIN = { top: 8, right: 12, bottom: 20, left: 30 } as const;

const CHART_DATA = [
  {
    id: "10 kV shina",
    data: VOLTAGE_PROFILE.map((point) => ({ x: point.hour, y: point.kv })),
  },
];

function formatKv(value: number): string {
  return dec(value, 1);
}

function formatHour(hour: string): string {
  return `${hour}:00`;
}

/* ===========================================================================
   So'nggi uzilishlar
   =========================================================================== */

type OutageState = "active" | "done" | "repair";

const OUTAGE_STATE: Record<OutageState, { label: string; tone: BadgeTone }> = {
  active: { label: "Uzilgan", tone: "red" },
  repair: { label: "Tiklanmoqda", tone: "amber" },
  done: { label: "Tiklandi", tone: "green" },
};

interface Outage {
  id: string;
  /** Uzilish boshlangan vaqt - qat'iy satr (`new Date()` ishlatilmaydi). */
  time: string;
  line: string;
  reason: string;
  duration: string;
  /** Ta'sirlangan abonentlar soni. */
  affected: number;
  state: OutageState;
}

const OUTAGES: readonly Outage[] = [
  {
    id: "o-1",
    time: "13:12",
    line: "F-10-07 Qorako’l",
    reason: "Izolyator shikastlanishi",
    duration: "42 daq",
    affected: 312,
    state: "repair",
  },
  {
    id: "o-2",
    time: "12:55",
    line: "F-04-3 Navbahor",
    reason: "Havo liniyasining uzilishi",
    duration: "47 daq",
    affected: 148,
    state: "active",
  },
  {
    id: "o-3",
    time: "11:20",
    line: "L-35-3 Sarnovul",
    reason: "Rejali ta’mir ishlari",
    duration: "2 s 22 daq",
    affected: 1240,
    state: "repair",
  },
  {
    id: "o-4",
    time: "09:35",
    line: "F-10-04 Sanoat",
    reason: "Yuklamaning oshib ketishi",
    duration: "27 daq",
    affected: 96,
    state: "done",
  },
  {
    id: "o-5",
    time: "07:12",
    line: "F-10-09 Yangiobod",
    reason: "Ajratgich nosozligi",
    duration: "1 s 32 daq",
    affected: 226,
    state: "done",
  },
  {
    id: "o-6",
    time: "04:05",
    line: "F-04-6 Gulzor",
    reason: "Kuchlanishning pasayishi",
    duration: "18 daq",
    affected: 74,
    state: "done",
  },
];

const ACTIVE_OUTAGES = OUTAGES.filter((outage) => outage.state !== "done").length;
const REPAIR_OUTAGES = OUTAGES.filter((outage) => outage.state === "repair").length;

/** "Yangilash" tugmasi shu vaqtlarni aylantiradi - `new Date()` o'rniga. */
const REFRESH_TIMES = ["13:42", "13:47", "13:52", "13:57"] as const;

/* ===========================================================================
   Bir chiziqli sxema - barcha koordinata qo'lda yozilgan
   =========================================================================== */

/**
 * Chizma nisbati 820x244 (~3,36) - col-span-7 kartaning ichki maydoni bilan
 * deyarli bir xil, shuning uchun `meet` da yon tomonlarda bo'sh joy qolmaydi.
 */
const SCHEME_WIDTH = 820;
const SCHEME_HEIGHT = 244;

const BUS_110_Y = 34;
const BUS_MID_Y = 112;
const BUS_LV_Y = 186;

interface PowerTransformer {
  id: string;
  /** Simvol markazining X koordinatasi. */
  x: number;
  label: string;
  ratio: string;
  loadPercent: number;
  status: GridStatus;
}

const T1: PowerTransformer = {
  id: "t1",
  x: 200,
  label: "T-1",
  ratio: "110/35 kV",
  loadPercent: 68,
  status: "ok",
};

const T2: PowerTransformer = {
  id: "t2",
  x: 560,
  label: "T-2",
  ratio: "110/10 kV",
  loadPercent: 74,
  status: "warn",
};

interface BranchNode {
  id: string;
  x: number;
  name: string;
  note: string;
  status: GridStatus;
}

/** 35 kV shinadan chiquvchi liniyalar - tuman ichidagi kichik podstansiyalar. */
const BRANCH_35: readonly BranchNode[] = [
  { id: "b-1", x: 110, name: "PS Chinobod", note: "35/10 kV · 81%", status: "ok" },
  { id: "b-2", x: 275, name: "PS Sarnovul", note: "35/10 kV · ta’mirda", status: "warn" },
];

/** 10 kV shinadan tushuvchi TP lar va ularning 0,4 kV shinalari. */
const TP_BRANCHES: readonly BranchNode[] = [
  { id: "tp-1", x: 470, name: "TP-014", note: "400 kVA · 62%", status: "ok" },
  { id: "tp-2", x: 600, name: "TP-051", note: "250 kVA · 88%", status: "warn" },
  { id: "tp-3", x: 730, name: "TP-077", note: "160 kVA · uzilgan", status: "bad" },
];

/** 0,4 kV shinadan chiquvchi uchta fider - markazdan siljish (px). */
const LV_FEEDER_OFFSETS = [-30, 0, 30];

/** Transformator simvoli - ustma-ust tushgan ikki halqa. */
function TransformerSymbol({
  x,
  topY,
  color,
}: {
  x: number;
  /** Yuqori halqa markazining Y koordinatasi. */
  topY: number;
  color: string;
}) {
  return (
    <>
      <circle cx={x} cy={topY} r={12} fill="none" stroke={color} strokeWidth={2} />
      <circle cx={x} cy={topY + 14} r={12} fill="none" stroke={color} strokeWidth={2} />
    </>
  );
}

/* ===========================================================================
   Ekran
   =========================================================================== */

export function GridScreen() {
  const [level, setLevel] = useState<LevelId>("l10");
  const [refreshIndex, setRefreshIndex] = useState(0);

  return (
    <AppShell sidebar={<GridSidebar level={level} onSelect={setLevel} />}>
      {/* Detal sahifasi maketi: kontent balandligi qat'iy emas, shuning uchun
          sahifaning o'zi skroll bo'lishi mumkin. */}
      <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto scrollbar-none">
        <PageHeader
          title="Tarmoq holati"
          subtitle="Baliqchi tumani elektr tarmog’i"
        >
          <span className="text-[11px] whitespace-nowrap text-ink-soft">
            Yangilangan: {REFRESH_TIMES[refreshIndex]}
          </span>
          <Badge tone="green">Barqaror</Badge>
          <HeaderButton
            icon={RefreshCw}
            onClick={() =>
              setRefreshIndex((index) => (index + 1) % REFRESH_TIMES.length)
            }
          >
            Yangilash
          </HeaderButton>
        </PageHeader>

        <StatRow>
          <StatCard
            label="Umumiy yuklama"
            value={dec(NETWORK_LOAD_MW)}
            unit="MVt"
            icon={Zap}
            accent="bg-accent-blue"
            tint="bg-tint-blue"
            hint={`Quvvat zaxirasi ${dec(NETWORK_CAPACITY_MW - NETWORK_LOAD_MW)} MVt`}
          />
          <StatCard
            label="Liniyalar"
            value={num(LINES_TOTAL)}
            unit="ta"
            icon={Cable}
            accent="bg-accent-indigo"
            tint="bg-tint-indigo"
            hint={`${num(LINES_ENERGIZED)} tasi kuchlanish ostida`}
          />
          <StatCard
            label="Uzilishlar"
            value={num(ACTIVE_OUTAGES)}
            unit="ta"
            icon={ZapOff}
            accent="bg-accent-red"
            tint="bg-tint-red"
            hint={`${num(REPAIR_OUTAGES)} tasida brigada ishlamoqda`}
            hintTone="bad"
          />
          <StatCard
            label="O’rtacha kuchlanish"
            value={dec(AVERAGE_KV, 2)}
            unit="kV"
            icon={Activity}
            accent="bg-accent-teal"
            tint="bg-tint-teal"
            hint={`Me’yor: ${dec(NORM_MIN_KV)} – ${dec(NORM_MAX_KV)} kV`}
          />
          <StatCard
            label="Chastota"
            value={dec(FREQUENCY_HZ, 2)}
            unit="Hz"
            icon={Waves}
            accent="bg-accent-green"
            tint="bg-tint-green"
            hint="Me’yor: 50 ± 0,2 Hz"
            hintTone="good"
          />
        </StatRow>

        {/* Qator balandliklari grid konteynerida turadi. Kartaga `h-[340px]`
            berib bo'lmaydi: `Card` ning o'zida `h-full` bor va `cn` oddiy
            birlashtiruvchi (tailwind-merge emas) - bir xil xususiyatga
            da'vogar ikki sinfdan qaysi biri yutishi CSS tartibiga bog'liq
            bo'lib qolardi. */}
        <div className="grid shrink-0 grid-cols-12 grid-rows-[340px_260px] gap-2">
          <SchemeCard level={level} className="col-span-7" />
          <FeedersCard level={level} className="col-span-5" />
          <VoltageProfileCard className="col-span-5" />
          <OutagesCard className="col-span-7" />
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------------------
   Ikkilamchi panel: kuchlanish darajalari daraxti + umumiy holat
   --------------------------------------------------------------------------- */

function GridSidebar({
  level,
  onSelect,
}: {
  level: LevelId;
  onSelect: (next: LevelId) => void;
}) {
  return (
    <SidebarPanel title="Tarmoq holati" footer={<OverallStatus />}>
      <p className="shrink-0 text-[11px] text-ink-soft">Kuchlanish darajalari</p>

      <nav aria-label="Kuchlanish darajalari">
        <ul className="flex flex-col gap-1">
          {LEVELS.map((item) => {
            const active = item.id === level;
            const lines = linesOfLevel(item.id);
            const status = LEVEL_STATUS[item.id];

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={active ? "true" : undefined}
                  aria-expanded={active}
                  className={cn(
                    "flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left transition-colors",
                    active ? "bg-brand text-white" : "text-ink hover:bg-canvas",
                  )}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      // Ko'k fonda o'z rangidagi nuqta ko'rinmay qolardi.
                      active ? "bg-white" : STATUS_DOT[status],
                    )}
                    title={STATUS_LABEL[status]}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {LEVEL_LABEL[item.id]}
                    </span>
                    <span
                      className={cn(
                        "block truncate text-[10px]",
                        active ? "text-white/70" : "text-ink-soft",
                      )}
                    >
                      {item.note}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-[11px] font-medium",
                      active ? "text-white/80" : "text-ink-soft",
                    )}
                  >
                    {num(lines.length)} ta
                  </span>
                  <span className="shrink-0">
                    <Icon icon={active ? ChevronDown : ChevronRight} size={16} />
                  </span>
                </button>

                {/* Tanlangan daraja ochiladi - ostida shu darajaning liniyalari. */}
                {active ? (
                  <ul className="mt-1 mb-1 ml-4 flex flex-col border-l border-solid border-[#f0f0f0] pl-3">
                    {lines.map((line) => (
                      <li
                        key={line.id}
                        className="flex h-7 items-center gap-2 text-[11px]"
                      >
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            STATUS_DOT[line.status],
                          )}
                          title={STATUS_LABEL[line.status]}
                        />
                        <span className="min-w-0 flex-1 truncate text-ink-muted">
                          {line.name}
                        </span>
                        <span className="shrink-0 font-semibold text-ink">
                          {num(line.loadPercent)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>
    </SidebarPanel>
  );
}

/**
 * Panel pastidagi "Umumiy holat" bloki.
 *
 * Blok foni oq (panel bilan bir xil): `ProgressBar` ning o'z yo'lakchasi
 * `bg-canvas`, uni sinf orqali qayta bo'yash Tailwind'da tartibga bog'liq
 * bo'lib qolardi - shuning uchun fon o'rniga yuqoridan ajratuvchi chiziq.
 */
function OverallStatus() {
  return (
    <div className="shrink-0 border-t border-solid border-[#f0f0f0] pt-3">
      <h2 className="text-xs font-bold text-ink">Umumiy holat</h2>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-ink-soft">Tarmoq yuklamasi</span>
        <span className="text-[11px] font-semibold text-ink">
          {dec(NETWORK_LOAD_PERCENT)}%
        </span>
      </div>
      <ProgressBar
        value={NETWORK_LOAD_PERCENT}
        tone="bg-accent-amber"
        className="mt-1.5"
      />
      <p className="mt-1.5 text-[10px] text-ink-soft">
        {dec(NETWORK_LOAD_MW)} MVt / {num(NETWORK_CAPACITY_MW)} MVt o&rsquo;rnatilgan
        quvvat
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-tint-red text-accent-red">
          <Icon icon={ZapOff} size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] text-ink-soft">
            Joriy uzilishlar
          </span>
          <span className="block truncate text-[10px] text-ink-soft">
            Bugun bartaraf etilgan: {num(OUTAGES.length - ACTIVE_OUTAGES)} ta
          </span>
        </span>
        <span className="shrink-0 text-sm font-bold text-ink">
          {num(ACTIVE_OUTAGES)} ta
        </span>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   a) Bir chiziqli sxema
   --------------------------------------------------------------------------- */

function SchemeCard({ level, className }: { level: LevelId; className?: string }) {
  // Tanlanmagan darajalar so'nadi - sxemada joriy daraja ajralib turadi.
  const dim = (target: LevelId) => (target === level ? 1 : 0.32);

  return (
    <Card className={className}>
      <CardHeader title="Bir chiziqli sxema">
        <span className="text-[11px] whitespace-nowrap text-ink-soft">
          Baliqchi PS &middot; 110/35/10 kV
        </span>
      </CardHeader>

      <CardBody>
        <div className="flex shrink-0 items-center gap-3 text-[10px] text-ink-soft">
          {(["ok", "warn", "bad"] as const).map((status) => (
            <span key={status} className="flex items-center gap-1 whitespace-nowrap">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_HEX[status] }}
              />
              {STATUS_LABEL[status]}
            </span>
          ))}
          <span className="ml-auto whitespace-nowrap">
            Ajratilgan daraja: {LEVEL_LABEL[level]}
          </span>
        </div>

        <div className="mt-2 min-h-0 flex-1">
          <svg
            viewBox={`0 0 ${SCHEME_WIDTH} ${SCHEME_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Baliqchi podstansiyasining bir chiziqli sxemasi"
            className="h-full w-full"
          >
            {/* --- 110 kV shina --- */}
            <g opacity={dim("l110")}>
              <line
                x1={40}
                y1={BUS_110_Y}
                x2={780}
                y2={BUS_110_Y}
                stroke={STATUS_HEX[LEVEL_STATUS.l110]}
                strokeWidth={4}
                strokeLinecap="round"
              />
              <text x={40} y={24} fontSize={10} fontWeight={600} fill="#333333">
                110 kV shina
              </text>
              <text x={780} y={24} fontSize={9} textAnchor="end" fill="#767676">
                Kirish: {num(INCOMING_LINES)} ta liniya &#183;{" "}
                {num(NETWORK_CAPACITY_MW)} MVt
              </text>
            </g>

            {/* --- 110/35 kV transformatori va 35 kV shina --- */}
            <g opacity={dim("l35")}>
              <line
                x1={T1.x}
                y1={BUS_110_Y}
                x2={T1.x}
                y2={50}
                stroke={STATUS_HEX[T1.status]}
                strokeWidth={2}
              />
              <TransformerSymbol x={T1.x} topY={62} color={STATUS_HEX[T1.status]} />
              <line
                x1={T1.x}
                y1={88}
                x2={T1.x}
                y2={BUS_MID_Y}
                stroke={STATUS_HEX[T1.status]}
                strokeWidth={2}
              />
              <text x={T1.x + 24} y={62} fontSize={9} fontWeight={600} fill="#333333">
                {T1.label} &#183; {T1.ratio}
              </text>
              <text x={T1.x + 24} y={76} fontSize={8} fill="#767676">
                Yuklama {num(T1.loadPercent)}%
              </text>

              <line
                x1={40}
                y1={BUS_MID_Y}
                x2={360}
                y2={BUS_MID_Y}
                stroke={STATUS_HEX[LEVEL_STATUS.l35]}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <text x={40} y={104} fontSize={9} fontWeight={600} fill="#333333">
                35 kV shina
              </text>

              {BRANCH_35.map((branch) => (
                <g key={branch.id}>
                  <line
                    x1={branch.x}
                    y1={BUS_MID_Y}
                    x2={branch.x}
                    y2={150}
                    stroke={STATUS_HEX[branch.status]}
                    strokeWidth={1.5}
                  />
                  <rect
                    x={branch.x - 50}
                    y={150}
                    width={100}
                    height={22}
                    rx={6}
                    fill="#ffffff"
                    stroke={STATUS_HEX[branch.status]}
                    strokeWidth={1.5}
                  />
                  <text
                    x={branch.x}
                    y={165}
                    fontSize={9}
                    fontWeight={600}
                    textAnchor="middle"
                    fill="#333333"
                  >
                    {branch.name}
                  </text>
                  <text
                    x={branch.x}
                    y={188}
                    fontSize={8}
                    textAnchor="middle"
                    fill="#767676"
                  >
                    {branch.note}
                  </text>
                </g>
              ))}
            </g>

            {/* --- 110/10 kV transformatori va 10 kV shina --- */}
            <g opacity={dim("l10")}>
              <line
                x1={T2.x}
                y1={BUS_110_Y}
                x2={T2.x}
                y2={50}
                stroke={STATUS_HEX[T2.status]}
                strokeWidth={2}
              />
              <TransformerSymbol x={T2.x} topY={62} color={STATUS_HEX[T2.status]} />
              <line
                x1={T2.x}
                y1={88}
                x2={T2.x}
                y2={BUS_MID_Y}
                stroke={STATUS_HEX[T2.status]}
                strokeWidth={2}
              />
              <text x={T2.x + 24} y={62} fontSize={9} fontWeight={600} fill="#333333">
                {T2.label} &#183; {T2.ratio}
              </text>
              <text x={T2.x + 24} y={76} fontSize={8} fill="#767676">
                Yuklama {num(T2.loadPercent)}%
              </text>

              <line
                x1={420}
                y1={BUS_MID_Y}
                x2={780}
                y2={BUS_MID_Y}
                stroke={STATUS_HEX[LEVEL_STATUS.l10]}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <text x={420} y={104} fontSize={9} fontWeight={600} fill="#333333">
                10 kV shina
              </text>
            </g>

            {/* --- TP lar (10/0,4 kV) va 0,4 kV shinalari --- */}
            <g opacity={dim("l04")}>
              <text x={40} y={200} fontSize={9} fontWeight={600} fill="#333333">
                0,4 kV shinalari
              </text>

              {TP_BRANCHES.map((tp) => {
                const color = STATUS_HEX[tp.status];
                return (
                  <g key={tp.id}>
                    <line
                      x1={tp.x}
                      y1={BUS_MID_Y}
                      x2={tp.x}
                      y2={137}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                    <TransformerSymbol x={tp.x} topY={147} color={color} />
                    <line
                      x1={tp.x}
                      y1={171}
                      x2={tp.x}
                      y2={BUS_LV_Y}
                      stroke={color}
                      strokeWidth={1.5}
                    />
                    <line
                      x1={tp.x - 48}
                      y1={BUS_LV_Y}
                      x2={tp.x + 48}
                      y2={BUS_LV_Y}
                      stroke={color}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />

                    {LV_FEEDER_OFFSETS.map((offset) => (
                      <g key={offset}>
                        <line
                          x1={tp.x + offset}
                          y1={BUS_LV_Y}
                          x2={tp.x + offset}
                          y2={202}
                          stroke={color}
                          strokeWidth={1.5}
                        />
                        <circle cx={tp.x + offset} cy={205} r={2.5} fill={color} />
                      </g>
                    ))}

                    <text
                      x={tp.x}
                      y={222}
                      fontSize={9}
                      fontWeight={600}
                      textAnchor="middle"
                      fill="#333333"
                    >
                      {tp.name}
                    </text>
                    <text
                      x={tp.x}
                      y={234}
                      fontSize={8}
                      textAnchor="middle"
                      fill="#767676"
                    >
                      {tp.note}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   b) Fiderlar holati
   --------------------------------------------------------------------------- */

const FEEDER_COLUMNS: TableColumn[] = [
  { key: "name", label: "Fider", grow: 2.4, align: "left" },
  { key: "voltage", label: "Kuchlanish", grow: 1 },
  { key: "load", label: "Yuklama", grow: 1.3 },
  { key: "status", label: "Holat", grow: 1.3 },
];

function FeedersCard({ level, className }: { level: LevelId; className?: string }) {
  // Qatorlar darajadan kelib chiqadi - ro'yxatni tashqaridan ham uzatish
  // ikki manbani (daraja + liniyalar) bir-biridan uzilib qolish xavfiga
  // qo'yardi.
  const rows = linesOfLevel(level).map((line) => ({
    key: line.id,
    cells: [
      <span key="name" className="truncate font-medium">
        {line.name}
      </span>,
      LEVEL_LABEL[line.level],
      // `ProgressBar` - `div`, shuning uchun o'ramchi ham `div` (span ichida
      // blok element bo'lmasligi kerak). Kenglik o'ramchidan beriladi:
      // primitivning o'zida `w-full` turibdi.
      <div key="load" className="flex items-center justify-center gap-1.5">
        <div className="w-9 shrink-0">
          <ProgressBar
            value={line.loadPercent}
            tone={
              line.loadPercent >= LOAD_WARN_PERCENT ? "bg-state-warn" : "bg-accent-blue"
            }
          />
        </div>
        <span className="shrink-0 font-medium">{num(line.loadPercent)}%</span>
      </div>,
      <Badge key="status" tone={STATUS_BADGE[line.status]}>
        {STATUS_LABEL[line.status]}
      </Badge>,
    ],
  }));

  return (
    <Card className={className}>
      <CardHeader title="Fiderlar holati">
        <span className="text-[11px] whitespace-nowrap text-ink-soft">
          {LEVEL_LABEL[level]} &middot; {num(rows.length)} ta
        </span>
      </CardHeader>

      <CardBody>
        {/* Daraja almashganda qator soni o'zgaradi - jadval kartadan toshib
            ketmasligi uchun ichkarida skroll qilinadi. */}
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <DataTable
            columns={FEEDER_COLUMNS}
            rows={rows}
            compact
            rowHeight={23}
            lastRowHeight={26}
          />
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   c) Kuchlanish profili
   --------------------------------------------------------------------------- */

function VoltageProfileCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Kuchlanish profili">
        <span className="text-[11px] whitespace-nowrap text-ink-soft">
          10 kV shina &middot; sutkalik
        </span>
      </CardHeader>

      <CardBody>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-soft">
          <span className="flex items-center gap-1 whitespace-nowrap">
            <span className="h-0.5 w-4 shrink-0 rounded-full bg-brand" />
            O&rsquo;lchangan kuchlanish
          </span>
          <span className="flex items-center gap-1 whitespace-nowrap">
            {/* Uzuq chiziq - grafikdagi me'yor chegaralari bilan bir xil rang. */}
            <span
              className="h-0 w-4 shrink-0 border-t border-dashed"
              style={{ borderColor: STATUS_HEX.warn }}
            />
            Me&rsquo;yor: {dec(NORM_MIN_KV)} &ndash; {dec(NORM_MAX_KV)} kV
          </span>
          <span className="ml-auto whitespace-nowrap">
            Min {dec(PROFILE_MIN, 2)} &middot; Maks {dec(PROFILE_MAX, 2)} &middot;
            O&rsquo;rt {dec(PROFILE_AVG, 2)} kV
          </span>
        </div>

        <div className="mt-1 min-h-0 flex-1">
          <ResponsiveLine
            data={CHART_DATA}
            margin={CHART_MARGIN}
            xScale={{ type: "point" }}
            yScale={{ type: "linear", min: 9.3, max: 10.8, stacked: false }}
            curve="monotoneX"
            colors={["#007cd2"]}
            lineWidth={2}
            theme={CHART_THEME}
            markers={NORM_MARKERS}
            axisTop={null}
            axisRight={null}
            axisBottom={{
              tickSize: 0,
              tickPadding: 6,
              tickValues: HOUR_TICKS,
              format: formatHour,
            }}
            axisLeft={{
              tickSize: 0,
              tickPadding: 6,
              tickValues: KV_TICKS,
              format: formatKv,
            }}
            enableGridX={false}
            gridYValues={KV_TICKS}
            pointSize={4}
            pointColor="#ffffff"
            pointBorderWidth={1.5}
            pointBorderColor={{ from: "seriesColor" }}
            // Karta `overflow-hidden` - tultip baribir kesilardi, shuning uchun
            // eng muhim qiymatlar (min/maks/o'rtacha) sarlavha ostida ko'rsatilgan.
            isInteractive={false}
            animate={false}
          />
        </div>
      </CardBody>
    </Card>
  );
}

/* ---------------------------------------------------------------------------
   d) So'nggi uzilishlar
   --------------------------------------------------------------------------- */

const OUTAGE_COLUMNS: TableColumn[] = [
  { key: "time", label: "Vaqt", grow: 0.8 },
  { key: "line", label: "Liniya", grow: 2, align: "left" },
  { key: "reason", label: "Sabab", grow: 2.4, align: "left" },
  { key: "duration", label: "Davomiyligi", grow: 1.1 },
  { key: "affected", label: "Ta’sirlangan abonent", grow: 1.6 },
  { key: "status", label: "Holat", grow: 1.3 },
];

function OutagesCard({ className }: { className?: string }) {
  const rows = OUTAGES.map((outage) => {
    const state = OUTAGE_STATE[outage.state];
    return {
      key: outage.id,
      cells: [
        <span key="time" className="font-medium">
          {outage.time}
        </span>,
        <span key="line" className="truncate font-medium">
          {outage.line}
        </span>,
        <span key="reason" className="truncate text-ink-muted">
          {outage.reason}
        </span>,
        outage.duration,
        `${num(outage.affected)} ta`,
        <Badge key="status" tone={state.tone}>
          {state.label}
        </Badge>,
      ],
    };
  });

  return (
    <Card className={className}>
      <CardHeader title="So’nggi uzilishlar">
        <span className="text-[11px] whitespace-nowrap text-ink-soft">
          Bugun &middot; {num(OUTAGES.length)} ta hodisa
        </span>
      </CardHeader>

      <CardBody>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <DataTable columns={OUTAGE_COLUMNS} rows={rows} compact />
        </div>
      </CardBody>
    </Card>
  );
}
