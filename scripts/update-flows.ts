/*
 * TP oqim ko'rsatkichlarini (Umumiy / Foydali / Yo'qotish) transformator
 * fayllaridan yangilash va fider / podstansiya yig'indilarini qayta hisoblash.
 *
 *   npx tsx scripts/update-flows.ts [--commit] <fayl...>
 *
 * `--commit` bo'lmasa - faqat hisobot chiqaradi, bazaga yozilmaydi.
 *
 * Fayl tuzilishi: har bir oy alohida varaqda ("012026" … "082026"),
 * 2-qator - sarlavha. Fayldan FAQAT to'rtta ustun olinadi:
 *
 *   "TP Nomi", "Umumiy oqim", "Foydali oqim", "Yo’qotish"
 *
 * "Podstansiya" va "Fider" ustunlari faqat bir xil raqamli TP larni ajratish
 * uchun ishlatiladi (quyida), ular bazaga yozilmaydi.
 *
 * Qoidalar (foydalanuvchi talabi, 2026-09-21):
 *
 *   1. TP ning boshqa ma'lumotlari (abonent soni, manzil, quvvat, ta'mir
 *      sanalari, xodim) TEGILMAYDI - faqat uch oqim ustuni yangilanadi.
 *   2. Faylda yo'q TP ning shu oydagi holati O'CHIRILADI - fayl so'nggi
 *      ma'lumot, eskisida ortiqcha TP lar bo'lgan.
 *   3. Keyin fider va podstansiya holatlari TP lar yig'indisidan qayta
 *      hisoblanadi.
 *
 * TP ni topish: fayldagi "Podstansiya" ustuni ishonchsiz (Chinobod varag'ida
 * Qo'shtepasaroy va Oltinko'l fiderlari ham "Чинобод" deb yozilgan),
 * shuning uchun tartib bilan:
 *
 *   1. podstansiya + fider + TP nomi;
 *   2. fider + TP nomi;
 *   3. podstansiya + TP nomi;
 *   4. TP nomi bazada yagona bo'lsa - o'sha.
 *
 * Shundan keyin ham topilmasa, fayldagi podstansiya va fider bazada bor
 * bo'lsa, TP o'sha fider ostida YARATILADI (fayl so'nggi ma'lumot, bazada
 * hali bo'lmagan TP bo'lishi mumkin).
 *
 * Nom solishtirish kirill/lotin, apostrof, bo'shliq va "NS."/"F." old
 * qo'shimchalarini hisobga oladi (`substationName`, `feederName`, `tpKey`).
 */
import { config } from "dotenv";

config();

import ExcelJS from "exceljs";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const HEADER_ROW = 2;
const COL_SUBSTATION = "Podstansiya";
const COL_FEEDER = "Fider";
const COL_TP = "TP Nomi";
const COL_TOTAL = "Umumiy oqim";
const COL_USEFUL = "Foydali oqim";
const COL_LOSS = "Yo’qotish";

/** Varaq nomi "MMYYYY" -> oy kaliti "YYYY-MM". */
const SHEET_NAME = /^(\d{2})(\d{4})$/;

/** `update-debts.ts` podstansiyasi aniqlanmagan TP larni shu yerga qo'ygan. */
const UNKNOWN_SUBSTATION = "Podstansiya aniqlanmagan";

interface FlowRow {
  readonly file: string;
  readonly sheet: string;
  readonly row: number;
  readonly substation: string;
  readonly feeder: string;
  readonly transformer: string;
  readonly totalKwh: number;
  readonly usefulKwh: number;
  readonly lossKwh: number;
}

/* ---------------------------------------------------------------------------
   Nom solishtirish
   --------------------------------------------------------------------------- */

const CYRILLIC: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
};

function latin(value: string): string {
  return value
    .split("")
    .map((char) => {
      const lower = char.toLowerCase();
      const mapped = CYRILLIC[lower];
      if (mapped == null) return char;
      return char === lower ? mapped : mapped.toUpperCase();
    })
    .join("");
}

