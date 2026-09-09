"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

import { AiPromo } from "./AiPromo";
import { SidebarPanel } from "./AppShell";
import { WORKSPACE_LINKS } from "./nav";

/**
 * "Boshqaruv paneli" bo'limining ikkilamchi paneli - sahifa havolalari va
 * pastda AI reklama kartasi.
 */
export function WorkspaceSidebar() {
  const pathname = usePathname();

  return (
    <SidebarPanel title="Xaqulobod fideri" footer={<AiPromo />}>
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
