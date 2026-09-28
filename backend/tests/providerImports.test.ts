import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// End-to-end coverage of the core feature: importing a model from each supported site through
// POST /api/import, exactly as the web app (and, for MakerWorld, the Thingport Grab extension)
// sends it -- then checking everything the library shows for the result: title, description,
// tags, a linked author with an avatar, preview images, the model file itself, its thumbnail and
// its server-built 3D preview. Each site's HTTP API is replaced by a fetch mock answering with
// the real response shapes (see each provider's service for where those were confirmed), and DNS
// by a stub, so these run offline and deterministically -- in CI too (see backend-image.yml).

// Host validation (utils/urlUtils.ts) resolves every user-supplied host; answer with a public
// address instead of touching the network.
vi.mock("node:dns/promises", () => ({
  default: {
    resolve4: async () => ["93.184.216.34"],
    resolve6: async () => {
      throw new Error("no AAAA");
    },
  },
}));

const { createApp } = await import("../src/app");
const { prisma } = await import("../src/db");
const { writeZip } = await import("../src/utils/zipWriter");
const { getPreviewMode, setPreviewMode, getThingiverseAccessToken, setThingiverseAccessToken } = await import(
  "../src/services/settingsService"
);

const app = createApp();
const stamp = Date.now();
let token: string;
const auth = () => ({ Authorization: `Bearer ${token}` });

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
let threeMfBytes: Buffer;

