import fs from "node:fs/promises";
import * as cheerio from "cheerio";
import { listZipEntries, readZipEntry, walkZipEntries } from "../utils/zipReader";

// Generates the cached GLB the interactive 3D preview loads instead of re-parsing a raw .3mf
// on every open (see frontend/src/utils/bambuThreeMf.ts, whose *rules* this file mirrors -- same
// extruder-resolution priority, same plate-assignment fallbacks, same component p:path handling
// -- but not its parsing mechanism. That file walks the DOM node-by-node; a Bambu-sliced 3MF for
// a genuinely large model can have millions of <vertex>/<triangle> elements, and DOM attribute
// access at that scale is what causes Thingport's "3D Preview" to hang indefinitely (root-caused
// against a real 224MB/2.66M-triangle repro). This file never builds a DOM for the bulk mesh data
// -- it scans the raw XML text with a handful of fixed-shape regexes straight into typed arrays,
// which is the actual fix. It only runs once per plate (in the background, off the request path)
// rather than on every viewer open.
//
// Everything here runs inside a worker thread (modelPreviewWorker.ts), never on the server's own
// event loop -- modelPreviewCache.ts owns the cache files and puts memory/time limits on that
// thread. Keep this module free of config/db imports so the worker stays lightweight.

// ---- FileReader polyfill --------------------------------------------------------------------
//
// Node has no FileReader; three.js's GLTFExporter (examples/jsm/exporters/GLTFExporter.js) needs
// one for its binary (GLB) export path even though nothing here uses images/textures. Confirmed
// working against a real export+reload round-trip (including custom userData surviving through
// glTF `extras`) before this file was written. Node's built-in Blob already provides
// `.arrayBuffer()`, so the polyfill only needs to bridge that to the old onload/onloadend
// callback shape the exporter expects.
class NodeFileReader {
  onload?: (e: { target: NodeFileReader }) => void;
  onloadend?: (e: { target: NodeFileReader }) => void;
  onerror?: (e: { target: NodeFileReader }) => void;
  result: ArrayBuffer | string | null = null;
  error: unknown = null;

  readAsArrayBuffer(blob: Blob): void {
    blob
      .arrayBuffer()
      .then((buf) => {
        this.result = buf;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      })
      .catch((err) => {
        this.error = err;
        this.onerror?.({ target: this });
        this.onloadend?.({ target: this });
      });
  }

  readAsDataURL(blob: Blob): void {
    blob
      .arrayBuffer()
      .then((buf) => {
        this.result = `data:${blob.type || "application/octet-stream"};base64,${Buffer.from(buf).toString("base64")}`;
        this.onload?.({ target: this });
        this.onloadend?.({ target: this });
      })
      .catch((err) => {
        this.error = err;
        this.onerror?.({ target: this });
        this.onloadend?.({ target: this });
      });
  }
}
if (typeof (globalThis as { FileReader?: unknown }).FileReader === "undefined") {
  (globalThis as unknown as { FileReader: unknown }).FileReader = NodeFileReader;
}

// ---- Small XML helpers (operate on a tag's raw attribute string, not a DOM node) --------------

function getAttr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? m[1] : null;
}

/** Mirrors bambuThreeMf.ts's parsePlateIdFromAttributes: accepts plate_id/plater_id (any casing,
 * optionally namespace-prefixed) since different Bambu Studio versions have used both spellings. */
function findPlateIdAttr(attrs: string): number | null {
  const m = attrs.match(/(?:^|\s)(?:[\w-]+:)?(?:plate_id|plater_id|plateid|platerid)="([^"]*)"/i);
  if (!m) return null;
  const parsed = Number.parseInt(m[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/** 3MF's 3x4 affine transform, in the string's own order: [m00 m01 m02 m10 m11 m12 m20 m21 m22
 * tx ty tz]. Applied directly against plain vertex triples below (no THREE.Matrix4 needed) --
 * the mapping is derived from, and produces identical results to, bambuThreeMf.ts's
 * `matrix.set(...)` + `v.applyMatrix4(matrix)`. */
function parseTransform3MF(str: string | null): number[] | null {
  if (!str) return null;
  const v = str.trim().split(/\s+/).map(Number);
  return v.length >= 12 ? v : null;
}

function applyAffineToVertices(vertices: Float32Array, t: number[]): Float32Array {
  const out = new Float32Array(vertices.length);
  const [t0, t1, t2, t3, t4, t5, t6, t7, t8, t9, t10, t11] = t;
  for (let i = 0; i < vertices.length; i += 3) {
    const x = vertices[i];
    const y = vertices[i + 1];
    const z = vertices[i + 2];
    out[i] = t0 * x + t1 * y + t2 * z + t9;
    out[i + 1] = t3 * x + t4 * y + t5 * z + t10;
    out[i + 2] = t6 * x + t7 * y + t8 * z + t11;
  }
  return out;
}

// ---- Mesh extraction (the hot path) ------------------------------------------------------------

type FastMesh = { vertices: Float32Array; triangles: Uint32Array; extruder: number };

const MESH_RE = /<mesh\b[^>]*>([\s\S]*?)<\/mesh>/g;
const VERTEX_RE = /<vertex\s+x="([^"]*)"\s+y="([^"]*)"\s+z="([^"]*)"/g;
const TRIANGLE_RE = /<triangle\s+v1="(\d+)"\s+v2="(\d+)"\s+v3="(\d+)"/g;

