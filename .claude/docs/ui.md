# UI konventsiyalari (Figma -> kod)

Manba maket: Figma fayl `73vcnX4vOx0MnLcnecVFo3` ("Assets (Softlance)").

- Fider sahifasi: `node-id=4029:930` ("Feeder detail", 1920x1080)
- Xarita sahifasi: `node-id=3947:166` ("Map", 1920x1080)

## Maket tuzilmasi

Sahifa: `p-8px`, ustunlararo `gap-8px`.

```
[ IconRail 72 ] [ Ikkilamchi panel 340 ] [ Main 1476 ]
```

`Main` - 18 ustunli grid, `gap-8px`, 4 qator:

| Qator | Balandlik | Ustunlar |
|---|---|---|
| KPI | 196 | 6 x span-3 |
| 1 | 298 | span-6, span-6 (ichida 148 + 8 + 142), span-6 |
| 2 | 336 | span-4, span-4, span-6, span-4 |
| 3 | 209 | span-6, span-8, span-4 |

## Ranglar (Tailwind tokenlari, `src/app/globals.css`)

| Token | Qiymat | Ishlatilishi |
|---|---|---|
| `canvas` | `#f3f3f3` | sahifa foni, "muted" tugma foni |
| `surface` | `#ffffff` | karta foni |
| `rail` / `rail-active` | `#2c2c2c` / `#444445` | chap ikonka paneli |
| `ink` / `ink-muted` / `ink-soft` | `#333` / `#555` / `#767676` | matn |
| `brand` / `brand-deep` | `#007cd2` / `#44006c` | havola, faol holat, jadval sarlavhasi |
| `accent-blue|green|red|purple|indigo|brown` | `#3b82f6` `#22c55e` `#ff383c` `#cb30e0` `#6155f5` `#ac7f5e` | KPI ikonkalari va ustunlar |
| `tint-blue|green|red|purple|indigo|brown` | `#eff6ff` `#effff0` `#ffefef` `#feefff` `#f3efff` `#fff5ef` | KPI kartalari foni, nishonlar |
| `trend-up` / `trend-down` | `#cf4646` / `#16a34a` | o'sish / kamayish matni |

## Tipografika (Geist)

| O'lcham | Vazn | Ishlatilishi |
|---|---|---|
| 24px | bold | KPI qiymati |
| 16px | bold | panel sarlavhasi |
| 16px | semibold | sidebar havolasi |
| 14px | bold | karta sarlavhasi (`CardHeader`) |
| 14px | medium/regular | KPI matni, ro'yxat qiymatlari |
| 12px | regular/medium | jadval kataklari, bo'lim izohi |
| 11px | semibold | jadval sarlavha katagi |
| 10px | semibold | holat nishoni |

## Ikonkalar

`lucide-react` (v1.41). Maketda **barcha ikonka chiziqlari 1.5px absolyut**,
shuning uchun `strokeWidth = 36 / size`. Buni qo'lda yozmang -
`@/components/ui/Icon` dagi `<Icon icon={Zap} size={20} />` ni ishlating
(rang `currentColor` orqali ota elementdan olinadi).

Lucide'da yo'q glif bo'lsa (`user-group`), Figma eksportidagi aynan `path`
bilan `src/components/ui/icons/` ga mahalliy komponent yoziladi.

## Tayyor primitivlar

| Fayl | Eksport |
|---|---|
| `@/components/ui/Card` | `Card`, `CardHeader`, `CardBody`, `CardFooterLink` |
| `@/components/ui/Toggle` | `SegmentedIcons` (**mijoz**) |
| `@/components/ui/IconPill` | `IconPill` (server) |
| `@/components/ui/DataTable` | `DataTable`, `Badge` |
| `@/components/ui/Icon` | `Icon`, `strokeFor`, `GlyphIcon` |
| `@/components/shell/AppShell` | `AppShell`, `SidebarPanel` |
| `@/lib/ui/cn` | `cn` |

Karta sarlavhasidagi standart amallar:
`chart/table` almashtirgichi (`SegmentedIcons`) va yuklab olish (`IconPill`,
`FileDown`).

## Grafiklar

`@nivo/*` (line, bar, radial-bar, pie). Nivo komponentlari faqat mijozda
ishlaydi - fayl boshida `"use client"`. O'lcham uchun `ResponsiveX` variantini
ota `div`da `h-full w-full` bilan ishlating.

## Til

UI matni - o'zbekcha, kod identifikatorlari - inglizcha
(`loyiha.md` dagi "Til qoidasi").
