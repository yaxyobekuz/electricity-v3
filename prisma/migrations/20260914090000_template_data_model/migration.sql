-- CreateEnum
CREATE TYPE "TemplateType" AS ENUM ('SUBSTATIONS', 'FEEDERS', 'TRANSFORMERS', 'SUBSCRIBERS', 'VIOLATIONS', 'APPEALS');

-- CreateEnum
CREATE TYPE "SubscriberKind" AS ENUM ('LEGAL', 'HOUSEHOLD');

-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('ONLINE', 'NOT_RESPONDING', 'SCHEME_CHANGED');

-- CreateEnum
CREATE TYPE "ViolatorType" AS ENUM ('LEGAL', 'INDIVIDUAL', 'INNOCENT');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('RESOLVED', 'REJECTED', 'IN_PROGRESS', 'OVERDUE');

-- AlterEnum
BEGIN;
CREATE TYPE "ImportStatus_new" AS ENUM ('COMPLETED', 'FAILED');
ALTER TABLE "public"."import_batches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "import_batches" ALTER COLUMN "status" TYPE "ImportStatus_new" USING ("status"::text::"ImportStatus_new");
ALTER TYPE "ImportStatus" RENAME TO "ImportStatus_old";
ALTER TYPE "ImportStatus_new" RENAME TO "ImportStatus";
DROP TYPE "public"."ImportStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "feeder_readings" DROP CONSTRAINT "feeder_readings_feederId_fkey";

-- DropForeignKey
ALTER TABLE "feeder_readings" DROP CONSTRAINT "feeder_readings_importBatchId_fkey";

-- DropForeignKey
ALTER TABLE "feeders" DROP CONSTRAINT "feeders_transformerId_fkey";

-- DropForeignKey
ALTER TABLE "substations" DROP CONSTRAINT "substations_etkId_fkey";

-- DropForeignKey
ALTER TABLE "tp_points" DROP CONSTRAINT "tp_points_feederId_fkey";

-- DropForeignKey
ALTER TABLE "tp_problems" DROP CONSTRAINT "tp_problems_tpPointId_fkey";

-- DropForeignKey
ALTER TABLE "tp_readings" DROP CONSTRAINT "tp_readings_importBatchId_fkey";

-- DropForeignKey
ALTER TABLE "tp_readings" DROP CONSTRAINT "tp_readings_tpPointId_fkey";

-- DropIndex
DROP INDEX "feeders_transformerId_idx";

-- DropIndex
DROP INDEX "feeders_transformerId_name_key";

-- DropIndex
DROP INDEX "import_batches_status_idx";

-- DropIndex
DROP INDEX "substations_etkId_idx";

-- DropIndex
DROP INDEX "substations_etkId_name_key";

-- DropIndex
DROP INDEX "transformers_substationId_name_key";

-- AlterTable
ALTER TABLE "feeders" DROP COLUMN "aliases",
DROP COLUMN "coefficient",
DROP COLUMN "isActive",
DROP COLUMN "note",
DROP COLUMN "transformerId",
DROP COLUMN "voltage",
ADD COLUMN     "nameKey" TEXT NOT NULL,
ADD COLUMN     "substationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "import_batches" DROP COLUMN "errorRows",
DROP COLUMN "finishedAt",
DROP COLUMN "insertedRows",
DROP COLUMN "periodEnd",
DROP COLUMN "periodStart",
DROP COLUMN "skippedRows",
ADD COLUMN     "createdRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "periodId" TEXT,
ADD COLUMN     "removedRows" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reportDate" DATE,
ADD COLUMN     "sheetName" TEXT,
ADD COLUMN     "warnings" JSONB,
DROP COLUMN "templateType",
ADD COLUMN     "templateType" "TemplateType" NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "substations" DROP COLUMN "address",
DROP COLUMN "etkId",
DROP COLUMN "note",
DROP COLUMN "voltageType",
ADD COLUMN     "nameKey" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "transformers" DROP COLUMN "capacityKva",
DROP COLUMN "note",
ADD COLUMN     "feederId" TEXT NOT NULL,
ADD COLUMN     "nameKey" TEXT NOT NULL;

-- DropTable
DROP TABLE "etks";

-- DropTable
DROP TABLE "feeder_readings";

-- DropTable
DROP TABLE "tp_points";

-- DropTable
DROP TABLE "tp_problems";

