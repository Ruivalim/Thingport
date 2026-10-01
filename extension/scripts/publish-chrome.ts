// Publishes a built Chrome zip to the existing Chrome Web Store listing, through the Chrome Web
// Store API v2 (https://developer.chrome.com/docs/webstore/using-api): sign in as the publisher's
// service account, upload the package, wait for it to be processed, and submit it for review.
// Google's review then takes anywhere from hours to days -- this only gets the update into the queue.
//
//   CHROME_EXTENSION_ID=... CWS_PUBLISHER_ID=... CWS_SERVICE_ACCOUNT_KEY="$(cat key.json)" \
//     tsx scripts/publish-chrome.ts dist/zips/thingport-grab-chrome.zip
//
// Run by .github/workflows/extension-store-release.yml (see extension/CONTRIBUTING.md for setting
// up the credentials). CWS_API_BASE / CWS_TOKEN_URL override the endpoints, for testing against a mock.

import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const API_BASE = process.env.CWS_API_BASE || "https://chromewebstore.googleapis.com";
const TOKEN_URL = process.env.CWS_TOKEN_URL || "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

type UploadState = "SUCCEEDED" | "IN_PROGRESS" | "FAILED" | "NOT_FOUND" | "UPLOAD_STATE_UNSPECIFIED";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} isn't set`);
  return value;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const base64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/** Exchanges a JWT signed with the service account's private key for an access token
 *  (https://developers.google.com/identity/protocols/oauth2/service-account#httprest). */
async function accessToken(keyJson: string): Promise<string> {
  let key: { client_email?: string; private_key?: string };
  try {
    key = JSON.parse(keyJson);
  } catch {
    throw new Error(
      "CWS_SERVICE_ACCOUNT_KEY isn't valid JSON -- paste the whole key file the Cloud Console downloaded",
    );
  }
  if (!key.client_email || !key.private_key)
    throw new Error("CWS_SERVICE_ACCOUNT_KEY has no client_email/private_key -- is it a service account key file?");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: key.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(key.private_key);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${base64url(signature)}`,
    }),
  });
  if (!res.ok)
    throw new Error(
      `Signing in as ${key.client_email} failed: HTTP ${res.status} ${await res.text().catch(() => "")}\n  The key may have been deleted in the Cloud Console -- create a new one.`,
    );
  return ((await res.json()) as { access_token: string }).access_token;
}

async function call<T>(url: string, init: RequestInit, what: string): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 401 || res.status === 403
        ? "\n  Check that the service account is added under Account in the Chrome Web Store dashboard, the Chrome Web Store API is enabled in its Cloud project, and CWS_PUBLISHER_ID / CHROME_EXTENSION_ID are right."
        : "";
    throw new Error(`${what} failed: HTTP ${res.status} ${body}${hint}`);
  }
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  const zipPath = process.argv[2];
  if (!zipPath) throw new Error("Usage: tsx scripts/publish-chrome.ts <package.zip>");
  const itemId = requireEnv("CHROME_EXTENSION_ID");
  const item = `publishers/${requireEnv("CWS_PUBLISHER_ID")}/items/${itemId}`;
  const auth = { Authorization: `Bearer ${await accessToken(requireEnv("CWS_SERVICE_ACCOUNT_KEY"))}` };

  const zip = await readFile(zipPath);
  console.log(`Uploading ${zipPath} (${(zip.length / 1024).toFixed(1)} KB) to Chrome Web Store item ${itemId}…`);
  const upload = await call<{ uploadState?: UploadState; crxVersion?: string }>(
    `${API_BASE}/upload/v2/${item}:upload`,
    { method: "POST", headers: { ...auth, "Content-Type": "application/zip" }, body: zip },
    "Upload",
  );

  let state = upload.uploadState;
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (state === "IN_PROGRESS") {
    if (Date.now() > deadline) throw new Error(`Upload still in progress after ${POLL_TIMEOUT_MS / 60000} minutes`);
    await sleep(POLL_INTERVAL_MS);
    const status = await call<{ lastAsyncUploadState?: UploadState }>(
      `${API_BASE}/v2/${item}:fetchStatus`,
      { headers: auth },
      "Upload status check",
    );
    state = status.lastAsyncUploadState;
  }
  if (state !== "SUCCEEDED")
    throw new Error(`Upload failed (${state ?? "no upload state"}): ${JSON.stringify(upload)}`);
  console.log(`Upload processed${upload.crxVersion ? `: version ${upload.crxVersion}` : ""}`);

  const published = await call<{ state?: string; warningInfo?: unknown }>(
    `${API_BASE}/v2/${item}:publish`,
    { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({}) },
    "Submission",
  );
  if (published.warningInfo) console.log(`Warnings: ${JSON.stringify(published.warningInfo)}`);
  console.log(`Submitted for review: ${published.state ?? "ok"}`);
}

try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
