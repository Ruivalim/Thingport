// MakerWorld click-and-capture download resolution. The content script clicks the model page's own
// real "Download" button; this captures the browser download that click triggers, cancels it
// immediately, and reads the resolved URL off it before erasing it from the downloads list. That
// sidesteps every guess about MakerWorld's resolution API (query params, nonce, headers): whatever
// request the page's own JS makes for a real click is the one captured. Requires "downloads".
//
// Two messages rather than one (ARM, then AWAIT) because the click itself has to happen in the
// content script between arming and awaiting, and one message only gets one reply.

const DOWNLOAD_CAPTURE_TIMEOUT_MS = 8000;

// Only one capture is ever in flight -- single-model imports and the guided collection loop both
// resolve one model at a time.
let pending: { resolve: (url: string | null) => void; timeoutId: ReturnType<typeof setTimeout> } | null = null;
let currentCapture: Promise<string | null> | null = null;

chrome.downloads.onCreated.addListener((item) => {
  if (!pending) return;
  const { resolve, timeoutId } = pending;
  pending = null;
  clearTimeout(timeoutId);
  chrome.downloads.cancel(item.id).catch(() => undefined);
  chrome.downloads.erase({ id: item.id }).catch(() => undefined);
  // A blob: URL means the page fetched the file itself rather than navigating to a real remote
  // URL -- not fetchable by the backend, so treated as "nothing captured" and the caller falls back.
  resolve(/^https?:\/\//i.test(item.url) ? item.url : null);
});

/** Primes the onCreated listener above right before the content script clicks Download. */
export function armDownloadCapture(): null {
  if (pending) {
    clearTimeout(pending.timeoutId);
    pending.resolve(null);
  }
  currentCapture = new Promise<string | null>((resolve) => {
    const timeoutId = setTimeout(() => {
      if (pending && pending.resolve === resolve) {
        pending = null;
        resolve(null);
      }
    }, DOWNLOAD_CAPTURE_TIMEOUT_MS);
    pending = { resolve, timeoutId };
  });
  return null;
}

export function awaitDownloadCapture(): Promise<string | null> {
  return currentCapture ?? Promise.resolve(null);
}
