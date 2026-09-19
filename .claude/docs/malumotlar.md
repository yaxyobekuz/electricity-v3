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
   etiladi**, bazaga hech narsa yozilmaydi (foydalanuvchi qarori). Xato -
   faylni o'qib bo'lmaydigan holat (4.4). Fayllar orasidagi nomuvofiqlik
   (ota obyekt ro'yxatda yo'q, TP sonlari farqi, TP aniqlanmadi) -
   **ogohlantirish**: haqiqiy ma'lumot baribir to'liq yuklanadi
   (foydalanuvchi talabi, 2026-09-15).
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

Almashtirish bog'liq ma'lumotni "osilib" qoldirsa - **ogohlantirish**:
obyekt va unga bog'langan yozuvlar qoladi, faqat shu oyda uning holati
(oqim ko'rsatkichlari) bo'lmaydi.

| Yuklanayotgan (birinchi marta yoki qayta) | Yangi faylda bo'lishi kutiladi |
|---|---|
| Podstansiyalar | shu oyda fideri, TP si yoki abonenti bor har bir podstansiya |
| Fiderlar | shu oyda TP si yoki abonenti bor har bir fider |
| Transformatorlar | shu oyda abonenti, qoidabuzarligi yoki murojaati bor har bir TP |

### 4.3a. Ota shablon hali yuklanmagan oy

Shablonlarni oy ichida istalgan tartibda, bo'lib-bo'lib yuklash mumkin
(foydalanuvchi qarori, 2026-09-14: avval Fiderlar va Abonentlar, qolganlari
keyin). Qoida har bir daraja uchun alohida:

- obyekt ota shablon ro'yxatida bo'lmasa, u fayldagi nom bo'yicha
  yaratiladi (holatsiz: oqim, quvvat va boshqa ko'rsatkichlarisiz). Masalan,
  Abonentlar fayli podstansiya, fider va TP obyektlarini yaratadi;
- ota shablon shu oyga **yuklangan** va shu ota obyektning bolalarini o'z
  ichiga olgan bo'lsa (masalan Transformatorlar faylida shu fiderning TP lari
  bor), lekin nom unda yo'q - **ogohlantirish** ("obyekt nomidan
  yaratiladi"). Ota shablon boshqa podstansiya/fiderlarni qamrasa - tekshiruv
  yo'q (qismli yuklash, 5.1);
- ota shablon keyinroq yuklanganda ham shu qoida: shu oyda ishlatilgan, lekin
  faylda yo'q obyekt - ogohlantirish, uning holati bo'lmaydi;
- qoidabuzarlik va murojaatlar - 4.3d.

### 4.3b. Birlashgan fider ("Jo'jaxona/Qiyali")

Abonentlar yoki TP faylida TP ikki fiderdan ta'minlansa, fider `A/B`
ko'rinishida yoziladi. Fiderlar shu oyga yuklangan bo'lsa, qismlaridan
**kamida bittasi** ro'yxatda bo'lishi shart (hech biri bo'lmasa - xato);
ro'yxatda yo'q qismlar ogohlantirishda aytiladi. `A/B` alohida fider obyekti
bo'lib yaratiladi (holatsiz) - uning TP va abonentlari `A` yoki `B` fider
sahifasida emas, podstansiya sahifasida ko'rinadi.

### 4.3c. Qatorning asl nusxasi (`sourceRow`)

Har bir Excel qatorining barcha to'ldirilgan kataklari (shablonda yo'q
ustunlar ham) `sourceRow` JSON ustuniga sarlavha bo'yicha yoziladi:
fayldagi hech bir ma'lumot yo'qolmaydi (foydalanuvchi talabi, 2026-09-14),
platformada ko'rsatilmasa ham. Shablonda yo'q ustun - ogohlantirish, xato
emas. Tozalangan/tuzatilgan qiymatlarning asli `"<Ustun> (manba)"`
ustunlarida keladi.

### 4.3d. Qoidabuzarlik va murojaatni bog'lash

`Violation` / `Appeal` da `transformerId`, `feederId`, `substationId`,
`subscriberId` - hammasi ixtiyoriy. Bog'lash qoidasi bitta
(`src/lib/import/event-links.ts`), tekshirish va saqlash uni birga ishlatadi:

1. "Abonent" shartnoma raqami bo'lsa (shu oy abonentlari, aks holda har
   qanday oydagi eng so'nggi holati) - abonent va uning TP si.
2. "TP Nomi" - shu oy TP lari orasida, shu oyda yo'q bo'lsa bazadagi barcha
   TP lar orasida bitta bo'lsa. Ixtiyoriy "Podstansiya" / "Fider" ustunlari
   berilsa, nomzodlar faqat shu podstansiya / fiderdan (bir xil raqamli TP
   boshqa podstansiyalarda ham bor). Berilmasa va "Ma'sul xodim" shu oyda
   podstansiya ma'sul xodimi bo'lsa - nomzodlar faqat uning
   podstansiya(lar)idan. Bir nechta nomzoddan abonentning TP si olinadi.
   "TP Nomi" abonentning TP sidan boshqa TP ni aniq ko'rsatsa - "TP Nomi"
   olinadi (ogohlantirish).
3. TP topilmasa - "Podstansiya" / "Fider" bazada bo'lsa, shu fider (va uning
   podstansiyasi) yoki faqat podstansiya; ular berilmagan bo'lsa -
   "Ma'sul xodim" aynan bitta podstansiyaning xodimi bo'lsa, shu podstansiya.