/**
 * Bir xil nomning turli yozuvlari: "Куштепасарой" / "Qo'shtepasaroy",
 * "Gurovon" / "Go'ravon" - kirilldan o'girilganda ham farq qoladi.
 */
const NAME_ALIASES: Record<string, string> = {
  kushtepasaroy: "qoshtepasaroy",
  gurovon: "goravon",
};

/** Solishtirish kaliti: lotin, apostrofsiz, faqat harf va raqam. */
function key(value: string): string {
  const folded = latin(value)
    .toLowerCase()
    .replace(/['’‘`ʻʼ]/g, "")
    .replace(/[^a-z0-9]/g, "");
  return NAME_ALIASES[folded] ?? folded;
}

/** "NS.Baliqchi" -> "Baliqchi"; "Чинобод-110/35-10 кВ" -> "Chinobod". */
function substationName(raw: string): string {
  return latin(raw)
    .replace(/^NS[.,]\s*/i, "")
    .replace(/[\s-]*\d+(\s*[/-]\s*\d+)*\s*(kv|кв)\s*$/i, "")
    .trim();
}

/** "F.Jo'jaxona" -> "Jo'jaxona". */
function feederName(raw: string): string {
  return latin(raw).replace(/^F[.,]\s*/i, "").trim();
}

/**
 * TP nomi kaliti. Kirill va lotin "А/A", "В/B" va h.k. bir xil ko'rinadi,
 * "48 A" / "48A" / "48-A" ham bir xil TP.
 */
function tpKey(value: string): string {
  return value
    .normalize("NFC")
    .toUpperCase()
    .replace(/[АA]/g, "A")
    .replace(/[ВB]/g, "B")
    .replace(/[СC]/g, "C")
    .replace(/[ЕE]/g, "E")
    .replace(/[НH]/g, "H")
    .replace(/[КK]/g, "K")
    .replace(/[МM]/g, "M")
    .replace(/[ОO]/g, "O")
    .replace(/[РP]/g, "P")
    .replace(/[ТT]/g, "T")
    .replace(/[ХX]/g, "X")
    .replace(/[УY]/g, "Y")
    .replace(/[\s\-_.]/g, "");
}

/* ---------------------------------------------------------------------------
   Faylni o'qish
   --------------------------------------------------------------------------- */

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("result" in value) return String(value.result ?? "");
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value) return String(value.text);
  }
  return String(value);
}

