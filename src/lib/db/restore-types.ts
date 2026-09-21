/*
 * To'liq baza nusxasini (pg_dump) tiklash uchun umumiy tiplar. Runtime kod
 * yo'q - mijoz komponenti ham shu fayldan o'qiydi (`src/lib/db/restore.ts`
 * `server-only`, uni mijozga import qilib bo'lmaydi).
 */

/** `pg_dump -Fc` arxivi yoki oddiy SQL matn (`pg_dump` standart formati). */
export type DumpFormat = "custom" | "plain";

/** Yuklanadigan dump faylining eng katta hajmi. */
export const MAX_DUMP_BYTES = 2 * 1024 * 1024 * 1024;

/** Fayl tanlashda ko'rsatiladigan kengaytmalar (server mazmun bo'yicha aniqlaydi). */
export const DUMP_ACCEPT = ".dump,.backup,.sql,.gz";

export interface RestoreResult {
  ok: boolean;
  fileName: string;
  fileSize: number;
  /** Fayl mazmunidan aniqlangan format; aniqlanmasa - null. */
  format: DumpFormat | null;
  /** Tiklash davomiyligi, millisekund (yuklash vaqti hisobga olinmaydi). */
  durationMs: number;
  /** Foydalanuvchiga ko'rsatiladigan xabar. */
  message: string;
  /** `psql` / `pg_restore` chiqarganining oxiri - xatoni tushunish uchun. */
  log: string;
}
