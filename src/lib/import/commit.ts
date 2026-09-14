import type { Prisma, TemplateType } from "@/generated/prisma";
import { prisma } from "@/lib/db/prisma";
import { contractKey, nameKey } from "@/lib/domain/normalize";
import { monthKey } from "@/lib/format";

import {
  type AppealRow,
  feederKey,
  type FeederRow,
  KEY_SEP,
  type SubscriberRow,
  substationKey,
  type SubstationRow,
  transformerKey,
  type TransformerRow,
  type ViolationRow,
} from "./templates";
import { errorDetail } from "./issues";
import type { ImportIssue, ImportResult } from "./types";
import {
  buildReport,
  parseFiles,
  validateSubmission,
  type FileCounts,
  type ValidatedSubmission,
} from "./validate";
import type { ImportFileInput, ParsedFile } from "./workbook";

/*
 * Saqlash rejimi. Qoidalar: `.claude/docs/malumotlar.md` 4.1-4.3.
 *
 *   1. Fayllar o'qiladi (bazasiz).
 *   2. Bitta tranzaksiya: `pg_advisory_xact_lock` -> qayta tekshiruv -> yozish.
 *   3. Tekshiruvda xato chiqsa - tranzaksiya bekor, har bir fayl uchun
 *      `ImportBatch(FAILED)` tranzaksiyadan TASHQARIDA yoziladi.
 */

type Tx = Prisma.TransactionClient;

/** Import qulfi kaliti (`pg_advisory_xact_lock`) - bir vaqtda bitta import. */
const IMPORT_LOCK_KEY = 72_410_914;

/** `createMany` bo'lagi: Postgres bitta so'rovda 65 535 parametrgacha qabul qiladi. */
const INSERT_CHUNK = 2000;
/** `IN (...)` ro'yxati bo'lagi. */
const LOOKUP_CHUNK = 5000;

/** Katta fayl uchun tranzaksiya vaqti (o'n minglab qator). */
const TRANSACTION_TIMEOUT_MS = 15 * 60 * 1000;

const chunked = <T>(items: readonly T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

class RejectedImport extends Error {
  constructor(readonly validated: ValidatedSubmission) {
    super("Import rad etildi");
  }
}

const asJson = (issues: ImportIssue[]) => issues as unknown as Prisma.InputJsonValue;

function validRows<R>(file: ParsedFile): R[] {
  return file.records.filter((record) => record.valid).map((record) => record.data as unknown as R);
}

/* ---------------------------------------------------------------------------
   Obyekt identifikatorlari (tabiiy kalit -> id)
   --------------------------------------------------------------------------- */

async function substationIds(tx: Tx, keys: Iterable<string>): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const chunk of chunked([...new Set(keys)], LOOKUP_CHUNK)) {
    const rows = await tx.substation.findMany({
      where: { nameKey: { in: chunk } },
      select: { id: true, nameKey: true },
    });
    for (const row of rows) result.set(row.nameKey, row.id);
  }
  return result;
}

interface FeederRef {
  id: string;
  substationId: string;
}

/** Podstansiyalarning barcha fiderlari: `feederKey` -> id. */
async function feederIds(tx: Tx, substations: Map<string, string>): Promise<Map<string, FeederRef>> {
  const keyById = new Map([...substations].map(([key, id]) => [id, key]));
  const result = new Map<string, FeederRef>();
  for (const chunk of chunked([...keyById.keys()], LOOKUP_CHUNK)) {
    const rows = await tx.feeder.findMany({
      where: { substationId: { in: chunk } },
      select: { id: true, substationId: true, nameKey: true },
    });
    for (const row of rows) {
      result.set(`${keyById.get(row.substationId)}${KEY_SEP}${row.nameKey}`, {
        id: row.id,
        substationId: row.substationId,
      });
    }
  }
  return result;
}

/** Fiderlarning barcha TP lari: `transformerKey` -> id. */
async function transformerIds(tx: Tx, feeders: Map<string, FeederRef>): Promise<Map<string, string>> {
  const keyById = new Map([...feeders].map(([key, ref]) => [ref.id, key]));
  const result = new Map<string, string>();
  for (const chunk of chunked([...keyById.keys()], LOOKUP_CHUNK)) {
    const rows = await tx.transformer.findMany({
      where: { feederId: { in: chunk } },
      select: { id: true, feederId: true, nameKey: true },
    });
    for (const row of rows) {
      result.set(`${keyById.get(row.feederId)}${KEY_SEP}${row.nameKey}`, row.id);
    }
  }
  return result;
}

