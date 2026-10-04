-- A background batch import of a list of links (see importJobRunner.ts's runLinksImportJob),
-- with per-item state so failed links can be retried.
ALTER TYPE "ImportJobType" ADD VALUE 'LINKS';

CREATE TYPE "ImportJobItemStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

ALTER TABLE "ImportJob" ADD COLUMN "payload" JSONB;

CREATE TABLE "ImportJobItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" "ImportJobItemStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJobItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportJobItem_jobId_status_idx" ON "ImportJobItem"("jobId", "status");

ALTER TABLE "ImportJobItem" ADD CONSTRAINT "ImportJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
