import ExcelJS from "exceljs";

import { NOT_UPLOADED, type ReportSeriesRow, type ReportTone, type ScopeReport } from "./types";

/* Excel varianti: PDF bilan bir xil mazmun, lekin sonlar haqiqiy raqam -
   ustunlarni filtrlash va formulalar bilan ishlatish mumkin. */

const BRAND = "FF007CD2";
const BRAND_DEEP = "FF0A4F86";
const WHITE = "FFFFFFFF";
const INK = "FF333333";
const INK_MUTED = "FF555555";
const INK_SOFT = "FF8A8A8A";
const ZEBRA = "FFF7F9FB";
const HAIRLINE = "FFE4E4E7";
const TINTS = ["FFEFF6FF", "FFEFFFF0", "FFFFEFEF", "FFFEEFFF", "FFF3EFFF", "FFFFF5EF"];
const ACCENTS = ["FF3B82F6", "FF22C55E", "FFFF383C", "FFCB30E0", "FF6155F5", "FFAC7F5E"];

const TONE_COLOR: Record<ReportTone, string> = {
  good: "FF31AE5F",
  bad: "FFCF4646",
  neutral: INK_SOFT,
};

const KWH_FORMAT = "#,##0.00";
const INTEGER_FORMAT = "#,##0";
const PERCENT_FORMAT = "0.00";

type Sheet = ExcelJS.Worksheet;
type CellValue = string | number | null;

function fill(cell: ExcelJS.Cell, argb: string): void {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Varaq tepasidagi brend sarlavhasi. Keyingi bo'sh qator raqamini qaytaradi. */
function titleBand(sheet: Sheet, report: ScopeReport, lastColumn: string, subtitle: string): number {
  sheet.mergeCells(`A1:${lastColumn}1`);
  const title = sheet.getCell("A1");
  title.value = `${report.scopeName} — ${report.title}`;
  title.font = { name: "Calibri", size: 18, bold: true, color: { argb: WHITE } };
  title.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  fill(title, BRAND);
  sheet.getRow(1).height = 34;

  sheet.mergeCells(`A2:${lastColumn}2`);
  const meta = sheet.getCell("A2");
  meta.value = subtitle;
  meta.font = { name: "Calibri", size: 10, color: { argb: WHITE } };
  meta.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  fill(meta, BRAND_DEEP);
  sheet.getRow(2).height = 20;

  return 4;
}

function sectionTitle(sheet: Sheet, row: number, text: string, lastColumn: string): number {
  sheet.mergeCells(`A${row}:${lastColumn}${row}`);
  const cell = sheet.getCell(`A${row}`);
  cell.value = text;
  cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: INK } };
  cell.alignment = { vertical: "middle" };
  sheet.getRow(row).height = 24;
  return row + 1;
}

/** Bo'sh bo'lim: bitta kulrang qator. */
function emptyRow(sheet: Sheet, row: number, text: string, lastColumn: string): number {
  sheet.mergeCells(`A${row}:${lastColumn}${row}`);
  const cell = sheet.getCell(`A${row}`);
  cell.value = text;
  cell.font = { name: "Calibri", size: 10, italic: true, color: { argb: INK_SOFT } };
  cell.alignment = { vertical: "middle", indent: 1 };
  fill(cell, ZEBRA);
  sheet.getRow(row).height = 20;
  return row + 2;
}

/** `textColumns` - chapga tekislanadigan (matnli) birinchi ustunlar soni. */
function tableHeader(sheet: Sheet, row: number, labels: string[], textColumns = 1): number {
  const target = sheet.getRow(row);
  labels.forEach((label, index) => {
    const cell = target.getCell(index + 1);
    cell.value = label;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle", horizontal: index < textColumns ? "left" : "right", wrapText: true };
    fill(cell, BRAND);
  });
  target.height = 30;
  return row + 1;
}

interface RowOptions {
  zebra?: boolean;
  formats?: Array<string | undefined>;
  textColumns?: number;
  totals?: boolean;
}

