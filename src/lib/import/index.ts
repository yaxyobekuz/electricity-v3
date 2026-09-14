import { prisma } from "@/lib/db/prisma";

import { commitImport, type CommitOptions } from "./commit";
import type { ImportMode, ImportResult } from "./types";
import { validateImport } from "./validate";
import type { ImportFileInput } from "./workbook";

/*
 * Import quvurining kirish nuqtasi (API route va CLI). `next/*` ni import
 * qilmaydi - CLI skriptida ham ishlaydi.
 */

export type { ImportFileInput } from "./workbook";
export { errorDetail } from "./issues";
export * from "./types";

/** `validate` - faqat tekshirish (bazaga yozilmaydi); `commit` - tekshirib saqlash. */
export async function runImport(
  mode: ImportMode,
  inputs: readonly ImportFileInput[],
  options: CommitOptions = {},
): Promise<ImportResult> {
  return mode === "commit" ? commitImport(inputs, options) : validateImport(prisma, inputs);
}