/** Finds every <mesh> block in `xml` and extracts its vertices/triangles directly via regex --
 * no DOM, no per-node attribute lookups. This is the piece that actually fixes the hang: a
 * 2.66M-triangle file that would grind the DOM-based parser to a halt runs through here in a
 * couple of seconds. */
function extractMeshesFast(xml: string, extruder: number): FastMesh[] {
  const meshes: FastMesh[] = [];
  MESH_RE.lastIndex = 0;
  let meshMatch: RegExpExecArray | null;
  while ((meshMatch = MESH_RE.exec(xml))) {
    const inner = meshMatch[1];
    const vertices: number[] = [];
    VERTEX_RE.lastIndex = 0;
    let vm: RegExpExecArray | null;
    while ((vm = VERTEX_RE.exec(inner))) {
      vertices.push(parseFloat(vm[1]), parseFloat(vm[2]), parseFloat(vm[3]));
    }
    const triangles: number[] = [];
    TRIANGLE_RE.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = TRIANGLE_RE.exec(inner))) {
      triangles.push(parseInt(tm[1], 10), parseInt(tm[2], 10), parseInt(tm[3], 10));
    }
    if (vertices.length > 0 && triangles.length > 0) {
      meshes.push({ vertices: Float32Array.from(vertices), triangles: Uint32Array.from(triangles), extruder });
    }
  }
  return meshes;
}

// ---- Structural parsing (small documents -- cheerio/JSON are fine here) -----------------------

type ObjectData = { id: string; meshes: FastMesh[]; plateId: number | null };
type BuildItem = { objectId: string; transform: number[] | null; plateId: number | null };
export type PlateSummary = { index: number; name: string | null; objectCount: number };

type StructuralData = {
  extruderMapById: Map<string, number>;
  partExtruderMap: Map<string, number>;
  objectNameById: Map<string, string>;
  plateAssignmentsByObjectId: Map<string, number>;
  plateNames: Map<number, string>;
  plateOffsets: Map<number, { offsetX: number; offsetY: number }>;
};

/** Mirrors bambuThreeMf.ts's model_settings.config handling -- small document (a few hundred
 * nodes at most), so a real XML parser (cheerio, already a backend dependency) is fine here. */
function parseModelSettingsConfig(xml: string): StructuralData {
  const data: StructuralData = {
    extruderMapById: new Map(),
    partExtruderMap: new Map(),
    objectNameById: new Map(),
    plateAssignmentsByObjectId: new Map(),
    plateNames: new Map(),
    plateOffsets: new Map(),
  };
  let $: cheerio.CheerioAPI;
  try {
    $ = cheerio.load(xml, { xml: true });
  } catch {
    return data;
  }

  $("object").each((_i, objEl) => {
    const $obj = $(objEl);
    const objectId = $obj.attr("id");
    if (!objectId) return;

    const extruderMeta = $obj.children('metadata[key="extruder"]').first();
    const extruderVal = extruderMeta.attr("value");
    if (extruderVal) data.extruderMapById.set(objectId, Math.max(0, parseInt(extruderVal, 10) - 1));

    const nameVal = $obj.children('metadata[key="name"]').first().attr("value");
    if (nameVal) data.objectNameById.set(objectId, nameVal);

    $obj.find("part").each((_j, partEl) => {
      const $part = $(partEl);
      const partId = $part.attr("id");
      if (!partId) return;
      const partExtruderVal = $part.children('metadata[key="extruder"]').first().attr("value");
      if (partExtruderVal) data.partExtruderMap.set(`${objectId}:${partId}`, Math.max(0, parseInt(partExtruderVal, 10) - 1));
    });
  });

  $("plate").each((_i, plateEl) => {
    const $plate = $(plateEl);
    let plateId: number | null = null;
    let offsetX = 0;
    let offsetY = 0;
    let plateName: string | undefined;
    $plate.find("> metadata").each((_j, metaEl) => {
      const $meta = $(metaEl);
      const key = $meta.attr("key");
      const value = $meta.attr("value");
      if ((key === "plater_id" || key === "plate_id") && value) {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) plateId = parsed;
      } else if (key === "pos_x" && value) {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) offsetX = parsed;
      } else if (key === "pos_y" && value) {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) offsetY = parsed;
      } else if (key === "plater_name" && value?.trim()) {
        plateName = value.trim();
      }
    });
    if (plateId == null) return;
    if (offsetX !== 0 || offsetY !== 0) data.plateOffsets.set(plateId, { offsetX, offsetY });
    if (plateName) data.plateNames.set(plateId, plateName);

    $plate.find("model_instance").each((_j, instEl) => {
      const objectIdVal = $(instEl).children('metadata[key="object_id"]').first().attr("value");
      if (objectIdVal) data.plateAssignmentsByObjectId.set(objectIdVal, plateId as number);
    });
  });

  return data;
}

/** project_settings.config is already JSON (unlike the other Metadata/*.config files) -- direct
 * port of bambuThreeMf.ts's parseProjectSettings, nothing DOM-related to replace here. */
