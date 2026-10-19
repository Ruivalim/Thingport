// The sync dialog's Browse tab: which providers a user can browse, their collections there, and
// turning sync on for a Thingport collection from the app rather than from Thingport Grab.

import { prisma } from "../db";
import { HttpError } from "../utils/fileUtils";
import { LIKES_ID_PREFIX, type CollectionSyncOut, type SyncProfileScope } from "../dto";
import { isSystemCollectionId } from "./collectionService";
import { fetchListing, syncCollection } from "./collectionSyncRunner";
import type { SyncIntervalHours } from "./collectionSyncSchedule";
import {
  enableSync,
  hasProfiles,
  parseSyncSource,
  type SyncProvider,
  updateSyncSettings,
} from "./collectionSyncService";
import { listSnapmakerCollections, SnapmakerAuthError } from "./snapmakerApi";
import { getSnapmakerConnection, getUserSnapmakerId, getUserSnapmakerToken } from "./snapmakerSessionService";
import {
  fetchMakeronlineCollection,
  fetchMakeronlineCollectionInfo,
  listMakeronlineCollections,
  MakeronlineAuthError,
  makeronlineCollectionUrl,
  MAKERONLINE_LIKES_KEY,
} from "./makeronlineApi";
import { getMakeronlineConnection, getUserMakeronlineId, getUserMakeronlineToken } from "./makeronlineSessionService";
import { MakerworldAuthError, MakerworldCaptchaError, extractMakerworldBearerToken } from "./makerworldCloudApi";
import { fetchMakerworldCollectionCard, listMakerworldOwnCollections } from "./makerworldCollections";
import { getUserMakerworldCookie } from "./makerworldCookieService";
import { fetchPrintablesCollectionCard, listPrintablesUserCollections, resolvePrintablesUser } from "./printablesApi";
import type { ProviderCollectionCard } from "./providerCollectionCard";
import {
  COLLECTIONS_KEY,
  LIKES_KEY,
  pushedLikes,
  pushedPrintablesCards,
  assertPrintablesPushOn,
  deletePrintablesListings,
  deleteStalePrintablesListings,
  pushedPrintablesModels,
  writePrintablesListing,
} from "./providerListingsService";
import { getMyminifactoryApiKey, getThingiverseAccessToken } from "./settingsService";
import {
  fetchMyminifactoryCollectionCard,
  listMyminifactoryUserCollections,
  MyminifactoryAuthError,
  MyminifactoryRateLimitError,
  resolveMyminifactoryUser,
} from "./myminifactoryApi";
import {
  fetchThingiverseCollectionCard,
  fetchThingiverseLikesSummary,
  listThingiverseUserCollections,
  resolveThingiverseUser,
  ThingiverseAuthError,
  ThingiverseRateLimitError,
} from "./thingiverseApi";
import { assertProviderEnabled } from "./providerSettingsService";

export const BROWSABLE_PROVIDERS = [
  "makerworld",
  "printables",
  "thingiverse",
  "myminifactory",
  "snapmaker",
  "makeronline",
] as const;
export type BrowsableProvider = (typeof BROWSABLE_PROVIDERS)[number];

/** `connected`: the instance can reach it for this user at all. `account`: who they are there, for
 *  the providers without a per-user login (MakerWorld's cookie already says). */
export type ProviderAccountOut = { connected: boolean; account: string | null };
export type ProviderAccountsOut = Record<BrowsableProvider, ProviderAccountOut>;

export type ProviderCollectionOut = {
  id: string;
  name: string;
  url: string;
  model_count: number;
  thumbnails: string[];
  private: boolean;
  owner: string | null;
  /** The Thingport collection already synced with it, which can't take a second one. */
  synced: { collection_id: string; collection_name: string } | null;
  /** The user's liked models, rather than a collection. */
  likes: boolean;
};

export async function getProviderAccounts(userId: string): Promise<ProviderAccountsOut> {
  const [user, thingiverseToken, myminifactoryKey, snapmaker, makeronline] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        makerworldCookie: true,
        printablesHandle: true,
        thingiverseUsername: true,
        myminifactoryUsername: true,
      },
    }),
    getThingiverseAccessToken(),
    getMyminifactoryApiKey(),
    getSnapmakerConnection(userId),
    getMakeronlineConnection(userId),
  ]);
  return {
    makerworld: { connected: Boolean(extractMakerworldBearerToken(user?.makerworldCookie)), account: null },
    printables: { connected: true, account: user?.printablesHandle ?? null },
    thingiverse: { connected: Boolean(thingiverseToken), account: user?.thingiverseUsername ?? null },
    myminifactory: { connected: Boolean(myminifactoryKey), account: user?.myminifactoryUsername ?? null },
    snapmaker: { connected: snapmaker === "connected", account: null },
    makeronline: { connected: makeronline === "connected", account: null },
  };
}

