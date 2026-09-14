# Ma'lumotlar qoidalari

Bu hujjat - **yagona shartnoma**: import nima qabul qiladi, obyektlar qanday
bog'lanadi va har bir sahifadagi har bir son qayerdan olinadi. Maqsad - bir
sahifadagi son boshqa sahifadagi xuddi shu son bilan **hech qachon** farq
qilmasligi.

Shablon ustunlari: [`shablonlar.md`](./shablonlar.md). Sxema:
`prisma/schema.prisma`.

## 1. Asosiy tamoyillar

1. **Faqat shablon ma'lumoti.** Sahifada ko'rinadigan har bir qiymat shablon
   ustunidan yoki undan hisoblangan (yig'indi, son, ulush, oylar farqi,
   sana taqqoslash). O'ylab topilgan, tasodifiy yoki "maketdagi" qiymat
   yo'q. Manbasi yo'q karta/ustun **olib tashlanadi** (bo'sh holat bilan
   niqoblanmaydi).
2. **Bitta ko'rsatkich - bitta manba - bitta funksiya.** Pastdagi 5-bo'lim
   jadvali. Sahifa foizni o'zi hisoblamaydi: `src/lib/domain/metrics.ts` va
   `src/lib/queries/*` dagi funksiyalarni chaqiradi.
3. **Qat'iy import.** Faylda bitta xato bo'lsa ham **butun yuklash rad
   etiladi**, bazaga hech narsa yozilmaydi (foydalanuvchi qarori).
4. **Tanlangan oy.** Barcha sahifalar bitta tanlangan hisobot oyini
   ko'rsatadi (6-bo'lim).

## 2. Hisobot davri (`Period`)

- Varaq nomidagi sana -> `reportDate`; oyning 1-kuni -> `Period.month`.
- `Period.reportDate` = shu oyga muvaffaqiyatli yuklangan fayllardagi eng
  katta `reportDate`. UI da "13-sentabr, 2026 holatiga" shu sanadan.
- Sarlavha qatoridagi oy nomi (`Sentabr Holatiga`) varaq oyi bilan mos
  kelmasa - **ogohlantirish** (xato emas).
- **O'tgan oy** = `month - 1 oy` davri. U bazada bo'lmasa, farq (delta)
  ko'rsatilmaydi - boshqa oy bilan almashtirilmaydi.
- **Dinamika** = tanlangan oy va undan oldingi, qamrovda ma'lumoti bor
  davrlar, eng ko'pi 12 ta, eskidan yangiga.

## 3. Obyektlarni tanish

| Obyekt | Kalit | Izoh |
|---|---|---|
| `Staff` | `nameKey(F.I.Sh.)` | barcha shablonlardagi "Ma'sul xodim" / "Biriktirilgan xodim" |
| `Substation` | `nameKey(nom)` | tuman bo'yicha noyob |
| `Feeder` | `(substationId, nameKey(nom))` | |
| `Transformer` (TP) | `(feederId, nameKey(nom))` | `substationId` ham saqlanadi |
| `Subscriber` | `contractKey(Shartnoma raqami)` | abonent TP ni oydan oyga almashtirishi mumkin (`SubscriberSnapshot.transformerId`) |

- `nameKey` / `contractKey`: `src/lib/domain/normalize.ts`. Solishtirish
  faqat kalit bilan; ko'rsatishda fayldagi asl yozuv (`name`).
- Obyekt yozuvi yaratilgach **o'chirilmaydi** - URL (`/feeders/<id>`) oylar
  davomida o'zgarmaydi. Sahifalar esa faqat tanlangan oyda holati (snapshot)
  bor obyektlarni ro'yxatga oladi.
- Abonent nomi (qoidabuzarlik/murojaatdagi "Abonent") shu oyda shu TP
  abonentlari orasida `nameKey(FISH)` bo'yicha **aynan bitta** topilsa -
  `subscriberId` bog'lanadi; aks holda faqat matn saqlanadi (xato emas:
  qoidabuzar abonent bo'lmasligi mumkin). Bir nechta mos kelsa -
  ogohlantirish.

## 4. Import

### 4.1. Oqim

1. Foydalanuvchi `/imports` sahifasida 1..6 ta fayl tanlaydi.
2. **Tekshirish** (`POST /api/imports` `mode=validate`): fayllar o'qiladi,
   turi aniqlanadi, bog'liqlik tartibida (`TEMPLATE_ORDER`) tekshiriladi.
   Bazaga **hech narsa yozilmaydi**. Natija: har bir fayl uchun tur, oy,
   qatorlar soni, qo'shiladi / yangilanadi / o'chiriladi sonlari, xatolar va
   ogohlantirishlar.
