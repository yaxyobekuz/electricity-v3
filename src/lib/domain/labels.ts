import type {
  AppealStatus,
  MeterStatus,
  SubscriberKind,
  TemplateType,
  ViolatorType,
} from "@/generated/prisma";

/*
 * Enum qiymatlarining UI yorliqlari. Matnlar Excel shablonidagi yozuv bilan
 * bir xil (faqat apostrof tipografik: ’) - foydalanuvchi faylda nima yozgan
 * bo'lsa, sahifada ham shuni ko'radi.
 *
 * `import type` - mijoz komponentlariga Prisma runtime tushmaydi.
 */

/** Yuklash tartibi: har bir shablon o'zidan oldingilariga tayanadi. */
export const TEMPLATE_ORDER: readonly TemplateType[] = [
  "SUBSTATIONS",
  "FEEDERS",
  "TRANSFORMERS",
  "SUBSCRIBERS",
  "VIOLATIONS",
  "APPEALS",
];

export const TEMPLATE_LABEL: Record<TemplateType, string> = {
  SUBSTATIONS: "Podstansiyalar",
  FEEDERS: "Fiderlar",
  TRANSFORMERS: "Transformatorlar",
  SUBSCRIBERS: "Abonentlar",
  VIOLATIONS: "Qoidabuzarliklar",
  APPEALS: "Murojaatlar",
};

/** Namuna fayl nomi (`data_template/` dagi). */
export const TEMPLATE_FILE_NAME: Record<TemplateType, string> = {
  SUBSTATIONS: "Elektr Podstansiyalar.xlsx",
  FEEDERS: "Elektr Fiderlar.xlsx",
  TRANSFORMERS: "Elektr Transformatorlar.xlsx",
  SUBSCRIBERS: "Elektr Abonentlar.xlsx",
  VIOLATIONS: "Elektr Qoidabuzarliklar.xlsx",
  APPEALS: "Elektr Murojaatlar.xlsx",
};

export const SUBSCRIBER_KIND_LABEL: Record<SubscriberKind, string> = {
  HOUSEHOLD: "Aholi",
  LEGAL: "Yuridik",
};

export const SUBSCRIBER_KIND_ORDER: readonly SubscriberKind[] = ["HOUSEHOLD", "LEGAL"];

export const METER_STATUS_LABEL: Record<MeterStatus, string> = {
  ONLINE: "Aloqada",
  NOT_RESPONDING: "Aloqaga chiqmayotgan",
  SCHEME_CHANGED: "Sxemasi o’zgartirilgan",
};

export const METER_STATUS_ORDER: readonly MeterStatus[] = [
  "ONLINE",
  "NOT_RESPONDING",
  "SCHEME_CHANGED",
];

export const VIOLATOR_TYPE_LABEL: Record<ViolatorType, string> = {
  LEGAL: "Yuridik",
  INDIVIDUAL: "Jismoniy",
  INNOCENT: "Aybisiz",
};

export const VIOLATOR_TYPE_ORDER: readonly ViolatorType[] = ["LEGAL", "INDIVIDUAL", "INNOCENT"];

export const APPEAL_STATUS_LABEL: Record<AppealStatus, string> = {
  RESOLVED: "Ijobiy hal etilgan",
  REJECTED: "Rad etilgan",
  IN_PROGRESS: "Jarayonda",
  OVERDUE: "Muddati buzilgan",
};

export const APPEAL_STATUS_ORDER: readonly AppealStatus[] = [
  "RESOLVED",
  "IN_PROGRESS",
  "REJECTED",
  "OVERDUE",
];

/** TP ta'mir sanasi turi ("Joriy ta'mir sanasi" / "To'la ta'mir sanasi"). */
export type RepairType = "CURRENT" | "OVERHAUL";

export const REPAIR_TYPE_LABEL: Record<RepairType, string> = {
  CURRENT: "Joriy ta’mir",
  OVERHAUL: "To’la ta’mir",
};

export const REPAIR_TYPE_ORDER: readonly RepairType[] = ["CURRENT", "OVERHAUL"];
