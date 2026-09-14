import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

export interface QuickMetric {
  id: string;
  icon: GlyphIcon;
  /**
   * 44px plitka foni. Faqat birinchisi (`#3b82f6`) tokenlarda bor, qolganlari
   * maketdan piksel bo'yicha olingan: `bg-[#ff928a]`, `bg-[#ffae4c]`,
   * `bg-[#8979ff]`, `bg-[#2bb7dc]`.
   */
  tile: string;
  caption: string;
  /** Tayyor matn (`format.ts`). */
  value: string;
}

/** Maketdagi geometriya 5 qatorga mo'ljallangan; undan ko'pida qatorlar zichlashadi. */
const DESIGN_ROWS = 5;

/**
 * "Tezkor ko'rsatkichlar" (Figma `4060:1304`, 322x336).
 *
 * Kontent 264px: 5 ta 44px qator, oralig'i 10px (jami 260px) - maketdagidek
 * yuqoriga tekislangan. 6 ta ko'rsatkichda qatorlar 36px ga tushadi
 * (6 x 36 + 5 x 8 = 256), aks holda oxirgisi kesiladi.
 *
 * Matn uslubi bu kartada tokenlardan chetga chiqadi (maketdan piksel bo'yicha
 * o'lchangan): izoh 14px Medium `#999999`, qiymat 16px Bold `#000000`.
 *
 * Ko'rsatkichlar sahifadan keladi - faqat shablondan hisoblangan qiymatlar.
 */
export function QuickMetricsCard({
  metrics,
  title = "Tezkor ko’rsatgichlar",
  emptyText = "Ko’rsatkichlar yo’q",
  className,
}: {
  /** 1..6 ta ko'rsatkich. */
  metrics: readonly QuickMetric[];
  title?: string;
  emptyText?: string;
  className?: string;
}) {
  const dense = metrics.length > DESIGN_ROWS;

  return (
    <Card className={className}>
      <CardHeader title={title} titleClassName="text-black" />

      <CardBody className={dense ? "gap-2" : "gap-[10px]"}>
        {metrics.length === 0 ? (
          <EmptyState variant="inline" action={false} title={emptyText} />
        ) : (
          metrics.map((metric) => (
            <div
              key={metric.id}
              className={cn("flex shrink-0 items-center gap-2", dense ? "h-9" : "h-11")}
            >
              <span
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-md text-white",
                  dense ? "size-9" : "size-11",
                  metric.tile,
                )}
              >
                <Icon icon={metric.icon} size={dense ? 20 : 24} />
              </span>
              {/* Matn bloki 43px: 18 + 4 + 21 (zich variantda 16 + 2 + 18). */}
              <div className={cn("flex min-w-0 flex-col", dense ? "gap-0.5" : "gap-1")}>
                <span
                  className={cn(
                    "truncate font-medium text-[#999999]",
                    dense ? "text-xs leading-4" : "text-sm leading-[18px]",
                  )}
                >
                  {metric.caption}
                </span>
                <span
                  className={cn(
                    "truncate font-bold text-black",
                    dense ? "text-sm leading-[18px]" : "text-base leading-[21px]",
                  )}
                >
                  {metric.value}
                </span>
              </div>
            </div>
          ))
        )}
      </CardBody>
    </Card>
  );
}
