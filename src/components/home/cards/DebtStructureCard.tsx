"use client";

// Donut nivo bilan chiziladi va sarlavhadagi davr tanlagichi holat talab
// qiladi - shuning uchun karta mijoz komponenti.

import { ResponsivePie } from "@nivo/pie";
import { ArrowUp, ChevronDown, FileDown } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { IconPill } from "@/components/ui/IconPill";

/**
 * Donut segmenti. `value` faqat yoy burchagi uchun, ekranda ko'rinadigan
 * matn (`amount`, `share`) maketdagidek oldindan formatlangan - shu bilan
 * mijozda `toFixed`/`Intl` chaqirilmaydi va SSR bilan farq chiqmaydi.
 */
interface DebtSlice {
  id: string;
  label: string;
  value: number;
  amount: string;
  share: string;
  /** Rang nivo'ga `colors={{ datum: "data.color" }}` orqali uzatiladi. */
  color: string;
}

const SLICES: readonly DebtSlice[] = [
  {
    id: "population",
    label: "Aholi",
    value: 275.8,
    amount: "275.8 mln so\u2019m",
    share: "(68.1%)",
    color: "#f59e0b",
  },
  {
    id: "legal",
    label: "Yuridik",
    value: 128.8,
    amount: "128.8 mln so\u2019m",
    share: "(31.9%)",
    color: "#2563eb",
  },
];

/** Halqa markazidagi jami: 275.8 + 128.8. Matn oldindan formatlangan. */
const TOTAL_DISPLAY = "404.6";

/**
 * Pastki izoh - oldingi oy yakuni va undan farq. Raqamlar halqadagi jami
 * bilan kelishgan bo'lishi shart: 386.2 + 18.4 = 404.6.
 */
const PREVIOUS_TOTAL_DISPLAY = "Oldingi oy: 386.2 mln so\u2019m";
const DELTA_DISPLAY = "+18.4 mln so\u2019m";

/** Sarlavhadagi davr tanlagichi - hozircha mock, bosilganda aylanadi. */
const PERIODS = ["Bugun", "Hafta", "Oy"] as const;

/**
 * "Qarzdorlik tuzilmasi" - bosh sahifaning 3-qatori, 301x246 katak.
 *
 * Karta ichi 269x214: sarlavha 32px, tanaga 174px qoladi. Tana ikki bo'lakka
 * bo'linadi - donut+legenda (`flex-1`) va pastdagi 9/10px izoh yo'lagi
 * (`shrink-0`). Katak tor bo'lgani uchun donut 112px ga qotirilgan, legenda
 * esa qolgan joyni egallaydi.
 */
export function DebtStructureCard({ className }: { className?: string }) {
  const [periodIndex, setPeriodIndex] = useState(0);
  const period = PERIODS[periodIndex];

  return (
    <Card className={className}>
      <CardHeader title="Qarzdorlik tuzilmasi">
        {/* `aria-label` ataylab qo'yilmagan: u ko'rinadigan matnni ("Bugun")
            bekor qilib, joriy davrni ekran o'quvchisidan yashirar edi. */}
        <button
          type="button"
          onClick={() => setPeriodIndex((index) => (index + 1) % PERIODS.length)}
          title={"Davrni o\u2019zgartirish"}
          className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-canvas px-2 text-[10px] font-medium text-ink transition-colors hover:bg-black/5"
        >
          {period}
          <Icon icon={ChevronDown} size={12} />
        </button>
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody>
        <div className="flex min-h-0 flex-1 items-center gap-2">
          {/* Donut markazidagi jami summa HTML bilan qo'yiladi: nivo'ning
              o'z qatlamiga qaraganda shrift tokenlari aynan mos tushadi. */}
          <div className="relative h-full w-28 shrink-0">
            <ResponsivePie<DebtSlice>
              data={SLICES}
              margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
              innerRadius={0.68}
              padAngle={1.2}
              cornerRadius={2}
              colors={{ datum: "data.color" }}
              borderWidth={0}
              enableArcLabels={false}
              enableArcLinkLabels={false}
              isInteractive={false}
              animate={false}
            />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-sm leading-none font-bold text-ink">
                {TOTAL_DISPLAY}
              </span>
              <span className="mt-0.5 text-[9px] text-ink-soft">mln so&rsquo;m</span>
            </div>
          </div>

          {/* Legenda: har bir segment uchun nuqta + nom / summa / ulush. */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
            {SLICES.map((slice) => (
              <div key={slice.id} className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <div className="min-w-0">
                  <span className="block truncate text-[10px] leading-3.25 text-ink-soft">
                    {slice.label}
                  </span>
                  <span className="block truncate text-[11px] leading-3.5 font-semibold text-ink">
                    {slice.amount}
                  </span>
                  <span className="block truncate text-[9px] leading-3 text-ink-soft">
                    {slice.share}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pastki izoh: oldingi oy yakuni va undan farq. Qarz o'sishi - salbiy
            hodisa, shuning uchun `trend-up` (qizil) tokeni ishlatiladi.
            Yo'lak doim bir qatorli: chapdagi matn `truncate`, o'ngdagi farq
            `shrink-0` - 269px lik tor katakda ham qatorga bo'linib ketmaydi. */}
        <div className="mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-solid border-[#f0f0f0] pt-2">
          <span className="min-w-0 truncate text-[9px] leading-3 text-ink-soft">
            {PREVIOUS_TOTAL_DISPLAY}
          </span>
          <span className="flex shrink-0 items-center gap-0.5 text-[10px] leading-3.25 font-semibold whitespace-nowrap text-trend-up">
            <Icon icon={ArrowUp} size={12} />
            {DELTA_DISPLAY}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
