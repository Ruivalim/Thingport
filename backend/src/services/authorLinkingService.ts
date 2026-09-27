import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { IMPORT_COLLECTION_DELAY_MS, IMPORT_MAKERWORLD_CALL_DELAY_MS } from "../config";
import { maybeSleep } from "../utils/concurrency";
import { LINKABLE_PRINTS, linkUnattributedPrints, upsertAuthorFromImport } from "./authorService";
import { createLog } from "./auditLog";
import { fetchMakerworldPageAuthor } from "./importService";
import type { ImportedAuthorInfo } from "./importResolvers";
import { getUserMakerworldCookie } from "./makerworldCookieService";
import {
  extractMakerworldBearerToken,
  fetchMakerworldDesignAuthor,
  makerworldCaptchaCooloffActive,
  MakerworldAuthError,
  MakerworldCaptchaError,
} from "./makerworldCloudApi";
import { resolvePrintablesModel } from "./printablesApi";
import { getThingiverseAccessToken } from "./settingsService";
import { resolveThingiverseThing, ThingiverseAuthError } from "./thingiverseApi";

// Administration > Triggers > "Link missing authors", instance-wide: models imported while their
// author couldn't be saved (MakerWorld, for a while -- see makerworldCloudApi.ts's
// completeMakerworldAuthor) only know the author by name. A run first links every such model
// whose name matches a known author (authorService.ts's LINKABLE_PRINTS), then looks the rest up
// on the site each came from -- once per distinct creator, not per model, since everything they
// made links from that one lookup. Only metadata is fetched, never files.

const LOOKUP_PROVIDERS = ["makerworld", "thingiverse", "printables"] as const;
type LookupProvider = (typeof LOOKUP_PROVIDERS)[number];

/** Why part of a run was skipped -- shown to the admin, who can usually fix it. */
export type LookupProblem = "thingiverse_no_token" | "thingiverse_token_rejected" | "makerworld_captcha" | "makerworld_login_rejected";

export type AuthorLinkingRun = {
  running: boolean;
  startedAt: string;
  finishedAt: string | null;
  /** Creators to look up on their sites, and how many have been so far. */
  toLookUp: number;
  lookedUp: number;
  /** Models linked by this run, both by name and from lookups. */
  linked: number;
  /** Creators whose site didn't give an author (model gone, page unreachable...). */
  notFound: number;
  problems: LookupProblem[];
};

type Candidate = { printId: string; userId: string; provider: LookupProvider; externalId: string; creator: string };

// One model per creator (per site) that no known author's name matches -- the newest, as the
// likeliest still to be online. Ambiguous names are included: a lookup settles who it really is.
const LOOKUP_CANDIDATES = Prisma.sql`
  SELECT DISTINCT ON (p."sourceProvider", lower(trim(p.creator)))
    p.id AS "printId", p."userId", p."sourceProvider" AS provider, p."sourceExternalId" AS "externalId", p.creator
  FROM "Print" p
  WHERE p."authorId" IS NULL AND p.creator IS NOT NULL AND trim(p.creator) <> ''
    AND p."sourceProvider" IN (${Prisma.join([...LOOKUP_PROVIDERS])}) AND p."sourceExternalId" IS NOT NULL
    AND p.id NOT IN (SELECT print_id FROM (${LINKABLE_PRINTS}) l)
  ORDER BY p."sourceProvider", lower(trim(p.creator)), p."createdAt" DESC
`;

/** What the trigger would do now: models it can link by name straight away, and models whose
 *  author it would have to look up (on their sites). The trigger is shown when either is > 0. */
export async function authorLinkingSummary(): Promise<{ linkable: number; lookup: number }> {
  const [row] = await prisma.$queryRaw<{ linkable: number; lookup: number }[]>`
    SELECT
      (SELECT count(*)::int FROM (${LINKABLE_PRINTS}) l) AS linkable,
      (SELECT count(*)::int FROM "Print" p
        WHERE p."authorId" IS NULL AND p.creator IS NOT NULL AND trim(p.creator) <> ''
          AND p."sourceProvider" IN (${Prisma.join([...LOOKUP_PROVIDERS])}) AND p."sourceExternalId" IS NOT NULL
          AND p.id NOT IN (SELECT print_id FROM (${LINKABLE_PRINTS}) l2)) AS lookup
  `;
  return { linkable: row?.linkable ?? 0, lookup: row?.lookup ?? 0 };
}

let current: AuthorLinkingRun | null = null;

/** The current or last run since the server started, for the Triggers page to poll. */
export function currentAuthorLinkingRun(): AuthorLinkingRun | null {
  return current;
}