const need = <V>(map: Map<string, V>, key: string, what: string): V => {
  const value = map.get(key);
  // Tekshiruvdan o'tgan ma'lumotda bo'lishi mumkin emas - tranzaksiya bekor qilinadi.
  if (value === undefined) throw new Error(`${what} topilmadi: ${key.split(KEY_SEP).join(" / ")}`);
  return value;
};

/* ---------------------------------------------------------------------------
   Yozuvchilar
   --------------------------------------------------------------------------- */

interface WriteContext {
  tx: Tx;
  periodId: string;
  importBatchId: string;
  staff: Map<string, string>;
}

const staffId = (ctx: WriteContext, name: string | null) => (name ? (ctx.staff.get(nameKey(name)) ?? null) : null);

async function writeSubstations(ctx: WriteContext, rows: SubstationRow[]) {
  const { tx, periodId, importBatchId } = ctx;
  for (const chunk of chunked(rows, LOOKUP_CHUNK)) {
    await tx.substation.createMany({
      data: chunk.map((row) => ({ name: row.name, nameKey: substationKey(row.name) })),
      skipDuplicates: true,
    });
  }
  const ids = await substationIds(tx, rows.map((row) => substationKey(row.name)));

  await tx.substationSnapshot.deleteMany({ where: { periodId } });
  for (const chunk of chunked(rows, INSERT_CHUNK)) {
    await tx.substationSnapshot.createMany({
      data: chunk.map((row) => ({
        periodId,
        importBatchId,
        substationId: need(ids, substationKey(row.name), "Podstansiya"),
        rowNumber: row.row,
        totalKwh: row.totalKwh,
        usefulKwh: row.usefulKwh,
        lossKwh: row.lossKwh,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        capacityKva: row.capacityKva,
        staffId: staffId(ctx, row.staffName),
      })),
    });
  }
}

async function writeFeeders(ctx: WriteContext, rows: FeederRow[]) {
  const { tx, periodId, importBatchId } = ctx;
  const substations = await substationIds(tx, rows.map((row) => substationKey(row.substationName)));
  for (const chunk of chunked(rows, LOOKUP_CHUNK)) {
    await tx.feeder.createMany({
      data: chunk.map((row) => ({
        substationId: need(substations, substationKey(row.substationName), "Podstansiya"),
        name: row.name,
        nameKey: nameKey(row.name),
      })),
      skipDuplicates: true,
    });
  }
  const feeders = await feederIds(tx, substations);

  await tx.feederSnapshot.deleteMany({ where: { periodId } });
  for (const chunk of chunked(rows, INSERT_CHUNK)) {
    await tx.feederSnapshot.createMany({
      data: chunk.map((row) => ({
        periodId,
        importBatchId,
        feederId: need(feeders, feederKey(row.substationName, row.name), "Fider").id,
        rowNumber: row.row,
        totalKwh: row.totalKwh,
        usefulKwh: row.usefulKwh,
        lossKwh: row.lossKwh,
        address: row.address,
        capacityKva: row.capacityKva,
        staffId: staffId(ctx, row.staffName),
      })),
    });
  }
}

async function writeTransformers(ctx: WriteContext, rows: TransformerRow[]) {
  const { tx, periodId, importBatchId } = ctx;
  const substations = await substationIds(tx, rows.map((row) => substationKey(row.substationName)));
  const feeders = await feederIds(tx, substations);
  for (const chunk of chunked(rows, LOOKUP_CHUNK)) {
    await tx.transformer.createMany({
      data: chunk.map((row) => {
        const feeder = need(feeders, feederKey(row.substationName, row.feederName), "Fider");
        return {
          substationId: feeder.substationId,
          feederId: feeder.id,
          name: row.name,
          nameKey: nameKey(row.name),
        };
      }),
      skipDuplicates: true,
    });
  }
  const transformers = await transformerIds(tx, feeders);

  await tx.transformerSnapshot.deleteMany({ where: { periodId } });
  for (const chunk of chunked(rows, INSERT_CHUNK)) {
    await tx.transformerSnapshot.createMany({
      data: chunk.map((row) => ({
        periodId,
        importBatchId,
        transformerId: need(transformers, transformerKey(row.substationName, row.feederName, row.name), "TP"),
        rowNumber: row.row,
        totalKwh: row.totalKwh,
        usefulKwh: row.usefulKwh,
        lossKwh: row.lossKwh,
        onlineSubscribers: row.onlineSubscribers,
        offlineSubscribers: row.offlineSubscribers,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        capacityKva: row.capacityKva,
        currentRepairDate: row.currentRepairDate,
        overhaulDate: row.overhaulDate,
        staffId: staffId(ctx, row.staffName),
      })),
    });
  }
}