/** A small but real Bambu-style .3mf: one object, and an embedded plate thumbnail. */
async function buildThreeMf(): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "thingport-provider-3mf-"));
  const modelPath = path.join(dir, "3dmodel.model");
  await fs.writeFile(
    modelPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="millimeter">
 <resources><object id="1" type="model"><mesh>
  <vertices><vertex x="0" y="0" z="0"/><vertex x="10" y="0" z="0"/><vertex x="0" y="10" z="0"/><vertex x="0" y="0" z="10"/></vertices>
  <triangles><triangle v1="0" v2="2" v3="1"/><triangle v1="0" v2="1" v3="3"/><triangle v1="1" v2="2" v3="3"/><triangle v1="0" v2="3" v3="2"/></triangles>
 </mesh></object></resources>
 <build><item objectid="1"/></build>
</model>`,
  );
  const thumbPath = path.join(dir, "plate_1.png");
  await fs.writeFile(thumbPath, ONE_PIXEL_PNG);
  const zipPath = path.join(dir, "model.3mf");
  await writeZip(zipPath, [
    { arcname: "3D/3dmodel.model", filePath: modelPath },
    { arcname: "Metadata/plate_1.png", filePath: thumbPath },
  ]);
  return fs.readFile(zipPath);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function png(): Response {
  return new Response(ONE_PIXEL_PNG, { headers: { "content-type": "image/png" } });
}
function threeMf(): Response {
  return new Response(threeMfBytes, { headers: { "content-type": "application/octet-stream" } });
}
/** What MakerWorld's author-profile endpoint really answers a server with today. */
function cloudflareChallenge(): Response {
  return new Response("<!DOCTYPE html><title>Just a moment...</title>", {
    status: 403,
    headers: { "content-type": "text/html", "cf-mitigated": "challenge", server: "cloudflare" },
  });
}

type Routes = Record<string, (init?: RequestInit) => Response>;
const originalFetch = global.fetch;

/** Answers exactly the listed URLs (by prefix); anything else fails the test loudly. */
function mockFetch(routes: Routes) {
  global.fetch = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(async (input, init) => {
    const url = String(input);
    const match = Object.keys(routes)
      .filter((prefix) => url.startsWith(prefix))
      .toSorted((a, b) => b.length - a.length)[0];
    if (!match) throw new Error(`Unexpected fetch to ${url}`);
    return routes[match](init);
  }) as unknown as typeof fetch;
}

/** Everything the library shows for an imported model -- checked the same way per provider. */
type Expected = {
  title: string;
  descriptionIncludes: string;
  tags: string[];
  author: { id: string; name: string; avatarUrl: string };
  previewImages: number;
  filename: string;
};

async function expectFullyImported(printId: string, expected: Expected) {
  const res = await request(app).get(`/api/print/${printId}`).set(auth());
  expect(res.status).toBe(200);
  const print = res.body;

  // `title` is the source's own title; the model's `name` may carry a " (2)" if the library
  // already has a model called that.
  expect(print.title).toBe(expected.title);
  expect(print.notes).toContain(expected.descriptionIncludes);
  expect(print.tags.toSorted()).toEqual(expected.tags.toSorted());

  // The author is a real, linked record -- what makes it clickable, hoverable and shown with an
  // avatar -- not just the plain-text name.
  expect(print.author).toMatchObject({ id: expected.author.id, name: expected.author.name, avatar_url: expected.author.avatarUrl });
  const authorPage = await request(app).get(`/api/author/${encodeURIComponent(expected.author.id)}`).set(auth());
  expect(authorPage.status).toBe(200);
  expect(authorPage.body.author ?? authorPage.body).toMatchObject({ id: expected.author.id });

  expect(print.preview_images).toHaveLength(expected.previewImages);
  for (const image of print.preview_images) {
    const file = await request(app).get(`/api${image.url.split("?")[0]}`).set(auth());
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("image/jpeg");
  }

  expect(print.plates).toHaveLength(1);
  const [plate] = print.plates;
  expect(plate.filename).toBe(expected.filename);
  const download = await request(app).get(`/api${plate.url}`).set(auth()).buffer(true).parse((r, cb) => {
    const chunks: Buffer[] = [];
    r.on("data", (c: Buffer) => chunks.push(c));
    r.on("end", () => cb(null, Buffer.concat(chunks)));
  });
  expect(download.status).toBe(200);
  expect(Buffer.compare(download.body as Buffer, threeMfBytes)).toBe(0);

  // Card thumbnail, from the 3MF's embedded plate image.
  expect(plate.thumb_url).toBeTruthy();
  expect((await request(app).get(`/api${plate.thumb_url.split("?")[0]}`).set(auth())).status).toBe(200);

  // Interactive 3D preview: built by the server in the background after import.
  expect(plate.preview_glb_url).toBeTruthy();
  const glbPath = `/api${plate.preview_glb_url.split("?")[0]}`;
  let glb = await request(app).get(glbPath).set(auth());
  for (let i = 0; i < 60 && glb.status !== 200; i++) {
    expect(glb.body.code).toBe("PREVIEW_GENERATING");
    await new Promise((resolve) => setTimeout(resolve, 250));
    glb = await request(app).get(glbPath).set(auth());
  }
  expect(glb.status).toBe(200);
  expect(glb.headers["content-type"]).toBe("model/gltf-binary");
}

let previousPreviewMode: Awaited<ReturnType<typeof getPreviewMode>>;
let previousThingiverseToken: string | null;

beforeAll(async () => {
  threeMfBytes = await buildThreeMf();
  previousPreviewMode = await getPreviewMode();
  previousThingiverseToken = await getThingiverseAccessToken();
  await setPreviewMode("automatic");
  const res = await request(app)
    .post("/api/register")
    .send({ displayName: "Provider Import Test", email: `provider-imports-${stamp}@example.com`, password: "password123" });
  token = res.body.token;
});

afterEach(() => {
  global.fetch = originalFetch;
});

afterAll(async () => {
  await setPreviewMode(previousPreviewMode);
  await setThingiverseAccessToken(previousThingiverseToken);
});

describe("importing from Thingiverse", () => {
  it("imports the thing with its author, images, description, tags, file and previews", async () => {
    const thingId = String(stamp % 1_000_000_000);
    await setThingiverseAccessToken("test-access-token");
    mockFetch({
      [`https://api.thingiverse.com/things/${thingId}/categories`]: () => json([]),
      [`https://api.thingiverse.com/things/${thingId}`]: () =>
        json({
          id: Number(thingId),
          name: "Articulated Test Dragon",
          description: "A **flexible** dragon, printed in place.",
          tags: [{ name: "dragon" }, { name: "print in place" }],
          default_image: { url: "https://cdn.thingiverse.com/assets/dragon/cover.jpg" },
          creator: {
            id: 5150,
            name: "DragonMaker",
            public_url: "https://www.thingiverse.com/DragonMaker",
            thumbnail: "https://cdn.thingiverse.com/renders/dragonmaker/avatar.jpg",
            cover: "https://cdn.thingiverse.com/renders/dragonmaker/cover.jpg",
          },
          zip_data: {
            files: [{ name: "dragon.3mf", url: "https://cdn.thingiverse.com/assets/dragon/dragon.3mf" }],
            images: [{ name: "render.png", url: "https://cdn.thingiverse.com/renders/dragon/render.png" }],
          },
        }),
      "https://cdn.thingiverse.com/assets/dragon/dragon.3mf": threeMf,
      "https://cdn.thingiverse.com/assets/dragon/cover.jpg": png,
      "https://cdn.thingiverse.com/renders/dragon/render.png": png,
    });

    const res = await request(app).post("/api/import").set(auth()).send({ url: `https://www.thingiverse.com/thing:${thingId}` });
    expect(res.status).toBe(200);
    await expectFullyImported(res.body.id, {
      title: "Articulated Test Dragon",
      descriptionIncludes: "dragon, printed in place",
      tags: ["Dragon", "Print in place"], // tags come out normalized (see utils/tagNormalization.ts)
      author: { id: "thingiverse:5150", name: "DragonMaker", avatarUrl: "https://cdn.thingiverse.com/renders/dragonmaker/avatar.jpg" },
      previewImages: 2,
      filename: "dragon.3mf",
    });
  });
});

