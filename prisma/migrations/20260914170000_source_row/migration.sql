-- AlterTable
ALTER TABLE "appeals" ADD COLUMN     "sourceRow" JSONB;

-- AlterTable
ALTER TABLE "feeder_snapshots" ADD COLUMN     "sourceRow" JSONB;

-- AlterTable
ALTER TABLE "subscriber_snapshots" ADD COLUMN     "sourceRow" JSONB;

-- AlterTable
ALTER TABLE "substation_snapshots" ADD COLUMN     "sourceRow" JSONB;

-- AlterTable
ALTER TABLE "transformer_snapshots" ADD COLUMN     "sourceRow" JSONB;

-- AlterTable
ALTER TABLE "violations" ADD COLUMN     "sourceRow" JSONB;
