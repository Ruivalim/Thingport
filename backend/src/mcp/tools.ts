import { z } from "zod";
import { prisma } from "../db";
import { PUBLIC_URL } from "../config";
import { toAuthorOut, type PrintOut } from "../dto";
import { HttpError } from "../utils/fileUtils";
import { SYSTEM_COLLECTIONS, systemCollectionKeyForId } from "../services/collectionService";
import { getDashboardSummary } from "../services/dashboardService";
import { printOutById } from "../services/printLoader";
import { listPrints, listTagsOf, PRINT_SORT_MODES, SELF_AUTHOR_ID } from "../services/printQuery";
import { search } from "../services/searchService";

// The tools /api/mcp offers. Each runs as the token's user, through the same services as the REST
// API, so it sees exactly that user's library. Outputs are trimmed to what an assistant can use:
// no image or file URLs, which need a session to open anyway.
//
// `readOnly` is what lets an API token reach a tool at all over POST (see routes/mcp.ts). A tool that
// writes must say so, and is off for every token until its user ticks it.

export type McpToolContext = { userId: string };

export type McpToolDefinition = {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  inputSchema: z.ZodRawShape;
  run: (ctx: McpToolContext, args: Record<string, unknown>) => Promise<unknown>;
};

const MAX_PAGE = 50;
const DEFAULT_PAGE = 20;

const pageArgs = {
  limit: z.number().int().min(1).max(MAX_PAGE).optional().describe(`How many to return, up to ${MAX_PAGE}.`),
  offset: z.number().int().min(0).optional().describe("How many to skip, for the next page."),
};

/** The model's page in the Thingport web app, when the instance knows its own address. */
function modelUrl(id: string): string | null {
  return PUBLIC_URL ? `${PUBLIC_URL}/models/${id}` : null;
}

function modelSummary(print: PrintOut) {
  return {
    id: print.id,
    title: print.title || print.name,
    creator: print.author?.name ?? print.creator,
    tags: print.tags,
    category: print.category_name,
    source: print.source_provider ? { provider: print.source_provider, url: print.source_url } : null,
    file_count: print.plates.length,
    view_count: print.view_count,
    print_count: print.print_count,
    favorite: print.is_favorite,
    added_at: print.created_at,
    url: modelUrl(print.id),
  };
}

function page(prints: PrintOut[], total: number, hasMore: boolean, nextOffset: number) {
  return { models: prints.map(modelSummary), total, next_offset: hasMore ? nextOffset : null };
}

const searchModels: McpToolDefinition = {
  name: "search_models",
  title: "Search models",
  description:
    "Search the library by words in a model's title, tags, creator or description. Also returns matching " +
    "collections and tags. Start here to find a model by what it is.",
  readOnly: true,
  inputSchema: {
    query: z.string().min(1).describe("Words to look for, e.g. 'benchy' or 'cable clip'."),
    limit: z.number().int().min(1).max(25).optional().describe("How many models to return, up to 25."),
  },
  async run({ userId }, args) {
    const result = await search(userId, args.query as string, args.limit as number | undefined);
    return {
      models: result.models.map(modelSummary),
      more_models: result.has_more_models,
      collections: result.collections.map((c) => ({ id: c.id, name: c.name, model_count: c.item_count })),
      tags: result.tags.map((t) => ({ tag: t.tag, model_count: t.count })),
    };
  },
};

const listModels: McpToolDefinition = {
  name: "list_models",
  title: "List models",
  description:
    "List models, optionally filtered by tags, category, collection or author, newest first unless sorted " +
    "otherwise. Filters combine: a model must match every one given.",
  readOnly: true,
  inputSchema: {
    query: z.string().optional().describe("Only models matching these words, as in search_models."),
    tags: z.array(z.string()).optional().describe("Only models that have every one of these tags."),
    category_id: z.string().optional().describe("Only models in this category (an id from list_categories)."),
    collection_id: z
      .string()
      .optional()
      .describe("Only models in this collection (an id from list_collections, or 'favorites' or 'history')."),
    author_id: z
      .string()
      .optional()
      .describe(`Only models by this author (an id from a model's author), or '${SELF_AUTHOR_ID}' for the user's own.`),
    sort: z
      .enum(PRINT_SORT_MODES)
      .optional()
      .describe("newest (default), popular (most viewed), downloads (most printed), or relevance (needs query)."),
    ...pageArgs,
  },
  async run({ userId }, args) {
    const result = await listPrints(
      userId,
      {
        q: args.query as string | undefined,
        tags: args.tags as string[] | undefined,
        categoryIds: args.category_id ? [args.category_id as string] : [],
        collectionId: args.collection_id as string | undefined,
        authorId: args.author_id as string | undefined,
      },
      {
        sort: args.sort as (typeof PRINT_SORT_MODES)[number] | undefined,
        limit: (args.limit as number | undefined) ?? DEFAULT_PAGE,
        offset: args.offset as number | undefined,
      },
    );
    return page(result.prints, result.total, result.hasMore, result.nextOffset);
  },
};

