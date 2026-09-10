import ExcelJS from "exceljs";

import { formatNumber } from "./demo";
import type { FeederReport } from "./types";

/* Excel varianti: PDF bilan bir xil mazmun, lekin ustunlar bo'yicha
   filtrlanadigan va formulalar bilan ishlatsa bo'ladigan jonli jadval. */

const BRAND = "FF007CD2";
const BRAND_DEEP = "FF0A4F86";
const WHITE = "FFFFFFFF";
const INK = "FF333333";
const INK_SOFT = "FF8A8A8A";
const ZEBRA = "FFF7F9FB";
const HAIRLINE = "FFE4E4E7";
const TINTS = ["FFEFF6FF", "FFEFFFF0", "FFFFEFEF", "FFFEEFFF", "FFF3EFFF", "FFFFF5EF"];
const ACCENTS = ["FF3B82F6", "FF22C55E", "FFFF383C", "FFCB30E0", "FF6155F5", "FFAC7F5E"];

const NUMBER_FORMAT = "#,##0.0";
const PERCENT_FORMAT = "0.00";

type Sheet = ExcelJS.Worksheet;

function fill(cell: ExcelJS.Cell, argb: string): void {
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function bottomBorder(cell: ExcelJS.Cell, argb = HAIRLINE): void {
  cell.border = { bottom: { style: "thin", color: { argb } } };
}

/** Varaq tepasidagi brend sarlavhasi. */
function titleBand(sheet: Sheet, report: FeederReport, lastColumn: string, subtitle: string): number {
  sheet.mergeCells(`A1:${lastColumn}1`);
  const title = sheet.getCell("A1");
  title.value = `${report.feeder} — ${report.title}`;
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

function tableHeader(sheet: Sheet, row: number, labels: string[]): number {
  const target = sheet.getRow(row);
  labels.forEach((label, index) => {
    const cell = target.getCell(index + 1);
    cell.value = label;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
    cell.alignment = { vertical: "middle", horizontal: index === 0 ? "left" : "right" };
    fill(cell, BRAND);
  });
  target.height = 22;
  return row + 1;
}

function tableRow(
  sheet: Sheet,
  row: number,
  values: Array<string | number>,
  options: { zebra?: boolean; formats?: Array<string | undefined> } = {},
): number {
  const target = sheet.getRow(row);
  values.forEach((value, index) => {
    const cell = target.getCell(index + 1);
    cell.value = value;
    cell.font = {
      name: "Calibri",
      size: 10,
      bold: index === 0,
      color: { argb: index === 0 ? INK : "FF555555" },
    };
    cell.alignment = { vertical: "middle", horizontal: index === 0 ? "left" : "right" };
    const format = options.formats?.[index];
    if (format) cell.numFmt = format;
    if (options.zebra) fill(cell, ZEBRA);
    bottomBorder(cell);
  });
  target.height = 18;
  return row + 1;
}

function totalsRow(sheet: Sheet, row: number, values: Array<string | number>): number {
  const target = sheet.getRow(row);
  values.forEach((value, index) => {
    const cell = target.getCell(index + 1);
    cell.value = value;
    cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: index === 0 ? "left" : "right" };
    if (typeof value === "number") cell.numFmt = index === 4 ? PERCENT_FORMAT : NUMBER_FORMAT;
    fill(cell, "FFEEF6FD");
    cell.border = { top: { style: "medium", color: { argb: BRAND } } };
  });
  target.height = 22;
  return row + 2;
}

function summaryBlock(sheet: Sheet, startRow: number, report: FeederReport): number {
  let row = startRow;

  for (let index = 0; index < report.summary.length; index += 3) {
    const group = report.summary.slice(index, index + 3);
    const labelRow = sheet.getRow(row);
    const valueRow = sheet.getRow(row + 1);
    const hintRow = sheet.getRow(row + 2);

    group.forEach((item, column) => {
      const position = column * 2 + 1;
      const tint = TINTS[index + column];
      const accent = ACCENTS[index + column];

      sheet.mergeCells(row, position, row, position + 1);
      sheet.mergeCells(row + 1, position, row + 1, position + 1);
      sheet.mergeCells(row + 2, position, row + 2, position + 1);

      const label = labelRow.getCell(position);
      label.value = item.label;
      label.font = { name: "Calibri", size: 9, color: { argb: "FF555555" } };
      label.alignment = { vertical: "middle", indent: 1 };

      const value = valueRow.getCell(position);
      value.value = item.value;
      value.font = { name: "Calibri", size: 14, bold: true, color: { argb: INK } };
      value.alignment = { vertical: "middle", indent: 1 };

      const hint = hintRow.getCell(position);
      hint.value = item.hint;
      hint.font = {
        name: "Calibri",
        size: 8,
        color: { argb: item.positive ? "FF31AE5F" : "FFCF4646" },
      };
      hint.alignment = { vertical: "middle", indent: 1 };

      [label, value, hint].forEach((cell) => fill(cell, tint));
      // Kartaning chap chetidagi rangli chiziq.
      [labelRow, valueRow, hintRow].forEach((sheetRow) => {
        const edge = sheetRow.getCell(position);
        edge.border = { left: { style: "medium", color: { argb: accent } } };
      });
    });

    labelRow.height = 16;
    valueRow.height = 22;
    hintRow.height = 14;
    row += 4;
  }

  return row;
}

export async function renderReportExcel(report: FeederReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Elektr energiyasi analitik platformasi";
  workbook.created = new Date();

  /* --- 1-varaq: umumiy ko'rsatkichlar va dinamika --- */
  const main = workbook.addWorksheet("Hisobot", {
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1 },
  });
  main.columns = [
    { width: 18 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 14 },
  ];

  let row = titleBand(
    main,
    report,
    "F",
    `${report.substation}  ·  Davr: ${report.range}  ·  Shakllantirildi: ${report.generatedAt}`,
  );

  row = sectionTitle(main, row, "Umumiy ko’rsatkichlar", "F");
  row = summaryBlock(main, row, report);
  row += 1;

  row = sectionTitle(main, row, "Iste’mol dinamikasi", "F");
  const seriesHeaderRow = row;
  row = tableHeader(main, row, [
    report.seriesColumn,
    "Hisoblangan",
    "Iste’mol",
    "Yo’qotish",
    "Ulush, %",
  ]);

  const seriesFormats = [undefined, NUMBER_FORMAT, NUMBER_FORMAT, NUMBER_FORMAT, PERCENT_FORMAT];
  report.series.forEach((item, index) => {
    row = tableRow(
      main,
      row,
      [
        item.label,
        item.billed,
        item.consumed,
        item.loss,
        (item.loss / item.billed) * 100,
      ],
      { zebra: index % 2 === 1, formats: seriesFormats },
    );
  });

  const billed = report.series.reduce((sum, item) => sum + item.billed, 0);
  const consumed = report.series.reduce((sum, item) => sum + item.consumed, 0);
  const loss = report.series.reduce((sum, item) => sum + item.loss, 0);
  row = totalsRow(main, row, ["Jami", billed, consumed, loss, (loss / billed) * 100]);

  // Sarlavha qatori doim ko'rinib tursin va filtrlansin.
  main.views = [
    { state: "frozen", ySplit: seriesHeaderRow, showGridLines: false },
  ];
  main.autoFilter = {
    from: { row: seriesHeaderRow, column: 1 },
    to: { row: seriesHeaderRow + report.series.length, column: 5 },
  };

  /* --- 2-varaq: transformatorlar --- */
  const transformers = workbook.addWorksheet("Transformatorlar", {
    views: [{ showGridLines: false }],
  });
  transformers.columns = [
    { width: 18 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
  ];
  let tRow = titleBand(transformers, report, "E", `Transformatorlar kesimi · ${report.range}`);
  tRow = tableHeader(transformers, tRow, [
    "Transformator",
    "Holat",
    "Hisoblangan",
    "Iste’mol",
    "Yo’qotish",
  ]);
  report.transformers.forEach((item, index) => {
    tRow = tableRow(
      transformers,
      tRow,
      [item.name, item.status, item.billed, item.consumed, item.loss],
      { zebra: index % 2 === 1, formats: [undefined, undefined, NUMBER_FORMAT, NUMBER_FORMAT, NUMBER_FORMAT] },
    );
  });

  /* --- 3-varaq: qoidabuzarliklar va ishlar --- */
  const other = workbook.addWorksheet("Qoidabuzarlik va ishlar", {
    views: [{ showGridLines: false }],
  });
  other.columns = [{ width: 22 }, { width: 34 }, { width: 18 }, { width: 16 }];

  let oRow = titleBand(other, report, "D", `Qoidabuzarliklar va ishlar · ${report.range}`);
  oRow = sectionTitle(other, oRow, "Qoidabuzarliklar", "D");
  oRow = tableHeader(other, oRow, ["Turi", "Soni", "Undirilgan summa", ""]);
  report.violations.forEach((item, index) => {
    oRow = tableRow(other, oRow, [item.kind, `${item.count} ta`, item.amount, ""], {
      zebra: index % 2 === 1,
    });
  });

  oRow += 1;
  oRow = sectionTitle(other, oRow, "Ishlar", "D");
  oRow = tableHeader(other, oRow, ["Transformator", "Ish", "Sana", "Holat"]);
  report.works.forEach((item, index) => {
    oRow = tableRow(other, oRow, [item.transformer, item.work, item.date, item.status], {
      zebra: index % 2 === 1,
    });
  });

  oRow += 1;
  const signature = other.getCell(`A${oRow}`);
  signature.value = `Mas’ul xodim: ${report.responsible}`;
  signature.font = { name: "Calibri", size: 10, color: { argb: INK_SOFT } };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Namuna qiymatlarni matnga o'girish - PDF bilan bir xil ko'rinish uchun. */
export const formatForExcel = formatNumber;
