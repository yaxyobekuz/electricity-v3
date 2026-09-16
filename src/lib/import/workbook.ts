import { Readable } from "node:stream";

import ExcelJS from "exceljs";

import type { TemplateType } from "@/generated/prisma";
import { TEMPLATE_LABEL, TEMPLATE_ORDER } from "@/lib/domain/labels";
import { cleanText } from "@/lib/domain/normalize";
import { MONTHS_UZ } from "@/lib/format";

import { findMonthWord, parseDateText, plainValue, type CellRead, type PlainValue } from "./cells";
import { IssueList } from "./issues";
import {
  type AnyRow,
  type ColumnSpec,
  columnMatches,
  headerKey,
  readField,
  type SourceRow,
  TEMPLATES,
} from "./templates";

/*
 * Bitta Excel faylni o'qish: shablon turini aniqlash, varaq nomidan sanani
 * olish va qatorlarni ustun turlariga ko'ra tekshirish. Bazaga murojaat
 * qilmaydi - oy va bog'liqlik qoidalari `validate.ts` da.
 *
 * Fayl oqim (stream) bilan o'qiladi: o'n minglab qatorli abonentlar fayli
 * butunligicha xotiraga modellashtirilmaydi. Oqim o'quvchi faylni tushunmasa
 * (nostandart zip), odatiy to'liq o'qishga qaytiladi.
 */

/** Yuklanayotgan fayl (API va CLI bir xil beradi). */
export interface ImportFileInput {
  name: string;
  data: Uint8Array;
}

/**
 * O'qilgan qator. `valid = false` bo'lsa, xato bo'lgan maydonlar `null` -
 * bunday qator saqlanmaydi, lekin kalit maydonlari (nomlar) takror va
 * bog'liqlik tekshiruvida ishlatiladi (bitta xato ortidan o'nlab soxta
 * "topilmadi" xatosi chiqmasin).
 */
export interface ParsedRecord<R extends AnyRow = AnyRow> {
  data: { [K in keyof R]: R[K] | null } & { row: number };
  valid: boolean;
}

export interface ParsedFile {
  /** Foydalanuvchi tanlagan tartibdagi o'rni. */
  index: number;
  fileName: string;
  fileSize: number;
  sheetName: string | null;
  templateType: TemplateType | null;
  /** Varaq nomidagi sana (UTC yarim tun). */
  reportDate: Date | null;
  /** Hisobot oyi - `reportDate` oyining 1-kuni. */
  month: Date | null;
  records: ParsedRecord[];
  /** Bo'sh bo'lmagan ma'lumot qatorlari soni. */
  totalRows: number;
  errors: IssueList;
  warnings: IssueList;
  /**
   * Fayl darajasidagi xato (tur / sana aniqlanmadi): bog'liqlik tekshiruvlari
   * bu faylga qo'llanmaydi.
   */
  fatal: boolean;
}

/** Sarlavha qidiriladigan qatorlar: 1..5. */
const HEADER_SEARCH_ROWS = 5;

/** Barcha shablonlardagi sarlavha kalitlari - sarlavha qatorini topish uchun. */
const KNOWN_HEADER_KEYS = new Set(
  TEMPLATE_ORDER.flatMap((type) =>
    TEMPLATES[type].columns.flatMap((column) => [column.header, ...(column.aliases ?? [])].map(headerKey)),
  ),
);

function cellText(value: ExcelJS.CellValue): string | null {
  const plain = plainValue(value);
  if (!plain.ok || plain.value == null) return null;
  return cleanText(plain.value instanceof Date ? plain.value.toISOString() : String(plain.value));
}

/** Qatordagi to'ldirilgan kataklar: ustun raqami -> matn. */
function rowTexts(row: ExcelJS.Row): Map<number, string> {
  const texts = new Map<number, string>();
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    // Birlashtirilgan kataklarning faqat bosh katagi olinadi.
    if (cell.isMerged && cell.master !== cell) return;
    const text = cellText(cell.value);
    if (text) texts.set(colNumber, text);
  });
  return texts;
}

interface Detection {
  type: TemplateType | null;
  /** Spetsifikatsiyadagi ustun -> Excel ustun raqami. */
  columns: Map<ColumnSpec, number>;
  error: string | null;
  unknownHeaders: string[];
}

