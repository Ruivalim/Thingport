-- MakerOnline as a sixth provider: its site category ids on categories; the user's MakerOnline sign-in; and the
-- imports waiting for Thingport Grab, which alone can get MakerOnline's download links signed.
ALTER TABLE "Category" ADD COLUMN "makeronlineCatIds" INTEGER[] NOT NULL DEFAULT '{}';
CREATE INDEX "Category_makeronlineCatIds_idx" ON "Category" USING GIN ("makeronlineCatIds");

ALTER TABLE "User" ADD COLUMN "makeronlineToken" TEXT,
ADD COLUMN "makeronlineTokenExpires" TIMESTAMP(3),
ADD COLUMN "makeronlineUserId" TEXT,
ADD COLUMN "makeronlineRejectedAt" TIMESTAMP(3);

CREATE TABLE "GrabImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'url',
    "collectionId" TEXT,
    "categoryId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrabImport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrabImport_userId_url_key" ON "GrabImport"("userId", "url");
ALTER TABLE "GrabImport" ADD CONSTRAINT "GrabImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Adds MakerOnline's category ids to the starter categories of users who signed up before they were in
-- seedData/defaultCategories.ts, as the Snapmaker migration did.
UPDATE "Category" AS c
SET "makeronlineCatIds" = m.ids
FROM (VALUES
  (NULL::text, '3D Printer', ARRAY[33]),
  ('3D Printer', '3D Printer Accessories', ARRAY[34]),
  ('3D Printer', '3D Printer Parts', ARRAY[35]),
  ('3D Printer', 'Test Models', ARRAY[36]),
  (NULL::text, 'Art', ARRAY[70]),
  ('Art', '2D Art', ARRAY[75]),
  ('Art', 'Coin & Badges', ARRAY[72]),
  ('Art', 'Signs & Logos', ARRAY[73]),
  ('Art', 'Sculptures', ARRAY[74]),
  ('Art', 'Other Art Models', ARRAY[71, 105]),
  (NULL::text, 'Education', ARRAY[82]),
  ('Education', 'Biology', ARRAY[89]),
  ('Education', 'Chemistry', ARRAY[88]),
  ('Education', 'Engineering', ARRAY[86]),
  ('Education', 'Geography', ARRAY[87]),
  ('Education', 'Mathematics', ARRAY[84]),
  ('Education', 'Physics & Astronomy', ARRAY[85]),
  ('Education', 'Other Education Models', ARRAY[83]),
  (NULL::text, 'Fashion', ARRAY[76]),
  ('Fashion', 'Bags', ARRAY[80]),
  ('Fashion', 'Clothes', ARRAY[79]),
  ('Fashion', 'Jewelry', ARRAY[78]),
  ('Fashion', 'Other Fashion Models', ARRAY[77, 81]),
  (NULL::text, 'Hobby & DIY', ARRAY[46]),
  ('Hobby & DIY', 'Electronics', ARRAY[48]),
  ('Hobby & DIY', 'Music', ARRAY[49]),
  ('Hobby & DIY', 'RC', ARRAY[51]),
  ('Hobby & DIY', 'Robotics', ARRAY[52]),
  ('Hobby & DIY', 'Sport & Outdoors', ARRAY[50]),
  ('Hobby & DIY', 'Vehicles', ARRAY[47]),
  ('Hobby & DIY', 'Other Hobby & DIY', ARRAY[54, 53]),
  (NULL::text, 'Household', ARRAY[37]),
  ('Household', 'Decor', ARRAY[38, 43]),
  ('Household', 'Festivities', ARRAY[42]),
  ('Household', 'Garden', ARRAY[39]),
  ('Household', 'Office', ARRAY[41]),
  ('Household', 'Pets', ARRAY[44]),
  ('Household', 'Other Household Models', ARRAY[45, 40]),
  (NULL::text, 'Miniatures', ARRAY[95]),
  ('Miniatures', 'Architecture', ARRAY[100]),
  ('Miniatures', 'Creatures', ARRAY[99]),
  ('Miniatures', 'People', ARRAY[101]),
  ('Miniatures', 'Other Miniatures', ARRAY[96, 97, 98]),
  (NULL::text, 'Props & Cosplays', ARRAY[90]),
  ('Props & Cosplays', 'Costumes', ARRAY[94]),
  ('Props & Cosplays', 'Masks & Helmets', ARRAY[93]),
  ('Props & Cosplays', 'Other Props & Cosplays', ARRAY[92, 91]),
  (NULL::text, 'Tools', ARRAY[55]),
  ('Tools', 'Gadgets', ARRAY[56]),
  ('Tools', 'Hand Tools', ARRAY[60]),
  ('Tools', 'Machine Tools', ARRAY[59]),
  ('Tools', 'Medical Tools', ARRAY[58]),
  ('Tools', 'Organizers', ARRAY[61]),
  ('Tools', 'Other Tools', ARRAY[57]),
  (NULL::text, 'Toys & Games', ARRAY[62]),
  ('Toys & Games', 'Board Games', ARRAY[68]),
  ('Toys & Games', 'Characters', ARRAY[104, 69, 110]),
  ('Toys & Games', 'Outdoor Toys', ARRAY[66]),
  ('Toys & Games', 'Puzzles', ARRAY[65]),
  ('Toys & Games', 'Construction Sets', ARRAY[67]),
  ('Toys & Games', 'Other Toys & Games', ARRAY[63, 64]),
  (NULL::text, 'Generative 3D Model', ARRAY[113, 114, 115, 117])
) AS m(parent_name, name, ids)
WHERE c."kind" = 'category'
  AND c."name" = m.name
  AND cardinality(c."makeronlineCatIds") = 0
  AND (
    (m.parent_name IS NULL AND c."parentId" IS NULL)
    OR EXISTS (
      SELECT 1 FROM "Category" p
      WHERE p."id" = c."parentId" AND p."parentId" IS NULL AND p."name" = m.parent_name
    )
  );
