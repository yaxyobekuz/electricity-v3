# Bosh sahifa maketi (Figma `4126:47`, "Home", 1920x1080)

> `structure.xml` - `get_design_context` qaytargan tugunlar daraxti (nom,
> x/y/width/height va matn tugunlari), 2026-09-13 dagi holat. Figma MCP
> kvotasi tugagani uchun maket **shu mahalliy nusxadan** o'qiladi. Rang
> ma'lumoti bu javobda yo'q - ranglar dizayn tizimi tokenlaridan olingan
> (`src/app/globals.css`).
>
> Diqqat: `DataLabels` kabi **guruh** ichidagi tugunlarning x/y si guruhga
> emas, eng yaqin frame'ga nisbatan - ota koordinatasini qo'shmang.

## Tarmoq

Sahifa fider sahifasi bilan **bir xil tarmoqda**: `Main` 1476px, **18 ustun**,
8px oraliq. Ustun kengligi `(1476 - 17*8) / 18 = 74.44px`, span kengligi
`span*74.44 + (span-1)*8`:

| span | kenglik |
|---|---|
| 3 | 239.33 |
| 4 | 321.78 |
| 6 | 486.67 |
| 8 | 651.56 |
| 10 | 816.44 |

## Qatorlar

| # | Balandlik | Tarkib |
|---|---|---|
| 1 | 196 | 6 x KPI kartasi (span-3) |
| 2 | 402 | Ob'ektlar ustuni (4) \| Interaktiv xarita (10) \| Filtratsiya (4) |
| 3 | 336 | Qoidabuzarlik + Zarar (6) \| Hisoblagichlar (4) \| Murojaatlar (4) \| Tezkor (4) |
| 4 | 298 | Top podstansiyalar (6) \| Top fiderlar (6) \| Top transformatorlar (6) |
| 5 | 298 | Foydali oqim dinamikasi (6) \| Rejalashtirilgan ishlar (8) \| Hisobotlar (4) |

Jami `1530 + 4*8 = 1562px` - 1064px lik ish maydoniga sig'maydi, sahifa
**vertikal skroll** qilinadi.

Ustun ichidagi bo'linish:

- Ob'ektlar ustuni (`4179:2`): 80 + 8 + 80 + 8 + 80 + 8 + 138
- Qoidabuzarlik + zarar (`4126:497`): 220 + 8 + 108

## Komponentlar xaritasi

| Figma tugun | Karta | Kod |
|---|---|---|
| `4126:133` | 6 ta KPI | `home/cards/HomeKpiRow` |
| `4285:3`, `4286:142`, `4286:173` | Podstansiyalar / Fiderlar / Transformator | `home/cards/SummaryTile` (`ObjectsStack` ichida) |
| `4289:353` | Obektlar holati | `home/cards/ObjectsStack` |
| `4126:753` | Interaktiv ko'rinish | `cards/InteractiveMapCard` (`monthlyLabel`, `tooltipBottom={12}`) |
| `4179:238` | Filtratsiya | `home/cards/FilterCard` |
| `4126:498` | Qoidabuzarliklar | `home/cards/HomeViolationsCard` |
| `4289:294` | Umumiy keltirilgan zarar | `home/cards/SummaryTile` (`valueFirst={false}`) |
| `4126:680` | Hisoblagichlar holati | `home/cards/HomeRingCards` -> `cards/RingStatsCard` |
| `4301:2515` | Murojaatlar | `home/cards/HomeRingCards` -> `cards/RingStatsCard` (`summary`) |
| `4126:936` | Tezkor ko'rsatgichlar | `cards/QuickMetricsCard` (`metrics`) |
| `4126:538`, `4220:109`, `4301:2607` | Eng ko'p sarfga ega ... | `cards/TopBarsCard` (`labelWidth` 59 / 66 / 46) |
| `4126:369` | Foydali oqim dinamikasi | `cards/ConsumptionDynamicsCard` (`title`, `labels`) |
| `4126:1005` | Rejalashtirilgan ishlar | `cards/PlannedWorksCard` (`works`) |
| `4126:1040` | Hisobotlarni yuklab olish | `cards/DownloadReportsCard` (`stretchPeriods={false}`) |

Umumiy kartalar fider sahifasida ham ishlatiladi - bosh sahifaga xos farqlar
faqat **ixtiyoriy proplar** orqali, standart qiymatlar fider maketiniki.
`cards/DebtCard` ham `RingStatsCard` ustiga qurilgan.