function detectTemplate(headers: Map<number, string>): Detection {
  const keys = [...headers].map(([colNumber, text]) => ({ colNumber, text, key: headerKey(text) }));

  const candidates = TEMPLATE_ORDER.map((type) => {
    const spec = TEMPLATES[type];
    const columns = new Map<ColumnSpec, number>();
    for (const column of spec.columns) {
      const found = keys.find((item) => columnMatches(column, item.key));
      if (found) columns.set(column, found.colNumber);
    }
    const missing = spec.columns.filter((column) => column.required && !columns.has(column));
    return { type, columns, missing, ratio: columns.size / spec.columns.length };
  });

  const complete = candidates.filter((item) => item.missing.length === 0);
  const empty: Detection = { type: null, columns: new Map(), error: null, unknownHeaders: [] };

  if (complete.length === 0) {
    const best = [...candidates].sort((a, b) => b.ratio - a.ratio)[0];
    if (best && best.ratio >= 0.5) {
      return {
        ...empty,
        error: `Majburiy ustun topilmadi (${TEMPLATE_LABEL[best.type]} shabloni): ${best.missing
          .map((column) => `“${column.header}”`)
          .join(", ")}`,
      };
    }
    return {
      ...empty,
      error:
        "Shablon turi aniqlanmadi: 1–5-qatorlarda hech bir shablonning sarlavhalari topilmadi. Namuna shablonlardan foydalaning",
    };
  }

  const most = Math.max(...complete.map((item) => item.columns.size));
  const top = complete.filter((item) => item.columns.size === most);
  if (top.length > 1) {
    return {
      ...empty,
      error: `Shablon turi noaniq: sarlavhalar bir nechta shablonga mos keladi (${top
        .map((item) => TEMPLATE_LABEL[item.type])
        .join(", ")})`,
    };
  }

  const chosen = top[0];
  const used = new Set(chosen.columns.values());
  const unknownHeaders = keys.filter((item) => !used.has(item.colNumber)).map((item) => item.text);
  return { type: chosen.type, columns: chosen.columns, error: null, unknownHeaders };
}

/* ---------------------------------------------------------------------------
   Varaqni o'qish
   --------------------------------------------------------------------------- */

/**
 * Varaq hodisalari. `sheet` qatorlardan OLDIN ham, KEYIN ham kelishi mumkin:
 * ba'zi fayllarda `workbook.xml` zip ichida varaqlardan keyin turadi va varaq
 * nomi faqat oxirida ma'lum bo'ladi.
 */
type SheetEvent = { kind: "sheet"; name: string; date1904: boolean } | { kind: "row"; row: ExcelJS.Row };

const toBuffer = (data: Uint8Array) => Buffer.from(data.buffer, data.byteOffset, data.byteLength);

/** exceljs oqim o'quvchisining tiplarda yo'q, lekin mavjud maydonlari. */
interface ReaderInternals {
  model?: { sheets?: { name: string; rId: string }[] };
  properties?: { model?: { date1904?: boolean } };
  workbookRels?: { Id: string; Target: string }[];
}

/** Oqim bilan: faqat birinchi varaq (kitobdagi tartib bo'yicha) qatorlari. */
async function* streamSheet(data: Uint8Array): AsyncGenerator<SheetEvent> {
  const reader = new ExcelJS.stream.xlsx.WorkbookReader(Readable.from([toBuffer(data)]), {
    worksheets: "emit",
    sharedStrings: "cache",
    hyperlinks: "ignore",
    // Sana formatini tanish uchun kerak.
    styles: "cache",
    entries: "ignore",
  });
  const internals = reader as unknown as ReaderInternals;
  // `workbook.xml` varaqlardan keyin kelsa, exceljs bo'sh model/xususiyatlarga
  // murojaat qilib yiqiladi - oldindan bo'sh qiymat qo'yiladi (keyin o'zi almashtiradi).
  internals.model ??= { sheets: [] };
  internals.properties ??= {};

  let taken: { name: string; sheetNo: string; named: boolean } | null = null;
  for await (const worksheet of reader) {
    const info = worksheet as unknown as { name: string; id: string | number };
    const sheets = internals.model?.sheets ?? [];
    const named = sheets.length > 0;
    if (taken || (named && info.name !== sheets[0].name)) {
      // Boshqa varaqlar o'qilmaydi, lekin oqim davom etishi uchun o'tkazib yuboriladi.
      for await (const row of worksheet) void row;
      continue;
    }
    taken = { name: info.name, sheetNo: String(info.id), named };
    if (named) yield { kind: "sheet", name: info.name, date1904: Boolean(internals.properties?.model?.date1904) };
    for await (const row of worksheet) yield { kind: "row", row };
  }

  if (!taken || taken.named) return;
  // Varaq nomi endi ma'lum: zip yo'lidagi raqam -> munosabat -> kitobdagi varaq.
  const sheets = internals.model?.sheets ?? [];
  const rel = internals.workbookRels?.find((item) => item.Target.endsWith(`worksheets/sheet${taken.sheetNo}.xml`));
  const sheet = rel ? sheets.find((item) => item.rId === rel.Id) : undefined;
  if (!sheet || sheets[0] !== sheet) {
    // Birinchi varaq emas yoki aniqlab bo'lmadi - to'liq o'qishga qaytiladi.
    throw new Error("Oqimda birinchi varaq aniqlanmadi");
  }
  yield { kind: "sheet", name: sheet.name, date1904: Boolean(internals.properties?.model?.date1904) };
}

