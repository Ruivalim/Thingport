// Every fetch() to the user's Thingport instance goes through here. Content scripts and the popup
// never fetch directly -- they send API_CALL (or a higher-level message) to the background and get
// plain JSON back -- so auth (login + silent re-login on expiry/401) and the instance URL live in
// exactly one place. The host permission for the saved instance origin (requested at setup, see
// popup/index.ts) is what lets this reach a self-hosted instance regardless of its CORS config.

import type { LoginResult } from "../shared/api";
import { apiUrl } from "../shared/storage";
import { isMakerworldUrl } from "../shared/urls";
import { getStoredConfig, isConfigured, type ConfiguredConfig } from "./config";
import { getLiveMakerworldCookie, maybeSyncMakerworldCookie } from "./makerworldCookie";

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

type Credentials = Pick<ConfiguredConfig, "instanceUrl" | "email" | "password">;

async function errorDetail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string } | null;
    if (body && body.detail) return body.detail;
  } catch {
    // ignore -- keep the generic message
  }
  return fallback;
}

/** (Re-)authenticates against the given instance/credentials and persists the resulting token.
 *  Called by ensureToken on first use / near expiry, and again once on a 401 (a password change
 *  or server-side session revocation shouldn't require reopening the popup to recover from). */
export async function loginAndStoreToken(credentials: Credentials): Promise<string> {
  const res = await fetch(apiUrl(credentials.instanceUrl, "/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: credentials.email, password: credentials.password }),
  });
  if (!res.ok) throw new Error(await errorDetail(res, "Could not sign in to this Thingport instance"));
  const data = (await res.json()) as LoginResult;
  const tokenExpiresAt = Date.now() + data.expires_in * 1000;
  await chrome.storage.local.set({ token: data.token, tokenExpiresAt });
  return data.token;
}

export async function ensureToken(config: ConfiguredConfig, { forceRefresh = false } = {}): Promise<string> {
  if (!forceRefresh && config.token && config.tokenExpiresAt && config.tokenExpiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) {
    return config.token;
  }
  return loginAndStoreToken(config);
}

export async function requireConfig(): Promise<ConfiguredConfig> {
  const config = await getStoredConfig();
  if (!isConfigured(config)) throw new Error("Thingport Grab isn't configured yet -- open the extension popup first.");
  if (config.disabled) throw new Error("Thingport Grab is disabled -- re-enable it from the extension popup.");
  return config;
}

/** Generic authenticated call to the stored instance -- every content-script/popup action goes
 *  through this rather than a bespoke message per endpoint. `path` is the API path after `/api`
 *  (e.g. "/collections"). Any `/import*` call whose body targets a MakerWorld URL gets the live
 *  browser cookie attached automatically (see makerworldCookie.ts) unless the caller already set
 *  one -- this is what lets a user who has never touched Profile > MakerWorld still import from
 *  MakerWorld via the extension. */
export async function apiCall<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const config = await requireConfig();

  let finalBody = body as Record<string, unknown> | undefined;
  if (path.startsWith("/import") && finalBody && !finalBody.makerworld_cookie && isMakerworldUrl(finalBody.url as string)) {
    const liveCookie = await getLiveMakerworldCookie();
    if (liveCookie) {
      finalBody = { ...finalBody, makerworld_cookie: liveCookie };
      void maybeSyncMakerworldCookie(config, liveCookie);
    }
  }

  const doFetch = (token: string) =>
    fetch(apiUrl(config.instanceUrl, path), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(finalBody ? { "Content-Type": "application/json" } : {}),
      },
      body: finalBody ? JSON.stringify(finalBody) : undefined,
    });

  let res = await doFetch(await ensureToken(config));
  if (res.status === 401) res = await doFetch(await ensureToken(config, { forceRefresh: true }));
  if (!res.ok) throw new Error(await errorDetail(res, `Request failed (${res.status})`));
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

/** Authenticated GET of a binary resource on the instance (e.g. a thumbnail). */
export async function apiFetchBlob(config: ConfiguredConfig, path: string): Promise<Blob | null> {
  const res = await fetch(apiUrl(config.instanceUrl, path), {
    headers: { Authorization: `Bearer ${await ensureToken(config)}` },
  });
  return res.ok ? res.blob() : null;
}
