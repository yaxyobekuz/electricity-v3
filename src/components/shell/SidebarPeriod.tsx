import { unstable_rethrow } from "next/navigation";

import { getSelectedPeriod, listPeriods } from "@/lib/period";

import { PeriodSelect } from "./PeriodSelect";

/**
 * Yon paneldagi oy tanlagichining server qismi: davrlar ro'yxati (baza) va
 * tanlangan oy (cookie) shu yerda o'qiladi.
 *
 * Maket sinxron qoladi va buni `<Suspense>` ichida chizadi - aks holda
 * `loading.tsx` maketni o'ray olmaydi va har bir o'tish baza javobini
 * kutib qolardi.
 *
 * Xato maketdan tashqariga chiqmasligi kerak: `(workspace)/error.tsx`
 * o'zi turgan papkadagi maketni o'ramaydi va foydalanuvchi Next'ning
 * inglizcha xato sahifasini ko'rardi. Shuning uchun bu yerda xato ushlanadi,
 * sahifaning o'zi esa (u ham `getSelectedPeriod()` ni chaqiradi) `error.tsx`
 * orqali o'zbekcha xabar va "Qayta urinish" tugmasini ko'rsatadi.
 */
export async function SidebarPeriod() {
  const data = await loadPeriods();
  if (!data) return <PeriodUnavailable />;
  return <PeriodSelect periods={data.periods} selectedKey={data.selectedKey} />;
}

/** Davrlar va tanlangan oy kaliti; bazaga ulanib bo'lmasa - null. */
async function loadPeriods() {
  try {
    const [periods, selected] = await Promise.all([listPeriods(), getSelectedPeriod()]);
    return { periods, selectedKey: selected?.key ?? null };
  } catch (error) {
    // `cookies()` kabi Next ichki xatolarini yutib yubormaslik uchun.
    unstable_rethrow(error);
    console.error(error);
    return null;
  }
}

/** Davrlar kelguncha - tanlagich o'lchamidagi skelet (joy sakramasin). */
export function SidebarPeriodSkeleton() {
  return (
    <div aria-hidden className="flex shrink-0 flex-col gap-1 pb-2">
      <span className="h-8 w-full animate-pulse rounded-full bg-canvas" />
      <span className="mx-3 my-0.5 h-3 w-32 animate-pulse rounded-full bg-canvas" />
    </div>
  );
}

/**
 * Baza bilan aloqa yo'q. "Ma’lumot yuklanmagan" deyilmaydi - ma'lumot
 * yuklangan bo'lishi mumkin, faqat hozir o'qib bo'lmadi.
 */
function PeriodUnavailable() {
  return (
    <p
      role="status"
      className="mb-2 shrink-0 truncate rounded-xl bg-canvas px-3 py-2.5 text-xs text-ink-muted"
    >
      Hisobot oylarini olib bo’lmadi
    </p>
  );
}