/** Zaxira: butun kitobni xotiraga yuklab o'qish. */
async function* loadSheet(data: Uint8Array): AsyncGenerator<SheetEvent> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toBuffer(data) as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const sheet = workbook.worksheets[0];
  if (!sheet) return;
  yield { kind: "sheet", name: sheet.name, date1904: Boolean(workbook.properties?.date1904) };
  const rows: ExcelJS.Row[] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => rows.push(row));
  for (const row of rows) yield { kind: "row", row };
}

class UnreadableFile extends Error {}

/** Birinchi varaqni o'qiydi va qatorlarni tekshiradi. */
export async function parseWorkbook(input: ImportFileInput, index: number): Promise<ParsedFile> {
  try {
    return await parseEvents(input, index, streamSheet(input.data));
  } catch (streamError) {
    if (!(streamError instanceof UnreadableFile)) {
      console.warn("[import] oqim bilan o'qilmadi, to'liq o'qishga qaytildi:", input.name, String(streamError));
    }
    try {
      return await parseEvents(input, index, loadSheet(input.data));
    } catch (error) {
      if (!(error instanceof UnreadableFile)) console.warn("[import] fayl o'qilmadi:", input.name, String(error));
      const result = emptyResult(input, index);
      result.errors.add(null, null, "Fayl o’qilmadi: Excel (.xlsx) fayli emas yoki buzilgan");
      result.fatal = true;
      return result;
    }
  }
}

function emptyResult(input: ImportFileInput, index: number): ParsedFile {
  return {
    index,
    fileName: input.name,
    fileSize: input.data.byteLength,
    sheetName: null,
    templateType: null,
    reportDate: null,
    month: null,
    records: [],
    totalRows: 0,
    errors: new IssueList(),
    warnings: new IssueList(),
    fatal: false,
  };
}

/** Oqimni oxirigacha o'qiydi (natijalar tashlanadi) - exceljs vaqtinchalik fayllarini o'chirsin. */
async function drain(iterator: AsyncIterator<unknown>): Promise<void> {
  try {
    while (!(await iterator.next()).done) {
      // Qatorlar kerak emas.
    }
  } catch {
    // Oqimning o'zi buzilgan - asosiy xato chaqiruvchiga qaytadi.
  }
}

/** Sarlavha aniqlangandan keyingi qator o'quvchisi. */
type RowHandler = (row: ExcelJS.Row) => void;

interface SheetSetup {
  handler: RowHandler;
  /** Sarlavhadan oldingi qatordagi oy nomi (0..11) va qator raqami. */
  title: { month: number; row: number } | null;
}

