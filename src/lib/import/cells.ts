import type { CellValue } from "exceljs";

import { cleanText } from "@/lib/domain/normalize";

/*
 * Excel katagini o'qish. Qoidalar: `.claude/docs/shablonlar.md`,
 * "Katak qiymatlarini o'qish".
 *
 * Har bir o'quvchi `{ ok: true, value }` yoki `{ ok: false, message }`
 * qaytaradi; bo'sh katak - `value: null` (majburiylikni chaqiruvchi tekshiradi).
 */

export type CellRead<T> = { ok: true; value: T | null } | { ok: false; message: string };

/** Formula va boy matndan tozalangan oddiy qiymat. */
export type PlainValue = string | number | boolean | Date;

const ok = <T>(value: T | null): CellRead<T> => ({ ok: true, value });
const fail = <T>(message: string): CellRead<T> => ({ ok: false, message });

/** Xabarlarda qiymatni qisqa ko'rsatish. */
export function preview(value: PlainValue): string {
  if (value instanceof Date) return formatPlainDate(value);
  const text = String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

function formatPlainDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${date.getUTCFullYear()}`;
}

/**
 * Katak qiymatini oddiy qiymatga aylantiradi: formula -> `result`,
 * richText / hyperlink -> matn. Bo'sh (yoki faqat bo'shliq) - null.
 */
export function plainValue(value: CellValue): CellRead<PlainValue> {
  if (value == null) return ok(null);
  if (typeof value === "string") {
    return ok(value.trim() === "" ? null : value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? ok(value) : fail("Son noto’g’ri");
  }
  if (typeof value === "boolean" || value instanceof Date) return ok(value);

  if ("error" in value) return fail(`Katakda Excel xatosi: ${value.error}`);
  if ("formula" in value || "sharedFormula" in value) {
    const result = value.result;
    if (result === undefined || result === null) {
      return fail("Formula natijasi yo’q (faylni Excel’da ochib, qayta saqlang)");
    }
    if (typeof result === "object" && !(result instanceof Date) && "error" in result) {
      return fail(`Formula xatosi: ${result.error}`);
    }
    if (typeof result === "number" && !Number.isFinite(result)) {
      // Oqim o'quvchisi mantiqiy/xato natijani son sifatida o'qiy olmaydi.
      return fail("Formula natijasi son emas (xato yoki mantiqiy qiymat)");
    }
    return plainValue(result as CellValue);
  }
  if ("richText" in value) {
    return plainValue(value.richText.map((part) => part.text).join(""));
  }
  if ("hyperlink" in value) {
    const text: unknown = value.text;
    // Havola matni ham boy matn bo'lishi mumkin.
    if (text && typeof text === "object" && "richText" in text) {
      return plainValue(text as CellValue);
    }
    return plainValue(typeof text === "string" ? text : (value.hyperlink ?? null));
  }
  return fail("Katak qiymati tushunilmadi");
}

/* ---------------------------------------------------------------------------
   Matn
   --------------------------------------------------------------------------- */

/** Matn: son bo'lib kelgan qiymat (TP nomi `7`, Pinfl) `String()` ga aylanadi. */
export function readText(value: PlainValue | null): CellRead<string> {
  if (value == null) return ok(null);
  if (value instanceof Date) return ok(formatPlainDate(value));
  return ok(cleanText(String(value)));
}

/* ---------------------------------------------------------------------------
   Son
   --------------------------------------------------------------------------- */

/** Oddiy, uzilmas (U+00A0), raqam (U+2007) va ingichka (U+202F, U+2009) probellar. */
const SPACES = /[\s\u00a0\u2007\u202f\u2009]/g;

/**
 * "1 020,60" / "1,020.60" / "1020.6" / "-5" -> son. Tushunilmasa - null.
 * Faqat vergul bo'lsa - u kasr ajratuvchi ("1020,6"); bir nechta vergul yoki
 * nuqta mingliklarni ajratadi ("1,020,600").
 */
export function parseNumberText(input: string): number | null {
  let text = input.replace(SPACES, "").replace(/−/g, "-");
  if (text === "") return null;

  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  if (hasComma && hasDot) {
    // Oxirgi uchragan belgi - kasr ajratuvchi.
    const decimal = text.lastIndexOf(",") > text.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    const [whole, fraction, ...rest] = text.split(decimal);
    if (rest.length > 0 || !/^[+-]?\d{1,3}([.,]\d{3})*$/.test(whole)) return null;
    text = `${whole.split(thousands).join("")}.${fraction}`;
  } else if (hasComma || hasDot) {
    const separator = hasComma ? "," : ".";
    const parts = text.split(separator);
    if (parts.length > 2) {
      if (!/^[+-]?\d{1,3}$/.test(parts[0]) || parts.slice(1).some((part) => !/^\d{3}$/.test(part))) {
        return null;
      }
      text = parts.join("");
    } else {
      text = parts.join(".");
    }
  }

  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readNumber(value: PlainValue | null): CellRead<number> {
  if (value == null) return ok(null);
  if (typeof value === "number") return ok(value);
  if (typeof value === "string") {
    const parsed = parseNumberText(value);
    return parsed == null ? fail(`Son tushunilmadi: “${preview(value)}”`) : ok(parsed);
  }
  return fail(`Son kutilgan, katakda: “${preview(value)}”`);
}

export function readInteger(value: PlainValue | null): CellRead<number> {
  const result = readNumber(value);
  if (!result.ok || result.value == null) return result;
  if (!Number.isInteger(result.value)) {
    return fail(`Butun son kutilgan, katakda kasr son: ${String(result.value).replace(".", ",")}`);
  }
  return result;
}

/* ---------------------------------------------------------------------------
   Sana
   --------------------------------------------------------------------------- */

/** Oy nomlari: o'zbekcha, ruscha lotin yozuvi va kirill (bosh va qaratqich shakllari). */
const MONTH_WORDS: readonly (readonly string[])[] = [
  ["yanvar", "yanvarya", "январь", "января"],
  ["fevral", "fevralya", "февраль", "февраля"],
  ["mart", "marta", "март", "марта"],
  ["aprel", "aprelya", "апрель", "апреля"],
  ["may", "maya", "май", "мая"],
  ["iyun", "iyunya", "июнь", "июня"],
  ["iyul", "iyulya", "июль", "июля"],
  ["avgust", "avgusta", "август", "августа"],
  ["sentabr", "sentyabr", "sentyabrya", "sentabrya", "сентябрь", "сентября"],
  ["oktabr", "oktyabr", "oktyabrya", "oktabrya", "октябрь", "октября"],
  ["noyabr", "noyabrya", "ноябрь", "ноября"],
  ["dekabr", "dekabrya", "декабрь", "декабря"],
];

const MONTH_BY_WORD = new Map<string, number>(
  MONTH_WORDS.flatMap((words, index) => words.map((word) => [word, index] as const)),
);

/** Oy nomi -> 0..11. Apostrof va yumshatish belgisi e'tiborsiz. */
export function monthFromWord(word: string): number | null {
  const key = word
    .toLowerCase()
    .replace(/[‘’ʻʼ`´′'ь]/g, "")
    .trim();
  return MONTH_BY_WORD.get(key) ?? MONTH_BY_WORD.get(`${key}ь`) ?? null;
}