-- DropTable
DROP TABLE "tp_readings";

-- DropEnum
DROP TYPE "ImportTemplate";

-- DropEnum
DROP TYPE "ProblemSeverity";

-- DropEnum
DROP TYPE "ProblemStatus";

-- CreateTable
CREATE TABLE "periods" (
    "id" TEXT NOT NULL,
    "month" DATE NOT NULL,
    "reportDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscribers" (
    "id" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "contractKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "substation_snapshots" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "substationId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "totalKwh" DECIMAL(18,2) NOT NULL,
    "usefulKwh" DECIMAL(18,2) NOT NULL,
    "lossKwh" DECIMAL(18,2) NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "capacityKva" DECIMAL(12,2),
    "staffId" TEXT,

    CONSTRAINT "substation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feeder_snapshots" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "feederId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "totalKwh" DECIMAL(18,2) NOT NULL,
    "usefulKwh" DECIMAL(18,2) NOT NULL,
    "lossKwh" DECIMAL(18,2) NOT NULL,
    "address" TEXT,
    "capacityKva" DECIMAL(12,2),
    "staffId" TEXT,

    CONSTRAINT "feeder_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transformer_snapshots" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "transformerId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "totalKwh" DECIMAL(18,2) NOT NULL,
    "usefulKwh" DECIMAL(18,2) NOT NULL,
    "lossKwh" DECIMAL(18,2) NOT NULL,
    "onlineSubscribers" INTEGER NOT NULL,
    "offlineSubscribers" INTEGER NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "capacityKva" DECIMAL(12,2),
    "currentRepairDate" DATE,
    "overhaulDate" DATE,
    "staffId" TEXT,

    CONSTRAINT "transformer_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriber_snapshots" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "transformerId" TEXT NOT NULL,
    "importBatchId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "kind" "SubscriberKind" NOT NULL,
    "meterStatus" "MeterStatus" NOT NULL,
    "staffId" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "meterSerial" TEXT,
    "meterType" TEXT,
    "debtUzs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "creditUzs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "meterReading" DECIMAL(18,2),
    "lastReadingAt" TIMESTAMP(3),
    "lastPaymentDate" DATE,
    "lastPaymentUzs" DECIMAL(18,2),
    "contractDate" DATE,
    "passport" TEXT,
    "pinfl" TEXT,
    "meterInstalledAt" DATE,

    CONSTRAINT "subscriber_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "violations" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "transformerId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "importBatchId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "subscriberName" TEXT NOT NULL,
    "violatorType" "ViolatorType" NOT NULL,
    "date" DATE NOT NULL,
    "address" TEXT,
    "damageUzs" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "damageKwh" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "staffId" TEXT,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appeals" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "transformerId" TEXT NOT NULL,
    "subscriberId" TEXT,
    "importBatchId" TEXT,
    "rowNumber" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "subscriberName" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "address" TEXT,
    "status" "AppealStatus" NOT NULL,
    "staffId" TEXT,

    CONSTRAINT "appeals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "periods_month_key" ON "periods"("month");

-- CreateIndex
CREATE UNIQUE INDEX "staff_nameKey_key" ON "staff"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "subscribers_contractKey_key" ON "subscribers"("contractKey");

-- CreateIndex
CREATE INDEX "substation_snapshots_substationId_idx" ON "substation_snapshots"("substationId");

-- CreateIndex
CREATE INDEX "substation_snapshots_staffId_idx" ON "substation_snapshots"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "substation_snapshots_periodId_substationId_key" ON "substation_snapshots"("periodId", "substationId");

-- CreateIndex
CREATE INDEX "feeder_snapshots_feederId_idx" ON "feeder_snapshots"("feederId");

-- CreateIndex
CREATE INDEX "feeder_snapshots_staffId_idx" ON "feeder_snapshots"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "feeder_snapshots_periodId_feederId_key" ON "feeder_snapshots"("periodId", "feederId");

-- CreateIndex
CREATE INDEX "transformer_snapshots_transformerId_idx" ON "transformer_snapshots"("transformerId");

-- CreateIndex
CREATE INDEX "transformer_snapshots_staffId_idx" ON "transformer_snapshots"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "transformer_snapshots_periodId_transformerId_key" ON "transformer_snapshots"("periodId", "transformerId");

-- CreateIndex
CREATE INDEX "subscriber_snapshots_periodId_transformerId_idx" ON "subscriber_snapshots"("periodId", "transformerId");

-- CreateIndex
CREATE INDEX "subscriber_snapshots_subscriberId_idx" ON "subscriber_snapshots"("subscriberId");

-- CreateIndex
CREATE INDEX "subscriber_snapshots_staffId_idx" ON "subscriber_snapshots"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriber_snapshots_periodId_subscriberId_key" ON "subscriber_snapshots"("periodId", "subscriberId");

-- CreateIndex
CREATE INDEX "violations_periodId_transformerId_idx" ON "violations"("periodId", "transformerId");

-- CreateIndex
CREATE INDEX "violations_transformerId_idx" ON "violations"("transformerId");

-- CreateIndex
CREATE INDEX "violations_subscriberId_idx" ON "violations"("subscriberId");

-- CreateIndex
CREATE INDEX "violations_staffId_idx" ON "violations"("staffId");

-- CreateIndex
CREATE INDEX "appeals_periodId_transformerId_idx" ON "appeals"("periodId", "transformerId");

-- CreateIndex
CREATE INDEX "appeals_transformerId_idx" ON "appeals"("transformerId");

-- CreateIndex
CREATE INDEX "appeals_subscriberId_idx" ON "appeals"("subscriberId");

-- CreateIndex
CREATE INDEX "appeals_staffId_idx" ON "appeals"("staffId");

-- CreateIndex
CREATE INDEX "appeals_periodId_status_idx" ON "appeals"("periodId", "status");

-- CreateIndex
CREATE INDEX "feeders_substationId_idx" ON "feeders"("substationId");

-- CreateIndex
CREATE UNIQUE INDEX "feeders_substationId_nameKey_key" ON "feeders"("substationId", "nameKey");

-- CreateIndex
CREATE INDEX "import_batches_templateType_idx" ON "import_batches"("templateType");

-- CreateIndex
CREATE INDEX "import_batches_periodId_idx" ON "import_batches"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "substations_nameKey_key" ON "substations"("nameKey");

-- CreateIndex
CREATE INDEX "transformers_nameKey_idx" ON "transformers"("nameKey");

-- CreateIndex
CREATE UNIQUE INDEX "transformers_feederId_nameKey_key" ON "transformers"("feederId", "nameKey");

-- AddForeignKey
ALTER TABLE "feeders" ADD CONSTRAINT "feeders_substationId_fkey" FOREIGN KEY ("substationId") REFERENCES "substations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformers" ADD CONSTRAINT "transformers_feederId_fkey" FOREIGN KEY ("feederId") REFERENCES "feeders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substation_snapshots" ADD CONSTRAINT "substation_snapshots_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substation_snapshots" ADD CONSTRAINT "substation_snapshots_substationId_fkey" FOREIGN KEY ("substationId") REFERENCES "substations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substation_snapshots" ADD CONSTRAINT "substation_snapshots_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "substation_snapshots" ADD CONSTRAINT "substation_snapshots_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeder_snapshots" ADD CONSTRAINT "feeder_snapshots_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeder_snapshots" ADD CONSTRAINT "feeder_snapshots_feederId_fkey" FOREIGN KEY ("feederId") REFERENCES "feeders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeder_snapshots" ADD CONSTRAINT "feeder_snapshots_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeder_snapshots" ADD CONSTRAINT "feeder_snapshots_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformer_snapshots" ADD CONSTRAINT "transformer_snapshots_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformer_snapshots" ADD CONSTRAINT "transformer_snapshots_transformerId_fkey" FOREIGN KEY ("transformerId") REFERENCES "transformers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformer_snapshots" ADD CONSTRAINT "transformer_snapshots_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformer_snapshots" ADD CONSTRAINT "transformer_snapshots_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_snapshots" ADD CONSTRAINT "subscriber_snapshots_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_snapshots" ADD CONSTRAINT "subscriber_snapshots_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_snapshots" ADD CONSTRAINT "subscriber_snapshots_transformerId_fkey" FOREIGN KEY ("transformerId") REFERENCES "transformers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_snapshots" ADD CONSTRAINT "subscriber_snapshots_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_snapshots" ADD CONSTRAINT "subscriber_snapshots_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_transformerId_fkey" FOREIGN KEY ("transformerId") REFERENCES "transformers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_transformerId_fkey" FOREIGN KEY ("transformerId") REFERENCES "transformers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
