-- The owner: the first admin, who alone may demote or delete other admins.
ALTER TABLE "User" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- Existing instances: the admin who has been there longest.
UPDATE "User" SET "isOwner" = true
WHERE id = (SELECT id FROM "User" WHERE role = 'ADMIN' ORDER BY "createdAt" ASC, id ASC LIMIT 1);