function parseProjectSettingsJson(text: string): { filamentColors: string[]; buildVolume: { x: number; y: number } | null } {
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const filamentColors = Array.isArray(json.filament_colour)
      ? json.filament_colour.filter((c): c is string => typeof c === "string")
      : [];
    let buildVolume: { x: number; y: number } | null = null;
    const area = json.printable_area;
    if (Array.isArray(area) && area.length >= 3 && typeof area[2] === "string") {
      const match = area[2].match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
      if (match) buildVolume = { x: parseFloat(match[1]), y: parseFloat(match[2]) };
    }
    return { filamentColors, buildVolume };
  } catch {
    return { filamentColors: [], buildVolume: null };
  }
}

// ---- Main model parsing (the hot path, orchestrated) -------------------------------------------

const OBJECT_RE = /<object\b([^>]*)>([\s\S]*?)<\/object>/g;
const COMPONENT_RE = /<component\b([^>]*)\/?>/g;
const ITEM_RE = /<item\b([^>]*)\/?>/g;

type InternalComponentRef = { refId: string; transform: number[] | null; extruder: number };

const MAX_COMPONENT_DEPTH = 8;

/** Counts <triangle .../> tags without the per-match array a `match(/.../g)` would allocate
 * (millions of strings for a big model). "<triangles>" (the container) is skipped. */
function countTriangleTags(xml: string): number {
  let count = 0;
  let i = xml.indexOf("<triangle");
  while (i !== -1) {
    const next = xml.charCodeAt(i + 9);
    // whitespace, "/" or ">" -- anything else is "<triangles" or some other tag
    if (next === 32 || next === 9 || next === 10 || next === 13 || next === 47 || next === 62) count++;
    i = xml.indexOf("<triangle", i + 9);
  }
  return count;
}

// ---- Part files (3D/Objects/*.model) ----------------------------------------------------------

/** The part-file objects a component takes: the one its objectid names, or every object in the
 *  file when it names none (or one the file doesn't have). */
function partFileTargetIds(objects: Map<string, string>, objectId: string | null): string[] {
  return objectId && objects.has(objectId) ? [objectId] : [...objects.keys()];
}

/** Loads a component's geometry out of a part file. A part file can hold several <object>s:
 * Bambu Studio keeps every part of a multi-part object in one file and references each part
 * separately (same p:path, a different objectid). So a component takes only the object its
 * objectid names -- taking the whole file for each reference built every part once per sibling
 * (k parts -> k times the geometry, each part also drawn in its siblings' colours). A component
 * with no objectid, or one naming an object the file doesn't have, still takes the whole file.
 *
 * Its own regex instances throughout: callers are mid-way through a global OBJECT_RE/COMPONENT_RE
 * scan of the main model when they call in here. */
function createPartFileResolver(loadExternalModel: (path: string) => Promise<string | null>) {
  const objectsByPath = new Map<string, Map<string, string> | null>();
  const meshCache = new Map<string, FastMesh[]>();
  const countCache = new Map<string, number>();

  const objectsIn = async (path: string): Promise<Map<string, string> | null> => {
    if (objectsByPath.has(path)) return objectsByPath.get(path)!;
    const xml = await loadExternalModel(path);
    let objects: Map<string, string> | null = null;
    if (xml) {
      objects = new Map();
      const objectRe = new RegExp(OBJECT_RE.source, "g");
      let om: RegExpExecArray | null;
      while ((om = objectRe.exec(xml))) {
        const id = getAttr(om[1], "id");
        if (id) objects.set(id, om[2]);
      }
    }
    objectsByPath.set(path, objects);
    return objects;
  };

  /** Same-file component references inside a part-file object ({ refId, transform }). */
  const innerRefs = (inner: string, objects: Map<string, string>) => {
    const refs: { refId: string; transform: number[] | null }[] = [];
    const componentRe = new RegExp(COMPONENT_RE.source, "g");
    let cm: RegExpExecArray | null;
    while ((cm = componentRe.exec(inner))) {
      const refId = getAttr(cm[1], "objectid");
      const hasPath = (getAttr(cm[1], "p:path") ?? getAttr(cm[1], "path")) !== null;
      if (refId && !hasPath && objects.has(refId)) refs.push({ refId, transform: parseTransform3MF(getAttr(cm[1], "transform")) });
    }
    return refs;
  };

  /** Geometry of one object in a part file (untransformed, extruder unset), parsed once however
   *  many times it's placed. */
  const objectMeshes = async (path: string, objects: Map<string, string>, id: string, depth: number): Promise<FastMesh[]> => {
    const key = `${path}#${id}`;
    const cached = meshCache.get(key);
    if (cached) return cached;
    const inner = objects.get(id) ?? "";
    const meshes = extractMeshesFast(inner, 0);
    if (depth < MAX_COMPONENT_DEPTH) {
      for (const ref of innerRefs(inner, objects)) {
        for (const mesh of await objectMeshes(path, objects, ref.refId, depth + 1)) {
          meshes.push(ref.transform ? { ...mesh, vertices: applyAffineToVertices(mesh.vertices, ref.transform) } : mesh);
        }
      }
    }
    meshCache.set(key, meshes);
    return meshes;
  };

  const objectTriangles = (path: string, objects: Map<string, string>, id: string, depth: number): number => {
    const key = `${path}#${id}`;
    const cached = countCache.get(key);
    if (cached !== undefined) return cached;
    const inner = objects.get(id) ?? "";
    let count = countTriangleTags(inner);
    if (depth < MAX_COMPONENT_DEPTH) {
      for (const ref of innerRefs(inner, objects)) count += objectTriangles(path, objects, ref.refId, depth + 1);
    }
    countCache.set(key, count);
    return count;
  };

  return {
    /** The component's meshes, in its part file's own coordinates. */
    async meshes(path: string, objectId: string | null): Promise<FastMesh[]> {
      const objects = await objectsIn(path);
      if (!objects) return [];
      const out: FastMesh[] = [];
      for (const id of partFileTargetIds(objects, objectId)) out.push(...(await objectMeshes(path, objects, id, 0)));
      return out;
    },
    /** How many triangles the component brings in, without parsing any geometry. */
    async triangles(path: string, objectId: string | null): Promise<number> {
      const objects = await objectsIn(path);
      if (!objects) return 0;
      return partFileTargetIds(objects, objectId).reduce((sum, id) => sum + objectTriangles(path, objects, id, 0), 0);
    },
  };
}