async function writeSubscribers(ctx: WriteContext, rows: SubscriberRow[]) {
  const { tx, periodId, importBatchId } = ctx;
  const substations = await substationIds(tx, rows.map((row) => substationKey(row.substationName)));
  const feeders = await feederIds(tx, substations);
  const transformers = await transformerIds(tx, feeders);

  for (const chunk of chunked(rows, LOOKUP_CHUNK)) {
    await tx.subscriber.createMany({
      data: chunk.map((row) => ({
        contractNumber: row.contractNumber,
        contractKey: contractKey(row.contractNumber),
      })),
      skipDuplicates: true,
    });
  }
  const subscribers = new Map<string, string>();
  for (const chunk of chunked(rows, LOOKUP_CHUNK)) {
    const found = await tx.subscriber.findMany({
      where: { contractKey: { in: chunk.map((row) => contractKey(row.contractNumber)) } },
      select: { id: true, contractKey: true },
    });
    for (const item of found) subscribers.set(item.contractKey, item.id);
  }

  await tx.subscriberSnapshot.deleteMany({ where: { periodId } });
  for (const chunk of chunked(rows, INSERT_CHUNK)) {
    await tx.subscriberSnapshot.createMany({
      data: chunk.map((row) => ({
        periodId,
        importBatchId,
        subscriberId: need(subscribers, contractKey(row.contractNumber), "Abonent"),
        transformerId: need(
          transformers,
          transformerKey(row.substationName, row.feederName, row.transformerName),
          "TP",
        ),
        rowNumber: row.row,
        fullName: row.fullName,
        kind: row.kind,
        meterStatus: row.meterStatus,
        staffId: staffId(ctx, row.staffName),
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        meterSerial: row.meterSerial,
        meterType: row.meterType,
        debtUzs: row.debtUzs,
        creditUzs: row.creditUzs,
        meterReading: row.meterReading,
        lastReadingAt: row.lastReadingAt,
        lastPaymentDate: row.lastPaymentDate,
        lastPaymentUzs: row.lastPaymentUzs,
        contractDate: row.contractDate,
        passport: row.passport,
        pinfl: row.pinfl,
        meterInstalledAt: row.meterInstalledAt,
      })),
    });
  }
}

/**
 * 3-bo'lim: abonent nomi shu oyda shu TP abonentlari orasida `nameKey(FISH)`
 * bo'yicha aynan bitta topilsa - `subscriberId`, aks holda null.
 */
async function subscriberLinker(tx: Tx, periodId: string) {
  const rows = await tx.subscriberSnapshot.findMany({
    where: { periodId },
    select: { subscriberId: true, transformerId: true, fullName: true },
  });
  const byName = new Map<string, string[]>();
  for (const row of rows) {
    const key = `${row.transformerId}${KEY_SEP}${nameKey(row.fullName)}`;
    byName.set(key, [...(byName.get(key) ?? []), row.subscriberId]);
  }
  return (transformerId: string, subscriberName: string): string | null => {
    const matches = byName.get(`${transformerId}${KEY_SEP}${nameKey(subscriberName)}`);
    return matches && matches.length === 1 ? matches[0] : null;
  };
}

/** Shu oy TP lari: "TP Nomi" kaliti -> id (tekshiruv bir ma'noliligini kafolatlagan). */
async function transformersByName(tx: Tx, periodId: string): Promise<Map<string, string[]>> {
  const rows = await tx.transformerSnapshot.findMany({
    where: { periodId },
    select: { transformerId: true, transformer: { select: { nameKey: true } } },
  });
  const result = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.transformer.nameKey;
    result.set(key, [...(result.get(key) ?? []), row.transformerId]);
  }
  return result;
}

