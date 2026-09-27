// The Thingport Bridge helper app's own protocol (see bridge/README.md) -- it downloads the
// file itself and hands it to the local slicer, for slicers whose own URL handler won't take it
// directly.
const BRIDGE_SCHEME = "thingport";

// Bambu Studio's bambustudio:// and PrusaSlicer's prusaslicer:// handlers both only open files
// served from a domain allowlist (Bambu Lab's own storefronts; printables.com plus a handful of
// sites Prusa has manually whitelisted, respectively) -- a self-hosted Thingport instance is
// never on either list, so the direct protocol silently no-ops. Cura does register cura://open,
// but only when it was installed in a way that actually wires up OS protocol handling (not
// reliable across its AppImage/Flatpak/Microsoft Store builds), so it's routed the same way for
// consistency. All three are handed to the Bridge instead, which downloads the file itself and
// execs the local slicer directly, bypassing both the domain check and protocol registration.
// OrcaSlicer accepts any HTTP(S) URL through its own handler, so it still bypasses the Bridge.
// Anycubic Slicer Next is an OrcaSlicer fork and understands the same links -- but it registers
// OrcaSlicer's own orcaslicer:// protocol rather than one of its own, so with both installed only
// one of them gets those links. Routing it through the Bridge, which launches it by path, opens
// the one the user actually picked.
const BRIDGED_SLICERS = new Set(["bambustudio", "prusaslicer", "cura", "anycubicslicernext"]);

/** Whether slicerId launches through the Thingport Bridge helper app rather than the slicer's
 *  own URL protocol -- used to show the "install the Bridge" hint for the right slicers. */
export function isBridgedSlicer(slicerId: string): boolean {
  return BRIDGED_SLICERS.has(slicerId);
}

// Elegoo Slicer (elegooslicer://) and Snapmaker Orca (snapmaker-orca://) are OrcaSlicer forks
// that, unlike Anycubic's, register a protocol of their own and accept any HTTP(S) URL through
// it, so they launch directly like OrcaSlicer. Both name the downloaded file after the URL's last
// path segment, which a prepared print's URL (.../prepared-print) doesn't end in -- so each is
// also passed the filename the way its handler reads it: Elegoo from a filename= query parameter
// on the file URL itself, Snapmaker Orca from a name= parameter after the file= one.
function withFilenameHint(slicerId: string, fileUrl: string, filename: string): { fileUrl: string; extra: string } {
  if (slicerId === "elegooslicer") {
    const url = new URL(fileUrl, window.location.origin);
    url.searchParams.set("filename", filename);
    return { fileUrl: url.toString(), extra: "" };
  }
  if (slicerId === "snapmaker-orca") {
    return { fileUrl, extra: `&name=${encodeURIComponent(filename)}` };
  }
  return { fileUrl, extra: "" };
}

// Builds the URL that "Open in {Slicer}" navigates to: either the slicer's own registered
// protocol handler (e.g. orcaslicer://), or -- for a BRIDGED_SLICERS id -- the Thingport Bridge
// protocol, which downloads fileUrl locally before handing it to the slicer. Only meaningful for
// the SLICER_OPTIONS ids that register a protocol; never call this for "other".
export function slicerLaunchUrl(slicerId: string, fileUrl: string, filename?: string): string {
  if (BRIDGED_SLICERS.has(slicerId)) {
    const params = new URLSearchParams({ url: fileUrl, slicer: slicerId });
    if (filename) params.set("filename", filename);
    return `${BRIDGE_SCHEME}://open?${params.toString()}`;
  }
  const hinted = filename ? withFilenameHint(slicerId, fileUrl, filename) : { fileUrl, extra: "" };
  return `${slicerId}://open?file=${encodeURIComponent(hinted.fileUrl)}${hinted.extra}`;
}
