/*
 * Hisobot fayllari uchun matn yordamchilari (PDF va fayl nomi).
 *
 * Shablonlarda kirill va lotin yozuvi aralash keladi, o'zbekcha apostrof esa
 * turli belgilarda (ʻ ʼ ‘ ’ `). PDF faqat WinAnsi (Helvetica) bilan
 * yoziladi, fayl nomining zaxira varianti esa sof ASCII bo'lishi shart -
 * shuning uchun kirill lotinga o'giriladi.
 */

/** Kirill -> lotin (o'zbek va rus harflari). Apostrof - tipografik ’. */
const CYRILLIC: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "x",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "’",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  ў: "o’",
  қ: "q",
  ғ: "g’",
  ҳ: "h",
  і: "i",
  є: "ye",
  ї: "yi",
  "№": "No",
};

/** Bu harflardan keyin (va so'z boshida) "е" - "ye". */
const YE_AFTER = new Set("аеёиоуэюяўъьАЕЁИОУЭЮЯЎЪЬ");

function isLetter(char: string | undefined): boolean {
  return char != null && /\p{L}/u.test(char);
}

function isUpper(char: string | undefined): boolean {
  return char != null && char !== char.toLowerCase() && char === char.toUpperCase();
}

/** "Ўзбекистон" -> "O’zbekiston", "ШАҲАР" -> "SHAHAR". Lotin matn o'zgarmaydi. */
export function transliterate(text: string): string {
  const chars = Array.from(text);
  let out = "";
  chars.forEach((char, index) => {
    const lower = char.toLowerCase();
    let latin = CYRILLIC[lower];
    if (latin === undefined) {
      out += char;
      return;
    }
    if (lower === "е") {
      const previous = chars[index - 1];
      if (!isLetter(previous) || YE_AFTER.has(previous)) latin = "ye";
    }
    if (!isUpper(char) || latin === "") {
      out += latin;
      return;
    }
    // Katta harf: qo'shni harf ham katta bo'lsa ("ШАҲАР") - to'liq katta.
    const neighbour = isLetter(chars[index + 1]) ? chars[index + 1] : chars[index - 1];
    const allCaps = latin.length > 1 && isLetter(neighbour) && isUpper(neighbour);
    out += allCaps ? latin.toUpperCase() : latin.charAt(0).toUpperCase() + latin.slice(1);
  });
  return out;
}

/**
 * Fayl nomining ASCII varianti: `"Bo’ston podstansiyasi"` -> `"boston-podstansiyasi"`.
 * Bo'sh natija bo'lsa - `fallback`.
 */
export function asciiSlug(text: string, fallback = "hisobot"): string {
  const slug = transliterate(text)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘ʻʼ'`´′]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

/**
 * `Content-Disposition` sarlavhasi: ASCII zaxira nomi va RFC 5987 bo'yicha
 * kodlangan asl (Unicode) nom.
 */
export function contentDisposition(asciiName: string, unicodeName: string): string {
  const safeAscii = asciiName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(unicodeName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}
