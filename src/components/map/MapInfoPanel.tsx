"use client";

// Xarita sahifasining o'ng paneli (Figma node 3947:249 "Right"). Donut - nivo,
// shuning uchun mijoz komponenti. Barcha matnlar serverda tayyorlangan.

import type { ReactNode } from "react";
import Link from "next/link";
import { ResponsivePie } from "@nivo/pie";
import { ArrowRight, UserShield } from "lucide-react";

import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

import { MAP_ICONS } from "./icons";
import type { MapEnergy, MapInfo, MapStat, MapTopList } from "./types";

/** Donut ranglari - `accent-green` / `accent-red` tokenlari (SVG atributida `var()` ishonchsiz). */
const USEFUL_COLOR = "#22c55e";
const LOSS_COLOR = "#ff383c";

/** Donut uchun nivo kutadigan shakl (rang har bir segmentning o'zidan olinadi). */
interface DonutDatum {
  id: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Bo'lim izohi: maketda 12px matn, satr qutisi 18px va ostidan 10px bo'shliq.
 * `leading` aniq berilgan, aks holda Tailwind 16px satr qutisi beradi.
 */
function Caption({ children }: { children: ReactNode }) {
  return <p className="mb-2.5 text-xs leading-4.5 text-ink-soft">{children}</p>;
}

/** Kulrang plitka: havola berilsa - bosiladigan. */
function Tile({ href, className, children }: { href?: string | null; className?: string; children: ReactNode }) {
  const base = cn("flex h-12 items-center gap-3 rounded-xl bg-canvas px-4 text-ink", className);
  if (!href) return <div className={base}>{children}</div>;
  return (
    <Link href={href} className={cn(base, "transition-colors hover:bg-black/5")}>
      {children}
    </Link>
  );
}

export function MapInfoPanel({ info, className }: { info: MapInfo; className?: string }) {
  return (
    <aside
      className={cn("flex w-85 shrink-0 flex-col overflow-hidden rounded-2xl bg-surface p-4", className)}
    >
      {/* 1. Sarlavha qatori - skroll qilinmaydi, panel tepasida qotib turadi. */}
      <header className="flex h-5.25 shrink-0 items-center justify-between gap-2">
        <h2 className="truncate text-base leading-5.25 font-bold text-ink">Ma&rsquo;lumotlar</h2>
        <span className="shrink-0 text-xs text-ink-soft">{info.periodLabel}</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pt-2.5 scrollbar-none">
        {/* 2. Tugun nomi va turi. */}
        <div className="shrink-0">
          <p className="text-xs leading-4.5 text-ink-soft">{info.kindLabel}</p>
          <h3 className="text-base leading-5.25 font-bold wrap-break-word text-ink">{info.title}</h3>
        </div>

        {info.emptyText ? (
          <EmptyState variant="inline" action={false} title={info.emptyText} className="min-h-40 flex-none" />
        ) : (
          <>
            {/* 3. Statistika plitkalari. */}
            {info.stats.length > 0 ? (
              <div className="grid shrink-0 grid-cols-2 gap-2.5">
                {info.stats.map((stat) => (
                  <StatTile key={stat.key} stat={stat} />
                ))}
              </div>
            ) : null}

            {/* 4. Hisobot: Umumiy / Foydali oqim va Yo'qotish. */}
            {info.energy ? (
              <EnergyBlock energy={info.energy} />
            ) : info.energyEmptyText ? (
              <div className="shrink-0">
                <Caption>Hisobot</Caption>
                <p className="rounded-xl bg-canvas px-4 py-3 text-xs text-ink-muted">{info.energyEmptyText}</p>
              </div>
            ) : null}

            {/* 5. Ma'sul xodim. */}
            {info.staff ? (
              <div className="shrink-0">
                <Caption>Ma&rsquo;sul xodim</Caption>
                <Tile href={info.staff.href}>
                  <Icon icon={UserShield} size={24} className="shrink-0" />
                  <span className="truncate text-base leading-5.25 font-semibold">{info.staff.name}</span>
                </Tile>
              </div>
            ) : null}

            {/* 6. Eng ko'p: bolalar Foydali oqimi yoki TP qarzdorlari. */}
            {info.top ? <TopBlock top={info.top} /> : null}
          </>
        )}
      </div>

      {/* 7. Obyekt sahifasiga o'tish - panel pastida qotib turadi. */}
      <Link
        href={info.detail.href}
        className="mt-3 flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        {info.detail.label}
        <Icon icon={ArrowRight} size={16} />
      </Link>
    </aside>
  );
}

function StatTile({ stat }: { stat: MapStat }) {
  return (
    <div className={cn("min-w-0", stat.wide && "col-span-2")}>
      <Caption>{stat.label}</Caption>
      <Tile href={stat.href}>
        <Icon icon={MAP_ICONS[stat.icon]} size={20} className="shrink-0" />
        <span className="truncate text-base leading-5.25 font-semibold" title={stat.value}>
          {stat.value}
        </span>
      </Tile>
    </div>
  );
}

function EnergyBlock({ energy }: { energy: MapEnergy }) {
  const donut: DonutDatum[] = energy.donut
    ? [
        { id: "useful", label: "Foydali oqim", value: energy.donut.useful, color: USEFUL_COLOR },
        { id: "loss", label: "Yo’qotish", value: energy.donut.loss, color: LOSS_COLOR },
      ]
    : [];

  const rows: { key: string; label: string; value: string; hint?: string; color: string | null }[] = [
    { key: "total", label: "Umumiy oqim", value: energy.total, color: null },
    { key: "useful", label: "Foydali oqim", value: energy.useful, color: USEFUL_COLOR },
    { key: "loss", label: "Yo’qotish", value: energy.loss, hint: energy.lossPercent, color: LOSS_COLOR },
  ];

  return (
    <div className="shrink-0">
      <Caption>Hisobot</Caption>
      <div className="flex items-center gap-5 rounded-xl bg-canvas p-3">
        {/* Manfiy yoki nol qiymatda ulushni chizib bo'lmaydi - faqat sonlar qoladi. */}
        {donut.length > 0 ? (
          <div className="size-20 shrink-0">
            <ResponsivePie<DonutDatum>
              data={donut}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              innerRadius={0.62}
              padAngle={1.5}
              cornerRadius={2}
              colors={{ datum: "data.color" }}
              borderWidth={0}
              enableArcLabels={false}
              enableArcLinkLabels={false}
              isInteractive={false}
              animate={false}
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2.5">
              <span
                className={cn("size-4 shrink-0 rounded-full", row.color ? null : "border-2 border-ink-soft")}
                style={row.color ? { backgroundColor: row.color } : undefined}
              />
              <div className="min-w-0">
                <p className="truncate text-xs leading-4.5 text-ink-soft">{row.label}</p>
                <p className="mt-0.5 truncate text-base leading-5.25 font-semibold text-ink">
                  {row.value}
                  {row.hint ? <span className="ml-1.5 text-xs font-medium text-ink-soft">{row.hint}</span> : null}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TopBlock({ top }: { top: MapTopList }) {
  return (
    <div className="shrink-0">
      <Caption>{top.title}</Caption>
      {top.items.length === 0 ? (
        <p className="rounded-xl bg-canvas px-4 py-3 text-xs text-ink-muted">{top.emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {top.items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3 text-ink transition-colors hover:bg-black/5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon icon={MAP_ICONS[item.icon]} size={20} className="shrink-0" />
                <span className="truncate text-sm leading-5.25 font-semibold" title={item.label}>
                  {item.label}
                </span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm leading-5.25 font-semibold",
                  top.tone === "bad" ? "text-trend-up" : "text-ink",
                )}
              >
                {item.value}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
