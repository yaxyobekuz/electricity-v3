# Domen lug'ati - elektr tarmog'i

## Ierarxiya

Excel shablonlaridagi va bazadagi ierarxiya:

```
Tuman (Baliqchi)
 └─ Podstansiya                    "Elektr Podstansiyalar.xlsx"
     └─ Fider (10 kV liniya)       "Elektr Fiderlar.xlsx"
         └─ TP (Transformator)     "Elektr Transformatorlar.xlsx"
             └─ Abonent            "Elektr Abonentlar.xlsx"

TP ga bog'lanadi:  Qoidabuzarlik ("Elektr Qoidabuzarliklar.xlsx")
                   Murojaat       ("Elektr Murojaatlar.xlsx")
```

UI'da TP "Transformator" deb ataladi (`/transformers`). Oldingi sxemadagi ETK
va podstansiya kuch transformatori darajalari shablonlarda yo'q - olib
tashlangan.

## Atamalar

| Atama | Ma'nosi | Kodda |
|---|---|---|
| **Podstansiya** | Kuchlanishni pasaytiruvchi stansiya | `Substation` |
| **Fider** | Podstansiyadan chiquvchi 10 kV liniya | `Feeder` |
| **TP** | Transformator punkti (10/0.4 kV) | `Transformer` |
| **Abonent** | Iste'molchi, shartnoma raqami bilan taniladi | `Subscriber` |
| **Umumiy oqim** | Obyektga kirgan energiya, kWh | `totalKwh` |
| **Foydali oqim** | Iste'molchilarga yetkazilgan (hisobga olingan) energiya, kWh | `usefulKwh` |
| **Yo'qotish** | Umumiy - foydali, kWh (shablonda beriladi) | `lossKwh` |
| **Yo'qotish ulushi** | `lossKwh / totalKwh * 100` | `lossPercent()` |
| **Aloqadagi abonentlar** | Hisoblagichi masofadan o'qiladigan | `onlineSubscribers` |
| **Aloqadan chiqqan abonentlar** | Hisoblagichi aloqaga chiqmayotgan yoki sxemasi o'zgartirilgan | `offlineSubscribers` |
| **Qarzdorlik / Haqdorlik** | Abonentning qarzi / ortiqcha to'lovi, so'm | `debtUzs` / `creditUzs` |
| **Qoidabuzar turi** | Yuridik / Jismoniy / Aybisiz | `ViolatorType` |
| **Murojaat holati** | Ijobiy hal etilgan / Rad etilgan / Jarayonda / Muddati buzilgan | `AppealStatus` |
| **Joriy / To'la ta'mir** | TP ta'mir sanalari; hisobot sanasigacha - bajarilgan | `currentRepairDate` / `overhaulDate` |
| **Hisobot oyi** | Excel varaq nomidagi sana oyi | `Period` |

## Muhim hisob-kitoblar

```
lossPercent        = lossKwh / totalKwh * 100        (totalKwh <= 0 -> yo'q)
yig'ma yo'qotish % = Σ lossKwh / Σ totalKwh * 100    (foizlar o'rtachasi EMAS)
tuman oqimi        = Σ podstansiya oqimlari
abonentlar soni    = Σ TP (aloqadagi + aloqadan chiqqan)
```

Batafsil manba jadvali: [`malumotlar.md`](./malumotlar.md) 5-bo'lim.

## Ehtiyot bo'ling

- **Yo'qotish manfiy bo'lishi mumkin** (foydali oqim umumiydan katta -
  hisoblagich nosozligi yoki noto'g'ri biriktirish). Grafik va halqalar
  manfiy qiymatni ko'tarishi kerak.
- **Podstansiya oqimi uning fiderlari yig'indisiga teng emas** - liniyadagi
  yo'qotishlar bor. Har bir obyekt o'z qiymatini ko'rsatadi.
- **TP nomi - matn.** `07` dagi nol yo'qolmasin; nom faqat fider ichida
  noyob. Qoidabuzarlik va murojaat faqat "TP Nomi" bilan keladi - nom oyda
  bir nechta fiderda bo'lsa, ularni bog'lab bo'lmaydi (import xatosi).
- **Hisoblagich ko'rsatkichi farqi kWh emas** - koeffitsient shablonda yo'q,
  shuning uchun UI'da "Ko'rsatkich farqi" deb yoziladi.
- **Passport va PINFL** - shaxsiy ma'lumot: bazada saqlanadi, UI, qidiruv va
  hisobotlarda ko'rsatilmaydi.