async function requireThingiverseToken(): Promise<string> {
  const token = await getThingiverseAccessToken();
  if (!token) throw new HttpError(409, "Thingiverse isn't connected on this Thingport yet");
  return token;
}

async function requireMyminifactoryKey(): Promise<string> {
  const key = await getMyminifactoryApiKey();
  if (!key) throw new HttpError(409, "MyMiniFactory isn't connected on this Thingport yet");
  return key;
}

/** `input` is a username, handle or profile link; null forgets it. */
export async function setProviderAccount(
  userId: string,
  provider: BrowsableProvider,
  input: string | null,
): Promise<ProviderAccountsOut> {
  const value = input?.trim() || null;
  if (provider === "printables") {
    const user = value ? await resolvePrintablesUser(value) : null;
    if (value && !user) throw new HttpError(404, `Printables has no user "${value}"`);
    // Forgetting the account also turns off what Grab sends from Printables, and drops what it sent:
    // otherwise its next push would quietly link the account again.
    await prisma.user.update({
      where: { id: userId },
      data: { printablesUserId: user?.id ?? null, printablesHandle: user?.handle ?? null, printablesPushOff: !user },
    });
    if (!user) await deletePrintablesListings(userId);
  } else if (provider === "thingiverse") {
    const token = value ? await requireThingiverseToken() : null;
    const user = token ? await providerCall(() => resolveThingiverseUser(value!, token)) : null;
    if (value && !user) throw new HttpError(404, `Thingiverse has no user "${value}"`);
    await prisma.user.update({ where: { id: userId }, data: { thingiverseUsername: user?.username ?? null } });
  } else if (provider === "myminifactory") {
    const key = value ? await requireMyminifactoryKey() : null;
    const user = key ? await providerCall(() => resolveMyminifactoryUser(value!, key)) : null;
    if (value && !user) throw new HttpError(404, `MyMiniFactory has no user "${value}"`);
    await prisma.user.update({ where: { id: userId }, data: { myminifactoryUsername: user?.username ?? null } });
  } else if (provider === "snapmaker") {
    throw new HttpError(400, "Snapmaker Space is linked through its sign-in in Configuration > Providers");
  } else if (provider === "makeronline") {
    throw new HttpError(400, "MakerOnline is linked through its sign-in in Configuration > Providers");
  } else {
    throw new HttpError(400, "MakerWorld is linked through its cookie in Configuration > Providers");
  }
  return getProviderAccounts(userId);
}

/** A Thingiverse user's likes, which anyone can see, as one more collection to sync with. */
async function thingiverseLikesCard(username: string, token: string): Promise<ProviderCollectionCard | null> {
  const likes = await fetchThingiverseLikesSummary(username, token);
  if (!likes) return null;
  return {
    id: `${LIKES_ID_PREFIX}${likes.username.toLowerCase()}`,
    name: "Liked models",
    url: `https://www.thingiverse.com/${encodeURIComponent(likes.username)}/likes`,
    modelCount: likes.count,
    thumbnails: likes.thumbnails,
    private: false,
    owner: likes.username,
  };
}

/** Provider errors a user can act on, as HTTP errors; anything else is left to the error handler. */
async function providerCall<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (err instanceof MakerworldCaptchaError) throw new HttpError(429, err.message);
    // 400, not 401: the frontend treats any 401 as an expired Thingport session.
    if (err instanceof MakerworldAuthError) {
      throw new HttpError(400, "MakerWorld didn't accept your cookie. Update it in Configuration > Providers.");
    }
    if (err instanceof ThingiverseRateLimitError) throw new HttpError(429, err.message);
    if (err instanceof ThingiverseAuthError) throw new HttpError(400, err.message);
    if (err instanceof MyminifactoryRateLimitError) throw new HttpError(429, err.message);
    if (err instanceof MyminifactoryAuthError) throw new HttpError(400, err.message);
    if (err instanceof SnapmakerAuthError) throw new HttpError(400, err.message);
    if (err instanceof MakeronlineAuthError) throw new HttpError(400, err.message);
    throw err;
  }
}