type PartFileResolver = ReturnType<typeof createPartFileResolver>;

/** Triangles the preview would actually materialize: every build item's object, including
 * geometry pulled in through p:path components (where Bambu files keep all their meshes) and
 * same-document component references, counted once per placement -- the same expansion
 * parseMainModel + buildGlbGroup perform, but on tag counts instead of real arrays. Checked
 * before any mesh is parsed so an over-budget file never allocates its geometry. */
async function countRenderedTriangles(xml: string, partFiles: PartFileResolver): Promise<number> {
  const ownCount = new Map<string, number>();
  const internalRefs = new Map<string, string[]>();

  OBJECT_RE.lastIndex = 0;
  let om: RegExpExecArray | null;
  while ((om = OBJECT_RE.exec(xml))) {
    const objectId = getAttr(om[1], "id");
    if (!objectId) continue;
    const inner = om[2];
    let count = countTriangleTags(inner);
    const refs: string[] = [];
    COMPONENT_RE.lastIndex = 0;
    let cm: RegExpExecArray | null;
    while ((cm = COMPONENT_RE.exec(inner))) {
      const cAttrs = cm[1];
      const extPath = getAttr(cAttrs, "p:path") ?? getAttr(cAttrs, "path");
      const compObjectId = getAttr(cAttrs, "objectid");
      if (extPath) {
        count += await partFiles.triangles(extPath, compObjectId);
      } else if (compObjectId) {
        refs.push(compObjectId);
      }
    }
    ownCount.set(objectId, count);
    if (refs.length > 0) internalRefs.set(objectId, refs);
  }

  // Memoized by (object, depth) so a pathological fan-out can't make the count itself explode.
  const memo = new Map<string, number>();
  const totalFor = (objectId: string, depth: number): number => {
    const key = `${objectId}:${depth}`;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let total = ownCount.get(objectId) ?? 0;
    if (depth < MAX_COMPONENT_DEPTH) {
      for (const ref of internalRefs.get(objectId) ?? []) total += totalFor(ref, depth + 1);
    }
    memo.set(key, total);
    return total;
  };

  let rendered = 0;
  const buildMatch = xml.match(/<build\b[\s\S]*?<\/build>/);
  if (buildMatch) {
    ITEM_RE.lastIndex = 0;
    let im: RegExpExecArray | null;
    while ((im = ITEM_RE.exec(buildMatch[0]))) {
      const objectId = getAttr(im[1], "objectid");
      if (objectId) rendered += totalFor(objectId, 0);
    }
  }
  return rendered;
}

