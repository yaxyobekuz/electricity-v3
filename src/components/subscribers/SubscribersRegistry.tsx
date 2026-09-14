"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useRef, useState, useTransition } from "react";

import type { MeterStatus, SubscriberKind } from "@/generated/prisma";
import { METER_STATUS_DOT, METER_STATUS_TONE, exactMoney, reading } from "@/components/subscribers/subscriber-ui";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { Icon } from "@/components/ui/Icon";
import { type RegistryColumn, type RegistryRow, RegistryTable } from "@/components/ui/RegistryTable";
import {
  METER_STATUS_LABEL,
  METER_STATUS_ORDER,
  SUBSCRIBER_KIND_LABEL,
  SUBSCRIBER_KIND_ORDER,
} from "@/lib/domain/labels";
import { EMPTY, formatDateTime, num } from "@/lib/format";
import { cn } from "@/lib/ui/cn";

// O'zbekcha apostrof - U+2019: JSX matnida `&rsquo;`, string proplarda ’.

const BASE_PATH = "/subscribers";

/** Qidiruv maydoni to'xtagandan keyin URL yangilanguncha kutish, ms. */
const SEARCH_DEBOUNCE_MS = 350;

/** URL dagi filtr holati (serverda o'qilgan va tekshirilgan). */
export interface RegistryState {
  /** `"feeder:<id>"`; tuman - bo'sh satr. */
  scope: string;
  q: string;
  kind: SubscriberKind | null;
  status: MeterStatus | null;
  debtors: boolean;
  page: number;
}

/** Qamrov banneri: "Fider: F-3 (PS Markaziy)". */
export interface RegistryScope {
  kindLabel: string;
  name: string;
  href: string;
  parent: { label: string; href: string } | null;
}

export interface RegistryEntity {
  id: string;
  name: string;
}

export interface RegistrySubscriberRow {
  id: string;
  contractNumber: string;
  fullName: string;
  kind: SubscriberKind;
  meterStatus: MeterStatus;
  transformer: RegistryEntity;
  feeder: RegistryEntity;
  meterSerial: string | null;
  meterReading: number | null;
  lastReadingAt: string | null;
  debtUzs: number;
  creditUzs: number;
  address: string | null;
}

export interface SubscribersRegistryProps {
  state: RegistryState;
  scope: RegistryScope | null;
  /** Abonentlar shabloni shu oyga yuklangan. */
  uploaded: boolean;
  rows: RegistrySubscriberRow[];
  /** Barcha filtrlardan keyingi son. */
  total: number;
  /** `listSubscribers().counts` - har bir chip guruhi o'z filtrisiz. */
  counts: {
    all: number;
    byKind: Record<SubscriberKind, number>;
    byStatus: Record<MeterStatus, number>;
    debtors: number;
  };
  pageSize: number;
  /** "Sentabr 2026" */
  periodLabel: string;
}

/** Filtr o'zgarsa sahifa 1 ga qaytadi (patch'da `page` berilmagan bo'lsa). */
function nextState(state: RegistryState, patch: Partial<RegistryState>): RegistryState {
  return { ...state, page: 1, ...patch };
}

/** Holatni URL ga aylantiradi - hech narsani o'zgartirmaydi (sahifa raqami ham saqlanadi). */
function hrefOf(state: RegistryState): string {
  const params = new URLSearchParams();
  if (state.scope) params.set("scope", state.scope);
  if (state.q) params.set("q", state.q);
  if (state.kind) params.set("kind", state.kind);
  if (state.status) params.set("status", state.status);
  if (state.debtors) params.set("debtors", "1");
  if (state.page > 1) params.set("page", String(state.page));
  const query = params.toString();
  return query ? `${BASE_PATH}?${query}` : BASE_PATH;
}

/** Sahifa raqamini 1..pageCount oralig'ida ushlaydi (server ham chegaralaydi). */
function clampPage(page: number, pageCount: number): number {
  return Math.min(Math.max(page, 1), pageCount);
}

