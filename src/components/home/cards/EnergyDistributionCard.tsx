"use client";

// Halqa nivo bilan chiziladi va sarlavhadagi davr tanlagichi holat talab
// qiladi - shuning uchun karta mijoz komponenti.

import { ResponsivePie } from "@nivo/pie";
import { ChevronDown, FileDown } from "lucide-react";
import { useState } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { IconPill } from "@/components/ui/IconPill";

/**
 * Halqaning bir bo'lagi. `value` faqat yoy burchagi uchun; ekranda
 * ko'rinadigan matn (`display`, `share`) maketdagidek oldindan formatlangan -
 * shu bilan mijozda `toFixed`/`Intl` chaqirilmaydi va SSR bilan farq chiqmaydi.
 */
interface EnergySlice {
  id: string;
  /** Legendadagi o'zbekcha nom. */
  label: string;
  /** Halqa yoyining o'lchami (ming kWh). */
  value: number;
  /** Legendadagi tayyor matn - raqam JSX da emas, shu yerda formatlanadi. */
  display: string;
  /** Umumiy hajmdagi ulush. */
  share: string;
  /** Rang nivo'ga `colors={{ datum: "data.color" }}` orqali uzatiladi. */
  color: string;
}

/**
 * Ikki bo'lakli taqsimot: sotilgan (foydali) energiya va yo'qotish.
 * Ranglar tokenlarda ham bor (`accent-amber` = #f59e0b), lekin nivo SVG ichida
 * CSS o'zgaruvchisini o'qiy olmaydi - shuning uchun aynan hex saqlanadi.
 */
const SLICES: readonly EnergySlice[] = [
  {
    id: "sold",
    label: "Sotilgan energiya",
    value: 722.5,
    display: "722.5 ming kWh",
    share: "68.9%",
    color: "#2563eb",
  },
  {
    id: "loss",
    label: "Yo\u2019qotish",
    value: 325.5,
    display: "325.5 ming kWh",
    share: "31.1%",
    color: "#f59e0b",
  },
];

/**
 * Halqa markazidagi jami (722.5 + 325.5). Mingliklar ajratgichi - uzilmas
 * bo'shliq (U+00A0, aynan `\u00a0` deb yozilgan: manbada ko'rinmas belgi
 * qolmasin): tor markazda raqam ikki qatorga bo'linib ketmasin.
 */
const TOTAL_DISPLAY = "1\u00a0048.0";

/** Sarlavhadagi kichik tanlagich - hozircha faqat oraliqni aylantiradi. */
const PERIODS = ["Bugun", "Hafta", "Oy"] as const;

/**
 * "Energiya taqsimoti" (Bosh sahifa, 3-qator, ~363x246).
 *
 * Tana ~174px: chapda 130px halqa, o'ngda legenda. Halqa `h-full` bilan
 * qolgan balandlikni to'liq egallaydi, markazdagi yozuv esa SVG ustida
 * absolyut turadi - shunda radius o'zgarganda ham u markazda qoladi.
 */
export function EnergyDistributionCard({ className }: { className?: string }) {
  const [periodIndex, setPeriodIndex] = useState(0);

  return (
    <Card className={className}>
      <CardHeader title="Energiya taqsimoti">
        <button
          type="button"
          onClick={() => setPeriodIndex((index) => (index + 1) % PERIODS.length)}
          title={"Davrni o\u2019zgartirish"}
          className="flex h-7 shrink-0 items-center gap-1 rounded-full bg-canvas px-2.5 text-[11px] font-medium text-ink transition-colors hover:bg-black/5"
        >
          {PERIODS[periodIndex]}
          <Icon icon={ChevronDown} size={14} />
        </button>
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody>
        {/* Qatorni alohida o'ramchi beradi: `CardBody` ning o'zi `flex-col`. */}
        <div className="flex min-h-0 flex-1 items-center gap-3">
          {/* Halqa kengligi qat'iy - legenda uni siqib qo'ymaydi. */}
          <div className="relative h-full w-[130px] shrink-0">
            {/* Maslahat qutichasi ataylab yo'q (`isInteractive={false}`):
                legenda ikkala bo'lakning nomi, qiymati va ulushini yonida
                ko'rsatib turibdi, qolaversa nivo qutichani shu 130px lik
                o'ramchi ichida chizadi va uni kartaning `overflow-hidden`
                chegarasi qirqib qo'yardi. */}
            <ResponsivePie<EnergySlice>
              data={SLICES}
              innerRadius={0.68}
              padAngle={1.2}
              cornerRadius={2}
              margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
              colors={{ datum: "data.color" }}
              enableArcLabels={false}
              enableArcLinkLabels={false}
              isInteractive={false}
              animate={false}
            />

            {/* Markaz yozuvi SVG ustida turadi - `pointer-events-none` uni
                sichqoncha uchun shaffof qiladi. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-base leading-none font-bold text-ink">
                {TOTAL_DISPLAY}
              </span>
              <span className="mt-0.5 text-[9px] text-ink-soft">ming kWh</span>
            </div>
          </div>

          {/* Legenda vertikal markazda: halqa balandligi o'zgarsa ham qimirlamaydi. */}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-3">
            {SLICES.map((slice) => (
              <div key={slice.id} className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <div className="min-w-0">
                  <span className="block truncate text-[10px] leading-[13px] text-ink-soft">
                    {slice.label}
                  </span>
                  {/* Qiymat flex elementi: `min-w-0` bo'lmasa u eng kichik
                      kenglikdan pastga qisqarmaydi, `truncate` ishlamaydi va
                      uzun matn kartadan chiqib ketadi. */}
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="min-w-0 truncate text-[11px] leading-[14px] font-semibold text-ink">
                      {slice.display}
                    </span>
                    <span className="shrink-0 text-[9px] text-ink-soft">
                      ({slice.share})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
