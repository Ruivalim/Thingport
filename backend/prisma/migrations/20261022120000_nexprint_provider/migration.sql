-- NexPrint as an eighth provider: its site category ids on categories, kept as text since they're 16 digits long;
-- and the user's NexPrint sign-in (the auth_token cookie, sent as a Bearer token), sent by Thingport Grab or pasted.
ALTER TABLE "Category" ADD COLUMN "nexprintCatIds" TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX "Category_nexprintCatIds_idx" ON "Category" USING GIN ("nexprintCatIds");

ALTER TABLE "User" ADD COLUMN "nexprintToken" TEXT,
ADD COLUMN "nexprintExpiresAt" TIMESTAMP(3),
ADD COLUMN "nexprintRejectedAt" TIMESTAMP(3);

-- Adds NexPrint's category ids to the starter categories of users who signed up before they were in
-- seedData/defaultCategories.ts, so their NexPrint imports are categorized too. A starter category is found by its
-- name, and a subcategory by its top-level parent's name as well; one a user renamed, moved or deleted is skipped, and
-- ids a user already set are kept.
UPDATE "Category" AS c
SET "nexprintCatIds" = m.ids
FROM (VALUES
  (NULL::text, '3D Printer', ARRAY['1422473859022863']),
  ('3D Printer', '3D Printer Accessories', ARRAY['1422473859022858']),
  ('3D Printer', '3D Printer Parts', ARRAY['2']),
  ('3D Printer', 'Test Models', ARRAY['1422473859022859']),
  (NULL::text, 'Art', ARRAY['1422473858908165']),
  ('Art', '2D Art', ARRAY['1422473859022850']),
  ('Art', 'Coin & Badges', ARRAY['1422473859022853']),
  ('Art', 'Signs & Logos', ARRAY['1422473859022855']),
  ('Art', 'Sculptures', ARRAY['1422473859022854']),
  ('Art', 'Other Art Models', ARRAY['1422473859022851', '1422473859022852', '1422473859022857']),
  ('Education', 'Other Education Models', ARRAY['1422473859014665']),
  (NULL::text, 'Fashion', ARRAY['1422473858908164']),
  ('Fashion', 'Bags', ARRAY['1422473859014676']),
  ('Fashion', 'Clothes', ARRAY['1422473859014674']),
  ('Fashion', 'Footwear', ARRAY['1422473859022848']),
  ('Fashion', 'Other Fashion Models', ARRAY['1422473859014675', '1422473859022849']),
  (NULL::text, 'Hobby & DIY', ARRAY['1422473858908163']),
  ('Hobby & DIY', 'Electronics', ARRAY['1422473858908161', '1422473859006469', '1422473859014657', '1422473859014658', '1422473859014659', '1422473859014660']),
  ('Hobby & DIY', 'Music', ARRAY['1422473859022856']),
  ('Hobby & DIY', 'RC', ARRAY['1422473859014656']),
  ('Hobby & DIY', 'Sport & Outdoors', ARRAY['1422473859014671']),
  ('Hobby & DIY', 'Vehicles', ARRAY['1422473859014672']),
  ('Hobby & DIY', 'Other Hobby & DIY', ARRAY['1422473859014673']),
  (NULL::text, 'Household', ARRAY['1422473858908162']),
  ('Household', 'Decor', ARRAY['1422473859014662']),
  ('Household', 'Garden', ARRAY['1422473859014668']),
  ('Household', 'Office', ARRAY['1422473859014664']),
  ('Household', 'Pets', ARRAY['1422473859014669']),
  ('Household', 'Other Household Models', ARRAY['1422473859014663', '1422473859014666', '1422473859014667', '1422473859014670']),
  (NULL::text, 'Miniatures', ARRAY['1422473859006464']),
  (NULL::text, 'Props & Cosplays', ARRAY['1422473859006467']),
  (NULL::text, 'Tools', ARRAY['1422473858908166']),
  ('Tools', 'Organizers', ARRAY['1422473859014661']),
  ('Tools', 'Other Tools', ARRAY['1422473859022860', '1422473859022861', '1422473859022862']),
  (NULL::text, 'Toys & Games', ARRAY['1422473858908160']),
  ('Toys & Games', 'Board Games', ARRAY['1422473859006466']),
  ('Toys & Games', 'Construction Sets', ARRAY['1422473859006465']),
  ('Toys & Games', 'Other Toys & Games', ARRAY['1422473859006468'])
) AS m(parent_name, name, ids)
WHERE c."kind" = 'category'
  AND c."name" = m.name
  AND cardinality(c."nexprintCatIds") = 0
  AND (
    (m.parent_name IS NULL AND c."parentId" IS NULL)
    OR EXISTS (
      SELECT 1 FROM "Category" p
      WHERE p."id" = c."parentId" AND p."parentId" IS NULL AND p."name" = m.parent_name
    )
  );
