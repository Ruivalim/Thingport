import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// No pacing here. config.ts reads the delays on load, so it's hoisted.
vi.hoisted(() => {
  process.env.IMPORT_MAKERWORLD_CALL_DELAY_MS = "0";
});

import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { setUserMakerworldCookie } from "../src/services/makerworldCookieService";

const app = createApp();
const stamp = Date.now();
let token: string;
let userId: string;
const auth = () => ({ Authorization: `Bearer ${token}` });
const originalFetch = global.fetch;

// Ids unique to this run, so reruns against the same database don't collide.
let nextId = (stamp % 1_000_000_000) * 10;
const newId = () => String(nextId++);

const PRINTABLES_USER = { id: "3560603", handle: `Tester_${stamp}`, publicUsername: "Tester" };
const printablesCollections = [
  { id: newId(), name: "Practical finds", printsCount: 23 },
  { id: newId(), name: "Cool toys", printsCount: 8 },
];
const makerworldCollections = [
  { id: newId(), title: "To print", status: 2, designCnt: 3 },
  { id: newId(), title: "Secret", status: 1, designCnt: 1 },
];
const makerworldDesigns: Record<string, string[]> = {
  [makerworldCollections[0].id]: [newId(), newId(), newId()],
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function printablesCard(c: { id: string; name: string; printsCount: number }) {
  return {
    ...c,
    private: false,
    user: { handle: PRINTABLES_USER.handle },
    thumbnails11: [{ image: { filePath: `media/${c.id}.jpg` } }],
  };
}

function printablesGraphql(query: string, variables: Record<string, unknown>): Response {
  if (query.includes("user(id:")) {
    const ok = variables.id === `@${PRINTABLES_USER.handle}` || variables.id === PRINTABLES_USER.id;
    return json({ data: { user: ok ? PRINTABLES_USER : null } });
  }
  if (query.includes("userCollections"))
    return json({ data: { collections: printablesCollections.map(printablesCard) } });
  if (query.includes("moreCollectionModels"))
    return json({ data: { moreCollectionModels: { items: [], cursor: "" } } });
  if (query.includes("collection(id:")) {
    const found = printablesCollections.find((c) => c.id === variables.id);
    return json({ data: { collection: found ? printablesCard(found) : null } });
  }
  return json({ errors: [{ message: "unexpected query" }] });
}

function makerworldCard(c: (typeof makerworldCollections)[number]) {
  return { ...c, designCover: [`https://makerworld.bblmw.com/${c.id}.jpg`], creator: { handle: "Tautve" } };
}

beforeAll(async () => {
  const res = await request(app)
    .post("/api/register")
    .send({ displayName: "Browse", email: `browse-${stamp}@example.com`, password: "password123" });
  token = res.body.token;
  userId = res.body.user.id;

  global.fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input, init) => {
    const url = String(input);
    if (url.startsWith("https://api.printables.com/graphql")) {
      const body = JSON.parse(String(init?.body ?? "{}")) as { query: string; variables: Record<string, unknown> };
      return printablesGraphql(body.query, body.variables);
    }
    if (url.startsWith("https://api.bambulab.com/v1/design-service/my/favorites/listlite")) {
      return json({ total: makerworldCollections.length, hits: makerworldCollections.map(makerworldCard) });
    }
    const card = url.match(/^https:\/\/api\.bambulab\.com\/v1\/design-service\/favorites\/(\d+)$/);
    if (card) {
      const found = makerworldCollections.find((c) => c.id === card[1]);
      return found ? json(makerworldCard(found)) : json({ error: "not found" }, 404);
    }
    const head = url.match(/^https:\/\/makerworld\.com\/api\/v1\/design-service\/favorites\/(\d+)$/);
    if (head) return makerworldDesigns[head[1]] ? json({ id: Number(head[1]), title: "To print" }) : json({}, 404);
    const listing = url.match(/^https:\/\/makerworld\.com\/api\/v1\/design-service\/favorites\/(\d+)\/designs/);
    if (listing) {
      const ids = makerworldDesigns[listing[1]] ?? [];
      return json({ total: ids.length, hits: ids.map((id) => ({ id: Number(id), title: `Model ${id}` })) });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = originalFetch;
});

async function newCollection(name: string): Promise<string> {
  const res = await request(app)
    .post("/api/collections")
    .set(auth())
    .send({ name: `${name} ${stamp}` });
  return res.body.id as string;
}

describe("browsing a provider's collections to sync with", () => {
  it("says which providers can be browsed, and who the user is on them", async () => {
    const res = await request(app).get("/api/provider-collections/accounts").set(auth());
    expect(res.status).toBe(200);
    expect(res.body.makerworld).toEqual({ connected: false, account: null });
    expect(res.body.printables).toEqual({ connected: true, account: null });
  });

  it("remembers a Printables user from their profile link, then lists their collections", async () => {
    const before = await request(app).get("/api/provider-collections").query({ provider: "printables" }).set(auth());
    expect(before.status).toBe(409);

    const unknown = await request(app)
      .put("/api/provider-collections/accounts/printables")
      .set(auth())
      .send({ value: "@nobody" });
    expect(unknown.status).toBe(404);

    const saved = await request(app)
      .put("/api/provider-collections/accounts/printables")
      .set(auth())
      .send({ value: `https://www.printables.com/@${PRINTABLES_USER.handle}/collections` });
    expect(saved.status).toBe(200);
    expect(saved.body.printables.account).toBe(PRINTABLES_USER.handle);

    const list = await request(app).get("/api/provider-collections").query({ provider: "printables" }).set(auth());
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(2);
    expect(list.body[0]).toMatchObject({
      id: printablesCollections[0].id,
      name: "Practical finds",
      model_count: 23,
      url: `https://www.printables.com/@${PRINTABLES_USER.handle}/collections/${printablesCollections[0].id}`,
      thumbnails: [`https://media.printables.com/media/${printablesCollections[0].id}.jpg`],
      synced: null,
    });
  });

  it("lists the user's own MakerWorld collections through their cookie, private ones included", async () => {
    await setUserMakerworldCookie(userId, "token=test-bearer");
    const list = await request(app).get("/api/provider-collections").query({ provider: "makerworld" }).set(auth());
    expect(list.status).toBe(200);
    expect(list.body.map((c: { name: string; private: boolean }) => [c.name, c.private])).toEqual([
      ["To print", false],
      ["Secret", true],
    ]);
  });

  it("looks up a pasted collection link as the same card", async () => {
    const id = makerworldCollections[0].id;
    const res = await request(app)
      .get("/api/provider-collections/lookup")
      .query({ url: `https://makerworld.com/en/collections/${id}-to-print` })
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, name: "To print", model_count: 3, owner: "Tautve", synced: null });

    const notACollection = await request(app)
      .get("/api/provider-collections/lookup")
      .query({ url: "https://makerworld.com/en/models/123" })
      .set(auth());
    expect(notACollection.status).toBe(400);
  });
});