async function parseMainModel(
  xml: string,
  structural: StructuralData,
  plateAssignmentsByName: Map<string, number>,
  partFiles: PartFileResolver,
): Promise<{ objects: Map<string, ObjectData>; buildItems: BuildItem[] }> {
  const objects = new Map<string, ObjectData>();
  // <component objectid="X" .../> with no p:path references another <object> in this SAME
  // document rather than an external file -- common wrapper pattern (an outer "part" object
  // whose only content is a transformed reference to an inner object that holds the actual
  // mesh). Order in the file isn't guaranteed, so these are resolved in a second pass once
  // every object's own direct meshes are known, not inline during the main loop.
  const internalRefsByObjectId = new Map<string, InternalComponentRef[]>();

  OBJECT_RE.lastIndex = 0;
  let om: RegExpExecArray | null;
  while ((om = OBJECT_RE.exec(xml))) {
    const attrs = om[1];
    const inner = om[2];
    const objectId = getAttr(attrs, "id");
    if (!objectId) continue;

    const objectPlateId = findPlateIdAttr(attrs) ?? structural.plateAssignmentsByObjectId.get(objectId) ?? null;
    let defaultExtruder = structural.extruderMapById.get(objectId) ?? -1;
    if (defaultExtruder < 0) {
      const extruderAttr = getAttr(attrs, "p:extruder") ?? getAttr(attrs, "extruder") ?? "1";
      defaultExtruder = Math.max(0, parseInt(extruderAttr, 10) - 1);
    }

    const meshes = extractMeshesFast(inner, defaultExtruder);

    COMPONENT_RE.lastIndex = 0;
    let cm: RegExpExecArray | null;
    while ((cm = COMPONENT_RE.exec(inner))) {
      const cAttrs = cm[1];
      const extPath = getAttr(cAttrs, "p:path") ?? getAttr(cAttrs, "path");
      const compObjectId = getAttr(cAttrs, "objectid");
      const transform = parseTransform3MF(getAttr(cAttrs, "transform"));
      const partKey = compObjectId ? `${objectId}:${compObjectId}` : null;
      const compExtruder = partKey ? structural.partExtruderMap.get(partKey) ?? defaultExtruder : defaultExtruder;

      if (extPath) {
        for (const mesh of await partFiles.meshes(extPath, compObjectId)) {
          meshes.push({
            vertices: transform ? applyAffineToVertices(mesh.vertices, transform) : mesh.vertices,
            triangles: mesh.triangles,
            extruder: compExtruder,
          });
        }
      } else if (compObjectId) {
        if (!internalRefsByObjectId.has(objectId)) internalRefsByObjectId.set(objectId, []);
        internalRefsByObjectId.get(objectId)!.push({ refId: compObjectId, transform, extruder: compExtruder });
      }
    }

    // Always keep the entry once an object has *something* (direct meshes or a pending internal
    // reference) -- a pure wrapper object has zero direct meshes at this point but still needs
    // an entry for the resolution pass below to attach the referenced geometry to.
    if (meshes.length > 0 || internalRefsByObjectId.has(objectId)) {
      objects.set(objectId, { id: objectId, meshes, plateId: objectPlateId });
    }
  }

  // Resolve internal component references now that every object's own direct meshes are known.
  // A bounded depth guard (rather than a visited-set) is enough protection against a malformed/
  // cyclic file without needing per-object cycle bookkeeping -- real Bambu wrapper chains are
  // one level deep.
  const resolveInternalRefs = (objectId: string, depth: number): FastMesh[] => {
    const refs = internalRefsByObjectId.get(objectId);
    if (!refs || depth >= MAX_COMPONENT_DEPTH) return [];
    const resolved: FastMesh[] = [];
    for (const ref of refs) {
      const target = objects.get(ref.refId);
      if (!target) continue;
      const targetMeshes = [...target.meshes, ...resolveInternalRefs(ref.refId, depth + 1)];
      for (const mesh of targetMeshes) {
        resolved.push({
          vertices: ref.transform ? applyAffineToVertices(mesh.vertices, ref.transform) : mesh.vertices,
          triangles: mesh.triangles,
          extruder: ref.extruder,
        });
      }
    }
    return resolved;
  };
  // Resolve everything first, append after: appending as we go would put an inner object's
  // already-resolved meshes into target.meshes, and an outer object referencing it would then
  // pick them up twice (once from target.meshes, once from recursing) -- doubling per level.
  const resolvedByObjectId = new Map<string, FastMesh[]>();
  for (const objectId of internalRefsByObjectId.keys()) {
    resolvedByObjectId.set(objectId, resolveInternalRefs(objectId, 0));
  }
  for (const [objectId, resolved] of resolvedByObjectId) {
    const object = objects.get(objectId);
    if (object) for (const mesh of resolved) object.meshes.push(mesh);
  }

  const buildItems: BuildItem[] = [];
  const buildMatch = xml.match(/<build\b[\s\S]*?<\/build>/);
  if (buildMatch) {
    ITEM_RE.lastIndex = 0;
    let im: RegExpExecArray | null;
    while ((im = ITEM_RE.exec(buildMatch[0]))) {
      const attrs = im[1];
      const objectId = getAttr(attrs, "objectid");
      if (!objectId) continue;
      const transform = parseTransform3MF(getAttr(attrs, "transform"));
      const itemPlateId = findPlateIdAttr(attrs);
      const objectPlateId = objects.get(objectId)?.plateId ?? null;
      const objectName = structural.objectNameById.get(objectId);
      const namePlateId = objectName ? plateAssignmentsByName.get(objectName) ?? null : null;
      buildItems.push({ objectId, transform, plateId: itemPlateId ?? objectPlateId ?? namePlateId ?? null });
    }
  }

  return { objects, buildItems };
}

// ---- Top-level orchestration --------------------------------------------------------------------

type ParsedModel = {
  objects: Map<string, ObjectData>;
  buildItems: BuildItem[];
  plateNames: Map<number, string>;
  plateOffsets: Map<number, { offsetX: number; offsetY: number }>;
  plateThumbnails: Map<number, string>;
  filamentColors: string[];
  buildVolume: { x: number; y: number };
};

const MAIN_MODEL_PATH = "3D/3dmodel.model";
// Rendered triangles, i.e. after expanding external/internal components and every build-item
// placement (see countRenderedTriangles) -- not just tags in the main model, which for a Bambu
// file (meshes live in 3D/Objects/*.model) is close to zero no matter how heavy the model is.
const MAX_TRIANGLES = 8_000_000;
// Model XML is read whole into strings; V8 can't hold a single string past ~512MB anyway, and the
// sum bounds how much the parse holds at once. Checked from the zip's central directory before
// anything is decompressed.
const MAX_MODEL_ENTRY_BYTES = 500 * 1024 * 1024;
const MAX_MODEL_TOTAL_BYTES = 1024 * 1024 * 1024;

