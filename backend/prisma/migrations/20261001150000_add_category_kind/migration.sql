-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'folder';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "categoriesView" TEXT;

-- Top-level starter categories (by their seeded name, or any site category ids) are categories;
-- everything else stays a folder.
UPDATE "Category"
SET "kind" = 'category'
WHERE "parentId" IS NULL
  AND (
    "name" IN (
      '3D Printer', 'Art', 'Education', 'Fashion', 'Hobby & DIY', 'Household', 'Miniatures',
      'Props & Cosplays', 'Tools', 'Toys & Games', 'Generative 3D Model'
    )
    OR cardinality("makerworldCatIds") > 0
    OR cardinality("thingiverseCatIds") > 0
    OR cardinality("printablesCatIds") > 0
  );

-- Subcategories take their top-level ancestor's kind.
WITH RECURSIVE tree AS (
  SELECT "id", "kind" FROM "Category" WHERE "parentId" IS NULL
  UNION ALL
  SELECT c."id", tree."kind" FROM "Category" c JOIN tree ON c."parentId" = tree."id"
)
UPDATE "Category" SET "kind" = tree."kind" FROM tree WHERE "Category"."id" = tree."id";
