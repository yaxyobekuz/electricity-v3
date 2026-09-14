"use client";

import Link from "next/link";
import { DatabaseZap } from "lucide-react";
import { useOptimistic, useTransition } from "react";

import { selectPeriod } from "@/app/actions/period";
import { Icon } from "@/components/ui/Icon";
import { SelectField, type SelectOption } from "@/components/ui/SelectField";
import { formatDate } from "@/lib/format";
import type { PeriodInfo } from "@/lib/period";
import { cn } from "@/lib/ui/cn";

/**
 * Yon paneldagi hisobot oyi tanlagichi. Barcha sahifalar shu oyni ko'rsatadi
 * (`.claude/docs/malumotlar.md`, 6-bo'lim).
 *
 * Tanlash server action orqali cookie'ni yozadi; Next shu zahoti joriy
 * sahifani yangi oy bilan qayta chizadi. Javob kelguncha tanlangan oy
 * optimistik ko'rsatiladi.
 */
export function PeriodSelect({
  periods,
  selectedKey,
}: {
  /** Yangidan eskiga. */
  periods: PeriodInfo[];
  selectedKey: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [optimisticKey, setOptimisticKey] = useOptimistic(selectedKey);

  if (periods.length === 0) return <NoPeriods />;

  const current = periods.find((period) => period.key === optimisticKey) ?? periods[0];
  const options: SelectOption[] = periods.map((period) => ({
    value: period.key,
    label: period.label,
  }));

  function choose(next: string | null) {
    // Tanlangan variantni qayta bosish `null` beradi - oy tanlovsiz qolmaydi.
    if (!next || next === current.key) return;
    startTransition(async () => {
      setOptimisticKey(next);
      await selectPeriod(next);
    });
  }

  return (
    <div className="flex shrink-0 flex-col gap-1 pb-2">
      <SelectField
        value={current.key}
        options={options}
        placeholder="Hisobot oyi"
        onChange={choose}
        className={cn("w-full", pending && "opacity-70")}
      />
      <p className="truncate px-3 text-xs text-ink-soft">
        {formatDate(current.reportDate)} holatiga
      </p>
    </div>
  );
}

/** Bazada birorta davr yo'q: yuklash sahifasiga ixcham havola. */
function NoPeriods() {
  return (
    <Link
      href="/imports"
      className="mb-2 flex shrink-0 items-center gap-3 rounded-xl bg-canvas px-3 py-2.5 transition-colors hover:bg-black/5"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface text-brand">
        <Icon icon={DatabaseZap} size={18} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-ink">Ma’lumot yuklanmagan</span>
        <span className="truncate text-xs text-ink-muted">Excel shablonlarini yuklang</span>
      </span>
    </Link>
  );
}
