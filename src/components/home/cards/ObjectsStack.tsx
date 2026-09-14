import { CircuitBoard, Factory, Users, UtilityPole } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/Card";
import type { GlyphIcon } from "@/components/ui/Icon";
import type { HomeObjectTile, HomeRepairs } from "@/lib/queries/home-data";
import { cn } from "@/lib/ui/cn";

import { SummaryTile } from "./SummaryTile";

const TILE_STYLE: Record<
  HomeObjectTile["id"],
  { icon: GlyphIcon; tint: string; accent: string; glow: string }
> = {
  substations: {
    icon: Factory,
    tint: "bg-tint-blue",
    accent: "text-accent-blue",
    glow: "bg-accent-blue",
  },
  subscribers: {
    icon: Users,
    tint: "bg-tint-purple",
    accent: "text-accent-purple",
    glow: "bg-accent-purple",
  },
  feeders: {
    icon: UtilityPole,
    tint: "bg-tint-green",
    accent: "text-accent-green",
    glow: "bg-accent-green",
  },
  transformers: {
    icon: CircuitBoard,
    tint: "bg-tint-indigo",
    accent: "text-accent-indigo",
    glow: "bg-accent-indigo",
  },
};

/**
 * "Ta'mir ishlari" (Figma `4289:353` o'rnida, 321.78x138): TP holatidagi
 * ta'mir sanalari - hisobot sanasigacha "Bajarilgan", keyin
 * "Rejalashtirilgan". Har bir quti ishlar ro'yxatiga (`/works`) olib boradi.
 *
 * Ikki teng ustun (140.89px, oraliq 8px): izoh 46px, ostida 29px quti.
 */
function RepairsCard({ repairs }: { repairs: HomeRepairs }) {
  const boxes = [
    { id: "done", label: "Bajarilgan ta’mir", tone: "text-[#31ae5f]", ...repairs.done },
    { id: "planned", label: "Rejalashtirilgan ta’mir", tone: "text-accent-amber", ...repairs.planned },
  ];

  return (
    <Card>
      <h2 className="shrink-0 truncate text-sm leading-[18px] font-bold text-ink">
        Ta&rsquo;mir ishlari
      </h2>
      {repairs.uploaded ? (
        <div className="mt-2 grid shrink-0 grid-cols-2 gap-2">
          {boxes.map((box) => (
            <Link key={box.id} href={box.href} className="group flex min-w-0 flex-col">
              {/* Uzun izoh ikki qatorga o'raladi (36px) - quti joyida qoladi. */}
              <span className="h-[46px] text-sm leading-[18px] text-[#999999]">{box.label}</span>
              <span
                className={cn(
                  "flex h-[29px] items-center justify-center rounded-lg bg-canvas text-base leading-[21px] font-bold transition-colors group-hover:bg-hairline",
                  box.tone,
                )}
              >
                {box.value}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="flex min-h-0 flex-1 items-center justify-center text-center text-sm text-ink-muted">
          Transformatorlar yuklanmagan
        </p>
      )}
    </Card>
  );
}

/**
 * 2-qatorning chap ustuni (Figma `4179:2`, "KPI cards 2", 321.78x402):
 * uchta 80px ob'ekt kartasi va 138px "Ta'mir ishlari", oraliq 8px.
 * 80 + 8 + 80 + 8 + 80 + 8 + 138 = 402.
 */
export function ObjectsStack({
  tiles,
  repairs,
  className,
}: {
  tiles: readonly HomeObjectTile[];
  repairs: HomeRepairs;
  className?: string;
}) {
  return (
    <div className={cn("grid min-h-0 grid-rows-[80px_80px_80px_minmax(0,1fr)] gap-2", className)}>
      {tiles.map((tile) => (
        <SummaryTile
          key={tile.id}
          actionLabel="Ochish"
          value={tile.value}
          label={tile.label}
          href={tile.href}
          {...TILE_STYLE[tile.id]}
        />
      ))}
      <RepairsCard repairs={repairs} />
    </div>
  );
}
