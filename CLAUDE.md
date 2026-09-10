@AGENTS.md

# Elektr energiyasi analitik platformasi

Davlat loyihasi. Admin panel: elektr tarmog'i ko'rsatkichlarini tahlil qilish,
ma'lumotlar Excel shablonlari orqali yuklanadi.

**Ishni boshlashdan oldin o'qing:**

- [`.claude/docs/loyiha.md`](.claude/docs/loyiha.md) - loyiha maqsadi, qabul
  qilingan qarorlar, keyingi qadamlar
- [`.claude/docs/domen.md`](.claude/docs/domen.md) - domen lug'ati (ETK, TP,
  fider, yo'qotish) va hisob-kitob formulalari
- [`.claude/docs/shablonlar.md`](.claude/docs/shablonlar.md) - Excel shablon
  tuzilmalari va parser uchun eslatmalar
- [`.claude/docs/hisobotlar.md`](.claude/docs/hisobotlar.md) - PDF/Excel
  hisobot generatorlari va `/api/reports`
- [`.claude/docs/texnologiya.md`](.claude/docs/texnologiya.md) - buyruqlar,
  baza sozlamalari, Prisma 7 nozikliklari

## Asosiy qoidalar

- **UI matni - o'zbekcha, kod qiymatlari - inglizcha.** Batafsil:
  `loyiha.md` dagi "Til qoidasi".
- **`prisma@latest` o'rnatmang** - `latest` teg RC versiyaga ishora qiladi.
  Versiya 7.10.0 da qat'iy.
- **Prisma 7:** ulanish manzili `schema.prisma` da emas, `prisma.config.ts`
  da; `PrismaClient` faqat driver adapter bilan ishlaydi.
- `npm run typecheck` dan oldin `npm run build` kerak (Next.js tiplarini
  generatsiya qiladi).
