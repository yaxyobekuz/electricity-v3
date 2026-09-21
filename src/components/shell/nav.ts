import {
  ChartNoAxesColumn,
  Cctv,
  CircuitBoard,
  Factory,
  FileText,
  Hand,
  House,
  LayoutDashboard,
  ListChecks,
  LayoutPanelTop,
  Map as MapIcon,
  MessagesSquare,
  Search,
  Settings,
  Sparkles,
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
  /** Sahifasi bor (maketdagi, lekin manbasiz bo'limlarda - `false`). */
  ready?: boolean;
}

/** Ikkilamchi paneldagi sahifa havolasi. */
export interface SidebarLink {
  key: string;
  label: string;
  Icon: GlyphIcon;
  href: string;
  /** Sahifasi bor; maketdagi manbasiz havolalarda - `false`. */
  ready?: boolean;
}

/*
 * Maketda (Figma `4126:47`) ikonka panelida 6 ta bo'lim bor. Sun'iy intellekt,
 * Tarmoq holati va Monitoring bo'limlarining Excel shablonlarida manbasi yo'q
 * (`malumotlar.md` 8-bo'lim), lekin foydalanuvchi qaroriga ko'ra (2026-09-21)
 * maket to'liq quriladi: ular ko'rinadi, ammo `ready: false` - bosilganda
 * "sahifa tayyor emas" deb turadi, chalg'ituvchi bo'sh sahifa ochilmaydi.
 */
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
  { key: "ai", label: "Sun’iy intellekt", Icon: Sparkles, href: "#", match: [], ready: false },
  { key: "network", label: "Tarmoq holati", Icon: LayoutPanelTop, href: "#", match: [], ready: false },
  { key: "monitoring", label: "Monitoring", Icon: Cctv, href: "#", match: [], ready: false },
];

/** Ikonka panelining pastki qismi (maketda avatar va sozlamalar). */
export const RAIL_FOOTER: RailSection[] = [
  { key: "settings", label: "Sozlamalar", Icon: Settings, href: "#", match: [], ready: false },
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