describe("importing from Printables", () => {
  it("imports the model with its author, images, description, tags, file and previews", async () => {
    const modelId = String(stamp % 1_000_000_000);
    mockFetch({
      "https://api.printables.com/graphql/": (init) => {
        const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
        if (body.query?.includes("getDownloadLink")) {
          return json({
            data: {
              getDownloadLink: {
                ok: true,
                errors: null,
                output: { files: [{ id: "77", link: "https://files.printables.com/media/prints/hook.3mf" }] },
              },
            },
          });
        }
        return json({
          data: {
            print: {
              id: modelId,
              name: "Sturdy Wall Hook",
              description: "<p>Holds up to <b>5 kg</b>.</p>",
              user: { id: "31337", handle: "hookmaker", publicUsername: "HookMaker", avatarFilePath: "media/auth/avatars/hookmaker.png" },
              image: { filePath: "media/prints/hook-cover.jpg" },
              images: [{ filePath: "media/prints/hook-cover.jpg" }, { filePath: "media/prints/hook-side.jpg" }],
              tags: [{ name: "hook" }, { name: "wall" }],
              category: { id: 1, name: "Household" },
              stls: [{ id: "77", name: "hook.3mf" }],
            },
          },
        });
      },
      "https://files.printables.com/media/prints/hook.3mf": threeMf,
      "https://media.printables.com/media/prints/hook-cover.jpg": png,
      "https://media.printables.com/media/prints/hook-side.jpg": png,
    });

    const res = await request(app).post("/api/import").set(auth()).send({ url: `https://www.printables.com/model/${modelId}-sturdy-wall-hook` });
    expect(res.status).toBe(200);
    await expectFullyImported(res.body.id, {
      title: "Sturdy Wall Hook",
      descriptionIncludes: "Holds up to 5 kg",
      tags: ["Hook", "Wall"],
      author: { id: "printables:31337", name: "HookMaker", avatarUrl: "https://media.printables.com/media/auth/avatars/hookmaker.png" },
      previewImages: 2,
      filename: "hook.3mf",
    });
  });
});

