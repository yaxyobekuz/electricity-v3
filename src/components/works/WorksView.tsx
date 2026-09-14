"use client";

import { CalendarClock, CalendarDays, CircleCheck, ClipboardList, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { CycleSelect, type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { type RegistryColumn, type RegistryRow, RegistryTable } from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { REPAIR_TYPE_LABEL, REPAIR_TYPE_ORDER, type RepairType } from "@/lib/domain/labels";
import { nameKey } from "@/lib/domain/normalize";
import { EMPTY, formatDate, monthLabel, num } from "@/lib/format";

import { WORK_DOT, WorksCalendar } from "./WorksCalendar";

/* ---------------------------------------------------------------------------
   Tiplar (server sahifasi shu ko'rinishda uzatadi)
   --------------------------------------------------------------------------- */

interface Ref {
  id: string;
  name: string;
}

/** Bitta ta'mir sanasi - TP holatidagi "Joriy" yoki "To'la" ta'mir. */
export interface WorkItem {
  id: string;
  /** ISO. */
  date: string;
  type: RepairType;
  /** Sana hisobot sanasidan keyin emas. */
  done: boolean;
  transformer: Ref;
  feeder: Ref;
  substation: Ref;
  staff: Ref | null;
}

/** URL dagi qamrov (`?scope=`) - sarlavhada ko'rsatiladi. */
export interface WorkScope {
  /** `"feeder:<id>"` */
  param: string;
  /** "Podstansiya" | "Fider" | "TP" */
  kind: string;
  name: string;
  href: string;
}

export type WorkDoneFilter = "all" | "done" | "planned";
export type WorkTypeFilter = "all" | RepairType;

/** Qamrov bo'yicha (qidiruv va filtrlarsiz) sonlar. */
interface WorkStats {
  total: number;
  done: number;
  planned: number;
  byType: Record<RepairType, number>;
  /** Sanasi hisobot oyiga tushganlar. */
  inMonth: number;
  inMonthDone: number;
}

/* ---------------------------------------------------------------------------
   Jadval
   --------------------------------------------------------------------------- */

const COLUMNS: RegistryColumn[] = [
  { key: "date", label: "Sana", grow: 12 },
  { key: "type", label: "Turi", grow: 11 },
  { key: "transformer", label: "TP", grow: 11, align: "left" },
  { key: "feeder", label: "Fider", grow: 13, align: "left" },
  { key: "substation", label: "Podstansiya", grow: 14, align: "left" },
  { key: "status", label: "Holat", grow: 13 },
  { key: "staff", label: "Ma’sul xodim", grow: 18, align: "left" },
];

/** Fider, podstansiya va xodim kataklari - oddiy matn ko'rinishidagi havola. */
const CELL_LINK = "truncate hover:text-brand hover:underline";

export type WorkViewMode = "calendar" | "list";

const VIEW_LABEL: Record<WorkViewMode, string> = { list: "Ro’yxat", calendar: "Kalendar" };

const DONE_PARAM: Record<WorkDoneFilter, string | null> = { all: null, done: "1", planned: "0" };

/** URL dagi holat: `?q`, `?done=1|0`, `?type=CURRENT|OVERHAUL`, `?view=calendar`. */
export interface WorkFilters {
  q: string;
  done: WorkDoneFilter;
  type: WorkTypeFilter;
  view: WorkViewMode;
}

function doneMatches(work: WorkItem, done: WorkDoneFilter): boolean {
  return done === "all" || work.done === (done === "done");
}

function typeMatches(work: WorkItem, type: WorkTypeFilter): boolean {
  return type === "all" || work.type === type;
}

/* ---------------------------------------------------------------------------
   Sahifa
   --------------------------------------------------------------------------- */

export function WorksView({
  title,
  subtitle,
  periodLabel,
  reportDate,
  scope,
  missing = null,
  rows,
  stats,
  initial,
}: {
  title: string;
  subtitle: string;
  periodLabel: string;
  /** Davrning hisobot sanasi, ISO. */
  reportDate: string;
  scope: WorkScope | null;
  /**
   * Qamrovda shu oy TP holati yo'q - ta'mir sanalari ham yo'q. Berilsa,
   * sarlavhadan keyin shu matnli bo'sh holat chiziladi ("0 ta" o'rniga).
   */
  missing?: string | null;
  /** Qamrovdagi barcha ta'mirlar, sana kamayish tartibida. */
  rows: readonly WorkItem[];
  stats: WorkStats;
  /** URL dagi boshlang'ich filtrlar. */
  initial: WorkFilters;
}) {
  const [filters, setFilters] = useState<WorkFilters>(initial);

  // Filtr URL ga yoziladi (sahifa qayta yuklanmaydi) - havolani ulashsa yoki
  // oy almashtirilsa, ro'yxat shu holatda qoladi.
  const update = (patch: Partial<WorkFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    const params = new URLSearchParams();
    if (scope) params.set("scope", scope.param);
    if (next.q) params.set("q", next.q);
    const done = DONE_PARAM[next.done];
    if (done) params.set("done", done);
    if (next.type !== "all") params.set("type", next.type);
    if (next.view === "calendar") params.set("view", "calendar");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  };

  // Kalendar faqat hisobot oyini chizadi - u ko'rinishda chip sonlari va
  // "N ta yozuv" ham faqat shu oy sanalari bo'yicha (ISO sana UTC da, kalendar
  // ham UTC maydonlari bilan ishlaydi).
  const reportMonth = reportDate.slice(0, 7);
  const searched = useMemo(() => {
    const key = nameKey(filters.q);
    return rows.filter(
      (work) =>
        (filters.view === "list" || work.date.slice(0, 7) === reportMonth) &&
        (!key ||
          [work.transformer.name, work.feeder.name, work.substation.name, work.staff?.name].some(
            (value) => value != null && nameKey(value).includes(key),
          )),
    );
  }, [rows, filters.q, filters.view, reportMonth]);

  // Har bir chip guruhi o'z filtrisiz, qolgan filtrlar bilan sanaladi -
  // chip bosilganda aynan shuncha qator chiqadi.
  const doneChips = useMemo<FilterChip<WorkDoneFilter>[]>(() => {
    const pool = searched.filter((work) => typeMatches(work, filters.type));
    return [
      { value: "all", label: "Barchasi", count: pool.length },
      { value: "done", label: "Bajarilgan", dot: WORK_DOT.done, count: pool.filter((work) => work.done).length },
      {
        value: "planned",
        label: "Rejalashtirilgan",
        dot: WORK_DOT.planned,
        count: pool.filter((work) => !work.done).length,
      },
    ];
  }, [searched, filters.type]);

  const typeChips = useMemo<FilterChip<WorkTypeFilter>[]>(() => {
    const pool = searched.filter((work) => doneMatches(work, filters.done));
    return [
      { value: "all", label: "Barcha turlar", count: pool.length },
      ...REPAIR_TYPE_ORDER.map((type) => ({
        value: type,
        label: REPAIR_TYPE_LABEL[type],
        count: pool.filter((work) => work.type === type).length,
      })),
    ];
  }, [searched, filters.done]);

  const visible = useMemo(
    () => searched.filter((work) => doneMatches(work, filters.done) && typeMatches(work, filters.type)),
    [searched, filters.done, filters.type],
  );

  const tableRows = useMemo<RegistryRow[]>(
    () =>
      visible.map((work) => ({
        key: work.id,
        cells: [
          formatDate(work.date),
          REPAIR_TYPE_LABEL[work.type],
          <Link
            key="transformer"
            href={`/transformers/${work.transformer.id}`}
            className="truncate font-medium text-brand hover:underline"
          >
            {work.transformer.name}
          </Link>,
          <Link key="feeder" href={`/feeders/${work.feeder.id}`} className={CELL_LINK}>
            {work.feeder.name}
          </Link>,
          <Link key="substation" href={`/substations/${work.substation.id}`} className={CELL_LINK}>
            {work.substation.name}
          </Link>,
          <Badge key="status" tone={work.done ? "green" : "blue"}>
            {work.done ? "Bajarilgan" : "Rejalashtirilgan"}
          </Badge>,
          work.staff ? (
            <Link key="staff" href={`/staff?${new URLSearchParams({ q: work.staff.name })}`} className={CELL_LINK}>
              {work.staff.name}
            </Link>
          ) : (
            EMPTY
          ),
        ],
      })),
    [visible],
  );

  // Qamrov filtrini olib tashlash - server qayta o'qishi kerak, shuning uchun havola.
  const clearScopeHref = (() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    const done = DONE_PARAM[filters.done];
    if (done) params.set("done", done);
    if (filters.type !== "all") params.set("type", filters.type);
    if (filters.view === "calendar") params.set("view", "calendar");
    const query = params.toString();
    return query ? `/works?${query}` : "/works";
  })();

  const reportLabel = formatDate(reportDate);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader title={title} subtitle={`${subtitle} · ${periodLabel}`}>
        {scope ? (
          <span className="flex h-8 max-w-65 min-w-0 items-center gap-1 rounded-lg bg-tint-blue pr-1 pl-3 text-xs">
            <span className="shrink-0 text-ink-soft">{scope.kind}:</span>
            <Link href={scope.href} className="truncate font-medium text-brand hover:underline">
              {scope.name}
            </Link>
            <Link
              href={clearScopeHref}
              aria-label="Qamrov filtrini olib tashlash"
              title="Qamrov filtrini olib tashlash"
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-black/5 hover:text-ink"
            >
              <Icon icon={X} size={14} />
            </Link>
          </span>
        ) : null}
        {missing ? null : (
          <CycleSelect
            label="Ko’rinish"
            value={VIEW_LABEL[filters.view]}
            onCycle={() => update({ view: filters.view === "list" ? "calendar" : "list" })}
          />
        )}
      </PageHeader>

      {missing ? (
        <div className="min-h-0 flex-1 rounded-2xl bg-surface">
          <EmptyState
            variant="inline"
            action={false}
            title={missing}
            description="Ta’mir sanalari shu oyning Transformatorlar jadvalidan olinadi. Boshqa oyni tanlang yoki qamrov filtrini olib tashlang."
          />
        </div>
      ) : (
        <>
          <StatRow>
            <StatCard
              label="Jami ta’mir"
              value={num(stats.total)}
              unit="ta"
              icon={ClipboardList}
              accent="bg-accent-indigo"
              tint="bg-tint-indigo"
              hint={REPAIR_TYPE_ORDER.map((type) => `${REPAIR_TYPE_LABEL[type]}: ${num(stats.byType[type])}`).join(" · ")}
            />
            <StatCard
              label="Bajarilgan"
              value={num(stats.done)}
              unit="ta"
              icon={CircleCheck}
              accent="bg-accent-green"
              tint="bg-tint-green"
              hint={`Sanasi ${reportLabel} yoki undan oldin`}
            />
            <StatCard
              label="Rejalashtirilgan"
              value={num(stats.planned)}
              unit="ta"
              icon={CalendarClock}
              accent="bg-accent-blue"
              tint="bg-tint-blue"
              hint={`Sanasi ${reportLabel} dan keyin`}
            />
            <StatCard
              label={`${monthLabel(reportDate)} oyida`}
              value={num(stats.inMonth)}
              unit="ta"
              icon={CalendarDays}
              accent="bg-accent-amber"
              tint="bg-tint-amber"
              hint={`${num(stats.inMonthDone)} ta bajarilgan · ${num(stats.inMonth - stats.inMonthDone)} ta rejalashtirilgan`}
            />
          </StatRow>

          <Card className="min-h-0 flex-1">
            <div className="flex shrink-0 items-center gap-2 pb-3">
              <SearchField
                value={filters.q}
                onChange={(q) => update({ q })}
                placeholder="TP, fider, podstansiya yoki xodim..."
                label="Ta’mir ishlaridan qidirish"
                className="w-60 shrink-0"
              />
              <FilterChips items={doneChips} value={filters.done} onChange={(done) => update({ done })} />
              <span aria-hidden className="h-5 w-px shrink-0 bg-[#f0f0f0]" />
              <FilterChips items={typeChips} value={filters.type} onChange={(type) => update({ type })} />
              <span className="ml-auto shrink-0 text-[11px] text-ink-soft">{num(visible.length)} ta yozuv</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
              {filters.view === "list" ? (
                <RegistryTable
                  columns={COLUMNS}
                  rows={tableRows}
                  emptyText={
                    stats.total === 0
                      ? "Bu qamrovdagi TP larda ta’mir sanasi ko’rsatilmagan"
                      : "Tanlangan shartlarga mos ta’mir topilmadi"
                  }
                />
              ) : (
                <WorksCalendar works={visible} reportDate={reportDate} />
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