3. Hamma fayl xatosiz bo'lsagina **Saqlash** tugmasi faol. Saqlash
   (`mode=commit`) fayllarni qayta yuboradi (server holat saqlamaydi), server
   **qayta tekshiradi** va bitta tranzaksiyada yozadi.
4. Tranzaksiya boshida `pg_advisory_xact_lock` - bir vaqtda ikki import
   bo'lmaydi.
5. Muvaffaqiyatli bo'lsa har bir fayl uchun `ImportBatch(COMPLETED)`;
   commit bosqichida xato chiqsa - tranzaksiya bekor, har bir fayl uchun
   `ImportBatch(FAILED, errors)` alohida yoziladi. Keyin
   `revalidatePath("/", "layout")`.

### 4.2. Bir submission ichidagi fayllar

- Bir xil shablon bir xil oy uchun ikki marta - xato.
- Fayllar `TEMPLATE_ORDER` bo'yicha tekshiriladi; keyingi fayl oldingi
  fayllarning (hali saqlanmagan) natijasini "bazada bor" deb ko'radi.
- Bitta faylda xato bo'lsa - **hech bir fayl saqlanmaydi**.

### 4.3. Almashtirish

Shablon `T` oy `M` uchun yuklansa, `M` oyning `T` yozuvlari **to'liq**
almashtiriladi: yangi faylda yo'q obyektning `M` oydagi holati o'chiriladi
(`removedRows`). Obyektning o'zi (`Substation` va h.k.) qoladi.

Almashtirish bog'liq ma'lumotni "osilib" qoldirmasligi shart (xato):

| Qayta yuklanayotgan | Yangi faylda bo'lishi shart |
|---|---|
| Podstansiyalar | shu oyda fideri bor har bir podstansiya |
| Fiderlar | shu oyda TP si bor har bir fider |
| Transformatorlar | shu oyda abonenti, qoidabuzarligi yoki murojaati bor har bir TP |

### 4.4. Xatolar (yuklashni rad etadi)

Fayl darajasida:
- shablon turi aniqlanmadi / majburiy sarlavha yo'q;
- varaq nomidan sana o'qilmadi;
- ma'lumot qatori yo'q (faqat `VIOLATIONS` va `APPEALS` bo'sh bo'lishi
  mumkin - "bu oyda yo'q" degani);
- submission ichida takroriy (shablon, oy).

Qator darajasida (`{ row, column, message }`, `row` - Excel qator raqami):
- majburiy katak bo'sh;
- son / sana / enum tushunilmadi; manfiy bo'lishi mumkin bo'lmagan son
  manfiy; butun son kutilgan joyda kasr;
- formula natijasiz;
- Lat/Long faqat bittasi berilgan yoki diapazondan tashqarida;
- fayl ichida takroriy kalit (podstansiya nomi; podstansiya+fider;
  podstansiya+fider+TP; shartnoma raqami);
- ota obyekt **shu oyda** yo'q (fider -> podstansiya, TP -> fider, abonent ->
  TP, qoidabuzarlik/murojaat -> TP);
- "TP Nomi" shu oyda bir nechta fiderda uchraydi (noaniq);
- **abonentlar soni mosligi** (4.5).

### 4.5. TP abonent sonlari = abonentlar ro'yxati

Shu oy uchun `SUBSCRIBERS` yuklangan bo'lsa, har bir TP uchun:

```
onlineSubscribers  == count(abonent, meterStatus = ONLINE)
offlineSubscribers == count(abonent, meterStatus != ONLINE)
```

