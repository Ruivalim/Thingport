import { afterEach, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { attachImportedPreviewImages } from "../src/services/importService";
import { plateThumbPath } from "../src/services/printService";
import { previewImagePath } from "../src/services/previewImageService";

const app = createApp();
let token: string;

const STL =
  "solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n";
const auth = () => ({ Authorization: `Bearer ${token}` });

function png(r: number) {
  return sharp({ create: { width: 8, height: 8, channels: 3, background: { r, g: 0, b: 0 } } })
    .png()
    .toBuffer();
}

// The stored JPEGs are re-encoded, so an image is recognised by its red channel.
async function redOf(filePath: string) {
  return Math.round((await sharp(filePath).stats()).channels[0].mean);
}

async function uploadStl() {
  const res = await request(app).post("/api/upload").set(auth()).attach("files", Buffer.from(STL), "part.stl");
  expect(res.status).toBe(200);
  return res.body.prints[0] as { id: string; thumb_url: string | null };
}

beforeAll(async () => {
  token = (
    await request(app)
      .post("/api/register")
      .send({ displayName: "Thumbs", email: `thumbs-${Date.now()}@example.com`, password: "password123" })
  ).body.token;
});

describe("preview images", () => {
  it("makes the first added image the thumbnail of a model without one", async () => {
    const print = await uploadStl();
    expect(print.thumb_url).toBeNull();
    const res = await request(app)
      .post(`/api/print/${print.id}/preview-images`)
      .set(auth())
      .attach("files", await png(10), "a.png")
      .attach("files", await png(200), "b.png");
    expect(res.status).toBe(200);
    expect(res.body.print.preview_images).toHaveLength(2);
    expect(res.body.print.thumb_url).not.toBeNull();
  });
});

describe("a 3D render made while an import runs", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("gives way to the imported cover, as thumbnail and first preview image", async () => {
    const print = await uploadStl();
    const plate = (await prisma.plate.findFirst({ where: { printId: print.id } }))!;

    // The model is browsable before its images download, so the app renders and saves one.
    const render = await request(app)
      .post(`/api/plate/${plate.id}/thumbnail-generated`)
      .set(auth())
      .attach("file", await png(10), "render.png");
    expect(render.status).toBe(200);
    expect(render.body.print.preview_images).toHaveLength(1);

    const images: Record<string, Buffer> = {
      "https://img.example.com/cover.png": await png(200),
      "https://img.example.com/gallery.png": await png(120),
    };
    global.fetch = (async (input: RequestInfo | URL) => {
      const body = images[String(input)];
      return body
        ? new Response(body, { headers: { "content-type": "image/png" } })
        : new Response("not found", { status: 404 });
    }) as typeof fetch;
    await attachImportedPreviewImages(
      print.id,
      plate.id,
      "https://img.example.com/cover.png",
      [{ url: "https://img.example.com/gallery.png", filename: "gallery.png" }],
      0,
    );

    const previews = await prisma.previewImage.findMany({ where: { printId: print.id }, orderBy: { position: "asc" } });
    expect(previews.map((img) => [img.position, img.generated])).toEqual([
      [0, false],
      [1, false],
    ]);
    expect(await redOf(previewImagePath(previews[0].id))).toBeGreaterThan(180);
    expect(await redOf(plateThumbPath(plate.id))).toBeGreaterThan(180);
    expect((await prisma.plate.findUnique({ where: { id: plate.id } }))!.thumbGenerated).toBe(false);

    // A render that finishes after the cover landed doesn't replace it.
    const late = await request(app)
      .post(`/api/plate/${plate.id}/thumbnail-generated`)
      .set(auth())
      .attach("file", await png(10), "render.png");
    expect(late.status).toBe(200);
    expect(late.body.print.preview_images).toHaveLength(2);
    expect(await redOf(plateThumbPath(plate.id))).toBeGreaterThan(180);
  });
});

