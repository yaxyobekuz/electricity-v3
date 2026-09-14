import {
  ChartNoAxesColumn,
  CircuitBoard,
  Factory,
  FileText,
  Hand,
  House,
  LayoutDashboard,
  ListChecks,
  Map as MapIcon,
  MessagesSquare,
  Search,
  Upload,
  Users,
  Workflow,
} from "lucide-react";

import type { GlyphIcon } from "@/components/ui/Icon";
import { UserGroup } from "@/components/ui/icons/UserGroup";

/** Ish maydoni yon panelining standart sarlavhasi (obyekt sahifasidan tashqari). */
export const DISTRICT_TITLE = "Baliqchi tumani elektr ta’minoti";

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

// Monitoring, Tarmoq holati va Sun'iy intellekt bo'limlari olib tashlangan:
// ularning Excel shablonlarida manbasi yo'q (`.claude/docs/malumotlar.md`, 8-bo'lim).
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
      "/appeals",
      "/imports",
    ],
  },
  { key: "search", label: "Qidiruv", Icon: Search, href: "/search", match: ["/search"] },
  { key: "map", label: "Xarita", Icon: MapIcon, href: "/map", match: ["/map"] },
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
  { key: "staff", label: "Ma’sul xodimlar", Icon: UserGroup, href: "/staff" },
  { key: "reports", label: "Hisobotlar", Icon: FileText, href: "/reports" },
  { key: "appeals", label: "Murojaatlar", Icon: MessagesSquare, href: "/appeals" },
  // Barcha ma'lumot shu sahifadagi Excel shablonlaridan keladi.
  { key: "imports", label: "Ma’lumot yuklash", Icon: Upload, href: "/imports" },
];