Tekshiriladi: `SUBSCRIBERS` yuklanganda (shu oyning TP holatlariga nisbatan)
va `TRANSFORMERS` qayta yuklanganda (shu oyda abonent yozuvlari bo'lsa).
Mos kelmasa - xato, xabarda kutilgan va haqiqiy son. Shu qoida tufayli
abonent sonlari TP jadvalidan ham, abonentlar ro'yxatidan ham bir xil chiqadi.

### 4.6. Ogohlantirishlar (rad etmaydi)

- sarlavhadagi oy varaq oyiga mos emas;
- `Umumiy oqim - Foydali oqim` bilan `Yo'qotish` farqi 1 kWh va 0,5% dan
  katta;
- "TP Nomi" tumanda bir nechta fiderda uchraydi (Transformatorlar
  yuklanganda - keyinchalik qoidabuzarlik/murojaatni bog'lab bo'lmaydi);
- qoidabuzarlik/murojaatdagi abonent nomi shu TP da bir nechta abonentga mos.

## 5. Ko'rsatkichlar manbasi (yagona)

Barchasi **tanlangan oy** (`periodId`) bo'yicha. "Qamrov" - tuman, podstansiya,
fider yoki TP (`Scope`).

| Ko'rsatkich | Manba | Qamrovga filtr |
|---|---|---|
| Umumiy / Foydali oqim, Yo'qotish - **tuman** | Σ `SubstationSnapshot` | - |
| ... - podstansiya / fider / TP | shu obyektning **o'z** holati | - |
| Yo'qotish ulushi | `lossPercent(Σ totalKwh, Σ lossKwh)` | foizlar o'rtachasi **olinmaydi** |
| Podstansiyalar soni | count `SubstationSnapshot` | - |
| Fiderlar soni | count `FeederSnapshot` | `feeder.substationId` |
| TP soni | count `TransformerSnapshot` | `transformer.substationId / feederId` |
| Abonentlar: jami / aloqada / aloqadan chiqqan | Σ `TransformerSnapshot.onlineSubscribers / offlineSubscribers` | TP orqali |
| Abonentlar: turi, 3 holat, qarzdorlik, haqdorlik, qarzdorlar soni (`debtUzs > 0`) | `SubscriberSnapshot` | `transformer.*` |
| Qoidabuzarliklar: soni, turi, zarar so'm, zarar kWh | `Violation` | `transformer.*` |
| Murojaatlar: soni, holati | `Appeal` | `transformer.*` |
| Ma'sul xodim (obyekt kartasi) | shu holatning `staffId` | - |
| Xodimlar ro'yxati | shu oy holatlari/yozuvlarida uchragan `staffId` lar | - |
| Ta'mir ishlari | `TransformerSnapshot.currentRepairDate` ("Joriy ta’mir"), `overhaulDate` ("To’la ta’mir") | sana ≤ `Period.reportDate` -> "Bajarilgan", aks holda "Rejalashtirilgan" |
| "O'tgan oy" | xuddi shu funksiya, `month - 1` davri | yo'q bo'lsa - ko'rsatilmaydi |

Muhim:
- Podstansiya oqimi uning fiderlari yig'indisiga teng bo'lishi **shart
  emas** (liniya yo'qotishlari) - har bir obyekt o'z qiymatini ko'rsatadi,
  yig'indi bilan almashtirilmaydi.
- Abonent sonlari uchun TP ustunlari ishlatiladi (4.5 qoida ular
  ro'yxat bilan tengligini kafolatlaydi). Abonentlar fayli shu oyga
  yuklanmagan bo'lsa, faqat ro'yxatga bog'liq bo'laklar (tur, qarzdorlik)
  "Abonentlar ro’yxati yuklanmagan" holatida bo'ladi.
- `lossPercent` `totalKwh <= 0` bo'lsa `null` -> UI da "—".
- Pul/energiya `Decimal` -> so'rov qatlamida `toNumber()`; mijozga faqat
  `number | string | null` boradi.

## 6. Tanlangan oy (UI)

- Cookie `period` = `"2026-09"`. Yo'q yoki bazada bo'lmasa - eng so'nggi davr.
- O'zgartirish - yon paneldagi oy tanlagich (server action cookie qo'yadi,
  sahifa yangilanadi).
- Bazada birorta davr bo'lmasa, ma'lumot sahifalari "Ma’lumot hali
  yuklanmagan" holatini ko'rsatadi va `/imports` ga havola beradi.
- Sahifalar dinamik (cookie o'qiydi) - import'dan keyin darhol yangi
  ma'lumot ko'rinadi.

## 7. Kod qatlamlari

| Qatlam | Joy | Qoida |
|---|---|---|
| Domen | `src/lib/domain/` | `labels.ts`, `normalize.ts`, `metrics.ts` - mijozda ham ishlaydi |
| Format | `src/lib/format.ts` | barcha son/sana matnlari |
| Import | `src/lib/import/` | faqat server |
| Davr | `src/lib/period.ts` | faqat server (`server-only`) |
| So'rovlar | `src/lib/queries/` | faqat server; oddiy (serializable) obyekt qaytaradi |
| Sahifalar | `src/app/**/page.tsx` | async server komponent: so'rov -> props |
| Ko'rinish | `src/components/**` | mijoz komponentlari Prisma'ni import qilmaydi |

## 8. Olib tashlangan (manbasi yo'q)

Yuklama %, harorat, kuchlanish, fazalar, soatlik/kunlik profil, SCADA,
uzilishlar, obyekt holati (Faol/Nosoz/Kritik), obyekt kodlari (PS-01, F-03),
hudud, liniya uzunligi, telefon, rasm, tarif, to'lov usuli, "Budjet" turi,
dalolatnoma raqami va bosqichi, jarima/undirilgan summa, texnik/tijorat
yo'qotish bo'linishi, ish ustuvorligi/holati (ta'mir sanalaridan
tashqari), xodim lavozimi/bo'limi/tajribasi/navbatchiligi, hisobotlar jurnali
va jadvali, profil/xavfsizlik/integratsiya sozlamalari, Monitoring, Tarmoq
holati va Sun'iy intellekt sahifalari.
