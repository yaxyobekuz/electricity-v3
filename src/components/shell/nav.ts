import {
  Astroid,
  ChartNoAxesColumn,
  CircuitBoard,
  Factory,
  FileText,
  Hand,
  House,
  LayoutDashboard,
  LayoutPanelTop,
  ListChecks,
  Map as MapIcon,
  Search,
  Settings,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

import type { GlyphIcon } from "@/components/ui/Icon";
import { UserGroup } from "@/components/ui/icons/UserGroup";

/** Chap ikonka panelidagi yirik bo'lim. */
export interface RailSection {
  key: string;
  label: string;
  Icon: GlyphIcon;
  /** Bo'limning bosh manzili. */
  href: string;
  /** Shu bo'limga tegishli barcha yo'llar prefiksi. */
  match: string[];
}

/** Ikkilamchi paneldagi sahifa havolasi. */
export interface SidebarLink {
  key: string;
  label: string;
  Icon: GlyphIcon;
  href: string;
}

export const RAIL_SECTIONS: RailSection[] = [
  {
    key: "workspace",
    label: "Boshqaruv paneli",
    Icon: House,
    href: "/dashboard",
    match: [
      "/dashboard",
      "/substations",
      "/feeders",
      "/transformers",
      "/subscribers",
      "/violations",
      "/statistics",
      "/works",
      "/staff",
      "/reports",
      "/settings",
    ],
  },
  { key: "search", label: "Qidiruv", Icon: Search, href: "/search", match: ["/search"] },
  { key: "map", label: "Xarita", Icon: MapIcon, href: "/map", match: ["/map"] },
  { key: "ai", label: "Sun'iy intellekt", Icon: Astroid, href: "/ai", match: ["/ai"] },
  {
    key: "monitoring",
    label: "Monitoring paneli",
    Icon: LayoutPanelTop,
    href: "/monitoring",
    match: ["/monitoring"],
  },
  { key: "grid", label: "Tarmoq holati", Icon: Zap, href: "/grid", match: ["/grid"] },
];

/** "Boshqaruv paneli" bo'limining ikkilamchi paneli. */
export const WORKSPACE_LINKS: SidebarLink[] = [
  { key: "dashboard", label: "Asosiy", Icon: LayoutDashboard, href: "/dashboard" },
  { key: "substations", label: "Podstansiyalar", Icon: Factory, href: "/substations" },
  { key: "feeders", label: "Fiderlar", Icon: Workflow, href: "/feeders" },
  { key: "transformers", label: "Transformatorlar", Icon: CircuitBoard, href: "/transformers" },
  { key: "subscribers", label: "Abonentlar", Icon: Users, href: "/subscribers" },
  { key: "violations", label: "Qoidabuzarliklar", Icon: Hand, href: "/violations" },
  { key: "statistics", label: "Statistika", Icon: ChartNoAxesColumn, href: "/statistics" },
  { key: "works", label: "Ishlar", Icon: ListChecks, href: "/works" },
  { key: "staff", label: "Ma'sul xodimlar", Icon: UserGroup, href: "/staff" },
  { key: "reports", label: "Hisobotlar", Icon: FileText, href: "/reports" },
  { key: "settings", label: "Sozlamalar", Icon: Settings, href: "/settings" },
];