async function parseEvents(
  input: ImportFileInput,
  index: number,
  events: AsyncGenerator<SheetEvent>,
): Promise<ParsedFile> {
  const result = emptyResult(input, index);
  let sheetFound = false;
  // Qator o'quvchisi shu obyektni ushlaydi - `sheet` hodisasi keyin kelsa ham yangilanadi.
  const context = { date1904: false };
  const early: ExcelJS.Row[] = [];
  let setup: SheetSetup | null = null;
  let stopped = false;

  // Oqim hech qachon yarmida tashlab ketilmaydi: exceljs varaqni vaqtinchalik
  // faylga yozgan bo'lsa (`sharedStrings.xml` zip'da varaqdan keyin kelganda),
  // uni faqat varaq oxirigacha o'qilgach o'chiradi. Shu sabab sarlavha
  // topilmasa ham qolgan qatorlar e'tiborsiz o'qib chiqiladi, kutilmagan xatoda
  // esa oqim oxirigacha "to'kiladi".
  const iterator = events[Symbol.asyncIterator]();
  try {
    for (let next = await iterator.next(); !next.done; next = await iterator.next()) {
      const event = next.value;
      if (event.kind === "sheet") {
        sheetFound = true;
        result.sheetName = event.name;
        context.date1904 = event.date1904;
        continue;
      }
      if (stopped) continue;
      if (!setup) {
        // Sarlavha 1..5-qatorlar orasida - ular yig'ib olinadi.
        if (event.row.number <= HEADER_SEARCH_ROWS) {
          early.push(event.row);
          continue;
        }
        setup = setupSheet(result, early, context);
        if (!setup) {
          stopped = true;
          continue;
        }
      }
      setup.handler(event.row);
    }
  } catch (error) {
    await drain(iterator);
    throw error;
  }

  if (stopped) return result;
  if (!sheetFound) {
    // Varaqsiz zip ham, umuman zip bo'lmagan fayl ham shu yerga tushadi.
    throw new UnreadableFile();
  }
  // Kichik fayl: barcha qatorlar 1..5 ichida.
  setup ??= setupSheet(result, early, context);
  if (!setup || !result.templateType) return result;

  // Hisobot sanasi - varaq nomidan.
  const sheetName = result.sheetName ?? "";
  const reportDate = parseDateText(sheetName);
  if (!reportDate) {
    result.errors.add(
      null,
      null,
      `Varaq nomidan hisobot sanasi o’qilmadi: “${sheetName}” (kutilgan ko’rinish: 13-sentabr, 2026)`,
    );
    result.fatal = true;
  } else {
    result.reportDate = reportDate;
    result.month = new Date(Date.UTC(reportDate.getUTCFullYear(), reportDate.getUTCMonth(), 1));
    // Sarlavha qatoridagi oy nomi varaq oyiga mos kelmasa - ogohlantirish.
    if (setup.title && setup.title.month !== reportDate.getUTCMonth()) {
      result.warnings.add(
        setup.title.row,
        null,
        `Sarlavhadagi oy (${MONTHS_UZ[setup.title.month]}) varaq nomidagi oyga (${MONTHS_UZ[reportDate.getUTCMonth()]}) mos emas`,
      );
    }
  }

  if (result.totalRows === 0 && !TEMPLATES[result.templateType].allowEmpty) {
    result.errors.add(null, null, "Faylda ma’lumot qatori yo’q (sarlavhadan keyingi qatorlar bo’sh)");
    result.fatal = true;
  }
  return result;
}

/**
 * Sarlavha qatorini topadi va shablon turini aniqlaydi. Muvaffaqiyatli
 * bo'lsa - ma'lumot qatorlari o'quvchisini qaytaradi (1..5 dagi sarlavhadan
 * keyingi qatorlar ham shu yerda o'qiladi).
 */
function setupSheet(
  result: ParsedFile,
  early: readonly ExcelJS.Row[],
  context: { date1904: boolean },
): SheetSetup | null {
  const fatal = (message: string, row: number | null = null) => {
    result.errors.add(row, null, message);
    result.fatal = true;
    return null;
  };

  // Sarlavha qatori: 1..5 qatorlardan eng ko'p ma'lum sarlavhasi borasi.
  let headerRow = 0;
  let headerTexts = new Map<number, string>();
  let bestMatches = 0;
  for (const row of early) {
    const texts = rowTexts(row);
    const matches = [...texts.values()].filter((text) => KNOWN_HEADER_KEYS.has(headerKey(text))).length;
    if (matches > bestMatches) {
      bestMatches = matches;
      headerRow = row.number;
      headerTexts = texts;
    }
  }
  if (bestMatches < 2) {
    return fatal(
      "Shablon turi aniqlanmadi: 1–5-qatorlarda ustun sarlavhalari topilmadi. Namuna shablonlardan foydalaning",
    );
  }

  const detection = detectTemplate(headerTexts);
  if (!detection.type) return fatal(detection.error ?? "Shablon turi aniqlanmadi", headerRow);
  result.templateType = detection.type;
  const spec = TEMPLATES[detection.type];

  // Bir xil sarlavha ikki marta - qaysi ustun o'qilishi noaniq.
  const seenHeaders = new Set<string>();
  for (const text of headerTexts.values()) {
    const key = headerKey(text);
    if (!KNOWN_HEADER_KEYS.has(key)) continue;
    if (seenHeaders.has(key)) {
      result.errors.add(headerRow, text, `“${text}” ustuni faylda ikki marta uchraydi`);
      result.fatal = true;
    }
    seenHeaders.add(key);
  }

  for (const text of detection.unknownHeaders) {
    result.warnings.add(
      headerRow,
      text,
      `Shablonda yo’q ustun: “${text}” - qiymatlari faqat qatorning asl nusxasida (manba) saqlanadi`,
    );
  }

  // Sarlavhadan oldingi birinchi oy nomi ("Abonentlar Sentabr Holatiga Ko'ra").
  let title: SheetSetup["title"] = null;
  for (const row of early) {
    if (row.number >= headerRow) break;
    const text = [...rowTexts(row).values()][0];
    const month = text ? findMonthWord(text) : null;
    if (month != null) {
      title = { month, row: row.number };
      break;
    }
  }

  const read = createRowHandler(result, spec.columns, detection.columns, headerTexts, context);
  for (const row of early) {
    if (row.number > headerRow) read(row);
  }
  return {
    title,
    handler: (row) => {
      if (row.number > headerRow) read(row);
    },
  };
}

