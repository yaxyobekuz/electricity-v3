import { FileExclamationPoint, Gavel, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

interface ViolationStat {
  id: string;
  label: string;
  value: string;
  icon: GlyphIcon;
  /** Ikonka va son bir xil tusda (`currentColor`). */
  tone: string;
}

const TOTAL: ViolationStat = {
  id: "total",
  label: "Umumiy aniqlangan holatlar",
  value: "911 ta",
  icon: ShieldCheck,
  tone: "text-brand",
};

const STATS: readonly ViolationStat[] = [
  {
    id: "administrative",
    label: "Ma’muriy",
    value: "45 ta",
    icon: FileExclamationPoint,
    tone: "text-accent-amber",
  },
  { id: "criminal", label: "Jinoiy", value: "3 ta", icon: Gavel, tone: "text-accent-red" },
  // Maketdagi imlo ("aybisiz") ataylab saqlangan.
  {
    id: "innocent",
    label: "Istemolchi aybisiz",
    value: "13 ta",
    icon: ShieldCheck,
    tone: "text-[#31ae5f]",
  },
];

/** 18px izoh, 10px pastda 45px quti: 20px ikonka + 8px + 16px bold son, markazda. */
function Stat({ stat, className }: { stat: ViolationStat; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <span className="truncate text-sm leading-[18px] text-[#999999]">{stat.label}</span>
      <div
        className={cn(
          "mt-2.5 flex h-[45px] items-center justify-center gap-2 rounded-lg bg-canvas",
          stat.tone,
        )}
      >
        {/* Maketda qalqon ikonkasi 1.5px emas, 2px chiziqda chizilgan. */}
        <Icon
          icon={stat.icon}
          size={20}
          className={cn("shrink-0", stat.icon === ShieldCheck && "[stroke-width:2]")}
        />
        <span className="text-base leading-[21px] font-bold">{stat.value}</span>
      </div>
    </div>
  );
}

/**
 * Bosh sahifadagi "Qoidabuzarliklar" (Figma `4126:498`, 486.67x220).
 *
 * Fider sahifasidagi `ViolationsCard` dan farqi: sarlavhada amal yo'q (18px),
 * tepada butun kenglikdagi "Umumiy" qatori, qutilar 45px va tarkibi markazda.
 * 16 + 18 + 12 + 73 + 12 + 73 + 16 = 220.
 */
export function HomeViolationsCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <h2 className="shrink-0 truncate text-sm leading-[18px] font-bold text-ink">
        Qoidabuzarliklar
      </h2>
      <Stat stat={TOTAL} className="mt-3 shrink-0" />
      <div className="mt-3 grid shrink-0 grid-cols-3 gap-2">
        {STATS.map((stat) => (
          <Stat key={stat.id} stat={stat} />
        ))}
      </div>
    </Card>
  );
}
