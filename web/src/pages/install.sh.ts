// Serves the repo's install.sh at /install.sh, for: curl -fsSL https://thingport.net/install.sh | sh
import script from "../../../install.sh?raw";

export function GET() {
  return new Response(script, { headers: { "Content-Type": "text/x-shellscript; charset=utf-8" } });
}
