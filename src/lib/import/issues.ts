import { type ImportIssue, MAX_STORED_ISSUES } from "./types";

/**
 * Xato/ogohlantirish ro'yxati: jami sonini sanaydi, lekin faqat birinchi
 * `MAX_STORED_ISSUES` tasini saqlaydi (50 000 qatorli faylda har bir qator
 * xato bo'lsa ham javob va baza yozuvi cheklangan bo'lsin).
 */
export class IssueList {
  readonly items: ImportIssue[] = [];
  count = 0;

  add(row: number | null, column: string | null, message: string): void {
    this.count += 1;
    if (this.items.length < MAX_STORED_ISSUES) this.items.push({ row, column, message });
  }

  get empty(): boolean {
    return this.count === 0;
  }

  /**
   * Bazaga yoziladigan ko'rinish: saqlanmay qolganlar bo'lsa, oxirida
   * "yana N ta" degan yig'ma yozuv.
   */
  toJson(): ImportIssue[] {
    const hidden = this.count - this.items.length;
    if (hidden <= 0) return [...this.items];
    return [...this.items, { row: null, column: null, message: `${HIDDEN_PREFIX}${hidden} ta` }];
  }
}

const HIDDEN_PREFIX = "... va yana ";

/**
 * Kutilmagan xatoning foydalanuvchiga ko'rsatiladigan qisqa matni. Prisma
 * xabari bo'sh qatordan boshlanadi va sababi oxirgi qatorda ("Can't reach
 * database server ...") - shuning uchun oxirgi bo'sh bo'lmagan qator olinadi.
 */
export function errorDetail(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return (lines.at(-1) ?? (error instanceof Error ? error.name : "noma’lum xato")).slice(0, 300);
}

/**
 * `toJson()` natijasidagi jami son (yig'ma yozuv hisobga olinadi) - ro'yxat
 * uzunligi va oxirgi yozuvidan. Ro'yxatning o'zi o'qilmaydi: `history.ts`
 * ikkalasini SQL da oladi.
 */
export function storedIssueTotal(length: number, last: { message: string; hasRow: boolean } | null): number {
  const match =
    last && !last.hasRow && last.message.startsWith(HIDDEN_PREFIX) ? /(\d+) ta$/.exec(last.message) : null;
  return match ? length - 1 + Number(match[1]) : length;
}
