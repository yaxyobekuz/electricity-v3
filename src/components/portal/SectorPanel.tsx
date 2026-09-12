"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Icon } from "@/components/ui/Icon";

import { PendingBar } from "./PendingBar";
import type { Sector } from "./sectors";

/* ---------------------------------------------------------------------------
   Bitta tarmoq yo'nalishi paneli.

   Boshqaruv (havola yoki tugma) sarlavhaning ICHIDA turadi va `::after`
   orqali butun plitani qoplaydi: bitta tab to'xtashi, to'g'ri HTML va
   hisoblangan nom sarlavha matniga teng bo'ladi.

   Panelda hover holati YO'Q - qimirlash, rang o'zgarishi va soya ataylab
   olib tashlangan. Yagona vizual javob - klaviatura fokusi halqasi.
   --------------------------------------------------------------------------- */

interface SectorPanelProps {
  sector: Sector;
  /** Kirish animatsiyasining kechikishi (ms). */
  delay: number;
  /** Izometrik obyekt. */
  art: ReactNode;
  /** Obyekt yonidagi texnik yorliq. */
  tag: ReactNode;
}

export function SectorPanel({ sector, delay, art, tag }: SectorPanelProps) {
  const [noteShown, setNoteShown] = useState(false);

  // `--s-base` va `--s-tint` yuklanish chizig'iga kerak (`PendingBar`).
  const style = {
    "--s-base": sector.base,
    "--s-tint": sector.tint,
    animationDelay: `${delay}ms`,
  } as CSSProperties;

  const label = (
    <>
      {sector.title}
      {sector.href ? (
        <span className="sr-only"> platformasiga kirish</span>
      ) : (
        <span className="sr-only"> — bu yo&rsquo;nalish hali ishga tushirilmagan</span>
      )}
    </>
  );

  return (
    <li
      data-tone={sector.id}
      style={style}
      className="portal-enter min-h-[168px] min-w-0 lg:min-h-[196px]"
    >
      <article className="sector-plate relative flex h-full flex-col rounded-2xl border bg-surface p-4 lg:p-5">
        <div className="relative flex h-full min-h-0 flex-col">
          <div className="flex h-5 shrink-0 items-center justify-between gap-2">
            <span className="font-mono text-[11px] leading-4 tracking-[0.08em] text-ink-muted">
              {sector.index}
            </span>
            <span
              className="rounded-full border px-2 py-0.5 text-[10px] leading-4 font-semibold"
              style={
                sector.href
                  ? { background: "#effff0", borderColor: "#86efac", color: "#15803d" }
                  : { background: "#fff7ed", borderColor: "#fcd34d", color: "#b45309" }
              }
            >
              {sector.badge}
            </span>
          </div>

          <h3 className="mt-3.5 max-w-[calc(100%-96px)] text-base leading-5 font-bold text-ink lg:mt-4 lg:max-w-[calc(100%-124px)] lg:text-[17px] lg:leading-5.5">
            {sector.href ? (
              <Link
                href={sector.href}
                className="sector-link"
                aria-describedby={`portal-sub-${sector.id}`}
              >
                {label}
                <PendingBar />
              </Link>
            ) : (
              <button
                type="button"
                className="sector-link cursor-pointer text-left"
                aria-describedby={`portal-sub-${sector.id}`}
                onClick={() => setNoteShown(true)}
              >
                {label}
              </button>
            )}
          </h3>

          <p
            id={`portal-sub-${sector.id}`}
            className="mt-1.5 max-w-[calc(100%-96px)] text-xs leading-4.25 text-ink-muted lg:max-w-[calc(100%-124px)]"
          >
            {sector.subtitle}
          </p>

          <div className="min-h-0 flex-1" />

          {/* Joy oldindan band - izoh chiqqanda layout siljimaydi. */}
          <p role="status" className="h-4 text-[11px] leading-4 text-ink-muted">
            {noteShown ? sector.note : ""}
          </p>

          <span aria-hidden className="h-px shrink-0 bg-hairline" />

          <div className="mt-3 flex h-8 shrink-0 items-center justify-between gap-2">
            {sector.cta ? (
              <span
                className="flex h-8 items-center rounded-lg px-3 text-xs leading-4 font-medium text-white"
                style={{ background: sector.deep }}
              >
                {sector.cta}
              </span>
            ) : (
              <span className="text-[11px] leading-4 text-ink-muted">{sector.footnote}</span>
            )}
            <span className="sector-arrow flex size-8 items-center justify-center rounded-lg">
              <Icon icon={ArrowRight} size={18} />
            </span>
          </div>
        </div>

        {/* Izometrik obyekt: kontakt soyasi, tana va yorliq. */}
        <div className="sector-art pointer-events-none absolute top-1/2 right-4 size-23 lg:right-5 lg:size-32">
          {art}
          <div className="absolute inset-0">{tag}</div>
        </div>
      </article>
    </li>
  );
}
