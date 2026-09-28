import { send, type RecentImport } from "../shared/messages";
import { els } from "./dom";

function recentItemEl(item: RecentImport): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "recent-item";
  link.href = item.url;
  link.title = item.title || "";
  link.setAttribute("aria-label", item.title || "Imported model");
  // A plain link click in a popup isn't guaranteed to open a tab, and the popup should close after.
  link.addEventListener("click", (event) => {
    event.preventDefault();
    void chrome.tabs.create({ url: item.url });
    window.close();
  });

  const placeholder = () => {
    link.textContent = (item.title || "?").trim().charAt(0).toUpperCase() || "?";
  };
  if (item.thumbDataUrl) {
    const img = document.createElement("img");
    img.src = item.thumbDataUrl;
    img.alt = "";
    img.addEventListener("error", () => {
      img.remove();
      placeholder();
    });
    link.appendChild(img);
  } else {
    placeholder();
  }
  return link;
}

export async function loadRecentImports(): Promise<void> {
  const res = await send("GET_RECENT_IMPORTS");
  if (!res?.ok || !res.data.length) {
    els.recentSection.hidden = true;
    return;
  }
  els.recentGrid.replaceChildren(...res.data.map(recentItemEl));
  els.recentSection.hidden = false;
}
