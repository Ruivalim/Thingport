import http from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import {
  DEFAULT_AI_CATEGORIZATION_PREFS,
  DEFAULT_AI_DESCRIPTION_PREFS,
  setAiCategorizationPrefs,
  setAiDescriptionPrefs,
  type AiDescriptionPrefs,
} from "../src/services/settingsService";
import { createAiConnection } from "../src/services/aiConnectionService";
import { setAiRetryDelayForTest } from "../src/services/aiProviderClient";

const app = createApp();
const stamp = Date.now();
let adminToken: string;
let adminId: string;
let userNumber = 0;
const createdUsers: string[] = [];
let provider: http.Server | null = null;

type Reply = { changed: boolean; description: string } | { status: number; text?: string };
type Handler = (prompt: string) => Reply | Promise<Reply>;
const prompts: string[] = [];
// How the mock answers a streamed request: in pieces this far apart, or in one piece as if it ignored `stream`.
const streaming = { gapMs: 0, ignore: false };

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function startProvider(handler: Handler): Promise<string> {
  prompts.length = 0;
  await new Promise<void>((resolve) => {
    provider = http.createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
        messages: { content: { type: string; text?: string }[] }[];
        stream?: boolean;
      };
      const prompt = body.messages[0].content.find((part) => part.type === "text")?.text ?? "";
      prompts.push(prompt);
      const reply = await handler(prompt);
      if ("status" in reply) {
        res.writeHead(reply.status, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: reply.text ?? "failed" }));
        return;
      }
      const text = JSON.stringify(reply);
      if (!body.stream || streaming.ignore) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: text }, finish_reason: "stop" }] }));
        return;
      }
      // Server-sent events, as OpenAI-style providers stream: the answer in three pieces, then the finish.
      res.writeHead(200, { "content-type": "text/event-stream" });
      const third = Math.ceil(text.length / 3);
      for (let start = 0; start < text.length; start += third) {
        res.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(start, start + third) } }] })}\n\n`,
        );
        if (streaming.gapMs) await new Promise((wait) => setTimeout(wait, streaming.gapMs));
      }
      res.write(`data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`);
      res.end("data: [DONE]\n\n");
    });
    provider.listen(0, "127.0.0.1", resolve);
  });
  const address = provider!.address();
  if (!address || typeof address === "string") throw new Error("Provider did not bind a TCP port");
  return `http://127.0.0.1:${address.port}/v1`;
}

async function stopProvider() {
  if (!provider) return;
  provider.closeAllConnections?.();
  await new Promise<void>((resolve) => provider!.close(() => resolve()));
  provider = null;
}

/** One model, the default, and the feature on with it. */
async function enable(baseUrl: string, patch: Partial<AiDescriptionPrefs> = {}) {
  await prisma.aiConnection.deleteMany();
  await createAiConnection({
    baseUrl,
    apiKey: null,
    model: "local",
    timeoutMs: 2000,
    concurrency: 1,
    reasoningEffort: null,
  });
  await setAiDescriptionPrefs({ ...DEFAULT_AI_DESCRIPTION_PREFS, enabled: true, onImport: false, ...patch });
}

async function newUser() {
  const email = `ai-descriptions-${stamp}-${userNumber++}@example.com`;
  const registered = await request(app)
    .post("/api/register")
    .send({ displayName: `AI descriptions ${userNumber}`, email, password: "password123" });
  createdUsers.push(registered.body.user.id);
  return { id: registered.body.user.id as string, token: registered.body.token as string };
}

async function printFor(ownerId: string, notes: string | null, name = `Model ${stamp}-${userNumber}-${Math.random()}`) {
  return prisma.print.create({ data: { userId: ownerId, name, nameNormalized: name.toLowerCase(), notes } });
}

/** The description suggested for a model, if any. */
async function suggestedFor(id: string): Promise<string | undefined> {
  const suggestion = (await prisma.print.findUnique({ where: { id } }))?.aiDescriptionSuggestion as {
    notes?: string;
  } | null;
  return suggestion?.notes;
}

async function runAll(token: string) {
  const started = await request(app).post("/api/ai-descriptions/run").set(auth(token)).send({});
  expect(started.status).toBe(202);
  for (let i = 0; i < 200; i++) {
    const state = await request(app).get("/api/ai-descriptions/run").set(auth(token));
    if (!state.body.run?.running) return state.body.run;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("run did not finish");
}

beforeAll(async () => {
  const email = `ai-descriptions-${stamp}@example.com`;
  const registered = await request(app)
    .post("/api/register")
    .send({ displayName: "AI descriptions", email, password: "password123" });
  adminId = registered.body.user.id;
  await prisma.user.update({ where: { id: adminId }, data: { role: "ADMIN" } });
  adminToken = (await request(app).post("/api/login").send({ email, password: "password123" })).body.token;
  setAiRetryDelayForTest(async () => undefined);
});

afterEach(async () => {
  streaming.gapMs = 0;
  streaming.ignore = false;
  await stopProvider();
  await prisma.aiConnection.deleteMany();
  await setAiDescriptionPrefs(DEFAULT_AI_DESCRIPTION_PREFS);
  await setAiCategorizationPrefs(DEFAULT_AI_CATEGORIZATION_PREFS);
});

afterAll(async () => {
  setAiRetryDelayForTest();
  await prisma.print.deleteMany({ where: { userId: { in: [adminId, ...createdUsers] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminId, ...createdUsers] } } });
});

