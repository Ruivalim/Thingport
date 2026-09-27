import iconSvg from "../assets/thingport-icon-color.svg";

let template: SVGSVGElement | null = null;

/** A fresh, decorative copy of the Thingport icon as an inline <svg> node -- inline so nothing has
 *  to be web-accessible or pass the host page's image CSP. The <title> (whose id would repeat when
 *  the icon appears more than once in a document) is dropped, and it's hidden from assistive tech
 *  since every use sits next to its own text or aria-label. */
export function createIcon(): SVGSVGElement {
  if (!template) {
    const parsed = new DOMParser().parseFromString(iconSvg, "image/svg+xml").documentElement as unknown as SVGSVGElement;
    parsed.querySelector("title")?.remove();
    parsed.removeAttribute("role");
    parsed.removeAttribute("aria-labelledby");
    parsed.setAttribute("aria-hidden", "true");
    parsed.setAttribute("focusable", "false");
    template = parsed;
  }
  return document.importNode(template, true);
}

/** Fills every `[data-icon]` placeholder under `root` with the icon. */
export function fillIcons(root: ParentNode): void {
  for (const slot of root.querySelectorAll("[data-icon]")) slot.replaceChildren(createIcon());
}