/** Why a file gets no server preview: "too-complex" is over a size budget (the browser mustn't
 * try it either), "unsupported" is a layout this parser doesn't handle (no main model at the
 * usual path, no objects) -- the browser's own, more general 3MF loaders may still manage. */
export type PreviewRefusal = "too-complex" | "unsupported";

/** Reads and fast-parses a Bambu Studio project .3mf. */
async function parseThreeMfFast(srcPath: string): Promise<ParsedModel | PreviewRefusal> {
  const modelEntries = (await listZipEntries(srcPath)).filter(
    (entry) => !entry.isDirectory && entry.name.toLowerCase().endsWith(".model"),
  );
  if (!modelEntries.some((entry) => entry.name === MAIN_MODEL_PATH)) return "unsupported";
  if (modelEntries.some((entry) => entry.size > MAX_MODEL_ENTRY_BYTES)) return "too-complex";
  if (modelEntries.reduce((sum, entry) => sum + entry.size, 0) > MAX_MODEL_TOTAL_BYTES) return "too-complex";

  let modelSettingsText: string | null = null;
  let projectSettingsText: string | null = null;
  let mainModelText: string | null = null;
  const plateJsonEntries: { plateIndex: number; text: string }[] = [];
  const plateThumbBytes = new Map<number, Buffer>();

  await walkZipEntries(
    srcPath,
    (entry) => {
      if (entry.name === "Metadata/model_settings.config") return true;
      if (entry.name === "Metadata/project_settings.config") return true;
      if (entry.name === MAIN_MODEL_PATH) return true;
      if (/^Metadata\/plate_\d+\.json$/.test(entry.name)) return true;
      if (/^Metadata\/(plate|top)_\d+\.png$/.test(entry.name)) return true;
      return false;
    },
    async (entry, stream) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);
      const buf = Buffer.concat(chunks);

      if (entry.name === "Metadata/model_settings.config") modelSettingsText = buf.toString("utf-8");
      else if (entry.name === "Metadata/project_settings.config") projectSettingsText = buf.toString("utf-8");
      else if (entry.name === MAIN_MODEL_PATH) mainModelText = buf.toString("utf-8");
      else {
        const plateMatch = entry.name.match(/^Metadata\/plate_(\d+)\.json$/);
        if (plateMatch) plateJsonEntries.push({ plateIndex: Number.parseInt(plateMatch[1], 10), text: buf.toString("utf-8") });
        const thumbMatch = entry.name.match(/^Metadata\/(?:plate|top)_(\d+)\.png$/);
        if (thumbMatch) {
          const idx = Number.parseInt(thumbMatch[1], 10);
          // "plate_N" (rendered on the bed) takes priority over "top_N" (plain top-down render);
          // whichever is found first for a given index wins, matching a simple "don't overwrite".
          if (!plateThumbBytes.has(idx)) plateThumbBytes.set(idx, buf);
        }
      }
    },
  );

  if (!mainModelText) return "unsupported";
  const mainModelXml: string = mainModelText;

  const structural = modelSettingsText ? parseModelSettingsConfig(modelSettingsText) : parseModelSettingsConfig("");
  const { filamentColors, buildVolume } = projectSettingsText
    ? parseProjectSettingsJson(projectSettingsText)
    : { filamentColors: [], buildVolume: null };

  // plate_*.json fallback for source-only (unsliced-by-MakerWorld) files: bbox_objects names,
  // keyed by object *name* rather than id -- mirrors bambuThreeMf.ts's same fallback.
  const plateAssignmentsByName = new Map<string, number>();
  for (const { plateIndex, text } of plateJsonEntries) {
    try {
      const json = JSON.parse(text) as { bbox_objects?: { name?: string }[] };
      for (const entry of json.bbox_objects ?? []) {
        if (entry?.name) plateAssignmentsByName.set(entry.name, plateIndex);
      }
    } catch {
      // Ignore malformed plate_N.json.
    }
  }

  const externalModelCache = new Map<string, string | null>();
  const loadExternalModel = async (rawPath: string): Promise<string | null> => {
    const normalized = rawPath.startsWith("/") ? rawPath.slice(1) : rawPath;
    if (externalModelCache.has(normalized)) return externalModelCache.get(normalized) ?? null;
    const buf = await readZipEntry(srcPath, normalized, MAX_MODEL_ENTRY_BYTES);
    const text = buf ? buf.toString("utf-8") : null;
    externalModelCache.set(normalized, text);
    return text;
  };

  // Complexity check before any geometry is allocated, so an over-budget file fails after a few
  // string scans instead of after exhausting the host's memory.
  const partFiles = createPartFileResolver(loadExternalModel);
  if ((await countRenderedTriangles(mainModelXml, partFiles)) > MAX_TRIANGLES) return "too-complex";

  const { objects, buildItems } = await parseMainModel(mainModelXml, structural, plateAssignmentsByName, partFiles);
  if (objects.size === 0) return "unsupported";

  const plateThumbnails = new Map<number, string>();
  for (const [idx, bytes] of plateThumbBytes) {
    plateThumbnails.set(idx, `data:image/png;base64,${bytes.toString("base64")}`);
  }

  return {
    objects,
    buildItems,
    plateNames: structural.plateNames,
    plateOffsets: structural.plateOffsets,
    plateThumbnails,
    filamentColors,
    buildVolume: buildVolume ?? { x: 256, y: 256 },
  };
}

