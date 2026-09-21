import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { TemplateType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { TEMPLATE_ORDER } from "@/lib/domain/labels";
import { monthKey, monthLabel } from "@/lib/format";

/*
 * Tanlangan hisobot oyi. Barcha sahifalar SHU funksiya orqali davrni oladi -
 * bir sahifa avgustni, boshqasi sentabrni ko'rsatib qolmasligi uchun.
 * Qoidalar: `.claude/docs/malumotlar.md` 2 va 6-bo'limlar.
 */

/** Cookie nomi; qiymati `"2026-09"`. */
export const PERIOD_COOKIE = "period";

/** Mijozga uzatiladigan (serializable) davr ma'lumoti. */
export interface PeriodInfo {
  id: string;
  /** "2026-09" */
  key: string;
  /** Oyning 1-kuni, ISO. */
  month: string;
  /** Varaq nomidagi eng so'nggi sana, ISO. */
  reportDate: string;
  /** "Sentabr 2026" */
  label: string;
}

function toInfo(row: { id: string; month: Date; reportDate: Date }): PeriodInfo {
  return {
    id: row.id,
    key: monthKey(row.month),
    month: row.month.toISOString(),
    reportDate: row.reportDate.toISOString(),
    label: monthLabel(row.month),
  };
}

/** Barcha davrlar, yangidan eskiga. */
export const listPeriods = cache(async (): Promise<PeriodInfo[]> => {
  const rows = await prisma.period.findMany({
    orderBy: { month: "desc" },
    select: { id: true, month: true, reportDate: true },
  });
  return rows.map(toInfo);
});

/**
 * Cookie'dagi oy; u yo'q yoki bazada bo'lmasa - eng so'nggi davr.
 * Bazada davr yo'q bo'lsa - null (sahifa "Ma’lumot hali yuklanmagan" ko'rsatadi).
 */
export const getSelectedPeriod = cache(async (): Promise<PeriodInfo | null> => {
  // Cookie bazadan OLDIN o'qiladi: aks holda bo'sh bazada build qilinganda
  // sahifa `cookies()` ga yetmay statik prerender bo'lib qoladi, ma'lumot
  // yuklangach esa qayta chizishda `cookies()` chaqirilib 500 qaytaradi.
  const store = await cookies();
  const periods = await listPeriods();
  if (periods.length === 0) return null;
  const wanted = store.get(PERIOD_COOKIE)?.value;
  return periods.find((period) => period.key === wanted) ?? periods[0];
});

/** Aynan bir oy oldingi davr (`month - 1`). Bazada bo'lmasa - null. */
export async function getPreviousPeriod(period: PeriodInfo): Promise<PeriodInfo | null> {
  const month = new Date(period.month);
  const previous = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1));
  const periods = await listPeriods();
  return periods.find((item) => item.key === monthKey(previous)) ?? null;
}

/**
 * Tanlangan oygacha (u ham kiradi) bo'lgan davrlar, eskidan yangiga,
 * eng ko'pi `limit` ta - dinamika grafiklari uchun.
 */
export async function getPeriodsUntil(period: PeriodInfo, limit = 12): Promise<PeriodInfo[]> {
  const periods = await listPeriods();
  return periods
    .filter((item) => item.month <= period.month)
    .slice(0, limit)
    .reverse();
}

/**
 * Tanlangan oy yilining yil boshidan shu oygacha (u ham kiradi) bo'lgan
 * davrlari, eskidan yangiga. "Yil boshidan" ko'rsatkichlari uchun -
 * `getPeriodsUntil` dan farqi: oldingi yil oylari kirmaydi.
 */
export async function getYearPeriods(period: PeriodInfo): Promise<PeriodInfo[]> {
  const year = new Date(period.month).getUTCFullYear();
  const periods = await listPeriods();
  return periods
    .filter((item) => item.month <= period.month && new Date(item.month).getUTCFullYear() === year)
    .reverse();
}

/**
 * Shu oyga qaysi shablonlar muvaffaqiyatli yuklangan. "0 ta qoidabuzarlik"
 * (yuklangan, lekin bo'sh) va "yuklanmagan" ni farqlash uchun.
 */
export const getPeriodUploads = cache(
  async (periodId: string): Promise<Record<TemplateType, boolean>> => {
    const rows = await prisma.importBatch.findMany({
      where: { periodId, status: "COMPLETED" },
      distinct: ["templateType"],
      select: { templateType: true },
    });
    const uploaded = new Set(rows.map((row) => row.templateType));
    return Object.fromEntries(
      TEMPLATE_ORDER.map((type) => [type, uploaded.has(type)]),
    ) as Record<TemplateType, boolean>;
  },
);
