-- MyMiniFactory as a fourth provider: its site category ids on categories; who the user is there; and their
-- MyMiniFactory session, for downloading the paid and login-only models in their library.
ALTER TABLE "Category" ADD COLUMN "myminifactoryCatIds" INTEGER[] NOT NULL DEFAULT '{}';
CREATE INDEX "Category_myminifactoryCatIds_idx" ON "Category" USING GIN ("myminifactoryCatIds");

ALTER TABLE "User" ADD COLUMN "myminifactoryUsername" TEXT,
ADD COLUMN "myminifactoryCookie" TEXT,
ADD COLUMN "myminifactoryRejectedAt" TIMESTAMP(3);

-- Adds MyMiniFactory's category ids to the starter categories of users who signed up before they were in
-- seedData/defaultCategories.ts, so their MyMiniFactory imports are categorized too. A starter category is found by
-- its name, and a subcategory by its top-level parent's name as well; one a user renamed, moved or deleted is
-- skipped, and ids a user already set are kept.
UPDATE "Category" AS c
SET "myminifactoryCatIds" = m.ids
FROM (VALUES
  (NULL::text, '3D Printer', ARRAY[366]),
  ('3D Printer', '3D Printer Accessories', ARRAY[1001, 1000]),
  ('3D Printer', '3D Printer Parts', ARRAY[493, 494, 495, 588, 590, 591, 592, 593, 594, 595, 596, 597, 598, 599, 600, 601, 602, 603, 604, 605, 606, 607, 608, 672, 949, 1271]),
  ('3D Printer', 'Test Models', ARRAY[960]),
  ('Art', 'Signs & Logos', ARRAY[105]),
  ('Art', 'Sculptures', ARRAY[112, 355]),
  (NULL::text, 'Education', ARRAY[86]),
  ('Education', 'Biology', ARRAY[154, 373, 997, 1045]),
  ('Education', 'Chemistry', ARRAY[162]),
  ('Education', 'Engineering', ARRAY[953, 241, 374, 1042]),
  ('Education', 'Geography', ARRAY[164]),
  ('Education', 'Mathematics', ARRAY[163, 1035]),
  ('Education', 'Physics & Astronomy', ARRAY[165, 558, 1036]),
  ('Education', 'Other Education Models', ARRAY[344, 166, 109, 1034, 969, 970, 971, 972, 973]),
  (NULL::text, 'Fashion', ARRAY[58]),
  ('Fashion', 'Bags', ARRAY[143]),
  ('Fashion', 'Clothes', ARRAY[169]),
  ('Fashion', 'Footwear', ARRAY[140]),
  ('Fashion', 'Glasses', ARRAY[147]),
  ('Fashion', 'Earrings', ARRAY[405]),
  ('Fashion', 'Rings', ARRAY[406]),
  ('Fashion', 'Jewelry', ARRAY[291, 148, 426, 359, 430, 145, 439]),
  ('Fashion', 'Other Fashion Models', ARRAY[357]),
  ('Hobby & DIY', 'Electronics', ARRAY[59, 943, 328, 378, 329, 941, 275, 113, 326, 647, 375, 488, 489, 490, 491, 492, 648, 507, 633, 670]),
  ('Hobby & DIY', 'Music', ARRAY[68]),
  ('Hobby & DIY', 'RC', ARRAY[120, 1273, 1274, 1275, 1276, 1277, 1278, 1279, 1280, 1281, 1282, 1283, 1291, 1292, 1299, 360, 975, 983, 984, 985, 987, 976, 988, 992, 977, 990, 991]),
  ('Hobby & DIY', 'Robotics', ARRAY[393, 429, 999]),
  ('Hobby & DIY', 'Sport & Outdoors', ARRAY[56, 69, 71, 966, 967, 968, 114, 342, 550, 551, 962]),
  (NULL::text, 'Household', ARRAY[57]),
  ('Household', 'Decor', ARRAY[335, 389, 399, 372, 398, 362, 336]),
  ('Household', 'Festivities', ARRAY[385, 384, 634, 635, 636]),
  ('Household', 'Garden', ARRAY[150]),
  ('Household', 'Office', ARRAY[382, 377]),
  ('Household', 'Other Household Models', ARRAY[370, 381, 371, 369, 397, 88, 445, 452, 502, 823, 824, 825, 826, 827, 833, 942, 828, 829, 830, 831, 832, 902, 944, 947, 948, 775]),
  (NULL::text, 'Miniatures', ARRAY[1015]),
  ('Miniatures', 'Architecture', ARRAY[787, 1153, 1158, 913]),
  ('Miniatures', 'People', ARRAY[785, 780, 782, 783, 784, 1145]),
  ('Miniatures', 'Other Miniatures', ARRAY[617, 786, 1306, 1310, 1311, 1312, 1313, 1304, 1319, 1325, 1324]),
  (NULL::text, 'Props & Cosplays', ARRAY[119]),
  ('Props & Cosplays', 'Costumes', ARRAY[340]),
  ('Props & Cosplays', 'Masks & Helmets', ARRAY[155]),
  ('Props & Cosplays', 'Cosplay Weapons', ARRAY[542, 156, 304]),
  (NULL::text, 'Tools', ARRAY[252]),
  ('Tools', 'Gadgets', ARRAY[94, 330, 368, 388]),
  ('Tools', 'Organizers', ARRAY[149]),
  ('Tools', 'Medical Tools', ARRAY[288, 110, 1259, 1004, 1022, 1023, 1024, 1006, 1005, 1007, 1008, 1025, 1028, 1029, 1031, 1032, 1033, 1091]),
  (NULL::text, 'Toys & Games', ARRAY[60]),
  ('Toys & Games', 'Board Games', ARRAY[1014, 523, 1016]),
  ('Toys & Games', 'Characters', ARRAY[104, 67, 435, 442, 496, 532, 533, 436, 536, 537, 538, 539, 540, 541, 543, 544, 733, 927, 957, 1159, 1309]),
  ('Toys & Games', 'Puzzles', ARRAY[100]),
  ('Toys & Games', 'Other Toys & Games', ARRAY[462, 1308, 1307, 529])
) AS m(parent_name, name, ids)
WHERE c."kind" = 'category'
  AND c."name" = m.name
  AND cardinality(c."myminifactoryCatIds") = 0
  AND (
    (m.parent_name IS NULL AND c."parentId" IS NULL)
    OR EXISTS (
      SELECT 1 FROM "Category" p
      WHERE p."id" = c."parentId" AND p."parentId" IS NULL AND p."name" = m.parent_name
    )
  );
