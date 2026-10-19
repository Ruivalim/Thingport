-- Creality Cloud as a seventh provider: its site category ids on categories; and the user's Creality Cloud sign-in
-- (the model_token cookie, which the site sets for 7 days and never renews), sent by Thingport Grab or pasted.
ALTER TABLE "Category" ADD COLUMN "crealitycloudCatIds" INTEGER[] NOT NULL DEFAULT '{}';
CREATE INDEX "Category_crealitycloudCatIds_idx" ON "Category" USING GIN ("crealitycloudCatIds");

ALTER TABLE "User" ADD COLUMN "crealitycloudToken" TEXT,
ADD COLUMN "crealitycloudExpiresAt" TIMESTAMP(3),
ADD COLUMN "crealitycloudUserId" TEXT,
ADD COLUMN "crealitycloudRejectedAt" TIMESTAMP(3);

-- Adds Creality Cloud's category ids to the starter categories of users who signed up before they were in
-- seedData/defaultCategories.ts, so their Creality Cloud imports are categorized too. A starter category is found by
-- its name, and a subcategory by its top-level parent's name as well; one a user renamed, moved or deleted is skipped,
-- and ids a user already set are kept.
UPDATE "Category" AS c
SET "crealitycloudCatIds" = m.ids
FROM (VALUES
  (NULL::text, '3D Printer', ARRAY[1731, 6006]),
  ('3D Printer', '3D Printer Accessories', ARRAY[1904]),
  ('3D Printer', '3D Printer Parts', ARRAY[1316]),
  ('3D Printer', 'Test Models', ARRAY[1645]),
  (NULL::text, 'Art', ARRAY[1670]),
  ('Art', '2D Art', ARRAY[1662]),
  ('Art', 'Coin & Badges', ARRAY[1341]),
  ('Art', 'Sculptures', ARRAY[1584]),
  ('Art', 'Other Art Models', ARRAY[1997, 6005]),
  (NULL::text, 'Education', ARRAY[1501]),
  ('Education', 'Other Education Models', ARRAY[1974, 1343, 6003]),
  (NULL::text, 'Fashion', ARRAY[1175]),
  ('Fashion', 'Clothes', ARRAY[1598]),
  ('Fashion', 'Jewelry', ARRAY[1693]),
  ('Fashion', 'Other Fashion Models', ARRAY[1647, 6002]),
  (NULL::text, 'Hobby & DIY', ARRAY[1519]),
  ('Hobby & DIY', 'Electronics', ARRAY[1741]),
  ('Hobby & DIY', 'Music', ARRAY[1420]),
  ('Hobby & DIY', 'Robotics', ARRAY[1648]),
  ('Hobby & DIY', 'Sport & Outdoors', ARRAY[1246]),
  ('Hobby & DIY', 'Vehicles', ARRAY[1194]),
  ('Hobby & DIY', 'Other Hobby & DIY', ARRAY[6004]),
  (NULL::text, 'Household', ARRAY[1010]),
  ('Household', 'Decor', ARRAY[1150, 1096]),
  ('Household', 'Pets', ARRAY[1151]),
  ('Household', 'Other Household Models', ARRAY[1775, 6000]),
  (NULL::text, 'Miniatures', ARRAY[1952]),
  ('Miniatures', 'Architecture', ARRAY[1846]),
  ('Miniatures', 'Creatures', ARRAY[1025]),
  ('Miniatures', 'Other Miniatures', ARRAY[1888, 1982, 6008]),
  (NULL::text, 'Props & Cosplays', ARRAY[1966]),
  (NULL::text, 'Tools', ARRAY[1671]),
  ('Tools', 'Medical Tools', ARRAY[1160, 1192, 1765, 6001]),
  (NULL::text, 'Toys & Games', ARRAY[1809]),
  ('Toys & Games', 'Board Games', ARRAY[1575]),
  ('Toys & Games', 'Construction Sets', ARRAY[1141]),
  ('Toys & Games', 'Other Toys & Games', ARRAY[1793, 6007]),
  (NULL::text, 'Generative 3D Model', ARRAY[6012, 6010, 6013]),
  ('Generative 3D Model', 'Make My Sign', ARRAY[6011]),
  ('Generative 3D Model', 'Relief Sculpture Maker', ARRAY[6014])
) AS m(parent_name, name, ids)
WHERE c."kind" = 'category'
  AND c."name" = m.name
  AND cardinality(c."crealitycloudCatIds") = 0
  AND (
    (m.parent_name IS NULL AND c."parentId" IS NULL)
    OR EXISTS (
      SELECT 1 FROM "Category" p
      WHERE p."id" = c."parentId" AND p."parentId" IS NULL AND p."name" = m.parent_name
    )
  );
