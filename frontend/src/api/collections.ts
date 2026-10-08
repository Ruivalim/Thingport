import { authHeaders } from "../utils/auth";
import { apiBase, assertOk, readErrorMessage } from "./client";
import type { Print } from "./prints";

export type SystemCollectionKey = "favorites" | "history";

/** How often a synced collection is checked, in hours. */
export const SYNC_INTERVAL_HOURS = [1, 6, 24] as const;
export type SyncIntervalHours = (typeof SYNC_INTERVAL_HOURS)[number];

/** Which print profiles a synced MakerWorld collection brings for each new model. */
export type SyncProfileScope = "url" | "designer" | "all";

/** Thingport Grab links a collection to one on a provider; new models there come in hourly. */
export type CollectionSync = {
  provider: string;
  source_url: string;
  profile_scope: SyncProfileScope;
  last_checked_at: string | null;
  last_error: string | null;
  /** Set when it follows a Thingiverse user's Likes rather than a collection: their username. */
  likes_of: string | null;
  /** How often the provider's collection is checked. */
  interval_hours: SyncIntervalHours;
  /** Roughly when it's next checked; null with scheduled sync off. */
  next_sync_at: string | null;
  /** When "Sync now" can be used again; null when it can be now. */
  sync_now_at: string | null;
};

export type Collection = {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  item_count: number;
  cover_items: Print[];
  created_at: string;
  /** Set only for the built-in pseudo-collections, which get a translated name and no edit/delete. */
  system_key: SystemCollectionKey | null;
  /** Always false for a system pseudo-collection. */
  bookmarked: boolean;
  sync: CollectionSync | null;
};

export type CollectionInput = {
  name: string;
  description?: string | null;
  tags?: string[];
};

export type CollectionMembership = {
  id: string;
  name: string;
  in_collection: boolean;
};

export const collectionsApi = {
  list: async (): Promise<Collection[]> => {
    const res = await fetch(`${apiBase()}/collections`, { headers: authHeaders() });
    assertOk(res, "Failed to list collections");
    return res.json();
  },

  get: async (id: string): Promise<Collection> => {
    const res = await fetch(`${apiBase()}/collection/${id}`, { headers: authHeaders() });
    assertOk(res, "Failed to load collection");
    return res.json();
  },

  create: async (input: CollectionInput): Promise<Collection> => {
    const res = await fetch(`${apiBase()}/collections`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Create collection failed"));
    return res.json();
  },

  update: async (id: string, input: CollectionInput): Promise<Collection> => {
    const res = await fetch(`${apiBase()}/collection/${id}`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Update collection failed"));
    return res.json();
  },

  delete: async (id: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/collection/${id}`, { method: "DELETE", headers: authHeaders() });
    assertOk(res, "Delete collection failed");
  },

  /** The print itself is untouched. */
  removeItem: async (collectionId: string, printId: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/collection/${collectionId}/items/${printId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    assertOk(res, "Remove from collection failed");
  },

  addItem: async (collectionId: string, printId: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/collection/${collectionId}/items/${printId}`, {
      method: "POST",
      headers: authHeaders(),
    });
    assertOk(res, "Add to collection failed");
  },

  listForPrint: async (printId: string): Promise<CollectionMembership[]> => {
    const res = await fetch(`${apiBase()}/print/${printId}/collections`, { headers: authHeaders() });
    assertOk(res, "Failed to list collections");
    return res.json();
  },

  bookmark: async (id: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/collection/${id}/bookmark`, { method: "POST", headers: authHeaders() });
    assertOk(res, "Failed to bookmark collection");
  },

  unbookmark: async (id: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/collection/${id}/bookmark`, { method: "DELETE", headers: authHeaders() });
    assertOk(res, "Failed to remove bookmark");
  },

  updateSync: async (
    id: string,
    settings: { profile_scope?: SyncProfileScope; interval_hours?: SyncIntervalHours },
  ): Promise<CollectionSync> => {
    const res = await fetch(`${apiBase()}/collection/${id}/sync`, {
      method: "PATCH",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to save sync settings"));
    return res.json();
  },

  /** Starts a sync of this collection alone; its result arrives as a notification. Answers with
   *  the sync as it starts, its Sync now cool-down included. */
  runSync: async (id: string): Promise<CollectionSync> => {
    const res = await fetch(`${apiBase()}/collection/${id}/sync/run`, { method: "POST", headers: authHeaders() });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to start syncing"));
    return res.json();
  },

  /** The collection and its models stay; new models just stop coming in. */
  stopSync: async (id: string): Promise<void> => {
    const res = await fetch(`${apiBase()}/collection/${id}/sync`, { method: "DELETE", headers: authHeaders() });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to stop syncing"));
  },
};
