import { authHeaders } from "../utils/auth";
import { apiBase, assertOk } from "./client";

// Kept in sync by hand with the backend's ACTIVITY_KINDS.
export type ActivityKind = "import" | "upload" | "delete" | "download" | "slicer";

export type ActivityDay = { date: string; counts: Partial<Record<ActivityKind, number>> };

export type ActivitySummary = {
  /** Only days with activity. */
  days: ActivityDay[];
  total: number;
  /** From the year the user registered to this one, newest first. */
  years: number[];
};

export type ActivityItem = {
  print_id: string | null;
  /** The name now, or as it was when the model was deleted; null for an import job's unrecorded model. */
  name: string | null;
  thumb_url: string | null;
  /** False once the model is deleted. */
  exists: boolean;
  count: number;
  last_at: string;
};

export type ActivityMonth = {
  month: string;
  /** By kind, then by model, newest first. */
  groups: { kind: ActivityKind; total: number; items: ActivityItem[] }[];
  /** The last earlier month with any activity, or null when this is the first. */
  next_month: string | null;
};

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const activityApi = {
  /** `from`/`to` are YYYY-MM-DD, inclusive, counted in the browser's time zone. */
  get: async (from: string, to: string): Promise<ActivitySummary> => {
    const params = new URLSearchParams({ from, to, tz: timeZone() });
    const res = await fetch(`${apiBase()}/activity?${params}`, { headers: authHeaders() });
    assertOk(res, "Failed to load activity");
    return res.json();
  },

  /** One month (YYYY-MM) of the timeline; `until` (YYYY-MM-DD) leaves out the days after it. */
  getMonth: async (month: string, until?: string): Promise<ActivityMonth> => {
    const params = new URLSearchParams({ month, tz: timeZone(), ...(until ? { until } : {}) });
    const res = await fetch(`${apiBase()}/activity/feed?${params}`, { headers: authHeaders() });
    assertOk(res, "Failed to load activity");
    return res.json();
  },
};