/** Starts a run in the background; null if one is already running. */
export function startAuthorLinking(adminUserId: string): AuthorLinkingRun | null {
  if (current?.running) return null;
  current = {
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    toLookUp: 0,
    lookedUp: 0,
    linked: 0,
    notFound: 0,
    problems: [],
  };
  const run = current;
  void runAuthorLinking(run)
    .catch((err) => console.error("Link missing authors failed", err))
    .finally(() => {
      run.running = false;
      run.finishedAt = new Date().toISOString();
      void createLog({
        userId: adminUserId,
        action: "authors_linked",
        details: { linked: run.linked, lookedUp: run.lookedUp, notFound: run.notFound, problems: run.problems },
      });
    });
  return run;
}

/** Models that only know their author by name -- `linked` is how far this has dropped since the
 *  run started, which also counts what saving an author links along the way. */
async function countUnlinked(): Promise<number> {
  return prisma.print.count({ where: { authorId: null, creator: { not: null } } });
}

/** Does the whole run, updating `run` as it goes -- awaited directly by tests. */
export async function runAuthorLinking(run: AuthorLinkingRun): Promise<void> {
  const unlinkedAtStart = await countUnlinked();
  const updateLinked = async () => {
    run.linked = unlinkedAtStart - (await countUnlinked());
  };
  await linkUnattributedPrints();
  await updateLinked();

  const candidates = await prisma.$queryRaw<Candidate[]>`${LOOKUP_CANDIDATES}`;
  run.toLookUp = candidates.length;
  const skipped = new Set<LookupProvider>();
  const skip = (provider: LookupProvider, problem: LookupProblem) => {
    skipped.add(provider);
    if (!run.problems.includes(problem)) run.problems.push(problem);
  };
  const thingiverseToken = await getThingiverseAccessToken();
  if (!thingiverseToken) skip("thingiverse", "thingiverse_no_token");
  if (makerworldCaptchaCooloffActive()) skip("makerworld", "makerworld_captcha");

  for (const candidate of candidates) {
    if (skipped.has(candidate.provider)) {
      run.lookedUp++;
      continue;
    }
    let author: ImportedAuthorInfo | null = null;
    try {
      author = await lookUpAuthor(candidate, thingiverseToken);
    } catch (err) {
      if (err instanceof MakerworldCaptchaError) skip("makerworld", "makerworld_captcha");
      else if (err instanceof MakerworldAuthError) skip("makerworld", "makerworld_login_rejected");
      else if (err instanceof ThingiverseAuthError) skip("thingiverse", "thingiverse_token_rejected");
      else console.warn(`Couldn't look up the author of model ${candidate.printId}`, err);
    }
    const saved = author ? await upsertAuthorFromImport(author) : null;
    if (saved) {
      // Saving the author already linked every model its name matches; this also covers the
      // looked-up model and its siblings when the name the import stored differs from the
      // author's (e.g. a MakerWorld nickname vs. display name).
      await prisma.$executeRaw`
        UPDATE "Print" SET "authorId" = ${saved.id}
        WHERE "authorId" IS NULL AND "sourceProvider" = ${candidate.provider}
          AND lower(trim(creator)) = lower(trim(${candidate.creator}))
      `;
      await updateLinked();
    } else {
      run.notFound++;
    }
    run.lookedUp++;
  }
}

async function lookUpAuthor(candidate: Candidate, thingiverseToken: string | null): Promise<ImportedAuthorInfo | null> {
  switch (candidate.provider) {
    case "thingiverse": {
      await maybeSleep(IMPORT_COLLECTION_DELAY_MS);
      return (await resolveThingiverseThing(candidate.externalId, thingiverseToken!))?.meta.author ?? null;
    }
    case "printables": {
      await maybeSleep(IMPORT_COLLECTION_DELAY_MS);
      return (await resolvePrintablesModel(candidate.externalId))?.meta.author ?? null;
    }
    case "makerworld": {
      // The model owner's MakerWorld login, if they saved one, reads MakerWorld's API directly;
      // otherwise the model page (often behind Cloudflare -- FlareSolverr gets through).
      const cookie = (await getUserMakerworldCookie(candidate.userId)) ?? process.env.MAKERWORLD_COOKIE ?? null;
      const bearer = extractMakerworldBearerToken(cookie);
      return bearer
        ? fetchMakerworldDesignAuthor(candidate.externalId, bearer, IMPORT_MAKERWORLD_CALL_DELAY_MS)
        : fetchMakerworldPageAuthor(candidate.externalId, cookie, IMPORT_MAKERWORLD_CALL_DELAY_MS);
    }
  }
}
