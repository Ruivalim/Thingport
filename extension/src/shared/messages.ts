// Typed runtime-message protocol between the content script / popup and the background script,
// plus the one message the background sends *to* a content script. Every reply has the same
// `{ ok, data } | { ok: false, error }` envelope, so callers either inspect it (`send`) or let it
// throw (`request`).

import type { Print } from "./api";

export type ExtensionState = { configured: boolean; disabled: boolean; instanceUrl: string; email: string };

export type RecentImport = {
  printId: string;
  title: string | null;
  url: string;
  thumbDataUrl: string | null;
  instanceUrl: string;
  email: string;
};

/** A MakerWorld file URL resolved from the live page, with the print profile it belongs to (null
 *  when unknown). See content/makerworld/downloadResolver.ts. */
export type ResolvedDownload = { downloadUrl: string; instanceId: string | null };

export type ImportSinglePayload = {
  url: string;
  entries?: string[];
  collectionId?: string | null;
  resolved?: ResolvedDownload | null;
  title?: string | null;
};

export type MakerworldJob = {
  tabId: number;
  originalUrl: string;
  collectionId: string | null;
  urls: string[];
  index: number;
  imported: number;
  total: number;
  /** True exactly while a navigation this job triggered is in flight -- see
   *  background/makerworldJob.ts. */
  awaitingLoad: boolean;
};

export type MakerworldJobError = { message: string; imported: number; total: number };

export type ApiCallPayload = { method: string; path: string; body?: unknown };

/** Messages handled by the background script: payload in, `data` out. */
export type BackgroundMessages = {
  GET_STATE: { payload: void; result: ExtensionState };
  SAVE_CONFIG: { payload: { instanceUrl: string; email: string; password: string }; result: null };
  SET_DISABLED: { payload: { disabled: boolean }; result: null };
  GET_RECENT_IMPORTS: { payload: void; result: RecentImport[] };
  /** "popup" if the toolbar popup opened, "tab" if the setup form opened in a tab instead. */
  OPEN_SETUP: { payload: void; result: "popup" | "tab" };
  SET_TAB_ICON_STATE: { payload: { active: boolean }; result: null };
  API_CALL: { payload: ApiCallPayload; result: unknown };
  IMPORT_SINGLE: { payload: ImportSinglePayload; result: Print | null };
  START_MAKERWORLD_COLLECTION_JOB: {
    payload: { urls: string[]; collectionId: string | null; originalUrl: string };
    result: null;
  };
  ABORT_MAKERWORLD_COLLECTION_JOB: { payload: void; result: null };
  FORCE_ADVANCE_MAKERWORLD_JOB: { payload: void; result: null };
  ARM_DOWNLOAD_CAPTURE: { payload: void; result: null };
  AWAIT_DOWNLOAD_CAPTURE: { payload: void; result: string | null };
  /** The job driving this tab, if any; otherwise a just-stopped job's error (read once). */
  GET_MAKERWORLD_JOB: { payload: void; result: { job: MakerworldJob | null; error: MakerworldJobError | null } };
};

/** Messages the background sends to a tab's content script. */
export type ContentMessages = {
  RESOLVE_MAKERWORLD_DOWNLOAD_URL: { payload: void; result: ResolvedDownload | null };
};

type AnyMessages = Record<string, { payload: unknown; result: unknown }>;
export type Reply<T> = { ok: true; data: T } | { ok: false; error: string };
type Envelope<M extends AnyMessages, K extends keyof M> = { type: K; payload: M[K]["payload"] };
type PayloadArgs<P> = [P] extends [void] ? [] : [P];

export type BackgroundType = keyof BackgroundMessages;
export type BackgroundResult<K extends BackgroundType> = BackgroundMessages[K]["result"];

/** Sends to the background and returns the raw reply envelope. */
export function send<K extends BackgroundType>(
  type: K,
  ...payload: PayloadArgs<BackgroundMessages[K]["payload"]>
): Promise<Reply<BackgroundResult<K>>> {
  const message: Envelope<BackgroundMessages, K> = { type, payload: payload[0] as BackgroundMessages[K]["payload"] };
  return chrome.runtime.sendMessage(message);
}

/** Sends to the background and resolves with `data`, or throws the reply's error. */
export async function request<K extends BackgroundType>(
  type: K,
  ...payload: PayloadArgs<BackgroundMessages[K]["payload"]>
): Promise<BackgroundResult<K>> {
  const reply = await send(type, ...payload);
  if (!reply) throw new Error("No response from the extension background");
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

export async function sendToTab<K extends keyof ContentMessages>(
  tabId: number,
  type: K,
): Promise<Reply<ContentMessages[K]["result"]> | undefined> {
  return chrome.tabs.sendMessage(tabId, { type, payload: undefined });
}

type Handler<M extends AnyMessages, K extends keyof M> = (
  payload: M[K]["payload"],
  sender: chrome.runtime.MessageSender,
) => Promise<M[K]["result"]> | M[K]["result"];
export type Handlers<M extends AnyMessages> = { [K in keyof M]: Handler<M, K> };

/** Registers one runtime.onMessage listener that dispatches to `handlers` by message type and
 *  wraps the result (or thrown error) in the reply envelope. Message types not in `handlers` are
 *  left for other listeners. */
export function listen<M extends AnyMessages>(handlers: Partial<Handlers<M>>): void {
  chrome.runtime.onMessage.addListener((message: { type?: string; payload?: unknown }, sender, sendResponse) => {
    const handler = message && typeof message.type === "string" ? handlers[message.type as keyof M] : undefined;
    if (!handler) return undefined;
    Promise.resolve()
      .then(() => handler(message.payload as never, sender))
      .then(
        (data) => sendResponse({ ok: true, data }),
        (err: unknown) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      );
    return true; // keep the channel open for the async sendResponse above
  });
}
