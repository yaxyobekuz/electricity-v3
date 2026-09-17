/*
 * Haqiqiy xom Excel fayllarni (`baliqchi/`, `chinobod/`) tozalab, platforma
 * shablonlariga OYLIK ko'rinishda o'tkazish. Ikkala manba bitta qoidalar
 * to'plami bilan ishlanadi va har oy uchun BITTA umumiy fayl yoziladi. Ilova
 * buni ishga tushirmaydi.
 *
 *   npx tsx scripts/convert-data.ts
 *
 * Manbalar (foydalanuvchi berdi 2026-09-16 / 2026-09-17):
 *   baliqchi/  davr papkalari: "7 oylik" (yanvar–iyul jami), "Avgust",
 *              "Sentabr 10 kunlik" + Elektr Abonentlar.xlsx (sentabr holati)
 *   chinobod/  har fayl ichida 3 varaq: "7 oy"/"7 oylik", "Avgust", "Sentabr"
 *              + Elektr Abonentlar.xlsx (sentabr holati)
 *
 * Natija (`converted/`, har safar qaytadan yoziladi):
 *   tozalangan/<manba>/<davr>/  manba fayllar tozalangan holda, davri
 *                   o'zgarmagan. Varaq nomida sana yo'q - platformaga adashib
 *                   yuklab bo'lmaydi;
 *   oylik/2026-MM/  platformaga yuklanadigan oylik fayllar (ikkala manba birga:
 *                   import oyning shu shablondagi hamma yozuvini almashtiradi);
 *   Nomlar va tuzatishlar.xlsx - asl yozuv -> yakuniy nom va har bir tuzatish.
 *
 * Qoidalar:
 *   - kirill yozuvi lotinga o'giriladi; podstansiya, fider, TP, xodim va MFY
 *     nomlari bitta yakuniy ko'rinishga keltiriladi (lug'atlar pastda);
 *   - sanalar haqiqiy Excel sanasi (dd.mm.yyyy); vaqt shablonda yo'q - asli
 *     manba ustunida qoladi;
 *   - raqamlar fayldagidek. Istisno: bo'sh, xato yoki natijasiz formula
 *     "Yo'qotish" va aniq (Umumiy − Foydali)/7 bo'lib qolgan "Yo'qotish"
 *     Umumiy − Foydali bilan almashtiriladi;
 *   - qiymat o'zgargan bo'lsa, asli "<Ustun> (manba)" ustunida (import uni
 *     `sourceRow` ga yozadi - fayldagi hech narsa yo'qolmaydi);
 *   - 7 oylik oqimlar yanvar–iyulga teng bo'linadi; qoidabuzarlik va
 *     murojaatlar o'z sanasi oyiga tushadi; aynan bir xil yozuvlar
 *     birlashtiriladi.
 */

import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import ExcelJS from "exceljs";

import type { TemplateType } from "@/generated/prisma";
import {
  APPEAL_STATUS_LABEL,
  METER_STATUS_LABEL,
  SUBSCRIBER_KIND_LABEL,
  TEMPLATE_FILE_NAME,
  TEMPLATE_LABEL,
  VIOLATOR_TYPE_LABEL,
} from "@/lib/domain/labels";
import { cleanText, contractKey, nameKey } from "@/lib/domain/normalize";
import { MONTHS_UZ } from "@/lib/format";
import { ANDIJON_REGION } from "@/lib/geo/boundaries";
import { parseDateText, parseNumberText } from "@/lib/import/cells";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "converted");
const TEMPLATE_DIR = path.join(ROOT, "data_template");
const YEAR = 2026;
/** Manba fayllarda ustun sarlavhalari 2-qatorda. */
const HEADER_ROW = 2;

/* ---------------------------------------------------------------------------
   Davrlar va manbalar
   --------------------------------------------------------------------------- */

type PeriodKey = "7oy" | "avgust" | "sentabr";

interface Period {
  key: PeriodKey;
  /** Qaysi oylarga tushadi (1..12). Bir nechta bo'lsa - oqimlar teng bo'linadi. */
  months: readonly number[];
  /** "tozalangan/" dagi papka va varaq nomi (sanasiz). */
  folder: string;
  sheetName: string;
  /** Sarlavhadagi davr yozuvi. */
  titlePeriod: string;
  /** Qo'shimcha ustun: "Umumiy oqim (7 oylik jami)". */
  totalLabel: string;
  /** Chinobod varaq nomi (`fold`) shu davrniki. */
  sheetPattern: RegExp;
}

const PERIODS: readonly Period[] = [
  {
    key: "7oy",
    months: [1, 2, 3, 4, 5, 6, 7],
    folder: "7 oylik",
    sheetName: "7 oylik (yanvar-iyul)",
    titlePeriod: "7 oylik (Yanvar–Iyul)",
    totalLabel: "7 oylik",
    sheetPattern: /^7oy/,
  },
  {
    key: "avgust",
    months: [8],
    folder: "Avgust",
    sheetName: "Avgust",
    titlePeriod: "Avgust",
    totalLabel: "Avgust",
    sheetPattern: /^avgust/,
  },
  {
    key: "sentabr",
    months: [9],
    folder: "Sentabr 10 kunlik",
    sheetName: "Sentabr 10 kunlik",
    titlePeriod: "Sentabr (1–10)",
    totalLabel: "Sentabr",
    sheetPattern: /^sentabr/,
  },
];

const periodOf = (key: PeriodKey) => PERIODS.find((period) => period.key === key) as Period;

type SourceId = "baliqchi" | "chinobod";

interface Source {
  id: SourceId;
  /** Tuman / podstansiyalar guruhi nomi (hisobot uchun). */
  label: string;
  /**
   * "folders": har davr alohida papkada (`baliqchi/7 oylik/Elektr Fiderlar.xlsx`);
   * "sheets": bitta fayl ichida davr varaqlari (`chinobod/Elektr Fiderlar.xlsx` [7 oy]).
   */
  layout: "folders" | "sheets";
  /** Sarlavhasiz, lekin ma'lumot bo'lmagan ustunlar: shablon -> ustun raqami -> sabab. */
  ignoredColumns?: Partial<Record<TemplateType, Record<number, string>>>;
  /** Transformatorlar faylidagi "Manzil" TP ga tegishli emas (dalil bilan) - olinmaydi. */
  transformerAddressReason?: string;
  /** 7 oylik qoidabuzarliklardagi "TP Nomi" qatorga tegishli emas (dalil bilan) - olinmaydi. */
  violationTp7oyReason?: string;
}

const SOURCES: readonly Source[] = [
  { id: "baliqchi", label: "Baliqchi, O'rmonbek", layout: "folders" },
  {
    id: "chinobod",
    label: "Chinobod, Qo'shtepasaroy, Oltinko'l",
    layout: "sheets",
    ignoredColumns: {
      TRANSFORMERS: {
        16: "Sarlavhasiz yordamchi son (7 va 3 - varaqlarni hisoblashda ishlatilgan bo'luvchi), TP ma'lumoti emas",
      },
    },
    transformerAddressReason:
      "Manzil ustuni TP ga mos emas - Podstansiya ustuni bilan birga siljigan: TP abonentlarining MFY si bilan mosligi 7/230 (tasodifiy 8,6), TP koordinatasiga eng yaqin MFY 6/214",
    violationTp7oyReason:
      "7 oylik varaqda TP Nomi manzil va abonentga mos emas (TP da shu MFY abonenti bor: 50/320, tasodifiy 38) - TP bog'lanmaydi",
  },
];

/** Oyning hisobot kuni: sentabr - 10-kun (10 kunlik), qolganlari - oy oxiri. */
function reportDay(month: number): number {
  return month === 9 ? 10 : new Date(Date.UTC(YEAR, month, 0)).getUTCDate();
}

/** Varaq nomi: "31-yanvar, 2026" (import hisobot sanasini shundan oladi). */
function monthSheetName(month: number): string {
  return `${reportDay(month)}-${MONTHS_UZ[month - 1].toLowerCase()}, ${YEAR}`;
}

const monthFolder = (month: number) => `${YEAR}-${String(month).padStart(2, "0")}`;

/* ---------------------------------------------------------------------------
   Shablon ustunlari
   --------------------------------------------------------------------------- */

type FieldKind = "text" | "amount" | "reading" | "count" | "coordinate" | "date";

interface Column {
  field: string;
  /** Sarlavha - `data_template/` dagi yozuv bilan solishtiriladi va shundan olinadi. */
  header: string;
  kind: FieldKind;
}

const col = (field: string, header: string, kind: FieldKind = "text"): Column => ({ field, header, kind });

const TOTAL = col("total", "Umumiy oqim", "amount");
const USEFUL = col("useful", "Foydali oqim", "amount");
const LOSS = col("loss", "Yo’qotish", "amount");
const ADDRESS = col("address", "Manzil");
const LAT = col("lat", "Lokatsiya (Lat)", "coordinate");
const LONG = col("long", "Lokatsiya (Long)", "coordinate");
const KVA = col("kva", "Quvvati (KVA)", "amount");
const STAFF = col("staff", "Ma’sul xodim");
const SUBSTATION = col("substation", "Podstansiya");

const COLUMNS: Record<TemplateType, Column[]> = {
  SUBSTATIONS: [col("name", "Podstansiya Nomi"), TOTAL, USEFUL, LOSS, ADDRESS, LAT, LONG, KVA, STAFF],
  FEEDERS: [SUBSTATION, col("name", "Fider Nomi"), TOTAL, USEFUL, LOSS, ADDRESS, KVA, STAFF],
  TRANSFORMERS: [
    SUBSTATION,
    col("feeder", "Fider"),
    col("name", "TP Nomi"),
    TOTAL,
    USEFUL,
    LOSS,
    col("online", "Aloqadagi abonentlar", "count"),
    col("offline", "Aloqadan chiqqan abonentlar", "count"),
    ADDRESS,
    LAT,
    LONG,
    KVA,
    col("currentRepair", "Joriy ta’mir sanasi", "date"),
    col("overhaul", "To’la ta’mir sanasi", "date"),
    STAFF,
  ],
  SUBSCRIBERS: [
    col("fullName", "FISH"),
    SUBSTATION,
    col("feeder", "Fider"),
    col("tp", "TP"),
    col("kind", "Abonent turi (Yuridik/Aholi)"),
    col("staff", "Biriktirilgan xodim"),
    col("status", "Holati (Aloqada / Aloqaga chiqmayotgan / Sxemasi o’zgartirilgan)"),
    ADDRESS,
    LAT,
    LONG,
    col("contract", "Shartnoma raqami"),
    col("meterSerial", "Hisoblagich zavod raqami"),
    col("meterType", "Hisoblagich turi"),
    col("debt", "Qarzdorlik", "amount"),
    col("credit", "Haqdorlik", "amount"),
    col("reading", "Hisoblagich ko’rsatgichi", "reading"),
    col("lastReading", "Oxirgi olingan ma’lumot", "date"),
    col("lastPaymentDate", "Oxirgi to’langan to’lov", "date"),
    col("lastPayment", "Oxirgi to’langan summa", "amount"),
    col("contractDate", "Shartnoma sanasi", "date"),
    col("passport", "Passport"),
    col("pinfl", "Pinfl"),
    col("meterInstalled", "Hisoblagich o’rnatilingan sana", "date"),
  ],
  VIOLATIONS: [
    col("tp", "TP Nomi"),
    col("subscriber", "Abonent"),
    col("type", "Turi (Yuridik/Jismoniy/Aybisiz)"),
    col("date", "Sana", "date"),
    ADDRESS,
    col("damageUzs", "Keltirilgan zarar miqdori (UZS)", "amount"),
    col("damageKwh", "Taxminiy zarar (kWh)", "amount"),
    STAFF,
  ],
  APPEALS: [
    col("tp", "TP Nomi"),
    col("text", "Murojaat"),
    col("subscriber", "Abonent"),
    col("date", "Sana", "date"),
    ADDRESS,
    col("status", "Holati (Ijobiy hal etilgan / Rad etilgan / Jarayonda / Muddati buzilgan)"),
    STAFF,
  ],
};

/** Manba fayllardagi ma'lumot bo'lmagan ustunlar (tashlanadi, tuzatishlar ro'yxatida aytiladi). */
const IGNORED_HEADERS = new Set(["№"]);

const APOSTROPHES = /[‘’ʻʼ`´′]/g;

/** Sarlavha kaliti - importdagi `headerKey` bilan bir xil qoida. */
function headerKey(text: string): string {
  return (cleanText(text) ?? "")
    .replace(APOSTROPHES, "'")
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/\s*([()/])\s*/g, "$1");
}

/** Sarlavhalarni `data_template/` dan oladi va ro'yxat bilan mosligini tekshiradi. */
async function loadTemplateHeaders(): Promise<void> {
  for (const type of Object.keys(COLUMNS) as TemplateType[]) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path.join(TEMPLATE_DIR, TEMPLATE_FILE_NAME[type]));
    const row = workbook.worksheets[0].getRow(HEADER_ROW);
    const headers: string[] = [];
    row.eachCell({ includeEmpty: false }, (cell) => headers.push(String(cell.value)));
    const columns = COLUMNS[type];
    if (headers.length !== columns.length) {
      throw new Error(`${TEMPLATE_FILE_NAME[type]}: shablonda ${headers.length} ta ustun, skriptda ${columns.length} ta`);
    }
    headers.forEach((header, index) => {
      if (headerKey(header) !== headerKey(columns[index].header)) {
        throw new Error(`${TEMPLATE_FILE_NAME[type]}: ${index + 1}-ustun "${header}", kutilgan "${columns[index].header}"`);
      }
      columns[index].header = cleanText(header) ?? header;
    });
  }
}

const headerOf = (type: TemplateType, field: string) => {
  const column = COLUMNS[type].find((item) => item.field === field);
  if (!column) throw new Error(`${type}: "${field}" maydoni yo'q`);
  return column.header;
};

