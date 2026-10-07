import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp();
const stamp = Date.now();
let token: string;
let userId: string;

const STL =
  "solid t\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid t\n";
const auth = () => ({ Authorization: `Bearer ${token}` });
const today = () => new Date().toISOString().slice(0, 10);

async function activity(from: string, to: string, tz = "UTC") {
  const res = await request(app).get("/api/activity").query({ from, to, tz }).set(auth());
  expect(res.status).toBe(200);
  return res.body as { days: { date: string; counts: Record<string, number> }[]; total: number; years: number[] };
}

beforeAll(async () => {
  const res = await request(app)
    .post("/api/register")
    .send({ displayName: "Activity", email: `activity-${stamp}@example.com`, password: "password123" });
  token = res.body.token;
  userId = res.body.user.id;
});

describe("activity", () => {
  it("records uploads, downloads, slicer opens and deletes", async () => {
    const upload = await request(app).post("/api/upload").set(auth()).attach("files", Buffer.from(STL), "part.stl");
    const printId = upload.body.prints[0].id as string;

    // No body is what older clients send: always a download.
    expect((await request(app).post(`/api/print/${printId}/download`).set(auth())).status).toBe(200);
    await request(app).post(`/api/print/${printId}/download`).set(auth()).send({ kind: "slicer" });
    await request(app).post(`/api/print/${printId}/download`).set(auth()).send({ kind: "slicer" });
    expect((await request(app).post(`/api/print/${printId}/download`).set(auth()).send({ kind: "print" })).status).toBe(
      400,
    );
    expect((await request(app).delete(`/api/print/${printId}`).set(auth())).status).toBe(200);

    // Recording is fire-and-forget, so give the last writes a moment.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const result = await activity(today(), today());
    expect(result.days).toEqual([{ date: today(), counts: { upload: 1, download: 1, slicer: 2, delete: 1 } }]);
    expect(result.total).toBe(5);
  });

  it("takes days in the viewer's time zone", async () => {
    // 23:30 UTC is already the next day in Vilnius (UTC+2 in March).
    await prisma.activity.create({ data: { userId, kind: "import", createdAt: new Date("2026-03-10T23:30:00Z") } });
    expect((await activity("2026-03-01", "2026-03-31", "UTC")).days.map((d) => d.date)).toEqual(["2026-03-10"]);
    expect((await activity("2026-03-01", "2026-03-31", "Europe/Vilnius")).days.map((d) => d.date)).toEqual([
      "2026-03-11",
    ]);
  });

  it("falls back to UTC for an unknown time zone", async () => {
    expect((await activity("2026-03-01", "2026-03-31", "Mars/Olympus")).days.map((d) => d.date)).toEqual([
      "2026-03-10",
    ]);
  });

  it("lists the years from registration to now, newest first", async () => {
    expect((await activity(today(), today())).years).toEqual([new Date().getUTCFullYear()]);
  });

  it("lists a month by kind, then by model, keeping a deleted model's name", async () => {
    const thisMonth = today().slice(0, 7);
    const res = await request(app).get("/api/activity/feed").query({ month: thisMonth, tz: "UTC" }).set(auth());
    expect(res.status).toBe(200);
    const groups = res.body.groups as {
      kind: string;
      total: number;
      items: { name: string; exists: boolean; count: number; thumb_url: string | null; print_id: string }[];
    }[];
    // In timeline order: imports, uploads, downloads, slicer opens, deletes.
    expect(groups.map((g) => [g.kind, g.total])).toEqual([
      ["upload", 1],
      ["download", 1],
      ["slicer", 2],
      ["delete", 1],
    ]);
    // The model was deleted, so every entry shows it by name, unlinked.
    const slicer = groups.find((g) => g.kind === "slicer")!;
    expect(slicer.items).toEqual([expect.objectContaining({ name: "part", exists: false, count: 2, thumb_url: null })]);
  });

  it("shows a model that still exists by its name now", async () => {
    const upload = await request(app).post("/api/upload").set(auth()).attach("files", Buffer.from(STL), "kept.stl");
    const printId = upload.body.prints[0].id as string;
    await prisma.print.update({ where: { id: printId }, data: { name: "Renamed" } });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const res = await request(app)
      .get("/api/activity/feed")
      .query({ month: today().slice(0, 7), tz: "UTC" })
      .set(auth());
    const uploadGroup = res.body.groups.find((g: { kind: string }) => g.kind === "upload");
    expect(uploadGroup.items[0]).toEqual(expect.objectContaining({ print_id: printId, name: "Renamed", exists: true }));
  });

  it("points to the last earlier month with activity, skipping empty ones", async () => {
    // The only earlier activity is the March one from the time zone test.
    const april = await request(app).get("/api/activity/feed").query({ month: "2026-05", tz: "UTC" }).set(auth());
    expect(april.body).toEqual({ month: "2026-05", groups: [], next_month: "2026-03" });
    const march = await request(app).get("/api/activity/feed").query({ month: "2026-03", tz: "UTC" }).set(auth());
    expect(march.body.groups).toEqual([
      expect.objectContaining({ kind: "import", total: 1, items: [expect.objectContaining({ name: null })] }),
    ]);
    expect(march.body.next_month).toBeNull();
    expect((await request(app).get("/api/activity/feed").query({ month: "2026-3" }).set(auth())).status).toBe(400);
  });

  it("starts a month from a chosen day, leaving out the days after it", async () => {
    await prisma.activity.create({ data: { userId, kind: "upload", createdAt: new Date("2026-03-20T12:00:00Z") } });
    const all = await request(app).get("/api/activity/feed").query({ month: "2026-03", tz: "UTC" }).set(auth());
    expect(all.body.groups.map((g: { kind: string }) => g.kind)).toEqual(["import", "upload"]);
    const until = await request(app)
      .get("/api/activity/feed")
      .query({ month: "2026-03", until: "2026-03-15", tz: "UTC" })
      .set(auth());
    expect(until.body.groups.map((g: { kind: string }) => g.kind)).toEqual(["import"]);
  });

  it("rejects a malformed range and needs a signed-in user", async () => {
    expect((await request(app).get("/api/activity").query({ from: "2026-1-1", to: today() }).set(auth())).status).toBe(
      400,
    );
    expect((await request(app).get("/api/activity").query({ from: today(), to: today() })).status).toBe(401);
  });

  it("keeps each user's activity to themselves", async () => {
    const other = await request(app)
      .post("/api/register")
      .send({ displayName: "Other", email: `activity-other-${stamp}@example.com`, password: "password123" });
    const res = await request(app)
      .get("/api/activity")
      .query({ from: "2026-01-01", to: "2026-12-31" })
      .set({ Authorization: `Bearer ${other.body.token}` });
    expect(res.body.total).toBe(0);
  });
});
