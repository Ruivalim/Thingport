-- Links sent from the extension wait in a PAUSED job until started from the admin import queue.
ALTER TYPE "ImportJobStatus" ADD VALUE 'PAUSED';

ALTER TABLE "ImportJob" ADD COLUMN "notificationId" TEXT;

ALTER TABLE "ImportJobItem" ADD COLUMN "payload" JSONB;