4. Hech biri - yozuv bog'lanmaydi, lekin saqlanadi va tuman sonlariga kiradi.

"Podstansiya", "Fider" va "TP Nomi" ustunlari ixtiyoriy. TP bilan birga
uning fideri va podstansiyasi ham yoziladi - qamrov filtrlari shu
ustunlardan (`eventScopeWhere`).
Abonentlar, Transformatorlar yoki Podstansiyalar yuklansa, **barcha oylardagi**
qoidabuzarlik va murojaatlar qayta bog'lanadi (bog'lash boshqa oylar
abonentlari va TP laridan ham foydalanadi) - shablonlarni istalgan tartibda
yuklash mumkin.

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
  podstansiya+fider+TP; shartnoma raqami).

Fayllar orasidagi bog'liqlik (ota obyekt, TP sonlari, TP aniqlanishi) xato
emas - 4.6.

### 4.5. TP abonent sonlari va abonentlar ro'yxati

Shu oy uchun `SUBSCRIBERS` va `TRANSFORMERS` ikkalasi bo'lsa, har bir TP
uchun solishtiriladi:

```
onlineSubscribers  == count(abonent, meterStatus = ONLINE)
offlineSubscribers == count(abonent, meterStatus != ONLINE)
```

Real fayllar turli tizimlardan keladi va sonlar deyarli hech qachon mos
kelmaydi (Baliqchi, 2026-09: 368 TP dan 331 tasida farq). Shuning uchun mos
kelmasa - bitta umumlashgan **ogohlantirish** (farqli TP lar soni va
misollar). Platformada abonent soni ro'yxatdan olinadi (5-bo'lim); TP
faylidagi sonlar faqat ro'yxat qamramagan podstansiyada ishlatiladi.

### 4.6. Ogohlantirishlar (rad etmaydi)

- sarlavhadagi oy varaq oyiga mos emas;
- `Umumiy oqim - Foydali oqim` bilan `Yo'qotish` farqi 1 kWh va 0,5% dan
  katta;
- shablonda yo'q ustun (4.3c);
- ota ro'yxatida yo'q obyekt nomidan yaratildi; birlashgan fider (4.3a, 4.3b);
- qayta yuklangan faylda yo'q, lekin shu oyda bolalari bor obyekt (4.3);
- TP abonent sonlari ro'yxatdan farq qiladi (4.5);
- "TP Nomi" tumanda bir nechta fiderda uchraydi;
- qoidabuzarlik/murojaat: "TP Nomi" noaniq yoki abonentning TP sidan farq
  qiladi, TP aniqlanmagan yozuvlar soni (4.3d); abonent nomi shu TP da bir
  nechta abonentga mos.

## 5. Ko'rsatkichlar manbasi (yagona)

Barchasi **tanlangan oy** (`periodId`) bo'yicha. "Qamrov" - tuman, podstansiya,
fider yoki TP (`Scope`).