function tableRow(sheet: Sheet, row: number, values: CellValue[], options: RowOptions = {}): number {
  const target = sheet.getRow(row);
  const textColumns = options.textColumns ?? 1;
  values.forEach((value, index) => {
    const cell = target.getCell(index + 1);
    cell.value = value;
    cell.font = options.totals
      ? { name: "Calibri", size: 10, bold: true, color: { argb: BRAND } }
      : { name: "Calibri", size: 10, bold: index === 0, color: { argb: index === 0 ? INK : INK_MUTED } };
    cell.alignment = { vertical: "middle", horizontal: index < textColumns ? "left" : "right" };
    const format = options.formats?.[index];
    if (format) cell.numFmt = format;
    if (options.totals) {
      fill(cell, "FFEEF6FD");
      cell.border = { top: { style: "medium", color: { argb: BRAND } } };
    } else {
      if (options.zebra) fill(cell, ZEBRA);
      cell.border = { bottom: { style: "thin", color: { argb: HAIRLINE } } };
    }
  });
  target.height = options.totals ? 22 : 18;
  return row + 1;
}

function summaryBlock(sheet: Sheet, startRow: number, report: ScopeReport): number {
  let row = startRow;

  for (let index = 0; index < report.summary.length; index += 3) {
    const group = report.summary.slice(index, index + 3);
    const labelRow = sheet.getRow(row);
    const valueRow = sheet.getRow(row + 1);
    const hintRow = sheet.getRow(row + 2);

    group.forEach((item, column) => {
      const position = column * 2 + 1;
      const tint = TINTS[(index + column) % TINTS.length];
      const accent = ACCENTS[(index + column) % ACCENTS.length];

      sheet.mergeCells(row, position, row, position + 1);
      sheet.mergeCells(row + 1, position, row + 1, position + 1);
      sheet.mergeCells(row + 2, position, row + 2, position + 1);

      const label = labelRow.getCell(position);
      label.value = item.label;
      label.font = { name: "Calibri", size: 9, color: { argb: INK_MUTED } };
      label.alignment = { vertical: "middle", indent: 1 };

      const value = valueRow.getCell(position);
      value.value = item.value;
      value.font = { name: "Calibri", size: 14, bold: true, color: { argb: INK } };
      value.alignment = { vertical: "middle", indent: 1 };

      const hint = hintRow.getCell(position);
      hint.value = item.hint;
      hint.font = { name: "Calibri", size: 8, color: { argb: TONE_COLOR[item.tone] } };
      hint.alignment = { vertical: "middle", indent: 1 };

      [label, value, hint].forEach((cell) => fill(cell, tint));
      // Kartaning chap chetidagi rangli chiziq.
      [labelRow, valueRow, hintRow].forEach((sheetRow) => {
        sheetRow.getCell(position).border = { left: { style: "medium", color: { argb: accent } } };
      });
    });

    labelRow.height = 16;
    valueRow.height = 22;
    hintRow.height = 14;
    row += 4;
  }

  return row;
}

const SERIES_FORMATS = [undefined, KWH_FORMAT, KWH_FORMAT, KWH_FORMAT, PERCENT_FORMAT];

function seriesValues(row: ReportSeriesRow): CellValue[] {
  return [row.label, row.totalKwh, row.usefulKwh, row.lossKwh, row.lossPercent];
}

