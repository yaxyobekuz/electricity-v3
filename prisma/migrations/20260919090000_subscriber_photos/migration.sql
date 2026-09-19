-- CreateEnum
CREATE TYPE "SubscriberPhotoKind" AS ENUM ('SUBSCRIBER', 'METER');

-- CreateTable
CREATE TABLE "subscriber_photos" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "kind" "SubscriberPhotoKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriber_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriber_photos_subscriberId_kind_key" ON "subscriber_photos"("subscriberId", "kind");

-- AddForeignKey
ALTER TABLE "subscriber_photos" ADD CONSTRAINT "subscriber_photos_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
