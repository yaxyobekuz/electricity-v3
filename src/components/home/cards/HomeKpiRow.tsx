import { ArrowDown, ArrowUp, HandCoins, Minus, Percent, PlugZap, Store, Users, Zap, ZapOff } from "lucide-react";
import type { ReactNode } from "react";

import { MiniBars } from "@/components/cards/KpiCard";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { UserGroup } from "@/components/ui/icons/UserGroup";
import type {
  HomeCountKpi,
  HomeFlowKpi,
  HomeKpiLine,
  HomeKpis,
  HomeTone,
  HomeTrend,
} from "@/lib/queries/home-data";
import { cn } from "@/lib/ui/cn";

/*
 * Bosh sahifaning 1-qatori (Figma `4126:133`, 6 x 239.33x196).
 *
 * Fider sahifasidagi `KpiCard` dan tuzilmasi farq qiladi: delta qatori pastda,
 * to'rtinchi karta esa diagrammasiz. Shuning uchun qobiq va qatorlar alohida
 * bo'laklarga ajratilgan, fider kartasi o'zgarishsiz qoladi.
 *
 * Qator balandliklari maketdan: sarlavha 32, qiymat 41, matn qatorlari 26,
 * diagramma 39. 16 + 32 + 41 + 26*2 + 39 + 16 = 196.
 *
 * Barcha qiymatlar `loadHomeData` dan tayyor matn sifatida keladi.
 */

interface KpiLine {
  id: string;
  text: string;
  icon?: GlyphIcon;
  /** Rangli (delta) qator: matn rangi va `font-medium`. */
  tone?: string;
}

/** `KpiCard` dagi bilan bir xil: yo'qotish o'sishi - qizil, kamayishi - yashil. */
const TONE_TEXT: Record<HomeTone, string> = {
  bad: "text-trend-up",
  good: "text-trend-down",
  neutral: "text-ink-muted",
};

const TREND_ICON: Record<HomeTrend["direction"], GlyphIcon> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
};

function KpiShell({
  title,
  icon,
  tint,
  accent,
  className,
  children,
}: {
  title: string;
  icon: GlyphIcon;
  /** Karta foni, masalan `bg-tint-blue`. */
  tint: string;
  /** Nishon va ustunlar rangi, masalan `bg-accent-blue`. */
  accent: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden rounded-xl p-4",
        tint,
        className,
      )}
    >
      <header className="flex h-8 shrink-0 items-start justify-between gap-2">
        <h2 className="truncate text-sm leading-[18px] font-medium text-ink">{title}</h2>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-md text-white",
            accent,
          )}
        >
          <Icon icon={icon} size={20} />
        </span>
      </header>
      {children}
    </section>
  );
}

/** 41px qator: 24px son + 14px birlik, qutisi 4px pastga surilgan. */
function KpiFigure({
  value,
  unit,
  valueClassName = "text-2xl leading-[31px]",
  className,
}: {
  value: string;
  unit: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex h-[41px] min-w-0 shrink-0 items-center gap-1 pt-1 pb-1.5", className)}>
      <span className={cn("shrink-0 font-bold text-ink", valueClassName)}>{value}</span>
      <span className="min-w-0 truncate text-sm leading-[18px] font-medium text-ink-muted">
        {unit}
      </span>
    </div>
  );
}

/**
 * 26px lik matn qatorlari. Ikonkali qatorda 20px ikonka tepada, 18px matn
 * uning markazida; ikonkasiz qatorda matn tepada.
 */
function KpiLines({ lines }: { lines: readonly KpiLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <p
          key={line.id}
          className={cn(
            "flex h-[26px] min-w-0 shrink-0 items-start text-sm leading-[18px]",
            line.tone ? cn("font-medium", line.tone) : "text-ink-muted",
          )}
        >
          {line.icon ? (
            <span className="flex h-5 min-w-0 items-center gap-1">
              <Icon icon={line.icon} size={20} className="shrink-0" />
              <span className="truncate">{line.text}</span>
            </span>
          ) : (
            <span className="truncate">{line.text}</span>
          )}
        </p>
      ))}
    </>
  );
}

