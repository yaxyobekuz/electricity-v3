import { Building2, ShieldCheck, UserRound } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import type { ViolatorType } from "@/generated/prisma";
import { VIOLATOR_TYPE_LABEL, VIOLATOR_TYPE_ORDER } from "@/lib/domain/labels";
import { count, money } from "@/lib/format";
import { cn } from "@/lib/ui/cn";

/** Qoidabuzar turi bo'yicha sonlar (`Violation.violatorType`). */
export type ViolationCounts = Record<ViolatorType, number>;

/**
 * Har bir tur uchun ikonka va ohang. Maketda ikonka va son bir xil tusda;
 * ikkitasiga token yo'q - aniq hex.
 */
const STYLE: Record<ViolatorType, { icon: GlyphIcon; tone: string; iconClassName?: string }> = {
  LEGAL: { icon: Building2, tone: "text-[#f59e0b]" },
  INDIVIDUAL: { icon: UserRound, tone: "text-accent-red" },
  // Maketda faqat qalqon ikonkasi 1.5px emas, 2px chiziqda chizilgan.
  INNOCENT: { icon: ShieldCheck, tone: "text-[#31ae5f]", iconClassName: "[stroke-width:2]" },
};

/**
 * "Qoidabuzarliklar" kartasi (Figma `4029:1344`, 487x148).
 *
 * Uch teng ustun (146.22px, oraliq 8px): 14px izoh, undan 10px pastda
 * 48px balandlikdagi #f3f3f3 quti - 24px ikonka va 16px bold son.
 * Sonlar shablondagi "Turi (Yuridik/Jismoniy/Aybisiz)" ustunidan.
 *
 * `uploaded={false}` - shu oyga Qoidabuzarliklar fayli yuklanmagan ("0 ta"
 * bilan adashtirilmasin). `damageUzs` berilsa sarlavha o'ngida keltirilgan
 * zarar yig'indisi ko'rsatiladi.
 */
export function ViolationsCard({
  counts,
  damageUzs,
  uploaded,
  className,
}: {
  counts: ViolationCounts;
  /** Σ "Keltirilgan zarar miqdori (UZS)". */
  damageUzs?: number | null;
  uploaded: boolean;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader title="Qoidabuzarliklar">
        {uploaded && damageUzs != null ? (
          <span className="truncate text-xs leading-4 text-[#999999]">
            Zarar: <span className="font-semibold text-ink">{money(damageUzs)}</span>
          </span>
        ) : null}
      </CardHeader>
      <CardBody>
        {uploaded ? (
          <div className="grid min-h-0 grid-cols-3 gap-2">
            {VIOLATOR_TYPE_ORDER.map((type) => {
              const style = STYLE[type];
              return (
                <div key={type} className="flex min-w-0 flex-col">
                  <span className="truncate text-sm leading-[18px] text-[#999999]">
                    {VIOLATOR_TYPE_LABEL[type]}
                  </span>
                  {/* Quti ichidagi rang ikonkaga ham, songa ham `currentColor` orqali o'tadi */}
                  <div
                    className={cn(
                      "mt-2.5 flex h-12 items-center gap-3 rounded-lg bg-canvas pl-5",
                      style.tone,
                    )}
                  >
                    <Icon
                      icon={style.icon}
                      size={24}
                      className={cn("shrink-0", style.iconClassName)}
                    />
                    <span className="truncate text-base leading-[21px] font-bold">
                      {count(counts[type] ?? 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState variant="inline" action={false} title="Qoidabuzarliklar yuklanmagan" />
        )}
      </CardBody>
    </Card>
  );
}