// ---- GLB construction ----------------------------------------------------------------------

/** Builds the same per-(plate, extruder) merged-mesh grouping bambuThreeMf.ts's
 * buildBambuModelGroup computes on every render, just once, here. The resulting THREE.Group is
 * exported straight to GLB -- the viewer loads the merged meshes directly with no client-side
 * geometry work beyond toggling which plate's sub-group is visible. */
async function buildGlbGroup(parsed: ParsedModel): Promise<import("three").Group> {
  const THREE = await import("three");
  const { mergeGeometries } = await import("three/examples/jsm/utils/BufferGeometryUtils.js");

  const objectCountByPlate = new Map<number, number>();
  for (const item of parsed.buildItems) {
    if (item.plateId == null) continue;
    objectCountByPlate.set(item.plateId, (objectCountByPlate.get(item.plateId) ?? 0) + 1);
  }
  const plateIndexes = Array.from(objectCountByPlate.keys()).toSorted((a, b) => a - b);
  const hasPlateAssignments = plateIndexes.length > 0;
  // No real plate assignments at all (e.g. a single-object 3MF with no Bambu plate metadata) --
  // put everything under one synthetic "plate 0" bucket instead of dropping it.
  const effectivePlateIndexes = hasPlateAssignments ? plateIndexes : [0];

  const root = new THREE.Group();
  root.name = "thingport-preview-root";

  const plates: PlateSummary[] = [];
  for (const plateIndex of effectivePlateIndexes) {
    const itemsForPlate = hasPlateAssignments
      ? parsed.buildItems.filter((item) => item.plateId === plateIndex)
      : parsed.buildItems;

    const geometriesByExtruder = new Map<number, InstanceType<typeof THREE.BufferGeometry>[]>();
    for (const item of itemsForPlate) {
      const objectData = parsed.objects.get(item.objectId);
      if (!objectData) continue;
      for (const mesh of objectData.meshes) {
        const positioned = item.transform ? applyAffineToVertices(mesh.vertices, item.transform) : mesh.vertices;
        // 3MF Z-up -> three.js Y-up as a rotation, (x, y, z) -> (x, z, -y) -- kept identical to
        // bambuThreeMf.ts's createGeometryFromMesh (see there for why it can't be a plain swap).
        // Changing this changes every cached GLB: bump PREVIEW_FORMAT_VERSION.
        const swapped = new Float32Array(positioned.length);
        for (let i = 0; i < positioned.length; i += 3) {
          swapped[i] = positioned[i];
          swapped[i + 1] = positioned[i + 2];
          swapped[i + 2] = -positioned[i + 1];
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(swapped, 3));
        geometry.setIndex(new THREE.BufferAttribute(mesh.triangles, 1));
        geometry.computeVertexNormals();
        if (!geometriesByExtruder.has(mesh.extruder)) geometriesByExtruder.set(mesh.extruder, []);
        geometriesByExtruder.get(mesh.extruder)!.push(geometry);
      }
    }

    const plateGroup = new THREE.Group();
    plateGroup.name = `plate-${plateIndex}`;
    // Deliberately left visible=true (the default) for every plate here: GLTFExporter's default
    // onlyVisible option drops invisible nodes from the export entirely, which would silently
    // delete every plate but the first. Which plate is *shown* is a client-side concern (see
    // ModelViewer/index.tsx), applied after loading -- not baked into the cached file.
    let objectCount = 0;
    const fallbackColor = new THREE.Color(0xdddddd);
    for (const [extruder, geometries] of geometriesByExtruder) {
      if (geometries.length === 0) continue;
      // Cast: mergeGeometries' bundled .d.ts expects a narrower BufferGeometry generic than the
      // one `await import("three")` infers here -- a type-only mismatch (both are the real
      // three.js BufferGeometry class at runtime), not a real incompatibility.
      const merged =
        geometries.length === 1
          ? geometries[0]
          : (mergeGeometries(geometries as never, false) as InstanceType<typeof THREE.BufferGeometry> | null);
      if (merged) {
        const colorStr = parsed.filamentColors[extruder];
        const color = colorStr ? new THREE.Color(colorStr) : fallbackColor;
        const material = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.0 });
        const mesh = new THREE.Mesh(merged as never, material);
        mesh.name = `extruder-${extruder}`;
        plateGroup.add(mesh);
        objectCount++;
      }
      if (geometries.length > 1) geometries.forEach((g) => g.dispose());
    }
    root.add(plateGroup);
    plates.push({ index: plateIndex, name: parsed.plateNames.get(plateIndex) ?? null, objectCount });
  }

  root.userData = {
    thingportPreview: JSON.stringify({
      plates,
      plateThumbnails: Object.fromEntries(parsed.plateThumbnails),
      filamentColors: parsed.filamentColors,
      buildVolume: parsed.buildVolume,
    }),
  };

  return root;
}