/** Oylik ustunlar (39px trek) va o'ngda "<n> oy" yorlig'i - kartaning pastida. */
function KpiBars({ values, accent, label }: { values: readonly number[]; accent: string; label: string }) {
  return (
    <div className="mt-auto flex h-[39px] shrink-0 items-end gap-2">
      <MiniBars values={values} barClassName={accent} />
      <span className="shrink-0 text-sm leading-[18px] text-ink-muted">{label}</span>
    </div>
  );
}

const FLOW_STYLE: Record<HomeFlowKpi["id"], { icon: GlyphIcon; tint: string; accent: string }> = {
  total: { icon: Zap, tint: "bg-tint-blue", accent: "bg-accent-blue" },
  useful: { icon: PlugZap, tint: "bg-tint-green", accent: "bg-accent-green" },
  loss: { icon: ZapOff, tint: "bg-tint-red", accent: "bg-accent-red" },
};

function flowLines(flow: HomeFlowKpi): KpiLine[] {
  const lines: KpiLine[] = [];
  if (flow.note) lines.push({ id: "note", text: flow.note });
  if (flow.previous) lines.push({ id: "previous", text: flow.previous });
  if (flow.trend) {
    lines.push({
      id: "trend",
      text: flow.trend.text,
      icon: TREND_ICON[flow.trend.direction],
      tone: TONE_TEXT[flow.trend.tone],
    });
  }
  return lines;
}

/** Abonent turi bo'yicha qatorlar: aholi - odamlar guruhi, yuridik - do'kon. */
function kindLines(lines: readonly HomeKpiLine[]): KpiLine[] {
  return lines.map((line) => ({
    id: line.id,
    text: line.text,
    icon: line.kind === "HOUSEHOLD" ? UserGroup : line.kind === "LEGAL" ? Store : undefined,
  }));
}

function CountCard({
  title,
  icon,
  tint,
  accent,
  kpi,
}: {
  title: string;
  icon: GlyphIcon;
  tint: string;
  accent: string;
  kpi: HomeCountKpi;
}) {
  return (
    <KpiShell className="col-span-3" title={title} icon={icon} tint={tint} accent={accent}>
      <KpiFigure value={kpi.value} unit={kpi.unit} />
      <KpiLines lines={kindLines(kpi.lines)} />
      <KpiBars values={kpi.bars} accent={accent} label={kpi.barsLabel} />
    </KpiShell>
  );
}

/**
 * Oltita KPI kartasi. Fragment qaytaradi - kartalar 18 ustunli gridning
 * bevosita farzandlari.
 */
export function HomeKpiRow({ kpis }: { kpis: HomeKpis }) {
  return (
    <>
      {kpis.flows.map((flow) => {
        const style = FLOW_STYLE[flow.id];
        return (
          <KpiShell
            key={flow.id}
            className="col-span-3"
            title={flow.title}
            icon={style.icon}
            tint={style.tint}
            accent={style.accent}
          >
            <KpiFigure value={flow.value} unit={flow.unit} />
            <KpiLines lines={flowLines(flow)} />
            <KpiBars values={flow.bars} accent={style.accent} label={flow.barsLabel} />
          </KpiShell>
        );
      })}

      {/* "Yo'qotish darajasi" (Figma `4257:169`): markazlashgan qatorlar, 4px oraliq. */}
      <KpiShell
        className="col-span-3"
        title="Yo’qotish darajasi"
        icon={Percent}
        tint="bg-tint-indigo"
        accent="bg-accent-indigo"
      >
        <div className="flex shrink-0 flex-col gap-1 pt-1">
          {kpis.lossRates.map((rate) => (
            <KpiFigure
              key={rate.id}
              value={rate.value}
              unit={rate.unit}
              // Birinchi qator 24px, qolganlari 16px (21px qator qutisi).
              valueClassName={rate.large ? "text-2xl leading-[31px]" : "text-base leading-[21px]"}
              className="justify-center gap-2"
            />
          ))}
        </div>
      </KpiShell>

      <CountCard
        title="Abonentlar"
        icon={Users}
        tint="bg-tint-purple"
        accent="bg-accent-purple"
        kpi={kpis.subscribers}
      />

      <CountCard
        title="Debitor qarzdorlik"
        icon={HandCoins}
        tint="bg-tint-brown"
        accent="bg-accent-brown"
        kpi={kpis.debt}
      />
    </>
  );
}
