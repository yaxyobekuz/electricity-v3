import Image from "next/image";
import { Bell, CalendarDays, ChevronDown, Landmark, Sun, Zap } from "lucide-react";

import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/ui/cn";

/**
 * O'qilmagan bildirishnomalar soni - hozircha mock. Nishon matni va
 * `aria-label` bitta manbadan olinsin, aks holda ular bir-biridan uzilib
 * qoladi.
 */
const NOTIFICATION_COUNT = 3;

/**
 * Yo'lakning o'ng qismidagi bloklarni ajratuvchi chiziq (maketda #ECECEC).
 *
 * `shrink-0` shart: flex elementining sukutdagi `flex-shrink: 1` qiymati bilan
 * 1px kenglik joy tor bo'lganda nolga siqilib, ajratgichlar aynan kerak
 * bo'lgan paytda ko'rinmay qolardi.
 */
function Divider() {
  return <span aria-hidden="true" className="h-8 w-px shrink-0 bg-[#ececec]" />;
}

/**
 * Bosh sahifaning yuqori yo'lagi (1476x60).
 *
 * Bu `Card` emas - o'z konteyneri bor, chunki yo'lakning ichki bo'shlig'i
 * faqat yon tomonlarda (16px) va kontenti vertikal emas, gorizontal
 * joylashadi. Balandlik grid katagi bilan qat'iy 60px, shuning uchun har bir
 * matn qatori bir qatorda qoladi (`whitespace-nowrap`, shiorda esa uni o'z
 * ichiga oluvchi `truncate`) va ikki qatorli bloklarda `leading-tight` -
 * bironta qator ko'chsa, yo'lak kesilib qolardi.
 */
export function HomeTopBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-between gap-4 overflow-hidden rounded-xl bg-surface px-4",
        className,
      )}
    >
      {/* Chap: tashkilot identifikatori */}
      <div className="flex shrink-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
          <Icon icon={Landmark} size={20} />
        </span>
        <div className="flex flex-col">
          <span className="text-sm leading-tight font-bold whitespace-nowrap text-ink">
            Baliqchi tumani hokimligi
          </span>
          <span className="text-[10px] leading-tight whitespace-nowrap text-ink-soft">
            Elektr ta&rsquo;minoti monitoring va boshqaruv tizimi
          </span>
        </div>
      </div>

      {/* Markaz: shior.
          Yo'lakdagi yagona siqiluvchi blok. Chap (identifikator) va o'ng
          (amallar) bloklari `shrink-0`, konteynerda esa `overflow-hidden` -
          agar shior ham `shrink-0` bo'lsa, tor ekranda (maket 1476px, kontent
          ~980px) o'ngdagi bildirishnoma va profil tugmalari indamay kesilib
          qolardi. `min-w-0` + `truncate` bilan avval shu shior qisqaradi.
          Maket kengligida bo'sh joy yetarli, `justify-between` esa uni
          taqsimlaydi - shuning uchun ko'rinish o'zgarmaydi. */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-brand">
          <Icon icon={Zap} size={18} />
        </span>
        {/* `truncate` ichida `whitespace-nowrap` bor - qator ko'chmaydi. */}
        <span className="truncate text-[11px] font-medium text-ink-muted">
          Barqaror energiya &mdash; farovon hudud
        </span>
      </div>

      {/* O'ng: sana, ob-havo, bildirishnoma, profil */}
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-ink-soft">
            <Icon icon={CalendarDays} size={18} />
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] leading-tight font-semibold whitespace-nowrap text-ink">
              10-avgust, 2026
            </span>
            <span className="text-[10px] leading-tight whitespace-nowrap text-ink-soft">
              13:42
            </span>
          </div>
        </div>

        <Divider />

        <div className="flex items-center gap-2">
          <span className="text-accent-amber">
            <Icon icon={Sun} size={18} />
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] leading-tight whitespace-nowrap text-ink-soft">
              Baliqchi
            </span>
            <span className="text-[11px] leading-tight font-semibold whitespace-nowrap text-ink">
              +32&deg;C
            </span>
          </div>
        </div>

        <Divider />

        {/* Hover uchun `black/10`: `IconPill` da `black/5` ota `bg-canvas`
            ustiga qatlam bo'lib tushadi, bu yerda esa fon ham, hover ham
            bitta elementda - `black/5` fonni almashtirib, oq karta ustida
            #f2f2f2 beradi va #f3f3f3 dan farq qilmaydi. */}
        <button
          type="button"
          aria-label={`Bildirishnomalar (${NOTIFICATION_COUNT} ta)`}
          className="relative flex size-9 items-center justify-center rounded-lg bg-canvas text-ink transition-colors hover:bg-black/10"
        >
          <Icon icon={Bell} size={18} />
          {/* Nishon tugma chegarasidan tashqariga chiqadi - ota konteynerda
              `overflow-hidden` bor, shuning uchun 4px chetdan surilgan. */}
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-accent-red text-[9px] font-semibold text-white">
            {NOTIFICATION_COUNT}
          </span>
        </button>

        <Divider />

        <button
          type="button"
          aria-label="Profil menyusi: Boshqaruv, tizim administratori"
          className="flex items-center gap-2 rounded-lg text-left transition-opacity hover:opacity-70"
        >
          <Image
            src="/brand/avatar.png"
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-full object-cover"
          />
          <span className="flex flex-col">
            <span className="text-[11px] leading-tight font-semibold whitespace-nowrap text-ink">
              Boshqaruv
            </span>
            <span className="text-[10px] leading-tight whitespace-nowrap text-ink-soft">
              Tizim administratori
            </span>
          </span>
          <span className="text-ink-soft">
            <Icon icon={ChevronDown} size={16} />
          </span>
        </button>
      </div>
    </div>
  );
}
