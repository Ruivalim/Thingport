import { authHeaders } from "../utils/auth";
import { apiBase, assertOk, readErrorMessage } from "./client";

export type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  role: "ADMIN" | "MEMBER";
  print_count: number;
  collection_count: number;
  makerworld_connected: boolean;
  created_at: string;
};

export type LogAction =
  | "user_logged_in"
  | "user_logged_out"
  | "user_invited"
  | "model_uploaded"
  | "model_imported"
  | "import_completed"
  | "model_edited"
  | "model_deleted"
  | "collection_created"
  | "collection_edited"
  | "collection_deleted"
  | "collection_item_added"
  | "collection_item_removed";

export type LogEntry = {
  id: string;
  user_id: string;
  user_display_name: string;
  user_email: string;
  action: LogAction;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
};

export type StorageUsage = {
  model_bytes: number; // every plate + supporting/prepared file, across all users
  model_count: number;
};

export const adminApi = {
  getStorageUsage: async (): Promise<StorageUsage> => {
    const res = await fetch(`${apiBase()}/admin/storage`, { headers: authHeaders() });
    assertOk(res, "Failed to load storage usage");
    return res.json();
  },

  /** Emails an invitation to register (only while registrations are closed and SMTP is set up). */
  inviteUser: async (email: string): Promise<{ email: string; expires_at: string; expires_in_days: number }> => {
    const res = await fetch(`${apiBase()}/admin/invitations`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to send the invitation"));
    return res.json();
  },

  listUsers: async (): Promise<AdminUser[]> => {
    const res = await fetch(`${apiBase()}/admin/users`, { headers: authHeaders() });
    assertOk(res, "Failed to load users");
    return res.json();
  },

  deleteAllPrintsForUser: async (userId: string): Promise<{ deleted: number }> => {
    const res = await fetch(`${apiBase()}/admin/users/${userId}/delete-all-prints`, {
      method: "POST",
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(await readErrorMessage(res, "Failed to delete models"));
    return res.json();
  },

  listLogs: async (filter: { userId?: string; from?: string; to?: string }): Promise<LogEntry[]> => {
    const params = new URLSearchParams();
    if (filter.userId) params.set("user_id", filter.userId);
    if (filter.from) params.set("from", filter.from);
    if (filter.to) params.set("to", filter.to);
    const qs = params.toString();
    const res = await fetch(`${apiBase()}/admin/logs${qs ? `?${qs}` : ""}`, { headers: authHeaders() });
    assertOk(res, "Failed to load logs");
    return res.json();
  },
};