describe("tag tiles", () => {
  it("give each tag up to ten pictures, from its newest models that have one", async () => {
    const tag = `Mosaic-${Date.now()}`;
    const prints: { id: string; plateId: string }[] = [];
    for (let i = 0; i < 12; i++) {
      const res = await request(app).post("/api/upload").set(auth()).attach("files", Buffer.from(STL), `m${i}.stl`);
      const print = res.body.prints[0] as { id: string; plates: { id: string }[] };
      await request(app)
        .post(`/api/print/${print.id}/tags`)
        .set(auth())
        .send({ tags: [tag] });
      prints.push({ id: print.id, plateId: print.plates[0].id });
    }
    // The newest has no picture at all; the other eleven have a rendered plate.
    for (const { plateId } of prints.slice(0, 11)) {
      await fs.mkdir(path.dirname(plateThumbPath(plateId)), { recursive: true });
      await sharp(await png(200))
        .jpeg()
        .toFile(plateThumbPath(plateId));
    }

    const res = await request(app).get("/api/tags/summary").set(auth());
    const tile = (res.body.items as { name: string; count: number; thumbnails: string[] }[]).find(
      (t) => t.name === tag,
    )!;
    expect(tile.count).toBe(12);
    expect(tile.thumbnails).toHaveLength(10);
    expect(tile.thumbnails[0]).toContain(`/plate/${prints[10].plateId}/thumb.jpg`);
    expect(tile.thumbnails.some((url) => url.includes(prints[11].plateId))).toBe(false);
  });

  it("come a page at a time, leaving out tags under the minimum count", async () => {
    const own = (
      await request(app)
        .post("/api/register")
        .send({ displayName: "Pages", email: `tag-pages-${Date.now()}@example.com`, password: "password123" })
    ).body.token as string;
    const tagged: string[][] = [
      ["Alpha", "Beta"],
      ["Alpha", "Beta"],
      ["Alpha", "Gamma"],
    ];
    for (const tags of tagged) {
      const res = await request(app)
        .post("/api/upload")
        .set({ Authorization: `Bearer ${own}` })
        .attach("files", Buffer.from(STL), "p.stl");
      await request(app)
        .post(`/api/print/${res.body.prints[0].id}/tags`)
        .set({ Authorization: `Bearer ${own}` })
        .send({ tags });
    }
    const page = (query: Record<string, string | number>) =>
      request(app)
        .get("/api/tags/summary")
        .set({ Authorization: `Bearer ${own}` })
        .query(query);

    const first = await page({ limit: 1, offset: 0, min_count: 2 });
    expect(first.body.items.map((t: { name: string }) => t.name)).toEqual(["Alpha"]);
    expect(first.body).toMatchObject({ total: 2, total_all: 3, has_more: true });

    const second = await page({ limit: 1, offset: 1, min_count: 2 });
    expect(second.body.items.map((t: { name: string; count: number }) => [t.name, t.count])).toEqual([["Beta", 2]]);
    expect(second.body.has_more).toBe(false);

    const byName = await page({ sort: "name" });
    expect(byName.body.items.map((t: { name: string }) => t.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });
});

describe("deleting a tag", () => {
  it("takes it off every model that has it, and drops its bookmark", async () => {
    const own = (
      await request(app)
        .post("/api/register")
        .send({ displayName: "Untag", email: `tag-delete-${Date.now()}@example.com`, password: "password123" })
    ).body.token as string;
    const as = { Authorization: `Bearer ${own}` };
    const ids: string[] = [];
    for (const tags of [["Doomed", "Kept"], ["Doomed"], ["Kept"]]) {
      const res = await request(app).post("/api/upload").set(as).attach("files", Buffer.from(STL), "p.stl");
      ids.push(res.body.prints[0].id);
      await request(app).post(`/api/print/${res.body.prints[0].id}/tags`).set(as).send({ tags });
    }
    await request(app).post("/api/tags/Doomed/bookmark").set(as);

    const res = await request(app).delete("/api/tags/doomed").set(as);
    expect(res.status).toBe(200);
    expect(res.body.models).toBe(2);
    const tagsOf = await Promise.all(
      ids.map(async (id) => (await request(app).get(`/api/print/${id}`).set(as)).body.tags),
    );
    expect(tagsOf).toEqual([["Kept"], [], ["Kept"]]);
    expect((await request(app).get("/api/tags/bookmarked").set(as)).body).toEqual([]);
  });
});
