"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { listPeriods, PERIOD_COOKIE } from "@/lib/period";

/** Cookie muddati - bir yil, soniyalarda. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * Yon paneldagi oy tanlagichi chaqiradi: tanlangan hisobot oyini cookie'ga
 * yozadi. Kalit (`"2026-09"`) faqat bazada bor davrlar orasidan qabul
 * qilinadi - aks holda cookie o'zgarmaydi va `false` qaytadi.
 *
 * Server action ichida cookie o'rnatilsa Next joriy sahifa va maketlarni
 * serverda qayta chizadi. `revalidatePath` esa oldin ochilgan sahifalarning
 * mijoz keshini ham tozalaydi - boshqa sahifaga o'tganda eski oy qolmasin.
 */
export async function selectPeriod(key: string): Promise<boolean> {
  if (typeof key !== "string") return false;

  const periods = await listPeriods();
  if (!periods.some((period) => period.key === key)) return false;

  const store = await cookies();
  store.set(PERIOD_COOKIE, key, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return true;
}
