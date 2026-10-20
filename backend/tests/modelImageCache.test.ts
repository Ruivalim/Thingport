import { afterAll, beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeZip } from "../src/utils/zipWriter";
import {
  generateModelImage,
  generateModelPreviewGlb,
  modelImagePath,
  modelImageState,
  modelPreviewGlbPath,
} from "../src/services/modelPreviewCache";

// A box as ASCII STL.
const v = (x: number, y: number, z: number) => `vertex ${x * 10} ${y * 10} ${z * 10}`;
const facet = (a: number[], b: number[], c: number[]) =>
  `facet normal 0 0 0\nouter loop\n${v(a[0], a[1], a[2])}\n${v(b[0], b[1], b[2])}\n${v(c[0], c[1], c[2])}\nendloop\nendfacet`;
const quads: [number, number, number][][] = [
  [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
  ],
  [
    [0, 0, 1],
    [0, 1, 1],
    [1, 1, 1],
    [1, 0, 1],
  ],
  [
    [0, 0, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 0, 0],
  ],
  [
    [0, 1, 0],
    [1, 1, 0],
    [1, 1, 1],
    [0, 1, 1],
  ],
  [
    [0, 0, 0],
    [0, 1, 0],
    [0, 1, 1],
    [0, 0, 1],
  ],
  [
    [1, 0, 0],
    [1, 0, 1],
    [1, 1, 1],
    [1, 1, 0],
  ],
];
const BOX_STL = `solid box\n${quads.flatMap(([a, b, c, d]) => [facet(a, b, c), facet(a, c, d)]).join("\n")}\nendsolid box\n`;
const ONE_TRIANGLE_3MF_XML = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" unit="millimeter">
 <resources><object id="1" type="model"><mesh><vertices><vertex x="0" y="0" z="0" /><vertex x="10" y="0" z="0" /><vertex x="0" y="10" z="0" /></vertices><triangles><triangle v1="0" v2="1" v3="2" /></triangles></mesh></object></resources>
 <build><item objectid="1" /></build>
</model>
`;

let dir: string;
const plateIds: string[] = [];
const newPlateId = (label: string) => {
  const id = `test-image-${label}-${Date.now()}-${plateIds.length}`;
  plateIds.push(id);
  return id;
};
async function file(name: string, content: string): Promise<string> {
  const target = path.join(dir, name);
  await fs.writeFile(target, content);
  return target;
}
const cacheDir = () => path.dirname(modelImagePath("x"));

beforeAll(async () => {
  // Needs no database, only the cache directory db.ts normally creates.
  await fs.mkdir(cacheDir(), { recursive: true });
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "thingport-image-cache-"));
});

afterAll(async () => {
  const names = await fs.readdir(cacheDir());
  for (const name of names) {
    if (plateIds.some((id) => name.startsWith(id))) await fs.rm(path.join(cacheDir(), name), { force: true });
  }
  await fs.rm(dir, { recursive: true, force: true });
});

describe("model picture cache", () => {
  it("says generating while queued, then ready, and doesn't redraw an existing picture", async () => {
    const plateId = newPlateId("box");
    const src = await file("box.stl", BOX_STL);
    const run = generateModelImage(plateId, src, "box.stl");
    expect(modelImageState(plateId)).toBe("generating");
    await run;
    expect(modelImageState(plateId)).toBe("ready");
    const drawnAt = (await fs.stat(modelImagePath(plateId))).mtimeMs;
    await generateModelImage(plateId, src, "box.stl");
    expect((await fs.stat(modelImagePath(plateId))).mtimeMs).toBe(drawnAt);
  });

  it("asks for one picture only once while it's being drawn", async () => {
    const plateId = newPlateId("twice");
    const src = await file("twice.stl", BOX_STL);
    await Promise.all([generateModelImage(plateId, src, "twice.stl"), generateModelImage(plateId, src, "twice.stl")]);
    expect(modelImageState(plateId)).toBe("ready");
  });

  it("calls a 3MF layout it can't read unsupported, and doesn't try it again", async () => {
    const plateId = newPlateId("elsewhere");
    const modelPath = await file("model.model", ONE_TRIANGLE_3MF_XML);
    const src = path.join(dir, "elsewhere.3mf");
    // Valid 3MF (the path comes from _rels/.rels), but not where the parser looks.
    await writeZip(src, [{ arcname: "3D/model.model", filePath: modelPath }]);
    await generateModelImage(plateId, src, "elsewhere.3mf");
    expect(modelImageState(plateId)).toBe("unsupported");
    const marker = path.join(cacheDir(), `${plateId}.render.v2.error`);
    const markedAt = (await fs.stat(marker)).mtimeMs;
    await generateModelImage(plateId, src, "elsewhere.3mf");
    expect((await fs.stat(marker)).mtimeMs).toBe(markedAt);
  });

  it("calls a broken file failed rather than drawing nothing", async () => {
    const plateId = newPlateId("broken");
    await generateModelImage(plateId, await file("broken.stl", "solid empty\nendsolid empty\n"), "broken.stl");
    expect(modelImageState(plateId)).toBe("failed");
  });

  it("ignores formats it can't draw", async () => {
    const plateId = newPlateId("step");
    await generateModelImage(plateId, await file("part.step", "ISO-10303-21;"), "part.step");
    expect(fsSync.existsSync(modelImagePath(plateId))).toBe(false);
  });

  it("lets a 3D preview go ahead of pictures already waiting", async () => {
    const pictures = await Promise.all(
      [0, 1, 2].map(async (i) => ({ plateId: newPlateId(`queued${i}`), src: await file(`queued${i}.stl`, BOX_STL) })),
    );
    const modelPath = await file("3dmodel.model", ONE_TRIANGLE_3MF_XML);
    const fixture = path.join(dir, "one.3mf");
    await writeZip(fixture, [{ arcname: "3D/3dmodel.model", filePath: modelPath }]);
    const glbPlate = newPlateId("glb");

    // The first picture starts at once; the GLB, queued after the other two, still runs before them.
    const drawing = pictures.map(({ plateId, src }) => generateModelImage(plateId, src, "box.stl"));
    await generateModelPreviewGlb(glbPlate, fixture);
    expect(fsSync.existsSync(modelPreviewGlbPath(glbPlate))).toBe(true);
    expect(fsSync.existsSync(modelImagePath(pictures[2].plateId))).toBe(false);
    await Promise.all(drawing);
    expect(pictures.every(({ plateId }) => modelImageState(plateId) === "ready")).toBe(true);
  });
});
