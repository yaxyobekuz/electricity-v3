"use client";

import {
  CalendarDays,
  CircleCheck,
  ClipboardList,
  LoaderCircle,
  Plus,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/DataTable";
import { CycleSelect, type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import {
  type RegistryColumn,
  type RegistryRow,
  RegistryTable,
} from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { MONTHS_UZ, between, num, pick } from "@/lib/data/seed";
import { SUBSTATIONS } from "@/lib/data/substations";
import { TRANSFORMERS } from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Sana yordamchilari

   `new Date()` ataylab ishlatilmaydi: server va mijoz bir xil markup chizishi
   shart, aks holda gidratsiya xatosi chiqadi. Shu sababli barcha sanalar
   2026-yilning "kun tartib raqami" (1..365) sifatida saqlanadi va faqat
   ko'rsatishdan oldin kun/oyga aylantiriladi.
   --------------------------------------------------------------------------- */

const YEAR = 2026;

/** 2026 kabisa yil emas - oy uzunliklari qat'iy. */
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/** `seed.ts` dagi TODAY ("10-avgust, 2026") ning kun tartib raqami. */
const TODAY_ORDINAL = 222;

/** Kalendar ko'rinishi shu oyni chizadi (0 dan boshlab - avgust). */
const CALENDAR_MONTH = 7;

/**
 * 2026-yil 1-avgust shanbaga to'g'ri keladi, ya'ni dushanbadan boshlanadigan
 * setkada oldida 5 ta bo'sh katak bo'ladi. Qiymat qo'lda yozilgan - `Date`
 * bilan hisoblansa server va mijoz vaqt mintaqasiga bog'liq bo'lib qolardi.
 */
const CALENDAR_OFFSET = 5;

const WEEKDAYS_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"] as const;

interface WorkDate {
  /** Oy ichidagi kun, 1 dan boshlab. */
  day: number;
  /** Oy indeksi, 0 dan boshlab. */
  month: number;
}

/** Yil ichidagi tartib raqamini kun/oyga aylantiradi. */
function dateOf(ordinal: number): WorkDate {
  let rest = ordinal;
  let month = 0;
  while (rest > MONTH_LENGTHS[month]) {
    rest -= MONTH_LENGTHS[month];
    month += 1;
  }
  return { day: rest, month };
}

/** "12-avgust, 2026" - boshqa modullardagi sana ko'rinishi bilan bir xil. */
function formatDate(date: WorkDate): string {
  return `${date.day}-${MONTHS_UZ[date.month].toLowerCase()}, ${YEAR}`;
}

/* ---------------------------------------------------------------------------
   Domen tiplari
   --------------------------------------------------------------------------- */

type WorkStatus = "done" | "inProgress" | "overdue" | "planned";

const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  planned: "Rejada",
  inProgress: "Bajarilmoqda",
  done: "Yakunlangan",
  overdue: "Muddati o’tgan",
};

const WORK_STATUS_TONE: Record<WorkStatus, BadgeTone> = {
  planned: "blue",
  inProgress: "amber",
  done: "green",
  overdue: "red",
};

/** Kalendar katagidagi nuqta rangi - nishon ohangi bilan bir xil oila. */
const WORK_STATUS_DOT: Record<WorkStatus, string> = {
  planned: "bg-accent-blue",
  inProgress: "bg-accent-amber",
  done: "bg-accent-green",
  overdue: "bg-accent-red",
};

type WorkPriority = "high" | "low" | "medium";

const PRIORITY_LABEL: Record<WorkPriority, string> = {
  low: "Past",
  medium: "O’rta",
  high: "Yuqori",
};

/**
 * Muhimlik nishoni holat nishonining yonida turadi, shuning uchun ranglari
 * ataylab boshqacha: past - yashil (xotirjam), yuqori - qizil.
 */
const PRIORITY_TONE: Record<WorkPriority, BadgeTone> = {
  low: "green",
  medium: "amber",
  high: "red",
};

interface Work {
  id: string;
  /** Hujjatdagi raqam: "ISH-2026-001". */
  code: string;
  type: string;
  /** TP yoki PS kodi - ish qaysi obyektda bajarilayotgani. */
  object: string;
  start: WorkDate;
  due: WorkDate;
  responsible: string;
  priority: WorkPriority;
  status: WorkStatus;
}

/* ---------------------------------------------------------------------------
   Maket ma'lumotlari (determinlashgan)
   --------------------------------------------------------------------------- */

const WORK_TYPES = [
  "Transformatorni ta’mirlash",
  "Hisoblagich almashtirish",
  "Liniya kesimini tekshirish",
  "Izolyator almashtirish",
  "Yog’ tahlili",
  "Profilaktik ko’rik",
  "Kabel yotqizish",
  "Rele himoyasini sozlash",
] as const;

const RESPONSIBLE = [
  "Karimov Egamberdi",
  "Yusupov Sardor",
  "Tursunov Bekzod",
  "Aliyev Jasur",
  "Nazarov Oybek",
  "Rahimov Shuhrat",
  "Sobirov Dilshod",
  "Ergashev Ulug’bek",
] as const;

/** Ishlar TP larda ham, podstansiyalarda ham bajariladi. */
const OBJECT_CODES: readonly string[] = [
  ...TRANSFORMERS.map((item) => item.code),
  ...SUBSTATIONS.map((item) => item.code),
];

/**
 * Holatlar qo'lda taqsimlangan - yuqoridagi statistika bloklaridagi sonlar
 * (8 rejada, 6 bajarilmoqda, 9 yakunlangan, 3 muddati o'tgan) barqaror
 * bo'lishi kerak, shuning uchun tasodifiy tanlanmaydi.
 */
const STATUS_PLAN: readonly WorkStatus[] = [
  "inProgress",
  "planned",
  "done",
  "overdue",
  "done",
  "planned",
  "inProgress",
  "done",
  "planned",
  "done",
  "overdue",
  "inProgress",
  "planned",
  "done",
  "planned",
  "inProgress",
  "done",
  "planned",
  "overdue",
  "done",
  "inProgress",
  "planned",
  "done",
  "inProgress",
  "planned",
  "done",
];

/**
 * Sanalar holatdan kelib chiqib hosil qilinadi, aksincha emas: shunda
 * "yakunlangan" ish hech qachon kelajakdagi muddatga, "rejadagi" ish esa
 * o'tgan sanaga tushib qolmaydi.
 */
function scheduleOf(status: WorkStatus, seed: number): { due: number; start: number } {
  if (status === "done") {
    const due = TODAY_ORDINAL - between(seed * 3.7, 1, 22, 1);
    return { start: due - between(seed * 5.3, 2, 9, 1), due };
  }
  if (status === "overdue") {
    const due = TODAY_ORDINAL - between(seed * 7.1, 1, 9, 1);
    return { start: due - between(seed * 11.3, 4, 20, 1), due };
  }
  if (status === "inProgress") {
    const start = TODAY_ORDINAL - between(seed * 13.9, 1, 12, 1);
    return { start, due: TODAY_ORDINAL + between(seed * 17.7, 2, 15, 1) };
  }
  const start = TODAY_ORDINAL + between(seed * 19.3, 1, 20, 1);
  return { start, due: start + between(seed * 23.1, 4, 18, 1) };
}

const WORKS: readonly Work[] = STATUS_PLAN.map((status, index) => {
  const seed = index + 1;
  const { start, due } = scheduleOf(status, seed);

  return {
    id: `work-${String(index + 1).padStart(3, "0")}`,
    code: `ISH-${YEAR}-${String(index + 1).padStart(3, "0")}`,
    type: pick(seed * 2.9, WORK_TYPES),
    object: pick(seed * 31.7, OBJECT_CODES),
    start: dateOf(start),
    due: dateOf(due),
    responsible: pick(seed * 37.1, RESPONSIBLE),
    // Muddati o'tgan ish hech qachon "past" muhimlikda bo'lmaydi.
    priority:
      status === "overdue"
        ? pick(seed * 41.3, ["medium", "high"] as const)
        : pick(seed * 43.9, ["low", "medium", "high"] as const),
    status,
  };
});

/* ---------------------------------------------------------------------------
   Jadval
   --------------------------------------------------------------------------- */

const COLUMNS: RegistryColumn[] = [
  { key: "code", label: "Raqam", grow: 10, align: "left" },
  { key: "type", label: "Ish turi", grow: 24, align: "left" },
  { key: "object", label: "Obyekt", grow: 14, align: "left" },
  { key: "start", label: "Boshlanish", grow: 12 },
  { key: "due", label: "Muddat", grow: 12 },
  { key: "responsible", label: "Mas’ul", grow: 18, align: "left" },
  { key: "priority", label: "Muhimlik", grow: 12 },
  { key: "status", label: "Holat", grow: 12 },
];

type StatusFilter = WorkStatus | "all";

const FILTER_ITEMS: ReadonlyArray<Omit<FilterChip<StatusFilter>, "count">> = [
  { value: "all", label: "Barchasi" },
  { value: "planned", label: WORK_STATUS_LABEL.planned, dot: WORK_STATUS_DOT.planned },
  { value: "inProgress", label: WORK_STATUS_LABEL.inProgress, dot: WORK_STATUS_DOT.inProgress },
  { value: "done", label: WORK_STATUS_LABEL.done, dot: WORK_STATUS_DOT.done },
  { value: "overdue", label: WORK_STATUS_LABEL.overdue, dot: WORK_STATUS_DOT.overdue },
];

/** Sarlavhadagi ko'rinish almashtirgichi ikki holatda aylanadi. */
type ViewMode = "calendar" | "list";

const VIEW_LABEL: Record<ViewMode, string> = {
  list: "Ro’yxat",
  calendar: "Kalendar",
};

/* ---------------------------------------------------------------------------
   Kalendar setkasi
   --------------------------------------------------------------------------- */

/**
 * Oddiy oylik setka: 7 ustun, kunlar va har kunda boshlanadigan ishlar
 * nuqta bilan. To'liq kalendar (sudrab ko'chirish, hafta ko'rinishi) maket
 * bosqichida kerak emas - bu yerda faqat yuklamaning oy bo'ylab taqsimoti
 * ko'rsatiladi.
 */
function WorksCalendar({ works }: { works: readonly Work[] }) {
  // Kunlar bo'yicha guruhlash: kalit - oy ichidagi kun raqami.
  const byDay = new Map<number, Work[]>();
  let inMonth = 0;
  for (const work of works) {
    if (work.start.month !== CALENDAR_MONTH) continue;
    inMonth += 1;
    const bucket = byDay.get(work.start.day);
    if (bucket) bucket.push(work);
    else byDay.set(work.start.day, [work]);
  }

  const daysInMonth = MONTH_LENGTHS[CALENDAR_MONTH];
  const cellCount = Math.ceil((CALENDAR_OFFSET + daysInMonth) / 7) * 7;
  const todayDay = dateOf(TODAY_ORDINAL).day;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-xs font-bold text-ink">
          {MONTHS_UZ[CALENDAR_MONTH]} {YEAR}
        </h3>
        <span className="text-[11px] text-ink-soft">
          {num(inMonth)} ta ish shu oyda boshlanadi, har biri nuqta bilan belgilangan
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS_UZ.map((weekday) => (
          <span
            key={weekday}
            className="truncate text-center text-[10px] font-semibold text-ink-soft"
          >
            {weekday}
          </span>
        ))}

        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - CALENDAR_OFFSET + 1;
          const outside = day < 1 || day > daysInMonth;

          if (outside) {
            return (
              <div
                key={`empty-${index}`}
                aria-hidden
                className="min-h-[88px] rounded-lg bg-canvas"
              />
            );
          }

          const items = byDay.get(day) ?? [];
          const today = day === todayDay;

          return (
            <div
              key={day}
              className={cn(
                "flex min-h-[88px] min-w-0 flex-col gap-1.5 rounded-lg border border-solid p-2",
                today ? "border-brand bg-tint-blue" : "border-[#f0f0f0]",
              )}
            >
              <span
                className={cn(
                  "text-[11px] leading-none font-semibold",
                  today ? "text-brand" : "text-ink-muted",
                )}
              >
                {day}
              </span>

              {items.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1">
                    {items.slice(0, 6).map((work) => (
                      <span
                        key={work.id}
                        title={`${work.code} · ${work.type}`}
                        className={cn("size-1.5 rounded-full", WORK_STATUS_DOT[work.status])}
                      />
                    ))}
                  </div>
                  <span className="mt-auto truncate text-[10px] text-ink-soft">
                    {num(items.length)} ta ish
                  </span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Sahifa
   --------------------------------------------------------------------------- */

export function WorksView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("list");

  // Statistika filtrga bog'liq emas - u doim butun reja bo'yicha hisoblanadi.
  const totals = useMemo(() => {
    const count = (value: WorkStatus) =>
      WORKS.filter((work) => work.status === value).length;
    return {
      total: WORKS.length,
      planned: count("planned"),
      inProgress: count("inProgress"),
      done: count("done"),
      overdue: count("overdue"),
    };
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return WORKS.filter((work) => {
      if (status !== "all" && work.status !== status) return false;
      if (!needle) return true;
      return (
        work.code.toLowerCase().includes(needle) ||
        work.type.toLowerCase().includes(needle) ||
        work.object.toLowerCase().includes(needle) ||
        work.responsible.toLowerCase().includes(needle)
      );
    });
  }, [query, status]);

  const filters = useMemo<ReadonlyArray<FilterChip<StatusFilter>>>(
    () =>
      FILTER_ITEMS.map((item) => ({
        ...item,
        count:
          item.value === "all"
            ? WORKS.length
            : WORKS.filter((work) => work.status === item.value).length,
      })),
    [],
  );

  const rows = useMemo<RegistryRow[]>(
    () =>
      visible.map((work) => ({
        key: work.id,
        cells: [
          <span key="code" className="truncate font-medium text-ink-muted">
            {work.code}
          </span>,
          <span key="type" className="truncate">
            {work.type}
          </span>,
          <span key="object" className="truncate font-medium text-brand">
            {work.object}
          </span>,
          formatDate(work.start),
          // Muddati o'tgan ishning sanasi qizil - ko'z birinchi shunga tushadi.
          <span
            key="due"
            className={cn(work.status === "overdue" && "font-medium text-accent-red")}
          >
            {formatDate(work.due)}
          </span>,
          <span key="responsible" className="truncate">
            {work.responsible}
          </span>,
          <Badge key="priority" tone={PRIORITY_TONE[work.priority]}>
            {PRIORITY_LABEL[work.priority]}
          </Badge>,
          <Badge key="status" tone={WORK_STATUS_TONE[work.status]}>
            {WORK_STATUS_LABEL[work.status]}
          </Badge>,
        ],
      })),
    [visible],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader title="Ishlar" subtitle="Rejalashtirilgan va bajarilgan texnik ishlar">
        <CycleSelect
          label="Ko’rinish"
          value={VIEW_LABEL[view]}
          onCycle={() => setView(view === "list" ? "calendar" : "list")}
        />
        <HeaderButton icon={Plus} tone="brand">
          Yangi ish
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Jami ish"
          value={num(totals.total)}
          unit="ta"
          icon={ClipboardList}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`${num(totals.done)} tasi yopilgan · ${num(totals.total - totals.done)} tasi ochiq`}
        />
        <StatCard
          label="Rejada"
          value={num(totals.planned)}
          unit="ta"
          icon={CalendarDays}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint="Boshlanishi kutilmoqda"
        />
        <StatCard
          label="Bajarilmoqda"
          value={num(totals.inProgress)}
          unit="ta"
          icon={LoaderCircle}
          accent="bg-accent-amber"
          tint="bg-tint-amber"
          hint="Brigadalar ish ustida"
        />
        <StatCard
          label="Yakunlangan"
          value={num(totals.done)}
          unit="ta"
          icon={CircleCheck}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint="Muddatida topshirilgan"
          hintTone="good"
        />
        <StatCard
          label="Muddati o’tgan"
          value={num(totals.overdue)}
          unit="ta"
          icon={TriangleAlert}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint="Nazoratga olish zarur"
          hintTone="bad"
        />
      </StatRow>

      <Card className="min-h-0 flex-1">
        <div className="flex shrink-0 items-center gap-2 pb-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Raqam, ish turi, obyekt yoki mas’ul..."
            label="Ishlar ro’yxatidan qidirish"
            className="w-[240px]"
          />
          <FilterChips items={filters} value={status} onChange={setStatus} />
          <span className="ml-auto shrink-0 text-[11px] text-ink-soft">
            {num(visible.length)} ta yozuv
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          {view === "list" ? (
            <RegistryTable
              columns={COLUMNS}
              rows={rows}
              emptyText="Tanlangan shartlarga mos ish topilmadi"
            />
          ) : (
            <WorksCalendar works={visible} />
          )}
        </div>
      </Card>
    </div>
  );
}
