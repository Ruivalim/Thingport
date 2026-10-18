// The model sites Grab works on: the built-in ones always, the optional ones (optionalSites.ts) once enabled here.
// Enabling asks the browser for that one site; registering Grab there follows in the background, from the browser's
// permission event.

import { OPTIONAL_SITES, siteEnabled, type OptionalSite } from "../shared/optionalSites";
import { clearError, els, showError } from "./dom";

const SVG_NS = "http://www.w3.org/2000/svg";

/** `viewBox` defaults to 0 0 24 24, Simple Icons' box. */
type Logo = { path: string; color: string; viewBox?: string; fillRule?: "evenodd" };

// Same glyphs as the web app's providerLogos.tsx.
const LOGOS: Record<"makerworld" | "printables" | "thingiverse" | OptionalSite["id"], Logo> = {
  makerworld: {
    color: "#00AE42",
    path: "M12.662 24V8.959l8.535 3.369V24zm-9.859-.003v-7.521l8.534-3.371-.001 10.892zM2.803 0h8.533l.001 11.672-8.534 3.369zm9.859 0h8.535v10.892l-8.535-3.371z",
  },
  printables: {
    color: "#FA6831",
    path: "M3.678 4.8 12 9.6v9.6l8.322-4.8V4.8L12 0ZM12 19.2l-8.322-4.8V24Z",
  },
  thingiverse: {
    color: "#248BFB",
    path: "M11.955.005C5.425-.152-.091 5.485.007 11.805c-.235 6.756 5.537 12.25 12.052 12.196C18.621 23.9 23.912 18.595 24 12.03 24.031 5.483 18.505-.18 11.955.005zm-.047 1.701a10.276 10.276 0 0 1 7.36 17.529 10.275 10.275 0 0 1-17.556-7.287C1.71 6.308 6.268 1.728 11.907 1.706zm-5.55 4.781c-.322 0-.358.033-.358.361v2.248c0 .351.04.391.398.391h3.823c.274 0 .274.004.274.265v9.736a.176.176 0 0 0 .051.146c.04.038.093.059.148.053h2.555c.247-.003.283-.035.283-.28v-9.32c0-.124.004-.239 0-.39s.055-.21.218-.21h3.9c.319.004.35-.032.35-.344V6.855c0-.34-.024-.363-.37-.363h-5.626z",
  },
  myminifactory: {
    color: "#00C4A6",
    path: "M24 0.241V23.759a0.241 0.241 0 0 1 -0.241 0.241H14.4V19.201h4.801V7.2H14.4V14.4H9.6V7.2H4.799v12.001H9.6v4.799H0.481A0.481 0.481 0 0 1 0 23.519V0.241A0.241 0.241 0 0 1 0.241 0H23.759A0.241 0.241 0 0 1 24 0.241Z",
  },
  // A black-and-white mark, so it takes the text colour to show in both themes; the S is cut out of the disc.
  snapmaker: {
    color: "currentColor",
    viewBox: "0 0 36 36",
    fillRule: "evenodd",
    path: "M18 0a18 18 0 1 0 0 36a18 18 0 1 0 0-36ZM23.2899 9.13976C21.7574 8.82421 20.5055 9.02036 19.5311 9.72254C18.5567 10.4247 17.8864 11.6016 17.5232 13.2505L16.3835 18.396H16.3864L15.3677 22.9928C15.1758 23.8627 14.8864 24.4711 14.5026 24.8207C14.1187 25.1704 13.5842 25.2727 12.9022 25.1334C12.4593 25.0425 11.9868 24.8776 11.4789 24.6388L10.9238 27.1291C11.414 27.3792 12.0104 27.5754 12.7132 27.7175C14.2457 28.0331 15.4976 27.8369 16.472 27.1348C17.4464 26.4326 18.1167 25.2557 18.4799 23.6068L19.6197 18.4613H19.6167L20.6354 13.8645C20.8273 12.9946 21.1167 12.3863 21.5006 12.0366C21.8844 11.6869 22.4189 11.5846 23.1009 11.7239C23.5439 11.8148 24.0163 11.9797 24.5242 12.2185L25.0763 9.72538C24.5891 9.4809 23.9927 9.28475 23.2899 9.13976Z",
  },
};

type Site = { name: string; logo: Logo; optional?: OptionalSite };

const SITES: Site[] = [
  { name: "MakerWorld", logo: LOGOS.makerworld },
  { name: "Printables", logo: LOGOS.printables },
  { name: "Thingiverse", logo: LOGOS.thingiverse },
  ...OPTIONAL_SITES.map((site) => ({ name: site.name, logo: LOGOS[site.id], optional: site })),
];

function svg(path: string, attrs: Record<string, string>, viewBox = "0 0 24 24"): SVGSVGElement {
  const el = document.createElementNS(SVG_NS, "svg");
  el.setAttribute("viewBox", viewBox);
  el.setAttribute("aria-hidden", "true");
  el.setAttribute("focusable", "false");
  const p = document.createElementNS(SVG_NS, "path");
  p.setAttribute("d", path);
  for (const [name, value] of Object.entries(attrs)) p.setAttribute(name, value);
  el.append(p);
  return el;
}

function tick(site: Site, appeared = false): HTMLElement {
  const el = document.createElement("span");
  el.className = appeared ? "site__tick site__tick--new" : "site__tick";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", `Enabled on ${site.name}`);
  el.title = "Enabled";
  el.append(
    svg("M5 12.5l4.5 4.5L19 7.5", {
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "3",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    }),
  );
  return el;
}

function enableButton(site: Site, optional: OptionalSite): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "site__enable";
  btn.textContent = "Enable";
  btn.title = `Asks your browser for access to ${site.name}`;
  btn.setAttribute("aria-label", `Enable on ${site.name}`);
  btn.addEventListener("click", async () => {
    clearError(els.configuredError);
    btn.disabled = true;
    try {
      // Straight away: permissions.request() needs this click's user gesture.
      if (await chrome.permissions.request({ origins: optional.origins })) {
        btn.replaceWith(tick(site, true));
        return;
      }
      showError(`Thingport Grab needs your browser's permission to run on ${site.name}.`, els.configuredError);
    } catch (err) {
      showError(err instanceof Error ? err.message : String(err), els.configuredError);
    }
    btn.disabled = false;
  });
  return btn;
}

export async function loadSites(): Promise<void> {
  const enabled = await Promise.all(SITES.map((site) => (site.optional ? siteEnabled(site.optional) : true)));
  els.sitesList.replaceChildren(
    ...SITES.map((site, index) => {
      const row = document.createElement("li");
      row.className = "site";
      const name = document.createElement("span");
      name.className = "site__name";
      name.textContent = site.name;
      const status = enabled[index] || !site.optional ? tick(site) : enableButton(site, site.optional);
      const { path, color, viewBox, fillRule } = site.logo;
      row.append(svg(path, { fill: color, ...(fillRule ? { "fill-rule": fillRule } : {}) }, viewBox), name, status);
      return row;
    }),
  );
}