/** Son katagi; bo'sh yoki hisoblanmagan formula - null. */
function numberOrNull(value: ExcelJS.CellValue): number | null {
  const text = cellText(value).replace(/\s/g, "").replace(",", ".");
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readFile(path: string): Promise<Map<string, FlowRow[]>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const byMonth = new Map<string, FlowRow[]>();

  for (const sheet of workbook.worksheets) {
    const match = SHEET_NAME.exec(sheet.name.trim());
    if (!match) throw new Error(`${path}: varaq nomidan oy o'qilmadi: “${sheet.name}”`);
    const month = `${match[2]}-${match[1]}`;

    const header = sheet.getRow(HEADER_ROW);
    const columns = new Map<string, number>();
    for (let c = 1; c <= sheet.columnCount; c++) {
      // Sarlavhada satr uzilishi bor ("Umumiy oqim\n").
      const name = cellText(header.getCell(c).value).replace(/\s+/g, " ").trim();
      if (name && !columns.has(name)) columns.set(name, c);
    }
    for (const name of [COL_TP, COL_TOTAL, COL_USEFUL, COL_LOSS]) {
      if (!columns.has(name)) throw new Error(`${path} / ${sheet.name}: “${name}” ustuni yo'q`);
    }
    const at = (row: ExcelJS.Row, name: string) => {
      const index = columns.get(name);
      return index == null ? "" : cellText(row.getCell(index).value).trim();
    };
    const numberAt = (row: ExcelJS.Row, name: string) => {
      const index = columns.get(name);
      return index == null ? null : numberOrNull(row.getCell(index).value);
    };

    const rows: FlowRow[] = [];
    for (let r = HEADER_ROW + 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const transformer = at(row, COL_TP);
      if (!transformer) continue;

      const totalKwh = numberAt(row, COL_TOTAL) ?? 0;
      const usefulKwh = numberAt(row, COL_USEFUL) ?? 0;
      // "Yo'qotish" ustuni ko'pincha hisoblanmagan formula (=D-E) - o'sha
      // formulaning o'zini qo'llaymiz.
      const lossKwh = numberAt(row, COL_LOSS) ?? totalKwh - usefulKwh;

      rows.push({
        file: path,
        sheet: sheet.name,
        row: r,
        substation: at(row, COL_SUBSTATION),
        feeder: at(row, COL_FEEDER),
        transformer,
        totalKwh,
        usefulKwh,
        lossKwh,
      });
    }
    byMonth.set(month, [...(byMonth.get(month) ?? []), ...rows]);
  }
  return byMonth;
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const paths = args.filter((arg) => !arg.startsWith("--"));
  if (paths.length === 0) {
    console.error("Fayl ko'rsatilmadi: npx tsx scripts/update-flows.ts [--commit] <fayl...>");
    process.exitCode = 1;
    return;
  }

  const byMonth = new Map<string, FlowRow[]>();
  for (const path of paths) {
    for (const [month, rows] of await readFile(path)) {
      byMonth.set(month, [...(byMonth.get(month) ?? []), ...rows]);
    }
  }
  const months = [...byMonth.keys()].sort();
  console.log(
    `Fayllardan o'qildi: ${months.length} oy (${months[0]} … ${months.at(-1)}),` +
      ` jami ${[...byMonth.values()].reduce((sum, rows) => sum + rows.length, 0)} qator`,
  );

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const transformers = await prisma.transformer.findMany({
      include: { substation: { select: { name: true } }, feeder: { select: { name: true } } },
    });
    const byTpKey = new Map<string, typeof transformers>();
    for (const tp of transformers) {
      const k = tpKey(tp.name);
      byTpKey.set(k, [...(byTpKey.get(k) ?? []), tp]);
    }

    /** Fayl qatori -> bazadagi TP (yuqoridagi 4 bosqich). */
    function resolve(row: FlowRow): (typeof transformers)[number] | null {
      const candidates = byTpKey.get(tpKey(row.transformer)) ?? [];
      if (candidates.length === 0) return null;
      const substation = key(substationName(row.substation));
      const feeder = key(feederName(row.feeder));
      const pick = (list: typeof transformers) => (list.length === 1 ? list[0] : null);
      /*
       * Fayl fiderni aytgan bo'lsa, nomi bir xil boshqa fiderdagi TP ga
       * tushib qolmaslik kerak: tumanda bir xil raqamli TP bir nechta
       * fiderda bor ("98" O'rmonbek/Jasorat va Chinobod/Kamoliy da).
       * Shuning uchun nom bo'yicha yagona moslik faqat fider berilmaganda
       * (qo'lda qo'shilgan, ustunlari bo'sh blok) ishlatiladi.
       */
      const hasParents = Boolean(row.substation.trim() && row.feeder.trim());
      if (hasParents) {
        return (
          pick(candidates.filter((t) => key(t.substation.name) === substation && key(t.feeder.name) === feeder)) ??
          pick(candidates.filter((t) => key(t.feeder.name) === feeder)) ??
          pick(candidates.filter((t) => key(t.substation.name) === substation)) ??
          null
        );
      }
      /*
       * Ustunlari bo'sh blok: haqiqiy podstansiyaga biriktirilgan TP
       * ustun - "Podstansiya aniqlanmagan" dagi vaqtinchalik nusxa emas
       * (`update-debts.ts` yaratgan).
       */
      const real = candidates.filter((t) => key(t.substation.name) !== key(UNKNOWN_SUBSTATION));
      return pick(real) ?? pick(candidates);
    }

    // 5-bosqich uchun: fayldagi podstansiya/fider nomi -> bazadagi fider.
    const feeders = await prisma.feeder.findMany({
      include: { substation: { select: { name: true } } },
    });
    const feederByNames = new Map(
      feeders.map((feeder) => [`${key(feeder.substation.name)}|${key(feeder.name)}`, feeder]),
    );

    const periods = await prisma.period.findMany({ orderBy: { month: "asc" } });
    const periodByMonth = new Map(periods.map((p) => [p.month.toISOString().slice(0, 7), p]));

    /*
     * 5-bosqich: bazada yo'q, lekin fayldagi fider bazada bor TP lar. Ular
     * barcha oylarda bir xil, shuning uchun bir marta - rejadan oldin -
     * yaratiladi va `byTpKey` ga qo'shiladi.
     */
    const toCreate = new Map<string, { feederId: string; substationId: string; name: string; label: string }>();
    const orphans: FlowRow[] = [];
    for (const rows of byMonth.values()) {
      for (const row of rows) {
        if (resolve(row)) continue;
        // Podstansiya/fider ustuni bo'sh qator (qo'lda qo'shilgan blok) TP ni
        // qayerga yaratishni aytmaydi - boshqa oyda to'ldirilgan bo'lishi
        // mumkin, shuning uchun bu yerda o'tkazib yuboriladi.
        if (!row.substation.trim() || !row.feeder.trim()) continue;
        const feeder = feederByNames.get(`${key(substationName(row.substation))}|${key(feederName(row.feeder))}`);
        if (!feeder) {
          if (!orphans.some((item) => tpKey(item.transformer) === tpKey(row.transformer))) orphans.push(row);
          continue;
        }
        const uniqueKey = `${feeder.id}|${tpKey(row.transformer)}`;
        if (!toCreate.has(uniqueKey)) {
          toCreate.set(uniqueKey, {
            feederId: feeder.id,
            substationId: feeder.substationId,
            name: row.transformer,
            label: `${feeder.substation.name} / ${feeder.name} / ${row.transformer}`,
          });
        }
      }
    }

    if (toCreate.size > 0) {
      console.log(`\nBazada yo'q, fayldagi fider ostida yaratiladigan TP: ${toCreate.size}`);
      for (const item of [...toCreate.values()].slice(0, 6)) console.log(`   - ${item.label}`);
      if (toCreate.size > 6) console.log(`   ... va yana ${toCreate.size - 6} ta`);
      if (commit) {
        await prisma.transformer.createMany({
          data: [...toCreate.values()].map((item) => ({
            substationId: item.substationId,
            feederId: item.feederId,
            name: item.name,
            nameKey: item.name.toLowerCase(),
          })),
          skipDuplicates: true,
        });
        // Yangi TP lar `resolve` uchun ko'rinishi kerak.
        const fresh = await prisma.transformer.findMany({
          where: { feederId: { in: [...new Set([...toCreate.values()].map((item) => item.feederId))] } },
          include: { substation: { select: { name: true } }, feeder: { select: { name: true } } },
        });
        for (const tp of fresh) {
          const k = tpKey(tp.name);
          const list = byTpKey.get(k) ?? [];
          if (!list.some((item) => item.id === tp.id)) byTpKey.set(k, [...list, tp]);
        }
      }
    }
    if (orphans.length > 0) {
      console.log(`\nFideri ham bazada yo'q - o'tkazib yuboriladi: ${orphans.length}`);
      for (const row of orphans.slice(0, 5)) {
        console.log(`   - “${row.transformer}” (${row.substation} / ${row.feeder})`);
      }
    }

    /*
     * Ustunlari to'ldirilgan qatorlar bo'yicha "TP raqami -> bazadagi TP"
     * jadvali. Bo'sh blokdagi qatorlar shundan foydalanadi (bir raqam ikki
     * haqiqiy TP ga mos kelganda ham natija barcha oylarda bir xil bo'ladi).
     */
    const resolvedByName = new Map<string, (typeof transformers)[number]>();
    for (const rows of byMonth.values()) {
      for (const row of rows) {
        if (!row.substation.trim() || !row.feeder.trim()) continue;
        const tp = resolve(row);
        if (tp) resolvedByName.set(tpKey(row.transformer), tp);
      }
    }

    const plan: {
      period: (typeof periods)[number];
      month: string;
      updates: { transformerId: string; totalKwh: number; usefulKwh: number; lossKwh: number; rowNumber: number }[];
      removeIds: string[];
      unresolved: FlowRow[];
    }[] = [];

    for (const month of months) {
      const period = periodByMonth.get(month);
      if (!period) {
        console.log(`   ${month}: bazada bunday davr yo'q - o'tkazib yuborildi`);
        continue;
      }
      const rows = byMonth.get(month)!;
      const updates = new Map<string, { transformerId: string; totalKwh: number; usefulKwh: number; lossKwh: number; rowNumber: number }>();
      const unresolved: FlowRow[] = [];
      for (const row of rows) {
        // Ustunlari to'ldirilgan oy (odatda oxirgisi) shu TP ni qayerga
        // bog'laganini takrorlaymiz: bo'sh blokdagi raqam ikki haqiqiy TP ga
        // mos kelsa, oy bo'yicha turlicha bo'lib ketmasligi uchun.
        const tp = resolve(row) ?? resolvedByName.get(tpKey(row.transformer)) ?? null;
        if (!tp) {
          unresolved.push(row);
          continue;
        }
        /*
         * Bir nechta qator bitta TP ga tushishi mumkin (qo'lda qo'shilgan
         * blokdagi qator o'sha TP ning asosiy qatoriga qo'shiladi) - oxirgisi
         * oldingisini almashtirmasligi uchun QO'SHILADI: fayldagi jami oqim
         * to'liq saqlanadi.
         */
        const current = updates.get(tp.id);
        updates.set(tp.id, {
          transformerId: tp.id,
          totalKwh: (current?.totalKwh ?? 0) + row.totalKwh,
          usefulKwh: (current?.usefulKwh ?? 0) + row.usefulKwh,
          lossKwh: (current?.lossKwh ?? 0) + row.lossKwh,
          rowNumber: current?.rowNumber ?? row.row,
        });
      }
      const existing = await prisma.transformerSnapshot.findMany({
        where: { periodId: period.id },
        select: { id: true, transformerId: true },
      });
      const removeIds = existing.filter((s) => !updates.has(s.transformerId)).map((s) => s.id);
      plan.push({ period, month, updates: [...updates.values()], removeIds, unresolved });
    }

    console.log("\nOy bo'yicha:");
    for (const item of plan) {
      console.log(
        `   ${item.month}: TP holati ${item.updates.length} ta yoziladi` +
          ` | ${item.removeIds.length} ta o'chiriladi` +
          (item.unresolved.length ? ` | ${item.unresolved.length} ta qator TP siz` : ""),
      );
    }

    const sample = plan.at(-1);
    if (sample?.unresolved.length) {
      console.log(`\n${sample.month}: TP topilmagan qatorlar (misol):`);
      for (const row of sample.unresolved.slice(0, 8)) {
        console.log(`   - “${row.transformer}” (${row.substation} / ${row.feeder}), ${row.sheet}, ${row.row}-qator`);
      }
      if (sample.unresolved.length > 8) console.log(`   ... va yana ${sample.unresolved.length - 8} ta`);
    }

    if (!commit) {
      console.log("\n(--commit berilmadi - bazaga yozilmadi)");
      return;
    }

    for (const item of plan) {
      await prisma.$transaction(
        async (tx) => {
          // 1. Faylda yo'q TP holatlari - o'chiriladi (fayl so'nggi ma'lumot).
          if (item.removeIds.length > 0) {
            await tx.transformerSnapshot.deleteMany({ where: { id: { in: item.removeIds } } });
          }

          // 2. TP oqimlari. Mavjud holatda faqat uch ustun yangilanadi,
          //    qolgan ma'lumot (abonent soni, manzil, quvvat...) tegilmaydi.
          const present = new Set(
            (
              await tx.transformerSnapshot.findMany({
                where: { periodId: item.period.id },
                select: { transformerId: true },
              })
            ).map((s) => s.transformerId),
          );
          for (const update of item.updates) {
            if (present.has(update.transformerId)) {
              await tx.transformerSnapshot.update({
                where: { periodId_transformerId: { periodId: item.period.id, transformerId: update.transformerId } },
                data: { totalKwh: update.totalKwh, usefulKwh: update.usefulKwh, lossKwh: update.lossKwh },
              });
            } else {
              await tx.transformerSnapshot.create({
                data: {
                  periodId: item.period.id,
                  transformerId: update.transformerId,
                  rowNumber: update.rowNumber,
                  totalKwh: update.totalKwh,
                  usefulKwh: update.usefulKwh,
                  lossKwh: update.lossKwh,
                  onlineSubscribers: 0,
                  offlineSubscribers: 0,
                },
              });
            }
          }

          // 3. Fider va podstansiya - TP lar yig'indisidan qayta hisoblanadi.
          await recomputeParents(tx, item.period.id);
        },
        { timeout: 15 * 60_000, maxWait: 60_000 },
      );
      console.log(
        `   ${item.month}: ${item.updates.length} ta TP yozildi,` +
          ` ${item.removeIds.length} ta o'chirildi, fider/podstansiya qayta hisoblandi`,
      );
    }

    console.log("\nSaqlandi.");
  } finally {
    await prisma.$disconnect();
  }
}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * Fider va podstansiya oqimlari = ularning TP lari yig'indisi. TP si qolmagan
 * fider / podstansiya holati o'chiriladi (uning manbasi ham yo'q).
 */
