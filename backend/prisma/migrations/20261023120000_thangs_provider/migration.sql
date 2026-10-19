-- Thangs as a ninth provider: its category paths on categories ("Parent/Child"; Thangs has no category ids), and the
-- user's Thangs sign-in: the accessToken cookie and the refreshToken that renews it, sent by Thingport Grab or pasted.
ALTER TABLE "Category" ADD COLUMN "thangsCatIds" TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX "Category_thangsCatIds_idx" ON "Category" USING GIN ("thangsCatIds");

ALTER TABLE "User" ADD COLUMN "thangsToken" TEXT,
ADD COLUMN "thangsRefreshToken" TEXT,
ADD COLUMN "thangsExpiresAt" TIMESTAMP(3),
ADD COLUMN "thangsUserId" TEXT,
ADD COLUMN "thangsRejectedAt" TIMESTAMP(3);

-- Adds Thangs' category paths to the starter categories of users who signed up before they were in
-- seedData/defaultCategories.ts, so their Thangs imports are categorized too. A starter category is found by its
-- name, and a subcategory by its top-level parent's name as well; one a user renamed, moved or deleted is skipped, and
-- paths a user already set are kept.
UPDATE "Category" AS c
SET "thangsCatIds" = m.ids
FROM (VALUES
  (NULL::text, '3D Printer', ARRAY['3D Printer Parts & Accessories']),
  ('3D Printer', '3D Printer Accessories', ARRAY['3D Printer Parts & Accessories/Enclosures & Racks', '3D Printer Parts & Accessories/Filament Management', '3D Printer Parts & Accessories/Maintenance Tools', '3D Printer Parts & Accessories/Print Bed Accessories']),
  ('3D Printer', '3D Printer Parts', ARRAY['3D Printer Parts & Accessories/Printer Upgrades']),
  ('3D Printer', 'Test Models', ARRAY['3D Printer Parts & Accessories/Test Prints & Calibration']),
  (NULL::text, 'Art', ARRAY['Art & Decor']),
  ('Art', '2D Art', ARRAY['Art & Decor/Wall Art']),
  ('Art', 'Coin & Badges', ARRAY['Art & Decor/Trophies & Awards']),
  ('Art', 'Sculptures', ARRAY['Art & Decor/Sculptures & Statues', 'Art & Decor/Busts']),
  ('Art', 'Other Art Models', ARRAY['Art & Decor/Textured & Patterned']),
  (NULL::text, 'Education', ARRAY['Educational & Scientific']),
  ('Education', 'Biology', ARRAY['Educational & Scientific/Biology', 'Educational & Scientific/Human Anatomy & Medical']),
  ('Education', 'Chemistry', ARRAY['Educational & Scientific/Chemistry']),
  ('Education', 'Geography', ARRAY['Educational & Scientific/Geology']),
  ('Education', 'Physics & Astronomy', ARRAY['Educational & Scientific/Physics', 'Educational & Scientific/Astronomy']),
  (NULL::text, 'Fashion', ARRAY['Fashion & Jewelry']),
  ('Fashion', 'Clothes', ARRAY['Fashion & Jewelry/Clothing']),
  ('Fashion', 'Earrings', ARRAY['Fashion & Jewelry/Earrings']),
  ('Fashion', 'Jewelry', ARRAY['Fashion & Jewelry/Necklaces', 'Fashion & Jewelry/Bracelets', 'Fashion & Jewelry/Jewelry Storage']),
  ('Fashion', 'Rings', ARRAY['Fashion & Jewelry/Rings']),
  ('Fashion', 'Other Fashion Models', ARRAY['Fashion & Jewelry/Accessories']),
  (NULL::text, 'Hobby & DIY', ARRAY['Hobby & DIY']),
  ('Hobby & DIY', 'Electronics', ARRAY['Hobby & DIY/Electronics']),
  ('Hobby & DIY', 'Music', ARRAY['Hobby & DIY/Music & Audio']),
  ('Hobby & DIY', 'RC', ARRAY['Hobby & DIY/RC']),
  ('Hobby & DIY', 'Robotics', ARRAY['Hobby & DIY/Robotics']),
  ('Hobby & DIY', 'Sport & Outdoors', ARRAY['Hobby & DIY/Outdoor', 'Health & Fitness/Sports']),
  ('Hobby & DIY', 'Vehicles', ARRAY['Hobby & DIY/Automotive']),
  ('Hobby & DIY', 'Other Hobby & DIY', ARRAY['Hobby & DIY/Baking and Cooking', 'Hobby & DIY/Photography & Video']),
  (NULL::text, 'Household', ARRAY['Home & Garden']),
  ('Household', 'Decor', ARRAY['Home & Garden/Home Decor & Accessories', 'Home & Garden/Living Room', 'Home & Garden/Bedroom', 'Art & Decor/Lamps & Lighting', 'Art & Decor/Vases & Planters']),
  ('Household', 'Festivities', ARRAY['Seasonal', 'Seasonal/Beach & Summer', 'Seasonal/Easter & Spring', 'Seasonal/Halloween & Fall', 'Seasonal/Holidays & Winter']),
  ('Household', 'Garden', ARRAY['Home & Garden/Outdoor & Garden']),
  ('Household', 'Office', ARRAY['Tools & Organizers/Office & Desk']),
  ('Household', 'Pets', ARRAY['Home & Garden/Pet Accessories']),
  ('Household', 'Other Household Models', ARRAY['Home & Garden/Bathroom', 'Home & Garden/Kitchen & Dining', 'Health & Fitness', 'Health & Fitness/Wellness', 'Health & Fitness/Accessibility']),
  (NULL::text, 'Miniatures', ARRAY['Miniatures & Tabletop']),
  ('Miniatures', 'Architecture', ARRAY['Miniatures & Tabletop/Dioramas & Scenery']),
  ('Miniatures', 'Creatures', ARRAY['Miniatures & Tabletop/Fantasy Miniatures']),
  ('Miniatures', 'Other Miniatures', ARRAY['Miniatures & Tabletop/Sci-Fi Miniatures', 'Miniatures & Tabletop/War & Tactics', 'Miniatures & Tabletop/Naval', 'Miniatures & Tabletop/Airplanes', 'Miniatures & Tabletop/Trains', 'Miniatures & Tabletop/Vehicles', 'Miniatures & Tabletop/Accessories']),
  (NULL::text, 'Props & Cosplays', ARRAY['Costumes & Cosplay']),
  ('Props & Cosplays', 'Costumes', ARRAY['Costumes & Cosplay/Full Outfits', 'Costumes & Cosplay/Character Specific']),
  ('Props & Cosplays', 'Masks & Helmets', ARRAY['Costumes & Cosplay/Masks & Helmets']),
  ('Props & Cosplays', 'Cosplay Weapons', ARRAY['Costumes & Cosplay/Armor & Props']),
  ('Props & Cosplays', 'Other Props & Cosplays', ARRAY['Costumes & Cosplay/Accessories']),
  (NULL::text, 'Tools', ARRAY['Tools & Organizers', 'Functional Prints']),
  ('Tools', 'Hand Tools', ARRAY['Tools & Organizers/Utility & Tools', 'Functional Prints/Tools']),
  ('Tools', 'Machine Tools', ARRAY['Functional Prints/Jigs & Fixtures']),
  ('Tools', 'Organizers', ARRAY['Tools & Organizers/Gridfinity', 'Tools & Organizers/Multiboard', 'Tools & Organizers/Storage Solutions', 'Tools & Organizers/Shop & Garage']),
  ('Tools', 'Other Tools', ARRAY['Functional Prints/Mechanical Parts', 'Functional Prints/Replacement Parts', 'Functional Prints/Customizable']),
  (NULL::text, 'Toys & Games', ARRAY['Toys & Games']),
  ('Toys & Games', 'Board Games', ARRAY['Toys & Games/Board Game Accessories']),
  ('Toys & Games', 'Characters', ARRAY['Toys & Games/Action Figures & Collectibles', 'Toys & Games/Articulated']),
  ('Toys & Games', 'Outdoor Toys', ARRAY['Toys & Games/Outdoor Toys']),
  ('Toys & Games', 'Puzzles', ARRAY['Toys & Games/Puzzles']),
  ('Toys & Games', 'Other Toys & Games', ARRAY['Toys & Games/Educational Toys', 'Toys & Games/Fidget Toys', 'Toys & Games/Keychains', 'Toys & Games/Video Games']),
  ('Generative 3D Model', 'Hueforge & Lithophane', ARRAY['Art & Decor/Hueforge', 'Art & Decor/Lithophanes'])
) AS m(parent_name, name, ids)
WHERE c."kind" = 'category'
  AND c."name" = m.name
  AND cardinality(c."thangsCatIds") = 0
  AND (
    (m.parent_name IS NULL AND c."parentId" IS NULL)
    OR EXISTS (
      SELECT 1 FROM "Category" p
      WHERE p."id" = c."parentId" AND p."parentId" IS NULL AND p."name" = m.parent_name
    )
  );
