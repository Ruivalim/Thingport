// Lists each locale's keys missing from, or no longer in, en.json: `npm run i18n:check [code]`.
// Plural forms (key_one, key_few, ...) count as one key, since languages need different ones.
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../src/i18n/locales/", import.meta.url);
const PLURAL = /_(zero|one|two|few|many|other)$/;

function keys(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`.replace(PLURAL, "")],
  );
}

const read = (code) => new Set(keys(JSON.parse(readFileSync(new URL(`${code}.json`, dir), "utf8"))));
const en = read("en");
const only = process.argv[2];
const codes = readdirSync(dir)
  .filter((file) => file.endsWith(".json") && file !== "en.json")
  .map((file) => file.slice(0, -".json".length))
  .filter((code) => !only || code === only);

if (only && codes.length === 0) {
  console.error(`No src/i18n/locales/${only}.json`);
  process.exit(1);
}

for (const code of codes) {
  const locale = read(code);
  const missing = [...en].filter((key) => !locale.has(key));
  const stale = [...locale].filter((key) => !en.has(key));
  const done = Math.floor(((en.size - missing.length) / en.size) * 100);
  console.log(`${code}: ${done}% translated, ${missing.length} missing, ${stale.length} no longer used`);
  for (const key of missing) console.log(`  missing  ${key}`);
  for (const key of stale) console.log(`  unused   ${key}`);
}