function uniqueTransformer(byName: Map<string, string[]>, name: string): string {
  const ids = byName.get(nameKey(name)) ?? [];
  if (ids.length !== 1) throw new Error(`TP bir ma’noli topilmadi: ${name}`);
  return ids[0];
}

async function writeViolations(ctx: WriteContext, rows: ViolationRow[]) {
  const { tx, periodId, importBatchId } = ctx;
  const byName = await transformersByName(tx, periodId);
  const link = await subscriberLinker(tx, periodId);

  await tx.violation.deleteMany({ where: { periodId } });
  for (const chunk of chunked(rows, INSERT_CHUNK)) {
    await tx.violation.createMany({
      data: chunk.map((row) => {
        const transformerId = uniqueTransformer(byName, row.transformerName);
        return {
          periodId,
          importBatchId,
          transformerId,
          subscriberId: link(transformerId, row.subscriberName),
          rowNumber: row.row,
          subscriberName: row.subscriberName,
          violatorType: row.violatorType,
          date: row.date,
          address: row.address,
          damageUzs: row.damageUzs,
          damageKwh: row.damageKwh,
          staffId: staffId(ctx, row.staffName),
        };
      }),
    });
  }
}

async function writeAppeals(ctx: WriteContext, rows: AppealRow[]) {
  const { tx, periodId, importBatchId } = ctx;
  const byName = await transformersByName(tx, periodId);
  const link = await subscriberLinker(tx, periodId);

  await tx.appeal.deleteMany({ where: { periodId } });
  for (const chunk of chunked(rows, INSERT_CHUNK)) {
    await tx.appeal.createMany({
      data: chunk.map((row) => {
        const transformerId = uniqueTransformer(byName, row.transformerName);
        return {
          periodId,
          importBatchId,
          transformerId,
          subscriberId: link(transformerId, row.subscriberName),
          rowNumber: row.row,
          text: row.text,
          subscriberName: row.subscriberName,
          date: row.date,
          address: row.address,
          status: row.status,
          staffId: staffId(ctx, row.staffName),
        };
      }),
    });
  }
}

/**
 * Abonentlar qayta yuklanib, qoidabuzarlik/murojaatlar yuklanmagan bo'lsa -
 * mavjud yozuvlarning abonent bog'lanishi yangi ro'yxat bo'yicha qayta
 * hisoblanadi.
 */
async function relinkEvents(tx: Tx, periodId: string, kind: "violations" | "appeals") {
  const link = await subscriberLinker(tx, periodId);
  const rows =
    kind === "violations"
      ? await tx.violation.findMany({
          where: { periodId },
          select: { id: true, transformerId: true, subscriberName: true, subscriberId: true },
        })
      : await tx.appeal.findMany({
          where: { periodId },
          select: { id: true, transformerId: true, subscriberName: true, subscriberId: true },
        });

  const changes = new Map<string | null, string[]>();
  for (const row of rows) {
    const target = link(row.transformerId, row.subscriberName);
    if (target === row.subscriberId) continue;
    changes.set(target, [...(changes.get(target) ?? []), row.id]);
  }
  for (const [subscriberId, ids] of changes) {
    for (const chunk of chunked(ids, LOOKUP_CHUNK)) {
      if (kind === "violations") {
        await tx.violation.updateMany({ where: { id: { in: chunk } }, data: { subscriberId } });
      } else {
        await tx.appeal.updateMany({ where: { id: { in: chunk } }, data: { subscriberId } });
      }
    }
  }
}

/* ---------------------------------------------------------------------------
   Tranzaksiya
   --------------------------------------------------------------------------- */

