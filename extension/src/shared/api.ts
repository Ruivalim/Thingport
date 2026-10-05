// Only the fields this extension reads; see the backend's dto.ts for the full shapes.

export type ImportOutcome = "created" | "profile_added" | "already_imported";

export type Print = {
  id: string;
  title?: string | null;
  name?: string | null;
  thumb_url?: string | null;
  preview_images?: { url: string }[];
  import_outcome?: ImportOutcome;
};

export type Collection = { id: string; name: string; system_key?: string | null };

export type ImportStatus = {
  already_imported: boolean;
  print_id?: string | null;
  state?: "imported" | "profile_missing" | "profile_unknown" | string;
};

export type InspectResult = { title?: string | null; is_zip?: boolean; filename?: string | null };

export type ZipEntriesResult = { entries: string[] };

export type BatchEntry = { design_id: string; title?: string | null; already_imported?: boolean };
export type BatchEntriesResult = { title?: string | null; entries: BatchEntry[]; truncated?: boolean };

export type ImportJob = {
  status: "RUNNING" | "DONE" | "ERROR" | string;
  processed: number;
  imported: number;
  total: number;
  result_print_id?: string | null;
  error_message?: string | null;
};

/** POST /import/queue: the link waits, paused, in the user's queue on the instance. */
export type QueueImportResult = { job_id: string; item_id: string; duplicate: boolean; waiting: number };

export type LoginResult = { token: string; expires_in: number; user?: { role?: "ADMIN" | "MEMBER" } };