const getModel: McpToolDefinition = {
  name: "get_model",
  title: "Get a model",
  description:
    "Everything about one model: its description, files, tags, category, author, collections, where it was " +
    "imported from, and how often it was viewed and printed.",
  readOnly: true,
  inputSchema: { id: z.string().min(1).describe("The model's id, from search_models or list_models.") },
  async run({ userId }, args) {
    // printOutById, not GET /print/:id: an assistant looking at a model isn't the user viewing it, so
    // its view count and Browsing History stay as they are.
    const print = await printOutById(userId, args.id as string);
    const memberships = await prisma.collectionItem.findMany({
      where: { printId: print.id, collection: { userId } },
      select: { collection: { select: { id: true, name: true } } },
    });
    return {
      ...modelSummary(print),
      description: print.notes,
      author: print.author
        ? {
            id: print.author.id,
            name: print.author.name,
            handle: print.author.handle,
            provider: print.author.provider,
            links: print.author.links,
          }
        : null,
      files: print.plates.map((plate) => ({ name: plate.filename, size_bytes: plate.size })),
      supporting_file_count: print.supporting_file_count,
      total_size_bytes: print.total_size,
      collections: memberships.map((m) => m.collection),
    };
  },
};

const listCollections: McpToolDefinition = {
  name: "list_collections",
  title: "List collections",
  description: "The user's collections, with how many models each holds, plus Favourites and Browsing History.",
  readOnly: true,
  inputSchema: {},
  async run({ userId }) {
    const [collections, favoriteCount, historyCount] = await Promise.all([
      prisma.collection.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { items: true } }, sync: { select: { provider: true, sourceUrl: true } } },
      }),
      prisma.print.count({ where: { userId, favoritedAt: { not: null } } }),
      prisma.print.count({ where: { userId, lastViewedAt: { not: null } } }),
    ]);
    return {
      collections: [
        { id: SYSTEM_COLLECTIONS.favorites.id, name: SYSTEM_COLLECTIONS.favorites.name, model_count: favoriteCount },
        { id: SYSTEM_COLLECTIONS.history.id, name: SYSTEM_COLLECTIONS.history.name, model_count: historyCount },
        ...collections.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description,
          tags: c.tags,
          model_count: c._count.items,
          synced_with: c.sync ? { provider: c.sync.provider, url: c.sync.sourceUrl } : null,
        })),
      ],
    };
  },
};

const getCollection: McpToolDefinition = {
  name: "get_collection",
  title: "Get a collection",
  description: "One collection and the models in it, a page at a time.",
  readOnly: true,
  inputSchema: {
    id: z.string().min(1).describe("The collection's id, from list_collections ('favorites' and 'history' work too)."),
    ...pageArgs,
  },
  async run({ userId }, args) {
    const id = args.id as string;
    const systemKey = systemCollectionKeyForId(id);
    const collection = systemKey
      ? { id, name: SYSTEM_COLLECTIONS[systemKey].name, description: null, tags: [] as string[] }
      : await prisma.collection.findFirst({
          where: { id, userId },
          select: { id: true, name: true, description: true, tags: true },
        });
    if (!collection) throw new HttpError(404, "Collection not found");
    const result = await listPrints(
      userId,
      { collectionId: id },
      { limit: (args.limit as number | undefined) ?? DEFAULT_PAGE, offset: args.offset as number | undefined },
    );
    return { ...collection, ...page(result.prints, result.total, result.hasMore, result.nextOffset) };
  },
};