async function writeSubmission(
  tx: Tx,
  validated: ValidatedSubmission,
  uploadedById: string | null,
): Promise<Map<ParsedFile, string>> {
  const files = validated.files;

  // Davrlar. `reportDate` oxirida `refreshReportDate` bilan qayta hisoblanadi;
  // yangi davr uchun vaqtincha shu yuklashdagi eng katta sana.
  const periodIds = new Map<string, string>();
  const reportDates = new Map<string, Date>();
  for (const file of files) {
    const key = monthKey(file.month!);
    const current = reportDates.get(key);
    if (!current || file.reportDate! > current) reportDates.set(key, file.reportDate!);
  }
  for (const [key, reportDate] of reportDates) {
    const month = new Date(`${key}-01T00:00:00.000Z`);
    const existing = await tx.period.findUnique({ where: { month }, select: { id: true } });
    const period = existing ?? (await tx.period.create({ data: { month, reportDate }, select: { id: true } }));
    periodIds.set(key, period.id);
  }

  // Xodimlar: nameKey bo'yicha, birinchi uchragan yozuv.
  const staffNames = new Map<string, string>();
  for (const file of files) {
    for (const record of file.records) {
      const name = (record.data as { staffName?: string | null }).staffName;
      if (name && !staffNames.has(nameKey(name))) staffNames.set(nameKey(name), name);
    }
  }
  const staff = new Map<string, string>();
  for (const chunk of chunked([...staffNames], LOOKUP_CHUNK)) {
    await tx.staff.createMany({
      data: chunk.map(([key, name]) => ({ name, nameKey: key })),
      skipDuplicates: true,
    });
    const rows = await tx.staff.findMany({
      where: { nameKey: { in: chunk.map(([key]) => key) } },
      select: { id: true, nameKey: true },
    });
    for (const row of rows) staff.set(row.nameKey, row.id);
  }

  const batchIds = new Map<ParsedFile, string>();
  const written = new Map<string, Set<TemplateType>>();
  for (const file of files) {
    const type = file.templateType!;
    const key = monthKey(file.month!);
    const periodId = periodIds.get(key)!;
    const counts = validated.counts.get(file) as FileCounts;

    const batch = await tx.importBatch.create({
      data: {
        templateType: type,
        status: "COMPLETED",
        fileName: file.fileName,
        fileSize: file.fileSize,
        sheetName: file.sheetName,
        periodId,
        reportDate: file.reportDate,
        totalRows: file.totalRows,
        ...counts,
        warnings: file.warnings.empty ? undefined : asJson(file.warnings.toJson()),
        uploadedById,
      },
      select: { id: true },
    });
    batchIds.set(file, batch.id);

    const ctx: WriteContext = { tx, periodId, importBatchId: batch.id, staff };
    switch (type) {
      case "SUBSTATIONS":
        await writeSubstations(ctx, validRows<SubstationRow>(file));
        break;
      case "FEEDERS":
        await writeFeeders(ctx, validRows<FeederRow>(file));
        break;
      case "TRANSFORMERS":
        await writeTransformers(ctx, validRows<TransformerRow>(file));
        break;
      case "SUBSCRIBERS":
        await writeSubscribers(ctx, validRows<SubscriberRow>(file));
        break;
      case "VIOLATIONS":
        await writeViolations(ctx, validRows<ViolationRow>(file));
        break;
      case "APPEALS":
        await writeAppeals(ctx, validRows<AppealRow>(file));
        break;
    }
    written.set(key, (written.get(key) ?? new Set()).add(type));
  }

  for (const [key, types] of written) {
    const periodId = periodIds.get(key)!;
    if (types.has("SUBSCRIBERS")) {
      if (!types.has("VIOLATIONS")) await relinkEvents(tx, periodId, "violations");
      if (!types.has("APPEALS")) await relinkEvents(tx, periodId, "appeals");
    }
    const fresh = files.filter((file) => monthKey(file.month!) === key);
    await refreshReportDate(tx, periodId, fresh);
  }

  return batchIds;
}

/**
 * `Period.reportDate` = har bir shablonning joriy ma'lumotini bergan yuklash
 * (oxirgi `COMPLETED`) sanalarining eng kattasi. Har safar qayta hisoblanadi -
 * xato sana bilan yuklangan shablon to'g'ri sana bilan qayta yuklansa, sana
 * pastga ham tushadi.
 */
async function refreshReportDate(tx: Tx, periodId: string, fresh: readonly ParsedFile[]) {
  const freshTypes = fresh.map((file) => file.templateType!);
  const dates = fresh.map((file) => file.reportDate!);
  // Shu yuklashda kelmagan shablonlar: oxirgi muvaffaqiyatli yuklash.
  const previous = await tx.importBatch.findMany({
    where: { periodId, status: "COMPLETED", templateType: { notIn: freshTypes } },
    orderBy: { createdAt: "desc" },
    distinct: ["templateType"],
    select: { reportDate: true },
  });
  for (const batch of previous) if (batch.reportDate) dates.push(batch.reportDate);

  const reportDate = new Date(Math.max(...dates.map((date) => date.getTime())));
  await tx.period.update({ where: { id: periodId }, data: { reportDate } });
}

