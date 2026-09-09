import { Activity, ChartColumn, FileDown, WifiOff, Zap } from "lucide-react";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { IconPill } from "@/components/ui/IconPill";
import { cn } from "@/lib/ui/cn";

interface QuickIndicator {
  id: string;
  icon: GlyphIcon;
  /** 30px plitka foni - `@theme` dagi aksent tokeni. */
  tile: string;
  caption: string;
  value: string;
  /** Qiymat yonidagi o'lchov birligi yoki qisqa kontekst. */
  suffix: string;
}

const METRICS: readonly QuickIndicator[] = [
  {
    id: "network-load",
    icon: Zap,
    tile: "bg-accent-blue",
    caption: "Tarmoq yuklamasi",
    value: "1 409",
    suffix: "kW",
  },
  {
    id: "avg-voltage",
    icon: Activity,
    tile: "bg-accent-teal",
    caption: "Kuchlanish (o\u2019rtacha)",
    value: "10.6",
    suffix: "kV",
  },
  {
    id: "peak-tp",
    icon: ChartColumn,
    tile: "bg-accent-indigo",
    caption: "Eng yuklangan TP",
    value: "169",
    suffix: "kW \u00b7 TP-066",
  },
  {
    id: "offline",
    icon: WifiOff,
    tile: "bg-accent-amber",
    caption: "Aloqada emas",
    value: "124",
    suffix: "ta \u00b7 3.5%",
  },
];

/**
 * Bosh sahifa, 3-qator (363x246): tarmoqning to'rtta joriy ko'rsatkichi.
 *
 * Karta tanasi 2x2 grid - katak balandligi qat'iy emas, `grid-rows-2` bilan
 * qolgan joyni teng bo'lishadi, shuning uchun karta cho'zilganda ham kontent
 * toshib ketmaydi. Har bir katak ichidagi matn `justify-center` orqali
 * vertikal markazlashadi.
 *
 * `min-w-0` + `truncate` juftligi zarur: "kW · TP-066" kabi uzun qo'shimcha
 * grid kataklarining kengligini cho'zib yuborishi mumkin edi.
 */
export function QuickIndicatorsCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title="Tezkor ko&rsquo;rsatkichlar">
        <IconPill icon={FileDown} label="Yuklab olish" />
      </CardHeader>

      <CardBody>
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-2">
          {METRICS.map((metric) => (
            <div
              key={metric.id}
              className="flex min-w-0 flex-col justify-center gap-1.5 rounded-lg bg-canvas p-3"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-[30px] shrink-0 items-center justify-center rounded-md text-white",
                    metric.tile,
                  )}
                >
                  <Icon icon={metric.icon} size={16} />
                </span>
                <span className="truncate text-[10px] text-ink-soft">
                  {metric.caption}
                </span>
              </div>

              {/* Qiymat va birlik bir asos chizig'ida - katta son 18px bo'lsa ham
                  10px qo'shimcha bilan "o'tirib" turadi.

                  Qiymat `shrink-0`: tor ekranda faqat qo'shimcha ("kW · TP-066")
                  qisqaradi, son hech qachon "1 4..." holiga tushmaydi. */}
              <div className="flex min-w-0 items-baseline gap-1">
                <span className="shrink-0 text-lg leading-none font-bold text-ink">
                  {metric.value}
                </span>
                <span className="truncate text-[10px] font-medium text-ink-soft">
                  {metric.suffix}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