async function recomputeParents(tx: Tx, periodId: string): Promise<void> {
  const snapshots = await tx.transformerSnapshot.findMany({
    where: { periodId },
    select: {
      totalKwh: true,
      usefulKwh: true,
      lossKwh: true,
      transformer: { select: { feederId: true, substationId: true } },
    },
  });

  const byFeeder = new Map<string, { totalKwh: number; usefulKwh: number; lossKwh: number }>();
  const bySubstation = new Map<string, { totalKwh: number; usefulKwh: number; lossKwh: number }>();
  const add = (
    map: Map<string, { totalKwh: number; usefulKwh: number; lossKwh: number }>,
    id: string,
    snapshot: (typeof snapshots)[number],
  ) => {
    const sum = map.get(id) ?? { totalKwh: 0, usefulKwh: 0, lossKwh: 0 };
    sum.totalKwh += Number(snapshot.totalKwh);
    sum.usefulKwh += Number(snapshot.usefulKwh);
    sum.lossKwh += Number(snapshot.lossKwh);
    map.set(id, sum);
  };
  for (const snapshot of snapshots) {
    add(byFeeder, snapshot.transformer.feederId, snapshot);
    add(bySubstation, snapshot.transformer.substationId, snapshot);
  }

  // Fiderlar.
  await tx.feederSnapshot.deleteMany({ where: { periodId, feederId: { notIn: [...byFeeder.keys()] } } });
  const feederRows = await tx.feederSnapshot.findMany({ where: { periodId }, select: { feederId: true } });
  const feederPresent = new Set(feederRows.map((row) => row.feederId));
  for (const [feederId, sum] of byFeeder) {
    if (feederPresent.has(feederId)) {
      await tx.feederSnapshot.update({ where: { periodId_feederId: { periodId, feederId } }, data: sum });
    } else {
      await tx.feederSnapshot.create({ data: { periodId, feederId, rowNumber: 0, ...sum } });
    }
  }

  // Podstansiyalar.
  await tx.substationSnapshot.deleteMany({
    where: { periodId, substationId: { notIn: [...bySubstation.keys()] } },
  });
  const substationRows = await tx.substationSnapshot.findMany({
    where: { periodId },
    select: { substationId: true },
  });
  const substationPresent = new Set(substationRows.map((row) => row.substationId));
  for (const [substationId, sum] of bySubstation) {
    if (substationPresent.has(substationId)) {
      await tx.substationSnapshot.update({
        where: { periodId_substationId: { periodId, substationId } },
        data: sum,
      });
    } else {
      await tx.substationSnapshot.create({ data: { periodId, substationId, rowNumber: 0, ...sum } });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
