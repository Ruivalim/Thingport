-- Cults3D as a tenth provider: its category ids on categories, and the user's Cults3D access: API credentials (their
-- nickname and an API key) for the metadata, and the browser's sign-in and Cloudflare clearance, sent by Thingport Grab,
-- for the order and download pages.
ALTER TABLE "Category" ADD COLUMN "cults3dCatIds" INTEGER[] NOT NULL DEFAULT '{}';
CREATE INDEX "Category_cults3dCatIds_idx" ON "Category" USING GIN ("cults3dCatIds");

ALTER TABLE "User" ADD COLUMN "cults3dNick" TEXT,
ADD COLUMN "cults3dApiKey" TEXT,
ADD COLUMN "cults3dApiRejectedAt" TIMESTAMP(3),
ADD COLUMN "cults3dSession" TEXT,
ADD COLUMN "cults3dClearance" TEXT,
ADD COLUMN "cults3dUserAgent" TEXT,
ADD COLUMN "cults3dSessionRejectedAt" TIMESTAMP(3);

-- Adds Cults3D's category ids to the starter categories of users who signed up before they were in
-- seedData/defaultCategories.ts, so their Cults3D imports are categorized too. A starter category is found by its
-- name, and a subcategory by its top-level parent's name as well; one a user renamed, moved or deleted is skipped, and
-- ids a user already set are kept.
UPDATE "Category" AS c
SET "cults3dCatIds" = m.ids
FROM (VALUES
  ('3D Printer', '3D Printer Accessories', ARRAY[101]),
  (NULL::text, 'Art', ARRAY[23]),
  ('Art', 'Coin & Badges', ARRAY[36, 51]),
  ('Art', 'Signs & Logos', ARRAY[44]),
  ('Art', 'Sculptures', ARRAY[43, 42]),
  ('Art', 'Other Art Models', ARRAY[37, 38, 39, 35]),
  (NULL::text, 'Education', ARRAY[116]),
  (NULL::text, 'Fashion', ARRAY[24]),
  ('Fashion', 'Bags', ARRAY[49]),
  ('Fashion', 'Earrings', ARRAY[53]),
  ('Fashion', 'Footwear', ARRAY[122]),
  ('Fashion', 'Glasses', ARRAY[47]),
  ('Fashion', 'Jewelry', ARRAY[26, 50, 55, 52]),
  ('Fashion', 'Rings', ARRAY[56]),
  (NULL::text, 'Hobby & DIY', ARRAY[102]),
  ('Hobby & DIY', 'Electronics', ARRAY[84]),
  ('Hobby & DIY', 'Music', ARRAY[78]),
  ('Hobby & DIY', 'RC', ARRAY[97, 83]),
  ('Hobby & DIY', 'Robotics', ARRAY[41]),
  ('Hobby & DIY', 'Sport & Outdoors', ARRAY[121, 89]),
  ('Hobby & DIY', 'Vehicles', ARRAY[86, 8]),
  ('Hobby & DIY', 'Other Hobby & DIY', ARRAY[79, 118, 119]),
  (NULL::text, 'Household', ARRAY[30]),
  ('Household', 'Decor', ARRAY[61, 64, 71, 70, 72]),
  ('Household', 'Festivities', ARRAY[120]),
  ('Household', 'Garden', ARRAY[67]),
  ('Household', 'Office', ARRAY[66]),
  ('Household', 'Pets', ARRAY[68]),
  ('Household', 'Other Household Models', ARRAY[63, 57, 60, 58, 59, 65, 69, 62, 113]),
  (NULL::text, 'Miniatures', ARRAY[98]),
  ('Miniatures', 'Animals', ARRAY[34]),
  ('Miniatures', 'Architecture', ARRAY[32, 75, 73, 74, 76, 77, 115]),
  ('Miniatures', 'People', ARRAY[40]),
  ('Props & Cosplays', 'Masks & Helmets', ARRAY[48]),
  ('Props & Cosplays', 'Cosplay Weapons', ARRAY[46]),
  (NULL::text, 'Tools', ARRAY[27]),
  ('Tools', 'Gadgets', ARRAY[25, 85, 82, 81, 80]),
  ('Tools', 'Hand Tools', ARRAY[103]),
  ('Tools', 'Machine Tools', ARRAY[104]),
  ('Tools', 'Medical Tools', ARRAY[117, 114]),
  ('Tools', 'Organizers', ARRAY[106]),
  ('Tools', 'Other Tools', ARRAY[105]),
  (NULL::text, 'Toys & Games', ARRAY[31, 99]),
  ('Toys & Games', 'Board Games', ARRAY[91]),
  ('Toys & Games', 'Characters', ARRAY[87]),
  ('Toys & Games', 'Puzzles', ARRAY[93]),
  ('Toys & Games', 'Construction Sets', ARRAY[94]),
  ('Toys & Games', 'Other Toys & Games', ARRAY[90, 100, 88, 96, 92, 95, 54]),
  ('Generative 3D Model', 'Hueforge & Lithophane', ARRAY[33])
) AS m(parent_name, name, ids)
WHERE c."kind" = 'category'
  AND c."name" = m.name
  AND cardinality(c."cults3dCatIds") = 0
  AND (
    (m.parent_name IS NULL AND c."parentId" IS NULL)
    OR EXISTS (
      SELECT 1 FROM "Category" p
      WHERE p."id" = c."parentId" AND p."parentId" IS NULL AND p."name" = m.parent_name
    )
  );
