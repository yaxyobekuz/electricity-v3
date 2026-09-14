"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import { findFeeder } from "@/lib/data/feeders";
import { findTransformer } from "@/lib/data/transformers";
import { cn } from "@/lib/ui/cn";

import { AiPromo } from "./AiPromo";
import { SidebarPanel } from "./AppShell";
import { WORKSPACE_LINKS } from "./nav";

const DISTRICT_TITLE = "Baliqchi tumani elektr ta’minoti";

/**
 * Panel sarlavhasi: bosh sahifa maketida (Figma `4126:80`) butun tuman,
 * fider detal sahifasi maketida esa o'sha fider nomi ("Xaqulobod fideri").
 * TP sahifasi fider maketida va faqat o'z qamrovini ko'rsatadi - sarlavhada
 * ham o'sha TP.
 */
function panelTitle(pathname: string): string {
  const [, section, id] = pathname.split("/");
  if (section === "feeders" && id) return findFeeder(id)?.name ?? DISTRICT_TITLE;
  if (section === "transformers" && id) {
    const transformer = findTransformer(id);
    return transformer ? `${transformer.code} transformatori` : DISTRICT_TITLE;
  }
  return DISTRICT_TITLE;
}

/**
 * "Boshqaruv paneli" bo'limining ikkilamchi paneli - sahifa havolalari va
 * pastda AI reklama kartasi.
 */
export function WorkspaceSidebar() {
  const pathname = usePathname();

  return (
    <SidebarPanel title={panelTitle(pathname)} footer={<AiPromo />}>
      <nav aria-label="Boshqaruv paneli sahifalari">
        <ul className="flex flex-col gap-2">
          {WORKSPACE_LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <li key={link.key}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-4 rounded-xl px-5 py-3 transition-colors",
                    active ? "bg-brand text-white" : "text-ink hover:bg-canvas",
                  )}
                >
                  <span className="shrink-0">
                    <Icon icon={link.Icon} size={24} />
                  </span>
                  <span className="truncate text-base font-semibold">{link.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </SidebarPanel>
  );
}
