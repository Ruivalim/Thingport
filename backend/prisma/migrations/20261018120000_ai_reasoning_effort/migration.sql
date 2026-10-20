-- CreateEnum
CREATE TYPE "ReasoningEffort" AS ENUM ('none', 'low', 'medium', 'high');

-- AlterTable
ALTER TABLE "AiConnection" ADD COLUMN "reasoningEffort" "ReasoningEffort";

-- Thinking on sent no reasoning_effort and off sent "none", so each connection keeps sending what it did.
UPDATE "AiConnection" SET "reasoningEffort" = 'none' WHERE "thinking" = false;

-- AlterTable
ALTER TABLE "AiConnection" DROP COLUMN "thinking";
