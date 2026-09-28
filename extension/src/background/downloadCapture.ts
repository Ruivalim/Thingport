// The content script clicks MakerWorld's real Download button; this captures the resulting browser
// download, cancels it, and reads its URL. That avoids guessing MakerWorld's resolution API.
//
// Two messages (ARM, then AWAIT) because the click happens in the content script in between.

const DOWNLOAD_CAPTURE_TIMEOUT_MS = 8000;

// Only one capture is ever in flight.
let pending: { resolve: (url: string | null) => void; timeoutId: ReturnType<typeof setTimeout> } | null = null;
let currentCapture: Promise<string | null> | null = null;

chrome.downloads.onCreated.addListener((item) => {
  if (!pending) return;
  const { resolve, timeoutId } = pending;
  pending = null;
  clearTimeout(timeoutId);
  chrome.downloads.cancel(item.id).catch(() => undefined);
  chrome.downloads.erase({ id: item.id }).catch(() => undefined);
  // A blob: URL isn't fetchable by the backend, so it counts as nothing captured.
  resolve(/^https?:\/\//i.test(item.url) ? item.url : null);
});

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
