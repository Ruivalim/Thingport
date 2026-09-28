import { authHeaders } from "../utils/auth";
import { apiBase, assertOk, readErrorMessage } from "./client";
import type { Print } from "./prints";

export type SystemCollectionKey = "favorites" | "history";

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
};