/** Sahifa raqamlari: 1 … 4 5 6 … 52. `null` - uzilish. */
function pageItems(page: number, pageCount: number): (number | null)[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((item) => wanted.add(item));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((item) => wanted.add(item));
  const sorted = [...wanted].filter((item) => item >= 1 && item <= pageCount).sort((a, b) => a - b);
  const items: (number | null)[] = [];
  sorted.forEach((item, index) => {
    if (index > 0 && item - sorted[index - 1] > 1) items.push(null);
    items.push(item);
  });
  return items;
}

const COLUMNS: RegistryColumn[] = [
  { key: "contract", label: "Shartnoma raqami", grow: 11, align: "left" },
  { key: "name", label: "FISH", grow: 20, align: "left" },
  { key: "kind", label: "Turi", grow: 7 },
  { key: "status", label: "Holati", grow: 13 },
  { key: "transformer", label: "TP", grow: 8 },
  { key: "feeder", label: "Fider", grow: 9 },
  { key: "meter", label: "Hisoblagich zavod raqami", grow: 11 },
  { key: "reading", label: "Ko’rsatkich", grow: 9 },
  { key: "debt", label: "Qarzdorlik", grow: 11, align: "right" },
  { key: "credit", label: "Haqdorlik", grow: 10, align: "right" },
];

const LINK_CLASS = "truncate transition-opacity hover:opacity-70";

function toRow(item: RegistrySubscriberRow): RegistryRow {
  return {
    key: item.id,
    cells: [
      <span key="contract" className="truncate font-medium">
        {item.contractNumber}
      </span>,
      <Link
        key="name"
        href={`/subscribers/${item.id}`}
        title={item.address ?? undefined}
        className={cn(LINK_CLASS, "font-medium text-brand")}
      >
        {item.fullName}
      </Link>,
      SUBSCRIBER_KIND_LABEL[item.kind],
      <Badge key="status" tone={METER_STATUS_TONE[item.meterStatus]}>
        {METER_STATUS_LABEL[item.meterStatus]}
      </Badge>,
      <Link key="transformer" href={`/transformers/${item.transformer.id}`} className={LINK_CLASS}>
        {item.transformer.name}
      </Link>,
      <Link key="feeder" href={`/feeders/${item.feeder.id}`} className={LINK_CLASS}>
        {item.feeder.name}
      </Link>,
      <span key="meter" className="truncate">
        {item.meterSerial ?? EMPTY}
      </span>,
      <span
        key="reading"
        className="truncate"
        title={item.lastReadingAt ? `Oxirgi olingan ma’lumot: ${formatDateTime(item.lastReadingAt)}` : undefined}
      >
        {reading(item.meterReading)}
      </span>,
      <span
        key="debt"
        className={cn("truncate", item.debtUzs > 0 ? "font-semibold text-trend-up" : "text-ink-soft")}
      >
        {exactMoney(item.debtUzs)}
      </span>,
      <span
        key="credit"
        className={cn("truncate", item.creditUzs > 0 ? "font-medium text-trend-down" : "text-ink-soft")}
      >
        {exactMoney(item.creditUzs)}
      </span>,
    ],
  };
}

/**
 * Abonentlar jadvali va uning boshqaruvlari. Ma'lumot serverda filtrlanadi:
 * bu komponent faqat URL ni yangilaydi (`router.replace`), sahifa serverda
 * qayta chiziladi. Qidiruv - kechiktirilgan, chiplar va sahifalar - darhol.
 */