/** The user's likes and bookmarks, which only they can read, with their own sign-in. */
async function snapmakerCards(userId: string): Promise<ProviderCollectionCard[]> {
  const [token, snapmakerId] = await Promise.all([getUserSnapmakerToken(userId), getUserSnapmakerId(userId)]);
  if (!token || !snapmakerId) {
    throw new HttpError(409, "Connect Snapmaker Space in Configuration > Providers, or visit it with Thingport Grab");
  }
  return providerCall(() => listSnapmakerCollections(token, snapmakerId));
}

/** The user's likes and their own collections, read with their sign-in. */
async function makeronlineCards(userId: string): Promise<ProviderCollectionCard[]> {
  const [token, makeronlineId] = await Promise.all([getUserMakeronlineToken(userId), getUserMakeronlineId(userId)]);
  if (!token || !makeronlineId) {
    throw new HttpError(409, "Connect MakerOnline in Configuration > Providers, or visit it with Thingport Grab");
  }
  return providerCall(() => listMakeronlineCollections(token, makeronlineId));
}

/** Any collection the user can see: public ones without a sign-in, their own private ones with it. */
async function makeronlineCollectionCard(userId: string, collectionId: string): Promise<ProviderCollectionCard | null> {
  const token = await getUserMakeronlineToken(userId);
  return providerCall(async () => {
    const info = await fetchMakeronlineCollectionInfo(collectionId, token);
    const listing = info ? await fetchMakeronlineCollection(collectionId, token, 4) : null;
    if (!info || !listing) return null;
    return {
      id: collectionId,
      name: info.name,
      url: makeronlineCollectionUrl(info.ownerId, collectionId),
      modelCount: info.modelCount,
      thumbnails: listing.entries.flatMap((entry) => (entry.cover ? [entry.cover] : [])),
      private: info.private,
      owner: null,
    };
  });
}

async function withSyncs(
  userId: string,
  provider: SyncProvider,
  cards: ProviderCollectionCard[],
): Promise<ProviderCollectionOut[]> {
  const syncs = await prisma.collectionSync.findMany({
    where: { userId, provider, externalId: { in: cards.map((card) => card.id) } },
    include: { collection: { select: { id: true, name: true } } },
  });
  const byId = new Map(syncs.map((sync) => [sync.externalId, sync.collection]));
  return cards.map((card) => {
    const synced = byId.get(card.id);
    return {
      id: card.id,
      name: card.name,
      url: card.url,
      model_count: card.modelCount,
      thumbnails: card.thumbnails,
      private: card.private,
      owner: card.owner,
      synced: synced ? { collection_id: synced.id, collection_name: synced.name } : null,
      likes: card.id.startsWith(LIKES_ID_PREFIX),
    };
  });
}

export async function listProviderCollections(
  userId: string,
  provider: BrowsableProvider,
): Promise<ProviderCollectionOut[]> {
  await assertProviderEnabled(provider);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { makerworldCookie: true, printablesUserId: true, thingiverseUsername: true, myminifactoryUsername: true },
  });
  let cards: ProviderCollectionCard[];
  if (provider === "makerworld") {
    const bearer = extractMakerworldBearerToken(user?.makerworldCookie);
    if (!bearer) throw new HttpError(409, "Connect MakerWorld in Configuration > Providers first");
    cards = await providerCall(() => listMakerworldOwnCollections(bearer));
  } else if (provider === "printables") {
    // Printables shows anyone the public ones; Thingport Grab adds the private ones and the likes.
    const pushed = await pushedPrintablesCards(userId);
    if (!user?.printablesUserId && !pushed.collections) {
      throw new HttpError(409, "Tell Thingport your Printables username first");
    }
    const listed = user?.printablesUserId ? await listPrintablesUserCollections(user.printablesUserId) : [];
    const listedIds = new Set(listed.map((card) => card.id));
    const privateOnes = (pushed.collections ?? []).filter((card) => card.private && !listedIds.has(card.id));
    cards = [...(pushed.likes ? [pushed.likes] : []), ...listed, ...privateOnes];
  } else if (provider === "snapmaker") {
    cards = await snapmakerCards(userId);
  } else if (provider === "makeronline") {
    cards = await makeronlineCards(userId);
  } else if (provider === "myminifactory") {
    const key = await requireMyminifactoryKey();
    if (!user?.myminifactoryUsername) throw new HttpError(409, "Tell Thingport your MyMiniFactory username first");
    const username = user.myminifactoryUsername;
    cards = await providerCall(() => listMyminifactoryUserCollections(username, key));
  } else {
    const token = await requireThingiverseToken();
    if (!user?.thingiverseUsername) throw new HttpError(409, "Tell Thingport your Thingiverse username first");
    const username = user.thingiverseUsername;
    // Thingiverse shows anyone's likes, so they sync like a collection; a failed count costs only them.
    const [likes, collections] = await providerCall(() =>
      Promise.all([
        thingiverseLikesCard(username, token).catch(() => null),
        listThingiverseUserCollections(username, token),
      ]),
    );
    cards = [...(likes ? [likes] : []), ...collections];
  }
  return withSyncs(userId, provider, cards);
}

