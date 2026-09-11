# Bosh sahifa maketi (Figma `4126:47`, "Home", 1920x1080)

> `structure.xml` - `get_design_context` qaytargan to'liq tugunlar daraxti
> (nom, x/y/width/height va matn tugunlari). Figma MCP kvotasi tugagani uchun
> maket **shu mahalliy nusxadan** o'qiladi. Rang ma'lumoti bu javobda yo'q -
> ranglar dizayn tizimi tokenlaridan olingan (`src/app/globals.css`).

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
| 2 | 402 | KPI ustuni (4) \| Interaktiv xarita (10) \| Filtr + Ma'lumotlar (4) |
| 3 | 336 | Qoidabuzarlik + Ma'sul xodim (6) \| Qarzdorlik (4) \| Yo'qotish zarari (4) \| Tezkor (4) |
| 4 | 298 | Iste'mol dinamikasi (6) \| Top podstansiyalar (6) \| Top fiderlar (6) |
| 5 | 209 | Rejalashtirilgan ishlar (8) \| Bajarilgan ishlar (6) \| Hisobotlar (4) |

Jami `1441 + 4*8 = 1473px` - 1064px lik ish maydoniga sig'maydi, sahifa
**vertikal skroll** qilinadi (maketda `Main` balandligi 1699px).

Ustun ichidagi oraliqlar sahifanikidan farq qiladi:

- KPI ustuni (`4179:2`): 196 + **10** + 196
- Qoidabuzarlik + xodim (`4126:497`): 148 + **10** + 178
- Filtr + Ma'lumotlar (`4179:367`): 197 + **8** + 197

## Komponentlar xaritasi

Maketning ko'p qismi fider sahifasidagi kartalarning **aynan o'zi** (hatto KPI
ustunlarining balandliklari ham bir xil massiv). Shu sababli ular
`src/components/feeder/cards/` dan `src/components/cards/` ga ko'chirildi.

| Figma tugun | Karta | Kod |
|---|---|---|
| `4126:134`..`4126:338` | 6 ta KPI | `cards/KpiRow` (o'zgarishsiz) |
| `4179:2` | Podstansiyalar + Fiderlar | `home/cards/HomeKpiStack` (`cards/KpiCard` ustida) |
| `4126:753` | Interaktiv ko'rinish | `cards/InteractiveMapCard` |
| `4179:238` | **Filteratsiya** | `home/cards/FilterCard` (yangi) |
| `4179:497` | **Ma'lumotlar** | `home/cards/DataCard` (yangi) |
| `4126:498` | Qoidabuzarliklar | `cards/ViolationsCard` |
| `4126:525` | Energetika rahbari | `cards/ResponsibleStaffCard` (`title`/`footerLabel` propi) |
| `4126:610` | Qarzdorlik | `cards/DebtCard` |
| `4126:680` | Yo'qotish zarari | `cards/LossDamageCard` |
| `4126:936` | Tezkor ko'rsatgichlar | `cards/QuickMetricsCard` |
| `4126:369` | Iste'mol dinamikasi | `cards/ConsumptionDynamicsCard` |
| `4126:538`, `4220:109` | Eng ko'p sarfga ega ... | `cards/TopBarsCard` (yangi, ikki marta) |
| `4126:1005` | Rejalashtirilgan ishlar | `cards/PlannedWorksCard` |
| `4126:980` | Bajarilgan ishlar | `cards/CompletedWorksCard` |
| `4126:1040` | Hisobotlarni yuklab olish | `cards/DownloadReportsCard` |

## "BarLineChart" o'lchamlari (`4216:57`)

```
BarLineChart  454.67 x 218  (sarlavhadan 16px past: y=48)
  yAxisTop     15px   - qiymat o'qi YUQORIDA
  MainChart   195px   - chapda 59px yorliq ustuni, BarArea 391.67px
  ustun       qator qadamining 40.4% i  ->  nivo `padding = 0.6`
```

Qiymatlar ustun uzunligidan hisoblangan (`uzunlik / 391.67 * max`):

- Podstansiyalar (max 100, qadam 20): Chinobod **47.9**, Baliqchi **71.05**
  (maketda matn sifatida ham yozilgan)
- Fiderlar (max 200, qadam 25): Xaqulobod 47.0, Tovuqxona 18.5, Chinobod 56.8,
  Qiyali 75.6, Maslahat 27.9, Baliqchi 105.7

## Maketdagi kamchiliklar (ataylab chetlanilgan joylar)

1. **`4179:497` "Ma'lumotlar"** - maketda sarlavha va bitta yolg'iz "Chart
   label" (`1,020 mln kWh`) bor, 139px lik tananing qolgani bo'sh. Kod o'sha
   nishonni dizayn tizimidagi legenda ko'rinishida uch qatorga kengaytiradi
   (qiymatlar "Iste'mol dinamikasi" kartasidagi jamlanmalar bilan bir xil).
2. **`4220:172`** - "fiderlar" kartasining pastidagi havola maketda
   "Podstansiyalar sahifasini ochish" deb yozilgan (nusxa ko'chirish izi).
   Havola `/feeders` ga olib borgani uchun matn "Fiderlar sahifasini ochish"
   ga o'zgartirildi.
3. **O'q yorlig'i** - maketda oxirgi bo'linma (`100` / `200`) diagramma o'ng
   chetiga tegib turadi. Nivo uni tik ustida markazlashtirgani uchun o'ng
   chekka 12px qilindi, aks holda yorliqning yarmi kesilardi.

## Tekshirish

`npm run build` dan so'ng 1920x1080 da o'lchangan: 19 ta kartaning ham
x/y/width/height maketga **0.02px** aniqlikda mos (yaxlitlash xatosi).
