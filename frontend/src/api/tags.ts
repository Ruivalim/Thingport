import { authHeaders } from "../utils/auth";
import { apiBase, assertOk } from "./client";

export type TagSortMode = "popular" | "name";

export type TagSummary = {
  name: string;
  count: number;
  bookmarked: boolean;
  /** One picture of its newest models, built and cached by the server; null while none has a picture. */
  mosaic_url: string | null;
};

export type TagSummaryPage = {
  items: TagSummary[];
  /** Tags matching `min_count`. */
  total: number;
  /** Every tag, whatever its count. */
  total_all: number;
  has_more: boolean;
};

export const tagsApi = {
  listSummary: async (params: {
    sort: TagSortMode;
    limit: number;
    offset: number;
    minCount: number;
  }): Promise<TagSummaryPage> => {
    const query = new URLSearchParams({
      sort: params.sort,
      limit: String(params.limit),
      offset: String(params.offset),
      min_count: String(params.minCount),
    });
    const res = await fetch(`${apiBase()}/tags/summary?${query}`, { headers: authHeaders() });
    assertOk(res, "Failed to list tags");
    return res.json();
  },

  /** Takes the tag off every model that has it. */
  remove: async (tag: string): Promise<{ models: number }> => {
    const res = await fetch(`${apiBase()}/tags/${encodeURIComponent(tag)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    assertOk(res, "Failed to delete tag");
    return res.json();
  },

  listBookmarked: async (): Promise<string[]> => {
    const res = await fetch(`${apiBase()}/tags/bookmarked`, { headers: authHeaders() });
    assertOk(res, "Failed to list bookmarked tags");
    return res.json();
  },

  bookmark: async (tag: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/tags/${encodeURIComponent(tag)}/bookmark`, {
      method: "POST",
      headers: authHeaders(),
    });
    assertOk(res, "Failed to bookmark tag");
  },

  unbookmark: async (tag: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/tags/${encodeURIComponent(tag)}/bookmark`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    assertOk(res, "Failed to remove bookmark");
  },
};
