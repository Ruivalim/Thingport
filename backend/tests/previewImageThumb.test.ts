import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import sharp from "sharp";
import { createApp } from "../src/app";

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
