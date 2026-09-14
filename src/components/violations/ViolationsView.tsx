"use client";

import {
  ClipboardList,
  FileDown,
  FileWarning,
  Gavel,
  HandCoins,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/DataTable";
import { type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { HeaderButton, PageHeader } from "@/components/ui/PageHeader";
import {
  type RegistryColumn,
  type RegistryRow,
  RegistryTable,
} from "@/components/ui/RegistryTable";
import { StatCard, StatRow } from "@/components/ui/StatCard";
import { dec, money, num } from "@/lib/data/seed";
import {
  type Stage,
  STAGE_LABEL,
  type Verdict,
  VERDICT_LABEL,
  VIOLATIONS,
} from "@/lib/data/violations";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------------------
   Ko'rinish ranglari (ma'lumotning o'zi - `@/lib/data/violations`)
   --------------------------------------------------------------------------- */

/** Jadvaldagi kichik nuqta rangi - qaror turini bir qarashda ko'rsatadi. */
const VERDICT_DOT: Record<Verdict, string> = {
  administrative: "bg-accent-amber",
  criminal: "bg-accent-red",
  innocent: "bg-accent-green",
};

const STAGE_TONE: Record<Stage, BadgeTone> = {
  new: "blue",
  review: "amber",
  closed: "green",
};

const countVerdict = (verdict: Verdict) =>
  VIOLATIONS.filter((item) => item.verdict === verdict).length;

const countStage = (stage: Stage) =>
  VIOLATIONS.filter((item) => item.stage === stage).length;

/** Ma'muriy jarimalarning umumiy summasi - "Ma'muriy" kartasining izohi. */
const ADMIN_FINE = VIOLATIONS.filter((item) => item.verdict === "administrative").reduce(
  (sum, item) => sum + item.fine,
  0,
);

/** Undirilgan jarima - faqat yakunlangan ishlar bo'yicha. */
const COLLECTED = VIOLATIONS.filter((item) => item.stage === "closed").reduce(
  (sum, item) => sum + item.fine,
  0,
);

/* ---------------------------------------------------------------------------
   Jadval
   --------------------------------------------------------------------------- */

const COLUMNS: RegistryColumn[] = [
  { key: "act", label: "Dalolatnoma", grow: 12, align: "left" },
  { key: "date", label: "Sana", grow: 10 },
  { key: "subscriber", label: "Abonent", grow: 20, align: "left" },
  { key: "tp", label: "TP", grow: 8 },
  { key: "kind", label: "Turi", grow: 16, align: "left" },
  { key: "fine", label: "Jarima", grow: 12 },
  { key: "inspector", label: "Ma\u2019sul", grow: 16, align: "left" },
  { key: "stage", label: "Holat", grow: 12 },
];

type StageFilter = "all" | Stage;

const CHIPS: readonly FilterChip<StageFilter>[] = [
  { value: "all", label: "Barchasi", count: VIOLATIONS.length },
  { value: "new", label: "Yangi", count: countStage("new"), dot: "bg-accent-blue" },
  {
    value: "review",
    label: "Tekshiruvda",
    count: countStage("review"),
    dot: "bg-accent-amber",
  },
  {
    value: "closed",
    label: "Yakunlangan",
    count: countStage("closed"),
    dot: "bg-accent-green",
  },
];

const VERDICT_ORDER: readonly Verdict[] = ["administrative", "criminal", "innocent"];

/**
 * "Qoidabuzarliklar" ro'yxati: hisoblagich buzilishi, o'g'irlik va noqonuniy
 * ulanishlar reestri.
 *
 * Sahifa o'zi skroll bo'lmaydi - jadval kartaning ichida skroll qilinadi
 * (`min-h-0 flex-1 overflow-y-auto`), shuning uchun yuqoridagi yo'lak va
 * statistika qatori doim ko'rinib turadi.
 */
export function ViolationsView() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<StageFilter>("all");

  const items = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return VIOLATIONS.filter((item) => {
      if (stage !== "all" && item.stage !== stage) return false;
      if (!needle) return true;
      return [
        item.act,
        item.subscriber,
        item.subscriberCode,
        item.tp,
        item.kind,
        item.inspector,
      ].some((field) => field.toLowerCase().includes(needle));
    });
  }, [query, stage]);

  const rows: RegistryRow[] = items.map((item) => ({
    key: item.id,
    cells: [
      <span key="act" className="truncate font-medium text-ink">
        {item.act}
      </span>,
      <span key="date" className="truncate text-ink-muted">
        {item.date}
      </span>,
      <span
        key="subscriber"
        className="truncate"
        title={`${item.subscriber} \u00b7 ${item.subscriberCode}`}
      >
        {item.subscriber}
      </span>,
      <span key="tp" className="truncate font-medium" title={item.area}>
        {item.tp}
      </span>,
      <span
        key="kind"
        className="flex min-w-0 items-center gap-1.5"
        title={`${item.kind} \u2014 ${VERDICT_LABEL[item.verdict]}`}
      >
        <span
          className={cn("size-1.5 shrink-0 rounded-full", VERDICT_DOT[item.verdict])}
          aria-hidden
        />
        <span className="truncate">{item.kind}</span>
      </span>,
      <span
        key="fine"
        className={cn("truncate", item.fine === 0 ? "text-ink-soft" : "font-medium text-ink")}
      >
        {item.fine === 0 ? "\u2014" : money(item.fine)}
      </span>,
      <span key="inspector" className="truncate text-ink-muted">
        {item.inspector}
      </span>,
      <Badge key="stage" tone={STAGE_TONE[item.stage]}>
        {STAGE_LABEL[item.stage]}
      </Badge>,
    ],
  }));

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PageHeader
        title="Qoidabuzarliklar"
        subtitle={"Hisoblagich buzilishi, o\u2019g\u2019irlik va noqonuniy ulanishlar"}
      >
        <HeaderButton icon={FileDown}>Hisobot</HeaderButton>
        <HeaderButton icon={Plus} tone="brand">
          Dalolatnoma
        </HeaderButton>
      </PageHeader>

      <StatRow>
        <StatCard
          label="Jami holat"
          value={num(VIOLATIONS.length)}
          unit="ta"
          icon={ClipboardList}
          accent="bg-accent-blue"
          tint="bg-tint-blue"
          hint={`${countStage("new")} yangi \u00b7 ${countStage("review")} tekshiruvda`}
        />
        <StatCard
          label={"Ma\u2019muriy"}
          value={num(countVerdict("administrative"))}
          unit="ta"
          icon={FileWarning}
          accent="bg-accent-amber"
          tint="bg-tint-amber"
          hint={`Jami jarima ${money(ADMIN_FINE)}`}
        />
        <StatCard
          label="Jinoiy"
          value={num(countVerdict("criminal"))}
          unit="ta"
          icon={Gavel}
          accent="bg-accent-red"
          tint="bg-tint-red"
          hint="Ichki ishlar organiga yuborilgan"
          hintTone="bad"
        />
        <StatCard
          label="Aybsiz"
          value={num(countVerdict("innocent"))}
          unit="ta"
          icon={ShieldCheck}
          accent="bg-accent-green"
          tint="bg-tint-green"
          hint="Tekshiruvda ayb tasdiqlanmadi"
          hintTone="good"
        />
        <StatCard
          label="Undirilgan jarima"
          value={dec(COLLECTED / 1_000_000)}
          unit={"mln so\u2019m"}
          icon={HandCoins}
          accent="bg-accent-indigo"
          tint="bg-tint-indigo"
          hint={`${countStage("closed")} ta yakunlangan ish bo\u2019yicha`}
        />
      </StatRow>

      <Card className="min-h-0 flex-1">
        <div className="flex shrink-0 items-center gap-2 pb-3">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Dalolatnoma, abonent, TP..."
            label={"Qoidabuzarliklar ro\u2019yxatidan qidirish"}
            className="w-[240px]"
          />
          <FilterChips items={CHIPS} value={stage} onChange={setStage} />

          {/* Jadvaldagi rangli nuqtalar izohi - qaror turini bildiradi. */}
          <div className="ml-auto flex shrink-0 items-center gap-3">
            {VERDICT_ORDER.map((verdict) => (
              <span
                key={verdict}
                className="flex items-center gap-1.5 text-[11px] text-ink-soft"
              >
                <span
                  className={cn("size-1.5 rounded-full", VERDICT_DOT[verdict])}
                  aria-hidden
                />
                {VERDICT_LABEL[verdict]}
              </span>
            ))}
            <span className="text-[11px] text-ink-soft">{rows.length} ta yozuv</span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-none">
          <RegistryTable
            columns={COLUMNS}
            rows={rows}
            emptyText="Bunday qoidabuzarlik topilmadi"
          />
        </div>
      </Card>
    </div>
  );
}