## KPI kartalari (`4126:133`)

Qatorlar: sarlavha 32, qiymat 41, matn qatorlari 26, diagramma 13 (yoki 39).

Oqim kartalaridagi 30 kunlik ustunlar 39px lik trekdan ko'chirilgan va
balandligi o'zgarmay qolgan, trek esa 13px ga qisqargan. Ortiqcha qism
kesiladi deb olindi (aks holda ustunlar delta qatori ustiga chiqardi):
ko'rinadigan ulush `min(h, 13) / 13`.

## "BarLineChart" o'lchamlari (`4216:57`)

```
BarLineChart  454.67 x 218  (y=48, ichki blok 8px pastda)
  yAxisTop     15px  - qiymat o'qi YUQORIDA, matn 12px
  MainChart   195px  - chapda yorliq ustuni (59 / 66 / 46px), o'ngda 4px
  ustun       qator qadamining 40.37% i, qator ichida markazda
```

Nivo `padding` ichki va tashqi bo'shliqni teng qiladi, maketda tashqisi
yarmi - farq nivo maydonini yuqori/pastga `padding * qadam / 2` ga
cho'zish bilan yo'qotiladi (`TopBarsCard` dagi izohga qarang).

Qiymatlar ustun uzunligidan hisoblangan (`SingleBar eni / BarArea eni * max`):

- Podstansiyalar (max 100, qadam 20, BarArea 391.67): Chinobod **47.9**,
  Baliqchi **71.05** (maketda matn sifatida ham yozilgan)
- Fiderlar (max 200, qadam 25, BarArea 384.67) va transformatorlar (BarArea
  404.67) - bir xil qiymatlar: 47.9, 18.8, 57.8, 77.0, 28.4, 107.6

## Halqa diagrammalari (`4126:680`, `4301:2515`)

"Qarzdorlik" shablonining nusxasi, shkala 0-100 (qadam 20). Yoy - umumiy
sonning (2,253) ulushi. Markaz 180x169 kadrning (94.84, 90.94) nuqtasida
(`Series` / `Annotations` qutilari markazi), yorliq nuqtalari
`HOME_GEOMETRY` da.

## Maketdagi kamchiliklar (ataylab chetlanilgan joylar)

1. **Top diagrammalar pastidagi havola** - uchala kartada ham "Podstansiyalar
   sahifasini ochish" (nusxa izi). Havola o'z sahifasiga olib boradi, matn
   ham shunga moslashtirildi ("Fiderlar ..." / "Transformatorlar ...").
2. **Top diagrammalarning yuqori o'qi** - maketda yorliqlar tiklarga
   bog'lanmagan, x=61 (yoki 68) dan o'ng chetgacha bir tekis taqsimlangan
   (transformatorlarda "0" nol chizig'idan 29px o'ngda). Kodda har bir
   yorliq o'z tiki ustida.
3. **"Murojaatlar" sidebar havolasi** (`4263:2870`) - maketda "Sozlamalar"
   ning tishli g'ildirak ikonkasi nusxalanib qolgan; kodda `MessagesSquare`.
4. **Oqim kartalaridagi 13px diagramma** - yuqoridagi "KPI kartalari"ga qarang.

## Eksport qilinmagan (kvota tugagani uchun)

- 48px svgrepo illyustratsiyalari (`energy-industry-...`, `transmission-...`,
  `transformer-power-...`, `business-electricity-...`) - hozircha
  `SummaryTile` da lucide glifi.
- "Rectangle 18" bezak aylanasining rangi/blur qiymati - taxminiy
  (`opacity-20 blur-2xl`, aksent rangida).
- Yangi kartalardagi ranglar (Obektlar holati qutilari, halqa ranglari,
  "Yo'qotish darajasi" tusi) - dizayn tizimi palitrasidan tanlangan.

## Tekshirish

`npm run build` + `next start`, 1920x1080, Chrome DevTools protokoli orqali
o'lchangan: 25 ta karta qutisining ham x/y/width/height maketga **0.01px**
aniqlikda mos; matn tugunlari 1px ichida (yuqoridagi 2-banddan tashqari);
top diagramma ustunlari `SingleBar` bilan 0.01px aniqlikda mos.