/** Excel ustun harfi: 1 -> "A", 27 -> "AA". */
function columnLetter(colNumber: number): string {
  let letters = "";
  for (let n = colNumber; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

/**
 * Qatorning asl nusxasi: har bir to'ldirilgan katak sarlavha matni bo'yicha
 * (sarlavhasiz ustun - "Ustun F"). Qiymat o'qilmasa (masalan natijasiz
 * formula) - katakning matn ko'rinishi.
 */
function sourceRowOf(row: ExcelJS.Row, headerTexts: Map<number, string>): SourceRow {
  const source: SourceRow = {};
  row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (cell.isMerged && cell.master !== cell) return;
    const header = headerTexts.get(colNumber)?.replace(/\s+/g, " ").trim() || `Ustun ${columnLetter(colNumber)}`;
    const read = plainValue(cell.value);
    let value: string | number | boolean | null;
    if (read.ok) {
      value = read.value instanceof Date ? read.value.toISOString() : read.value;
    } else {
      value = cellText(cell.value) || null;
    }
    if (value != null) source[header] = value;
  });
  return source;
}

function createRowHandler(
  result: ParsedFile,
  columns: readonly ColumnSpec[],
  positions: Map<ColumnSpec, number>,
  headerTexts: Map<number, string>,
  context: { date1904: boolean },
): RowHandler {
  const mapped = [...positions];
  const lat = columns.find((column) => column.field === "latitude");
  const long = columns.find((column) => column.field === "longitude");
  const location = lat && long ? { lat, long } : null;
  // Katak to'ldirilganmi (qiymati xato bo'lsa ham).
  const isProvided = (read: CellRead<PlainValue> | undefined) => read != null && (!read.ok || read.value != null);

  return (row) => {
    const rowNumber = row.number;
    const raw = new Map<ColumnSpec, CellRead<PlainValue>>();
    let filled = false;
    for (const [column, colNumber] of mapped) {
      const read = plainValue(row.getCell(colNumber).value);
      raw.set(column, read);
      if (!read.ok || read.value != null) filled = true;
    }
    // To'liq bo'sh qator o'tkazib yuboriladi.
    if (!filled) return;

    result.totalRows += 1;
    const data: Record<string, unknown> = { row: rowNumber, sourceRow: sourceRowOf(row, headerTexts) };
    let valid = true;

    for (const column of columns) {
      const read = raw.get(column);
      if (!read) {
        // Ixtiyoriy ustun faylda yo'q.
        const type = column.type;
        data[column.field] = (type.kind === "number" || type.kind === "integer") && type.emptyAsZero ? 0 : null;
        continue;
      }
      const parsed = read.ok ? readField(column.type, read.value, context) : read;
      if (!parsed.ok) {
        result.errors.add(rowNumber, column.header, parsed.message);
        data[column.field] = null;
        valid = false;
        continue;
      }
      if (parsed.value == null && column.required) {
        result.errors.add(rowNumber, column.header, "Majburiy katak bo’sh");
        valid = false;
      }
      data[column.field] = parsed.value;
    }

    // Lat va Long faqat birga.
    if (location) {
      const latGiven = isProvided(raw.get(location.lat));
      const longGiven = isProvided(raw.get(location.long));
      if (latGiven !== longGiven) {
        const missing = latGiven ? location.long.header : location.lat.header;
        result.errors.add(rowNumber, missing, `${missing} bo’sh: Lat va Long birga berilishi kerak`);
        valid = false;
      }
    }

    result.records.push({ data: data as ParsedRecord["data"], valid });
  };
}
