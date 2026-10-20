-- Snapmaker Space as a fifth provider: its site category ids on categories; and the user's Snapmaker login, which
-- Thingport Grab keeps fresh and sends here (Snapmaker's refresh tokens work once, so Thingport never refreshes it).
ALTER TABLE "Category" ADD COLUMN "snapmakerCatIds" INTEGER[] NOT NULL DEFAULT '{}';
CREATE INDEX "Category_snapmakerCatIds_idx" ON "Category" USING GIN ("snapmakerCatIds");

ALTER TABLE "User" ADD COLUMN "snapmakerToken" TEXT,
ADD COLUMN "snapmakerTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN "snapmakerUserId" TEXT,
ADD COLUMN "snapmakerRejectedAt" TIMESTAMP(3);

-- Adds Snapmaker's category ids to the starter categories of users who signed up before they were in
-- seedData/defaultCategories.ts, so their Snapmaker imports are categorized too. A starter category is found by its
-- name, and a subcategory by its top-level parent's name as well; one a user renamed, moved or deleted is skipped,
-- and ids a user already set are kept.
UPDATE "Category" AS c
SET "snapmakerCatIds" = m.ids
FROM (VALUES
  (NULL::text, '3D Printer', ARRAY[103]),
  ('3D Printer', '3D Printer Accessories', ARRAY[116, 115, 117, 118]),
  ('3D Printer', 'Test Models', ARRAY[114]),
  (NULL::text, 'Art', ARRAY[104]),
  ('Art', '2D Art', ARRAY[119]),
  ('Art', 'Sculptures', ARRAY[121]),
  ('Art', 'Other Art Models', ARRAY[120, 183]),
  (NULL::text, 'Education', ARRAY[106]),
  ('Education', 'Biology', ARRAY[129]),
  ('Education', 'Chemistry', ARRAY[128]),
  ('Education', 'Engineering', ARRAY[132]),
  ('Education', 'Geography', ARRAY[130]),
  ('Education', 'Mathematics', ARRAY[126]),
  ('Education', 'Physics & Astronomy', ARRAY[131, 127]),
  ('Education', 'Other Education Models', ARRAY[133]),
  (NULL::text, 'Fashion', ARRAY[107]),
  ('Fashion', 'Bags', ARRAY[135]),
  ('Fashion', 'Clothes', ARRAY[182]),
  ('Fashion', 'Footwear', ARRAY[137]),
  ('Fashion', 'Jewelry', ARRAY[134]),
  ('Fashion', 'Other Fashion Models', ARRAY[136, 138]),
  (NULL::text, 'Hobby & DIY', ARRAY[109]),
  ('Hobby & DIY', 'Electronics', ARRAY[148]),
  ('Hobby & DIY', 'Music', ARRAY[152]),
  ('Hobby & DIY', 'RC', ARRAY[150]),
  ('Hobby & DIY', 'Robotics', ARRAY[149]),
  ('Hobby & DIY', 'Sport & Outdoors', ARRAY[154]),
  ('Hobby & DIY', 'Vehicles', ARRAY[153]),
  ('Hobby & DIY', 'Other Hobby & DIY', ARRAY[151, 155]),
  (NULL::text, 'Household', ARRAY[108]),
  ('Household', 'Decor', ARRAY[139]),
  ('Household', 'Festivities', ARRAY[140]),
  ('Household', 'Garden', ARRAY[146]),
  ('Household', 'Office', ARRAY[143]),
  ('Household', 'Pets', ARRAY[147]),
  ('Household', 'Other Household Models', ARRAY[142, 144, 145, 184]),
  (NULL::text, 'Miniatures', ARRAY[110]),
  ('Miniatures', 'Animals', ARRAY[157]),
  ('Miniatures', 'Architecture', ARRAY[158]),
  ('Miniatures', 'Creatures', ARRAY[159]),
  ('Miniatures', 'People', ARRAY[156]),
  ('Miniatures', 'Other Miniatures', ARRAY[160]),
  (NULL::text, 'Props & Cosplays', ARRAY[105]),
  ('Props & Cosplays', 'Costumes', ARRAY[123]),
  ('Props & Cosplays', 'Masks & Helmets', ARRAY[122]),
  ('Props & Cosplays', 'Cosplay Weapons', ARRAY[124]),
  ('Props & Cosplays', 'Other Props & Cosplays', ARRAY[125]),
  (NULL::text, 'Tools', ARRAY[111]),
  ('Tools', 'Hand Tools', ARRAY[161]),
  ('Tools', 'Machine Tools', ARRAY[165]),
  ('Tools', 'Measure Tools', ARRAY[162]),
  ('Tools', 'Organizers', ARRAY[141, 163]),
  ('Tools', 'Other Tools', ARRAY[164, 166]),
  (NULL::text, 'Toys & Games', ARRAY[112]),
  ('Toys & Games', 'Board Games', ARRAY[172]),
  ('Toys & Games', 'Characters', ARRAY[171]),
  ('Toys & Games', 'Outdoor Toys', ARRAY[173]),
  ('Toys & Games', 'Puzzles', ARRAY[169]),
  ('Toys & Games', 'Construction Sets', ARRAY[170]),
  ('Toys & Games', 'Other Toys & Games', ARRAY[167, 168, 174, 175])
) AS m(parent_name, name, ids)
WHERE c."kind" = 'category'
  AND c."name" = m.name
  AND cardinality(c."snapmakerCatIds") = 0
  AND (
    (m.parent_name IS NULL AND c."parentId" IS NULL)
    OR EXISTS (
      SELECT 1 FROM "Category" p
      WHERE p."id" = c."parentId" AND p."parentId" IS NULL AND p."name" = m.parent_name
    )
  );