export async function renderReportExcel(report: ScopeReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Elektr energiyasi analitik platformasi";
  workbook.created = new Date();

  const subtitle = [
    report.scopeContext,
    `Davr: ${report.periodLabel}`,
    `Ma’lumot holati: ${report.reportDate}`,
    `Shakllantirildi: ${report.generatedAt}`,
  ].join("  ·  ");

  /* --- 1-varaq: umumiy ko'rsatkichlar va oqim jadvali --- */
  const main = workbook.addWorksheet("Hisobot", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  main.columns = [{ width: 26 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 14 }];

  let row = titleBand(main, report, "F", subtitle);
  row = sectionTitle(main, row, `Umumiy ko’rsatkichlar · ${report.monthLabel}`, "F");
  row = summaryBlock(main, row, report);
  row += 1;

  row = sectionTitle(main, row, report.series.title, "F");
  const seriesRows = report.series.rows;
  if (seriesRows == null || seriesRows.length === 0) {
    row = emptyRow(main, row, seriesRows == null ? NOT_UPLOADED : report.series.emptyText, "F");
  } else {
    const headerRow = row;
    row = tableHeader(main, row, [
      report.series.column,
      "Umumiy oqim, kWh",
      "Foydali oqim, kWh",
      "Yo’qotish, kWh",
      "Ulush, %",
    ]);
    seriesRows.forEach((item, index) => {
      row = tableRow(main, row, seriesValues(item), { zebra: index % 2 === 1, formats: SERIES_FORMATS });
    });
    // Filtr faqat ma'lumot qatorlarini qamraydi - "Jami" saralanib ketmasin.
    main.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + seriesRows.length, column: 5 },
    };
    if (report.series.totals) {
      row = tableRow(main, row, seriesValues(report.series.totals), { formats: SERIES_FORMATS, totals: true });
    }
    row += 1;
  }

  if (report.responsible) {
    const signature = main.getCell(`A${row}`);
    signature.value = `Mas’ul xodim: ${report.responsible}`;
    signature.font = { name: "Calibri", size: 10, color: { argb: INK_SOFT } };
  }

  /* --- 2-varaq: transformatorlar --- */
  const transformers = workbook.addWorksheet("Transformatorlar", {
    views: [{ showGridLines: false }],
  });
  transformers.columns = [
    { width: 16 },
    { width: 20 },
    { width: 20 },
    { width: 18 },
    { width: 18 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
  ];
  let tRow = titleBand(transformers, report, "H", `Transformatorlar · ${report.monthLabel}  ·  ${report.scopeName}`);
  const tpRows = report.transformers;
  if (tpRows == null || tpRows.length === 0) {
    emptyRow(transformers, tRow, tpRows == null ? NOT_UPLOADED : "Shu oyda TP yo’q", "H");
  } else {
    // Jadval sarlavhasi (va undan yuqoridagi brend qatorlari) doim ko'rinib tursin.
    transformers.views = [{ state: "frozen", ySplit: tRow, showGridLines: false }];
    const headerRow = tRow;
    tRow = tableHeader(
      transformers,
      tRow,
      ["TP", "Podstansiya", "Fider", "Umumiy oqim, kWh", "Foydali oqim, kWh", "Yo’qotish, kWh", "Ulush, %", "Abonentlar"],
      3,
    );
    tpRows.forEach((item, index) => {
      tRow = tableRow(
        transformers,
        tRow,
        [item.name, item.substation, item.feeder, item.totalKwh, item.usefulKwh, item.lossKwh, item.lossPercent, item.subscribers],
        {
          zebra: index % 2 === 1,
          textColumns: 3,
          formats: [undefined, undefined, undefined, KWH_FORMAT, KWH_FORMAT, KWH_FORMAT, PERCENT_FORMAT, INTEGER_FORMAT],
        },
      );
    });
    transformers.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow + tpRows.length, column: 8 },
    };
  }

  /* --- 3-varaq: qoidabuzarliklar va murojaatlar --- */
  const other = workbook.addWorksheet("Qoidabuzarlik va murojaat", {
    views: [{ showGridLines: false }],
  });
  other.columns = [{ width: 26 }, { width: 12 }, { width: 24 }, { width: 22 }];

  let oRow = titleBand(other, report, "D", `Qoidabuzarliklar va murojaatlar · ${report.monthLabel}  ·  ${report.scopeName}`);
  oRow = sectionTitle(other, oRow, "Qoidabuzarliklar", "D");
  if (report.violations == null) {
    oRow = emptyRow(other, oRow, NOT_UPLOADED, "D");
  } else {
    const formats = [undefined, INTEGER_FORMAT, KWH_FORMAT, KWH_FORMAT];
    oRow = tableHeader(other, oRow, ["Turi", "Soni", "Keltirilgan zarar, so’m", "Taxminiy zarar, kWh"]);
    report.violations.rows.forEach((item, index) => {
      oRow = tableRow(other, oRow, [item.label, item.count, item.damageUzs, item.damageKwh], {
        zebra: index % 2 === 1,
        formats,
      });
    });
    const total = report.violations.total;
    oRow = tableRow(other, oRow, [total.label, total.count, total.damageUzs, total.damageKwh], {
      formats,
      totals: true,
    });
    oRow += 1;
  }

  oRow = sectionTitle(other, oRow, "Murojaatlar", "D");
  if (report.appeals == null) {
    emptyRow(other, oRow, NOT_UPLOADED, "D");
  } else {
    const formats = [undefined, INTEGER_FORMAT];
    oRow = tableHeader(other, oRow, ["Holati", "Soni"]);
    report.appeals.rows.forEach((item, index) => {
      oRow = tableRow(other, oRow, [item.label, item.count], { zebra: index % 2 === 1, formats });
    });
    tableRow(other, oRow, [report.appeals.total.label, report.appeals.total.count], { formats, totals: true });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