/** Matndagi birinchi oy nomi (sarlavha qatori: "Abonentlar Sentabr Holatiga Ko'ra"). */
export function findMonthWord(text: string): number | null {
  for (const word of text.split(/[\s\d,.;:!?()"«»-]+/)) {
    if (!word) continue;
    const month = monthFromWord(word);
    if (month != null) return month;
  }
  return null;
}

/** O'zbekiston vaqti (UTC+5) - Excel'dagi soat mahalliy vaqt deb qabul qilinadi. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

interface DateParts {
  year: number;
  month: number; // 0..11
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function buildDate(parts: DateParts, withTime: boolean): Date | null {
  const { year, month, day } = parts;
  if (year < 1900 || year > 2200) return null;
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return null;
  }
  if (!withTime) return date;
  if (parts.hours > 23 || parts.minutes > 59 || parts.seconds > 59) return null;
  // Excel'dagi "14:05" - Toshkent vaqti; bazada haqiqiy lahza saqlanadi.
  return new Date(
    Date.UTC(year, month, day, parts.hours, parts.minutes, parts.seconds) - TASHKENT_OFFSET_MS,
  );
}

const TIME = "(?:[ T]+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?";
const DMY = new RegExp(`^(\\d{1,2})[./-](\\d{1,2})[./-](\\d{4})${TIME}$`);
const YMD = new RegExp(`^(\\d{4})-(\\d{1,2})-(\\d{1,2})${TIME}$`);
const NAMED = /^(\d{1,2})[\s-]*([^\d\s,.-]+)[\s,.-]*(\d{4})(?:\s*-?\s*(?:yil|y|г|года?)\.?)?$/iu;

/**
 * Matnli sana: "13.09.2026", "13/09/2026", "2026-09-13", "13-sentabr, 2026".
 * `withTime` - soat ham o'qiladi (bo'lmasa kun boshi).
 */
export function parseDateText(input: string, withTime = false): Date | null {
  const text = cleanText(input);
  if (!text) return null;

  const time = (match: RegExpExecArray, from: number) => ({
    hours: Number(match[from] ?? 0),
    minutes: Number(match[from + 1] ?? 0),
    seconds: Number(match[from + 2] ?? 0),
  });

  let match = DMY.exec(text);
  if (match) {
    return buildDate(
      { day: Number(match[1]), month: Number(match[2]) - 1, year: Number(match[3]), ...time(match, 4) },
      withTime,
    );
  }
  match = YMD.exec(text);
  if (match) {
    return buildDate(
      { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]), ...time(match, 4) },
      withTime,
    );
  }
  match = NAMED.exec(text);
  if (match) {
    const month = monthFromWord(match[2]);
    if (month == null) return null;
    return buildDate(
      { day: Number(match[1]), month, year: Number(match[3]), hours: 0, minutes: 0, seconds: 0 },
      withTime,
    );
  }
  return null;
}

