"use client";

// Qidiruv va holat filtri holat (`useState`) talab qiladi - shuning uchun
// ro'yxatning o'zi mijoz komponenti, `page.tsx` esa server bo'lib qoladi.

import { Factory, FileDown, Gauge, PlugZap, Plus, Zap, ZapOff } from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/DataTable";
import { type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import { type RegistryColumn, RegistryTable } from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { transformerCount } from "@/lib/data/relations";
import { dec, energy, num } from "@/lib/data/seed";
import {
  SUBSTATION_STATUS_LABEL,
  SUBSTATIONS,
  type SubstationStatus,
  substationTotals,
} from "@/lib/data/substations";
import { cn } from "@/lib/ui/cn";

/** Holat -> nishon rangi: faol yashil, ta'mirda sariq, nosoz qizil. */
const STATUS_TONE: Record<SubstationStatus, BadgeTone> = {
  active: "green",
  maintenance: "amber",
  fault: "red",
};

/**
 * Yuklama chizig'ining rangi: 90% dan yuqorisi kritik, 75% dan yuqorisi
 * ogohlantirish, qolgani me'yorda. Chegaralar dispetcherlik reglamentidan.
 */
function loadTone(load: number): string {
  if (load > 90) return "bg-accent-red";
  if (load > 75) return "bg-accent-amber";
  return "bg-accent-green";
}

/**
 * Jadval katagidagi yuklama chizig'i.
 *
 * `ProgressBar` bu yerda ishlatilmaydi: uning yo'lagi `bg-canvas`, qator
 * ustiga borilganda esa qatorning foni ham `bg-canvas` bo'ladi - yo'lak
 * ko'rinmay qolardi. Shu sababli yo'lak `bg-black/10` (ikkala fonda ham
 * ajralib turadi). Ayni paytda katak `<span>` ichida bo'lgani uchun element
 * ham `<span>`: `<div>` ni `<span>`/`<a>` ichiga solish HTML qoidasiga zid.
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

type StatusFilter = SubstationStatus | "all";

/**
 * Saralash va umumiy hisob-kitob modul darajasida bir marta bajariladi:
 * ma'lumot statik, har render'da qayta hisoblashning hojati yo'q.
 */
const ROWS = [...SUBSTATIONS].sort((a, b) => b.loadPercent - a.loadPercent);
const TOTALS = substationTotals();

function countOf(status: SubstationStatus): number {
  return SUBSTATIONS.filter((item) => item.status === status).length;
}

/** Filtr tugmalaridagi sonlar ham ma'lumotdan hisoblanadi (qo'lda yozilmaydi). */
const CHIPS: ReadonlyArray<FilterChip<StatusFilter>> = [
  { value: "all", label: "Barchasi", count: SUBSTATIONS.length },
  {
    value: "active",
    label: SUBSTATION_STATUS_LABEL.active,
    count: countOf("active"),
    dot: "bg-accent-green",
  },
  {
    value: "maintenance",
    label: SUBSTATION_STATUS_LABEL.maintenance,
    count: countOf("maintenance"),
    dot: "bg-accent-amber",
  },
  {
    value: "fault",
    label: SUBSTATION_STATUS_LABEL.fault,
    count: countOf("fault"),
    dot: "bg-accent-red",
  },
];

/** Eng yirik podstansiya - "Umumiy quvvat" kartasining izohi uchun. */
const LARGEST = ROWS.reduce(
  (best, item) => (item.capacityMva > best.capacityMva ? item : best),
  ROWS[0],
);

const COLUMNS: RegistryColumn[] = [
  { key: "code", label: "Kod", grow: 8, align: "left" },
  { key: "name", label: "Nomi", grow: 22, align: "left" },
  { key: "area", label: "Hudud", grow: 18, align: "left" },
  { key: "voltage", label: "Kuchlanish", grow: 12 },
  { key: "status", label: "Holat", grow: 12 },
  { key: "capacity", label: "Quvvat, MVA", grow: 10 },
  { key: "load", label: "Yuklama", grow: 12 },
  { key: "feeders", label: "Fider", grow: 8 },
  { key: "transformers", label: "TP", grow: 8 },
  { key: "consumption", label: "Iste’mol", grow: 14 },
  { key: "loss", label: "Yo’qotish", grow: 10 },
];

/**
 * Podstansiyalar ro'yxati (1476x1064 ish maydoni).
 *
 * Balandlik taqsimoti: yo'lak 56 + 8, ko'rsatkichlar 104 + 8, qolgani -
 * jadval kartasi. Sahifaning o'zi skroll bo'lmaydi, faqat jadval ichi
 * skroll qilinadi (`min-h-0 flex-1 overflow-y-auto`).
 */
export function SubstationsView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ROWS.filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (!needle) return true;
      // Qidiruv nom, kod va hudud bo'yicha - hujjatlarda shu uchtasi ishlatiladi.
      return (
        item.name.toLowerCase().includes(needle) ||
        item.code.toLowerCase().includes(needle) ||
        item.area.toLowerCase().includes(needle)
      );
    });
  }, [query, status]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Podstansiyalar"
        subtitle={`Baliqchi tumani — ${num(TOTALS.total)} ta podstansiya`}
      >
        <HeaderButton icon={FileDown} tone="muted">
          Hisobot
        </HeaderButton>
        <HeaderButton icon={Plus} tone="brand">
          Yangi podstansiya
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Jami podstansiya"
          value={num(TOTALS.total)}
          unit="ta"
          icon={Factory}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={`Faol: ${num(TOTALS.active)} ta`}
        />
        <StatCard
          label="Umumiy quvvat"
          value={dec(TOTALS.capacity)}
          unit="MVA"
          icon={Zap}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`Eng yirigi: ${LARGEST.code} — ${num(LARGEST.capacityMva)} MVA`}
        />
        <StatCard
          label="O&rsquo;rtacha yuklama"
          value={dec(TOTALS.load)}
          unit="%"
          icon={Gauge}
          accent="bg-accent-green"
          tint="bg-tint-green"
          // 85% - dispetcher me'yori: undan yuqorisi qizil izoh bilan belgilanadi.
          hint={
            TOTALS.load > 85 ? "Me’yordan yuqori yuklama" : "Me’yor doirasida"
          }
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
          hint={
            TOTALS.loss > 10
              ? "Me’yor (10%) dan yuqori"
              : "Me’yor (10%) doirasida"
          }
          hintTone={TOTALS.loss > 10 ? "bad" : "good"}
        />
      </StatRow>

      <Card className="min-h-0 flex-1">
        <div className="flex shrink-0 items-center gap-2 pb-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Nom, kod yoki hudud..."
            label="Podstansiyalar ro&rsquo;yxatidan qidirish"
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
            emptyText={"So’rovga mos podstansiya topilmadi"}
            rows={rows.map((item) => ({
              key: item.id,
              // Qator bosilganda detal sahifasi ochiladi - sahifaning asosiy amali.
              href: `/substations/${item.id}`,
              cells: [
                <span key="code" className="font-semibold">
                  {item.code}
                </span>,
                <span key="name" className="truncate font-medium">
                  {item.name}
                </span>,
                <span key="area" className="truncate text-ink-muted">
                  {item.area}
                </span>,
                item.voltage,
                <Badge key="status" tone={STATUS_TONE[item.status]}>
                  {SUBSTATION_STATUS_LABEL[item.status]}
                </Badge>,
                num(item.capacityMva),
                // Son + chiziq yonma-yon: son qat'iy kenglikda, chiziq qolgan joyda.
                <span key="load" className="flex w-full items-center gap-1.5">
                  <span className="w-8 shrink-0 text-right font-medium">
                    {dec(item.loadPercent, 0)}%
                  </span>
                  <LoadBar load={item.loadPercent} />
                </span>,
                num(item.feeders),
                num(transformerCount(item.id)),
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