describe("turning sync on from the app", () => {
  it("only follows new MakerWorld models: everything there now counts as seen", async () => {
    const collectionId = await newCollection("MakerWorld");
    const source = makerworldCollections[0];
    const res = await request(app)
      .post(`/api/collection/${collectionId}/sync`)
      .set(auth())
      .send({ url: `https://makerworld.com/en/collections/${source.id}`, interval_hours: 6 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ importing: false, sync: { provider: "makerworld", interval_hours: 6 } });

    const sync = await prisma.collectionSync.findUniqueOrThrow({ where: { collectionId } });
    expect(sync.knownIds.toSorted()).toEqual(makerworldDesigns[source.id].toSorted());
    expect(await prisma.importJob.count({ where: { collectionSyncId: sync.id } })).toBe(0);

    const list = await request(app).get("/api/provider-collections").query({ provider: "makerworld" }).set(auth());
    expect(list.body[0].synced).toEqual({ collection_id: collectionId, collection_name: `MakerWorld ${stamp}` });

    // One provider collection syncs with one Thingport collection at most.
    const other = await newCollection("Second");
    const again = await request(app)
      .post(`/api/collection/${other}/sync`)
      .set(auth())
      .send({ url: `https://makerworld.com/en/collections/${source.id}` });
    expect(again.status).toBe(409);
  });

  it("imports what a Printables collection holds now, through the sync's first check", async () => {
    const collectionId = await newCollection("Printables");
    const source = printablesCollections[1];
    const res = await request(app)
      .post(`/api/collection/${collectionId}/sync`)
      .set(auth())
      .send({ url: `https://www.printables.com/@${PRINTABLES_USER.handle}/collections/${source.id}` });
    expect(res.status).toBe(200);
    expect(res.body.importing).toBe(true);

    // The first check runs in the background; the stand-in collection is empty, so it just finishes.
    await vi.waitFor(
      async () => {
        const sync = await prisma.collectionSync.findUniqueOrThrow({ where: { collectionId } });
        expect(sync.lastCheckedAt).not.toBeNull();
      },
      { timeout: 5000 },
    );
  });

  it("refuses print profile choices for providers without them", async () => {
    const collectionId = await newCollection("Profiles");
    const res = await request(app)
      .post(`/api/collection/${collectionId}/sync`)
      .set(auth())
      .send({ url: `https://www.printables.com/collections/${printablesCollections[0].id}`, profile_scope: "all" });
    expect(res.status).toBe(400);
  });
});
