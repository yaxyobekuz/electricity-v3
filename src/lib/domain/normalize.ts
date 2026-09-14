/*
 * Shablonlar obyektlarni faqat NOM bilan bog'laydi (fider -> "Podstansiya",
 * qoidabuzarlik -> "TP Nomi"). Bir xil nom turli fayllarda turlicha yozilishi
 * mumkin: apostrof (’ ‘ ʻ ʼ ' `), ortiqcha bo'shliq, katta-kichik harf.
 * Solishtirish har doim shu kalitlar orqali qilinadi; foydalanuvchiga esa
 * fayldagi asl yozuv ko'rsatiladi.
 */

const APOSTROPHES = /[‘’ʻʼ`´′]/g;

/** Matnni tozalaydi: bo'shliqlar bittaga, chetlari kesiladi. Bo'sh - null. */
export function cleanText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const text = value.normalize("NFC").replace(/\s+/g, " ").trim();
  return text === "" ? null : text;
}

/** Nom solishtirish kaliti: "Chinobod  O‘rta" -> "chinobod o'rta". */
export function nameKey(value: string): string {
  return (cleanText(value) ?? "").replace(APOSTROPHES, "'").toLowerCase();
}

/** Shartnoma raqami kaliti: "ab 104 512" -> "AB104512". */
export function contractKey(value: string): string {
  return (cleanText(value) ?? "").replace(APOSTROPHES, "'").replace(/\s+/g, "").toUpperCase();
}