describe("Improved descriptions", () => {
  it("asks only for the changes that are ticked", async () => {
    const baseUrl = await startProvider(() => ({ changed: false, description: "" }));
    await enable(baseUrl, {
      actions: { ...DEFAULT_AI_DESCRIPTION_PREFS.actions, removeSelfPromotion: false, translate: false },
    });
    const owner = await newUser();
    await printFor(owner.id, "Hallo, bitte folgt mir auf Patreon.");
    await runAll(owner.token);
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toContain("requests for likes, boosts");
    expect(prompts[0]).toContain("spelling");
    expect(prompts[0]).not.toContain("self-promotion");
    expect(prompts[0]).not.toContain("translate");
    expect(prompts[0]).toContain("Hallo, bitte folgt mir auf Patreon.");
    // Whatever is ticked, print instructions, images and steps are named as things to keep.
    expect(prompts[0]).toContain("Print instructions: printer and slicer settings");
    expect(prompts[0]).toContain("an HTML <img> tag");
    expect(prompts[0]).toContain("Instructions and steps for assembling");
  });

  it("suggests a rewrite, applies it on accept, and reverts to the original", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "A tidy clip for 10 mm cables." }));
    await enable(baseUrl);
    const owner = await newUser();
    const model = await printFor(owner.id, "A tidy clip for 10mm cables. Follow me for more!!");

    const run = await runAll(owner.token);
    expect(run).toMatchObject({ total: 1, done: 1, suggested: 1, failed: 0 });
    const listed = await request(app).get("/api/ai-descriptions/suggestions").set(auth(owner.token));
    expect(listed.body).toMatchObject({
      total: 1,
      items: [
        {
          id: model.id,
          original: "A tidy clip for 10mm cables. Follow me for more!!",
          suggested: "A tidy clip for 10 mm cables.",
        },
      ],
    });

    await request(app).post(`/api/print/${model.id}/ai-description/accept`).set(auth(owner.token));
    expect((await prisma.print.findUnique({ where: { id: model.id } }))?.notes).toBe("A tidy clip for 10 mm cables.");
    const applied = await request(app).get("/api/ai-descriptions/applied").set(auth(owner.token));
    expect(applied.body.items).toMatchObject([
      {
        id: model.id,
        original: "A tidy clip for 10mm cables. Follow me for more!!",
        current: "A tidy clip for 10 mm cables.",
      },
    ]);

    await request(app).post(`/api/print/${model.id}/ai-description/revert`).set(auth(owner.token));
    expect((await prisma.print.findUnique({ where: { id: model.id } }))?.notes).toBe(
      "A tidy clip for 10mm cables. Follow me for more!!",
    );
    // A reverted description isn't rewritten again by the next run.
    await runAll(owner.token);
    expect(prompts).toHaveLength(1);
  });

  it("skips a rejected model on later runs until the options change", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "Better." }));
    await enable(baseUrl);
    const owner = await newUser();
    const model = await printFor(owner.id, "Worse.");
    await runAll(owner.token);
    await request(app).post(`/api/print/${model.id}/ai-description/reject`).set(auth(owner.token));

    const again = await runAll(owner.token);
    expect(again).toMatchObject({ skipped: 1, suggested: 0 });
    expect(prompts).toHaveLength(1);

    await setAiDescriptionPrefs({ actions: { improveFormatting: false } });
    const changed = await runAll(owner.token);
    expect(changed).toMatchObject({ suggested: 1 });
    expect(prompts).toHaveLength(2);
  });

  it("waits on a streamed answer as long as pieces keep coming, past the model's timeout", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "Slowly rewritten." }));
    await enable(baseUrl);
    await prisma.aiConnection.updateMany({ data: { timeoutMs: 100 } });
    streaming.gapMs = 150;
    const owner = await newUser();
    await printFor(owner.id, "Slow.");
    // Three pieces 150 ms apart take well over the 100 ms timeout, yet each one keeps the wait going.
    expect(await runAll(owner.token)).toMatchObject({ suggested: 1, failed: 0 });
  });

  it("reads an answer in one piece from a provider that ignores streaming", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "One piece." }));
    await enable(baseUrl);
    streaming.ignore = true;
    const owner = await newUser();
    await printFor(owner.id, "Two pieces.");
    expect(await runAll(owner.token)).toMatchObject({ suggested: 1 });
  });

  it("won't be switched off while a run is going", async () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const baseUrl = await startProvider(async () => {
      await held;
      return { changed: false, description: "" };
    });
    await enable(baseUrl);
    const owner = await newUser();
    await printFor(owner.id, "Busy.");
    expect((await request(app).post("/api/ai-descriptions/run").set(auth(owner.token)).send({})).status).toBe(202);

    const refused = await request(app)
      .patch("/api/settings/ai-descriptions")
      .set(auth(adminToken))
      .send({ enabled: false });
    expect(refused.status).toBe(409);
    expect(refused.body.error ?? refused.body.detail).toContain("Stop the run");
    release();
    for (let i = 0; i < 200; i++) {
      const state = await request(app).get("/api/ai-descriptions/run").set(auth(owner.token));
      if (!state.body.run?.running) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const allowed = await request(app)
      .patch("/api/settings/ai-descriptions")
      .set(auth(adminToken))
      .send({ enabled: false });
    expect(allowed.status).toBe(200);
  });

  it("drops the description markers a model copies back into its answer", async () => {
    const replies = [
      "<<<\nNo more typos here.\n>>>",
      "--- DESCRIPTION START ---\nClean text.\n--- DESCRIPTION END ---",
      "<<<\nSame text.",
    ];
    const baseUrl = await startProvider(() => ({ changed: true, description: replies.shift()! }));
    await enable(baseUrl);
    const owner = await newUser();
    const first = await printFor(owner.id, "No mroe typos here.");
    const second = await printFor(owner.id, "Clean txet.");
    const third = await printFor(owner.id, "Same text.");
    const run = await runAll(owner.token);
    expect(prompts[0]).toContain("--- DESCRIPTION START ---\nNo mroe typos here.\n--- DESCRIPTION END ---");
    expect(prompts[0]).not.toContain("<<<");
    expect(await suggestedFor(first.id)).toBe("No more typos here.");
    expect(await suggestedFor(second.id)).toBe("Clean text.");
    // Once the marker is gone it's the description it was, so nothing is suggested.
    expect(await suggestedFor(third.id)).toBeUndefined();
    expect(run).toMatchObject({ suggested: 2, unchanged: 1 });
  });

  it("lets any owner improve one model in the background, told by a notification", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "A neat cable clip." }));
    await enable(baseUrl);
    const owner = await newUser();
    const model = await printFor(owner.id, "A neat cabel clip.", "Cable clip");
    // Already checked with nothing new: a run would skip it, but asking about it does not.
    await prisma.print.update({ where: { id: model.id }, data: { aiDescriptionCheckedHash: "x" } });

    const queued = await request(app).post(`/api/print/${model.id}/ai-description/improve`).set(auth(owner.token));
    expect(queued.status).toBe(202);
    const notified = async () =>
      prisma.notification.findMany({ where: { userId: owner.id, type: "ai" }, orderBy: { createdAt: "asc" } });
    for (let i = 0; i < 200 && !(await notified()).length; i++) await new Promise((wait) => setTimeout(wait, 20));
    expect((await notified())[0]).toMatchObject({
      title: 'AI suggests a better description for "Cable clip"',
      internalPath: `/models/${model.id}`,
    });

    // Another one waits until this one is accepted or rejected, and every model says it's pending.
    const again = await request(app).post(`/api/print/${model.id}/ai-description/improve`).set(auth(owner.token));
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("suggestion_pending");
    expect((await request(app).get(`/api/print/${model.id}`).set(auth(owner.token))).body.ai_description_pending).toBe(
      true,
    );

    // The owner reviews it on the model page; they can't open the admin's Manage.
    const detail = await request(app).get(`/api/print/${model.id}`).set(auth(owner.token));
    expect(detail.body).toMatchObject({
      ai_description_suggestion: { notes: "A neat cable clip." },
      ai_description_original: null,
    });
    await request(app).post(`/api/print/${model.id}/ai-description/accept`).set(auth(owner.token));
    const accepted = await request(app).get(`/api/print/${model.id}`).set(auth(owner.token));
    expect(accepted.body).toMatchObject({
      notes: "A neat cable clip.",
      ai_description_suggestion: null,
      ai_description_original: "A neat cabel clip.",
      description_by_ai: true,
    });
    // Still said with the feature off, though the original to compare with isn't sent then.
    await setAiDescriptionPrefs({ enabled: false });
    expect((await request(app).get(`/api/print/${model.id}`).set(auth(owner.token))).body).toMatchObject({
      description_by_ai: true,
      ai_description_original: null,
    });
    await setAiDescriptionPrefs({ enabled: true });
    await request(app).post(`/api/print/${model.id}/meta`).set(auth(owner.token)).send({ notes: "Mine again." });
    expect((await request(app).get(`/api/print/${model.id}`).set(auth(owner.token))).body.description_by_ai).toBe(
      false,
    );
  });

  it("says why it couldn't improve one, and refuses while the feature is off", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "Never asked." }));
    await enable(baseUrl);
    const owner = await newUser();
    const model = await printFor(owner.id, null, "Blank model");
    await request(app).post(`/api/print/${model.id}/ai-description/improve`).set(auth(owner.token));
    let notification = null;
    for (let i = 0; i < 200 && !notification; i++) {
      notification = await prisma.notification.findFirst({ where: { userId: owner.id, type: "ai" } });
      if (!notification) await new Promise((wait) => setTimeout(wait, 20));
    }
    expect(notification).toMatchObject({
      title: 'Couldn\'t improve the description of "Blank model"',
      body: expect.stringContaining("needs the preview image"),
    });
    expect(prompts).toHaveLength(0);

    await setAiDescriptionPrefs({ enabled: false });
    const refused = await request(app).post(`/api/print/${model.id}/ai-description/improve`).set(auth(owner.token));
    expect(refused.status).toBe(503);
    expect((await request(app).get(`/api/print/${model.id}`).set(auth(owner.token))).body).toMatchObject({
      ai_description_suggestion: null,
      ai_description_original: null,
    });
  });

  it("applies straight away in auto mode and keeps the original", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "In English now." }));
    await enable(baseUrl, { mode: "auto" });
    const owner = await newUser();
    const model = await printFor(owner.id, "Jetzt auf Deutsch.");
    expect(await runAll(owner.token)).toMatchObject({ applied: 1 });
    const saved = await prisma.print.findUnique({ where: { id: model.id } });
    expect(saved).toMatchObject({ notes: "In English now.", aiDescriptionOriginal: "Jetzt auf Deutsch." });
  });

  it("doesn't offer a rewrite that drops an image", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "Just text." }));
    await enable(baseUrl);
    const owner = await newUser();
    const model = await printFor(owner.id, "Look: ![photo](/description-image/abc) Nice.");
    const run = await runAll(owner.token);
    expect(run).toMatchObject({ failed: 1, suggested: 0 });
    expect(run.last_error).toContain("dropped an image");
    expect((await prisma.print.findUnique({ where: { id: model.id } }))?.aiDescriptionSuggestion).toBeNull();
  });

  it("leaves models without a description alone unless it may write one from the image", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "Made up." }));
    await enable(baseUrl, { actions: { ...DEFAULT_AI_DESCRIPTION_PREFS.actions, generateMissing: true } });
    const owner = await newUser();
    await printFor(owner.id, null);
    // Generating needs the image, which isn't sent.
    expect(await runAll(owner.token)).toMatchObject({ skipped: 1 });
    expect(prompts).toHaveLength(0);
  });

  it("drops a pending suggestion and the kept original when the description is edited by hand", async () => {
    const baseUrl = await startProvider(() => ({ changed: true, description: "Rewritten." }));
    await enable(baseUrl);
    const owner = await newUser();
    const model = await printFor(owner.id, "Original.");
    await runAll(owner.token);
    const edited = await request(app)
      .post(`/api/print/${model.id}/meta`)
      .set(auth(owner.token))
      .send({ notes: "My own words." });
    expect(edited.status).toBe(200);
    const saved = await prisma.print.findUnique({ where: { id: model.id } });
    expect(saved).toMatchObject({ notes: "My own words.", aiDescriptionSuggestion: null, aiDescriptionOriginal: null });
  });

  it("reports off, refuses runs, and switches off when the last model is deleted", async () => {
    const baseUrl = await startProvider(() => ({ changed: false, description: "" }));
    await enable(baseUrl);
    const owner = await newUser();
    expect((await request(app).get("/api/ai-descriptions/status").set(auth(owner.token))).body.enabled).toBe(true);

    const settings = await request(app).get("/api/settings/ai-descriptions").set(auth(adminToken));
    expect(settings.body).toMatchObject({ enabled: true, mode: "suggest", actions: { generate_missing: false } });
    const connections = await request(app).get("/api/settings/ai-connections").set(auth(adminToken));
    await request(app).delete(`/api/settings/ai-connections/${connections.body[0].id}`).set(auth(adminToken));

    expect((await request(app).get("/api/settings/ai-descriptions").set(auth(adminToken))).body.enabled).toBe(false);
    expect((await request(app).get("/api/ai-descriptions/status").set(auth(owner.token))).body.enabled).toBe(false);
    const refused = await request(app).post("/api/ai-descriptions/run").set(auth(owner.token)).send({});
    expect(refused.status).toBe(503);
  });
});
