import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();
const stamp = Date.now();
let token: string;

type CategoryOut = { id: string; name: string; parent_id: string | null; kind: string };

const auth = () => ({ Authorization: `Bearer ${token}` });

async function create(name: string, parentId: string | null = null, kind?: string): Promise<CategoryOut> {
  const res = await request(app).post("/api/categories").set(auth()).send({ name, parent_id: parentId, kind });
  expect(res.status).toBe(200);
  return res.body;
}

async function list(): Promise<CategoryOut[]> {
  return (await request(app).get("/api/categories").set(auth())).body;
}

beforeAll(async () => {
  token = (
    await request(app)
      .post("/api/register")
      .send({ displayName: "Kinds", email: `kinds-${stamp}@example.com`, password: "password123" })
  ).body.token;
});

describe("category kinds", () => {
  it("seeds the starter categories, subcategories included, as categories", async () => {
    const seeded = await list();
    expect(seeded.length).toBeGreaterThan(0);
    expect(seeded.every((c) => c.kind === "category")).toBe(true);
  });

  it("makes new top-level ones folders unless asked otherwise", async () => {
    expect((await create("My prints")).kind).toBe("folder");
    expect((await create("My category", null, "category")).kind).toBe("category");
  });

  it("gives subcategories their parent's kind, whatever is asked", async () => {
    const folder = await create("Folder root");
    expect((await create("Sub", folder.id, "category")).kind).toBe("folder");
    const category = await create("Category root", null, "category");
    expect((await create("Sub", category.id)).kind).toBe("category");
  });

  it("carries a moved subtree over to its new tree's kind", async () => {
    const folder = await create("Moving folder");
    const child = await create("Moving child", folder.id);
    const grandchild = await create("Moving grandchild", child.id);
    const category = await create("Target category", null, "category");

    expect(
      (
        await request(app)
          .post(`/api/category/${child.id}/move`)
          .set(auth())
          .send({ parent_id: category.id, position: 0 })
      ).body.kind,
    ).toBe("category");
    const after = await list();
    expect(after.find((c) => c.id === child.id)?.kind).toBe("category");
    expect(after.find((c) => c.id === grandchild.id)?.kind).toBe("category");
    expect(after.find((c) => c.id === folder.id)?.kind).toBe("folder");
  });

  it("reorders top-level categories and folders apart", async () => {
    const roots = (await list()).filter((c) => !c.parent_id);
    const folders = roots.filter((c) => c.kind === "folder").map((c) => c.id);
    const reorder = (ids: string[]) =>
      request(app).post("/api/categories/reorder").set(auth()).send({ category_ids: ids });
    expect((await reorder(folders.toReversed())).status).toBe(200);
    const mixed = [folders[0], roots.find((c) => c.kind === "category")!.id];
    expect((await reorder(mixed)).status).toBe(400);
  });

  it("rejects an unknown kind", async () => {
    const res = await request(app).post("/api/categories").set(auth()).send({ name: "Bad", kind: "shelf" });
    expect(res.status).toBe(400);
  });
});

describe("categories view preference", () => {
  it("defaults to categories and remembers a change", async () => {
    expect((await request(app).get("/api/settings/categories-view").set(auth())).body.view).toBe("categories");
    const set = await request(app).patch("/api/settings/categories-view").set(auth()).send({ view: "folders" });
    expect(set.body.view).toBe("folders");
    expect((await request(app).get("/api/settings/categories-view").set(auth())).body.view).toBe("folders");
    expect(
      (await request(app).patch("/api/settings/categories-view").set(auth()).send({ view: "shelves" })).status,
    ).toBe(400);
  });
});
