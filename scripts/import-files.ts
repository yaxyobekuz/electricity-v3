/*
 * Excel fayllarni buyruq qatoridan tekshirish / yuklash.
 *
 *   npx tsx --conditions=react-server scripts/import-files.ts [--commit] [--json] <fayl...>
 *
 * `--commit` bo'lmasa - faqat tekshiradi (bazaga yozilmaydi). Sahifadagi
 * "Tekshirish" / "Saqlash" bilan aynan bir xil quvur (`src/lib/import`).
 * `--json` - natijani JSON ko'rinishida chiqaradi.
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { config } from "dotenv";

import { TEMPLATE_LABEL } from "@/lib/domain/labels";
import { formatDate, monthLabel, parseMonthKey } from "@/lib/format";
import type { ImportIssue, ImportResult } from "@/lib/import/types";
import type { ImportFileInput } from "@/lib/import/workbook";
import { MAX_FILES } from "@/lib/import/types";

function issueLine(issue: ImportIssue): string {
  const where = [issue.row != null ? `${issue.row}-qator` : null, issue.column].filter(Boolean).join(", ");
  return `     - ${where ? `[${where}] ` : ""}${issue.message}`;
}

function printReport(result: ImportResult) {
  const lines: string[] = [];
  const mode = result.mode === "commit" ? "Saqlash" : "Tekshirish";
  lines.push(`${mode}: ${result.valid ? "xatosiz" : "XATO BOR"}${result.committed ? " - saqlandi" : ""}`);
  if (result.message) lines.push(result.message);

  for (const file of result.files) {
    lines.push("", `== ${file.fileName}`);
    const template = file.templateType ? TEMPLATE_LABEL[file.templateType] : "aniqlanmadi";
    const month = file.month ? monthLabel(parseMonthKey(file.month)) : "—";
    lines.push(`   Shablon: ${template} | Oy: ${month} | Hisobot sanasi: ${formatDate(file.reportDate)}`);
    // O'tgan zamon - faqat haqiqatan saqlangan bo'lsa.
    const [created, updated, removed] = result.committed
      ? ["qo’shildi", "yangilandi", "o’chirildi"]
      : ["qo’shiladi", "yangilanadi", "o’chiriladi"];
    lines.push(
      `   Jami qator: ${file.totalRows} | ${created}: ${file.createdRows} | ${updated}: ${file.updatedRows} | ${removed}: ${file.removedRows}`,
    );
    if (file.batchId) lines.push(`   ImportBatch: ${file.batchId}`);
    if (file.errorCount > 0) {
      lines.push(`   Xatolar (${file.errorCount}):`, ...file.errors.map(issueLine));
      if (file.errorCount > file.errors.length) {
        lines.push(`     ... va yana ${file.errorCount - file.errors.length} ta`);
      }
    }
    if (file.warningCount > 0) {
      lines.push(`   Ogohlantirishlar (${file.warningCount}):`, ...file.warnings.map(issueLine));
    }
  }
  console.log(lines.join("\n"));
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const json = args.includes("--json");
  const paths = args.filter((arg) => !arg.startsWith("--"));

  if (paths.length === 0 || paths.length > MAX_FILES) {
    console.error(
      `Foydalanish: npx tsx --conditions=react-server scripts/import-files.ts [--commit] [--json] <1..${MAX_FILES} ta .xlsx fayl>`,
    );
    process.exit(2);
  }

  // `.env` dagi NODE_ENV=development Prisma'da har bir so'rovni chiqaradi -
  // CLI da bu shovqin kerak emas. Baza klienti shundan keyin yuklanadi.
  Object.assign(process.env, { NODE_ENV: process.env.NODE_ENV ?? "production" });
  config({ quiet: true });
  const { runImport } = await import("@/lib/import");

  const inputs: ImportFileInput[] = [];
  for (const path of paths) {
    const data = await readFile(path);
    inputs.push({ name: basename(path), data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) });
  }

  const result = await runImport(commit ? "commit" : "validate", inputs);
  if (json) console.log(JSON.stringify(result, null, 2));
  else printReport(result);
  process.exit(result.valid && (!commit || result.committed) ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
