-- DropForeignKey
ALTER TABLE "appeals" DROP CONSTRAINT "appeals_transformerId_fkey";

-- DropForeignKey
ALTER TABLE "violations" DROP CONSTRAINT "violations_transformerId_fkey";

-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "feederId" TEXT,
ADD COLUMN     "substationId" TEXT,
ALTER COLUMN "transformerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "violations" ADD COLUMN     "feederId" TEXT,
ADD COLUMN     "substationId" TEXT,
ALTER COLUMN "transformerId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "appeals_periodId_feederId_idx" ON "appeals"("periodId", "feederId");

-- CreateIndex
CREATE INDEX "appeals_periodId_substationId_idx" ON "appeals"("periodId", "substationId");

-- CreateIndex
CREATE INDEX "violations_periodId_feederId_idx" ON "violations"("periodId", "feederId");

-- CreateIndex
CREATE INDEX "violations_periodId_substationId_idx" ON "violations"("periodId", "substationId");

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_transformerId_fkey" FOREIGN KEY ("transformerId") REFERENCES "transformers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_feederId_fkey" FOREIGN KEY ("feederId") REFERENCES "feeders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "violations" ADD CONSTRAINT "violations_substationId_fkey" FOREIGN KEY ("substationId") REFERENCES "substations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_transformerId_fkey" FOREIGN KEY ("transformerId") REFERENCES "transformers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_feederId_fkey" FOREIGN KEY ("feederId") REFERENCES "feeders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appeals" ADD CONSTRAINT "appeals_substationId_fkey" FOREIGN KEY ("substationId") REFERENCES "substations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
