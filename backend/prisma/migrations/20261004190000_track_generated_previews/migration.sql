-- Marks our own 3D renders, so an import's images replace one that got in first.
ALTER TABLE "Plate" ADD COLUMN "thumbGenerated" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PreviewImage" ADD COLUMN "generated" BOOLEAN NOT NULL DEFAULT false;