export function SubscribersRegistry({
  state,
  scope,
  uploaded,
  rows,
  total,
  counts,
  pageSize,
  periodLabel,
}: SubscribersRegistryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Eng so'nggi so'ralgan filtr holati: server javobi kelmasdan bosilgan
  // keyingi chip yoki kechiktirilgan qidiruv oldingisini bekor qilmasin.
  const stateRef = useRef(state);
  const timerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState(state.q);
  // Oxirgi yuborilgan qidiruv - server javobi kelganda foydalanuvchi yozayotgan matn ustiga yozilmasin.
  const [sentQ, setSentQ] = useState(state.q);
  const [syncedQ, setSyncedQ] = useState(state.q);
  if (state.q !== syncedQ) {
    // URL tashqaridan o'zgardi (havola, orqaga tugmasi) - maydonni moslash.
    setSyncedQ(state.q);
    if (state.q !== sentQ) {
      setText(state.q);
      setSentQ(state.q);
    }
  }

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(
    () => () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    },
    [],
  );

  // Filtr yoki sahifa o'zgarganda jadval boshiga qaytadi.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [state.scope, state.q, state.kind, state.status, state.debtors, state.page]);

  function clearTimer() {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }

  /**
   * `change` - o'zgarish yoki eng so'nggi so'ralgan holatdan hisoblovchi
   * funksiya (almashtirgich va "keyingi sahifa" uchun: server javobidan oldin
   * ikkinchi bosish birinchisini takrorlamasin, uning ustiga qursin).
   */
  function navigate(change: Partial<RegistryState> | ((current: RegistryState) => Partial<RegistryState>)) {
    const patch = typeof change === "function" ? change(stateRef.current) : change;
    // Kutilayotgan qidiruv shu o'tishga qo'shiladi: aks holda u keyinroq
    // eski holatdan havola yasab, bosilgan chipni bekor qilib yuborardi.
    // Qidiruv o'zgarsa - sahifa 1 dan.
    let effective = patch;
    if (timerRef.current != null && patch.q === undefined) {
      const q = text.trim();
      if (q !== stateRef.current.q) effective = { ...patch, q, page: 1 };
    }
    clearTimer();
    const next = nextState(stateRef.current, effective);
    setSentQ(next.q);
    // Server javobi kelguncha keyingi o'tishlar shu holatdan davom etadi.
    stateRef.current = next;
    startTransition(() => router.replace(hrefOf(next), { scroll: false }));
  }

  function submitSearch(value: string) {
    clearTimer();
    const q = value.trim();
    // O'zgarmagan qidiruv (Enter, oxiridagi bo'shliq) serverga qayta yuborilmaydi.
    if (q === stateRef.current.q) return;
    navigate({ q });
  }

  function onSearchChange(value: string) {
    setText(value);
    clearTimer();
    timerRef.current = window.setTimeout(() => submitSearch(value), SEARCH_DEBOUNCE_MS);
  }

  function onSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitSearch(text);
  }

  const kindChips: FilterChip<"all" | SubscriberKind>[] = [
    {
      value: "all",
      label: "Barchasi",
      count: SUBSCRIBER_KIND_ORDER.reduce((sum, kind) => sum + counts.byKind[kind], 0),
    },
    ...SUBSCRIBER_KIND_ORDER.map((kind) => ({
      value: kind,
      label: SUBSCRIBER_KIND_LABEL[kind],
      count: counts.byKind[kind],
    })),
  ];

  const statusChips: FilterChip<"all" | MeterStatus>[] = [
    {
      value: "all",
      label: "Barchasi",
      count: METER_STATUS_ORDER.reduce((sum, status) => sum + counts.byStatus[status], 0),
    },
    ...METER_STATUS_ORDER.map((status) => ({
      value: status,
      label: METER_STATUS_LABEL[status],
      count: counts.byStatus[status],
      dot: METER_STATUS_DOT[status],
    })),
  ];

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (state.page - 1) * pageSize + 1;
  const to = Math.min(state.page * pageSize, total);
  const filtered = state.q !== "" || state.kind != null || state.status != null || state.debtors;

  return (
    <Card className="min-h-0 flex-1">
      {scope ? (
        <div className="mb-3 flex h-9 shrink-0 items-center gap-2 rounded-lg bg-tint-blue px-3 text-xs text-ink">
          <span className="shrink-0 text-ink-soft">Qamrov:</span>
          <span className="shrink-0 font-medium">{scope.kindLabel}</span>
          <Link href={scope.href} className="truncate font-semibold text-brand transition-opacity hover:opacity-70">
            {scope.name}
          </Link>
          {scope.parent ? (
            <Link
              href={scope.parent.href}
              className="truncate text-ink-soft transition-opacity hover:opacity-70"
            >
              ({scope.parent.label})
            </Link>
          ) : null}
          <Link
            href={hrefOf(nextState(state, { scope: "" }))}
            replace
            scroll={false}
            className="ml-auto flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium text-ink-muted transition-colors hover:bg-black/5"
          >
            <Icon icon={X} size={14} />
            Filtrni olib tashlash
          </Link>
        </div>
      ) : null}

      {!uploaded ? (
        <EmptyState
          variant="inline"
          title="Abonentlar ro’yxati yuklanmagan"
          description={`${periodLabel} oyi uchun abonentlar shabloni hali yuklanmagan.`}
        />
      ) : (
        <>
          <div className="flex shrink-0 flex-col gap-2 pb-3">
            <div className="flex items-center gap-2">
              <form role="search" onSubmit={onSearchSubmit} className="w-70 shrink-0">
                <SearchField
                  value={text}
                  onChange={onSearchChange}
                  placeholder="FISH, shartnoma, hisoblagich yoki manzil…"
                  label="Abonentlarni qidirish"
                />
              </form>
              <span className="shrink-0 text-[11px] text-ink-soft">Holati:</span>
              <FilterChips
                items={statusChips}
                value={state.status ?? "all"}
                onChange={(next) => navigate({ status: next === "all" ? null : next })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] text-ink-soft">Turi:</span>
              <FilterChips
                items={kindChips}
                value={state.kind ?? "all"}
                onChange={(next) => navigate({ kind: next === "all" ? null : next })}
              />
              <span className="mx-1 h-5 w-px shrink-0 bg-[#e8e8ec]" aria-hidden />
              <FilterChips
                items={[{ value: "debtors", label: "Qarzdorlar", count: counts.debtors, dot: "bg-accent-red" }]}
                value={state.debtors ? "debtors" : ""}
                onChange={() => navigate((current) => ({ debtors: !current.debtors }))}
              />
            </div>
          </div>

          <div
            ref={scrollRef}
            aria-busy={isPending}
            className={cn(
              "min-h-0 flex-1 overflow-y-auto scrollbar-none transition-opacity",
              isPending && "opacity-60",
            )}
          >
            <RegistryTable
              columns={COLUMNS}
              rows={rows.map(toRow)}
              emptyText={filtered ? "Bunday abonent topilmadi" : "Bu qamrovda abonent yo’q"}
            />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 pt-3">
            <span className="text-[11px] text-ink-soft">
              {total === 0 ? "0 ta yozuv" : `${num(total)} ta yozuvdan ${num(from)}–${num(to)}`}
            </span>
            {pageCount > 1 ? (
              <nav aria-label="Sahifalar" className="flex items-center gap-1">
                <PageButton
                  label="Oldingi sahifa"
                  disabled={state.page <= 1}
                  onClick={() => navigate((current) => ({ page: clampPage(current.page - 1, pageCount) }))}
                >
                  <Icon icon={ChevronLeft} size={16} />
                </PageButton>
                {pageItems(state.page, pageCount).map((item, index) =>
                  item == null ? (
                    <span key={`gap-${index}`} className="w-6 text-center text-xs text-ink-soft">
                      …
                    </span>
                  ) : (
                    <PageButton
                      key={item}
                      label={`${item}-sahifa`}
                      active={item === state.page}
                      onClick={() => navigate({ page: item })}
                    >
                      {num(item)}
                    </PageButton>
                  ),
                )}
                <PageButton
                  label="Keyingi sahifa"
                  disabled={state.page >= pageCount}
                  onClick={() => navigate((current) => ({ page: clampPage(current.page + 1, pageCount) }))}
                >
                  <Icon icon={ChevronRight} size={16} />
                </PageButton>
              </nav>
            ) : null}
          </div>
        </>
      )}
    </Card>
  );
}

function PageButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? "page" : undefined}
      disabled={disabled || active}
      onClick={onClick}
      className={cn(
        "flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-medium transition-colors",
        active ? "bg-brand text-white" : "bg-canvas text-ink hover:bg-black/5",
        disabled && !active && "cursor-not-allowed opacity-40 hover:bg-canvas",
      )}
    >
      {children}
    </button>
  );
}
