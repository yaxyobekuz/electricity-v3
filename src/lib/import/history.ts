import type { TemplateType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { TEMPLATE_ORDER } from "@/lib/domain/labels";
import { monthKey, monthLabel } from "@/lib/format";

import { storedIssueTotal } from "./issues";
import type { CoverageCell, CoverageRow, ImportHistoryItem } from "./types";

/*
 * `/imports` sahifasi uchun: yuklash tarixi va qamrov matritsasi
 * (oylar x shablonlar). Mijozga faqat oddiy (serializable) obyekt boradi.
 */

/** `errors` / `warnings` JSON ustunining xulosasi (ro'yxatning o'zi o'qilmaydi). */
interface IssueSummaryRow {
  id: string;
  errorLength: number;
  firstError: string | null;
  lastErrorMessage: string | null;
  lastErrorRowIsNull: boolean | null;
  warningLength: number;
  lastWarningMessage: string | null;
  lastWarningRowIsNull: boolean | null;
}

/**
 * Har bir yuklash uchun xato/ogohlantirishlar soni va birinchi xato matni -
 * JSON ro'yxatlari (faylga 500 tagacha) SQL ichida xulosalanadi.
 */
async function issueSummaries(ids: readonly string[]): Promise<Map<string, IssueSummaryRow>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<IssueSummaryRow[]>`
    SELECT
      "id",
      CASE WHEN jsonb_typeof("errors") = 'array' THEN jsonb_array_length("errors") ELSE 0 END AS "errorLength",
      CASE WHEN jsonb_typeof("errors") = 'array' THEN "errors" -> 0 ->> 'message' END AS "firstError",
      CASE WHEN jsonb_typeof("errors") = 'array' THEN "errors" -> -1 ->> 'message' END AS "lastErrorMessage",
      CASE WHEN jsonb_typeof("errors") = 'array' THEN ("errors" -> -1 ->> 'row') IS NULL END AS "lastErrorRowIsNull",
      CASE WHEN jsonb_typeof("warnings") = 'array' THEN jsonb_array_length("warnings") ELSE 0 END AS "warningLength",
      CASE WHEN jsonb_typeof("warnings") = 'array' THEN "warnings" -> -1 ->> 'message' END AS "lastWarningMessage",
      CASE WHEN jsonb_typeof("warnings") = 'array' THEN ("warnings" -> -1 ->> 'row') IS NULL END AS "lastWarningRowIsNull"
    FROM "import_batches"
    WHERE "id" = ANY(${[...ids]}::text[])
  `;
  return new Map(rows.map((row) => [row.id, row]));
}

const lastIssue = (message: string | null, rowIsNull: boolean | null) =>
  message == null ? null : { message, hasRow: !rowIsNull };

/** Oxirgi yuklashlar, yangidan eskiga. */
export async function listImportHistory(limit = 50): Promise<ImportHistoryItem[]> {
  const rows = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      templateType: true,
      status: true,
      fileName: true,
      fileSize: true,
      sheetName: true,
      reportDate: true,
      totalRows: true,
      createdRows: true,
      updatedRows: true,
      removedRows: true,
      createdAt: true,
    },
  });
  const summaries = await issueSummaries(rows.map((row) => row.id));

  return rows.map((row) => {
    const summary = summaries.get(row.id);
    return {
      id: row.id,
      templateType: row.templateType,
      status: row.status,
      fileName: row.fileName,
      fileSize: row.fileSize,
      sheetName: row.sheetName,
      month: row.reportDate ? monthKey(row.reportDate) : null,
      reportDate: row.reportDate?.toISOString() ?? null,
      totalRows: row.totalRows,
      createdRows: row.createdRows,
      updatedRows: row.updatedRows,
      removedRows: row.removedRows,
      errorCount: summary
        ? storedIssueTotal(summary.errorLength, lastIssue(summary.lastErrorMessage, summary.lastErrorRowIsNull))
        : 0,
      warningCount: summary
        ? storedIssueTotal(summary.warningLength, lastIssue(summary.lastWarningMessage, summary.lastWarningRowIsNull))
        : 0,
      firstError: summary?.firstError ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

const emptyCell = (): CoverageCell => ({ status: null, reportDate: null, totalRows: null, createdAt: null });

/**
 * Qamrov: har bir davr uchun har bir shablonning oxirgi muvaffaqiyatli
 * yuklashi. Muvaffaqiyatli yuklash bo'lmasa - oxirgi muvaffaqiyatsiz urinish.
 */
export async function getImportCoverage(): Promise<CoverageRow[]> {
  const periods = await prisma.period.findMany({
    orderBy: { month: "desc" },
    select: { id: true, month: true, reportDate: true },
  });
  if (periods.length === 0) return [];

  const batches = await prisma.importBatch.findMany({
    where: { periodId: { in: periods.map((period) => period.id) } },
    orderBy: { createdAt: "desc" },
    select: {
      periodId: true,
      templateType: true,
      status: true,
      reportDate: true,
      totalRows: true,
      createdAt: true,
    },
  });

  return periods.map((period) => {
    const cells = Object.fromEntries(TEMPLATE_ORDER.map((type) => [type, emptyCell()])) as Record<
      TemplateType,
      CoverageCell
    >;
    for (const batch of batches) {
      if (batch.periodId !== period.id) continue;
      const cell = cells[batch.templateType];
      // Yangidan eskiga: birinchi COMPLETED - joriy ma'lumot manbasi.
      if (cell.status === "COMPLETED") continue;
      if (cell.status === "FAILED" && batch.status === "FAILED") continue;
      cells[batch.templateType] = {
        status: batch.status,
        reportDate: batch.reportDate?.toISOString() ?? null,
        totalRows: batch.totalRows,
        createdAt: batch.createdAt.toISOString(),
      };
    }
    return {
      periodId: period.id,
      month: monthKey(period.month),
      label: monthLabel(period.month),
      reportDate: period.reportDate.toISOString(),
      cells,
    };
  });
}
