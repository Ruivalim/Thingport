import crypto from "node:crypto";
import { prisma } from "../db";

// Session JWTs start "eyJ", so the prefix alone says which kind of token a request carries. It also
// makes a leaked token recognisable to secret scanners.
export const API_TOKEN_PREFIX = "tp_";
// A dashboard polls every few seconds; recording each use would be a write per request.
const LAST_USED_RESOLUTION_MS = 60 * 1000;

export type ApiTokenOut = {
  configured: boolean;
  hint: string | null;
  created_at: Date | null;
  last_used_at: Date | null;
};

const hashApiToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const isApiToken = (token: string) => token.startsWith(API_TOKEN_PREFIX);

export async function getApiToken(userId: string): Promise<ApiTokenOut> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { apiTokenHash: true, apiTokenHint: true, apiTokenCreatedAt: true, apiTokenLastUsedAt: true },
  });
  return {
    configured: Boolean(user.apiTokenHash),
    hint: user.apiTokenHint,
    created_at: user.apiTokenCreatedAt,
    last_used_at: user.apiTokenLastUsedAt,
  };
}

/** Replaces any existing token, which stops working at once. The token is only ever returned here. */
export async function generateApiToken(userId: string): Promise<ApiTokenOut & { token: string }> {
  const token = API_TOKEN_PREFIX + crypto.randomBytes(32).toString("base64url");
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      apiTokenHash: hashApiToken(token),
      apiTokenHint: token.slice(-4),
      apiTokenCreatedAt: new Date(),
      apiTokenLastUsedAt: null,
    },
  });
  return {
    token,
    configured: true,
    hint: user.apiTokenHint,
    created_at: user.apiTokenCreatedAt,
    last_used_at: null,
  };
}

export async function revokeApiToken(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { apiTokenHash: null, apiTokenHint: null, apiTokenCreatedAt: null, apiTokenLastUsedAt: null },
  });
}

/** The token's owner, or null if no user has this token. */
export async function findApiTokenUser(token: string) {
  const apiTokenHash = hashApiToken(token);
  const user = await prisma.user.findUnique({
    where: { apiTokenHash },
    select: { id: true, role: true, apiTokenLastUsedAt: true },
  });
  if (!user) return null;
  const now = Date.now();
  if (!user.apiTokenLastUsedAt || now - user.apiTokenLastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    // Fire-and-forget: failing to record a use must never fail the request.
    prisma.user
      // Matched on the hash too, so a use racing a regenerate doesn't mark the new token used.
      .updateMany({ where: { id: user.id, apiTokenHash }, data: { apiTokenLastUsedAt: new Date(now) } })
      .catch((err) => console.error("[apiToken] Failed to record use:", err));
  }
  return user;
}
