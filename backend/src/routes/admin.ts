import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin, requireAuth } from "../auth";
import { HttpError } from "../utils/fileUtils";
import { asyncHandler } from "../utils/asyncHandler";
import { z } from "zod";
import { parseBody } from "../utils/validate";
import { deleteAllPrintsForUser, getStorageUsage, listLogs, listUsersWithPrintCounts } from "../services/adminService";
import { createLog } from "../services/auditLog";
import { INVITATION_TTL_DAYS, inviteUser } from "../services/invitationService";
import { authorLinkingSummary, currentAuthorLinkingRun, startAuthorLinking } from "../services/authorLinkingService";

const router = Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get(
  "/admin/users",
  asyncHandler(async (_req, res) => {
    const users = await listUsersWithPrintCounts();
    res.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.displayName,
        role: u.role,
        print_count: u.printCount,
        collection_count: u.collectionCount,
        makerworld_connected: u.makerworldConnected,
        created_at: u.createdAt,
      })),
    );
  }),
);

router.get(
  "/admin/storage",
  asyncHandler(async (_req, res) => {
    const usage = await getStorageUsage();
    res.json({ model_bytes: usage.modelBytes, model_count: usage.modelCount });
  }),
);

function parseDateParam(raw: unknown): Date | undefined {
  if (typeof raw !== "string" || !raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, "Invalid date");
  return parsed;
}

router.get(
  "/admin/logs",
  asyncHandler(async (req, res) => {
    const userId = typeof req.query.user_id === "string" && req.query.user_id ? req.query.user_id : undefined;
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const logs = await listLogs({ userId, from, to });
    res.json(
      logs.map((l) => ({
        id: l.id,
        user_id: l.userId,
        user_display_name: l.userDisplayName,
        user_email: l.userEmail,
        action: l.action,
        target_id: l.targetId,
        details: l.details,
        created_at: l.createdAt,
      })),
    );
  }),
);

// Re-inviting an address sends a fresh link and retires the old one.
const inviteSchema = z.object({ email: z.string().trim().email("Enter a valid email address") });
router.post(
  "/admin/invitations",
  asyncHandler(async (req, res) => {
    const body = parseBody(inviteSchema, req.body);
    const admin = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!admin) throw new HttpError(401, "Invalid or expired token");
    const invitation = await inviteUser({
      email: body.email,
      invitedById: admin.id,
      inviterName: admin.displayName,
      origin: req.get("origin") ?? null,
    });
    void createLog({ userId: admin.id, action: "user_invited", details: { email: invitation.email } });
    res.json({ email: invitation.email, expires_at: invitation.expiresAt, expires_in_days: INVITATION_TTL_DAYS });
  }),
);

// Irreversible; the UI handles the confirmation.
router.post(
  "/admin/users/:id/delete-all-prints",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw new HttpError(404, "User not found");
    const deleted = await deleteAllPrintsForUser(user.id);
    res.json({ ok: true, deleted });
  }),
);

router.get(
  "/admin/triggers/link-authors",
  asyncHandler(async (_req, res) => {
    res.json({ ...(await authorLinkingSummary()), run: currentAuthorLinkingRun() });
  }),
);

router.post(
  "/admin/triggers/link-authors",
  asyncHandler(async (req, res) => {
    const run = startAuthorLinking(req.userId!);
    if (!run) throw new HttpError(409, "Linking is already running");
    res.json({ run });
  }),
);

export default router;
