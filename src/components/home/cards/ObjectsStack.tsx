import { CircuitBoard, Factory, UtilityPole } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/ui/cn";

import { SummaryTile } from "./SummaryTile";

const OBJECTS = [
  {
    id: "substations",
    value: "4ta",
    label: "Podstansiyalar",
    href: "/substations",
    icon: Factory,
    tint: "bg-tint-blue",
    accent: "text-accent-blue",
    glow: "bg-accent-blue",
  },
  {
    id: "feeders",
    value: "21ta",
    label: "Fiderlar",
    href: "/feeders",
    icon: UtilityPole,
    tint: "bg-tint-green",
    accent: "text-accent-green",
    glow: "bg-accent-green",
  },
  {
    id: "transformers",
    value: "984ta",
    label: "Transformator",
    href: "/transformers",
    icon: CircuitBoard,
    tint: "bg-tint-indigo",
    accent: "text-accent-indigo",
    glow: "bg-accent-indigo",
  },
] as const;

/** Ikki teng ustun (140.89px, oraliq 8px): izoh 46px, ostida 29px quti. */
const INSPECTIONS = [
  { id: "done", label: "Ko’rikdan o’tkazilgan", value: "45 ta", tone: "text-[#31ae5f]" },
  { id: "due", label: "Ko’rikdan o’tkazilishi kerak", value: "3 ta", tone: "text-accent-amber" },
] as const;

/** "Obektlar holati" (Figma `4289:353`, 321.78x138). */
function ObjectStatusCard() {
  return (
    <Card>
      <h2 className="shrink-0 truncate text-sm leading-[18px] font-bold text-ink">
        Obektlar holati
      </h2>
      <div className="mt-2 grid shrink-0 grid-cols-2 gap-2">
        {INSPECTIONS.map((item) => (
          <div key={item.id} className="flex min-w-0 flex-col">
            {/* Ikkinchi izoh ikki qatorga o'raladi (36px) - quti joyida qoladi. */}
            <span className="h-[46px] text-sm leading-[18px] text-[#999999]">{item.label}</span>
            <span
              className={cn(
                "flex h-[29px] items-center justify-center rounded-lg bg-canvas text-base leading-[21px] font-bold",
                item.tone,
              )}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/**
 * 2-qatorning chap ustuni (Figma `4179:2`, "KPI cards 2", 321.78x402):
 * uchta 80px ob'ekt kartasi va 138px "Obektlar holati", oraliq 8px.
 * 80 + 8 + 80 + 8 + 80 + 8 + 138 = 402.
 */
export function ObjectsStack({ className }: { className?: string }) {
  return (
    <div className={cn("grid min-h-0 grid-rows-[80px_80px_80px_minmax(0,1fr)] gap-2", className)}>
      {OBJECTS.map(({ id, ...item }) => (
        <SummaryTile key={id} actionLabel="Ochish" {...item} />
      ))}
      <ObjectStatusCard />
    </div>
  );
}