/** A pasted collection link, as the same card a listing shows. */
export async function lookupProviderCollection(userId: string, url: string): Promise<ProviderCollectionOut> {
  const source = parseSyncSource(url);
  if (!source)
    throw new HttpError(
      400,
      "That isn't a MakerWorld, Printables, Thingiverse, MyMiniFactory, Snapmaker Space or MakerOnline collection link",
    );
  await assertProviderEnabled(source.provider);
  let card: ProviderCollectionCard | null;
  if (source.likesOf && source.provider === "thingiverse") {
    const token = await requireThingiverseToken();
    card = await providerCall(() => thingiverseLikesCard(source.likesOf!, token));
  } else if (source.likesOf) {
    // Printables shows likes to their owner only, so only the user's own, as Grab read them.
    const likes = await pushedLikes(userId);
    if (likes?.card.id !== source.externalId) {
      throw new HttpError(
        404,
        "Printables shows likes to their owner only. Open Printables signed in, with Thingport Grab installed, and your own appear here.",
      );
    }
    card = likes.card;
  } else if (source.provider === "makerworld") {
    const bearer = extractMakerworldBearerToken(await getUserMakerworldCookie(userId));
    card = await providerCall(() => fetchMakerworldCollectionCard(source.externalId, bearer));
  } else if (source.provider === "printables") {
    card =
      (await fetchPrintablesCollectionCard(source.externalId)) ??
      (await pushedPrintablesCards(userId)).collections?.find((pushed) => pushed.id === source.externalId) ??
      null;
  } else if (source.provider === "makeronline") {
    card =
      source.externalId === MAKERONLINE_LIKES_KEY
        ? ((await makeronlineCards(userId)).find((own) => own.id === MAKERONLINE_LIKES_KEY) ?? null)
        : await makeronlineCollectionCard(userId, source.externalId);
  } else if (source.provider === "snapmaker") {
    // Only the user's own likes and bookmarks are there to find.
    card = (await snapmakerCards(userId)).find((own) => own.id === source.externalId) ?? null;
  } else if (source.provider === "myminifactory") {
    const key = await requireMyminifactoryKey();
    const [username, slug] = source.externalId.split("/");
    card = await providerCall(() => fetchMyminifactoryCollectionCard(username, slug, key));
  } else {
    const token = await requireThingiverseToken();
    card = await providerCall(() => fetchThingiverseCollectionCard(source.externalId, token));
  }
  if (!card) throw new HttpError(404, "That collection can't be found. It may be private or deleted.");
  return (await withSyncs(userId, source.provider, [card]))[0];
}

/** `waiting`: a private Printables collection or likes whose models Thingport Grab hasn't read yet;
 *  they come in on the user's next visit to Printables. */
export type EnableFromAppResult = { sync: CollectionSyncOut; importing: boolean; waiting: boolean };

/** Links an existing Thingport collection to a provider's. MakerWorld rate-limits bulk imports
 *  hard, so there only models added from now on come in; elsewhere the collection's current models
 *  are imported too, by the sync's first check. Library models are filed into the collection
 *  either way. */
