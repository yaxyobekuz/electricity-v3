# Loyiha haqida

> Bu fayl kelgusi sessiyalarda kontekstni tez tiklash uchun. Foydalanuvchi
> aytgan qarorlar shu yerda qayd etiladi.

## Nima quriladi

Elektr energiyasi bo'yicha **davlat loyihasi** - veb platforma.

Asosiy qism - **admin panel**:

1. **Ma'lumotlar tahlili** - elektr tarmog'i bo'yicha iste'mol, yo'qotish va
   hisoblagich ko'rsatkichlarini kuzatish, ko'rsatkichlarni kesimlar bo'yicha
   tahlil qilish.
2. **Shablon orqali yuklash** - ma'lumotlar qo'lda kiritilmaydi, **maxsus
   Excel shablonlari** asosida yuklanadi. Shablon tuzilmasi
   [`shablonlar.md`](./shablonlar.md) da.

## Qabul qilingan qarorlar

| Mavzu | Qaror | Sana |
|---|---|---|
| Texnologiyalar | Next.js + TypeScript + Tailwind CSS + Prisma + PostgreSQL | 2026-09-05 |
| Ma'lumotlar bazasi | Lokal PostgreSQL (Postgres.app), baza nomi `electricity_v3` | 2026-09-05 |
| Til | **Faqat o'zbek tili.** Ko'p tillilik (i18n) qo'shilmaydi | 2026-09-05 |
| Ma'lumot kiritish | Faqat Excel shablon orqali import | 2026-09-05 |
| Mavzu (theme) | **Faqat oq (light).** Tungi mavzu keyinroq qo'shilishi mumkin | 2026-09-05 |
| UI maketi | Figma `73vcnX4vOx0MnLcnecVFo3` - fider `4029:930`, xarita `3947:166` | 2026-09-09 |
| Grafiklar | `@nivo/*` (line, bar, radial-bar, pie) | 2026-09-09 |
| Ikonkalar | `lucide-react`; chiziq `36/size` (maketda 1.5px absolyut) | 2026-09-09 |
| Xarita | Google Maps JS API + custom OverlayView markerlar | 2026-09-09 |
| Maket nusxasi | Figma MCP kvotasi tugagach `.claude/figma/` ga eksport qilindi | 2026-09-09 |

## Til qoidasi

- **UI matni** (foydalanuvchi ko'radigan hamma narsa) - **o'zbekcha**.
- **Kod qiymatlari** (`id`, `role`, `key`, `route`, fayl nomlari) - **inglizcha**.
- Xato xabarlari foydalanuvchiga - o'zbekcha; logger developerga - inglizcha.
- Sana UI'da `12-noyabr 2026`, API'da ISO (`2026-11-12`).

## Oldingi versiyalar

- `~/Desktop/electricity` - **BEAP** (Baliqchi tumani Elektr energiya Analitik
  Platformasi). Monorepo: Fastify API + Vite/React web + Telegram bot, xom SQL
  migratsiyalar, baza `elektr_dev`. Shu yerda **haqiqiy Excel shablonlari**
  (`xaqulobod_*.xlsx`) va domen mantiqi bor - namuna sifatida foydali.
- `electricity_db` bazasi - Prisma'li oldingi urinish, ichida real ma'lumot
  bor (143 TP, 143 TP o'qish, 22 fider o'qishi). **Tegmang** - v3 alohida
  `electricity_v3` bazasida ishlaydi.

## Keyingi qadamlar

- [ ] Autentifikatsiya (admin / operator / ko'ruvchi rollari)
- [ ] Excel shablon parseri (`exceljs` o'rnatilgan)
- [ ] Import oqimi: yuklash -> tekshirish -> oldindan ko'rish -> tasdiqlash
- [ ] Analitik dashboard (KPI, yo'qotish dinamikasi, TP reytingi)
- [ ] TP / fider / podstansiya ma'lumotnomalari (CRUD)
- [ ] Tungi mavzu (ixtiyoriy, keyinroq) - `src/app/globals.css` dagi izohga qarang
