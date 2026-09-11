import {
  ArrowBigDownDash,
  ClockArrowUp,
  FileDown,
  SquareCheckBig,
  WrenchOff,
  Zap,
} from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { IconPill } from "@/components/ui/IconPill";
import { cn } from "@/lib/ui/cn";

interface QuickMetric {
  id: string;
  icon: GlyphIcon;
  /**
   * 44px plitka foni. Faqat birinchisi (`#3b82f6`) tokenlarda bor, qolgan
   * to'rttasi maketdan piksel bo'yicha olingan va tokenlarga kirmagan.
   */
  tile: string;
  caption: string;
  value: string;
}

const METRICS: readonly QuickMetric[] = [
  {
    id: "avg-usage",
    icon: Zap,
    tile: "bg-accent-blue",
    caption: "Kunlik o\u2019rtacha iste\u2019mol",
    value: "15,2 ming kWh",
  },
  {
    id: "avg-loss",
    icon: ArrowBigDownDash,
    tile: "bg-[#ff928a]",
    caption: "Kunlik o\u2019rtacha yo\u2019qotish",
    value: "3,3 ming kWh",
  },
  {
    id: "faulty-tp",
    // Maketdagi imlo ("Nofal") ataylab saqlangan.
    icon: WrenchOff,
    tile: "bg-[#ffae4c]",
    caption: "Nofal transformatorlar",
    value: "1 ta",
  },
  {
    id: "peak-hours",
    icon: ClockArrowUp,
    tile: "bg-[#8979ff]",
    // Maketda aynan shu qatorda to'g'ri apostrof (U+0027) ishlatilgan.
    caption: "Pik iste'mol vaqti",
    value: "19:30 - 21:00",
  },
  {
    id: "plan",
    icon: SquareCheckBig,
    tile: "bg-[#2bb7dc]",
    caption: "Reja bajarilishi",
    value: "89,1%",
  },
];

/**
 * Fider sahifasi, 3-qator (Figma `4060:1304`, 322x336).
 *
 * Kontent 264px: 5 ta 44px qator, oralig'i 10px (jami 260px) - maketdagidek
 * yuqoriga tekislangan, pastda 4px bo'shliq qoladi.
 *
 * Matn uslubi bu kartada tokenlardan chetga chiqadi (maketdan piksel bo'yicha
 * o'lchangan): izoh 14px Medium `#999999` (`ink-soft` #767676 emas), qiymat
 * 16px Bold `#000000` (`ink` #333333 emas).
 */
export function QuickMetricsCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Tezkor ko&rsquo;rsatgichlar" titleClassName="text-black">
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody className="gap-[10px]">
        {METRICS.map((metric) => (
          <div key={metric.id} className="flex h-11 shrink-0 items-center gap-2">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-md text-white",
                metric.tile,
              )}
            >
              <Icon icon={metric.icon} size={24} />
            </span>
            {/* Matn bloki 43px: 18 + 4 + 21, plitka ichida markazlashadi. */}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="truncate text-sm leading-[18px] font-medium text-[#999999]">
                {metric.caption}
              </span>
              <span className="truncate text-base leading-[21px] font-bold text-black">
                {metric.value}
              </span>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