export async function enableSyncFromApp(
  userId: string,
  collectionId: string,
  input: { url: string; intervalHours?: SyncIntervalHours; profileScope?: SyncProfileScope },
): Promise<EnableFromAppResult> {
  if (isSystemCollectionId(collectionId)) throw new HttpError(400, "This collection can't be synced");
  const source = parseSyncSource(input.url);
  if (!source)
    throw new HttpError(
      400,
      "That isn't a MakerWorld, Printables, Thingiverse, MyMiniFactory, Snapmaker Space or MakerOnline collection link",
    );
  await assertProviderEnabled(source.provider);
  if (input.profileScope && !hasProfiles(source.provider)) {
    throw new HttpError(400, "Only MakerWorld, Snapmaker Space and MakerOnline models have print profiles to pick");
  }

  let knownIds: string[] = [];
  if (source.provider === "makerworld") {
    const listing = await providerCall(() =>
      fetchListing({ userId, provider: source.provider, externalId: source.externalId, sourceUrl: source.url }),
    );
    if (!listing) throw new HttpError(404, "That collection can't be found. It may be private or deleted.");
    knownIds = listing;
  }

  const waiting =
    source.provider === "printables" && (await pushedPrintablesModels(userId, source.externalId)) === "waiting";
  const link = await enableSync(userId, { url: input.url, collectionId, knownIds });
  let sync = link;
  if (input.intervalHours || input.profileScope) {
    sync = {
      ...link,
      ...(await updateSyncSettings(userId, collectionId, {
        intervalHours: input.intervalHours,
        profileScope: input.profileScope,
      })),
    };
  }

  const importing = source.provider !== "makerworld";
  if (importing) {
    const created = await prisma.collectionSync.findUniqueOrThrow({ where: { collectionId } });
    // Never checked yet, so a check that finds the user busy importing is retried on the
    // scheduler's next tick rather than a day later.
    void syncCollection(created.id).catch((err) => console.error(`[sync] first check of ${created.id} failed:`, err));
  }
  return { sync, importing, waiting };
}

export type PrintablesPush = {
  user: { id: string; handle: string };
  /** The user's collections, private ones included. */
  collections?: { id: string; name: string; model_count: number; thumbnails: string[]; private: boolean }[];
  /** Their likes, when Grab read them this time: on every visit while a likes sync wants them (see
   *  wantedPrintablesListings), else once a day for the Browse tab's count. Either way it's every
   *  page of them: Printables has no likes count of its own. */
  likes?: { model_count: number; thumbnails: string[]; ids?: string[] };
  /** Model ids of the private collections asked for. */
  listings?: Record<string, string[]>;
};

/** What Thingport Grab read on a visit to Printables. Synced collections whose models changed are
 *  synced straight away: a visit is when their new models can be seen. */
export async function savePrintablesPush(userId: string, push: PrintablesPush): Promise<void> {
  await assertPrintablesPushOn(userId);
  const { id: printablesUserId, handle } = push.user;
  // The signed-in account wins over a username typed into the app, once Printables confirms it: the
  // handle is what proves a likes sync is the user's own (see assertOwnPrintablesLikes).
  const stored = await prisma.user.findUnique({
    where: { id: userId },
    select: { printablesUserId: true, printablesHandle: true },
  });
  if (stored?.printablesUserId !== printablesUserId || stored.printablesHandle !== handle) {
    const confirmed = await resolvePrintablesUser(printablesUserId);
    if (confirmed?.handle !== handle) throw new HttpError(400, "That isn't a Printables user");
    await prisma.user.update({ where: { id: userId }, data: { printablesUserId, printablesHandle: handle } });
  }

  if (push.collections) {
    const cards: ProviderCollectionCard[] = push.collections.map((c) => ({
      id: c.id,
      name: c.name,
      url: `https://www.printables.com/@${encodeURIComponent(handle)}/collections/${c.id}`,
      modelCount: c.model_count,
      thumbnails: c.thumbnails,
      private: c.private,
      owner: handle,
    }));
    await writePrintablesListing(userId, COLLECTIONS_KEY, { cards });
    // A collection deleted or made public since needs no model list of its own any more.
    await deleteStalePrintablesListings(
      userId,
      cards.filter((card) => card.private).map((card) => card.id),
    );
  }
  const changed = new Map<string, string[]>(Object.entries(push.listings ?? {}));
  for (const [collectionId, ids] of changed) await writePrintablesListing(userId, collectionId, { ids });
  if (push.likes) {
    const ids = push.likes.ids ?? (await pushedLikes(userId))?.ids ?? null;
    const card: ProviderCollectionCard = {
      id: `${LIKES_ID_PREFIX}${handle.toLowerCase()}`,
      name: "Liked models",
      url: `https://www.printables.com/@${encodeURIComponent(handle)}/collections/liked`,
      modelCount: push.likes.model_count,
      thumbnails: push.likes.thumbnails,
      private: true,
      owner: handle,
    };
    await writePrintablesListing(userId, LIKES_KEY, { card, ids });
    if (push.likes.ids) changed.set(card.id, push.likes.ids);
  }

  const syncs = await prisma.collectionSync.findMany({
    where: { userId, provider: "printables", externalId: { in: [...changed.keys()] } },
  });
  for (const sync of syncs) {
    const known = new Set(sync.knownIds);
    if (changed.get(sync.externalId)!.some((id) => !known.has(id))) {
      void syncCollection(sync.id).catch((err) => console.error(`[sync] ${sync.id} after a Printables visit:`, err));
    }
  }
}
