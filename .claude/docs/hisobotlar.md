# Hisobotlarni yuklab olish

Fider sahifasidagi "Hisobotlarni yuklab olish" kartasi tayyor faylni serverdan
oladi. Karta davrni tanlaydi, format tugmasi esa oddiy `<a download>` havolasi -
brauzer `Content-Disposition: attachment` sababli sahifani almashtirmay yuklaydi.

## Manzil

```
GET /api/reports?period=<daily|weekly|monthly|yearly>&format=<pdf|xlsx>
```

Noto'g'ri `period` yoki `format` - `400`. Javob `Cache-Control: no-store`,
chunki hisobot har safar joriy sana bilan shakllanadi.

## Fayllar

| Fayl | Vazifasi |
|---|---|
| `src/lib/reports/types.ts` | hisobot modeli (PDF va Excel uchun yagona manba) |
| `src/lib/reports/demo.ts` | **namunaviy** ma'lumot + O'zbekcha son/sana formati |
| `src/lib/reports/pdf-writer.ts` | kichik PDF yozuvchi (to'rtburchak, chiziq, matn) |
| `src/lib/reports/pdf.ts` | A4 maketi: sarlavha, KPI kartalari, diagramma, jadvallar |
| `src/lib/reports/excel.ts` | `exceljs` bilan 3 varaqli kitob |
| `src/app/api/reports/route.ts` | route handler |

## Nega PDF kutubxonasi yo'q

Kerak bo'lgani - to'rtburchak, chiziq va Helvetica matn. Shu tor vazifa uchun
`pdfkit`/`jspdf` ni server bundle'iga qo'shish (va ularning `.afm` font
fayllarini Turbopack bilan kelishtirish) asossiz qimmat edi. `pdf-writer.ts`
~250 qator va hech qanday bog'liqligi yo'q.

Matn **WinAnsi** kodlashda: o'zbekcha tipografik apostrof (`’`, U+2019) `0x92`
ga o'giriladi, qolgan harflar ASCII. Shrift enlari Adobe AFM jadvalidan -
ular faqat markazlash/o'ngga tekislash hisob-kitobi uchun kerak.

## Mazmun

1. Brend sarlavhasi - davr, mas'ul xodim, shakllantirilgan vaqt
2. Umumiy ko'rsatkichlar - 6 ta rangli karta (hisoblangan, iste'mol,
   yo'qotish, yo'qotish ulushi, abonentlar, qarzdorlik)
3. Iste'mol dinamikasi - ustunli diagramma (yashil = iste'mol, qizil =
   yo'qotish) va to'liq jadval + "Jami" qatori
4. Transformatorlar kesimi
5. Qoidabuzarliklar
6. Ishlar
7. Imzo maydonlari

Davrga qarab nuqtalar soni: kunlik 24 (soatlik), haftalik 7, oylik 30,
yillik 12. Jadval sahifaga sig'masa - sarlavha qatori takrorlanadi.

## Excel farqi

Sonlar **haqiqiy raqam** (matn emas) va `#,##0.0` formatida, shuning uchun
foydalanuvchi ustunlarni yig'ishi mumkin. Dinamika jadvalida sarlavha qatori
muzlatilgan va avtofiltr yoqilgan. 3 ta varaq: `Hisobot`,
`Transformatorlar`, `Qoidabuzarlik va ishlar`.

## Bazaga ulanganda

`route.ts` dagi `buildDemoReport(period, new Date())` chaqiruvi haqiqiy
so'rov bilan almashtiriladi. Fayl generatorlari `FeederReport` modelidan
boshqa hech narsani bilmaydi, shuning uchun ular o'zgarmaydi.