| Ko'rsatkich | Manba | Qamrovga filtr |
|---|---|---|
| Umumiy / Foydali oqim, Yo'qotish - **tuman** | Σ `SubstationSnapshot` | - |
| ... - podstansiya / fider / TP | shu obyektning **o'z** holati | - |
| Yo'qotish ulushi | `lossPercent(Σ totalKwh, Σ lossKwh)` | foizlar o'rtachasi **olinmaydi** |
| Podstansiyalar soni | count `SubstationSnapshot` | - |
| Fiderlar soni | count `FeederSnapshot`; podstansiya Fiderlar bilan qamralmagan - null (5.1) | `feeder.substationId` |
| TP soni | count `TransformerSnapshot`; podstansiya Transformatorlar bilan qamralmagan - null (5.1) | `transformer.substationId / feederId` |
| Abonentlar: jami / aloqada / aloqadan chiqqan | podstansiya bo'yicha (`subscriberSource`): abonentlar ro'yxati bilan qamralgan - `SubscriberSnapshot` (aloqada = "Aloqada"); aks holda Transformatorlar bilan qamralgan - Σ `TransformerSnapshot.onlineSubscribers / offlineSubscribers`; tuman - podstansiyalar yig'indisi | TP orqali |
| Abonentlar: turi, 3 holat, qarzdorlik, haqdorlik, qarzdorlar soni (`debtUzs > 0`) | `SubscriberSnapshot` | `transformer.*` |
| Qoidabuzarliklar: soni, turi, zarar so'm, zarar kWh | `Violation` | yozuvning o'z `substationId / feederId / transformerId` (4.3d) |
| Murojaatlar: soni, holati | `Appeal` | yozuvning o'z `substationId / feederId / transformerId` (4.3d) |
| Ma'sul xodim (obyekt kartasi) | shu holatning `staffId` | - |
| Xodimlar ro'yxati | shu oy holatlari/yozuvlarida uchragan `staffId` lar | - |
| Ta'mir ishlari | `TransformerSnapshot.currentRepairDate` ("Joriy ta’mir"), `overhaulDate` ("To’la ta’mir") | sana ≤ `Period.reportDate` -> "Bajarilgan", aks holda "Rejalashtirilgan" |
| "O'tgan oy" | xuddi shu funksiya, `month - 1` davri | yo'q bo'lsa - ko'rsatilmaydi |

Muhim:
- Podstansiya oqimi uning fiderlari yig'indisiga teng bo'lishi **shart
  emas** (liniya yo'qotishlari) - har bir obyekt o'z qiymatini ko'rsatadi,
  yig'indi bilan almashtirilmaydi.
- Abonent sonlari uchun ro'yxat ustun: u abonentlar reestri bilan bir xil
  son beradi. TP faylidagi sonlar ro'yxatdan farq qiladi (4.5), shuning
  uchun ular faqat ro'yxat qamramagan podstansiyada ishlatiladi. Ro'yxat
  qamramagan qamrovda ro'yxatga bog'liq bo'laklar (tur, qarzdorlik)
  "Abonentlar ro’yxati yuklanmagan" holatida bo'ladi.
- `lossPercent` `totalKwh <= 0` bo'lsa `null` -> UI da "—".
- Pul/energiya `Decimal` -> so'rov qatlamida `toNumber()`; mijozga faqat
  `number | string | null` boradi.

### 5.1. Qismli yuklash (qamrov)

Shablon oyga yuklangan bo'lsa ham, u ayrim podstansiyalarnigina qamrashi
mumkin: real ma'lumot podstansiya guruhlari bo'yicha keladi (2026-09:
Fiderlar - Chinobod va Qo'shtepasaroy, Transformatorlar - Baliqchi va
O'rmonbek). Podstansiya shablon `T` bilan **qamralgan** - shu oyda `T` ning
shu podstansiyaga tegishli kamida bitta qatori bor (`coverageMany`,
`src/lib/queries/scope.ts`). Tekshiriladigan shablonlar: Podstansiyalar,
Fiderlar, Transformatorlar, Abonentlar.

- Tuman qamrovida "yuklangan" - oy darajasida (`ImportBatch`).
- Podstansiya / fider / TP qamrovida `ScopeSummary.uploads` =
  `coveredUploads`: shablon oyga yuklangan **va** qamrov podstansiyasini
  qamragan. Qamralmagan bo'lsa sahifa "0 ta" emas, "yuklanmagan" / "—"
  ko'rsatadi. Ro'yxat qatorlaridagi sonlar ham shu qoida bilan
  (`listSubstations`, `listFeeders`).
- Qoidabuzarlik va murojaatlar oy darajasida qoladi: podstansiyada ularning
  yo'qligi haqiqiy "0".
- Σ podstansiya qatorlari (null lardan tashqari) = tuman soni.

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
