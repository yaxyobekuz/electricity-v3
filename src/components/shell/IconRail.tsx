"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

import { RAIL_FOOTER, RAIL_SECTIONS, type RailSection } from "./nav";

/** Barcha ikonkalar uchun bir xil 56px katak. */
const CELL = "flex h-14 w-full items-center justify-center rounded-lg text-white transition-colors";

/**
 * Bo'lim kataklari. Sahifasi yo'q bo'lim (`ready: false`) havola emas -
 * bosilmaydigan tugma: chalg'ituvchi bo'sh sahifa ochilmasin.
 */
function RailItem({ section, active }: { section: RailSection; active: boolean }) {
  const glyph = <Icon icon={section.Icon} size={32} />;

  if (section.ready === false) {
    return (
      <li className="w-full">
        <button
          type="button"
          disabled
          title={`${section.label} - sahifa tayyor emas`}
          aria-label={`${section.label} - sahifa tayyor emas`}
          className={cn(CELL, "cursor-not-allowed text-white/40")}
        >
          {glyph}
        </button>
      </li>
    );
  }

  return (
    <li className="w-full">
      <Link
        href={section.href}
        title={section.label}
        aria-label={section.label}
        aria-current={active ? "page" : undefined}
        className={cn(CELL, active ? "bg-rail-active" : "hover:bg-white/10")}
      >
        {glyph}
      </Link>
    </li>
  );
}

/**
 * Chapdagi qora ikonka paneli (72px, Figma `4126:50`). Yirik bo'limlar shu
 * yerda; faol bo'lim joriy URL prefiksi bo'yicha aniqlanadi.
 *
 * Pastda - maketdagi avatar va sozlamalar. Tizimda foydalanuvchi ma'lumoti
 * yo'q (autentifikatsiya qo'shilmagan), shuning uchun avatar - statik rasm,
 * sozlamalar esa bosilmaydi.
 */
export function IconRail() {
  const pathname = usePathname();
  const isActive = (section: RailSection) =>
    section.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

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
            className={cn(CELL, "hover:bg-white/10")}
          >
            <Icon icon={LayoutGrid} size={32} />
          </Link>
        </li>
        <li aria-hidden className="my-0.5 h-px w-8 shrink-0 bg-white/15" />

        {RAIL_SECTIONS.map((section) => (
          <RailItem key={section.key} section={section} active={isActive(section)} />
        ))}
      </ul>

      <ul className="flex flex-col items-center gap-3">
        <li className="w-full">
          <span className={cn(CELL, "cursor-default")}>
            <Image
              src="/home/avatar.png"
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full bg-white object-cover"
            />
          </span>
        </li>
        {RAIL_FOOTER.map((section) => (
          <RailItem key={section.key} section={section} active={isActive(section)} />
        ))}
      </ul>
    </nav>
  );
}