const listTags: McpToolDefinition = {
  name: "list_tags",
  title: "List tags",
  description: "Every tag in the library, so models can then be listed by the exact tag names it uses.",
  readOnly: true,
  inputSchema: {},
  async run({ userId }) {
    return { tags: await listTagsOf(userId, {}) };
  },
};

const listCategories: McpToolDefinition = {
  name: "list_categories",
  title: "List categories",
  description:
    "The user's category and folder tree, with how many models each holds directly. Use an id with " +
    "list_models' category_id.",
  readOnly: true,
  inputSchema: {},
  async run({ userId }) {
    const [categories, counts] = await Promise.all([
      prisma.category.findMany({
        where: { userId },
        orderBy: [{ position: "asc" }, { name: "asc" }],
        select: { id: true, name: true, parentId: true, kind: true },
      }),
      prisma.print.groupBy({ by: ["categoryId"], where: { userId, categoryId: { not: null } }, _count: true }),
    ]);
    const countById = new Map(counts.map((c) => [c.categoryId, c._count]));
    return {
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        parent_id: c.parentId,
        kind: c.kind,
        model_count: countById.get(c.id) ?? 0,
      })),
    };
  },
};

const getAuthor: McpToolDefinition = {
  name: "get_author",
  title: "Get an author",
  description: "A designer the library has models from: who they are, where to find them, and their models here.",
  readOnly: true,
  inputSchema: {
    id: z.string().min(1).describe("The author's id, from a model's author."),
    ...pageArgs,
  },
  async run({ userId }, args) {
    // Authors are shared across users; only this user's models of theirs are listed.
    const author = await prisma.author.findUnique({ where: { id: args.id as string } });
    if (!author) throw new HttpError(404, "Author not found");
    const out = toAuthorOut(author);
    const result = await listPrints(
      userId,
      { authorId: author.id },
      { limit: (args.limit as number | undefined) ?? DEFAULT_PAGE, offset: args.offset as number | undefined },
    );
    return {
      id: out.id,
      name: out.name,
      handle: out.handle,
      provider: out.provider,
      bio: out.bio_translated ?? out.bio,
      links: out.links,
      ...page(result.prints, result.total, result.hasMore, result.nextOffset),
    };
  },
};

const libraryStats: McpToolDefinition = {
  name: "library_stats",
  title: "Library stats",
  description:
    "How big the library is (models, collections, authors, categories) and its most viewed, most printed and " +
    "most recently added models, top authors and the sites models came from.",
  readOnly: true,
  inputSchema: {},
  async run({ userId }) {
    const summary = await getDashboardSummary(userId);
    const model = (m: (typeof summary.topViewed)[number]) => ({
      id: m.id,
      title: m.name,
      view_count: m.viewCount,
      print_count: m.printCount,
      added_at: m.createdAt.toISOString(),
      url: modelUrl(m.id),
    });
    return {
      model_count: summary.modelCount,
      collection_count: summary.collectionCount,
      author_count: summary.authorCount,
      category_count: summary.categoryCount,
      most_viewed: summary.topViewed.map(model),
      most_printed: summary.topPrinted.map(model),
      recently_added: summary.recentlyAdded.map(model),
      top_authors: summary.topAuthors.map((a) => ({
        id: a.id,
        name: a.name,
        handle: a.handle,
        model_count: a.modelCount,
      })),
      sources: summary.topProviders.map((p) => ({ provider: p.provider, model_count: p.modelCount })),
    };
  },
};

export const MCP_TOOLS: readonly McpToolDefinition[] = [
  searchModels,
  listModels,
  getModel,
  listCollections,
  getCollection,
  listTags,
  listCategories,
  getAuthor,
  libraryStats,
];

export const MCP_TOOL_NAMES = MCP_TOOLS.map((tool) => tool.name);

/** What the profile page offers to tick. */
export const MCP_TOOL_CATALOG = MCP_TOOLS.map((tool) => ({
  name: tool.name,
  title: tool.title,
  description: tool.description,
  read_only: tool.readOnly,
}));

/** What a new token gets when its user doesn't choose: every tool that only reads. */
export const DEFAULT_MCP_TOOL_NAMES = MCP_TOOLS.filter((tool) => tool.readOnly).map((tool) => tool.name);
