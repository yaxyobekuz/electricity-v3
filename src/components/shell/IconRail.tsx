"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Settings } from "lucide-react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

import { RAIL_SECTIONS } from "./nav";

/**
 * Chapdagi qora ikonka paneli (72px). Yirik bo'limlar shu yerda; faol bo'lim
 * joriy URL prefiksi bo'yicha aniqlanadi.
 */
export function IconRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Asosiy bo'limlar"
      className="flex w-[72px] shrink-0 select-none flex-col justify-between overflow-hidden rounded-2xl bg-rail p-1.5"
    >
      <ul className="flex flex-col items-center gap-3">
        {/* Portalga qaytish. Usiz tarmoq yo'nalishini tanlash ekraniga faqat
            manzilni qo'lda yozib qaytish mumkin bo'lardi. */}
        <li className="w-full">
          <Link
            href="/"
            title="Tarmoq yo’nalishlari"
            aria-label="Tarmoq yo’nalishlari"
            className="flex h-14 w-full items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
          >
            <Icon icon={LayoutGrid} size={32} />
          </Link>
        </li>
        <li aria-hidden className="my-0.5 h-px w-8 shrink-0 bg-white/15" />

        {RAIL_SECTIONS.map((section) => {
          const active = section.match.some(
            (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
          );
          return (
            <li key={section.key} className="w-full">
              <Link
                href={section.href}
                title={section.label}
                aria-label={section.label}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 w-full items-center justify-center rounded-lg text-white transition-colors",
                  active ? "bg-rail-active" : "hover:bg-white/10",
                )}
              >
                <Icon icon={section.Icon} size={32} />
              </Link>
            </li>
          );
        })}
      </ul>

      <ul className="flex flex-col items-center gap-3">
        <li className="w-full">
          <Link
            href="/settings"
            title="Profil"
            aria-label="Profil"
            className="flex h-14 w-full items-center justify-center rounded-lg transition-colors hover:bg-white/10"
          >
            <span className="flex size-8 items-center justify-center overflow-hidden rounded-full bg-white">
              <Image
                src="/brand/avatar.png"
                alt=""
                width={32}
                height={32}
                className="size-8 object-cover"
              />
            </span>
          </Link>
        </li>
        <li className="w-full">
          <Link
            href="/settings"
            title="Sozlamalar"
            aria-label="Sozlamalar"
            className="flex h-14 w-full items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
          >
            <Icon icon={Settings} size={32} />
          </Link>
        </li>
      </ul>
    </nav>
  );
}
