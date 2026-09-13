import { ArrowUp, HandCoins, Percent, PlugZap, Store, Users, Zap, ZapOff } from "lucide-react";
import type { ReactNode } from "react";

import { MiniBars } from "@/components/cards/KpiCard";
import { type GlyphIcon, Icon } from "@/components/ui/Icon";
import { UserGroup } from "@/components/ui/icons/UserGroup";
import { cn } from "@/lib/ui/cn";

/*
 * Bosh sahifaning 1-qatori (Figma `4126:133`, 6 x 239.33x196).
 *
 * Fider sahifasidagi `KpiCard` dan tuzilmasi farq qiladi: delta qatori pastga
 * tushgan, "Bu oy" qatori qo'shilgan, diagramma treki 39px dan 13px ga
 * qisqargan, to'rtinchi karta esa umuman diagrammasiz. Shuning uchun qobiq va
 * qatorlar alohida bo'laklarga ajratilgan, fider kartasi o'zgarishsiz qoladi.
 *
 * Qator balandliklari maketdan: sarlavha 32, qiymat 41, matn qatorlari 26,
 * diagramma 13 (yoki 39). 16 + 32 + 41 + 26*3 + 13 + 16 = 196.
 */

/**
 * 30 kunlik ustunlar (Figma `4126:150`). Maketda ustunlar 39px lik trekdan
 * ko'chirilgan va balandligi o'zgarmay qolgan, trek esa 13px ga qisqargan -
 * ortiqcha qism kesiladi. Shuning uchun ko'rinadigan ulush `min(h, 13) / 13`:
 * faqat 9px va 11px lik ikkita ustun trekdan past.
 */
const DAILY_FLOW = [
  1, 1, 1, 1, 1, 1, 1, 1, 0.692, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  0.846, 1, 1, 1,
] as const;

/** 12 oylik ustunlar, 39px trek (Figma `4126:294`). */
const MONTHLY_SUBSCRIBERS = [
  1, 1, 1, 0.744, 0.667, 1, 0.821, 0.744, 0.282, 0.667, 1, 1,
] as const;

/** 12 oylik ustunlar, 39px trek (Figma `4126:354`). */
const MONTHLY_DEBT = [
  0.282, 0.282, 0.41, 0.41, 0.179, 0.41, 1, 0.744, 0.41, 0.667, 0.41, 0.282,
] as const;

interface KpiLine {
  id: string;
  text: string;
  icon?: GlyphIcon;
  /** Rangli (delta) qator: matn rangi va `font-medium`. */
  tone?: string;
}

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
    <div className={cn("flex h-[41px] shrink-0 items-center gap-1 pt-1 pb-1.5", className)}>
      <span className={cn("font-bold text-ink", valueClassName)}>{value}</span>
      <span className="text-sm leading-[18px] font-medium text-ink-muted">{unit}</span>
    </div>
  );
}

/**
 * 26px lik matn qatorlari. Ikonkali qatorda 20px ikonka tepada, 18px matn
 * uning markazida (maketda matn 1px pastroq); ikonkasiz qatorda matn tepada.
 */
