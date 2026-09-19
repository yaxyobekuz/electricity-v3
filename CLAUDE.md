@AGENTS.md

# Elektr energiyasi analitik platformasi

Davlat loyihasi. Admin panel: elektr tarmog'i ko'rsatkichlarini tahlil qilish,
ma'lumotlar Excel shablonlari orqali yuklanadi.

**Ishni boshlashdan oldin o'qing:**

- [`.claude/docs/loyiha.md`](.claude/docs/loyiha.md) - loyiha maqsadi, qabul
  qilingan qarorlar, keyingi qadamlar
- [`.claude/docs/domen.md`](.claude/docs/domen.md) - domen lug'ati (ETK, TP,
  fider, yo'qotish) va hisob-kitob formulalari
- [`.claude/docs/shablonlar.md`](.claude/docs/shablonlar.md) - 6 ta Excel
  shablon ustunlari va katak o'qish qoidalari
- [`.claude/docs/malumotlar.md`](.claude/docs/malumotlar.md) - **yagona
  shartnoma**: import validatsiyasi, obyektlarni tanish, davr, har bir
  ko'rsatkich manbasi
- [`.claude/docs/hisobotlar.md`](.claude/docs/hisobotlar.md) - PDF/Excel
  hisobot generatorlari va `/api/reports`
- [`.claude/docs/texnologiya.md`](.claude/docs/texnologiya.md) - buyruqlar,
  baza sozlamalari, Prisma 7 nozikliklari

## Asosiy qoidalar

- **Faqat Excel shablonidagi ma'lumot.** Shablonda yo'q qiymat (yuklama,
  harorat, holat, telefon...) o'ylab topilmaydi va ko'rsatilmaydi. Har bir
  son `src/lib/queries/*` orqali bazadan olinadi - `malumotlar.md` 5-bo'lim.
  Yagona istisno - abonent sahifasidan qo'lda yuklanadigan abonent va
  hisoblagich rasmlari (`malumotlar.md` 5.2).
- **UI matni - o'zbekcha, kod qiymatlari - inglizcha.** Batafsil:
  `loyiha.md` dagi "Til qoidasi".
- **`prisma@latest` o'rnatmang** - `latest` teg RC versiyaga ishora qiladi.
  Versiya 7.10.0 da qat'iy.
- **Prisma 7:** ulanish manzili `schema.prisma` da emas, `prisma.config.ts`
  da; `PrismaClient` faqat driver adapter bilan ishlaydi.
- `npm run typecheck` dan oldin `npm run build` kerak (Next.js tiplarini
  generatsiya qiladi).
