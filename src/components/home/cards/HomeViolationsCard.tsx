import { FileExclamationPoint, Gavel, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import type { ViolatorType } from "@/generated/prisma";
import type { HomeViolations } from "@/lib/queries/home-data";
import { cn } from "@/lib/ui/cn";

interface ViolationStat {
  label: string;
  value: string;
  href: string;
  icon: GlyphIcon;
  /** Ikonka va son bir xil tusda (`currentColor`). */
  tone: string;
}

/** Shablondagi "Turi" ustuni: Yuridik / Jismoniy / Aybisiz. */
const TYPE_STYLE: Record<ViolatorType, { icon: GlyphIcon; tone: string }> = {
  LEGAL: { icon: FileExclamationPoint, tone: "text-accent-amber" },
  INDIVIDUAL: { icon: Gavel, tone: "text-accent-red" },
  INNOCENT: { icon: ShieldCheck, tone: "text-[#31ae5f]" },
};

/**
 * 18px izoh, 10px pastda 45px quti: 20px ikonka + 8px + 16px bold son,
 * markazda. Quti qoidabuzarliklar ro'yxatiga (shu tur bilan) olib boradi.
 */
function Stat({ stat, className }: { stat: ViolationStat; className?: string }) {
  return (
    <Link href={stat.href} className={cn("group flex min-w-0 flex-col", className)}>
      <span className="truncate text-sm leading-[18px] text-[#999999]">{stat.label}</span>
      <span
        className={cn(
          "mt-2.5 flex h-[45px] items-center justify-center gap-2 rounded-lg bg-canvas transition-colors group-hover:bg-hairline",
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
      </span>
    </Link>
  );
}

/**
 * Bosh sahifadagi "Qoidabuzarliklar" (Figma `4126:498`, 486.67x220):
 * qoidabuzarliklar soni va shablondagi tur bo'yicha taqsimot.
 * 16 + 18 + 12 + 73 + 12 + 73 + 16 = 220.
 *
 * Bitta oy emas, yil boshidan: tanlangan oyning yilida qoidabuzarliklar
 * yuklangan barcha oylar birga sanaladi (`home-data.ts`), qamralgan oylar
 * "Umumiy aniqlangan holatlar" o'rnidagi izohda ko'rsatiladi.
 */
export function HomeViolationsCard({
  data,
  className,
}: {
  data: HomeViolations;
  className?: string;
}) {
  return (
    <Card className={className}>
      <h2 className="shrink-0 truncate text-sm leading-[18px] font-bold text-ink">
        Qoidabuzarliklar
      </h2>
      {data.uploaded ? (
        <>
          <Stat
            stat={{
              label: data.caption,
              value: data.total.value,
              href: data.total.href,
              icon: ShieldCheck,
              tone: "text-brand",
            }}
            className="mt-3 shrink-0"
          />
          <div className="mt-3 grid shrink-0 grid-cols-3 gap-2">
            {data.types.map((type) => (
              <Stat key={type.id} stat={{ ...type, ...TYPE_STYLE[type.id] }} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState variant="inline" action={false} title="Qoidabuzarliklar yuklanmagan" />
      )}
    </Card>
  );
}
