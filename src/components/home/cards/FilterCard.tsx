"use client";

import { PlugZap, Zap, ZapOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SelectField, type SelectOption } from "@/components/ui/SelectField";
import { FEEDERS, findFeeder } from "@/lib/data/feeders";
import { SUBSTATIONS } from "@/lib/data/substations";
import { TRANSFORMERS } from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

const SUBSTATION_OPTIONS: readonly SelectOption[] = SUBSTATIONS.map((item) => ({
  value: item.id,
  label: item.name,
}));

/**
 * Tanlangan podstansiya va fiderga tegishli transformatorlar. Fider kodi
 * faqat podstansiya ichida noyob, shuning uchun ikkalasi birga solishtiriladi.
 */
function transformersFor(substationId: string | null, feederId: string | null) {
  const feeder = feederId ? findFeeder(feederId) : undefined;
  return TRANSFORMERS.filter((item) => {
    if (substationId && item.substationId !== substationId) return false;
    if (feeder && (item.substationId !== feeder.substationId || item.feeder !== feeder.code)) {
      return false;
    }
    return true;
  });
}


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
 * Tanlovlar zanjir: fiderlar podstansiyaga, transformatorlar esa podstansiya
 * va fiderga qarab qisqaradi. Yuqoridagi tanlov almashtirilganda unga
 * tegishli bo'lmagan pastki tanlovlar bekor qilinadi.
 */
export function FilterCard({ className }: { className?: string }) {
  const [substation, setSubstation] = useState<string | null>(null);
  const [feeder, setFeeder] = useState<string | null>(null);
  const [transformer, setTransformer] = useState<string | null>(null);

  const feederOptions = useMemo<readonly SelectOption[]>(() => {
    const list = substation
      ? FEEDERS.filter((item) => item.substationId === substation)
      : FEEDERS;
    return list.map((item) => ({ value: item.id, label: item.name }));
  }, [substation]);

  const transformerOptions = useMemo<readonly SelectOption[]>(() => {
    return transformersFor(substation, feeder).map((item) => ({
      value: item.id,
      label: item.code,
    }));
  }, [substation, feeder]);

  /** Transformator tanlovi yangi shartlarga mos kelmasa - tozalanadi. */
  function keepTransformer(nextSubstation: string | null, nextFeeder: string | null) {
    if (
      transformer &&
      !transformersFor(nextSubstation, nextFeeder).some((item) => item.id === transformer)
    ) {
      setTransformer(null);
    }
  }

  function pickSubstation(next: string | null) {
    setSubstation(next);
    // Fider boshqa podstansiyaniki bo'lsa - tozalanadi.
    const nextFeeder = feeder && next && findFeeder(feeder)?.substationId !== next ? null : feeder;
    setFeeder(nextFeeder);
    keepTransformer(next, nextFeeder);
  }

  function pickFeeder(next: string | null) {
    setFeeder(next);
    // Fider tanlansa, podstansiya ham avtomatik o'shanga o'rnatiladi.
    const nextSubstation = (next && findFeeder(next)?.substationId) || substation;
    setSubstation(nextSubstation);
    keepTransformer(nextSubstation, next);
  }

  /** Havola eng aniq tanlovga olib boradi. */
  const href = transformer
    ? `/transformers/${transformer}`
    : feeder
      ? `/feeders/${feeder}`
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
          options={feederOptions}
          placeholder="Fiderni tanlang"
          onChange={pickFeeder}
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
