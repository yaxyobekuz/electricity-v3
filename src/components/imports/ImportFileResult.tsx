import { CircleCheck, CircleX, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/DataTable";
import { Icon } from "@/components/ui/Icon";
import { TEMPLATE_LABEL } from "@/lib/domain/labels";
import { formatDate, monthLabel, num, parseMonthKey } from "@/lib/format";
import type { ImportFileReport, ImportIssue } from "@/lib/import/types";
import { cn } from "@/lib/ui/cn";

import { fileSizeLabel } from "./templateFiles";

function where(issue: ImportIssue): string {
  return [issue.row != null ? `${issue.row}-qator` : null, issue.column].filter(Boolean).join(" · ");
}

/**
 * Qo'shiladi / yangilanadi / o'chiriladi - faqat haqiqatan saqlangandan keyin
 * o'tgan zamonda (rad etilgan saqlashda bazaga hech narsa yozilmagan).
 */
const PLANNED_LABELS: [string, string, string] = ["Qo’shiladi", "Yangilanadi", "O’chiriladi"];
const DONE_LABELS: [string, string, string] = ["Qo’shildi", "Yangilandi", "O’chirildi"];

function Count({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg bg-canvas px-3 py-2">
      <span className="truncate text-[10px] font-medium text-ink-soft">{label}</span>
      <span className={cn("text-base leading-tight font-bold text-ink", tone)}>{num(value)}</span>
    </div>
  );
}

/**
 * Bitta faylning tekshiruv natijasi: aniqlangan shablon, oy, qatorlar soni,
 * xatolar jadvali va ogohlantirishlar.
 */
export function ImportFileResult({ report, committed }: { report: ImportFileReport; committed: boolean }) {
  const month = parseMonthKey(report.month);
  const ok = report.errorCount === 0;
  const [created, updated, removed] = committed ? DONE_LABELS : PLANNED_LABELS;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-solid p-3",
        ok ? "border-hairline" : "border-accent-red/40",
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className={cn("mt-0.5 shrink-0", ok ? "text-accent-green" : "text-accent-red")}>
            <Icon icon={ok ? CircleCheck : CircleX} size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink" title={report.fileName}>
              {report.fileName}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-soft">
              {report.templateType ? TEMPLATE_LABEL[report.templateType] : "Shablon aniqlanmadi"}
              {month ? ` · ${monthLabel(month)}` : ""}
              {report.reportDate ? ` · ${formatDate(report.reportDate)} holatiga` : ""}
              {` · ${fileSizeLabel(report.fileSize)}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {report.warningCount > 0 ? (
            <Badge tone="amber">{num(report.warningCount)} ta ogohlantirish</Badge>
          ) : null}
          <Badge tone={ok ? "green" : "red"}>{ok ? "Xatosiz" : `${num(report.errorCount)} ta xato`}</Badge>
        </div>
      </header>

      {report.templateType ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Count label="Jami qator" value={report.totalRows} />
          <Count label={created} value={report.createdRows} tone="text-state-ok" />
          <Count label={updated} value={report.updatedRows} tone="text-brand" />
          <Count label={removed} value={report.removedRows} tone={report.removedRows > 0 ? "text-state-bad" : undefined} />
        </div>
      ) : null}

      {report.errorCount > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-ink">
            Xatolar: {num(report.errorCount)} ta
            {report.errorCount > report.errors.length ? (
              <span className="font-normal text-ink-soft">
                {" "}
                (birinchi {num(report.errors.length)} tasi ko’rsatilgan)
              </span>
            ) : null}
          </p>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-solid border-hairline">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-brand text-[11px] text-white">
                <tr>
                  <th className="w-16 px-2 py-1.5 font-semibold">Qator</th>
                  <th className="w-44 px-2 py-1.5 font-semibold">Ustun</th>
                  <th className="px-2 py-1.5 font-semibold">Xato</th>
                </tr>
              </thead>
              <tbody>
                {report.errors.map((issue, index) => (
                  <tr key={index} className="border-t border-solid border-[#f0f0f0] align-top">
                    <td className="px-2 py-1.5 text-ink-muted tabular-nums">{issue.row ?? "—"}</td>
                    <td className="px-2 py-1.5 wrap-break-word text-ink-muted">{issue.column ?? "—"}</td>
                    <td className="px-2 py-1.5 text-ink">{issue.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {report.warningCount > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-ink">
            Ogohlantirishlar: {num(report.warningCount)} ta
            <span className="font-normal text-ink-soft">
              {" "}
              (yuklashni to’xtatmaydi
              {report.warningCount > report.warnings.length
                ? `; birinchi ${num(report.warnings.length)} tasi ko’rsatilgan`
                : ""}
              )
            </span>
          </p>
          <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {report.warnings.map((issue, index) => (
              <li key={index} className="flex items-start gap-1.5 rounded-lg bg-tint-amber px-2 py-1.5 text-xs text-ink">
                <span className="mt-px shrink-0 text-accent-amber">
                  <Icon icon={TriangleAlert} size={14} />
                </span>
                <span className="min-w-0">
                  {where(issue) ? <span className="font-medium text-ink-muted">{where(issue)}: </span> : null}
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
