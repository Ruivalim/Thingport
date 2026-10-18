import { Impit } from "impit";

// Thingiverse's and MyMiniFactory's Cloudflare challenge clients by their TLS handshake, whatever the
// headers or cookies, and Node's fetch is on its list. impit sends Chrome's handshake and headers.
const following = new Impit({ browser: "chrome", timeout: null });
const manual = new Impit({ browser: "chrome", timeout: null, followRedirects: false });

const NULL_BODY_STATUSES = new Set([204, 205, 304]);

/** Hosts that challenge Node's own fetch, so every request to them goes through browserFetch. */
export function needsBrowserFetch(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return ["thingiverse.com", "myminifactory.com"].some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

/** fetch with Chrome's TLS fingerprint. `timeoutMs` covers waiting for the response, not reading
 * the body. The caller's User-Agent is dropped: one that doesn't match the handshake is itself a
 * bot signal. */
export async function browserFetch(
  url: string,
  {
    headers = {},
    timeoutMs,
    signal,
    redirect = "follow",
  }: { headers?: Record<string, string>; timeoutMs?: number; signal?: AbortSignal; redirect?: "follow" | "manual" },
): Promise<Response> {
  const sent = Object.fromEntries(Object.entries(headers).filter(([name]) => name.toLowerCase() !== "user-agent"));
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  const timeout = timeoutMs ? setTimeout(onAbort, timeoutMs) : undefined;
  try {
    const client = redirect === "follow" ? following : manual;
    const res = await client.fetch(url, { headers: sent, signal: controller.signal });
    // A standard Response, so callers and helpers typed for fetch's take it as is.
    const body = NULL_BODY_STATUSES.has(res.status) ? null : res.body;
    const out = new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
    Object.defineProperty(out, "url", { value: res.url || url });
    return out;
  } finally {
    // The caller's signal stays wired: like fetch's, it also cuts off reading the body.
    clearTimeout(timeout);
  }
}