/**
 * Rad etilgan yuklash: har bir fayl (turi aniqlangan) uchun `FAILED` yozuvi.
 * Turi aniqlanmagan faylni qayd etib bo'lmaydi (`templateType` majburiy).
 */
async function writeFailedBatches(
  validated: ValidatedSubmission,
  uploadedById: string | null,
  reason: string,
): Promise<Map<ParsedFile, string>> {
  const batchIds = new Map<ParsedFile, string>();
  const periods = new Map<string, string | null>();
  for (const file of validated.files) {
    if (!file.templateType) continue;
    let periodId: string | null = null;
    if (file.month) {
      const key = monthKey(file.month);
      if (!periods.has(key)) {
        const period = await prisma.period.findUnique({ where: { month: file.month }, select: { id: true } });
        periods.set(key, period?.id ?? null);
      }
      periodId = periods.get(key) ?? null;
    }
    const counts = validated.counts.get(file);
    const errors: ImportIssue[] = file.errors.empty
      ? [{ row: null, column: null, message: reason }]
      : file.errors.toJson();
    const batch = await prisma.importBatch.create({
      data: {
        templateType: file.templateType,
        status: "FAILED",
        fileName: file.fileName,
        fileSize: file.fileSize,
        sheetName: file.sheetName,
        periodId,
        reportDate: file.reportDate,
        totalRows: file.totalRows,
        ...(counts ?? {}),
        errors: asJson(errors),
        warnings: file.warnings.empty ? undefined : asJson(file.warnings.toJson()),
        uploadedById,
      },
      select: { id: true },
    });
    batchIds.set(file, batch.id);
  }
  return batchIds;
}

export interface CommitOptions {
  uploadedById?: string | null;
}

/** Saqlash: qayta tekshiradi va bitta tranzaksiyada yozadi. */
export async function commitImport(
  inputs: readonly ImportFileInput[],
  options: CommitOptions = {},
): Promise<ImportResult> {
  const uploadedById = options.uploadedById ?? null;
  const parsed = await parseFiles(inputs);

  try {
    const { validated, batchIds } = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${IMPORT_LOCK_KEY})`);
        const validated = await validateSubmission(tx, parsed);
        if (!validated.valid) throw new RejectedImport(validated);
        const batchIds = await writeSubmission(tx, validated, uploadedById);
        return { validated, batchIds };
      },
      { maxWait: 60_000, timeout: TRANSACTION_TIMEOUT_MS },
    );
    return buildReport("commit", validated, { committed: true, batchIds });
  } catch (error) {
    if (error instanceof RejectedImport) {
      // Tarixga yozib bo'lmasa ham foydalanuvchi xatolar ro'yxatini ko'rsin.
      let batchIds = new Map<ParsedFile, string>();
      try {
        batchIds = await writeFailedBatches(
          error.validated,
          uploadedById,
          "Yuklash rad etildi: shu yuklashdagi boshqa faylda xato bor",
        );
      } catch (logError) {
        console.error("[import] FAILED yozuvini saqlab bo'lmadi", logError);
      }
      return buildReport("commit", error.validated, { committed: false, batchIds });
    }

    // Kutilmagan xato (baza, vaqt tugashi): hech narsa saqlanmagan.
    const message = `Saqlashda kutilmagan xato, hech narsa saqlanmadi: ${errorDetail(error)}`;
    console.error("[import] commit xatosi", error);
    const validated: ValidatedSubmission = { files: parsed, counts: new Map(), valid: false };
    let batchIds = new Map<ParsedFile, string>();
    try {
      batchIds = await writeFailedBatches(validated, uploadedById, message);
    } catch (logError) {
      console.error("[import] FAILED yozuvini saqlab bo'lmadi", logError);
    }
    const report = buildReport("commit", validated, { committed: false, batchIds, message });
    return { ...report, valid: parsed.every((file) => file.errors.empty) };
  }
}
