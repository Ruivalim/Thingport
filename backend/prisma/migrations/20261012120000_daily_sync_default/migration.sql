-- New syncs are checked daily. Existing syncs keep their interval.
ALTER TABLE "CollectionSync" ALTER COLUMN "intervalHours" SET DEFAULT 24;
