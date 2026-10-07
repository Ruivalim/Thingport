-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "printId" TEXT,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill from the audit log, so the heatmap starts with the history already there, each model by
-- the name the log kept. Downloads and slicer opens were only ever counted, never logged, so they
-- start from now.
INSERT INTO "Activity" ("id", "userId", "kind", "printId", "name", "createdAt")
SELECT
    'log_' || "id",
    "userId",
    CASE "action" WHEN 'model_uploaded' THEN 'upload' WHEN 'model_imported' THEN 'import' ELSE 'delete' END,
    "targetId",
    "details"->>'name',
    "createdAt"
FROM "Log"
WHERE "action" IN ('model_uploaded', 'model_imported', 'model_deleted');

-- An import job logged once for all its models; each one it imported becomes an activity.
INSERT INTO "Activity" ("id", "userId", "kind", "printId", "createdAt")
SELECT 'log_' || l."id" || '_' || n, l."userId", 'import', NULL, l."createdAt"
FROM "Log" l
CROSS JOIN LATERAL generate_series(1, COALESCE((l."details"->>'imported')::int, 0)) AS n
WHERE l."action" = 'import_completed';
