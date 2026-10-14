import { prisma } from "../db";
import { printOutsByIds } from "./printLoader";
import type { PrintOut } from "../dto";

// Models and collections rank via weighted generated tsvector columns (see schema.prisma). Tags are
// plain strings, so they're matched with ILIKE: exact, then prefix, then by model count.

const MODEL_RESULT_LIMIT = 6;
const COLLECTION_RESULT_LIMIT = 4;
const TAG_RESULT_LIMIT = 5;

export type SearchResult = {
  models: PrintOut[];
  /** More models match than `models` holds, for a "see all results" link. */
  has_more_models: boolean;
  collections: { id: string; name: string; item_count: number }[];
  tags: { tag: string; count: number }[];
};

const EMPTY_RESULT: SearchResult = { models: [], has_more_models: false, collections: [], tags: [] };

/** Every token becomes a prefix match ("prin:* & yod:*") so type-ahead works. Tokens are reduced
 *  to letters/digits since to_tsquery throws on stray syntax. Null when nothing usable is left. */
function buildPrefixTsQuery(raw: string): string | null {
  const tokens = raw
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter(Boolean)
    .slice(0, 8); // defensive cap
  if (!tokens.length) return null;
  return tokens.map((token) => `${token}:*`).join(" & ");
}

/** Paired with `ILIKE ... ESCAPE '\'`. */
function escapeLikeTerm(raw: string): string {
  return raw.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Without a limit, every match. */
async function searchPrintIds(userId: string, tsQuery: string, limit?: number): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "Print"
    WHERE "userId" = ${userId} AND "searchVector" @@ to_tsquery('simple'::regconfig, ${tsQuery})
    ORDER BY ts_rank("searchVector", to_tsquery('simple'::regconfig, ${tsQuery})) DESC, "name" ASC
    LIMIT ${limit ?? null}
  `;
  return rows.map((r) => r.id);
}

/** Ids of every model matching `rawQuery` as the search palette matches it, best first; for
 *  GET /prints?q=, so a "see all results" page lists what the palette found. */
export async function rankedPrintIds(userId: string, rawQuery: string): Promise<string[]> {
  const tsQuery = buildPrefixTsQuery(rawQuery);
  return tsQuery ? searchPrintIds(userId, tsQuery) : [];
}

async function searchCollections(
  userId: string,
  tsQuery: string,
  limit: number,
): Promise<{ id: string; name: string; item_count: number }[]> {
  const rows = await prisma.$queryRaw<{ id: string; name: string; item_count: bigint }[]>`
    SELECT c."id", c."name", count(ci."id")::bigint AS item_count
    FROM "Collection" c
    LEFT JOIN "CollectionItem" ci ON ci."collectionId" = c."id"
    WHERE c."userId" = ${userId} AND c."searchVector" @@ to_tsquery('simple'::regconfig, ${tsQuery})
    GROUP BY c."id", c."name", c."searchVector"
    ORDER BY ts_rank(c."searchVector", to_tsquery('simple'::regconfig, ${tsQuery})) DESC, c."name" ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ id: r.id, name: r.name, item_count: Number(r.item_count) }));
}

async function searchTags(userId: string, rawQuery: string, limit: number): Promise<{ tag: string; count: number }[]> {
  const likePattern = `%${escapeLikeTerm(rawQuery)}%`;
  const rows = await prisma.$queryRaw<{ tag: string; count: bigint }[]>`
    SELECT tag, count(*)::bigint AS count
    FROM "Print" p, unnest(p."tags") AS tag
    WHERE p."userId" = ${userId} AND tag ILIKE ${likePattern} ESCAPE '\'
    GROUP BY tag
    ORDER BY
      (lower(tag) = lower(${rawQuery})) DESC,
      (lower(tag) LIKE lower(${rawQuery}) || '%') DESC,
      count DESC,
      tag ASC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
}

/** `limit`, when given, replaces the model and collection limits; tags keep theirs. */
export async function search(userId: string, rawQuery: string, limit?: number): Promise<SearchResult> {
  const tsQuery = buildPrefixTsQuery(rawQuery);
  if (!tsQuery) return EMPTY_RESULT;

  const modelLimit = limit ?? MODEL_RESULT_LIMIT;
  const [modelIdsAndOne, collections, tags] = await Promise.all([
    // One extra says whether there are more.
    searchPrintIds(userId, tsQuery, modelLimit + 1),
    searchCollections(userId, tsQuery, limit ?? COLLECTION_RESULT_LIMIT),
    searchTags(userId, rawQuery.trim(), TAG_RESULT_LIMIT),
  ]);

  const modelIds = modelIdsAndOne.slice(0, modelLimit);
  const printOuts = await printOutsByIds(userId, modelIds);
  // Re-apply rank order; printOutsByIds returns an unordered Map.
  const models = modelIds.map((id) => printOuts.get(id)).filter((p): p is PrintOut => Boolean(p));

  return { models, has_more_models: modelIdsAndOne.length > modelLimit, collections, tags };
}
