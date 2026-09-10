"use client";

import {
  FileDown,
  HandCoins,
  PlugZap,
  Plus,
  UserCheck,
  Users,
  UserX,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/DataTable";
import { type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { Icon } from "@/components/ui/Icon";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import {
  type RegistryColumn,
  type RegistryRow,
  RegistryTable,
} from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { dec, energy, money, num } from "@/lib/data/seed";
import {
  SUBSCRIBER_KIND_LABEL,
  SUBSCRIBER_STATUS_LABEL,
  SUBSCRIBERS,
  type Subscriber,
  type SubscriberKind,
  type SubscriberStatus,
  subscriberTotals,
} from "@/lib/data/subscribers";

// O'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, string proplarda ’.

/** Filtr qiymatlari: "all" - filtr o'chirilgan holat. */
type StatusFilter = "all" | SubscriberStatus;
type KindFilter = "all" | SubscriberKind;

/** Holat nishonining rangi - jadvalning oxirgi ustuni uchun. */
const STATUS_TONE: Record<SubscriberStatus, BadgeTone> = {
  active: "green",
  debtor: "red",
  disconnected: "amber",
};

/** Filtr tugmasidagi nuqta rangi holat rangiga mos keladi. */
const STATUS_DOT: Record<SubscriberStatus, string> = {
  active: "bg-accent-green",
  debtor: "bg-accent-red",
  disconnected: "bg-accent-amber",
};

const STATUS_ORDER: readonly SubscriberStatus[] = ["active", "debtor", "disconnected"];
const KIND_ORDER: readonly SubscriberKind[] = ["household", "legal", "budget"];

const COLUMNS: RegistryColumn[] = [
  { key: "code", label: "Shartnoma", grow: 12, align: "left" },
  { key: "name", label: "Nomi", grow: 24, align: "left" },
  { key: "kind", label: "Turi", grow: 10 },
  { key: "transformer", label: "TP", grow: 10 },
  { key: "meter", label: "Hisoblagich", grow: 14 },
  { key: "reading", label: "So’nggi ko’rsatkich", grow: 14 },
  { key: "monthly", label: "Oylik kWh", grow: 12 },
  { key: "balance", label: "Balans", grow: 14 },
  { key: "status", label: "Holat", grow: 12 },
];

/** Jadvalda yil ortiqcha joy egallaydi: "9-avgust, 2026" -> "9-avgust". */
function shortDate(value: string): string {
  return value.split(",")[0];
}

/** Qidiruv nom, shartnoma, manzil, hudud va TP kodi bo'yicha ishlaydi. */
function matchesQuery(item: Subscriber, query: string): boolean {
  if (!query) return true;
  const haystack = [item.name, item.code, item.address, item.transformerCode, item.area]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * Abonentlar registri: yuqorida 5 ta ko'rsatkich, pastda qidiruv, ikki
 * qatorli filtr va qolgan joyni egallaydigan jadval.
 *
 * Sahifaning o'zi skroll bo'lmaydi - skroll faqat jadval konteynerida
 * (`min-h-0 flex-1 overflow-y-auto`), shuning uchun sarlavha va ko'rsatkichlar
 * doim ko'rinib turadi.
 */
export function SubscribersView() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");

  const totals = useMemo(() => subscriberTotals(), []);
  const normalized = query.trim().toLowerCase();

  // Ikkala filtr birga qo'llanadi, qidiruv esa ulardan keyin.
  const rows = useMemo(
    () =>
      SUBSCRIBERS.filter(
        (item) =>
          (status === "all" || item.status === status) &&
          (kind === "all" || item.kind === kind) &&
          matchesQuery(item, normalized),
      ),
    [status, kind, normalized],
  );

  /*
   * Tugmalardagi sonlar "qarama-qarshi" filtr bo'yicha hisoblanadi: tur
   * tanlangach holat sonlari o'sha turga tegishli bo'ladi, shuning uchun
   * foydalanuvchi bo'sh natija beradigan tugmani bosmaydi.
   */
  const statusChips = useMemo<ReadonlyArray<FilterChip<StatusFilter>>>(() => {
    const scope = SUBSCRIBERS.filter((item) => kind === "all" || item.kind === kind);
    return [
      { value: "all", label: "Barchasi", count: scope.length },
      ...STATUS_ORDER.map((value) => ({
        value,
        label: SUBSCRIBER_STATUS_LABEL[value],
        count: scope.filter((item) => item.status === value).length,
        dot: STATUS_DOT[value],
      })),
    ];
  }, [kind]);

  const kindChips = useMemo<ReadonlyArray<FilterChip<KindFilter>>>(() => {
    const scope = SUBSCRIBERS.filter((item) => status === "all" || item.status === status);
    return [
      { value: "all", label: "Barchasi", count: scope.length },
      ...KIND_ORDER.map((value) => ({
        value,
        label: SUBSCRIBER_KIND_LABEL[value],
        count: scope.filter((item) => item.kind === value).length,
      })),
    ];
  }, [status]);

  const tableRows: RegistryRow[] = rows.map((item) => ({
    key: item.id,
    href: `/subscribers/${item.id}`,
    cells: [
      <span key="code" className="truncate font-medium">
        {item.code}
      </span>,
      <span key="name" className="truncate" title={item.address}>
        {item.name}
      </span>,
      SUBSCRIBER_KIND_LABEL[item.kind],
      <span key="transformer" className="font-medium">
        {item.transformerCode}
      </span>,
      <span key="meter" className="flex min-w-0 items-center justify-center gap-1">
        <span className="truncate">{item.meterNo}</span>
        {item.online ? null : (
          <span
            className="shrink-0 text-ink-soft"
            title="Hisoblagich aloqada emas"
            aria-label="Hisoblagich aloqada emas"
          >
            <Icon icon={WifiOff} size={14} />
          </span>
        )}
      </span>,
      <span key="reading" className="flex min-w-0 items-baseline justify-center gap-1">
        <span className="truncate">{num(item.lastReading)}</span>
        <span className="shrink-0 text-[10px] text-ink-soft">
          {shortDate(item.lastReadingDate)}
        </span>
      </span>,
      num(item.monthlyKwh),
      // Qarzdorlik - qizil va qalin: maketda "yomon" qiymat shunday ajratiladi.
      <span
        key="balance"
        className={item.balance < 0 ? "truncate font-semibold text-trend-up" : "truncate"}
      >
        {money(item.balance)}
      </span>,
      <Badge key="status" tone={STATUS_TONE[item.status]}>
        {SUBSCRIBER_STATUS_LABEL[item.status]}
      </Badge>,
    ],
  }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Abonentlar"
        subtitle={`${totals.total} ta iste’molchi · aholi, yuridik va budjet`}
      >
        <HeaderButton icon={FileDown}>Hisobot</HeaderButton>
        <HeaderButton icon={Plus} tone="brand">
          Yangi abonent
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Jami abonent"
          value={num(totals.total)}
          unit="ta"
          icon={Users}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={`Aholi: ${totals.household} · Yuridik: ${totals.legal} · Budjet: ${totals.budget}`}
        />
        <StatCard
          label="Faol"
          value={num(totals.active)}
          unit="ta"
          icon={UserCheck}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint={`Ulushi: ${dec((totals.active / totals.total) * 100)}%`}
          hintTone="good"
        />
        <StatCard
          label="Qarzdor"
          value={num(totals.debtor)}
          unit="ta"
          icon={HandCoins}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint={`Umumiy qarz: ${money(totals.debt)}`}
          hintTone="bad"
        />
        <StatCard
          label={"O’chirilgan"}
          value={num(totals.disconnected)}
          unit="ta"
          icon={UserX}
          accent="bg-accent-amber"
          tint="bg-tint-amber"
          hint={`Aloqada emas: ${totals.offline} ta hisoblagich`}
        />
        <StatCard
          label={"Oylik iste’mol"}
          value={energy(totals.consumption)}
          icon={PlugZap}
          accent="bg-accent-teal"
          tint="bg-tint-teal"
          hint={`O’rtacha: ${num(totals.consumption / totals.total)} kWh / abonent`}
        />
      </StatRow>

      <Card className="min-h-0 flex-1">
        {/* Filtrlar ikki qatorda: holat va tur tugmalari qidiruv bilan birga
            bitta qatorga sig'maydi (tor ekranda ular siqilib ketardi). */}
        <div className="flex shrink-0 flex-col gap-2 pb-3">
          <div className="flex items-center gap-2">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder={"Nomi, shartnoma, manzil yoki TP…"}
              className="w-[240px]"
            />
            <FilterChips items={statusChips} value={status} onChange={setStatus} />
            <span className="ml-auto shrink-0 text-[11px] text-ink-soft">
              {tableRows.length} ta yozuv
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[11px] text-ink-soft">Turi:</span>
            <FilterChips items={kindChips} value={kind} onChange={setKind} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <RegistryTable
            columns={COLUMNS}
            rows={tableRows}
            emptyText="Bunday abonent topilmadi"
          />
        </div>
      </Card>
    </div>
  );
}
