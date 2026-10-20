import { prisma } from "../db";
import { HttpError } from "../utils/fileUtils";
import { printOutsByIds } from "./printLoader";
import { relocatePrintsForToken } from "./printService";
import { toSystemCollectionOut, type CollectionOut, type SystemCollectionKey } from "../dto";
import { normalizeTags } from "../utils/tagNormalization";
import { createLog } from "./auditLog";
import type { Collection, Prisma } from "@prisma/client";

export function normalizeCollectionName(name: string): string {
  return name.trim().toLowerCase();
}

/** Checked first so the reserved-name message wins over "already exists". */
function assertCollectionNameNotReserved(name: string): void {
  const normalized = normalizeCollectionName(name);
  const reserved = Object.values(SYSTEM_COLLECTIONS).find((c) => normalizeCollectionName(c.name) === normalized);
  if (reserved) throw new HttpError(409, `"${reserved.name}" is reserved for the built-in collection`);
}

/** So a raw Prisma unique-constraint error never reaches the client. */
export async function assertCollectionNameAvailable(userId: string, name: string, excludeId?: string): Promise<void> {
  assertCollectionNameNotReserved(name);
  const existing = await prisma.collection.findFirst({
    where: {
      userId,
      nameNormalized: normalizeCollectionName(name),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (existing) throw new HttpError(409, `A collection named "${name.trim()}" already exists`);
}

/** Case-insensitive, so re-importing a collection reuses the same row. Safe to call twice at once:
 *  the one that loses the race to create it gets the row the other made. */
export async function findOrCreateCollectionByName(userId: string, name: string): Promise<Collection> {
  const trimmed = name.trim();
  const nameNormalized = normalizeCollectionName(trimmed);
  const existing = await prisma.collection.findFirst({ where: { userId, nameNormalized } });
  if (existing) return existing;
  try {
    return await prisma.collection.create({ data: { userId, name: trimmed, nameNormalized } });
  } catch (err) {
    const raced = await prisma.collection.findFirst({ where: { userId, nameNormalized } });
    if (raced) return raced;
    throw err;
  }
}

/** Skips prints already present, then moves files if the storage template has a {collection}
 * folder. */
export async function addPrintsToCollection(collectionId: string, printIds: string[]): Promise<void> {
  if (!printIds.length) return;
  const last = await prisma.collectionItem.findFirst({
    where: { collectionId },
    orderBy: { position: "desc" },
  });
  let nextPosition = (last?.position ?? -1) + 1;
  await prisma.collectionItem.createMany({
    data: printIds.map((printId) => ({ collectionId, printId, position: nextPosition++ })),
    skipDuplicates: true,
  });
  await relocatePrintsForToken("collection", printIds);
}

/** A new, empty collection. Shared by POST /collections and the MCP create_collection tool. */
export async function createCollection(
  userId: string,
  input: { name: string; description?: string | null; tags?: string[] },
): Promise<Collection> {
  await assertCollectionNameAvailable(userId, input.name);
  const collection = await prisma.collection.create({
    data: {
      userId,
      name: input.name,
      nameNormalized: normalizeCollectionName(input.name),
      description: input.description?.trim() || null,
      tags: normalizeTags(input.tags ?? []),
    },
  });
  void createLog({ userId, action: "collection_created", targetId: collection.id, details: { name: collection.name } });
  return collection;
}

/** Files the user's own models into one of their collections. Ids that aren't the user's models are
 *  left out and reported, as are models already in it. */
export async function addModelsToCollection(
  userId: string,
  collectionId: string,
  printIds: string[],
): Promise<{ collection: Collection; added: string[]; alreadyIn: string[]; notFound: string[] }> {
  if (isSystemCollectionId(collectionId)) throw new HttpError(400, "This collection can't be edited");
  const collection = await prisma.collection.findFirst({ where: { id: collectionId, userId } });
  if (!collection) throw new HttpError(404, "Collection not found");
  const owned = new Set(
    (await prisma.print.findMany({ where: { id: { in: printIds }, userId }, select: { id: true } })).map((p) => p.id),
  );
  const present = new Set(
    (
      await prisma.collectionItem.findMany({
        where: { collectionId, printId: { in: [...owned] } },
        select: { printId: true },
      })
    ).map((item) => item.printId),
  );
  const unique = [...new Set(printIds)];
  const added = unique.filter((id) => owned.has(id) && !present.has(id));
  await addPrintsToCollection(collection.id, [...owned]);
  if (owned.size) {
    void createLog({
      userId,
      action: "collection_item_added",
      targetId: collection.id,
      details: { name: collection.name, count: owned.size },
    });
  }
  return {
    collection,
    added,
    alreadyIn: unique.filter((id) => present.has(id)),
    notFound: unique.filter((id) => !owned.has(id)),
  };
}

// Favourites and History aren't real rows: they're derived from Print.favoritedAt/lastViewedAt.
// Their ids are reserved.

const SYSTEM_COLLECTION_COVER_LIMIT = 4;

type SystemCollectionMeta = { id: string; name: string; field: "favoritedAt" | "lastViewedAt" };

export const SYSTEM_COLLECTIONS: Record<SystemCollectionKey, SystemCollectionMeta> = {
  favorites: { id: "favorites", name: "Favourites", field: "favoritedAt" },
  history: { id: "history", name: "Browsing History", field: "lastViewedAt" },
};

const SYSTEM_COLLECTION_IDS = new Map<string, SystemCollectionKey>(
  (Object.keys(SYSTEM_COLLECTIONS) as SystemCollectionKey[]).map((key) => [SYSTEM_COLLECTIONS[key].id, key]),
);

export function systemCollectionKeyForId(id: string): SystemCollectionKey | null {
  return SYSTEM_COLLECTION_IDS.get(id) ?? null;
}

export function isSystemCollectionId(id: string): boolean {
  return SYSTEM_COLLECTION_IDS.has(id);
}

function systemCollectionWhere(userId: string, field: "favoritedAt" | "lastViewedAt"): Prisma.PrintWhereInput {
  return field === "favoritedAt" ? { userId, favoritedAt: { not: null } } : { userId, lastViewedAt: { not: null } };
}

function systemCollectionOrderBy(field: "favoritedAt" | "lastViewedAt"): Prisma.PrintOrderByWithRelationInput {
  return field === "favoritedAt" ? { favoritedAt: "desc" } : { lastViewedAt: "desc" };
}

export async function loadSystemCollectionOut(userId: string, key: SystemCollectionKey): Promise<CollectionOut> {
  const meta = SYSTEM_COLLECTIONS[key];
  const where = systemCollectionWhere(userId, meta.field);
  const [itemCount, coverRows] = await Promise.all([
    prisma.print.count({ where }),
    prisma.print.findMany({
      where,
      orderBy: systemCollectionOrderBy(meta.field),
      take: SYSTEM_COLLECTION_COVER_LIMIT,
      select: { id: true },
    }),
  ]);
  const coverIds = coverRows.map((r) => r.id);
  const printOuts = await printOutsByIds(userId, coverIds);
  const coverPrints = coverIds.map((id) => printOuts.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  return toSystemCollectionOut(meta.id, key, meta.name, itemCount, coverPrints);
}

export async function listSystemCollectionOuts(userId: string): Promise<CollectionOut[]> {
  return Promise.all(
    (Object.keys(SYSTEM_COLLECTIONS) as SystemCollectionKey[]).map((key) => loadSystemCollectionOut(userId, key)),
  );
}
