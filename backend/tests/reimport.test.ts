import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// No pacing or DNS here. config.ts reads the pace on load, so it's hoisted.
vi.hoisted(() => {
  process.env.IMPORT_MAKERWORLD_CALL_DELAY_MS = "0";
});
vi.mock("node:dns/promises", () => ({
  default: {
    resolve4: async () => ["93.184.216.34"],
    resolve6: async () => {
      throw new Error("no AAAA");
    },
  },
}));

import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { getThingiverseAccessToken, setThingiverseAccessToken } from "../src/services/settingsService";

const app = createApp();
const stamp = Date.now();
let token: string;
const auth = () => ({ Authorization: `Bearer ${token}` });
const originalFetch = global.fetch;

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
let previousThingiverseToken: string | null = null;

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}

function pngResponse(): Response {
  return new Response(Buffer.from(ONE_PIXEL_PNG_BASE64, "base64"), {
    headers: { "content-type": "image/png" },
  });
}

const DESIGNER = { uid: 1692606088, name: "Deus Cat" };
/** Mutable so a re-import can see an updated page: what the source offers changes over time. */
const currentDesign = new Map<string, Record<string, unknown>>();
const currentThingFiles = new Map<string, string>(); // name -> file contents
let coverAvailable = true;

function setDesign(designId: string, overrides: Partial<Record<string, unknown>> = {}) {
  currentDesign.set(designId, {
    id: Number(designId),
    modelId: `US${designId}`,
    title: `Phoenix ${designId}`,
    summary: "<p>A phoenix.</p>",
    tags: ["phoenix"],
    coverUrl: "https://makerworld.bblmw.com/cover.jpg",
    designCreator: DESIGNER,
    defaultInstanceId: 2,
    instances: [
      { id: 1, profileId: 101, title: "Single-colour version", instanceCreator: DESIGNER },
      { id: 2, profileId: 102, title: "multi-colored version", instanceCreator: DESIGNER },
    ],
    ...overrides,
  });
}

const THING_ID = "8880001";

