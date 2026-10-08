-- AlterTable
ALTER TABLE "User" ADD COLUMN     "apiTokenCreatedAt" TIMESTAMP(3),
ADD COLUMN     "apiTokenHash" TEXT,
ADD COLUMN     "apiTokenHint" TEXT,
ADD COLUMN     "apiTokenLastUsedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "User_apiTokenHash_key" ON "User"("apiTokenHash");
