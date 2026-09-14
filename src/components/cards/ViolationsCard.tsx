import { FileDown, FileExclamationPoint, Gavel, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { IconPill } from "@/components/ui/IconPill";
import { cn } from "@/lib/ui/cn";

interface ViolationStat {
  id: string;
  label: ReactNode;
  value: string;
  icon: GlyphIcon;
  /** Maketda ikonka va son bir xil tusda; ikkitasiga token yo'q - aniq hex. */
  tone: string;
  /** Maketda faqat qalqon ikonkasi 1.5px emas, 2px chiziqda chizilgan. */
  iconClassName?: string;
}

export type ViolationCounts = Record<"administrative" | "criminal" | "innocent", number>;

/** Maketdagi sonlar (fider sahifasi). */
const DEFAULT_COUNTS: ViolationCounts = { administrative: 4, criminal: 1, innocent: 3 };

function buildStats(counts: ViolationCounts): readonly ViolationStat[] {
  return [
    {
      id: "administrative",
      label: <>Ma&rsquo;muriy holat</>,
      value: `${counts.administrative} ta`,
      icon: FileExclamationPoint,
      tone: "text-[#f59e0b]",
    },
    {
      id: "criminal",
      label: "Jinoiy holat",
      value: `${counts.criminal} ta`,
      icon: Gavel,
      tone: "text-accent-red",
    },
    {
      id: "innocent",
      label: "Aybsiz",
      value: `${counts.innocent} ta`,
      icon: ShieldCheck,
      tone: "text-[#31ae5f]",
      iconClassName: "[stroke-width:2]",
    },
  ];
}

/**
 * "Qoidabuzarliklar" kartasi (Figma `4029:1344`, 487x148).
 *
 * Uch teng ustun (146.22px, oraliq 8px): 14px izoh, undan 10px pastda
 * 48px balandlikdagi #f3f3f3 quti - 24px ikonka va 16px bold son.
 * Transformator sahifasida sonlar o'sha TP dalolatnomalaridan - `counts`.
 */
export function ViolationsCard({
  counts = DEFAULT_COUNTS,
  className,
}: {
  counts?: ViolationCounts;
  className?: string;
}) {
  const stats = buildStats(counts);
  return (
    <Card className={className}>
      <CardHeader title="Qoidabuzarliklar">
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>
      <CardBody>
        <div className="grid min-h-0 grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.id} className="flex min-w-0 flex-col">
              <span className="truncate text-sm leading-[18px] text-[#999999]">
                {stat.label}
              </span>
              {/* Quti ichidagi rang ikonkaga ham, songa ham `currentColor` orqali o'tadi */}
              <div
                className={cn(
                  "mt-2.5 flex h-12 items-center gap-3 rounded-lg bg-canvas pl-5",
                  stat.tone,
                )}
              >
                <Icon
                  icon={stat.icon}
                  size={24}
                  className={cn("shrink-0", stat.iconClassName)}
                />
                <span className="text-base leading-[21px] font-bold">{stat.value}</span>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
