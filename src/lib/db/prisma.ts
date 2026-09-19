import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma";

// Prisma 7 driver adapter talab qiladi - ulanish manzili shu yerda beriladi.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL o'rnatilmagan. `.env` faylini tekshiring.");
}

/*
 * Loglar: doim faqat ogohlantirish va xatolar. Har bir SQL so'rovni ko'rish
 * kerak bo'lsa (so'rovni sozlash paytida) - `.env` da `PRISMA_LOG_QUERIES=1`.
 * Dev rejimida Next.js server loglarini brauzer konsoliga ham uzatadi, shuning
 * uchun so'rov logi standart holatda o'chiq.
 */
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log:
      process.env.PRISMA_LOG_QUERIES === "1"
        ? ["query", "warn", "error"]
        : process.env.NODE_ENV === "development"
          ? ["warn", "error"]
          : ["error"],
  });

// Next.js dev rejimida hot reload har safar yangi klient yaratmasligi uchun
// globalThis'da saqlaymiz. Kalit nomi klient sozlamasi o'zgarganda
// almashtiriladi - aks holda ishlab turgan dev server eski klientni ishlataveradi.
const globalForPrisma = globalThis as unknown as {
  prismaClientSubscriberPhotos?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prismaClientSubscriberPhotos ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClientSubscriberPhotos = prisma;
}
