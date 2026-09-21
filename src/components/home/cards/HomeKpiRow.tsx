import { ArrowDown, ArrowUp, HandCoins, Minus, Percent, PlugZap, Store, Users, Zap, ZapOff } from "lucide-react";
import type { ReactNode } from "react";

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
 * Kartalar qobig'i va qatorlari alohida bo'laklarga ajratilgan: delta qatori
 * pastda, to'rtinchi karta ("Yo'qotish darajasi") esa diagrammasiz.
 *
 * Qator balandliklari maketdan: sarlavha 32, qiymat 41, matn qatorlari 26,
 * diagramma 39. 16 + 32 + 41 + 26*2 + 39 + 16 = 196.
 *
 * Oqim kartalarida uchta matn qatori bor ("Bu oy", "O'tgan oy", o'zgarish),
 * shuning uchun diagramma qat'iy emas - qolgan joyni egallaydi (24..39px).
 *
 * Barcha qiymatlar `loadHomeData` dan tayyor matn sifatida keladi. Bo'laklar
 * (`KpiShell`, `KpiFigure`, `KpiLines`, `KpiBars`) abonent sahifasining KPI
 * qatorida ham ishlatiladi - dizayn bir xil qolsin.
 */

export interface KpiLine {
  id: string;
  text: string;
  icon?: GlyphIcon;
  /** Rangli (delta) qator: matn rangi va `font-medium`. */
  tone?: string;
}

/** Yo'qotish va qarz o'sishi - qizil, kamayishi - yashil (`HomeTone`). */
export const TONE_TEXT: Record<HomeTone, string> = {
  bad: "text-trend-up",
  good: "text-trend-down",
  neutral: "text-ink-muted",
};

export const TREND_ICON: Record<HomeTrend["direction"], GlyphIcon> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
};

export function KpiShell({
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
export function KpiFigure({
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
export function KpiLines({ lines }: { lines: readonly KpiLine[] }) {
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

/** 0..1 oralig'iga siqadi; NaN - 0. */
function toFraction(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/**
 * Mayda ustunli diagramma. Ustunlar soni har xil (1..12 oy), shuning uchun
 * ustunlar grid orqali teng bo'linadi va balandlik foizda beriladi - trek
 * balandligi ota katakdan keladi.
 */
function MiniBars({ values, barClassName }: { values: readonly number[]; barClassName: string }) {
  if (values.length === 0) return null;

  return (
    <div
      className="grid h-full min-w-0 flex-1 items-end gap-x-[2px]"
      style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}
    >
      {values.map((fraction, index) => (
        <div
          key={index}
          className={cn("w-full self-end rounded-[1px]", barClassName)}
          style={{ height: `${toFraction(fraction) * 100}%` }}
        />
      ))}
    </div>
  );
}

/** Oylik ustunlar (39px trek) va o'ngda "<n> oy" yorlig'i - kartaning pastida. */
export function KpiBars({ values, accent, label }: { values: readonly number[]; accent: string; label: string }) {
  return (
    <div className="mt-auto flex max-h-[39px] min-h-6 flex-1 items-end gap-2">
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
  lines.push({ id: "currentMonth", text: flow.currentMonth });
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
        tint="bg-tint-rose"
        accent="bg-accent-rose"
      >
        {/*
          * Maketda har bir daraja - to'q qizil tabletka: oq qalin son va
          * yarim shaffof oq davr nomi ("Bu oy", "O'tgan oy", "Yillik
          * o'rtacha"), markazda. Yorliqqa qavsli izoh yoki oy nomi
          * qo'shilmaydi - maketdagidek qat'iy.
          */}
        <div className="flex shrink-0 flex-col gap-1 pt-1">
          {kpis.lossRates.map((rate) => (
            <span
              key={rate.id}
              className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-accent-rose px-3 py-1.5"
            >
              <span
                className={cn(
                  "min-w-0 truncate font-bold text-white",
                  rate.large ? "text-2xl leading-[31px]" : "text-base leading-[21px]",
                )}
              >
                {rate.value}
              </span>
              <span className="shrink-0 text-sm leading-[18px] font-medium text-white/70">
                {rate.unit}
              </span>
            </span>
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