function KpiLines({ lines }: { lines: readonly KpiLine[] }) {
  return (
    <>
      {lines.map((line) => (
        <p
          key={line.id}
          className={cn(
            "flex h-[26px] shrink-0 items-start text-sm leading-[18px]",
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

function KpiBars({
  values,
  accent,
  label,
  className,
}: {
  values: readonly number[];
  accent: string;
  /** Ustunlar o'ngidagi yorliq; 13px trekdan 5px yuqoriga chiqib turadi. */
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-end gap-2", className)}>
      <MiniBars values={values} barClassName={accent} />
      {label ? (
        <span className="shrink-0 text-sm leading-[18px] text-ink-muted">{label}</span>
      ) : null}
    </div>
  );
}

const FLOW_LINES: readonly KpiLine[] = [
  { id: "month", text: "Bu oy: 19,1 ming kWh" },
  { id: "previous", text: "O’tgan oy: 198,1 ming kWh" },
  { id: "delta", text: "Bu oy: 2.1% ga oshdi", icon: ArrowUp, tone: "text-trend-up" },
];

/** Uch oqim kartasi maketda bir-birining nusxasi - farqi sarlavha va sonda. */
const FLOWS = [
  {
    id: "total",
    title: "Umumiy oqim",
    value: "220,1",
    icon: Zap,
    tint: "bg-tint-blue",
    accent: "bg-accent-blue",
  },
  {
    id: "useful",
    title: "Foydali oqim",
    value: "200,1",
    icon: PlugZap,
    tint: "bg-tint-green",
    accent: "bg-accent-green",
  },
  {
    id: "loss",
    title: "Yo’qotish",
    value: "20,1",
    icon: ZapOff,
    tint: "bg-tint-red",
    accent: "bg-accent-red",
  },
] as const;

/** "Yo'qotish darajasi" (Figma `4257:169`): markazlashgan uch qator, 4px oraliq. */
const LOSS_RATES = [
  { id: "yearly", value: "20,1%", unit: "Yillik", large: true },
  { id: "monthly", value: "18,2%", unit: "Oylik", large: false },
  { id: "daily", value: "25%", unit: "Kunlik", large: false },
] as const;

/**
 * Oltita KPI kartasi. Fragment qaytaradi - kartalar 18 ustunli gridning
 * bevosita farzandlari.
 */
export function HomeKpiRow() {
  return (
    <>
      {FLOWS.map((flow) => (
        <KpiShell
          key={flow.id}
          className="col-span-3"
          title={flow.title}
          icon={flow.icon}
          tint={flow.tint}
          accent={flow.accent}
        >
          <KpiFigure value={flow.value} unit="ming kWh yillik" />
          <KpiLines lines={FLOW_LINES} />
          <KpiBars values={DAILY_FLOW} accent={flow.accent} label="30 kun" className="h-[13px]" />
        </KpiShell>
      ))}

      <KpiShell
        className="col-span-3"
        title="Yo’qotish darajasi"
        icon={Percent}
        tint="bg-tint-indigo"
        accent="bg-accent-indigo"
      >
        <div className="flex shrink-0 flex-col gap-1 pt-1">
          {LOSS_RATES.map((rate) => (
            <KpiFigure
              key={rate.id}
              value={rate.value}
              unit={rate.unit}
              // Birinchi qator 24px, qolgan ikkitasi 16px (21px qator qutisi).
              valueClassName={
                rate.large ? "text-2xl leading-[31px]" : "text-base leading-[21px]"
              }
              className="justify-center gap-2"
            />
          ))}
        </div>
      </KpiShell>

      <KpiShell
        className="col-span-3"
        title="Abonentlar"
        icon={Users}
        tint="bg-tint-purple"
        accent="bg-accent-purple"
      >
        <KpiFigure value="2,253" unit="ta umumiy" />
        <KpiLines
          lines={[
            { id: "residents", text: "1420 ta aholi", icon: UserGroup },
            { id: "legal", text: "737 ta yuridik", icon: Store },
          ]}
        />
        <KpiBars values={MONTHLY_SUBSCRIBERS} accent="bg-accent-purple" className="h-[39px]" />
      </KpiShell>

      <KpiShell
        className="col-span-3"
        title="Debitor qarzdorlik"
        icon={HandCoins}
        tint="bg-tint-brown"
        accent="bg-accent-brown"
      >
        <KpiFigure value="5,6" unit="mlrd so’m" />
        <KpiLines
          lines={[
            { id: "residents", text: "4,5 mlrd aholi", icon: UserGroup },
            { id: "legal", text: "1,1 mlrd yuridik", icon: Store },
          ]}
        />
        <KpiBars values={MONTHLY_DEBT} accent="bg-accent-brown" className="h-[39px]" />
      </KpiShell>
    </>
  );
}
