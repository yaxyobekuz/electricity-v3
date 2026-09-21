"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

import { AiPromoCard } from "./AiPromoCard";
import { SidebarPanel } from "./AppShell";
import { DISTRICT_TITLE, WORKSPACE_LINKS } from "./nav";

/** Sarlavhasi obyekt nomi bo'ladigan detal sahifalar (`/<bo'lim>/<id>`). */
const DETAIL_SECTIONS = new Set(["substations", "feeders", "transformers", "subscribers"]);

function isDetailPath(pathname: string): boolean {
  const [, section, id, rest] = pathname.split("/");
  return DETAIL_SECTIONS.has(section) && Boolean(id) && !rest;
}

/**
 * "Boshqaruv paneli" bo'limining ikkilamchi paneli: sarlavha, hisobot oyi
 * tanlagichi va sahifa havolalari.
 *
 * Sarlavha: detal sahifalarida - serverda bazadan olingan obyekt nomi
 * (`(workspace)/@title` sloti), qolgan sahifalarda - tuman sarlavhasi.
 * Tuman sarlavhasi slotdan emas, shu yerdan chiziladi: `loading.tsx` slotni
 * ham Suspense bilan o'raydi va ro'yxat sahifalari orasida sarlavha
 * bekorga skeletga almashib ketardi.
 *
 * `periodSelect` - maketda `<Suspense>` ichida chizilgan server qismi
 * (`SidebarPeriod`); bu mijoz komponenti bazaga murojaat qilmaydi.
 *
 * `workspace-title` klassi - `loading.tsx` / `error.tsx` sarlavha ichida
 * chizilganini CSS orqali bilib, ixcham ko'rinishga o'tishi uchun.
 */
export function WorkspaceSidebar({
  title,
  periodSelect,
}: {
  title: ReactNode;
  periodSelect: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SidebarPanel
      title={
        isDetailPath(pathname) ? <span className="workspace-title">{title}</span> : DISTRICT_TITLE
      }
      footer={<AiPromoCard />}
    >
      {periodSelect}
      <nav aria-label="Boshqaruv paneli sahifalari">
        <ul className="flex flex-col gap-2">
          {WORKSPACE_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const row = (
              <>
                <span className="shrink-0">
                  <Icon icon={link.Icon} size={24} />
                </span>
                <span className="truncate text-base font-semibold">{link.label}</span>
              </>
            );
            const shape = "flex w-full items-center gap-4 rounded-xl px-5 py-3 transition-colors";
            return (
              <li key={link.key}>
                {link.ready === false ? (
                  // Maketda bor, sahifasi yo'q: bo'sh sahifaga olib bormaydi.
                  <button
                    type="button"
                    disabled
                    title="Sahifa tayyor emas"
                    className={cn(shape, "cursor-not-allowed text-ink/40")}
                  >
                    {row}
                  </button>
                ) : (
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(shape, active ? "bg-brand text-white" : "text-ink hover:bg-canvas")}
                  >
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </SidebarPanel>
  );
}
