# Excel shablonlari

Ma'lumot platformaga **faqat** shu 6 ta shablon orqali kiradi. Namunalar
(bo'sh, faqat sarlavha): [`data_template/`](../../data_template/).

> **Qat'iy qoida (foydalanuvchi qarori, 2026-09-14):** platformada faqat shu
> shablonlardagi ustunlar va ulardan **hisoblangan** qiymatlar (yig'indi, son,
> foiz, oylar orasidagi farq) ko'rsatiladi. Shablonda yo'q ma'lumot (yuklama,
> harorat, telemetriya, holat, telefon, tarif, soatlik/kunlik qatorlar va h.k.)
> o'ylab topilmaydi va ko'rsatilmaydi.

## Umumiy tuzilma

| Qator / joy | Mazmun |
|---|---|
| Varaq nomi | Hisobot sanasi: `13-sentabr, 2026` -> hisobot oyi **2026-09** |
| 1-qator | Birlashtirilgan sarlavha: `Abonentlar Sentabr Holatiga Ko'ra` |
| 2-qator | Ustun sarlavhalari |
| 3-qatordan | Ma'lumot |

- Faqat **birinchi** varaq o'qiladi.
- Sarlavha qatori 1..5-qatorlar orasidan **nom bo'yicha** qidiriladi; ustunlar
  pozitsiya bo'yicha emas, sarlavha matni bo'yicha topiladi. Sarlavhadagi
  `\n`, ortiqcha bo'shliq, apostrof turi va katta-kichik harf farq qilmaydi.
- To'liq bo'sh qatorlar o'tkazib yuboriladi.
- Shablon turi sarlavhalar to'plamidan aniqlanadi (fayl nomidan emas).

Birliklar: **oqim va yo'qotish - kWh**, **pul - so'm**, quvvat - kVA.

---

## 1. `SUBSTATIONS` - Elektr Podstansiyalar.xlsx

| Sarlavha | Maydon | Majburiy | Tur |
|---|---|---|---|
| Podstansiya Nomi | `Substation.name` | ha | matn, fayl ichida noyob |
| Umumiy oqim | `totalKwh` | ha | son ≥ 0 |
| Foydali oqim | `usefulKwh` | ha | son ≥ 0 |
| Yo'qotish | `lossKwh` | ha | son (manfiy mumkin) |
| Manzil | `address` | - | matn |
| Lokatsiya (Lat) | `latitude` | - | -90..90 |
| Lokatsiya (Long) | `longitude` | - | -180..180 |
| Quvvati (KVA) | `capacityKva` | - | son ≥ 0 |
| Ma'sul xodim | `staffId` | - | matn -> `Staff` |

## 2. `FEEDERS` - Elektr Fiderlar.xlsx

| Sarlavha | Maydon | Majburiy | Tur |
|---|---|---|---|
| Podstansiya | -> `Feeder.substationId` | ha | shu oyning podstansiyalarida bo'lishi shart |
| Fider Nomi | `Feeder.name` | ha | podstansiya ichida noyob |
| Umumiy oqim | `totalKwh` | ha | son ≥ 0 |
| Foydali oqim | `usefulKwh` | ha | son ≥ 0 |
| Yo'qotish | `lossKwh` | ha | son |
| Manzil | `address` | - | matn |
| Quvvati (KVA) | `capacityKva` | - | son ≥ 0 |
| Ma'sul xodim | `staffId` | - | matn |

## 3. `TRANSFORMERS` - Elektr Transformatorlar.xlsx (TP)

| Sarlavha | Maydon | Majburiy | Tur |
|---|---|---|---|
| Podstansiya | -> `substationId` | ha | shu oyda bo'lishi shart |
| Fider | -> `feederId` | ha | shu oyda, shu podstansiyada bo'lishi shart |
| TP Nomi | `Transformer.name` | ha | fider ichida noyob; **matn** ("07") |
| Umumiy oqim | `totalKwh` | ha | son ≥ 0 |
| Foydali oqim | `usefulKwh` | ha | son ≥ 0 |
| Yo'qotish | `lossKwh` | ha | son |
| Aloqadagi abonentlar | `onlineSubscribers` | - | butun son ≥ 0, bo'sh = 0 |
| Aloqadan chiqqan abonentlar | `offlineSubscribers` | - | butun son ≥ 0, bo'sh = 0 |
| Manzil | `address` | - | matn |
| Lokatsiya (Lat) / (Long) | `latitude` / `longitude` | - | ikkalasi birga |
| Quvvati (KVA) | `capacityKva` | - | son ≥ 0 |
| Joriy ta'mir sanasi | `currentRepairDate` | - | sana |
| To'la ta'mir sanasi | `overhaulDate` | - | sana |
| Ma'sul xodim | `staffId` | - | matn |

## 4. `SUBSCRIBERS` - Elektr Abonentlar.xlsx

