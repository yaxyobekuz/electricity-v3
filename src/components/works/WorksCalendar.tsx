import { REPAIR_TYPE_LABEL } from "@/lib/domain/labels";
import { daysInMonth, monthLabel, num } from "@/lib/format";
import { cn } from "@/lib/ui/cn";

import type { WorkItem } from "./WorksView";

const WEEKDAYS_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"] as const;

/** Holat nuqtasi rangi - jadvaldagi nishon ohangi bilan bir oila. */
export const WORK_DOT = {
  done: "bg-accent-green",
  planned: "bg-accent-blue",
} as const;

/**
 * Hisobot oyi setkasi: 7 ustun (dushanbadan), har kunda shu sanaga tushgan
 * ta'mirlar nuqta bilan. Oy va "bugun" belgisi - davrning hisobot sanasi
 * (`reportDate`), haqiqiy bugungi sana emas.
 *
 * Barcha hisob UTC maydonlarida: server va mijoz bir xil setka chizadi,
 * mahalliy vaqt zonasi kunni surib yubormaydi.
 */
export function WorksCalendar({
  works,
  reportDate,
}: {
  works: readonly WorkItem[];
  /** ISO. */
  reportDate: string;
}) {
  const anchor = new Date(reportDate);
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const today = anchor.getUTCDate();
  const length = daysInMonth(anchor);
  // `getUTCDay`: 0 - yakshanba. Dushanbadan boshlanadigan setkada oldingi bo'sh kataklar.
  const offset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const cellCount = Math.ceil((offset + length) / 7) * 7;

  const byDay = new Map<number, WorkItem[]>();
  for (const work of works) {
    const date = new Date(work.date);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month) continue;
    const day = date.getUTCDate();
    const bucket = byDay.get(day);
    if (bucket) bucket.push(work);
    else byDay.set(day, [work]);
  }
  const inMonth = [...byDay.values()].reduce((total, items) => total + items.length, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-xs font-bold text-ink">{monthLabel(anchor)}</h3>
        <span className="text-[11px] text-ink-soft">
          {inMonth > 0 ? `${num(inMonth)} ta ta’mir shu oyga to’g’ri keladi` : "Shu oyga ta’mir sanasi to’g’ri kelmaydi"}
        </span>
        <span className="ml-auto flex items-center gap-3 text-[10px] text-ink-soft">
          <span className="flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", WORK_DOT.done)} />
            Bajarilgan
          </span>
          <span className="flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", WORK_DOT.planned)} />
            Rejalashtirilgan
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded-sm border border-solid border-brand bg-tint-blue" />
            Hisobot sanasi
          </span>
        </span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {WEEKDAYS_UZ.map((weekday) => (
          <span key={weekday} className="truncate text-center text-[10px] font-semibold text-ink-soft">
            {weekday}
          </span>
        ))}

        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - offset + 1;
          if (day < 1 || day > length) {
            return <div key={`empty-${index}`} aria-hidden className="min-h-22 rounded-lg bg-canvas" />;
          }

          const items = byDay.get(day) ?? [];
          const isReportDay = day === today;

          return (
            <div
              key={day}
              className={cn(
                "flex min-h-22 min-w-0 flex-col gap-1.5 rounded-lg border border-solid p-2",
                isReportDay ? "border-brand bg-tint-blue" : "border-[#f0f0f0]",
              )}
            >
              <span
                className={cn(
                  "text-[11px] leading-none font-semibold",
                  isReportDay ? "text-brand" : "text-ink-muted",
                )}
              >
                {day}
              </span>

              {items.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1">
                    {items.slice(0, 12).map((work) => (
                      <span
                        key={work.id}
                        title={`${work.transformer.name} · ${REPAIR_TYPE_LABEL[work.type]} · ${work.done ? "Bajarilgan" : "Rejalashtirilgan"}`}
                        className={cn("size-1.5 rounded-full", work.done ? WORK_DOT.done : WORK_DOT.planned)}
                      />
                    ))}
                  </div>
                  <span className="mt-auto truncate text-[10px] text-ink-soft">{num(items.length)} ta</span>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