function mockFetch() {
  global.fetch = vi.fn<(input: RequestInfo | URL) => Promise<Response>>(async (input) => {
    const url = String(input);
    const model = url.match(/^https:\/\/api\.bambulab\.com\/v1\/design-service\/design\/(\d+)/);
    if (model) return json(currentDesign.get(model[1]) ?? {});
    const profile = url.match(/^https:\/\/api\.bambulab\.com\/v1\/iot-service\/api\/user\/profile\/(\d+)/);
    if (profile)
      return json({
        message: "success",
        url: `https://s3.example.com/phoenix-${profile[1]}.stl`,
        filename: `phoenix-${profile[1]}.stl`,
      });
    const file = url.match(/^https:\/\/s3\.example\.com\/phoenix-(\d+)\.stl$/);
    if (file)
      return new Response(`solid phoenix-${file[1]}\nendsolid\n`, {
        headers: { "content-type": "application/octet-stream" },
      });
    if (url === "https://makerworld.bblmw.com/cover.jpg") {
      return coverAvailable ? pngResponse() : new Response("gone", { status: 404 });
    }
    if (url.startsWith(`https://api.thingiverse.com/things/${THING_ID}`)) {
      return json({
        id: Number(THING_ID),
        name: "Test Widget",
        description: "A widget.",
        tags: [{ name: "Widget" }],
        thumbnail: "https://cdn.thingiverse.com/assets/test/thumb.jpg",
        default_image: { url: "https://cdn.thingiverse.com/assets/test/preview.jpg" },
        categories_url: `https://api.thingiverse.com/things/${THING_ID}/categories`,
        creator: { id: 42, name: "TestCreator" },
        zip_data: {
          files: [...currentThingFiles.keys()].map((name) => ({
            name,
            url: `https://cdn.thingiverse.com/assets/test/${name}`,
          })),
          images: [{ name: "render.png", url: "https://cdn.thingiverse.com/renders/test/render.png" }],
        },
      });
    }
    if (url.startsWith(`https://api.thingiverse.com/things/${THING_ID}/categories`)) {
      return json([{ id: 129, name: "3D Printing Tests" }]);
    }
    const thingFile = url.match(/^https:\/\/cdn\.thingiverse\.com\/assets\/test\/(.+)$/);
    if (thingFile && currentThingFiles.has(thingFile[1])) {
      return new Response(currentThingFiles.get(thingFile[1]), {
        headers: { "content-type": "application/sla" },
      });
    }
    if (url.endsWith(".png") || url.endsWith(".jpg")) return pngResponse();
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

async function importMakerworldModel(designId: string, scope?: "url" | "designer" | "all") {
  const payload = {
    url: `https://makerworld.com/en/models/${designId}-phoenix`,
    makerworld_cookie: "token=test-bearer",
    ...(scope && scope !== "url" ? { scope } : {}),
  };
  const res =
    scope && scope !== "url"
      ? await request(app).post("/api/import/makerworld-profiles").set(auth()).send(payload)
      : await request(app).post("/api/import").set(auth()).send(payload);
  if (res.status === 202) {
    let job = (await request(app).get(`/api/import/jobs/${res.body.job_id}`).set(auth())).body;
    for (let i = 0; i < 100 && job.status === "RUNNING"; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      job = (await request(app).get(`/api/import/jobs/${res.body.job_id}`).set(auth())).body;
    }
    return (await request(app).get(`/api/print/${job.result_print_id}`).set(auth())).body;
  }
  return res.body;
}

async function reimport(printId: string, opts: Record<string, boolean> = {}) {
  return request(app).post(`/api/print/${printId}/reimport`).set(auth()).send(opts);
}

describe("re-importing a model from its source", () => {
  beforeAll(async () => {
    const res = await request(app)
      .post("/api/register")
      .send({
        displayName: "Reimport Test",
        email: `reimport-${stamp}@example.com`,
        password: "password123",
      });
    token = res.body.token;
    await request(app).patch("/api/settings/makerworld").set(auth()).send({ cookie: "token=test-bearer" });
    previousThingiverseToken = await getThingiverseAccessToken();
    await setThingiverseAccessToken("test-access-token");
    mockFetch();
  });

  afterAll(async () => {
    // Files share one database; leave the token as this file found it.
    await setThingiverseAccessToken(previousThingiverseToken);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    mockFetch();
  });

  it("fills only the empty metadata and merges tags, never overwriting an edit", async () => {
    const designId = String(stamp % 1_000_000_000);
    setDesign(designId);
    const print = await importMakerworldModel(designId);

    // The user edits by hand, and the source later changes its own title, notes and tags.
    await prisma.print.update({
      where: { id: print.id },
      data: { title: "My own title", notes: null, tags: ["mine"] },
    });
    setDesign(designId, {
      title: "Phoenix Deluxe",
      summary: "<p>An updated description.</p>",
      tags: ["phoenix", "articulated"],
    });

    const res = await reimport(print.id, { metadata: true, files: false, images: false });
    expect(res.status).toBe(200);
    expect(res.body.title_filled).toBe(false);
    expect(res.body.notes_filled).toBe(true);
    expect(res.body.tags_added).toEqual(["phoenix", "articulated"]);

    const updated = await prisma.print.findUniqueOrThrow({ where: { id: print.id } });
    expect(updated.title).toBe("My own title"); // the edit wins
    expect(updated.notes).toBe("An updated description."); // the empty one is filled
    expect(updated.tags.toSorted()).toEqual(["articulated", "mine", "phoenix"]);
    expect(updated.creator).toBe("Deus Cat");
    expect(updated.authorId).not.toBeNull();
  });

  it("brings in the MakerWorld print profiles the model doesn't hold yet", async () => {
    const designId = String((stamp % 1_000_000_000) + 1);
    setDesign(designId);
    const print = await importMakerworldModel(designId);
    expect(print.plates).toHaveLength(1);

    const res = await reimport(print.id, { metadata: false, files: true, images: false });
    expect(res.status).toBe(200);
    expect(res.body.files_added).toBe(1);
    expect(res.body.files_already_present).toBe(1);

    const plates = await prisma.plate.findMany({ where: { printId: print.id } });
    expect(plates).toHaveLength(2);
    // A second run has nothing left to add.
    const again = await reimport(print.id, { metadata: false, files: true, images: false });
    expect(again.body.files_added).toBe(0);
    expect(again.body.files_already_present).toBe(2);
  });

  it("fills the image slots only while they are empty", async () => {
    const designId = String((stamp % 1_000_000_000) + 2);
    coverAvailable = false;
    setDesign(designId);
    const print = await importMakerworldModel(designId);
    expect(await prisma.previewImage.count({ where: { printId: print.id } })).toBe(0);

    coverAvailable = true;
    const res = await reimport(print.id, { metadata: false, files: false, images: true });
    expect(res.body.images_added).toBeGreaterThan(0);

    const count = await prisma.previewImage.count({ where: { printId: print.id } });
    const again = await reimport(print.id, { metadata: false, files: false, images: true });
    expect(again.body.images_added).toBe(0);
    expect(await prisma.previewImage.count({ where: { printId: print.id } })).toBe(count);
  });

  it("adds a source file the library doesn't hold, without duplicating one it does", async () => {
    currentThingFiles.set("body.stl", "solid body\nendsolid\n");
    currentThingFiles.set("wheels.stl", "solid wheels\nendsolid\n");
    const res = await request(app)
      .post("/api/import")
      .set(auth())
      .send({ url: `https://www.thingiverse.com/thing:${THING_ID}` });
    expect(res.status).toBe(200);
    const print = res.body;
    expect(print.plates).toHaveLength(2);

    // Nothing new at the source: everything is recognized by content.
    const same = await reimport(print.id, { metadata: false, files: true, images: false });
    expect(same.body.files_added).toBe(0);
    expect(same.body.files_already_present).toBe(2);

    // The author replaces one file and adds another; the changed one comes in, the rest is skipped.
    currentThingFiles.set("wheels.stl", "solid wheels v2\nendsolid\n");
    currentThingFiles.set("spare.stl", "solid spare\nendsolid\n");
    const changed = await reimport(print.id, { metadata: false, files: true, images: false });
    expect(changed.body.files_added).toBe(2);
    expect(changed.body.files_already_present).toBe(1);
    expect(await prisma.plate.count({ where: { printId: print.id } })).toBe(4);
  });

  it("does nothing when every part is turned off", async () => {
    const designId = String((stamp % 1_000_000_000) + 3);
    setDesign(designId, { title: "Untouched", tags: ["never"] });
    const print = await importMakerworldModel(designId);
    await prisma.print.update({ where: { id: print.id }, data: { title: "Kept", tags: ["kept"] } });

    const res = await reimport(print.id, { metadata: false, files: false, images: false });
    expect(res.status).toBe(200);
    expect(res.body.tags_added).toEqual([]);
    expect(res.body.files_added).toBe(0);
    expect(res.body.images_added).toBe(0);

    const updated = await prisma.print.findUniqueOrThrow({ where: { id: print.id } });
    expect(updated.title).toBe("Kept");
    expect(updated.tags).toEqual(["kept"]);
  });

  it("refuses a model with no recorded source", async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: `reimport-${stamp}@example.com` } });
    const print = await prisma.print.create({
      data: { userId: user.id, name: `no-source-${stamp}`, nameNormalized: `no-source-${stamp}` },
    });
    const res = await reimport(print.id);
    expect(res.status).toBe(400);
  });
});
