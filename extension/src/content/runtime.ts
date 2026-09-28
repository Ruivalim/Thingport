import { request } from "../shared/messages";

/** Proxied through the background, which owns the credentials and host permission. */
export function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  return request("API_CALL", { method, path, body }) as Promise<T>;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
