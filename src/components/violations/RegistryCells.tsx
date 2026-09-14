import { ArrowUpRight, X } from "lucide-react";
import Link from "next/link";

import { HeaderButton } from "@/components/ui/PageHeader";
import { EMPTY } from "@/lib/format";
import { cn } from "@/lib/ui/cn";

/*
 * Qoidabuzarliklar va murojaatlar reestrlari uchun umumiy jadval kataklari.
 * Ikki shablonning ustunlari bir xil (TP Nomi, Abonent, Manzil, Ma'sul
 * xodim) - ko'rinish ham bir xil bo'lsin. Server komponentlar.
 */

/** Katak ichidagi matnli havola. */
const LINK = "truncate font-medium text-brand hover:underline";

/**
 * `RegistryTable` kataklari orasida bo'shliq yo'q. Chapga tekislangan matn
 * (qisqartirilgan yoki ikki qatorga o'ralgan) keyingi ustunga yopishmasin -
 * o'ng tomonda ichki bo'shliq. Sarlavha tekislanishiga ta'sir qilmaydi.
 */
export const CELL_GUTTER = "pr-3";

interface Ref {
  id: string;
  name: string;
}

/** TP nomi (havola) va ostida fider · podstansiya. */
export function TransformerCell({
  transformer,
  feeder,
  substation,
}: {
  transformer: Ref;
  feeder: Ref;
  substation?: Ref;
}) {
  const parents = substation ? `${feeder.name} · ${substation.name}` : feeder.name;
  return (
    <span className={cn("flex min-w-0 flex-col items-start leading-4", CELL_GUTTER)}>
      <Link href={`/transformers/${transformer.id}`} className={cn(LINK, "max-w-full")}>
        {transformer.name}
      </Link>
      <span className="max-w-full truncate text-[10px] leading-3.5 text-ink-soft" title={parents}>
        {parents}
      </span>
    </span>
  );
}

/** Abonent: ro'yxatda bir ma'noli topilgan bo'lsa - abonent sahifasiga havola. */
export function SubscriberCell({ name, subscriber }: { name: string; subscriber: { id: string } | null }) {
  if (!subscriber) {
    return (
      <span className={cn("truncate", CELL_GUTTER)} title={name}>
        {name}
      </span>
    );
  }
  return (
    <Link href={`/subscribers/${subscriber.id}`} className={cn(LINK, CELL_GUTTER)} title={name}>
      {name}
    </Link>
  );
}

/** Ma'sul xodim - xodimlar ro'yxatida shu ism bo'yicha qidiruv. */
export function StaffCell({ staff }: { staff: Ref | null }) {
  if (!staff) return <span className={cn("text-ink-soft", CELL_GUTTER)}>{EMPTY}</span>;
  return (
    <Link
      href={`/staff?q=${encodeURIComponent(staff.name)}`}
      className={cn(LINK, CELL_GUTTER)}
      title={staff.name}
    >
      {staff.name}
    </Link>
  );
}

/** Uzun matn (manzil, murojaat) - ikki qatorgacha, to'liq matn `title` da. */
export function ClampText({ text, className }: { text: string | null; className?: string }) {
  if (!text) return <span className={cn("text-ink-soft", CELL_GUTTER)}>{EMPTY}</span>;
  return (
    <span className={cn("line-clamp-2 leading-4 whitespace-normal", CELL_GUTTER, className)} title={text}>
      {text}
    </span>
  );
}

/**
 * Sarlavhadagi qamrov tugmalari: obyekt sahifasiga havola va qamrovni
 * olib tashlash (qidiruv va filtr saqlanadi).
 */
export function ScopeActions({
  kindLabel,
  name,
  href,
  clearHref,
}: {
  kindLabel: string;
  name: string;
  href: string;
  clearHref: string;
}) {
  return (
    <>
      <HeaderButton icon={ArrowUpRight} href={href}>
        {kindLabel}: {name}
      </HeaderButton>
      <HeaderButton icon={X} href={clearHref}>
        Butun tuman
      </HeaderButton>
    </>
  );
}
