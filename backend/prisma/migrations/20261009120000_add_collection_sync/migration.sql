-- AlterTable
ALTER TABLE "ImportJob" ADD COLUMN     "collectionSyncId" TEXT;

-- CreateTable
CREATE TABLE "CollectionSync" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "profileScope" TEXT NOT NULL DEFAULT 'url',
    "intervalHours" INTEGER NOT NULL DEFAULT 1,
    "knownIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "missingChecks" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollectionSync_collectionId_key" ON "CollectionSync"("collectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionSync_userId_provider_externalId_key" ON "CollectionSync"("userId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "ImportJob_collectionSyncId_idx" ON "ImportJob"("collectionSyncId");

-- AddForeignKey
ALTER TABLE "CollectionSync" ADD CONSTRAINT "CollectionSync_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionSync" ADD CONSTRAINT "CollectionSync_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_collectionSyncId_fkey" FOREIGN KEY ("collectionSyncId") REFERENCES "CollectionSync"("id") ON DELETE SET NULL ON UPDATE CASCADE;

