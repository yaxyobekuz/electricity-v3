import { buildDemoReport, reportFileName } from "@/lib/reports/demo";
import { renderReportExcel } from "@/lib/reports/excel";
import { renderReportPdf } from "@/lib/reports/pdf";
import { isReportPeriod, type ReportFormat } from "@/lib/reports/types";

const CONTENT_TYPE: Record<ReportFormat, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
};

/**
 * Hisobotni yuklab berish: `/api/reports?period=monthly&format=pdf`.
 *
 * Maket bosqichida mazmun namunaviy (`buildDemoReport`); bazaga ulanganda
 * faqat shu chaqiruv almashtiriladi, fayl generatorlari o'zgarmaydi.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "daily";
  const format = searchParams.get("format") ?? "pdf";

  if (!isReportPeriod(period)) {
    return new Response("Noma’lum hisobot davri", { status: 400 });
  }
  if (format !== "xlsx" && format !== "pdf") {
    return new Response("Noma’lum fayl formati", { status: 400 });
  }

  const report = buildDemoReport(period, new Date());
  const body =
    format === "xlsx" ? await renderReportExcel(report) : renderReportPdf(report);
  const fileName = reportFileName(period, format);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": CONTENT_TYPE[format],
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Length": String(body.length),
      // Hisobot har safar joriy sana bilan shakllanadi.
      "Cache-Control": "no-store",
    },
  });
}