/** Qo'shimcha ustun nomi uchun sarlavhaning qisqa shakli: "Holati (Aloqada / ...)" -> "Holati". */
const shortHeader = (header: string) => header.replace(/\s*\([^)]*\/[^)]*\)$/, "");

const manbaHeader = (header: string) => `${shortHeader(header)} (manba)`;

/* ---------------------------------------------------------------------------
   Kirill -> lotin
   --------------------------------------------------------------------------- */

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "'", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o'", қ: "q", ғ: "g'", ҳ: "h",
};

const isLetter = (char: string) => /\p{L}/u.test(char);
const isUpper = (char: string) => char !== char.toLowerCase();

/** O'zbek kirill yozuvi (rus harflari bilan) -> lotin. Lotin harflariga tegmaydi. */
function transliterate(text: string): string {
  const chars = [...text.normalize("NFC")];
  return chars
    .map((char, index) => {
      const lower = char.toLowerCase();
      let latin = CYRILLIC[lower];
      if (latin === undefined) return char;
      const prev = chars[index - 1] ?? "";
      // "е" so'z boshida yoki unli / belgi harfidan keyin - "ye" ("Ешлар"); raqamdan keyin - "e" ("д.22е").
      if (lower === "е" && ((!isLetter(prev) && !/\d/.test(prev)) || /[аеёиоуэюяўъьaeiou]/i.test(prev))) latin = "ye";
      if (!isUpper(char) || latin === "") return latin;
      const next = chars[index + 1] ?? "";
      // Butun so'z bosh harfda ("ШАРОФ") - "SH", aks holda "Sh".
      const wordUpper = isUpper(next) || (!isLetter(next) && isUpper(prev));
      return wordUpper ? latin.toUpperCase() : latin[0].toUpperCase() + latin.slice(1);
    })
    .join("");
}

