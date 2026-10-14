-- AlterTable
ALTER TABLE "Print" ADD COLUMN     "aiDescriptionAppliedAt" TIMESTAMP(3),
ADD COLUMN     "aiDescriptionCheckedHash" TEXT,
ADD COLUMN     "aiDescriptionOriginal" TEXT,
ADD COLUMN     "aiDescriptionSuggestion" JSONB;

