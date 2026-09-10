"use client";

import { ResponsiveLine } from "@nivo/line";
import { useMemo } from "react";

import { cn } from "@/lib/ui/cn";

/**
 * Shkala chegaralari. Nivo'ning `min: "auto"` i chiziqni qutining aynan
 * chetiga yopishtiradi (eng past va eng baland nuqta kesiladi), shuning uchun
 * domen qo'lda hisoblanadi.
 *
 * Yarim kenglik uchta qiymatning kattasi:
 *   - qatorning haqiqiy tarqalishi (max - min) / 2;
 *   - o'rtacha qiymatning 6% i - "Transformatorlar" kabi deyarli o'zgarmas
 *     qatorlar tishli arraga aylanib ketmasligi uchun;
 *   - nolga bo'linishdan saqlovchi kichik son.
 * So'ng 1.6 koeffitsiyenti chiziq ustida va ostida havo qoldiradi.
 */
function domainOf(points: readonly number[]): [number, number] {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const mid = (min + max) / 2;
  const half = Math.max((max - min) / 2, Math.abs(mid) * 0.06, 1e-6) * 1.6;
  return [mid - half, mid + half];
}

/** Sparkline chetlari: chiziq qalinligi kesilmasligi uchun 2px zaxira. */
const MARGIN = { top: 2, right: 1, bottom: 2, left: 1 } as const;

/**
 * KPI kartasining pastidagi mayda trend grafigi.
 *
 * Bu ham `@nivo/line` - sahifadagi qolgan grafiklar bilan bir xil kutubxona:
 * shkala, egri chiziq va maydon to'ldirishni nivo hisoblaydi, ya'ni qiymatlar
 * 0..1 ulushda emas, haqiqiy o'lchov birligida (kWh, foiz, dona) beriladi.
 *
 * Alohida fayl va `"use client"` sababi: `HomeKpiCard` server komponenti
 * bo'lib qolishi kerak - `KpiRow` unga lucide ikonkalarini prop sifatida
 * uzatadi, bu esa RSC chegarasidan o'tmaydi. Bu yerga faqat sonlar va rang
 * (serializatsiya qilinadigan qiymatlar) o'tadi.
 */
export function KpiSparkline({
  points,
  stroke,
  className,
}: {
  /** Qator qiymatlari - o'z o'lchov birligida, kamida bitta nuqta. */
  points: readonly number[];
  /** Chiziq va maydon rangi - aniq hex ("#3b82f6"). */
  stroke: string;
  className?: string;
}) {
  const data = useMemo(
    () => [{ id: "kpi", data: points.map((value, index) => ({ x: index, y: value })) }],
    [points],
  );
  const [min, max] = useMemo(() => domainOf(points), [points]);

  if (points.length === 0) return null;

  return (
    <div className={cn("h-full w-full", className)} aria-hidden>
      <ResponsiveLine
        data={data}
        margin={MARGIN}
        xScale={{ type: "point" }}
        yScale={{ type: "linear", min, max, nice: false }}
        curve="monotoneX"
        colors={[stroke]}
        lineWidth={1.6}
        enableArea
        areaOpacity={0.12}
        // To'ldirish domen tubigacha tushadi - aks holda 0 chizig'iga
        // tushib, quti tashqarisida qolib ketardi.
        areaBaselineValue={min}
        enablePoints={false}
        enableGridX={false}
        enableGridY={false}
        axisTop={null}
        axisRight={null}
        axisBottom={null}
        axisLeft={null}
        // Karta `overflow-hidden` - tultip baribir kesilardi, shuning uchun
        // grafik butunlay statik (va sakkiz karta uchun arzonroq).
        isInteractive={false}
        animate={false}
      />
    </div>
  );
}