/**
 * Oddiy son sana sifatida faqat shu oraliqda qabul qilinadi (01.01.1990 -
 * 31.12.2099). Shablondagi sana ustunlari "General" formatda: `2026` yoki `5`
 * kabi xato yozuv 1905 / 1900-yil sanasiga aylanib, jimgina saqlanmasin.
 */
const SERIAL_FIRST_DAY = Date.UTC(1990, 0, 1);
const SERIAL_AFTER_LAST_DAY = Date.UTC(2100, 0, 1);

/** Excel seriya raqami (1900 yoki 1904 tizimi) -> sana. Oraliqdan tashqarida - null. */
function fromSerial(serial: number, date1904: boolean, withTime: boolean): Date | null {
  if (!Number.isFinite(serial)) return null;
  const epoch = Date.UTC(1899, 11, 30) + (date1904 ? 1462 * 86_400_000 : 0);
  const wall = epoch + Math.round(serial * 86_400_000);
  if (wall < SERIAL_FIRST_DAY || wall >= SERIAL_AFTER_LAST_DAY) return null;
  return fromWallClock(new Date(wall), withTime);
}

/**
 * exceljs sanani "devor soati" sifatida UTC maydonlarida beradi (13.09.2026
 * 00:00 -> 2026-09-13T00:00Z). Sana ustunlarida vaqt tashlanadi.
 */
function fromWallClock(wall: Date, withTime: boolean): Date | null {
  return buildDate(
    {
      year: wall.getUTCFullYear(),
      month: wall.getUTCMonth(),
      day: wall.getUTCDate(),
      hours: wall.getUTCHours(),
      minutes: wall.getUTCMinutes(),
      seconds: wall.getUTCSeconds(),
    },
    withTime,
  );
}

export function readDate(
  value: PlainValue | null,
  options: { withTime?: boolean; date1904?: boolean } = {},
): CellRead<Date> {
  const withTime = options.withTime ?? false;
  if (value == null) return ok(null);
  let date: Date | null = null;
  if (value instanceof Date) {
    date = Number.isNaN(value.getTime()) ? null : fromWallClock(value, withTime);
  } else if (typeof value === "number") {
    date = fromSerial(value, options.date1904 ?? false, withTime);
  } else if (typeof value === "string") {
    date = parseDateText(value, withTime);
  }
  if (!date) {
    const hint =
      typeof value === "number" ? "son ko’rinishidagi sana 1990–2099 yillar oralig’ida bo’lishi kerak; " : "";
    return fail(
      `Sana tushunilmadi: “${preview(value)}” (${hint}kutilgan: 13.09.2026, 2026-09-13 yoki 13-sentabr, 2026)`,
    );
  }
  return ok(date);
}

/* ---------------------------------------------------------------------------
   Enum
   --------------------------------------------------------------------------- */

/** Enum solishtirish kaliti: registr, apostrof va bo'shliqsiz. */
export function enumKey(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´′']/g, "")
    .replace(/\s+/g, "");
}

export interface EnumSpec<E extends string> {
  /** Kanonik yorliq -> qiymat (xabarda yorliqlar ko'rsatiladi). */
  labels: Record<E, string>;
  /** Qo'shimcha qabul qilinadigan yozuvlar ("Aybsiz" -> INNOCENT). */
  aliases?: Record<string, E>;
}

export function readEnum<E extends string>(value: PlainValue | null, spec: EnumSpec<E>): CellRead<E> {
  if (value == null) return ok(null);
  const text = cleanText(String(value));
  if (!text) return ok(null);
  const key = enumKey(text);
  for (const [code, label] of Object.entries(spec.labels) as [E, string][]) {
    if (enumKey(label) === key || enumKey(code) === key) return ok(code);
  }
  for (const [alias, code] of Object.entries(spec.aliases ?? {}) as [string, E][]) {
    if (enumKey(alias) === key) return ok(code);
  }
  const expected = Object.values<string>(spec.labels).join(" / ");
  return fail(`Qiymat tushunilmadi: “${preview(text)}” (kutilgan: ${expected})`);
}
