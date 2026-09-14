import type { TemplateType } from "@/generated/prisma";

/**
 * Bo'sh shablonlarning `public/templates/` dagi nusxalari. URL da ASCII nom,
 * yuklab olinganda esa asl nom (`TEMPLATE_FILE_NAME`) beriladi.
 */
export const TEMPLATE_DOWNLOAD_PATH: Record<TemplateType, string> = {
  SUBSTATIONS: "/templates/elektr-podstansiyalar.xlsx",
  FEEDERS: "/templates/elektr-fiderlar.xlsx",
  TRANSFORMERS: "/templates/elektr-transformatorlar.xlsx",
  SUBSCRIBERS: "/templates/elektr-abonentlar.xlsx",
  VIOLATIONS: "/templates/elektr-qoidabuzarliklar.xlsx",
  APPEALS: "/templates/elektr-murojaatlar.xlsx",
};

/**
 * Yuklash bosqichi: har bir shablon o'zidan oldingi bosqichga tayanadi.
 * Qoidabuzarliklar va murojaatlar bir-biriga bog'liq emas - bitta bosqich.
 */
export const TEMPLATE_STEP: Record<TemplateType, number> = {
  SUBSTATIONS: 1,
  FEEDERS: 2,
  TRANSFORMERS: 3,
  SUBSCRIBERS: 4,
  VIOLATIONS: 5,
  APPEALS: 5,
};

/** "2,7 MB", "812 KB" */
export function fileSizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
