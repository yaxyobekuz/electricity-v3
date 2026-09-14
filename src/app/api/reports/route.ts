import type { NextRequest } from "next/server";

import { getPeriodsUntil, getSelectedPeriod, listPeriods, type PeriodInfo } from "@/lib/period";
import { buildScopeReport } from "@/lib/queries/reports-data";
import { renderReportExcel } from "@/lib/reports/excel";
import { renderReportPdf } from "@/lib/reports/pdf";
import { contentDisposition } from "@/lib/reports/text";
import { isReportFormat, isReportPeriod, type ReportFormat } from "@/lib/reports/types";
import { parseScopeParam } from "@/lib/scope-param";

const CONTENT_TYPE: Record<ReportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/** Yillik hisobot qamraydigan eng ko'p oylar soni. */
const YEARLY_MONTHS = 12;

function textResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Hisobotni yuklab berish:
 *
 *   GET /api/reports?period=monthly|yearly&format=xlsx|pdf&scope=<kind>:<id>&month=YYYY-MM
 *
 *   - `period` - faqat "monthly" / "yearly"; boshqa qiymat yoki yo'q - 400;
 *   - `format` - faqat "xlsx" / "pdf"; boshqa qiymat yoki yo'q - 400;
 *   - `scope`  - yo'q bo'lsa tuman; `substation|feeder|transformer:<id>` dan
 *                boshqa ko'rinish - 400; obyekt bazada topilmasa - 404;
 *   - `month`  - yo'q bo'lsa tanlangan oy (cookie); bazada bo'lmagan yoki
 *                noto'g'ri oy - 404.
 *
 * Mazmun faqat shablon ma'lumotidan: `buildScopeReport` (`src/lib/queries/reports-data.ts`).
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    return await handle(request);
  } catch (error) {
    // Ichki xato tafsiloti javobga chiqarilmaydi - faqat server jurnaliga.
    console.error("[api/reports]", error);
    return textResponse(500, "Hisobotni shakllantirishda xatolik yuz berdi");
  }
}

async function handle(request: NextRequest): Promise<Response> {
  const params = request.nextUrl.searchParams;

  const period = params.get("period") ?? "";
  if (!isReportPeriod(period)) return textResponse(400, "Hisobot davri noto’g’ri: monthly yoki yearly");

  const format = params.get("format") ?? "";
  if (!isReportFormat(format)) return textResponse(400, "Fayl formati noto’g’ri: xlsx yoki pdf");

  const rawScope = params.get("scope") ?? "";
  const scope = parseScopeParam(rawScope);
  // `parseScopeParam` noto'g'ri qiymatni jimgina tumanga aylantiradi - hisobotda
  // bu boshqa obyekt ma'lumotini berib qo'yardi, shuning uchun rad etiladi.
  if (scope.kind === "district" && rawScope !== "") return textResponse(400, "Qamrov noto’g’ri");

  const monthParam = params.get("month");
  let selected: PeriodInfo | null;
  if (monthParam != null) {
    selected = (await listPeriods()).find((item) => item.key === monthParam) ?? null;
    if (!selected) return textResponse(404, "Bu oy uchun ma’lumot yuklanmagan");
  } else {
    selected = await getSelectedPeriod();
    if (!selected) return textResponse(404, "Ma’lumot hali yuklanmagan");
  }

  const history = period === "yearly" ? await getPeriodsUntil(selected, YEARLY_MONTHS) : [selected];
  const report = await buildScopeReport({
    scope,
    reportPeriod: period,
    period: selected,
    history,
    now: new Date(),
  });
  if (!report) return textResponse(404, "Obyekt topilmadi");

  const body = format === "xlsx" ? await renderReportExcel(report) : renderReportPdf(report);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPE[format],
      "Content-Disposition": contentDisposition(
        `${report.fileName.ascii}.${format}`,
        `${report.fileName.unicode}.${format}`,
      ),
      "Content-Length": String(body.length),
      // Hisobot har safar joriy ma'lumot va vaqt bilan shakllanadi.
      "Cache-Control": "no-store",
    },
  });
}
