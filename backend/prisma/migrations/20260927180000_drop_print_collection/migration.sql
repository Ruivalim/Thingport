-- Print.collection was a free-text field that nothing in the app ever set, left over from before
-- real collections (Collection/CollectionItem) existed. The storage template's {collection} token
-- read it, so that token always rendered "Uncollected"; it now reads real collection membership.
ALTER TABLE "Print" DROP COLUMN "collection";