// ---- Simplification (Administration > Rendering, off by default) --------------------------------

// The triangle budget itself comes in through RenderOptions (modelPreviewCache.ts's
// SIMPLIFY_TARGET_TRIANGLES), shared between a model's merged meshes in proportion to their size.
// Meshes this small are left alone -- nothing to gain, and a small part would lose its shape.
const SIMPLIFY_MIN_MESH_TRIANGLES = 2_000;
// The simplifier stops short of its target rather than change the shape by more than this
// fraction of the mesh's size (1%).
const SIMPLIFY_MAX_ERROR = 0.01;
const UNUSED_VERTEX = 0xffffffff;

export type SimplifiedSummary = { from: number; to: number };

function meshTriangleCount(mesh: import("three").Mesh): number {
  return (mesh.geometry.index?.count ?? 0) / 3;
}

/** Simplifies every merged mesh under `root` (in place) when their total exceeds `budget`
 *  triangles, with meshoptimizer's edge-collapse simplifier; returns the before/after triangle
 *  counts, or null when the model was already within budget. Normals are recomputed from the
 *  simplified surface. */
async function simplifyGroupMeshes(
  root: import("three").Group,
  budget: number,
): Promise<SimplifiedSummary | null> {
  const THREE = await import("three");
  const meshes: InstanceType<typeof THREE.Mesh>[] = [];
  root.traverse((obj) => {
    if ((obj as InstanceType<typeof THREE.Mesh>).isMesh) meshes.push(obj as InstanceType<typeof THREE.Mesh>);
  });
  const total = meshes.reduce((sum, mesh) => sum + meshTriangleCount(mesh), 0);
  if (total <= budget) return null;

  // ESM-only; this CommonJS build turns the import() into require(), which loads ES modules from
  // Node 20.19 on (hence package.json's engines).
  const { MeshoptSimplifier } = await import("meshoptimizer");
  await MeshoptSimplifier.ready;

  let after = 0;
  for (const mesh of meshes) {
    const count = meshTriangleCount(mesh);
    const index = mesh.geometry.index;
    if (!index || count <= SIMPLIFY_MIN_MESH_TRIANGLES) {
      after += count;
      continue;
    }
    const target = Math.max(SIMPLIFY_MIN_MESH_TRIANGLES, Math.floor((count * budget) / total));
    const positions = mesh.geometry.getAttribute("position").array as Float32Array;
    const indices = index.array instanceof Uint32Array ? index.array : Uint32Array.from(index.array);
    const [simplified] = MeshoptSimplifier.simplify(indices, positions, 3, target * 3, SIMPLIFY_MAX_ERROR, ["LockBorder"]);
    // Drop the vertices no triangle uses any more, so the GLB really gets smaller: compactMesh
    // renumbers `simplified` in place and says where each old vertex went.
    const [remap, uniqueVertices] = MeshoptSimplifier.compactMesh(simplified);
    const compacted = new Float32Array(uniqueVertices * 3);
    for (let oldIndex = 0; oldIndex < remap.length; oldIndex++) {
      const newIndex = remap[oldIndex];
      if (newIndex === UNUSED_VERTEX) continue;
      compacted[newIndex * 3] = positions[oldIndex * 3];
      compacted[newIndex * 3 + 1] = positions[oldIndex * 3 + 1];
      compacted[newIndex * 3 + 2] = positions[oldIndex * 3 + 2];
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(compacted, 3));
    geometry.setIndex(new THREE.BufferAttribute(simplified, 1));
    geometry.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry = geometry;
    after += simplified.length / 3;
  }
  return { from: total, to: after };
}

// ---- Entry point (called from the worker) ----------------------------------------------------

export type RenderOptions = {
  /** Simplify a model over this many triangles down to about that many (see
   *  simplifyGroupMeshes); null keeps its exact geometry. */
  simplifyTo: number | null;
};

/** Parses `srcPath` and writes the preview GLB to `destPath`, or says why it didn't (see
 * PreviewRefusal) -- decided before any geometry is built. */
export async function renderModelPreviewGlb(
  srcPath: string,
  destPath: string,
  options: RenderOptions = { simplifyTo: null },
): Promise<"ok" | PreviewRefusal> {
  const parsed = await parseThreeMfFast(srcPath);
  if (typeof parsed === "string") return parsed;
  const group = await buildGlbGroup(parsed);
  if (options.simplifyTo) {
    const simplified = await simplifyGroupMeshes(group, options.simplifyTo);
    // Recorded in the preview itself, so a later change of the setting can tell which cached
    // previews it affects without re-rendering them (modelPreviewCache.ts's
    // dropPreviewsAffectedBySimplification).
    if (simplified) {
      const meta = JSON.parse(group.userData.thingportPreview as string) as Record<string, unknown>;
      group.userData.thingportPreview = JSON.stringify({ ...meta, simplified });
    }
  }
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const result = await new GLTFExporter().parseAsync(group, { binary: true });
  await fs.writeFile(destPath, Buffer.from(result as ArrayBuffer));
  return "ok";
}
