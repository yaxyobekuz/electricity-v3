import {
  Banknote,
  CircuitBoard,
  Factory,
  Hand,
  Map as MapIcon,
  MessagesSquare,
  PiggyBank,
  User,
  UserRound,
  Wifi,
  WifiOff,
  Workflow,
} from "lucide-react";

import type { GlyphIcon } from "@/components/ui/Icon";

import type { MapIconKey } from "./types";

/**
 * Serverdan matn kalit keladi (komponentni serializatsiya qilib bo'lmaydi) -
 * ikonka shu jadval orqali mijozda tanlanadi. Obyekt ikonkalari chap panel
 * bilan bir xil (`shell/nav.ts`: fider - workflow, TP - circuit-board).
 */
export const MAP_ICONS: Record<MapIconKey, GlyphIcon> = {
  district: MapIcon,
  substation: Factory,
  feeder: Workflow,
  transformer: CircuitBoard,
  subscriber: User,
  online: Wifi,
  offline: WifiOff,
  debt: Banknote,
  credit: PiggyBank,
  violation: Hand,
  appeal: MessagesSquare,
  kind: UserRound,
};