| Sarlavha | Maydon | Majburiy | Tur |
|---|---|---|---|
| FISH | `fullName` | ha | matn |
| Podstansiya / Fider / TP | -> `transformerId` | ha | shu oyning TP'larida bo'lishi shart |
| Abonent turi (Yuridik/Aholi) | `kind` | ha | `Yuridik` / `Aholi` |
| Biriktirilgan xodim | `staffId` | - | matn |
| Holati (Aloqada / Aloqaga chiqmayotgan / Sxemasi o'zgartirilgan) | `meterStatus` | ha | 3 qiymatdan biri |
| Manzil | `address` | - | matn |
| Lokatsiya (Lat) / (Long) | `latitude` / `longitude` | - | ikkalasi birga |
| Shartnoma raqami | `Subscriber.contractNumber` | ha | fayl ichida noyob - **abonent kaliti** |
| Hisoblagich zavod raqami | `meterSerial` | - | matn |
| Hisoblagich turi | `meterType` | - | matn |
| Qarzdorlik | `debtUzs` | - | son ≥ 0, bo'sh = 0 |
| Haqdorlik | `creditUzs` | - | son ≥ 0, bo'sh = 0 |
| Hisoblagich ko'rsatgichi | `meterReading` | - | son ≥ 0 |
| Oxirgi olingan ma'lumot | `lastReadingAt` | - | sana (vaqt bilan bo'lishi mumkin) |
| Oxirgi to'langan to'lov | `lastPaymentDate` | - | sana |
| Oxirgi to'langan summa | `lastPaymentUzs` | - | son ≥ 0 |
| Shartnoma sanasi | `contractDate` | - | sana |
| Passport | `passport` | - | matn, **shaxsiy** |
| Pinfl | `pinfl` | - | matn (raqamdan matnga), **shaxsiy** |
| Hisoblagich o'rnatilingan sana | `meterInstalledAt` | - | sana |

## 5. `VIOLATIONS` - Elektr Qoidabuzarliklar.xlsx

| Sarlavha | Maydon | Majburiy | Tur |
|---|---|---|---|
| Podstansiya | -> `substationId` | - | matn; bir xil raqamli TP larni ajratadi (`malumotlar.md` 4.3d) |
| Fider | -> `feederId` | - | matn; TP topilmasa yozuv shu fider yoki podstansiyaga bog'lanadi |
| TP Nomi | -> `transformerId` (+ fider, podstansiya) | - | matn; topilmasa yozuv baribir saqlanadi (`malumotlar.md` 4.3d) |
| Abonent | `subscriberName` (+ `subscriberId`) | ha | matn |
| Turi (Yuridik/Jismoniy/Aybisiz) | `violatorType` | ha | 3 qiymatdan biri |
| Sana | `date` | ha | sana |
| Manzil | `address` | - | matn |
| Keltirilgan zarar miqdori (UZS) | `damageUzs` | - | son ≥ 0, bo'sh = 0 |
| Taxminiy zarar (kWh) | `damageKwh` | - | son ≥ 0, bo'sh = 0 |
| Ma'sul xodim | `staffId` | - | matn |

## 6. `APPEALS` - Elektr Murojaatlar.xlsx

| Sarlavha | Maydon | Majburiy | Tur |
|---|---|---|---|
| Podstansiya | -> `substationId` | - | matn; bir xil raqamli TP larni ajratadi (`malumotlar.md` 4.3d) |
| Fider | -> `feederId` | - | matn; TP topilmasa yozuv shu fider yoki podstansiyaga bog'lanadi |
| TP Nomi | -> `transformerId` (+ fider, podstansiya) | - | matn; topilmasa yozuv baribir saqlanadi (`malumotlar.md` 4.3d) |
| Murojaat | `text` | ha | matn |
| Abonent | `subscriberName` (+ `subscriberId`) | ha | matn |
| Sana | `date` | ha | sana |
| Manzil | `address` | - | matn |
| Holati (Ijobiy hal etilgan / Rad etilgan / Jarayonda / Muddati buzilgan) | `status` | ha | 4 qiymatdan biri |
| Ma'sul xodim | `staffId` | - | matn |

---

## Katak qiymatlarini o'qish

- **Formula** katagi `{ formula, result }` - `result` olinadi; `result` yo'q
  bo'lsa - **xato**.
- **Son**: `number`, yoki matn `"1 020,60"` / `"1,020.60"` / `"1020.6"`.
  Probel va uzilmas probel olib tashlanadi; faqat vergul bo'lsa - kasr
  ajratuvchi. Tushunib bo'lmasa - xato.
- **Sana**: `Date`, Excel seriya raqami, `13.09.2026`, `13/09/2026`,
  `2026-09-13`, `13-sentabr, 2026` (o'zbekcha va `sentyabr` kabi ruscha
  shakllar). Tushunib bo'lmasa - xato.
- **Matn** katagi `richText` / `hyperlink` bo'lishi mumkin - matni olinadi.
  Son bo'lib kelgan matn (TP nomi `7`, Pinfl) - `String()` ga aylantiriladi.
- **Enum** qiymatlari registr, apostrof va bo'shliqdan qat'i nazar
  solishtiriladi (`Aybsiz` ham `Aybisiz` deb qabul qilinadi).

Validatsiya, bog'lanish va almashtirish qoidalari:
[`malumotlar.md`](./malumotlar.md).
