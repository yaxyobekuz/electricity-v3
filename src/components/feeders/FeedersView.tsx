"use client";

// Qidiruv va holat filtri holat (`useState`) talab qiladi - shuning uchun
// ro'yxatning o'zi mijoz komponenti, `page.tsx` esa server bo'lib qoladi.

import { Cable, FileDown, Gauge, PlugZap, Plus, Workflow, ZapOff } from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/DataTable";
import { type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { type RegistryColumn, RegistryTable } from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import {
  FEEDER_STATUS_LABEL,
  FEEDERS,
  type FeederStatus,
  feederTotals,
} from "@/lib/data/feeders";
import { feederTransformerCount } from "@/lib/data/relations";
import { dec, energy, num } from "@/lib/data/seed";
import { cn } from "@/lib/ui/cn";

/** Holat -> nishon rangi: faol yashil, ta'mirda sariq, o'chirilgan qizil. */
const STATUS_TONE: Record<FeederStatus, BadgeTone> = {
  active: "green",
  maintenance: "amber",
  offline: "red",
};

/** Yuklama chizig'ining rangi - podstansiyalar ro'yxatidagi chegaralar bilan bir xil. */
function loadTone(load: number): string {
  if (load > 90) return "bg-accent-red";
  if (load > 75) return "bg-accent-amber";
  return "bg-accent-green";
}

/**
 * Jadval katagidagi yuklama chizig'i. Yo'lak `bg-black/10` - qatorning
 * hover foni (`bg-canvas`) ustida ham ko'rinadi; katak `<span>` ichida
 * bo'lgani uchun element ham `<span>` (`SubstationsView` dagi bilan bir xil).
 */
function LoadBar({ load }: { load: number }) {
  return (
    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/10">
      <span
        className={cn("block h-full rounded-full", loadTone(load))}
        style={{ width: `${Math.max(0, Math.min(100, load))}%` }}
      />
    </span>
  );
}

type StatusFilter = FeederStatus | "all";

/** Saralash va umumiy hisob modul darajasida bir marta - ma'lumot statik. */
const ROWS = [...FEEDERS].sort((a, b) => b.loadPercent - a.loadPercent);
const TOTALS = feederTotals();

const CHIPS: ReadonlyArray<FilterChip<StatusFilter>> = [
  { value: "all", label: "Barchasi", count: TOTALS.total },
  {
    value: "active",
    label: FEEDER_STATUS_LABEL.active,
    count: TOTALS.active,
    dot: "bg-accent-green",
  },
  {
    value: "maintenance",
    label: FEEDER_STATUS_LABEL.maintenance,
    count: TOTALS.maintenance,
    dot: "bg-accent-amber",
  },
  {
    value: "offline",
    label: FEEDER_STATUS_LABEL.offline,
    count: TOTALS.offline,
    dot: "bg-accent-red",
  },
];

/** Eng uzun liniya - "Liniyalar uzunligi" kartasining izohi uchun. */
const LONGEST = ROWS.reduce((best, item) => (item.lengthKm > best.lengthKm ? item : best), ROWS[0]);

const COLUMNS: RegistryColumn[] = [
  { key: "code", label: "Kod", grow: 7, align: "left" },
  { key: "name", label: "Nomi", grow: 18, align: "left" },
  { key: "substation", label: "Podstansiya", grow: 18, align: "left" },
  { key: "voltage", label: "Kuchlanish", grow: 10 },
  { key: "status", label: "Holat", grow: 12 },
  { key: "length", label: "Uzunlik, km", grow: 10 },
  { key: "load", label: "Yuklama", grow: 12 },
  { key: "transformers", label: "TP", grow: 7 },
  { key: "consumption", label: "Iste’mol", grow: 14 },
  { key: "loss", label: "Yo’qotish", grow: 10 },
];

/**
 * Fiderlar ro'yxati (1476x1064 ish maydoni).
 *
 * Tuzilma podstansiyalar ro'yxati bilan bir xil: yo'lak 56, ko'rsatkichlar
 * 104, qolgani - jadval kartasi (faqat jadval ichi skroll qilinadi).
 * Qator bosilganda `/feeders/[id]` detal sahifasi ochiladi.
 */
export function FeedersView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ROWS.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!needle) return true;
      return (
        item.name.toLowerCase().includes(needle) ||
        item.code.toLowerCase().includes(needle) ||
        item.substationName.toLowerCase().includes(needle)
      );
    });
  }, [query, status]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Fiderlar"
        subtitle={`Baliqchi tumani — ${num(TOTALS.total)} ta fider`}
      >
        <HeaderButton icon={FileDown} tone="muted">
          Hisobot
        </HeaderButton>
        <HeaderButton icon={Plus} tone="brand">
          Yangi fider
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Jami fider"
          value={num(TOTALS.total)}
          unit="ta"
          icon={Workflow}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={`Faol: ${num(TOTALS.active)} ta`}
        />
        <StatCard
          label="Liniyalar uzunligi"
          value={dec(TOTALS.length)}
          unit="km"
          icon={Cable}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`Eng uzuni: ${LONGEST.name} — ${dec(LONGEST.lengthKm)} km`}
        />
        <StatCard
          label="O&rsquo;rtacha yuklama"
          value={dec(TOTALS.load)}
          unit="%"
          icon={Gauge}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint={TOTALS.load > 85 ? "Me’yordan yuqori yuklama" : "Me’yor doirasida"}
          hintTone={TOTALS.load > 85 ? "bad" : "good"}
        />
        <StatCard
          label="Oylik iste&rsquo;mol"
          value={energy(TOTALS.consumption)}
          icon={PlugZap}
          accent="bg-accent-teal"
          tint="bg-tint-teal"
          hint={`Bittasiga o’rtacha: ${energy(TOTALS.consumption / TOTALS.total)}`}
        />
        <StatCard
          label="O&rsquo;rtacha yo&rsquo;qotish"
          value={dec(TOTALS.loss)}
          unit="%"
          icon={ZapOff}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint={TOTALS.loss > 10 ? "Me’yor (10%) dan yuqori" : "Me’yor (10%) doirasida"}
          hintTone={TOTALS.loss > 10 ? "bad" : "good"}
        />
      </StatRow>

      <Card className="min-h-0 flex-1">
        <div className="flex shrink-0 items-center gap-2 pb-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Nom, kod yoki podstansiya..."
            label="Fiderlar ro&rsquo;yxatidan qidirish"
            className="w-[240px]"
          />
          <FilterChips items={CHIPS} value={status} onChange={setStatus} />
          <span className="ml-auto shrink-0 text-[11px] text-ink-soft">
            {num(rows.length)} ta yozuv
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <RegistryTable
            columns={COLUMNS}
            emptyText={"So’rovga mos fider topilmadi"}
            rows={rows.map((item) => ({
              key: item.id,
              href: `/feeders/${item.id}`,
              cells: [
                <span key="code" className="font-semibold">
                  {item.code}
                </span>,
                <span key="name" className="truncate font-medium">
                  {item.name}
                </span>,
                <span key="substation" className="truncate text-ink-muted">
                  {item.substationName}
                </span>,
                item.voltage,
                <Badge key="status" tone={STATUS_TONE[item.status]}>
                  {FEEDER_STATUS_LABEL[item.status]}
                </Badge>,
                dec(item.lengthKm),
                <span key="load" className="flex w-full items-center gap-1.5">
                  <span className="w-8 shrink-0 text-right font-medium">
                    {dec(item.loadPercent, 0)}%
                  </span>
                  <LoadBar load={item.loadPercent} />
                </span>,
                num(feederTransformerCount(item.substationId, item.code)),
                energy(item.consumptionKwh),
                <span
                  key="loss"
                  className={item.lossPercent > 12 ? "font-medium text-trend-up" : undefined}
                >
                  {dec(item.lossPercent)}%
                </span>,
              ],
            }))}
          />
        </div>
      </Card>
    </div>
  );
}
