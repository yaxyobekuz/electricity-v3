import type { ImportStatus, TemplateType } from "@/generated/prisma";

/*
 * Import natijalarining umumiy tiplari. Runtime kod yo'q - mijoz komponentlari
 * ham shu faylni (`import type`) ishlatadi. Qoidalar:
 * `.claude/docs/malumotlar.md` 4-bo'lim.
 */

/** Bitta xato yoki ogohlantirish. `row` - Excel qator raqami (fayl darajasida null). */
export interface ImportIssue {
  row: number | null;
  column: string | null;
  message: string;
}

/** Bir faylda saqlanadigan xato/ogohlantirishlarning eng ko'p soni (jami soni alohida). */
export const MAX_STORED_ISSUES = 500;

/** Bitta yuklashdagi fayllar soni chegarasi. */
export const MAX_FILES = 6;

/** Bitta faylning eng katta hajmi (abonentlar fayli o'nlab MB bo'lishi mumkin). */
export const MAX_FILE_BYTES = 64 * 1024 * 1024;

export type ImportMode = "validate" | "commit";

/** Bitta faylning tekshiruv / saqlash natijasi. */
export interface ImportFileReport {
  /** Submission ichidagi tartib raqami (foydalanuvchi tanlagan tartib). */
  index: number;
  fileName: string;
  fileSize: number;
  sheetName: string | null;
  /** Aniqlangan shablon; aniqlanmasa - null. */
  templateType: TemplateType | null;
  /** Varaq nomidagi sana, ISO (UTC yarim tun). */
  reportDate: string | null;
  /** Hisobot oyi kaliti: "2026-09". */
  month: string | null;
  /** Ma'lumot qatorlari soni (bo'sh qatorlarsiz). */
  totalRows: number;
  /** Shu oyda avval bo'lmagan, endi qo'shiladigan yozuvlar. */
  createdRows: number;
  /** Shu oyda bor, yangilanadigan yozuvlar. */
  updatedRows: number;
  /** Shu oyda bor, yangi faylda yo'q - o'chiriladigan yozuvlar. */
  removedRows: number;
  /** Birinchi `MAX_STORED_ISSUES` ta xato. */
  errors: ImportIssue[];
  /** Xatolarning jami soni. */
  errorCount: number;
  warnings: ImportIssue[];
  warningCount: number;
  /** Saqlangan bo'lsa - `ImportBatch.id`. */
  batchId: string | null;
}

/** `POST /api/imports` javobi va CLI natijasi. */
export interface ImportResult {
  mode: ImportMode;
  /** Barcha fayllar xatosiz. */
  valid: boolean;
  /** Bazaga yozildi (faqat `commit` rejimida true bo'lishi mumkin). */
  committed: boolean;
  /** Fayllar `TEMPLATE_ORDER` tartibida. */
  files: ImportFileReport[];
  /** Fayllarga tegishli bo'lmagan umumiy xabar (masalan, kutilmagan xato). */
  message: string | null;
}

/** Yuklash tarixidagi bitta yozuv. */
export interface ImportHistoryItem {
  id: string;
  templateType: TemplateType;
  status: ImportStatus;
  fileName: string;
  fileSize: number;
  sheetName: string | null;
  /** "2026-09" yoki null. */
  month: string | null;
  reportDate: string | null;
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  removedRows: number;
  errorCount: number;
  warningCount: number;
  /** Birinchi xato matni (ro'yxatda qisqa ko'rsatish uchun). */
  firstError: string | null;
  createdAt: string;
}

/** Qamrov matritsasining bitta katagi (oy x shablon). */
export interface CoverageCell {
  /** COMPLETED - ma'lumot bor; FAILED - faqat muvaffaqiyatsiz urinish; null - yuklanmagan. */
  status: ImportStatus | null;
  reportDate: string | null;
  totalRows: number | null;
  createdAt: string | null;
}

export interface CoverageRow {
  periodId: string;
  /** "2026-09" */
  month: string;
  /** "Sentabr 2026" */
  label: string;
  reportDate: string;
  cells: Record<TemplateType, CoverageCell>;
}
