import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp();
const stamp = Date.now();
// One word that matches nothing else in a shared test database.
const word = `zorblax${stamp}`;
let session: string;
let apiToken: string;

function auth(t: string) {
  return { Authorization: `Bearer ${t}` };
}

beforeAll(async () => {
  const registered = await request(app)
    .post("/api/register")
    .send({ displayName: "Search Test", email: `search-test-${stamp}@example.com`, password: "password123" });
  if (registered.status !== 200) {
    throw new Error(`Failed to register during test setup: ${registered.status} ${JSON.stringify(registered.body)}`);
  }
  session = registered.body.token;
  const userId = registered.body.user.id;
  for (let i = 0; i < 9; i++) {
    const name = `${word} model ${i}`;
    await prisma.print.create({ data: { userId, name, nameNormalized: name.toLowerCase() } });
  }
  apiToken = (await request(app).post("/api/profile/api-token").set(auth(session))).body.token;
});

describe("GET /search", () => {
  it("returns the palette's six models by default", async () => {
    const res = await request(app).get("/api/search").query({ q: word }).set(auth(session));
    expect(res.status).toBe(200);
    expect(res.body.models).toHaveLength(6);
  });

  it("returns more with a limit, for clients that show more", async () => {
    const res = await request(app).get("/api/search").query({ q: word, limit: 8 }).set(auth(session));
    expect(res.body.models).toHaveLength(8);
  });

  it("caps the limit", async () => {
    const res = await request(app).get("/api/search").query({ q: word, limit: 1000 }).set(auth(session));
    expect(res.body.models).toHaveLength(9);
  });

  it("ignores a limit that isn't a number", async () => {
    const res = await request(app).get("/api/search").query({ q: word, limit: "lots" }).set(auth(session));
    expect(res.body.models).toHaveLength(6);
  });

  it("works with an API token", async () => {
    const res = await request(app).get("/api/search").query({ q: word }).set(auth(apiToken));
    expect(res.status).toBe(200);
    expect(res.body.models[0].name).toContain(word);
  });
});
