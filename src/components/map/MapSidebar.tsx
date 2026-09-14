import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { SidebarPanel } from "@/components/shell/AppShell";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

import { MAP_ICONS } from "./icons";
import type { MapChildList, MapIconKey, MapLink } from "./types";

/** Maketda uchala qator turi ham bir xil o'lchamda: 48px, px-20, r12. */
const ROW = "flex h-12 w-full items-center gap-4 rounded-xl px-5 text-left transition-colors";

/**
 * Xarita ierarxiyasi bo'yicha yurish: ota tugun (ortga), joriy tugun va
 * uning bolalari. Har bir qator - `/map?node=...` havolasi, shuning uchun
 * brauzerning "orqaga" tugmasi ham ishlaydi.
 */
export function MapSidebar({
  current,
  parent,
  items,
  periodSelect,
}: {
  current: { label: string; icon: MapIconKey };
  /** Tumanning o'zida `null` - "ortga" qatori ko'rsatilmaydi. */
  parent: MapLink | null;
  /** Abonent darajasida va holat yo'q oyda - null. */
  items: MapChildList | null;
  /** Hisobot oyi tanlagichi (server qismi). */
  periodSelect: ReactNode;
}) {
  return (
    <SidebarPanel title="Joylashuvlar">
      {periodSelect}
      <nav aria-label="Xarita joylashuvlari">
        <ul className="flex flex-col gap-2">
          {parent ? (
            <li>
              <Link href={parent.href} className={cn(ROW, "text-ink hover:bg-canvas")}>
                <span className="shrink-0">
                  <Icon icon={ChevronLeft} size={24} />
                </span>
                <span className="truncate text-base font-semibold">{parent.label}</span>
              </Link>
            </li>
          ) : null}

          {/* Joriy tugun - ochiq holat, shuning uchun o'ngda chevron-down. */}
          <li>
            <div className={cn(ROW, "bg-brand text-white")} aria-current="page">
              <span className="shrink-0">
                <Icon icon={MAP_ICONS[current.icon]} size={24} />
              </span>
              <span className="truncate text-base font-semibold" title={current.label}>
                {current.label}
              </span>
              {items ? (
                <span className="ml-auto shrink-0">
                  <Icon icon={ChevronDown} size={24} />
                </span>
              ) : null}
            </div>
          </li>

          {items ? (
            <li className="flex h-6 items-center justify-between gap-2 px-5 text-xs text-ink-soft">
              <span className="truncate font-medium">{items.title}</span>
              {items.countLabel ? <span className="shrink-0">{items.countLabel}</span> : null}
            </li>
          ) : null}

          {items?.items.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className={cn(ROW, "text-ink hover:bg-canvas")}>
                <span className="shrink-0">
                  <Icon icon={MAP_ICONS[item.icon]} size={24} />
                </span>
                <span className="truncate text-base font-semibold" title={item.label}>
                  {item.label}
                </span>
                <span className="ml-auto shrink-0 text-ink-soft">
                  <Icon icon={ChevronRight} size={24} />
                </span>
              </Link>
            </li>
          ))}

          {items?.emptyText ? (
            <li className="rounded-xl bg-canvas px-5 py-3 text-xs text-ink-muted">{items.emptyText}</li>
          ) : null}

          {items?.truncated ? (
            <li className="flex flex-col gap-1.5 rounded-xl bg-canvas px-5 py-3 text-xs text-ink-muted">
              <span>{items.truncated.text}</span>
              <Link
                href={items.truncated.href}
                className="flex items-center gap-1 font-medium text-brand transition-opacity hover:opacity-70"
              >
                {items.truncated.linkLabel}
                <Icon icon={ArrowRight} size={14} />
              </Link>
            </li>
          ) : null}
        </ul>
      </nav>
    </SidebarPanel>
  );
}
