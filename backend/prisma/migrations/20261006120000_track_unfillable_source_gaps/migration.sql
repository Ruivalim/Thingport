-- Gaps the source had nothing for at the last fill, so the fill action hides until a new gap appears.
ALTER TABLE "Print" ADD COLUMN "unfillableGaps" TEXT[] DEFAULT ARRAY[]::TEXT[];
