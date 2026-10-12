// The sync dialog's Browse tab: which providers a user can browse, their collections there, and
// turning sync on for a Thingport collection from the app rather than from Thingport Grab.

import { prisma } from "../db";
import { HttpError } from "../utils/fileUtils";
import type { CollectionSyncOut, SyncProfileScope } from "../dto";
import { isSystemCollectionId } from "./collectionService";
import { fetchListing, syncCollection } from "./collectionSyncRunner";
import type { SyncIntervalHours } from "./collectionSyncSchedule";
import { enableSync, parseSyncSource, type SyncProvider, updateSyncSettings } from "./collectionSyncService";
import { MakerworldAuthError, MakerworldCaptchaError, extractMakerworldBearerToken } from "./makerworldCloudApi";
import { fetchMakerworldCollectionCard, listMakerworldOwnCollections } from "./makerworldCollections";
import { getUserMakerworldCookie } from "./makerworldCookieService";
import { fetchPrintablesCollectionCard, listPrintablesUserCollections, resolvePrintablesUser } from "./printablesApi";
import type { ProviderCollectionCard } from "./providerCollectionCard";
import { getThingiverseAccessToken } from "./settingsService";
import {
  fetchThingiverseCollectionCard,
  listThingiverseUserCollections,
  resolveThingiverseUser,
} from "./thingiverseApi";

export const BROWSABLE_PROVIDERS = ["makerworld", "printables", "thingiverse"] as const;
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
};

export async function getProviderAccounts(userId: string): Promise<ProviderAccountsOut> {
  const [user, thingiverseToken] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { makerworldCookie: true, printablesHandle: true, thingiverseUsername: true },
    }),
    getThingiverseAccessToken(),
  ]);
  return {
    makerworld: { connected: Boolean(extractMakerworldBearerToken(user?.makerworldCookie)), account: null },
    printables: { connected: true, account: user?.printablesHandle ?? null },
    thingiverse: { connected: Boolean(thingiverseToken), account: user?.thingiverseUsername ?? null },
  };
}

async function requireThingiverseToken(): Promise<string> {
  const token = await getThingiverseAccessToken();
  if (!token) throw new HttpError(409, "Thingiverse isn't connected on this Thingport yet");
  return token;
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
    await prisma.user.update({
      where: { id: userId },
      data: { printablesUserId: user?.id ?? null, printablesHandle: user?.handle ?? null },
    });
  } else if (provider === "thingiverse") {
    const user = value ? await resolveThingiverseUser(value, await requireThingiverseToken()) : null;
    if (value && !user) throw new HttpError(404, `Thingiverse has no user "${value}"`);
    await prisma.user.update({ where: { id: userId }, data: { thingiverseUsername: user?.username ?? null } });
  } else {
    throw new HttpError(400, "MakerWorld is linked through its cookie in Configuration > Providers");
  }
  return getProviderAccounts(userId);
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
    throw err;
  }
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
    };
  });
}

export async function listProviderCollections(
  userId: string,
  provider: BrowsableProvider,
): Promise<ProviderCollectionOut[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { makerworldCookie: true, printablesUserId: true, thingiverseUsername: true },
  });
  let cards: ProviderCollectionCard[];
  if (provider === "makerworld") {
    const bearer = extractMakerworldBearerToken(user?.makerworldCookie);
    if (!bearer) throw new HttpError(409, "Connect MakerWorld in Configuration > Providers first");
    cards = await providerCall(() => listMakerworldOwnCollections(bearer));
  } else if (provider === "printables") {
    if (!user?.printablesUserId) throw new HttpError(409, "Tell Thingport your Printables username first");
    cards = await listPrintablesUserCollections(user.printablesUserId);
  } else {
    const token = await requireThingiverseToken();
    if (!user?.thingiverseUsername) throw new HttpError(409, "Tell Thingport your Thingiverse username first");
    cards = await listThingiverseUserCollections(user.thingiverseUsername, token);
  }
  return withSyncs(userId, provider, cards);
}

/** A pasted collection link, as the same card a listing shows. */
export async function lookupProviderCollection(userId: string, url: string): Promise<ProviderCollectionOut> {
  const source = parseSyncSource(url);
  if (!source || source.likesOf) {
    throw new HttpError(400, "That isn't a MakerWorld, Printables or Thingiverse collection link");
  }
  let card: ProviderCollectionCard | null;
  if (source.provider === "makerworld") {
    const bearer = extractMakerworldBearerToken(await getUserMakerworldCookie(userId));
    card = await providerCall(() => fetchMakerworldCollectionCard(source.externalId, bearer));
  } else if (source.provider === "printables") {
    card = await fetchPrintablesCollectionCard(source.externalId);
  } else {
    card = await fetchThingiverseCollectionCard(source.externalId, await requireThingiverseToken());
  }
  if (!card) throw new HttpError(404, "That collection can't be found. It may be private or deleted.");
  return (await withSyncs(userId, source.provider, [card]))[0];
}

export type EnableFromAppResult = { sync: CollectionSyncOut; importing: boolean };

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
  if (!source) throw new HttpError(400, "That isn't a MakerWorld, Printables or Thingiverse collection link");
  if (input.profileScope && source.provider !== "makerworld") {
    throw new HttpError(400, "Only MakerWorld models have print profiles to pick");
  }

  let knownIds: string[] = [];
  if (source.provider === "makerworld") {
    const listing = await providerCall(() =>
      fetchListing({ userId, provider: source.provider, externalId: source.externalId, sourceUrl: source.url }),
    );
    if (!listing) throw new HttpError(404, "That collection can't be found. It may be private or deleted.");
    knownIds = listing;
  }

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
  return { sync, importing };
}
