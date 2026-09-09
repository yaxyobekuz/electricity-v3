"use client";

// Xarita sahifasining o'ng paneli (Figma node 3947:249 "Right").
// Galereya tanlovi holat talab qiladi, donut esa nivo - shuning uchun mijoz komponenti.

import type { ReactNode } from "react";
import { useState } from "react";
import Image from "next/image";
import { ResponsivePie } from "@nivo/pie";
import { CircuitBoard, Expand, UserShield } from "lucide-react";

import type { MapNodeInfo } from "@/components/map/types";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

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

export function MapInfoPanel({
  node,
  className,
}: {
  node: MapNodeInfo;
  className?: string;
}) {
  // Boshqa tugun tanlanganda galereya birinchi rasmga qaytishi kerak, shuning
  // uchun tanlov tugun nomi bilan saqlanadi - effektsiz qayta hisoblanadi.
  const [picked, setPicked] = useState({ title: node.title, index: 0 });
  const selected =
    picked.title === node.title && picked.index < node.gallery.length ? picked.index : 0;

  const donut: DonutDatum[] = node.report.map((slice) => ({
    id: slice.key,
    label: slice.label,
    value: slice.value,
    color: slice.color,
  }));

  return (
    <aside
      className={cn(
        "flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl bg-surface p-4",
        className,
      )}
    >
      {/* 1. Sarlavha qatori - skroll qilinmaydi, panel tepasida qotib turadi. */}
      <header className="flex h-5.25 shrink-0 items-center justify-between gap-2">
        <h2 className="truncate text-base font-bold leading-5.25 text-ink">
          Ma&rsquo;lumotlar
        </h2>
        <button
          type="button"
          aria-label="Kengaytirish"
          className="flex shrink-0 text-ink transition-opacity hover:opacity-70"
        >
          <Icon icon={Expand} size={20} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pt-2.5 scrollbar-none">
        {/* 2. Katta rasm 308x204. */}
        <div className="relative h-51 w-full shrink-0 overflow-hidden rounded-xl bg-canvas">
          <Image
            src={node.gallery[selected]}
            alt={node.title}
            fill
            sizes="308px"
            className="object-cover"
          />
        </div>

        {/* 3. Eskizlar: maketda 4 x 80px + 10px oraliq = 350px, panel ichi esa 308px -
            o'lcham maketdagidek qoldirilib, qator gorizontal skroll qilinadi. */}
        <div className="flex shrink-0 gap-2.5 overflow-x-auto scrollbar-none">
          {node.gallery.map((src, index) => (
            <button
              key={`${index}-${src}`}
              type="button"
              onClick={() => setPicked({ title: node.title, index })}
              aria-label={`${index + 1}-rasm`}
              className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-canvas"
            >
              <Image src={src} alt="" fill sizes="80px" className="object-cover" />
              {/* Halqa ichkaridan chiziladi - aks holda 10px oraliqni yeb qo'yadi. */}
              {index === selected ? (
                <span className="pointer-events-none absolute inset-0 rounded-lg border-2 border-brand" />
              ) : null}
            </button>
          ))}
        </div>

        {/* 4. Tugun nomi. */}
        <h3 className="shrink-0 text-base font-bold leading-5.25 text-ink">{node.title}</h3>

        {/* 5. 2x2 statistika. */}
        <div className="grid shrink-0 grid-cols-2 gap-2.5">
          {node.stats.map((stat) => (
            <div key={stat.key} className="min-w-0">
              <Caption>{stat.label}</Caption>
              <div className="flex h-12 items-center gap-3 rounded-xl bg-canvas px-5 text-ink">
                <Icon icon={stat.Icon} size={24} className="shrink-0" />
                <span className="truncate text-base font-semibold leading-5.25">
                  {stat.value}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 6. Hisobot: chapda 80px donut, o'ngda uch qatorli izoh. */}
        <div className="shrink-0">
          <Caption>Hisobot</Caption>
          <div className="flex items-start gap-5 rounded-xl bg-canvas p-3">
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
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {node.report.map((slice) => (
                <div key={slice.key} className="flex items-center gap-2.5">
                  <span
                    className="size-4 shrink-0 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs leading-4.5 text-ink-soft">{slice.label}</p>
                    <p className="mt-1.5 truncate text-base font-semibold leading-5.25 text-ink">
                      {slice.display}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 7. Ma'sul shaxs. */}
        <div className="shrink-0">
          <Caption>Ma&rsquo;sul shaxs</Caption>
          <div className="flex h-12 items-center gap-3 rounded-xl bg-canvas px-5 text-ink">
            <Icon icon={UserShield} size={24} className="shrink-0" />
            <span className="truncate text-base font-semibold leading-5.25">
              {node.responsible}
            </span>
          </div>
        </div>

        {/* 8. Sarfi yuqori transformatorlar - qiymat o'ngda va qizil. */}
        <div className="shrink-0">
          <Caption>Sarfi yuqori transformatorlar</Caption>
          <div className="flex flex-col gap-2.5">
            {node.topConsumers.map((tp) => (
              <div
                key={tp.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-5 py-3 text-ink"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon icon={CircuitBoard} size={20} className="shrink-0" />
                  <span className="truncate text-base font-semibold leading-5.25">{tp.label}</span>
                </span>
                <span className="shrink-0 text-base font-semibold leading-5.25 text-trend-up">
                  {tp.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
