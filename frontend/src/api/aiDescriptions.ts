import { authHeaders } from "../utils/auth";
import { apiBase, readErrorMessage, UnauthorizedError } from "./client";

export type AiDescriptionActions = {
  remove_self_promotion: boolean;
  remove_unrelated: boolean;
  translate: boolean;
  /** Only applies while the first preview image is sent. */
  generate_missing: boolean;
  fix_spelling: boolean;
  improve_formatting: boolean;
};

export type AiDescriptionSettings = {
  enabled: boolean;
  /** Auto applies a rewrite at once; the original is kept either way, so it can be reverted. */
  mode: "suggest" | "auto";
  on_import: boolean;
  send_image: boolean;
  /** Null uses the default AI. */
  ai_connection_id: string | null;
  actions: AiDescriptionActions;
};

export type AiDescriptionSettingsInput = Partial<Omit<AiDescriptionSettings, "actions">> & {
  actions?: Partial<AiDescriptionActions>;
};

export type AiDescriptionSuggestion = {
  id: string;
  name: string;
  title: string | null;
  original: string;
  suggested: string;
  model: string;
  created_at: string;
};

export type AiDescriptionApplied = {
  id: string;
  name: string;
  title: string | null;
  original: string;
  current: string;
  applied_at: string | null;
};

export type AiDescriptionRun = {
  running: boolean;
  started_at: string | null;
  finished_at: string | null;
  total: number;
  done: number;
  suggested: number;
  applied: number;
  unchanged: number;
  skipped: number;
  failed: number;
  cancelled: boolean;
  last_error: string | null;
};

async function request<T>(path: string, method = "GET", payload?: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: authHeaders(payload === undefined ? undefined : { "Content-Type": "application/json" }),
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  if (res.status === 401) throw new UnauthorizedError();
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body: unknown = await res.clone().json();
      if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
        message = (body as { error: string }).error;
      } else {
        message = await readErrorMessage(res, message);
      }
    } catch {
      // Not JSON: the status says enough.
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const page = (limit: number, offset: number) => `limit=${limit}&offset=${offset}`;

let statusRequest: Promise<{ enabled: boolean }> | null = null;

export function invalidateAiDescriptionStatus(): void {
  statusRequest = null;
}

/** Fetched once per session, as every model card's menu asks; changing the settings drops it. */
function cachedStatus(): Promise<{ enabled: boolean }> {
  statusRequest ??= request<{ enabled: boolean }>("/ai-descriptions/status").catch((error: unknown) => {
    statusRequest = null;
    throw error;
  });
  return statusRequest;
}

export const aiDescriptionsApi = {
  getSettings: (): Promise<AiDescriptionSettings> => request("/settings/ai-descriptions"),
  updateSettings: async (input: AiDescriptionSettingsInput): Promise<AiDescriptionSettings> => {
    const saved = await request<AiDescriptionSettings>("/settings/ai-descriptions", "PATCH", input);
    statusRequest = null;
    return saved;
  },
  /** Queues one model; the outcome arrives as a notification. */
  improve: (printId: string): Promise<{ queued: true }> =>
    request(`/print/${encodeURIComponent(printId)}/ai-description/improve`, "POST", {}),
  suggestions: (limit = 50, offset = 0): Promise<{ total: number; items: AiDescriptionSuggestion[] }> =>
    request(`/ai-descriptions/suggestions?${page(limit, offset)}`),
  applied: (limit = 50, offset = 0): Promise<{ total: number; items: AiDescriptionApplied[] }> =>
    request(`/ai-descriptions/applied?${page(limit, offset)}`),
  accept: (printId: string): Promise<{ ok: true }> =>
    request(`/print/${encodeURIComponent(printId)}/ai-description/accept`, "POST"),
  reject: (printId: string): Promise<{ ok: true }> =>
    request(`/print/${encodeURIComponent(printId)}/ai-description/reject`, "POST"),
  revert: (printId: string): Promise<{ ok: true }> =>
    request(`/print/${encodeURIComponent(printId)}/ai-description/revert`, "POST"),
  bulk: (action: "accept" | "reject", printIds: string[]): Promise<{ done: number; failed: number }> =>
    request("/ai-descriptions/suggestions/bulk", "POST", { action, print_ids: printIds }),
  runState: (): Promise<{ run: AiDescriptionRun | null }> => request("/ai-descriptions/run"),
  /** Every model, or only `printIds`. */
  startRun: (printIds?: string[]): Promise<{ run: AiDescriptionRun }> =>
    request("/ai-descriptions/run", "POST", printIds ? { print_ids: printIds } : {}),
  cancelRun: (): Promise<{ run: AiDescriptionRun | null }> => request("/ai-descriptions/run/cancel", "POST", {}),
  status: cachedStatus,
};