/** Nom kaliti: lotin, diakritika, apostrof, bo'shliq va belgilarsiz, kichik harf ("O‘rmonbek MFY" -> "ormonbekmfy"). */
function fold(text: string): string {
  return transliterate(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(APOSTROPHES, "")
    .replace(/'/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Oddiy matn: lotin, apostrof ', bo'shliqlar bittaga. */
function latinText(text: string): string {
  return cleanText(transliterate(text).replace(APOSTROPHES, "'")) ?? "";
}

/** Faqat bo'shliqlar farq qilsa - "o'zgarmagan" (manba yozilmaydi); registr va apostrof o'zgarishi ham yoziladi. */
function sameText(a: string, b: string): boolean {
  return (cleanText(a) ?? "") === (cleanText(b) ?? "");
}

/* ---------------------------------------------------------------------------
   Nomlar lug'ati
   --------------------------------------------------------------------------- */

/**
 * Podstansiya (`fold` bo'yicha): "NS.Baliqchi 110/35/10кВ", "N.S 110/35/10 O'rmonbek",
 * "НС.Куштепасарой 35/10 кВ Т-1", kesilgan "00200-NS.Chinobo", "Олтинкўл 35-10 кВ".
 */
const SUBSTATIONS: readonly (readonly [RegExp, string])[] = [
  [/rmonbek/, "O'rmonbek"],
  [/baliqchi/, "Baliqchi"],
  [/chinob/, "Chinobod"],
  [/(qo|ko|ku|qu)shte/, "Qo'shtepasaroy"],
  [/oltink/, "Oltinko'l"],
  [/paxtakor/, "Paxtakor"],
];

function substationName(text: string): string | null {
  const key = fold(text);
  return SUBSTATIONS.find(([pattern]) => pattern.test(key))?.[1] ?? null;
}

/**
 * Fider: "F.Oybuloq ", "F, Jasorat", "Torttol", "ф.Хакулобод ", "00014-F.Xaqulobo"
 * (kesilgan), "F.Yangi qishloq". Kirill yozuvining ruscha shakllari (к/қ, у/ў,
 * х/ҳ) lotin fayllardagi yozuvga bog'lanadi.
 */
const FEEDERS: Record<string, string> = {
  torttol: "To'rt tol",
  jasorat: "Jasorat",
  galaba: "G'alaba",
  keramika: "Keramika",
  toshtex: "Tosh tex",
  bunyod2: "Bunyod 2",
  oqtom: "Oqtom",
  sifatsavdo: "Sifat savdo",
  fnmist: "FNM ist",
  farovon: "Farovon",
  navbahor: "Navbahor",
  navbaxor: "Navbahor",
  oybuloq: "Oybuloq",
  gurovon: "Go'ravon",
  goravon: "Go'ravon",
  oqqorgon: "Oqqo'rg'on",
  sarkor: "Sarkor",
  sevintim: "Sevin TIM",
  muqum: "Muqum",
  mukum: "Muqum",
  olimbek: "Olimbek",
  tashlama: "Tashlama",
  xaqulobod: "Xaqulobod",
  xaqulobo: "Xaqulobod",
  xakulobod: "Xaqulobod",
  haqulobod: "Xaqulobod",
  kamoliy: "Kamoliy",
  komoliy: "Kamoliy",
  tola: "Tola",
  qiyali: "Qiyali",
  kiyali: "Qiyali",
  jojaxona: "Jo'jaxona",
  jojaxon: "Jo'jaxona",
  jujaxona: "Jo'jaxona",
  parranda: "Parranda",
  qaxramon: "Qaxramon",
  kaxramon: "Qaxramon",
  qahramon: "Qaxramon",
  yangiqishloq: "Yangiqishloq",
  yangiqi: "Yangiqishloq",
  yangikishlok: "Yangiqishloq",
  sirmoq: "Sirmoq",
  sirmok: "Sirmoq",
  siomok: "Sirmoq",
  alpomish: "Alpomish",
  bozchi: "Bo'zchi",
  uzbekiston: "O'zbekiston",
};

function feederName(text: string): string | null {
  const bare = transliterate(text).trim().replace(/^\d+-/, "").replace(/^f\s*[.,:]\s*/i, "");
  return FEEDERS[fold(bare)] ?? null;
}

/** TP: kirill harf lotinga, bo'shliqsiz, bosh harf ("107А" -> "107A", "48 A" -> "48A"). */
function tpName(text: string): string {
  return transliterate(text).replace(APOSTROPHES, "'").replace(/\s+/g, "").toUpperCase();
}

const capitalize = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

/**
 * Bir odamning turli yozuvlari (`fold` -> yakuniy nom): abonentlar reestrida
 * familiya-ism tartibi aralash, ayrim yozuvlarda faqat ism bosh harfi bor.
 * Bosh harfli yozuv to'liq ismga bog'langan joylarda ESB va fiderlar bir xil.
 */
const STAFF_ALIASES: Record<string, string> = {
  smirzaxakimov: "Mirzaxakimov Sardorbek",
  mirzaxakimovsardorbek: "Mirzaxakimov Sardorbek",
  stuxtasinov: "Tuxtasinov Sardorbek",
  sardorbektuxtasinov: "Tuxtasinov Sardorbek",
  tuxtasinovsardorbek: "Tuxtasinov Sardorbek",
  boburjonabdullayev: "Abdullayev Boburjon",
  abdullayevboburjon: "Abdullayev Boburjon",
};

const PATRONYMIC = /(OVICH|EVICH|IVICH|OVNA|EVNA|O'G'LI|QIZI)$/i;

/**
 * Xodim:
 *   "A,Baxriddinov" / "SH.Xojimatov" / "А.Тожибоев." -> "A.Baxriddinov" / "Sh.Xojimatov" / "A.Tojiboyev";
 *   "Toshtemirov (ESB Obiddinov Islomjon) Abrorbek F. Jasorat, F.Navbaxor" -> "Toshtemirov Abrorbek";
 *   "1818 - (ЭСБ И.Вохидов) Мирзахакимов Сардорбек Ф.Янгикишлок" -> "Mirzaxakimov Sardorbek";
 *   "AKMALJON XALILOV ABOBAKIROVICH" (ism familiya otasining ismi) -> "A.Xalilov".
 */
function staffName(text: string): string {
  const clean =
    cleanText(
      latinText(text)
        .replace(/^\d{3,4}\s*-\s*/, "")
        .replace(/\(ESB[^)]*\)/gi, " ")
        .replace(/\bF\.\s*[^\s,]+,?/gi, " ")
        .replace(/\byuridik\b/gi, " ")
        .replace(/[.,;]+$/, ""),
    ) ?? "";
  const alias = STAFF_ALIASES[fold(clean)];
  if (alias) return alias;
  const initials = /^([A-Za-z]{1,2})\s*[.,]\s*([A-Za-z']+)$/.exec(clean);
  if (initials) return `${capitalize(initials[1])}.${capitalize(initials[2])}`;
  const words = clean.split(" ");
  if (words.length === 3 && clean === clean.toUpperCase() && PATRONYMIC.test(words[2])) {
    const initial = /^(SH|CH)/.exec(words[0])?.[1] ?? words[0].charAt(0);
    return `${capitalize(initial)}.${capitalize(words[1])}`;
  }
  return clean;
}

/** MFY nomlari: yakuniy yozuv va fayllarda uchragan kalitlari (`fold`, "mfy" siz). */
const MFY_NAMES: readonly (readonly [string, readonly string[]])[] = [
  // Baliqchi
  ["Afsona", ["afsona"]],
  ["Aralxon", ["aralxon"]],
  ["Baliqchi", ["baliqchi"]],
  ["Barkamol", ["barkamol"]],
  ["Charog'on", ["charogon", "charagon"]],
  ["Do'stlik", ["dostlik"]],
  ["Eshonchek", ["eshonchek"]],
  ["Eski Markaz", ["eskimarkaz"]],
  ["Go'ravon", ["goravon", "gorovon"]],
  ["Islomobod", ["islomobod"]],
  ["Jartepa", ["jartepa"]],
  ["Jasorat", ["jasorat", "jasarat"]],
  ["Kattabuloq", ["kattabuloq"]],
  ["Ko'l bo'yi", ["kolboyi", "koliboyi"]],
  ["Ko'l", ["kol"]],
  ["Markaz", ["markaz"]],
  ["Matonat", ["matonat"]],
  ["Mumtoz", ["mumtoz"]],
  ["Muqanna", ["muqanna"]],
  ["Mustaqillik", ["mustaqillik"]],
  ["Olchazor", ["olchazor", "alchazor"]],
  ["Olimbek", ["olimbek"]],
  ["Oqqo'rg'on", ["oqqorgon"]],
  ["O'rmonbek", ["ormonbek", "urmonbek"]],
  ["O'rtaqo'rg'on", ["ortaqorgon", "ortakorgon"]],
  ["Paxtakor", ["paxtakor"]],
  ["Polvonko'l", ["polvonkol", "polvonkul"]],
  ["Qozirobod", ["qozirobod", "qizirobod"]],
  ["Qumtepa", ["qumtepa", "kumtepa"]],
  ["Sahovat", ["sahovat", "saxovat"]],
  ["Serquyosh", ["serquyosh"]],
  ["Sherobod", ["sherobod"]],
  ["Sortepa", ["sortepa"]],
  ["Turkiston", ["turkiston"]],
  ["Xalfachek", ["xalfachek"]],
  ["Yakkatol", ["yakkatol"]],
  ["Yoshlar", ["yoshlar", "eoshlar"]],
  ["Yurtobod", ["yurtobod"]],
  ["Ziyokor", ["ziyokor"]],
  ["Zulfiqor", ["zulfiqor", "zulfikor"]],
  // Chinobod (yozilishi abonentlar reestrining lotin yozuvi bo'yicha)
  ["A'lam", ["alam"]],
  ["Adolat", ["adolat"]],
  ["Birlik", ["birlik"]],
  ["Botir", ["botir", "bitir"]],
  ["Chinobod", ["chinobod"]],
  ["Daryo bo'yi", ["daryoboyi", "daryobuyi", "daryoboi", "darebuyi"]],
  ["Dog'iston", ["dogiston"]],
  ["Eskixaqulobod", ["eskixaqulobod", "eskixakulobod"]],
  ["Farovon", ["farovon"]],
  ["Fayziobod", ["fayziobod", "fayzobod", "fayzabod", "fayzaobod"]],
  ["Gulshan", ["gulshan"]],
  ["Guzar", ["guzar"]],
  ["Iftixor", ["iftixor", "iftihor"]],
  ["Ilg'or", ["ilgor"]],
  ["Mallachek", ["mallachek", "mallchek", "malllachek"]],
  ["Nasriddinobod", ["nasriddinobod", "nasridddinobod", "nasirinobod", "nasirdinobod"]],
  ["Navnihol", ["navnihol", "navnixol"]],
  ["Nayman", ["nayman"]],
  ["Niyozmachek", ["niyozmachek", "niyozmatchek", "niyazmachek"]],
  ["Nurafshon", ["nurafshon"]],
  ["O'lmas", ["olmas", "ulmas", "olas"]],
  ["Obod turmush", ["obodturmush", "obodturmish"]],
  ["Oltarchek", ["oltarchek"]],
  ["Omonariq", ["omonariq", "omonarik", "omonrik"]],
  ["Oqtepa", ["oqtepa", "oktepa"]],
  ["Qaxramon", ["qaxramon", "kaxramon"]],
  ["Qiyali", ["qiyali", "kiyali"]],
  ["Qo'rg'oncha", ["qorgoncha", "kurgoncha", "qorgincha", "orgoncha"]],
  ["Sarnavul", ["sarnavul", "sarnaul", "sarnovul"]],
  ["Sho'r", ["shor", "shur"]],
  ["Sirmoq", ["sirmoq", "sirmok", "sirrmoq", "sormoq"]],
  ["Siza", ["siza"]],
  ["To'da", ["toda", "tuda"]],
  ["Tovuldi", ["tovuldi", "tobuldi", "tovuldib"]],
  ["Tulkiobod", ["tulkiobod", "tulkobod"]],
  ["Tumor", ["tumor", "tomor"]],
  ["Yangi Xayot", ["yangixayot", "yangihayot"]],
  ["Yettiqashqa", ["yettiqashqa", "yetiqashqa"]],
  ["Yuzchinor", ["yuzchinor"]],
  ["Zaxkash", ["zaxkash"]],
];

const MFY_KEYS = MFY_NAMES.flatMap(([name, keys]) => keys.map((key) => [key, name] as const)).sort(
  (a, b) => b[0].length - a[0].length,
);

/** MFY ro'yxatiga kirmaydigan qisqa manzillar (butun matn `fold`). */
const ADDRESS_EXACT: Record<string, string> = {
  amominovmfssiv: "A.Mominov massivi",
  buyukipakyoli: "Buyuk Ipak yo'li",
  andijonbaliqchitumani: "Andijon Baliqchi tumani",
  chinobodetb: "Chinobod ETB",
};

/** Kalit matnini MFY nomlariga ajratadi (qaytish bilan); bo'lmasa - null. */
function mfyTokens(key: string): string[] | null {
  if (key === "") return [];
  for (const [mfy, name] of MFY_KEYS) {
    if (!key.startsWith(mfy)) continue;
    const rest = mfyTokens(key.slice(mfy.length));
    if (rest) return [name, ...rest.filter((item) => item !== name)];
  }
  return null;
}

/** So'zlar ketma-ketligi MFY nomi(lari)mi: "Oqqorg'on Mfy" -> ["Oqqo'rg'on"]. */
function mfyWords(words: readonly string[]): string[] | null {
  const key = words
    .filter((word) => !/^(mfy|mf6|mf|kfy)$/i.test(fold(word)))
    .map(fold)
    .join("");
  const tokens = key === "" ? null : mfyTokens(key);
  return tokens && tokens.length > 0 ? tokens : null;
}

/**
 * Qisqa manzil (MFY nomi yoki bir nechtasi): "OQQOʻRGʻON", "Oqqorgon MFY",
 * "Markaz ,Islomobod ,Oqqorg'on Mfy", "Chinobod ETB Alam MFY" ->
 * "Oqqo'rg'on MFY" / "Markaz MFY, Islomobod MFY, Oqqo'rg'on MFY" / "A'lam MFY".
 * MFY + ko'cha: "Gulshan mfy Hurriyat kochasi" -> "Gulshan MFY, Hurriyat kochasi".
 * Tanilmasa - null.
 */
function mfyAddress(text: string): string | null {
  const exact = ADDRESS_EXACT[fold(text)];
  if (exact) return exact;
  let words = latinText(text)
    .split(/[\s,;]+/)
    .map((word) => word.replace(/^\.+|\.+$/g, ""))
    .filter(Boolean);
  // "Chinobod ETB Alam MFY" - ETB (elektr tarmoqlari bo'limi) prefiksi.
  if (words.length > 2 && fold(words[0]) === "chinobod" && fold(words[1]) === "etb") words = words.slice(2);
  const render = (names: readonly string[], street: readonly string[]) =>
    [names.map((name) => `${name} MFY`).join(", "), street.join(" ")].filter(Boolean).join(", ");

  // "Sirmoq MFY Obodturmush ko'cha": "ko'cha" oldidagi so'z - ko'cha nomi, MFY emas.
  const streetWord = words.findIndex((word) => /^(kocha|kochasi|kochada|kucha|kuchasi)$/.test(fold(word)));
  if (streetWord >= 1) {
    // Ko'cha nomi bir necha so'z bo'lishi mumkin ("Bog'i turon ko'cha") - eng uzun MFY boshi olinadi.
    for (let split = streetWord - 1; split >= 1; split--) {
      const names = mfyWords(words.slice(0, split));
      const street = words.slice(split).filter((word, index) => index > 0 || !/^(mfy|mf6|mf)$/i.test(fold(word)));
      if (names) return render(names, street);
    }
    const tail = words.slice(streetWord + 1);
    const tailNames = tail.length > 0 ? mfyWords(tail) : null;
    return tailNames ? render(tailNames, words.slice(0, streetWord + 1)) : null;
  }

  const whole = mfyWords(words);
  if (whole) return render(whole, []);
  // Boshida MFY, keyin ko'cha.
  for (let split = words.length - 1; split >= 1; split--) {
    const names = mfyWords(words.slice(0, split));
    const street = words.slice(split).filter((word, index) => index > 0 || !/^(mfy|mf6|mf)$/i.test(fold(word)));
    if (names && street.length > 0 && !mfyWords(street)) return render(names, street);
  }
  // Boshida ko'cha, oxirida MFY: "SOHIBKOR, Shor mfy".
  for (let split = 1; split < words.length; split++) {
    const names = mfyWords(words.slice(split));
    if (names && /mf/i.test(fold(words[words.length - 1]))) return render(names, words.slice(0, split));
  }
  return null;
}

/**
 * FISH: "IMINOV MADAMIN -" -> "IMINOV MADAMIN"; oxiridagi tasodifiy raqam
 * ("ODILJONOVICH3"), tug'ilgan yil ("ERGASHEVA MATLUBA 1991") va pasport
 * raqami ("CL2507121") olib tashlanadi.
 */
function fullName(text: string): string {
  return latinText(text)
    .replace(/\s+-$/, "")
    .replace(/\s+[A-Z]{2}\d{7}$/, "")
    .replace(/\s+(19|20)\d{2}$/, "")
    .replace(/([A-Za-z'])\d+$/, "$1");
}

const enumKey = (text: string) =>
  text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’ʻʼ`´′']/g, "")
    .replace(/\s+/g, "");

function enumValue(text: string, labels: readonly string[], aliases: Record<string, string> = {}): string | null {
  const key = enumKey(latinText(text));
  const label = labels.find((item) => enumKey(item) === key);
  if (label) return label;
  return Object.entries(aliases).find(([alias]) => enumKey(alias) === key)?.[1] ?? null;
}

/* ---------------------------------------------------------------------------
   Nomlar va tuzatishlar jurnali
   --------------------------------------------------------------------------- */

interface NameEntry {
  kind: string;
  original: string;
  value: string;
  files: Set<string>;
  count: number;
}

const names = new Map<string, NameEntry>();

function logName(kind: string, original: string, value: string, file: string): void {
  const key = [kind, original, value].join("");
  const entry = names.get(key) ?? { kind, original, value, files: new Set<string>(), count: 0 };
  entry.files.add(file);
  entry.count += 1;
  names.set(key, entry);
}

interface FixEntry {
  file: string;
  column: string;
  original: string;
  value: string;
  reason: string;
  rows: number[];
}

const fixes = new Map<string, FixEntry>();

function logFix(file: string, row: number, column: string, original: string, value: string, reason: string): void {
  const key = [file, column, original, value, reason].join("");
  const entry = fixes.get(key) ?? { file, column, original, value, reason, rows: [] };
  entry.rows.push(row);
  fixes.set(key, entry);
}

/** Tanib bo'lmagan qisqa manzillar (asl matn lotinda qoldi) - oxirida ekranga chiqadi. */
const unknownAddresses = new Map<string, number>();

/* ---------------------------------------------------------------------------
   Manba katagini o'qish
   --------------------------------------------------------------------------- */

interface Cell {
  /** Oddiy qiymat (formula natijasi, boy matn matni). Xato / natijasiz formula - null. */
  value: string | number | Date | null;
  /** Katakning asl ko'rinishi - manba ustuni va jurnal uchun. */
  text: string | null;
  problem: "error" | "no-result" | null;
  /** Formula matni (bo'lsa). */
  formula?: string;
  /** Vertikal birlashtirilgan katakning bosh katagidan olingan qiymat. */
  merged?: string;
}

const EMPTY_CELL: Cell = { value: null, text: null, problem: null };

const pad2 = (value: number) => String(value).padStart(2, "0");

function dateText(date: Date): string {
  const day = `${pad2(date.getUTCDate())}.${pad2(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`;
  const time = date.getUTCHours() || date.getUTCMinutes() || date.getUTCSeconds();
  return time
    ? `${day} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`
    : day;
}

function readCell(raw: ExcelJS.CellValue): Cell {
  if (raw == null) return EMPTY_CELL;
  if (typeof raw === "string") return raw.trim() === "" ? EMPTY_CELL : { value: raw, text: raw, problem: null };
  if (typeof raw === "number") return { value: raw, text: String(raw), problem: null };
  if (typeof raw === "boolean") return { value: String(raw), text: String(raw), problem: null };
  if (raw instanceof Date) return { value: raw, text: dateText(raw), problem: null };
  if ("error" in raw) return { value: null, text: String(raw.error), problem: "error" };
  if ("formula" in raw || "sharedFormula" in raw) {
    const formula = "formula" in raw && raw.formula ? raw.formula : undefined;
    const result = raw.result;
    if (result == null) return { value: null, text: "formula natijasi yo'q", problem: "no-result", formula };
    if (typeof result === "object" && !(result instanceof Date) && "error" in result) {
      return { value: null, text: String(result.error), problem: "error", formula };
    }
    return { ...readCell(result as ExcelJS.CellValue), formula };
  }
  if ("richText" in raw) return readCell(raw.richText.map((part) => part.text).join(""));
  if ("hyperlink" in raw) return readCell(typeof raw.text === "string" ? raw.text : raw.hyperlink);
  return { value: null, text: JSON.stringify(raw), problem: "error" };
}

interface SourceRow {
  row: number;
  cells: Map<string, Cell>;
}

interface SheetRef {
  source: Source;
  /** Loyiha ildiziga nisbatan fayl yo'li. */
  file: string;
  /** Varaq nomi; null - birinchi varaq. */
  sheet: string | null;
  /** Jurnal va "Manba" ustuni uchun: "baliqchi/7 oylik/Elektr Fiderlar.xlsx", "chinobod/Elektr Fiderlar.xlsx [7 oy]". */
  label: string;
  period: Period | null;
}

interface SourceSheet {
  ref: SheetRef;
  type: TemplateType;
  rows: SourceRow[];
}

const workbooks = new Map<string, Promise<ExcelJS.Workbook>>();

function openWorkbook(file: string): Promise<ExcelJS.Workbook> {
  let workbook = workbooks.get(file);
  if (!workbook) {
    const loaded = new ExcelJS.Workbook();
    workbook = loaded.xlsx.readFile(path.join(ROOT, file)).then(() => loaded);
    workbooks.set(file, workbook);
  }
  return workbook;
}

/** Shablon + davr uchun manba varag'i (fayl yo'q bo'lsa - null). */
async function locate(source: Source, type: TemplateType, period: Period): Promise<SheetRef | null> {
  const fileName = TEMPLATE_FILE_NAME[type];
  if (source.layout === "folders") {
    const file = `${source.id}/${period.folder}/${fileName}`;
    if (!existsSync(path.join(ROOT, file))) return null;
    return { source, file, sheet: null, label: file, period };
  }
  const file = `${source.id}/${fileName}`;
  if (!existsSync(path.join(ROOT, file))) return null;
  const workbook = await openWorkbook(file);
  const sheets = workbook.worksheets.map((sheet) => sheet.name);
  // Varaqlar tartibi fayldan faylga farq qiladi - faqat nomi bo'yicha.
  const unknown = sheets.filter((name) => !PERIODS.some((item) => item.sheetPattern.test(fold(name))));
  if (unknown.length > 0 || sheets.length !== PERIODS.length) {
    throw new Error(`${file}: davr varaqlari kutilgandek emas (${sheets.join(", ")})`);
  }
  const sheet = sheets.find((name) => period.sheetPattern.test(fold(name)));
  if (!sheet) throw new Error(`${file}: "${period.folder}" varag'i yo'q`);
  return { source, file, sheet, label: `${file} [${sheet}]`, period };
}

async function readSource(ref: SheetRef, type: TemplateType): Promise<SourceSheet> {
  const workbook = await openWorkbook(ref.file);
  const sheet = ref.sheet ? workbook.getWorksheet(ref.sheet) : workbook.worksheets[0];
  if (!sheet) throw new Error(`${ref.label}: varaq yo'q`);

  const fields = new Map<number, string>();
  /** Tashlanadigan ustunlar; sababi bor bo'lsa - har bir to'ldirilgan katak jurnalga yoziladi. */
  const ignored = new Map<number, string | null>(
    Object.entries(ref.source.ignoredColumns?.[type] ?? {}).map(([column, reason]) => [Number(column), reason]),
  );
  sheet.getRow(HEADER_ROW).eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = readCell(cell.value).text;
    if (!header) return;
    const column = COLUMNS[type].find((item) => headerKey(item.header) === headerKey(header));
    if (column) {
      fields.set(colNumber, column.field);
    } else if (IGNORED_HEADERS.has(header.trim())) {
      ignored.set(colNumber, null);
      logFix(ref.label, HEADER_ROW, header.trim(), "(ustun)", "(olib tashlandi)", "Qator tartib raqami - ma'lumot emas");
    } else {
      throw new Error(`${ref.label}: noma'lum ustun "${header}"`);
    }
  });

  const rows: SourceRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (excelRow, rowNumber) => {
    if (rowNumber <= HEADER_ROW) return;
    const cells = new Map<string, Cell>();
    excelRow.eachCell({ includeEmpty: false }, (excelCell, colNumber) => {
      const master = excelCell.isMerged ? excelCell.master : excelCell;
      let cell = readCell(master.value);
      if (master !== excelCell && cell.value != null) cell = { ...cell, merged: master.address };
      if (cell.value == null && !cell.problem) return;
      const field = fields.get(colNumber);
      if (field) {
        cells.set(field, cell);
        return;
      }
      // Sarlavhasiz ustundagi ma'lumot yo'qolmasin - faqat ma'lum sababli ustun tashlanadi.
      if (!ignored.has(colNumber)) throw new Error(`${ref.label}: ${rowNumber}-qator, ${colNumber}-ustun sarlavhasiz`);
      const reason = ignored.get(colNumber);
      if (reason) logFix(ref.label, rowNumber, `${colNumber}-ustun (sarlavhasiz)`, cell.text ?? "", "(olib tashlandi)", reason);
    });
    if (cells.size > 0) rows.push({ row: rowNumber, cells });
  });
  return { ref, type, rows };
}

/* ---------------------------------------------------------------------------
   Tozalangan qator
   --------------------------------------------------------------------------- */

type OutValue = string | number | Date | null;

interface Origin {
  file: string;
  row: number;
}

interface OutRow {
  source: SourceId;
  origins: Origin[];
  values: Record<string, OutValue>;
  /** Qo'shimcha (shablonda yo'q) ustunlar: sarlavha -> qiymat. */
  extra: Record<string, OutValue>;
  /** Hodisalar: takrorni topish kaliti, saralash uchun "yyyy-mm-dd hh:mm:ss" va oyi. */
  eventKey?: string;
  stamp?: string;
  month?: number;
  /** Oylik faylga kirmaydi (sababi) - faqat "tozalangan/" da qoladi. */
  excluded?: string;
}

class RowContext {
  readonly values: Record<string, OutValue> = {};
  readonly extra: Record<string, OutValue> = {};

  constructor(
    readonly sheet: SourceSheet,
    readonly row: SourceRow,
  ) {}

  get file() {
    return this.sheet.ref.label;
  }

  cell(field: string): Cell {
    return this.row.cells.get(field) ?? EMPTY_CELL;
  }

  header(field: string): string {
    return headerOf(this.sheet.type, field);
  }

  fail(field: string, message: string): never {
    throw new Error(`${this.file}: ${this.row.row}-qator, "${this.header(field)}": ${message}`);
  }

  fix(field: string, original: string, value: string, reason: string): void {
    logFix(this.file, this.row.row, this.header(field), original, value, reason);
  }

  /** Asl qiymatni manba ustuniga yozadi. */
  keepOriginal(field: string, original: OutValue): void {
    this.extra[manbaHeader(this.header(field))] = original;
  }

  /** Matn maydoni: `canon` bilan yakuniy ko'rinishga keltiriladi; o'zgarsa - asli manbada. */
  text(field: string, canon: (text: string) => string | null = latinText, nameKind?: string): string | null {
    const cell = this.cell(field);
    if (cell.problem) this.fail(field, `katakda xato: ${cell.text}`);
    if (cell.value == null) return null;
    const original = cell.value instanceof Date ? dateText(cell.value) : String(cell.value);
    const value = canon(original);
    if (value == null) this.fail(field, `tanib bo'lmadi: "${original}"`);
    if (nameKind) logName(nameKind, cleanText(original) ?? original, value, this.file);
    if (cell.merged) {
      this.keepOriginal(field, `(birlashtirilgan katak ${cell.merged})`);
      this.fix(field, `(bo'sh, birlashtirilgan ${cell.merged})`, value, "Birlashtirilgan katakning qiymati olindi");
    } else if (!sameText(original, value)) {
      this.keepOriginal(field, original);
    }
    return value || null;
  }

  number(field: string): number | null {
    const cell = this.cell(field);
    if (cell.problem) this.fail(field, `katakda xato: ${cell.text}`);
    if (cell.value == null) return null;
    // Son fayldagidek (yuvarlanmaydi); matn ("3 075.460") songa o'giriladi.
    if (typeof cell.value === "number") return cell.value;
    if (typeof cell.value === "string") {
      const parsed = parseNumberText(cell.value);
      if (parsed == null) this.fail(field, `son tushunilmadi: "${cell.value}"`);
      return parsed;
    }
    return this.fail(field, "son o'rnida sana");
  }

  integer(field: string): number | null {
    const value = this.number(field);
    if (value != null && !Number.isInteger(value)) this.fail(field, `butun son kutilgan: ${value}`);
    return value;
  }

  /** "Quvvati (KVA)": "110 kV" kabi kuchlanish yozilgan bo'lsa - olinmaydi (kVA emas). */
  capacity(): number | null {
    const cell = this.cell("kva");
    if (typeof cell.value === "string" && /^\s*\d+([.,]\d+)?\s*(kv|кв)\s*$/i.test(cell.value)) {
      this.keepOriginal("kva", cell.value);
      this.fix("kva", cell.value, "(bo'sh)", "Kuchlanish (kV) yozilgan, quvvat (kVA) emas - olinmadi");
      return null;
    }
    return this.number("kva");
  }

  /** Sana: haqiqiy sana, "13.09.2026", "10,03,2026 18:59:49", "19.01.2026.". Vaqt tashlanadi (asli manbada). */
  date(field: string): Date | null {
    const cell = this.cell(field);
    if (cell.problem) this.fail(field, `katakda xato: ${cell.text}`);
    if (cell.value == null) return null;

    const typo = DATE_FIXES[this.file]?.[this.row.row];
    if (typo) {
      this.keepOriginal(field, cell.text);
      this.fix(field, cell.text ?? "", typo.value, typo.reason);
      const fixed = parseDateText(typo.value);
      if (!fixed) this.fail(field, `tuzatilgan sana noto'g'ri: ${typo.value}`);
      return fixed;
    }

    if (cell.value instanceof Date) {
      const value = cell.value;
      if (value.getUTCHours() || value.getUTCMinutes() || value.getUTCSeconds()) this.keepOriginal(field, cell.text);
      return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    }
    if (typeof cell.value !== "string") return this.fail(field, `sana tushunilmadi: ${cell.text}`);

    const text = cleanText(cell.value) ?? "";
    const date = parseDateText(text.replace(/,/g, ".").replace(/\.$/, ""));
    if (!date) return this.fail(field, `sana tushunilmadi: "${text}"`);
    if (/\d{1,2}:\d{2}/.test(text)) {
      this.keepOriginal(field, text);
      this.fix(field, "sana va vaqt matni", "sana (dd.mm.yyyy)", "Sana yagona ko'rinishga keltirildi, vaqti manba ustunida");
    } else if (/\.$/.test(text)) {
      this.fix(field, "dd.mm.yyyy. matni", "sana (dd.mm.yyyy)", "Sana oxiridagi ortiqcha nuqta olib tashlandi");
    } else if (!/^\d{2}\.\d{2}\.\d{4}$/.test(text)) {
      this.fix(field, "dd,mm,yyyy matni", "sana (dd.mm.yyyy)", "Sana yagona ko'rinishga keltirildi");
    }
    return date;
  }

  /**
   * Lat/Long juftligi. Ikkala katakda bir xil "40,866486,71968873" matni bo'lsa -
   * ajratiladi. Andijon viloyatidan tashqarida bo'lsa - almashtirib ko'riladi,
   * aks holda olinmaydi.
   */
  location(): void {
    this.values.lat = null;
    this.values.long = null;
    const latCell = this.cell("lat");
    const longCell = this.cell("long");
    let lat: number | null;
    let long: number | null;
    const pair =
      typeof latCell.value === "string" && latCell.value === longCell.value
        ? /^\s*(\d{2})[.,](\d+)\s*[,;]\s*(\d{2})[.,]?(\d+)\s*$/.exec(latCell.value)
        : null;
    if (pair) {
      lat = Number(`${pair[1]}.${pair[2]}`);
      long = Number(`${pair[3]}.${pair[4]}`);
      logFix(this.file, this.row.row, "Lokatsiya (Lat, Long)", latCell.value as string, `${lat}, ${long}`, "Lat va Long bitta matnda (ikkala ustunda bir xil) - ajratildi");
    } else {
      lat = this.number("lat");
      long = this.number("long");
    }
    if (lat == null && long == null) return;

    const original = `${latCell.text ?? ""}, ${longCell.text ?? ""}`;
    const column = "Lokatsiya (Lat, Long)";
    if (lat != null && long != null && inRegion(lat, long)) {
      this.values.lat = lat;
      this.values.long = long;
      if (pair) this.extra["Lokatsiya (manba)"] = latCell.value;
      return;
    }
    this.extra["Lokatsiya (manba)"] = original;
    if (lat != null && long != null && inRegion(long, lat)) {
      this.values.lat = long;
      this.values.long = lat;
      logFix(this.file, this.row.row, column, "Lat va Long o'rni almashgan", "almashtirildi", REGION_REASON);
      return;
    }
    const reason =
      lat == null || long == null
        ? "Faqat bittasi berilgan (Lat va Long birga bo'lishi shart) - koordinata olinmadi"
        : `Andijon viloyatidan tashqarida - koordinata olinmadi (${REGION_REASON})`;
    logFix(this.file, this.row.row, column, "noto'g'ri koordinata", "(bo'sh)", reason);
  }

  /**
   * "Yo'qotish": bo'sh, xato yoki natijasiz formula - Umumiy − Foydali.
   * Qiymat aniq (Umumiy − Foydali)/7 bo'lsa ham (formula 7 ga bo'lib qo'ygan) - Umumiy − Foydali.
   */
  loss(total: number | null, useful: number | null): number | null {
    const cell = this.cell("loss");
    const difference = total != null && useful != null ? round6(total - useful) : null;
    if (!cell.problem && cell.value != null) {
      const loss = this.number("loss");
      if (loss != null && difference != null && Math.abs(difference) >= 1 && Math.abs(loss * 7 - difference) < 0.01) {
        // Asli - aniq son (formula matni jurnalda).
        this.keepOriginal("loss", loss);
        this.fix(
          "loss",
          cell.formula ? `=${cell.formula}` : "(Umumiy − Foydali)/7",
          "Umumiy − Foydali",
          "Yo'qotish aniq (Umumiy − Foydali)/7 - 7 ga bo'lish xatosi; Umumiy − Foydali olindi",
        );
        return difference;
      }
      return loss;
    }
    if (difference == null) return this.fail("loss", "Umumiy yoki Foydali oqim yo'q");
    const original = cell.text ?? "(bo'sh)";
    this.keepOriginal("loss", original);
    const reason =
      cell.problem === "error"
        ? "Katakda Excel xatosi - Umumiy − Foydali hisoblandi"
        : cell.problem === "no-result"
          ? "Formula (Umumiy − Foydali) natijasi faylda saqlanmagan - hisoblandi"
          : "Bo'sh - Umumiy − Foydali hisoblandi";
    this.fix("loss", original, String(difference), reason);
    return difference;
  }

  out(): OutRow {
    return {
      source: this.sheet.ref.source.id,
      origins: [{ file: this.file, row: this.row.row }],
      values: this.values,
      extra: this.extra,
    };
  }
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

const [MIN_LNG, MIN_LAT, MAX_LNG, MAX_LAT] = ANDIJON_REGION.bbox;
const REGION_REASON = `Andijon viloyati chegarasi: Lat ${MIN_LAT}..${MAX_LAT}, Long ${MIN_LNG}..${MAX_LNG}`;

function inRegion(lat: number, long: number): boolean {
  return lat >= MIN_LAT && lat <= MAX_LAT && long >= MIN_LNG && long <= MAX_LNG;
}

/**
 * Sanadagi aniq xatolar (fayl -> qator -> to'g'ri sana). Murojaat raqamlari
 * sana bo'yicha o'sib boradi - to'g'ri sana qo'shni murojaatlar orasidan.
 */
const DATE_FIXES: Record<string, Record<number, { value: string; reason: string }>> = {
  "baliqchi/7 oylik/Elektr Murojaatlar.xlsx": {
    49: {
      value: "20.04.2026",
      reason: "Yilda ortiqcha raqam; murojaat №214190 - 17.04 (№213328) va 20.04 (№214601) orasida",
    },
    55: {
      value: "12.05.2026",
      reason: "Kunda ortiqcha raqam; murojaat №228346 - 07.05 (№226256) va 13.05 (№229571) orasida",
    },
  },
};

/** TP raqamidagi aniq xatolar (fayl -> qator -> to'g'ri TP). */
const TP_FIXES: Record<string, Record<number, { value: string; reason: string }>> = {
  "chinobod/Elektr Murojaatlar.xlsx [7 oy]": {
    12: {
      value: "166",
      reason:
        "44166 nomli TP yo'q - Xaqulobod TP 44 va 166 qo'shilib yozilgan; murojaat manzili Omonariq MFY: TP 166 abonentlari 98/101 Omonariq, TP 44 abonentlari 246/261 Daryo bo'yi",
    },
  },
};

/* ---------------------------------------------------------------------------
   Shablonlar bo'yicha tozalash
   --------------------------------------------------------------------------- */

function substation(ctx: RowContext, field: string): void {
  ctx.values[field] = ctx.text(field, substationName, "Podstansiya");
}

function flows(ctx: RowContext): void {
  const total = ctx.number("total");
  const useful = ctx.number("useful");
  ctx.values.total = total;
  ctx.values.useful = useful;
  ctx.values.loss = ctx.loss(total, useful);
}

function shortAddress(ctx: RowContext): void {
  ctx.values.address = ctx.text(
    "address",
    (text) => {
      const value = mfyAddress(text);
      if (value) return value;
      const fallback = latinText(text);
      unknownAddresses.set(fallback, (unknownAddresses.get(fallback) ?? 0) + 1);
      return fallback;
    },
    "Manzil",
  );
}

function staff(ctx: RowContext, field = "staff"): void {
  ctx.values[field] = ctx.text(field, staffName, "Xodim");
}

function cleanSubstations(sheet: SourceSheet): OutRow[] {
  return sheet.rows.map((row) => {
    const ctx = new RowContext(sheet, row);
    substation(ctx, "name");
    flows(ctx);
    shortAddress(ctx);
    ctx.location();
    ctx.values.kva = ctx.capacity();
    staff(ctx);
    return ctx.out();
  });
}

function cleanFeeders(sheet: SourceSheet): OutRow[] {
  return sheet.rows.map((row) => {
    const ctx = new RowContext(sheet, row);
    substation(ctx, "substation");
    ctx.values.name = ctx.text("name", feederName, "Fider");
    flows(ctx);
    shortAddress(ctx);
    ctx.values.kva = ctx.capacity();
    staff(ctx);
    return ctx.out();
  });
}

function cleanTransformers(sheet: SourceSheet): OutRow[] {
  const addressReason = sheet.ref.source.transformerAddressReason;
  return sheet.rows.map((row) => {
    const ctx = new RowContext(sheet, row);
    substation(ctx, "substation");
    ctx.values.feeder = ctx.text("feeder", feederName, "Fider");
    ctx.values.name = ctx.text("name", (text) => tpName(text), "TP");
    flows(ctx);
    ctx.values.online = ctx.integer("online");
    ctx.values.offline = ctx.integer("offline");
    const address = ctx.cell("address");
    if (addressReason) {
      ctx.values.address = null;
      if (address.value != null) {
        ctx.keepOriginal("address", address.text);
        ctx.fix("address", "TP manzili", "(bo'sh)", addressReason);
      }
    } else {
      shortAddress(ctx);
    }
    ctx.location();
    ctx.values.kva = ctx.capacity();
    ctx.values.currentRepair = ctx.date("currentRepair");
    ctx.values.overhaul = ctx.date("overhaul");
    staff(ctx);
    return ctx.out();
  });
}

function cleanSubscribers(sheet: SourceSheet): OutRow[] {
  const kinds = Object.values(SUBSCRIBER_KIND_LABEL);
  const statuses = Object.values(METER_STATUS_LABEL);
  return sheet.rows.map((row) => {
    const ctx = new RowContext(sheet, row);
    ctx.values.fullName = ctx.text("fullName", (text) => {
      const base = latinText(text);
      const value = fullName(text);
      if (/\s+-$/.test(base)) {
        ctx.fix("fullName", "... -", "... (chiziqchasiz)", "FISH oxiridagi \"-\" (otasining ismi yo'qligi belgisi) olib tashlandi");
      } else if (/\s+[A-Z]{2}\d{7}$/.test(base)) {
        // Jurnalda pasport raqami ko'rsatilmaydi (shaxsiy ma'lumot) - asli faqat manba ustunida.
        ctx.fix("fullName", `${value} XX*******`, value, "FISH oxiridagi pasport raqami olib tashlandi");
      } else if (base !== value) {
        ctx.fix("fullName", base, value, "FISH oxiridagi ortiqcha raqam olib tashlandi");
      }
      return value;
    });

    // Hisob tizimining kodli eksporti: "00200-NS.Chinobo", "00016-F.Jo'jaxon", "00358-358".
    const rawSubstation = String(ctx.cell("substation").value ?? "");
    const coded = /^\d+-/.test(rawSubstation.trim());
    const isTest = fold(rawSubstation.replace(/^\d+-/, "")) === "test";

    if (isTest) {
      ctx.values.substation = latinText(rawSubstation);
      ctx.values.feeder = ctx.text("feeder");
      ctx.values.tp = ctx.text("tp");
    } else {
      substation(ctx, "substation");
      ctx.values.feeder = ctx.text("feeder", feederName, "Fider");
      ctx.values.tp = ctx.text("tp", (text) => tpName(coded ? text.trim().replace(/^\d+-/, "") : text), "TP");
    }
    ctx.values.kind = ctx.text("kind", (text) => enumValue(text, kinds));
    staff(ctx);
    ctx.values.status = ctx.text("status", (text) => enumValue(text, statuses));
    ctx.values.address = ctx.text("address");
    ctx.location();
    ctx.values.contract = ctx.text("contract");
    ctx.values.meterSerial = ctx.text("meterSerial");
    ctx.values.meterType = ctx.text("meterType");
    ctx.values.debt = ctx.number("debt");
    ctx.values.credit = ctx.number("credit");
    ctx.values.reading = ctx.number("reading");
    ctx.values.lastReading = ctx.date("lastReading");
    ctx.values.lastPaymentDate = ctx.date("lastPaymentDate");
    ctx.values.lastPayment = ctx.number("lastPayment");
    ctx.values.contractDate = ctx.date("contractDate");
    ctx.values.passport = ctx.text("passport");
    ctx.values.pinfl = ctx.text("pinfl");
    ctx.values.meterInstalled = ctx.date("meterInstalled");
    const result = ctx.out();
    if (isTest) {
      result.excluded =
        "Hisoblagich tarmoqqa biriktirilmagan (podstansiya, fider va TP \"0-test\") - joyini o'ylab topib bo'lmaydi, importga kiritilmadi";
      logFix(ctx.file, row.row, "(butun qator)", "0-test / 0-test / 0-test", "(oylik faylga kiritilmadi)", result.excluded);
    }
    return result;
  });
}

/** Qoidabuzarlik / murojaat qatori emasmi: majburiy maydonlarning hech biri yo'q. */
function isNotEvent(sheet: SourceSheet, row: SourceRow, required: readonly string[]): string | null {
  if (required.some((field) => row.cells.has(field))) return null;
  const fields = [...row.cells.keys()];
  if (fields.every((field) => field === "staff")) return "Faqat \"Ma'sul xodim\" to'ldirilgan bo'sh qator";
  if (fields.every((field) => field === "damageUzs" || field === "damageKwh")) return "Jami (SUM) qatori - yozuv emas";
  throw new Error(`${sheet.ref.label}: ${row.row}-qator to'liqsiz (${fields.join(", ")}) - qo'lda ko'rib chiqing`);
}

/** Hodisa vaqti: "dd.mm.yyyy hh:mm:ss" (takror kaliti) va "yyyy-mm-dd hh:mm:ss" (saralash). */
function eventStamp(cell: Cell): { key: string; sortable: string } {
  const key = cell.value instanceof Date ? dateText(cell.value) : (cleanText(String(cell.value)) ?? "").replace(/,/g, ".");
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?/.exec(key);
  const sortable = match
    ? `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")} ${match[4] ?? ""}`.trim()
    : key;
  return { key, sortable };
}

function eventRows(sheet: SourceSheet, required: readonly string[]): SourceRow[] {
  return sheet.rows.filter((row) => {
    const reason = isNotEvent(sheet, row, required);
    if (reason) logFix(sheet.ref.label, row.row, "(butun qator)", "qator", "(olib tashlandi)", reason);
    return !reason;
  });
}

/** TP nomlari (`nameKey`): shu manbaning va boshqa manbalarning Transformatorlar fayllarida. */
interface TpNames {
  own: ReadonlySet<string>;
  other: ReadonlySet<string>;
}

/**
 * Hodisadagi TP nomi shu manbaning TP fayllarida yo'q, boshqa manbada bor bo'lsa -
 * platforma uni boshqa hududdagi TP ga bog'lab qo'yadi (umumiy oylik faylda).
 * Bunday nom olinmaydi (asli manbada).
 */
function guardForeignTp(ctx: RowContext, names: TpNames): void {
  const tp = ctx.values.tp;
  if (typeof tp !== "string" || names.own.has(nameKey(tp)) || !names.other.has(nameKey(tp))) return;
  ctx.extra[manbaHeader(ctx.header("tp"))] ??= ctx.cell("tp").text;
  ctx.fix(
    "tp",
    `TP ${tp}`,
    "(bo'sh)",
    "Bu manbaning Transformatorlar fayllarida yo'q, boshqa manbada shu raqamli TP bor - boshqa hududdagi TP ga noto'g'ri bog'lanmasligi uchun olinmadi",
  );
  ctx.values.tp = null;
}

function cleanViolations(sheet: SourceSheet, tpNames: TpNames): OutRow[] {
  const types = Object.values(VIOLATOR_TYPE_LABEL);
  const rows = eventRows(sheet, ["subscriber", "type", "date"]);

  // Baliqchi 7 oylik: "TP Nomi" - tartib raqami (har doim qator raqami − 2).
  const tpCells = rows.filter((row) => row.cells.has("tp"));
  const serial = tpCells.length > 0 && tpCells.every((row) => row.cells.get("tp")?.value === row.row - 2);
  const unrelated = sheet.ref.period?.key === "7oy" ? sheet.ref.source.violationTp7oyReason : undefined;

  return rows.map((row) => {
    const ctx = new RowContext(sheet, row);
    const tp = ctx.cell("tp");
    if (serial || unrelated) {
      ctx.values.tp = null;
      if (tp.value != null) {
        ctx.keepOriginal("tp", tp.value);
        if (serial) {
          ctx.fix("tp", "tartib raqami", "(bo'sh)", "\"TP Nomi\" ustunida TP emas, qator tartib raqami (qator − 2) - TP abonent orqali aniqlanadi");
        } else {
          ctx.fix("tp", "TP raqami", "(bo'sh)", unrelated as string);
        }
      }
    } else if (tp.value != null && fold(String(tp.value)) === "test") {
      ctx.values.tp = null;
      ctx.keepOriginal("tp", tp.text);
      ctx.fix("tp", String(tp.value), "(bo'sh)", "TP raqami emas (\"test\") - TP bog'lanmaydi");
    } else {
      ctx.values.tp = ctx.text("tp", (text) => tpName(text), "TP");
      guardForeignTp(ctx, tpNames);
    }
    ctx.values.subscriber = ctx.text("subscriber");
    ctx.values.type = ctx.text("type", (text) => enumValue(text, types, { Aybsiz: "Aybisiz" }));
    ctx.values.date = ctx.date("date");
    shortAddress(ctx);
    ctx.values.damageUzs = ctx.number("damageUzs");
    ctx.values.damageKwh = ctx.number("damageKwh");
    staff(ctx);
    const out = ctx.out();
    const stamp = eventStamp(ctx.cell("date"));
    const date = ctx.values.date as Date;
    out.eventKey = `${String(ctx.values.subscriber)}|${stamp.key}`;
    out.stamp = DATE_FIXES[ctx.file]?.[row.row] ? date.toISOString().slice(0, 10) : stamp.sortable;
    out.month = date.getUTCMonth() + 1;
    return out;
  });
}

/** TP ro'yxati (manba bo'yicha): TP nomi -> (podstansiya, fider) lar. */
type TpIndex = Map<string, { substation: string; feeder: string }[]>;

function buildTpIndex(rows: readonly OutRow[]): TpIndex {
  const index: TpIndex = new Map();
  for (const row of rows) {
    const name = String(row.values.name);
    const place = { substation: String(row.values.substation), feeder: String(row.values.feeder) };
    const list = index.get(name) ?? [];
    if (!list.some((item) => item.substation === place.substation && item.feeder === place.feeder)) list.push(place);
    index.set(name, list);
  }
  return index;
}

/**
 * Murojaatdagi ulanish yo'li: "ПС Чинобод 110/35/10 ф Хакулобод ТП №67/160 кВА" ->
 * podstansiya, fider, TP va qolgan matn (transliteratsiyadan keyin).
 */
const APPEAL_PATH = /^(?:[PN]?S)\s+([A-Za-z']+)\s*(\d+(?:\/\d+)+)?\s*f\s*([A-Za-z']+?)(?:dagi)?(?=[\s.,]|$)\s*(.*)$/i;

function cleanAppeals(sheet: SourceSheet, tpIndex: TpIndex, tpNames: TpNames, contracts: ReadonlySet<string>): OutRow[] {
  const statuses = Object.values(APPEAL_STATUS_LABEL);
  let rows = eventRows(sheet, ["text", "subscriber", "date", "status"]);

  // "Abonent" ustunida murojaat raqami, "Murojaat" ustunida murojaatchi - joyiga qaytariladi.
  const numberText = (cell: Cell | undefined) => (cell?.value == null ? "" : String(cell.value).trim());
  const swapped =
    rows.length > 0 &&
    rows.every((row) => /^[\s:;,.]*\d{6}$/.test(numberText(row.cells.get("subscriber")))) &&
    rows.every((row) => !contracts.has(contractKey(numberText(row.cells.get("subscriber")).replace(/^[\s:;,.]+/, "")))) &&
    rows.some((row) => !/^\d+$/.test(numberText(row.cells.get("text"))));
  if (swapped) {
    rows = rows.map((row) => {
      const cells = new Map(row.cells);
      const number = row.cells.get("subscriber");
      const applicant = row.cells.get("text");
      if (number) cells.set("text", number);
      else cells.delete("text");
      if (applicant) cells.set("subscriber", applicant);
      else cells.delete("subscriber");
      return { row: row.row, cells };
    });
    logFix(
      sheet.ref.label,
      HEADER_ROW,
      "Murojaat <-> Abonent",
      "Abonent: 6 xonali raqam, Murojaat: murojaatchi",
      "ustunlar almashtirildi",
      "\"Abonent\" ustunida murojaat raqami (shartnoma raqami emas; sanasi bilan birga o'sadi, Baliqchi murojaat raqamlari bilan bitta ketma-ketlik), \"Murojaat\" ustunida murojaatchi yoki obyekt",
    );
  }

  return rows.map((row) => {
    const ctx = new RowContext(sheet, row);
    const tpCell = ctx.cell("tp");
    if (tpCell.value == null) {
      ctx.values.tp = null;
    } else {
      const raw = String(tpCell.value);
      const route = APPEAL_PATH.exec(latinText(raw));
      if (route) {
        ctx.values.tp = appealTp(ctx, raw, route, tpIndex);
      } else if (fold(raw) === "yangi") {
        ctx.values.tp = null;
        ctx.keepOriginal("tp", raw);
        ctx.fix("tp", raw, "(bo'sh)", "TP raqami emas (\"Yangi\") - TP bog'lanmaydi");
      } else {
        ctx.values.tp = ctx.text("tp", (text) => tpName(text), "TP");
        guardForeignTp(ctx, tpNames);
      }
    }
    ctx.values.text = ctx.text("text", (text) => {
      const value = latinText(text).replace(/^[\s:;,.]+/, "");
      if (value !== latinText(text)) ctx.fix("text", text, value, "Raqam oldidagi belgi olib tashlandi");
      return value;
    });
    ctx.values.subscriber = ctx.text("subscriber", (text) =>
      latinText(text)
        .replace(/^[\s,:;.]+/, "")
        .replace(/[\s,:;.]+$/, "")
        .replace(/\s+,/g, ","),
    );
    ctx.values.date = ctx.date("date");
    shortAddress(ctx);
    ctx.values.status = ctx.text("status", (text) => enumValue(text, statuses, { Ijobiy: "Ijobiy hal etilgan" }));
    staff(ctx);
    const out = ctx.out();
    const date = ctx.values.date as Date;
    out.eventKey = `${String(ctx.values.text)}|${String(ctx.values.subscriber)}|${dateText(date)}`;
    out.stamp = date.toISOString().slice(0, 10);
    out.month = date.getUTCMonth() + 1;
    return out;
  });
}

/** Murojaat yo'lidan TP: faqat raqami bor va shu manbaning TP ro'yxatida shu fider ostida bo'lsa. */
function appealTp(ctx: RowContext, raw: string, route: RegExpExecArray, tpIndex: TpIndex): string | null {
  ctx.keepOriginal("tp", raw);
  const substationValue = substationName(route[1]);
  const feederValue = FEEDERS[fold(route[3])];
  if (!substationValue || !feederValue) ctx.fail("tp", `ulanish yo'li tanilmadi: "${raw}"`);
  logName("Podstansiya", route[1], substationValue, ctx.file);
  logName("Fider", route[3], feederValue, ctx.file);

  const rest = route[4];
  const empty = (reason: string) => {
    ctx.fix("tp", "ulanish yo'li", "(bo'sh)", reason);
    return null;
  };
  if (/yakin\s+tayanch/i.test(rest)) return empty("Ulanish nuqtasi TP emas - 10 kV liniya tayanchi");
  if (/balansidagi|tasarufidagi/i.test(rest)) return empty("Iste'molchi tasarrufidagi TP - tarmoq TP ro'yxatida yo'q, TP bog'lanmaydi");
  const number = /№\s*(\d+[A-Za-z]?)\s*\/\s*(\d+)/.exec(rest);
  if (!number) return empty("TP ko'rsatilmagan - faqat fider");

  const fixed = TP_FIXES[ctx.file]?.[ctx.row.row];
  const name = fixed ? fixed.value : tpName(number[1]);
  if (fixed) ctx.fix("tp", `TP ${number[1]}`, `TP ${fixed.value}`, fixed.reason);
  const places = tpIndex.get(name) ?? [];
  if (places.length === 0) {
    return empty(`TP ${name} (${substationValue} / ${feederValue}) Transformatorlar faylida yo'q - TP bog'lanmaydi`);
  }
  if (!places.some((place) => place.feeder === feederValue)) {
    const where = places.map((place) => `${place.substation} / ${place.feeder}`).join("; ");
    return empty(`TP ${name} Transformatorlar faylida boshqa fiderda (${where}), murojaatda ${feederValue} - TP bog'lanmaydi`);
  }
  logName("TP", `${number[1]} (murojaat yo'li)`, name, ctx.file);
  return name;
}

/* ---------------------------------------------------------------------------
   Manbalararo tuzatishlar
   --------------------------------------------------------------------------- */

/**
 * Bo'sh podstansiyali TP qatori shu manbaning avgust faylidagi aynan shu TP
 * qatoridan to'ldiriladi (Baliqchi sentabr TP fayli avgustdan ko'chirilgan).
 */
function fillFromReference(rows: OutRow[], reference: readonly OutRow[]): void {
  for (const row of rows) {
    if (row.values.substation != null) continue;
    const { file, row: rowNumber } = row.origins[0];
    const matches = reference.filter(
      (item) =>
        item.values.name === row.values.name && (row.values.feeder == null || item.values.feeder === row.values.feeder),
    );
    if (matches.length !== 1) {
      throw new Error(`${file}: ${rowNumber}-qator, TP ${String(row.values.name)} avgust faylida ${matches.length} ta`);
    }
    const [match] = matches;
    const reason = "Bo'sh katak - avgust faylidagi aynan shu TP qatoridan (qiymatlari bir xil) to'ldirildi";
    const podstansiya = headerOf("TRANSFORMERS", "substation");
    row.values.substation = match.values.substation;
    row.extra[manbaHeader(podstansiya)] = "(bo'sh)";
    logFix(file, rowNumber, podstansiya, "(bo'sh)", String(match.values.substation), reason);
    if (row.values.feeder == null) {
      const fider = headerOf("TRANSFORMERS", "feeder");
      row.values.feeder = match.values.feeder;
      row.extra[manbaHeader(fider)] = "(bo'sh)";
      logFix(file, rowNumber, fider, "(bo'sh)", String(match.values.feeder), reason);
    }
    if (row.values.staff !== match.values.staff) {
      const xodim = headerOf("TRANSFORMERS", "staff");
      row.extra[manbaHeader(xodim)] ??= row.values.staff;
      logFix(
        file,
        rowNumber,
        xodim,
        String(row.values.staff),
        String(match.values.staff),
        `${String(match.values.substation)} TP si - avgust faylidagi va sentabr podstansiyalar faylidagi ma'sul xodim olindi`,
      );
      row.values.staff = match.values.staff;
    }
  }
}

/**
 * Fider -> podstansiya xaritasi (manba bo'yicha): Fiderlar fayllarida fider
 * faqat bitta podstansiyada bo'lsa; u yerda yo'q fider - abonentlar reestrida
 * hamma qatori bitta podstansiyada bo'lsa. Ikki podstansiyada uchraydigan nom
 * (Baliqchi "Jasorat") xaritaga kirmaydi.
 */
function feederSubstations(feeders: readonly OutRow[], subscribers: readonly OutRow[]): Map<string, string> {
  const collect = (rows: readonly OutRow[], nameField: string) => {
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      if (row.excluded) continue;
      const feeder = String(row.values[nameField]);
      const set = map.get(feeder) ?? new Set<string>();
      set.add(String(row.values.substation));
      map.set(feeder, set);
    }
    return map;
  };
  const fromFeeders = collect(feeders, "name");
  const fromRegistry = collect(subscribers, "feeder");
  const result = new Map<string, string>();
  for (const [feeder, set] of fromRegistry) if (set.size === 1) result.set(feeder, [...set][0]);
  for (const [feeder, set] of fromFeeders) {
    if (set.size === 1) result.set(feeder, [...set][0]);
    else result.delete(feeder);
  }
  return result;
}

/** TP qatorining podstansiyasi fideriga ko'ra (Chinobod TP fayli: 296 dan 158 tasi boshqa podstansiyada). */
function applyFeederSubstations(rows: OutRow[], map: ReadonlyMap<string, string>): void {
  const header = headerOf("TRANSFORMERS", "substation");
  for (const row of rows) {
    const target = map.get(String(row.values.feeder));
    if (!target || target === row.values.substation) continue;
    const { file, row: rowNumber } = row.origins[0];
    row.extra[manbaHeader(header)] ??= String(row.values.substation);
    logFix(
      file,
      rowNumber,
      header,
      `${String(row.values.substation)} (fider ${String(row.values.feeder)})`,
      target,
      `Fider boshqa podstansiyada yozilgan: Fiderlar fayli va abonentlar reestrida ${String(row.values.feeder)} faqat ${target} ostida`,
    );
    row.values.substation = target;
  }
}

/**
 * Abonentlar reestridagi fider boshqa podstansiya ostida yozilgan bo'lsa: shu
 * nomli fider TP fayllarida boshqa podstansiyada bo'lib, reestrdagi TP larining
 * kamida yarmi o'sha yerda topilsa (o'z podstansiyasida esa bu fiderning TP si
 * yo'q) - abonentlar o'sha podstansiyaga o'tkaziladi.
 */
function relocateFeeders(subscribers: OutRow[], transformers: readonly OutRow[]): void {
  const tpsOf = (rows: readonly OutRow[], tpField: string) => {
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      if (row.excluded) continue;
      const key = `${String(row.values.substation)}|${String(row.values.feeder)}`;
      const set = map.get(key) ?? new Set<string>();
      set.add(String(row.values[tpField]));
      map.set(key, set);
    }
    return map;
  };
  const registry = tpsOf(subscribers, "tp");
  const reference = tpsOf(transformers, "name");

  const moves = new Map<string, { substation: string; evidence: string }>();
  for (const [key, tps] of registry) {
    if (reference.has(key)) continue;
    const [ownSubstation, feeder] = key.split("|");
    for (const [refKey, refTps] of reference) {
      const [refSubstation, refFeeder] = refKey.split("|");
      if (refFeeder !== feeder || refSubstation === ownSubstation) continue;
      const shared = [...tps].filter((tp) => refTps.has(tp));
      if (shared.length * 2 >= tps.size) {
        moves.set(key, {
          substation: refSubstation,
          evidence: `reestrdagi ${tps.size} ta TP dan ${shared.length} tasi (${shared.slice(0, 6).join(", ")}...) Transformatorlar faylida ${refSubstation} / ${feeder} ostida`,
        });
      }
    }
  }

  const header = headerOf("SUBSCRIBERS", "substation");
  for (const row of subscribers) {
    if (row.excluded) continue;
    const key = `${String(row.values.substation)}|${String(row.values.feeder)}`;
    const move = moves.get(key);
    if (!move) continue;
    const { file, row: rowNumber } = row.origins[0];
    row.extra[manbaHeader(header)] ??= String(row.values.substation);
    logFix(
      file,
      rowNumber,
      header,
      `${String(row.values.substation)} (fider ${String(row.values.feeder)})`,
      move.substation,
      `Fider boshqa podstansiyada yozilgan: ${move.evidence}`,
    );
    row.values.substation = move.substation;
  }
}

/** Ikki nuqta orasidagi masofa, metr. */
function distance(lat1: number, long1: number, lat2: number, long2: number): number {
  const rad = (value: number) => (value * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(long2 - long1) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

const median = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0 ? null : sorted[Math.floor((sorted.length - 1) / 2)];
};

/** Guruh TP dan shunchalik uzoq bo'lsa, "raqami bir xil boshqa TP" deb hisoblanadi (ko'chirilmaydi). */
const FAR_METERS = 3000;

/**
 * Har bir TP bitta joyda: reestrdagi abonentning fideri (va podstansiyasi) shu
 * manbaning Transformatorlar faylidagi TP joyi bilan bir xil qilinadi (TP nomi
 * faylda bitta joyda bo'lsa). Faqat fideri TP faylida bor qatorlar (Baliqchi
 * reestridagi Chinobod/Muqum kabi fayli yo'q fiderlarga tegilmaydi); "TEST" TP
 * ga tegilmaydi. Istisno: ko'chiriladigan guruh (bir xil TP va asl joy) TP
 * koordinatasidan 3 km dan va TP ning o'z abonentlaridan 3 barobardan uzoq
 * bo'lsa - bu raqami bir xil boshqa TP: ko'chirilmaydi, jurnalga yoziladi.
 */
function locateSubscriberTps(subscribers: OutRow[], transformers: readonly OutRow[]) {
  const index = buildTpIndex(transformers);
  const coordinates = new Map<string, [number, number]>();
  for (const row of transformers) {
    if (typeof row.values.lat === "number" && typeof row.values.long === "number") {
      coordinates.set(String(row.values.name), [row.values.lat, row.values.long]);
    }
  }
  const tpFeeders = new Set(transformers.map((row) => String(row.values.feeder)));
  const groups = new Map<string, OutRow[]>();
  for (const row of subscribers) {
    if (row.excluded || row.values.tp === "TEST" || !tpFeeders.has(String(row.values.feeder))) continue;
    const list = groups.get(String(row.values.tp)) ?? [];
    list.push(row);
    groups.set(String(row.values.tp), list);
  }

  const substationHeader = headerOf("SUBSCRIBERS", "substation");
  const feederHeader = headerOf("SUBSCRIBERS", "feeder");
  const placeOf = (row: OutRow) => `${String(row.values.substation)} / ${String(row.values.feeder)}`;
  for (const [tp, rows] of groups) {
    const places = index.get(tp) ?? [];
    if (places.length !== 1) continue;
    const [target] = places;
    const targetPlace = `${target.substation} / ${target.feeder}`;
    const point = coordinates.get(tp);
    const distances = (list: readonly OutRow[]) =>
      point
        ? list
            .filter((row) => typeof row.values.lat === "number" && typeof row.values.long === "number")
            .map((row) => distance(point[0], point[1], row.values.lat as number, row.values.long as number))
        : [];
    const own = median(distances(rows.filter((row) => placeOf(row) === targetPlace)));

    const byOrigin = new Map<string, OutRow[]>();
    for (const row of rows) {
      if (placeOf(row) === targetPlace) continue;
      byOrigin.set(placeOf(row), [...(byOrigin.get(placeOf(row)) ?? []), row]);
    }
    for (const [origin, moving] of byOrigin) {
      const far = median(distances(moving));
      if (far != null && far > FAR_METERS && far > 3 * (own ?? 0)) {
        for (const row of moving) {
          logFix(
            row.origins[0].file,
            row.origins[0].row,
            `${substationHeader} / ${feederHeader}`,
            origin,
            "(o'zgartirilmadi)",
            `TP ${tp} Transformatorlar faylida ${targetPlace} ostida, lekin bu abonentlar undan ${Math.round(far / 100) / 10} km uzoqda (TP ning o'z abonentlari ${own == null ? "-" : `${Math.round(own / 100) / 10} km`}) - raqami bir xil boshqa TP, ko'chirilmadi`,
          );
        }
        continue;
      }
      for (const row of moving) {
        if (row.values.feeder !== target.feeder) row.extra[manbaHeader(feederHeader)] ??= String(row.values.feeder);
        if (row.values.substation !== target.substation) row.extra[manbaHeader(substationHeader)] ??= String(row.values.substation);
        logFix(
          row.origins[0].file,
          row.origins[0].row,
          `${substationHeader} / ${feederHeader}`,
          origin,
          targetPlace,
          `TP ${tp} Transformatorlar faylida ${targetPlace} ostida - TP bitta joyda`,
        );
        row.values.feeder = target.feeder;
        row.values.substation = target.substation;
      }
    }
  }
}

/**
 * Bitta shartnoma raqami bir nechta qatorda (yuridik shaxsning bir nechta
 * hisoblagichi): hammasida "<shartnoma>/<hisoblagich raqami>" - import kaliti
 * noyob bo'ladi, hech bir hisoblagich tashlanmaydi.
 */
function disambiguateContracts(rows: OutRow[]): void {
  const groups = new Map<string, OutRow[]>();
  for (const row of rows) {
    const key = contractKey(String(row.values.contract));
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const header = headerOf("SUBSCRIBERS", "contract");
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const serials = new Set(group.map((row) => String(row.values.meterSerial)));
    if (serials.size !== group.length || group.some((row) => row.values.meterSerial == null)) {
      throw new Error(`Shartnoma ${String(group[0].values.contract)}: hisoblagich raqamlari noyob emas`);
    }
    for (const row of group) {
      const original = String(row.values.contract);
      row.values.contract = `${original}/${String(row.values.meterSerial)}`;
      row.extra[manbaHeader(header)] = original;
      logFix(
        row.origins[0].file,
        row.origins[0].row,
        header,
        original,
        `${original}/<hisoblagich>`,
        `Bitta shartnoma ${group.length} ta hisoblagichda (yuridik shaxs) - kalit noyob bo'lishi uchun hisoblagich raqami qo'shildi`,
      );
    }
  }
}

/* ---------------------------------------------------------------------------
   Oylarga ajratish
   --------------------------------------------------------------------------- */

const FLOW_FIELDS = ["total", "useful", "loss"] as const;

/** Tiyingacha teng bo'lish: dastlabki oylar bir xil, yuvarlash qoldig'i oxirgi oyda (yig'indi aniq). */
function splitEvenly(value: number, parts: number): number[] {
  const cents = Math.round(value * 100);
  const share = Math.round(cents / parts);
  return Array.from({ length: parts }, (_, index) =>
    index === parts - 1 ? (cents - share * (parts - 1)) / 100 : share / 100,
  );
}

function splitFlows(type: TemplateType, rows: readonly OutRow[], period: Period) {
  const months = period.months;
  const result = new Map<number, OutRow[]>(months.map((month) => [month, []]));
  for (const row of rows) {
    const shares = Object.fromEntries(
      FLOW_FIELDS.map((field) => [field, splitEvenly(Number(row.values[field]), months.length)]),
    ) as Record<(typeof FLOW_FIELDS)[number], number[]>;
    months.forEach((month, index) => {
      const extra: Record<string, OutValue> = { ...row.extra };
      for (const field of FLOW_FIELDS) extra[`${headerOf(type, field)} (${period.totalLabel} jami)`] = row.values[field];
      const values = { ...row.values };
      for (const field of FLOW_FIELDS) values[field] = shares[field][index];
      result.get(month)?.push({ ...row, values, extra });
    });
  }
  return result;
}

const sameValue = (a: OutValue, b: OutValue) =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;

/**
 * Bir nechta fayldagi hodisalarni birlashtiradi: kalit (abonent + sana va vaqt)
 * bir xil va zarar/tur bir xil bo'lsa - bitta yozuv. Keyingi fayl qiymatlari
 * ustun, farq qilgan eski qiymatlar qo'shimcha ustunda.
 */
function mergeEvents(type: TemplateType, groups: readonly (readonly OutRow[])[]): OutRow[] {
  const byKey = new Map<string, OutRow>();
  const result: OutRow[] = [];
  const mustMatch = type === "VIOLATIONS" ? ["type", "damageUzs", "damageKwh"] : ["status"];
  for (const rows of groups) {
    for (const row of rows) {
      const key = `${row.source}|${row.eventKey ?? ""}`;
      const older = byKey.get(key);
      if (!older) {
        byKey.set(key, row);
        result.push(row);
        continue;
      }
      const conflict = mustMatch.find((field) => !sameValue(older.values[field], row.values[field]));
      const [first] = older.origins;
      const [second] = row.origins;
      if (conflict) {
        throw new Error(`${second.file} ${second.row}-qator va ${first.file} ${first.row}-qator: kaliti bir xil, "${conflict}" farq qiladi`);
      }
      const olderLabel = periodLabelOf(first.file);
      const newerLabel = periodLabelOf(second.file);
      const differing: string[] = [];
      for (const column of COLUMNS[type]) {
        const previous = older.values[column.field];
        const next = row.values[column.field];
        if (next != null) older.values[column.field] = next;
        if (previous != null && next != null && !sameValue(previous, next)) {
          older.extra[`${shortHeader(column.header)} (${olderLabel} faylida)`] = previous;
          differing.push(`${shortHeader(column.header)}: ${String(previous)} / ${String(next)}`);
        }
      }
      if (differing.length > 0) {
        logFix(
          second.file,
          second.row,
          "(butun qator)",
          `farqli ustunlar - ${differing.join("; ")}`,
          `${newerLabel} fayli qiymati olindi`,
          `Bitta hodisaning ikki fayldagi yozuvi qo'shimcha ustunlarda farq qiladi; ${olderLabel} qiymati "(${olderLabel} faylida)" ustunida`,
        );
      }
      // Ikkala faylning asl qiymatlari ham qoladi.
      for (const [header, value] of Object.entries(row.extra)) {
        const previous = older.extra[header];
        older.extra[header] =
          previous != null && value != null && !sameValue(previous, value)
            ? `${olderLabel}: ${String(previous)}; ${newerLabel}: ${String(value)}`
            : (value ?? previous);
      }
      older.origins.push(second);
      logFix(
        second.file,
        second.row,
        "(butun qator)",
        `takror: ${first.file}, ${first.row}-qator`,
        "bitta yozuvga birlashtirildi",
        type === "VIOLATIONS"
          ? "Bitta qoidabuzarlik ikki faylda (abonent, sana va vaqt, turi va zarar bir xil)"
          : "Bitta murojaat ikki faylda (raqami, murojaatchi, sana va holati bir xil)",
      );
    }
  }
  return result;
}

/** "baliqchi/7 oylik/..." -> "7 oylik"; "chinobod/Elektr X.xlsx [Avgust]" -> "Avgust". */
function periodLabelOf(file: string): string {
  const sheet = /\[([^\]]+)\]$/.exec(file);
  return sheet ? sheet[1] : (file.split("/")[1] ?? file);
}

/* ---------------------------------------------------------------------------
   Excel yozish
   --------------------------------------------------------------------------- */

const NUMBER_FORMAT: Record<FieldKind, string | undefined> = {
  text: "@",
  amount: "#,##0.00",
  reading: "#,##0.000",
  count: "0",
  coordinate: "0.##########",
  date: "dd.mm.yyyy",
};

const WIDTH: Record<FieldKind, number> = { text: 22, amount: 18, reading: 18, count: 14, coordinate: 16, date: 14 };

const ORIGIN_HEADER = "Manba (fayl, qator)";

const TITLE_STYLE: Partial<ExcelJS.Style> = {
  font: { name: "Arial", size: 16, bold: true, color: { argb: "FF00FF00" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF0000FF" } },
  alignment: { horizontal: "center", vertical: "middle", wrapText: true },
};
const HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { name: "Arial", size: 12, bold: true, color: { argb: "FFFFFF00" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF0000FF" } },
  alignment: { horizontal: "center", vertical: "middle", wrapText: true },
};
/** Shablonda yo'q ustunlar (manba) - kulrang sarlavha. */
const EXTRA_HEADER_STYLE: Partial<ExcelJS.Style> = {
  font: { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } },
  fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF7F7F7F" } },
  alignment: { horizontal: "center", vertical: "middle", wrapText: true },
};

const originText = (origins: readonly Origin[]) => origins.map((item) => `${item.file}, ${item.row}-qator`).join("; ");

/** Qo'shimcha ustunlar tartibi: tegishli shablon ustuni bo'yicha, keyin qolganlari. */
function extraHeaders(type: TemplateType, rows: readonly OutRow[]): string[] {
  const seen = new Set<string>();
  for (const row of rows) for (const header of Object.keys(row.extra)) seen.add(header);
  const position = (header: string) => {
    if (header.startsWith("Lokatsiya (manba)")) return COLUMNS[type].findIndex((column) => column.field === "lat");
    return COLUMNS[type].findIndex((column) => header.startsWith(`${shortHeader(column.header)} (`));
  };
  return [...seen]
    .map((header, order) => ({ header, order, position: position(header) }))
    .sort((a, b) => (a.position < 0 ? 999 : a.position) - (b.position < 0 ? 999 : b.position) || a.order - b.order)
    .map((item) => item.header);
}

interface WriteOptions {
  sheetName: string;
  title: string;
  /** "Manba (fayl, qator)" ustuni. */
  withOrigin?: boolean;
}

async function writeTemplate(file: string, type: TemplateType, rows: readonly OutRow[], options: WriteOptions) {
  const columns = COLUMNS[type];
  const extras = extraHeaders(type, rows);
  const headers = [...columns.map((column) => column.header), ...extras, ...(options.withOrigin ? [ORIGIN_HEADER] : [])];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "scripts/convert-data.ts";
  const sheet = workbook.addWorksheet(options.sheetName, {
    views: [{ state: "frozen", xSplit: 0, ySplit: HEADER_ROW }],
  });
  sheet.columns = headers.map((header, index) => {
    const column = columns[index];
    const kind: FieldKind = column?.kind ?? "text";
    const numFmt = column ? NUMBER_FORMAT[kind] : undefined;
    const width = column ? Math.max(WIDTH[kind], column.field === "address" || column.field === "fullName" ? 34 : 0) : 26;
    return { key: `c${index}`, width, style: numFmt && kind !== "text" ? { numFmt } : {} };
  });

  const titleRow = sheet.getRow(1);
  titleRow.height = 30;
  titleRow.getCell(1).value = options.title;
  sheet.mergeCells(1, 1, 1, headers.length);
  titleRow.getCell(1).style = TITLE_STYLE;

  const headerRow = sheet.getRow(HEADER_ROW);
  headerRow.height = 45;
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.style = index < columns.length ? HEADER_STYLE : EXTRA_HEADER_STYLE;
  });

  for (const row of rows) {
    const record: Record<string, OutValue | undefined> = {};
    columns.forEach((column, index) => {
      const value = row.values[column.field];
      record[`c${index}`] = value === "" || value == null ? undefined : value;
    });
    extras.forEach((header, index) => {
      const value = row.extra[header];
      record[`c${columns.length + index}`] = value == null || value === "" ? undefined : value;
    });
    if (options.withOrigin) record[`c${headers.length - 1}`] = originText(row.origins);
    sheet.addRow(record);
  }

  await mkdir(path.dirname(file), { recursive: true });
  await workbook.xlsx.writeFile(file);
}

/* ---------------------------------------------------------------------------
   Nomlar va tuzatishlar fayli
   --------------------------------------------------------------------------- */

/** [3,4,5,9] -> "3–5, 9" */
function rowRanges(rows: readonly number[]): string {
  const sorted = [...new Set(rows)].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let index = 0; index < sorted.length; index++) {
    const start = sorted[index];
    while (index + 1 < sorted.length && sorted[index + 1] === sorted[index] + 1) index++;
    parts.push(start === sorted[index] ? String(start) : `${start}–${sorted[index]}`);
  }
  const text = parts.join(", ");
  return text.length > 1000 ? `${text.slice(0, 1000)}...` : text;
}

interface MonthFileInfo {
  month: string;
  file: string;
  sheetName: string;
  rows: number;
  source: string;
}

async function writeJournal(file: string, monthFiles: readonly MonthFileInfo[]) {
  const workbook = new ExcelJS.Workbook();
  const table = (name: string, headers: readonly [string, number][], data: readonly (string | number)[][]) => {
    const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
    sheet.columns = headers.map(([, width], index) => ({ key: `c${index}`, width }));
    const header = sheet.getRow(1);
    headers.forEach(([text], index) => {
      header.getCell(index + 1).value = text;
      header.getCell(index + 1).style = HEADER_STYLE;
    });
    header.height = 30;
    for (const row of data) sheet.addRow(Object.fromEntries(row.map((value, index) => [`c${index}`, value])));
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  };

  const kindOrder = ["Podstansiya", "Fider", "TP", "Xodim", "Manzil"];
  const nameRows = [...names.values()]
    .filter((entry) => entry.kind !== "TP" || entry.original !== entry.value)
    .sort(
      (a, b) =>
        kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) ||
        a.value.localeCompare(b.value, "uz") ||
        a.original.localeCompare(b.original, "uz"),
    )
    .map((entry) => [entry.kind, entry.value, entry.original, entry.count, [...entry.files].sort().join("; ")]);
  table(
    "Nomlar",
    [
      ["Turi", 14],
      ["Yakuniy nom", 34],
      ["Fayldagi yozuv", 44],
      ["Uchragan soni", 14],
      ["Fayllar", 90],
    ],
    nameRows,
  );

  const fixRows = [...fixes.values()]
    .sort((a, b) => a.file.localeCompare(b.file) || a.column.localeCompare(b.column) || a.rows[0] - b.rows[0])
    .map((entry) => [entry.file, entry.column, entry.original, entry.value, entry.reason, entry.rows.length, rowRanges(entry.rows)]);
  table(
    "Tuzatishlar",
    [
      ["Fayl", 44],
      ["Ustun", 26],
      ["Asl qiymat", 30],
      ["Yangi qiymat", 30],
      ["Sabab", 80],
      ["Qatorlar soni", 12],
      ["Qatorlar", 60],
    ],
    fixRows,
  );

  table(
    "Oylik fayllar",
    [
      ["Oy", 10],
      ["Fayl", 32],
      ["Varaq nomi", 20],
      ["Qatorlar", 10],
      ["Manba", 120],
    ],
    monthFiles.map((item) => [item.month, item.file, item.sheetName, item.rows, item.source]),
  );

  await workbook.xlsx.writeFile(file);
}

/* ---------------------------------------------------------------------------
   Asosiy oqim
   --------------------------------------------------------------------------- */

const FLOW_TEMPLATES: readonly TemplateType[] = ["SUBSTATIONS", "FEEDERS", "TRANSFORMERS"];
const EVENT_TEMPLATES = ["VIOLATIONS", "APPEALS"] as const;

/** Manba -> shablon -> davr -> tozalangan qatorlar. */
type Cleaned = Map<TemplateType, Map<PeriodKey, OutRow[]>>;

/** Oylik faylning noyob kaliti (import bilan bir xil). */
function monthKey(type: TemplateType, row: OutRow): string | null {
  const v = row.values;
  switch (type) {
    case "SUBSTATIONS":
      return nameKey(String(v.name));
    case "FEEDERS":
      return `${nameKey(String(v.substation))}|${nameKey(String(v.name))}`;
    case "TRANSFORMERS":
      return `${nameKey(String(v.substation))}|${nameKey(String(v.feeder))}|${nameKey(String(v.name))}`;
    case "SUBSCRIBERS":
      return contractKey(String(v.contract));
    default:
      return null;
  }
}

async function main() {
  await loadTemplateHeaders();

  const cleaned = new Map<SourceId, Cleaned>();
  const registries = new Map<SourceId, OutRow[]>();
  const refs = new Map<string, SheetRef>();
  const refKey = (source: SourceId, type: TemplateType, period: PeriodKey) => `${source}|${type}|${period}`;

  for (const source of SOURCES) {
    const byType: Cleaned = new Map();
    cleaned.set(source.id, byType);
    const put = (type: TemplateType, period: PeriodKey, rows: OutRow[]) => {
      const byPeriod = byType.get(type) ?? new Map<PeriodKey, OutRow[]>();
      byPeriod.set(period, rows);
      byType.set(type, byPeriod);
    };

    // 1. Oqimlar.
    for (const type of ["SUBSTATIONS", "FEEDERS", "TRANSFORMERS"] as const) {
      for (const period of PERIODS) {
        const ref = await locate(source, type, period);
        if (!ref) continue;
        refs.set(refKey(source.id, type, period.key), ref);
        const sheet = await readSource(ref, type);
        const rows =
          type === "SUBSTATIONS" ? cleanSubstations(sheet) : type === "FEEDERS" ? cleanFeeders(sheet) : cleanTransformers(sheet);
        put(type, period.key, rows);
        console.log(`o'qildi: ${ref.label} - ${rows.length} qator`);
      }
    }

    // 2. Abonentlar reestri.
    const registryFile = `${source.id}/${TEMPLATE_FILE_NAME.SUBSCRIBERS}`;
    const registryRef: SheetRef = { source, file: registryFile, sheet: null, label: registryFile, period: null };
    const registry = cleanSubscribers(await readSource(registryRef, "SUBSCRIBERS"));
    registries.set(source.id, registry);
    console.log(`o'qildi: ${registryFile} - ${registry.length} qator`);

    // 3. TP joylari: bo'sh kataklar, fider -> podstansiya, reestr.
    const tpByPeriod = byType.get("TRANSFORMERS") ?? new Map<PeriodKey, OutRow[]>();
    const august = tpByPeriod.get("avgust") ?? [];
    fillFromReference(tpByPeriod.get("sentabr") ?? [], august);
    const feeders = [...(byType.get("FEEDERS")?.values() ?? [])].flat();
    const map = feederSubstations(feeders, registry);
    for (const rows of tpByPeriod.values()) applyFeederSubstations(rows, map);
    const allTps = [...tpByPeriod.values()].flat();
    relocateFeeders(registry, allTps);
    locateSubscriberTps(registry, allTps);
  }

  // 4. Hodisalar (murojaat TP si manbaning TP ro'yxatidan, shartnomalar ikkala reestrdan).
  const allContracts = new Set(
    [...registries.values()].flat().map((row) => contractKey(String(row.values.contract))),
  );
  const tpNamesOf = (id: SourceId) =>
    new Set(
      [...(cleaned.get(id)?.get("TRANSFORMERS")?.values() ?? [])].flat().map((row) => nameKey(String(row.values.name))),
    );
  for (const source of SOURCES) {
    const byType = cleaned.get(source.id) as Cleaned;
    const tpIndex = buildTpIndex([...(byType.get("TRANSFORMERS")?.values() ?? [])].flat());
    const tpNames: TpNames = {
      own: tpNamesOf(source.id),
      other: new Set(SOURCES.filter((item) => item.id !== source.id).flatMap((item) => [...tpNamesOf(item.id)])),
    };
    for (const type of EVENT_TEMPLATES) {
      for (const period of PERIODS) {
        const ref = await locate(source, type, period);
        if (!ref) continue;
        refs.set(refKey(source.id, type, period.key), ref);
        const sheet = await readSource(ref, type);
        const rows =
          type === "VIOLATIONS" ? cleanViolations(sheet, tpNames) : cleanAppeals(sheet, tpIndex, tpNames, allContracts);
        const byPeriod = byType.get(type) ?? new Map<PeriodKey, OutRow[]>();
        byPeriod.set(period.key, rows);
        byType.set(type, byPeriod);
        console.log(`o'qildi: ${ref.label} - ${rows.length} qator`);
      }
    }
  }

  await rm(OUTPUT_DIR, { recursive: true, force: true });

  // 5. "tozalangan/" - manba davri o'zgarmagan.
  for (const source of SOURCES) {
    for (const [type, byPeriod] of cleaned.get(source.id) ?? []) {
      for (const [periodKey, rows] of byPeriod) {
        const period = periodOf(periodKey);
        await writeTemplate(path.join(OUTPUT_DIR, "tozalangan", source.id, period.folder, TEMPLATE_FILE_NAME[type]), type, rows, {
          sheetName: period.sheetName,
          title: `${TEMPLATE_LABEL[type]} ${period.titlePeriod} Holatiga Ko'ra`,
          withOrigin: true,
        });
      }
    }
    await writeTemplate(
      path.join(OUTPUT_DIR, "tozalangan", source.id, TEMPLATE_FILE_NAME.SUBSCRIBERS),
      "SUBSCRIBERS",
      registries.get(source.id) ?? [],
      { sheetName: "Abonentlar reestri", title: `${TEMPLATE_LABEL.SUBSCRIBERS} Sentabr Holatiga Ko'ra`, withOrigin: true },
    );
  }

  // 6. Oylarga ajratish (ikkala manba birga).
  const monthly = new Map<number, Map<TemplateType, OutRow[]>>();
  const monthSources = new Map<string, Set<string>>();
  const put = (month: number, type: TemplateType, rows: readonly OutRow[], label: string) => {
    const byType = monthly.get(month) ?? new Map<TemplateType, OutRow[]>();
    byType.set(type, [...(byType.get(type) ?? []), ...rows]);
    monthly.set(month, byType);
    const key = `${month}|${type}`;
    monthSources.set(key, (monthSources.get(key) ?? new Set<string>()).add(label));
  };

  for (const source of SOURCES) {
    const byType = cleaned.get(source.id) as Cleaned;
    for (const type of FLOW_TEMPLATES) {
      for (const [periodKey, rows] of byType.get(type) ?? []) {
        const period = periodOf(periodKey);
        const label = refs.get(refKey(source.id, type, periodKey))?.label ?? source.id;
        if (period.months.length === 1) {
          put(period.months[0], type, rows, label);
        } else {
          for (const [month, split] of splitFlows(type, rows, period)) {
            put(month, type, split, `${label} (1/${period.months.length} qismi)`);
          }
        }
      }
    }
  }

  for (const type of EVENT_TEMPLATES) {
    const groups: OutRow[][] = [];
    const covered = new Set<number>();
    for (const source of SOURCES) {
      for (const period of PERIODS) {
        const rows = cleaned.get(source.id)?.get(type)?.get(period.key);
        if (!rows) continue;
        groups.push(rows);
        for (const month of period.months) covered.add(month);
      }
    }
    const merged = mergeEvents(type, groups);
    const outside = merged.filter((row) => !covered.has(row.month ?? 0));
    if (outside.length > 0) {
      throw new Error(`${TEMPLATE_LABEL[type]}: ${outside.length} ta yozuv manba qamramagan oyda (${originText(outside[0].origins)})`);
    }
    // Manba fayllari qamragan har bir oy uchun fayl bo'ladi (yozuv bo'lmasa ham - "0 ta").
    for (const month of covered) {
      const rows = merged
        .filter((row) => row.month === month)
        .sort((a, b) => a.source.localeCompare(b.source) || (a.stamp ?? "").localeCompare(b.stamp ?? ""));
      put(month, type, rows, "sanasi shu oyga tushgan yozuvlar");
    }
  }

  const subscribers = SOURCES.flatMap((source) => registries.get(source.id) ?? []).filter((row) => !row.excluded);
  disambiguateContracts(subscribers);
  // Bitta hisoblagich raqami ikki xil shartnomada - manbadagidek qoldiriladi, jurnalga yoziladi.
  const bySerial = new Map<string, OutRow[]>();
  for (const row of subscribers) {
    if (row.values.meterSerial == null) continue;
    bySerial.set(String(row.values.meterSerial), [...(bySerial.get(String(row.values.meterSerial)) ?? []), row]);
  }
  for (const [serial, rows] of bySerial) {
    if (new Set(rows.map((row) => contractKey(String(row.values.contract)))).size < 2) continue;
    for (const row of rows) {
      logFix(
        row.origins[0].file,
        row.origins[0].row,
        headerOf("SUBSCRIBERS", "meterSerial"),
        serial,
        "(o'zgartirilmadi)",
        `Bitta hisoblagich raqami ${rows.length} ta turli shartnomada (${rows.map((item) => String(item.values.contract)).join(", ")}) - manba xatosi, qiymat o'zgartirilmadi`,
      );
    }
  }
  for (const source of SOURCES) put(9, "SUBSCRIBERS", subscribers.filter((row) => row.source === source.id), `${source.id}/${TEMPLATE_FILE_NAME.SUBSCRIBERS}`);

  // 7. Oylik fayllar: kalitlar noyobligi tekshiriladi.
  const monthFiles: MonthFileInfo[] = [];
  for (const month of [...monthly.keys()].sort((a, b) => a - b)) {
    for (const type of ["SUBSTATIONS", "FEEDERS", "TRANSFORMERS", "SUBSCRIBERS", "VIOLATIONS", "APPEALS"] as const) {
      const rows = monthly.get(month)?.get(type);
      if (!rows) continue;
      const seen = new Map<string, OutRow>();
      for (const row of rows) {
        const key = monthKey(type, row);
        if (key == null) continue;
        const other = seen.get(key);
        if (other) throw new Error(`${monthFolder(month)} ${TEMPLATE_LABEL[type]}: takroriy kalit "${key}" (${originText(other.origins)} va ${originText(row.origins)})`);
        seen.set(key, row);
      }
      const sheetName = monthSheetName(month);
      await writeTemplate(path.join(OUTPUT_DIR, "oylik", monthFolder(month), TEMPLATE_FILE_NAME[type]), type, rows, {
        sheetName,
        title: `${TEMPLATE_LABEL[type]} ${MONTHS_UZ[month - 1]} Holatiga Ko'ra`,
        withOrigin: true,
      });
      monthFiles.push({
        month: monthFolder(month),
        file: TEMPLATE_FILE_NAME[type],
        sheetName,
        rows: rows.length,
        source: [...(monthSources.get(`${month}|${type}`) ?? [])].join("; "),
      });
    }
  }

  await writeJournal(path.join(OUTPUT_DIR, "Nomlar va tuzatishlar.xlsx"), monthFiles);

  // 8. Hisobot uchun: manbalararo to'qnashuvlar.
  const contractSources = new Map<string, SourceId>();
  for (const row of subscribers) contractSources.set(contractKey(String(row.values.contract)), row.source);
  const foreign = [...monthly.values()]
    .flatMap((byType) => [...(byType.get("VIOLATIONS") ?? []), ...(byType.get("APPEALS") ?? [])])
    .filter((row) => {
      const owner = contractSources.get(contractKey(String(row.values.subscriber)));
      return owner != null && owner !== row.source;
    });
  const tpPlaces = new Map<string, Set<string>>();
  for (const row of [...monthly.values()].flatMap((byType) => byType.get("TRANSFORMERS") ?? [])) {
    const set = tpPlaces.get(nameKey(String(row.values.name))) ?? new Set<string>();
    set.add(`${String(row.values.substation)}|${String(row.values.feeder)}`);
    tpPlaces.set(nameKey(String(row.values.name)), set);
  }

  console.log("\nOylik fayllar:");
  for (const item of monthFiles) console.log(`  ${item.month}  ${item.file.padEnd(30)} ${String(item.rows).padStart(6)}  ${item.source}`);
  if (unknownAddresses.size > 0) {
    console.log("\nMFY lug'atida yo'q manzillar (lotinda qoldi):");
    for (const [text, count] of unknownAddresses) console.log(`  ${text} (${count})`);
  }
  console.log(`\nBoshqa manba shartnomasiga to'g'ri kelgan hodisa "Abonent" lari: ${foreign.length}`);
  console.log(`Bir nechta fiderda uchraydigan TP nomlari: ${[...tpPlaces.values()].filter((set) => set.size > 1).length}`);
  console.log(`Nomlar: ${names.size} ta yozuv, tuzatishlar: ${fixes.size} ta guruh`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
