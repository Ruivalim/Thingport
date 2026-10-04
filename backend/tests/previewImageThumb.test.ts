import { afterEach, beforeAll, describe, expect, it } from "vitest";
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
