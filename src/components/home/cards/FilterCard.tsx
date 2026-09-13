"use client";

import { PlugZap, Zap, ZapOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SelectField, type SelectOption } from "@/components/ui/SelectField";
import { SUBSTATIONS } from "@/lib/data/substations";
import { TRANSFORMERS } from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

const SUBSTATION_OPTIONS: readonly SelectOption[] = SUBSTATIONS.map((item) => ({
  value: item.id,
  label: item.name,
}));

/**
 * Fiderlar alohida ma'lumot moduli sifatida yo'q, shuning uchun nomlar
 * "Eng ko'p sarfga ega fiderlar" diagrammasidagi bilan bir xil olingan.
 */
const FEEDER_OPTIONS: readonly SelectOption[] = [
  "Xaqulobod",
  "Tovuqxona",
  "Chinobod",
  "Qiyali",
  "Maslahat",
  "Baliqchi",
].map((name) => ({ value: name.toLowerCase(), label: name }));

/** Tanlov bo'yicha oqimlar - ranglar 1-qatordagi KPI kartalari bilan bir xil. */
const METRICS = [
  { id: "total", label: "Umumiy oqim", value: "15,2 ming kWh", icon: Zap, tile: "bg-accent-blue" },
  {
    id: "useful",
    label: "Foydali oqim",
    value: "15,2 ming kWh",
    icon: PlugZap,
    tile: "bg-accent-green",
  },
  { id: "loss", label: "Yo’qotish", value: "15,2 ming kWh", icon: ZapOff, tile: "bg-accent-red" },
] as const;

/**
 * "Filtratsiya" kartasi (Figma `4179:238`, 321.78x402).
 *
 * Bloklar orasidagi masofa maketda bir xil - 23px:
 *
 *   sarlavha 18 | tanlovlar 112 (3 x 32, oraliq 8) | ajratgich 1
 *   | oqimlar 130 (3 x 38, oraliq 8) | havola 25 (1px chiziq + 8 + 16)
 *
 * 16 + 18 + 23 + 112 + 23 + 1 + 23 + 130 + 23 + 25 + 8 = 402 (pastki
 * bo'shliq 8px).
 *
 * Maketda faqat yopiq holat chizilgan; ochiluvchi ro'yxat `SelectField` da.
 * Transformatorlar ro'yxati tanlangan podstansiyaga qarab qisqaradi - shuning
 * uchun podstansiya almashtirilganda unga tegishli bo'lmagan transformator
 * tanlovi bekor qilinadi.
 */
export function FilterCard({ className }: { className?: string }) {
  const [substation, setSubstation] = useState<string | null>(null);
  const [feeder, setFeeder] = useState<string | null>(null);
  const [transformer, setTransformer] = useState<string | null>(null);

  const transformerOptions = useMemo<readonly SelectOption[]>(() => {
    const list = substation
      ? TRANSFORMERS.filter((item) => item.substationId === substation)
      : TRANSFORMERS;
    return list.map((item) => ({
      value: item.id,
      label: item.code,
    }));
  }, [substation]);

  function pickSubstation(next: string | null) {
    setSubstation(next);
    // Tanlangan transformator yangi podstansiyaga tegishli bo'lmasa - tozalanadi.
    if (
      transformer &&
      next &&
      !TRANSFORMERS.some((item) => item.id === transformer && item.substationId === next)
    ) {
      setTransformer(null);
    }
  }

  /** Havola eng aniq tanlovga olib boradi. */
  const href = transformer
    ? `/transformers/${transformer}`
    : substation
      ? `/substations/${substation}`
      : "/feeders";

  return (
    <Card className={cn("gap-[23px] pb-2", className)}>
      <h2 className="shrink-0 text-sm leading-[18px] font-bold text-ink">Filtratsiya</h2>

      <div className="flex shrink-0 flex-col gap-2">
        <SelectField
          value={substation}
          options={SUBSTATION_OPTIONS}
          placeholder="Podstansiyani tanlang"
          onChange={pickSubstation}
        />
        <SelectField
          value={feeder}
          options={FEEDER_OPTIONS}
          placeholder="Fiderni tanlang"
          onChange={setFeeder}
        />
        <SelectField
          value={transformer}
          options={transformerOptions}
          placeholder="Transformatorni tanlang"
          onChange={setTransformer}
        />
      </div>

      <div className="h-px shrink-0 bg-[#dddddd]" />

      <ul className="flex shrink-0 flex-col gap-2">
        {METRICS.map((metric) => (
          <li key={metric.id} className="flex h-[38px] items-center gap-2">
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-md text-white",
                metric.tile,
              )}
            >
              <Icon icon={metric.icon} size={20} />
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-xs leading-4 text-[#999999]">{metric.label}</span>
              <span className="truncate text-sm leading-[18px] font-bold text-ink">
                {metric.value}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex shrink-0 justify-center border-t border-[#dddddd] pt-2">
        <Link
          href={href}
          className="text-xs leading-4 font-medium text-brand transition-opacity hover:opacity-70"
        >
          Sahifaga o&rsquo;tish
        </Link>
      </div>
    </Card>
  );
}
