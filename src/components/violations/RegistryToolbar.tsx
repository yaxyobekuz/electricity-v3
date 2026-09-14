"use client";

import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";

import { type FilterChip, FilterChips, SearchField } from "@/components/ui/Filters";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

import { ALL_CHIP } from "./registry-params";

/** Qidiruv matni URL ga yozilishidan oldingi kutish (ms). */
const SEARCH_DELAY = 300;

/** Joriy manzildagi `q` - taymer va hodisalar render paytidagi qiymatga tayanmaydi. */
function liveQuery(): string {
  return new URLSearchParams(window.location.search).get("q") ?? "";
}

/**
 * Reestr (qoidabuzarliklar, murojaatlar) jadvali ustidagi yo'lak: qidiruv
 * va filtr chiplari. Holat URL da (`?q=`, `?type=` / `?status=`), ro'yxatni
 * server sahifasi shu parametrlar bo'yicha qayta o'qiydi - havolani ulashsa
 * yoki sahifani yangilasa, filtr saqlanadi.
 *
 * Qolgan parametrlar (`scope` va boshqa filtr) o'zgarmaydi. O'ng tomondagi
 * `children` (yozuvlar soni) server tomonda chiziladi.
 */
export function RegistryToolbar({
  param,
  chips,
  placeholder,
  searchLabel,
  children,
}: {
  /** Chip filtrining URL parametri: `"type"` yoki `"status"`. */
  param: string;
  /** Birinchisi `ALL_CHIP` qiymatli "Barchasi". */
  chips: ReadonlyArray<FilterChip<string>>;
  placeholder: string;
  searchLabel: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const urlQuery = searchParams.get("q") ?? "";
  const rawChip = searchParams.get(param);
  const activeChip = chips.some((chip) => chip.value === rawChip) ? (rawChip as string) : ALL_CHIP;

  const [text, setText] = useState(urlQuery);
  // URL dagi `q` ni oxirgi marta qachon ko'rganimiz va o'zimiz nima yuborganimiz.
  // Server javobi kelguncha foydalanuvchi yozishda davom etsa, matn eski
  // qiymat bilan almashtirilmasligi uchun: faqat tashqi o'zgarish (orqaga
  // tugmasi, havola) maydonni yangilaydi.
  const [seenQuery, setSeenQuery] = useState(urlQuery);
  const [sentQuery, setSentQuery] = useState(urlQuery);
  if (urlQuery !== seenQuery) {
    setSeenQuery(urlQuery);
    if (urlQuery !== sentQuery) {
      setSentQuery(urlQuery);
      setText(urlQuery);
    }
  }

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Tashqi navigatsiya (havola: yon menyu, "Butun tuman", jadval qatori;
    // brauzerning orqaga/oldinga tugmasi) kutilayotgan qidiruvni bekor
    // qiladi. Aks holda taymer shu navigatsiyadan keyin ishga tushib, uni
    // eski parametrlar bilan ustidan yozib yuboradi - masalan, olib tashlangan
    // qamrov qaytib keladi. Yuborilmagan matn o'rniga URL dagi `q` qaytadi.
    function abandon() {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      setText(liveQuery());
    }

    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (anchor && anchor.getAttribute("target") !== "_blank") abandon();
    }

    // Capture bosqichi - `Link` o'z navigatsiyasini boshlashidan oldin.
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", abandon);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", abandon);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function navigate(changes: Record<string, string | null>, mode: "push" | "replace") {
    // Parametrlar joriy manzildan o'qiladi, render paytidagi `searchParams`
    // dan emas: taymer ishga tushguncha URL o'zgargan bo'lishi mumkin.
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const query = next.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    startTransition(() => {
      router[mode](href, { scroll: false });
    });
  }

  function cancelTimer() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function onSearch(value: string) {
    setText(value);
    cancelTimer();
    timer.current = setTimeout(() => {
      timer.current = null;
      const query = value.trim();
      setSentQuery(query);
      navigate({ q: query || null }, "replace");
    }, SEARCH_DELAY);
  }

  function onChip(value: string) {
    // Kutilayotgan qidiruv ham shu navigatsiya bilan birga yuboriladi.
    cancelTimer();
    const query = text.trim();
    setSentQuery(query);
    navigate({ q: query || null, [param]: value === ALL_CHIP ? null : value }, "push");
  }

  // Joy yetmasa avval qidiruv maydoni torayadi (144px gacha, qisqarish
  // koeffitsienti chiplarnikidan ancha katta), keyin chiplar - aks holda tor
  // ekranda oxirgi chip ko'rinmay qoladi.
  return (
    <div className="flex shrink-0 items-center gap-2 pb-3">
      <SearchField
        value={text}
        onChange={onSearch}
        placeholder={placeholder}
        label={searchLabel}
        className="w-60 min-w-36 shrink-1000"
      />
      <FilterChips
        items={chips}
        value={activeChip}
        onChange={onChip}
        className={cn("min-w-0", pending && "opacity-70")}
      />

      <div className="ml-auto flex shrink-0 items-center gap-2 text-[11px] text-ink-soft">
        {pending ? (
          <span role="status" aria-label="Yuklanmoqda" className="flex animate-spin text-brand">
            <Icon icon={LoaderCircle} size={14} />
          </span>
        ) : null}
        {children}
      </div>
    </div>
  );
}
