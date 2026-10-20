import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../auth";
import { HttpError } from "../utils/fileUtils";
import { asyncHandler } from "../utils/asyncHandler";
import { parseBody } from "../utils/validate";
import {
  acceptAiDescription,
  aiDescriptionsEnabled,
  cancelAiDescriptionRun,
  currentAiDescriptionRun,
  getAiDescriptionSettings,
  listAiDescriptionsApplied,
  listAiDescriptionSuggestions,
  queueAiDescription,
  rejectAiDescription,
  revertAiDescription,
  startAiDescriptionRun,
  type AiDescriptionRun,
} from "../services/aiDescriptionService";

const router = Router();
router.use(requireAuth);

function runOut(run: AiDescriptionRun | null) {
  if (!run) return null;
  return {
    running: run.running,
    started_at: run.startedAt,
    finished_at: run.finishedAt,
    total: run.total,
    done: run.done,
    suggested: run.suggested,
    applied: run.applied,
    unchanged: run.unchanged,
    skipped: run.skipped,
    failed: run.failed,
    cancelled: run.cancelled,
    last_error: run.lastError,
  };
}

function page(req: Request): { limit: number; offset: number } {
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "50"), 10) || 50));
  const offset = Math.max(0, Number.parseInt(String(req.query.offset ?? "0"), 10) || 0);
  return { limit, offset };
}

router.get(
  "/ai-descriptions/status",
  asyncHandler(async (_req, res) => {
    res.json({ enabled: aiDescriptionsEnabled(await getAiDescriptionSettings()) });
  }),
);

router.get(
  "/ai-descriptions/suggestions",
  asyncHandler(async (req, res) => {
    const { limit, offset } = page(req);
    res.json(await listAiDescriptionSuggestions(req.userId!, limit, offset));
  }),
);

router.get(
  "/ai-descriptions/applied",
  asyncHandler(async (req, res) => {
    const { limit, offset } = page(req);
    res.json(await listAiDescriptionsApplied(req.userId!, limit, offset));
  }),
);

for (const [action, handle] of [
  ["accept", acceptAiDescription],
  ["reject", rejectAiDescription],
  ["revert", revertAiDescription],
] as const) {
  router.post(
    `/print/:id/ai-description/${action}`,
    asyncHandler(async (req, res) => {
      await handle(req.userId!, req.params.id);
      res.json({ ok: true });
    }),
  );
}

// Any user, for a model of their own: answers at once, and the outcome arrives as a notification.
router.post(
  "/print/:id/ai-description/improve",
  asyncHandler(async (req, res) => {
    await queueAiDescription(req.userId!, req.params.id);
    res.status(202).json({ queued: true });
  }),
);

const bulkSchema = z.object({ action: z.enum(["accept", "reject"]), print_ids: z.array(z.string()).max(500) });
router.post(
  "/ai-descriptions/suggestions/bulk",
  asyncHandler(async (req, res) => {
    const body = parseBody(bulkSchema, req.body);
    let done = 0;
    let failed = 0;
    for (const printId of new Set(body.print_ids)) {
      try {
        if (body.action === "accept") await acceptAiDescription(req.userId!, printId);
        else await rejectAiDescription(req.userId!, printId);
        done++;
      } catch {
        failed++;
      }
    }
    res.json({ done, failed });
  }),
);

router.get(
  "/ai-descriptions/run",
  asyncHandler(async (req, res) => {
    res.json({ run: runOut(currentAiDescriptionRun(req.userId!)) });
  }),
);

const runSchema = z.object({ print_ids: z.array(z.string()).min(1).max(500).optional() });
router.post(
  "/ai-descriptions/run",
  asyncHandler(async (req, res) => {
    if (!aiDescriptionsEnabled(await getAiDescriptionSettings())) {
      throw new HttpError(503, "Improved descriptions are off", "ai_disabled");
    }
    const { print_ids } = parseBody(runSchema, req.body ?? {});
    const run = startAiDescriptionRun(req.userId!, print_ids);
    if (!run) throw new HttpError(409, "Improving descriptions is already running", "running");
    res.status(202).json({ run: runOut(run) });
  }),
);

router.post(
  "/ai-descriptions/run/cancel",
  asyncHandler(async (req, res) => {
    res.json({ run: runOut(cancelAiDescriptionRun(req.userId!)) });
  }),
);

// The same small error shape as the AI categorization routes, so callers can branch on a stable code.
router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof HttpError && error.code) {
    res.status(error.status).json({ error: error.message, code: error.code });
    return;
  }
  next(error);
});

export default router;