describe("importing from MakerWorld", () => {
  const creator = {
    uid: 2468013579,
    name: "BenchyFan",
    handle: "benchyfan",
    avatar: "https://public-cdn.bblmw.com/avatar/benchyfan.png",
  };

  /** The model page, as MakerWorld serves it: everything in Next.js's __NEXT_DATA__. */
  function modelPage(designId: string, instanceId: string): string {
    const nextData = {
      props: {
        pageProps: {
          design: {
            id: Number(designId),
            title: "Classic Benchy",
            summary: "<p>The <b>classic</b> calibration boat.</p>",
            tags: ["benchy", "calibration"],
            coverUrl: "https://makerworld.bblmw.com/makerworld/model/benchy/cover.jpg",
            designCreator: creator,
            designExtension: {
              design_pictures: [{ name: "side.jpg", url: "https://makerworld.bblmw.com/makerworld/model/benchy/side.jpg" }],
            },
            defaultInstanceId: Number(instanceId),
            instances: [{ id: Number(instanceId), title: "0.2mm layer" }],
          },
        },
      },
    };
    return `<html><head><title>Classic Benchy</title></head><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;
  }

  const expected = (overrides: Partial<Expected> = {}): Expected => ({
    title: "Classic Benchy",
    descriptionIncludes: "classic calibration boat",
    tags: ["Benchy", "Calibration"],
    author: { id: `makerworld:${creator.uid}`, name: creator.name, avatarUrl: creator.avatar },
    previewImages: 2,
    filename: "benchy.3mf",
    ...overrides,
  });

  it("from the web app without a MakerWorld login: reads the page, and still links the author", async () => {
    const designId = String(stamp % 1_000_000_000);
    const instanceId = String((stamp % 1_000_000_000) + 1);
    mockFetch({
      [`https://makerworld.com/en/models/${designId}`]: () =>
        new Response(modelPage(designId, instanceId), { headers: { "content-type": "text/html; charset=utf-8" } }),
      // The fuller author profile is behind Cloudflare's challenge for a server -- the author
      // must come through anyway, from the page's own creator summary.
      "https://makerworld.com/api/v1/design-user-service/user/profile/": cloudflareChallenge,
      [`https://makerworld.com/api/v1/design-service/instance/${instanceId}/f3mf`]: () =>
        json({ name: "benchy.3mf", url: "https://makerworld.bblmw.com/makerworld/model/benchy/benchy.3mf" }),
      "https://makerworld.bblmw.com/makerworld/model/benchy/benchy.3mf": threeMf,
      "https://makerworld.bblmw.com/makerworld/model/benchy/cover.jpg": png,
      "https://makerworld.bblmw.com/makerworld/model/benchy/side.jpg": png,
    });

    const res = await request(app).post("/api/import").set(auth()).send({ url: `https://makerworld.com/en/models/${designId}-classic-benchy` });
    expect(res.status).toBe(200);
    await expectFullyImported(res.body.id, expected());
  });

  it("from the Thingport Grab extension (download link resolved in the browser): still links the author", async () => {
    const designId = String((stamp % 1_000_000_000) + 10);
    const instanceId = String((stamp % 1_000_000_000) + 11);
    mockFetch({
      [`https://makerworld.com/en/models/${designId}`]: () =>
        new Response(modelPage(designId, instanceId), { headers: { "content-type": "text/html; charset=utf-8" } }),
      "https://makerworld.com/api/v1/design-user-service/user/profile/": cloudflareChallenge,
      "https://makerworld.bblmw.com/makerworld/model/benchy/benchy.3mf": threeMf,
      "https://makerworld.bblmw.com/makerworld/model/benchy/cover.jpg": png,
      "https://makerworld.bblmw.com/makerworld/model/benchy/side.jpg": png,
    });

    const res = await request(app)
      .post("/api/import")
      .set({ ...auth(), "X-Thingport-Client": "grab" })
      .send({
        url: `https://makerworld.com/en/models/${designId}-classic-benchy`,
        resolved_download_url: "https://makerworld.bblmw.com/makerworld/model/benchy/benchy.3mf",
        resolved_instance_id: instanceId,
      });
    expect(res.status).toBe(200);
    await expectFullyImported(res.body.id, expected());
  });

  /** A web-app import with a MakerWorld login, which goes through MakerWorld's own API. */
  async function importWithLogin(designId: string, profileReachable: boolean) {
    const profileId = String(Number(designId) + 1);
    mockFetch({
      [`https://api.bambulab.com/v1/design-service/design/${designId}`]: () =>
        json({
          id: Number(designId),
          modelId: `US${designId}`,
          title: "Classic Benchy",
          summary: "<p>The <b>classic</b> calibration boat.</p>",
          tags: ["benchy", "calibration"],
          coverUrl: "https://makerworld.bblmw.com/makerworld/model/benchy/cover.jpg",
          designCreator: creator,
          designExtension: {
            design_pictures: [{ name: "side.jpg", url: "https://makerworld.bblmw.com/makerworld/model/benchy/side.jpg" }],
          },
          defaultInstanceId: 1,
          instances: [{ id: 1, profileId: Number(profileId) }],
          categories: [],
        }),
      [`https://api.bambulab.com/v1/iot-service/api/user/profile/${profileId}`]: () =>
        json({ message: "success", url: "https://s3.example-bucket.com/benchy.3mf?sig=1", filename: "benchy.3mf" }),
      [`https://makerworld.com/api/v1/design-user-service/user/profile/${creator.uid}`]: profileReachable
        ? () =>
            json({
              name: creator.name,
              avatar: creator.avatar,
              personal: {
                handle: creator.handle,
                bio: "I print boats.",
                links: ["https://example.com/benchyfan"],
                backgroundUrl: "https://public-cdn.bblmw.com/bg/benchyfan.jpg",
              },
            })
        : cloudflareChallenge,
      "https://s3.example-bucket.com/benchy.3mf": threeMf,
      "https://makerworld.bblmw.com/makerworld/model/benchy/cover.jpg": png,
      "https://makerworld.bblmw.com/makerworld/model/benchy/side.jpg": png,
    });
    const res = await request(app)
      .post("/api/import")
      .set(auth())
      .send({ url: `https://makerworld.com/en/models/${designId}-classic-benchy`, makerworld_cookie: "token=test-bearer-token" });
    expect(res.status).toBe(200);
    await expectFullyImported(res.body.id, expected());
  }

  it("from the web app with a MakerWorld login: uses MakerWorld's API, with the full author profile when reachable", async () => {
    await importWithLogin(String((stamp % 1_000_000_000) + 20), true);
    const author = await prisma.author.findUniqueOrThrow({ where: { id: `makerworld:${creator.uid}` } });
    expect(author).toMatchObject({ bio: "I print boats.", links: ["https://example.com/benchyfan"], handle: creator.handle });
  });

  it("from the web app with a MakerWorld login, profile blocked: still links the author, keeping known details", async () => {
    await importWithLogin(String((stamp % 1_000_000_000) + 30), false);
    // The earlier import's fuller profile isn't wiped by this one's shorter creator summary.
    const author = await prisma.author.findUniqueOrThrow({ where: { id: `makerworld:${creator.uid}` } });
    expect(author).toMatchObject({ bio: "I print boats.", links: ["https://example.com/benchyfan"] });
  });
});
