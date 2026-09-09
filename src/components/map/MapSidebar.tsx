import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircuitBoard,
  Factory,
  User,
  Workflow,
} from "lucide-react";

import { SidebarPanel } from "@/components/shell/AppShell";
import { Icon, type GlyphIcon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

import type { MapLevel, MapLocation } from "./types";

/** Daraja ikonkalari (notes.md: fider -> workflow, TP -> circuit-board). */
const LEVEL_ICONS: Record<MapLevel, GlyphIcon> = {
  substation: Factory,
  feeder: Workflow,
  tp: CircuitBoard,
  subscriber: User,
};

/** Maketda uchala qator turi ham bir xil o'lchamda: 48px, px-20, r12. */
const ROW = "flex h-12 w-full items-center gap-4 rounded-xl px-5 text-left transition-colors";

export function MapSidebar({
  current,
  parent,
  onNavigate,
  selectedId = null,
}: {
  current: MapLocation;
  /** Ildizda `null` - "ortga" qatori ko'rsatilmaydi. */
  parent: MapLocation | null;
  onNavigate: (id: string) => void;
  /** Xaritada tanlangan bola - ro'yxatda ham ajratib ko'rsatiladi. */
  selectedId?: string | null;
}) {
  const children = current.children ?? [];

  return (
    <SidebarPanel title="Joylashuvlar">
      <nav aria-label="Xarita joylashuvlari">
        <ul className="flex flex-col gap-2">
          {parent ? (
            <li>
              <button
                type="button"
                onClick={() => onNavigate(parent.id)}
                className={cn(ROW, "text-ink hover:bg-canvas")}
              >
                <span className="shrink-0">
                  <Icon icon={ChevronLeft} size={24} />
                </span>
                <span className="truncate text-base font-semibold">{parent.label}</span>
              </button>
            </li>
          ) : null}

          {/* Joriy tugun - ochiq holat, shuning uchun o'ngda chevron-down. */}
          <li>
            <div className={cn(ROW, "bg-brand text-white")} aria-current="true">
              <span className="shrink-0">
                <Icon icon={LEVEL_ICONS[current.level]} size={24} />
              </span>
              <span className="truncate text-base font-semibold">{current.label}</span>
              <span className="ml-auto shrink-0">
                <Icon icon={ChevronDown} size={24} />
              </span>
            </div>
          </li>

          {children.map((child) => (
            <li key={child.id}>
              <button
                type="button"
                onClick={() => onNavigate(child.id)}
                className={cn(
                  ROW,
                  "text-ink hover:bg-canvas",
                  child.id === selectedId && "bg-canvas",
                )}
              >
                <span className="shrink-0">
                  <Icon icon={LEVEL_ICONS[child.level]} size={24} />
                </span>
                <span className="truncate text-base font-semibold">{child.label}</span>
                <span className="ml-auto shrink-0 text-ink-soft">
                  <Icon icon={ChevronRight} size={24} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </SidebarPanel>
  );
}
