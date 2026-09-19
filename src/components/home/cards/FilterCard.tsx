"use client";

import { PlugZap, Zap, ZapOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { SelectField, type SelectOption } from "@/components/ui/SelectField";
import type { HomeFilter, HomeFilterMetrics, HomeFilterOption } from "@/lib/queries/home-data";
import { cn } from "@/lib/ui/cn";

/** Tanlov bo'yicha oqimlar - ranglar 1-qatordagi KPI kartalari bilan bir xil. */
const METRICS: readonly {
  id: keyof HomeFilterMetrics;
  label: string;
  icon: GlyphIcon;
  tile: string;
}[] = [
  { id: "total", label: "Umumiy oqim", icon: Zap, tile: "bg-accent-blue" },
  { id: "useful", label: "Foydali oqim", icon: PlugZap, tile: "bg-accent-green" },
  { id: "loss", label: "Yo’qotish", icon: ZapOff, tile: "bg-accent-red" },
];

function toOptions(items: readonly HomeFilterOption[]): SelectOption[] {
  return items.map((item) => ({ value: item.id, label: item.label }));
}

function byId(items: readonly HomeFilterOption[]): Map<string, HomeFilterOption> {
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * "Filtratsiya" kartasi (Figma `4179:238`, 321.78x402).
 *
 * Bloklar orasidagi masofa maketda bir xil - 23px:
 *
 *   sarlavha 18 | tanlovlar 112 (3 x 32, oraliq 8) | ajratgich 1
 *   | oqimlar 130 (3 x 38, oraliq 8) | havola 25 (1px chiziq + 8 + 16)
 *
 * Variantlar - tanlangan oyda holati bor obyektlar. Tanlovlar zanjir:
 * fiderlar podstansiyaga, transformatorlar podstansiya va fiderga qarab
 * qisqaradi; pastki tanlov ota tanlovlarni o'zi o'rnatadi, mos kelmay qolgan
 * pastki tanlov esa bekor qilinadi. Podstansiya sahifasida podstansiya
 * tanlovi, fider va TP sahifalarida podstansiya va fider tanlovlari
 * qulflangan. TP sahifasida shu TP oldindan tanlangan - fiderdagi boshqa TP
 * ni tanlab, uning ko'rsatkichlarini ko'rish va sahifasiga o'tish mumkin.
 *
 * Oqimlar eng aniq tanlangan obyektning o'z holatidan; hech narsa
 * tanlanmasa - sahifa qamrovining qiymatlari (1-qatordagi KPI bilan bir xil).
 */
export function FilterCard({ data, className }: { data: HomeFilter; className?: string }) {
  const locked = data.lockedSubstationId;
  const lockedFeeder = data.lockedFeederId;
  const [substation, setSubstation] = useState<string | null>(locked);
  const [feeder, setFeeder] = useState<string | null>(lockedFeeder);
  const [transformer, setTransformer] = useState<string | null>(data.currentTransformerId);

  const substations = useMemo(() => byId(data.substations), [data.substations]);
  const feeders = useMemo(() => byId(data.feeders), [data.feeders]);
  const transformers = useMemo(() => byId(data.transformers), [data.transformers]);

  const substationOptions = useMemo(() => toOptions(data.substations), [data.substations]);

  const feederOptions = useMemo(
    () =>
      toOptions(
        substation ? data.feeders.filter((item) => item.substationId === substation) : data.feeders,
      ),
    [data.feeders, substation],
  );

  const transformerOptions = useMemo(
    () =>
      toOptions(
        data.transformers.filter(
          (item) =>
            (!substation || item.substationId === substation) &&
            (!feeder || item.feederId === feeder),
        ),
      ),
    [data.transformers, substation, feeder],
  );

  function pickSubstation(next: string | null) {
    if (locked) return;
    setSubstation(next);
    // Tozalansa yoki boshqa podstansiya tanlansa - unga tegishli bo'lmagan pastki tanlovlar bekor.
    if (feeder && (!next || feeders.get(feeder)?.substationId !== next)) setFeeder(null);
    if (transformer && (!next || transformers.get(transformer)?.substationId !== next)) {
      setTransformer(null);
    }
  }

  function pickFeeder(next: string | null) {
    if (lockedFeeder) return;
    setFeeder(next);
    const option = next ? feeders.get(next) : undefined;
    if (option && !locked) setSubstation(option.substationId);
    if (transformer && (!next || transformers.get(transformer)?.feederId !== next)) {
      setTransformer(null);
    }
  }

  function pickTransformer(next: string | null) {
    setTransformer(next);
    const option = next ? transformers.get(next) : undefined;
    if (option) {
      if (!lockedFeeder) setFeeder(option.feederId);
      if (!locked) setSubstation(option.substationId);
    }
  }

  /** Eng aniq tanlov; sahifaning o'z obyektlari (qulflanganlar, TP sahifasining TP si) - havolasiz. */
  const selected =
    (transformer ? transformers.get(transformer) : undefined) ??
    (feeder ? feeders.get(feeder) : undefined) ??
    (substation ? substations.get(substation) : undefined) ??
    null;
  const metrics = selected?.metrics ?? data.scopeMetrics;
  const pageObjects = [locked, lockedFeeder, data.currentTransformerId];
  const href = selected && !pageObjects.includes(selected.id) ? selected.href : null;

  return (
    <Card className={cn("gap-[23px] pb-2", className)}>
      <h2 className="shrink-0 text-sm leading-[18px] font-bold text-ink">Filtratsiya</h2>

      <div className="flex shrink-0 flex-col gap-2">
        <SelectField
          value={substation}
          options={substationOptions}
          placeholder="Podstansiyani tanlang"
          onChange={pickSubstation}
          disabled={locked != null}
        />
        <SelectField
          value={feeder}
          options={feederOptions}
          placeholder="Fiderni tanlang"
          onChange={pickFeeder}
          disabled={lockedFeeder != null}
        />
        <SelectField
          value={transformer}
          options={transformerOptions}
          placeholder="Transformatorni tanlang"
          onChange={pickTransformer}
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
                {metrics[metric.id]}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex shrink-0 justify-center border-t border-[#dddddd] pt-2">
        {href ? (
          <Link
            href={href}
            className="text-xs leading-4 font-medium text-brand transition-opacity hover:opacity-70"
          >
            Sahifaga o&rsquo;tish
          </Link>
        ) : (
          <span aria-disabled className="text-xs leading-4 font-medium text-ink-muted">
            Sahifaga o&rsquo;tish
          </span>
        )}
      </div>
    </Card>
  );
}
