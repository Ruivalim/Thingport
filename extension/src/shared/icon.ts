import iconSvg from "../assets/thingport-icon-color.svg";

let template: SVGSVGElement | null = null;

/** Inline so nothing needs to be web-accessible or pass the page's image CSP. The <title> is
 *  dropped (its id would repeat) and the icon is aria-hidden. */
export function createIcon(): SVGSVGElement {
  if (!template) {
    const parsed = new DOMParser().parseFromString(iconSvg, "image/svg+xml")
      .documentElement as unknown as SVGSVGElement;
    parsed.querySelector("title")?.remove();
    parsed.removeAttribute("role");
    parsed.removeAttribute("aria-labelledby");
    parsed.setAttribute("aria-hidden", "true");
    parsed.setAttribute("focusable", "false");
    template = parsed;
  }
  return document.importNode(template, true);
}

export function fillIcons(root: ParentNode): void {
  for (const slot of root.querySelectorAll("[data-icon]")) slot.replaceChildren(createIcon());
}
