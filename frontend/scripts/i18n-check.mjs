// Lists each locale's keys missing from, or no longer in, en.json: `npm run i18n:check [code]`.
// A plural key (key_one, key_other, ...) needs every form the locale uses for whole-number counts.
import { readdirSync, readFileSync } from "node:fs";

const dir = new URL("../src/i18n/locales/", import.meta.url);
const PLURAL = /_(zero|one|two|few|many|other)$/;

function keys(node, prefix = "") {
  return Object.entries(node).flatMap(([key, value]) =>
    value && typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const read = (code) => keys(JSON.parse(readFileSync(new URL(`${code}.json`, dir), "utf8")));

// Fractional-only forms (Lithuanian `many`) are left out: counts here are whole numbers.
function pluralForms(code) {
  const rules = new Intl.PluralRules(code);
  return new Set(Array.from({ length: 1000 }, (_, n) => rules.select(n)));
}

const plurals = new Set();
const plain = [];
for (const key of read("en")) {
  if (PLURAL.test(key)) plurals.add(key.replace(PLURAL, ""));
  else plain.push(key);
}

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
  const forms = [...pluralForms(code)];
  const en = new Set([...plain, ...[...plurals].flatMap((base) => forms.map((form) => `${base}_${form}`))]);
  // Extra plural forms a translator added (such as `_many`) aren't stale, just unused for whole numbers.
  const locale = new Set(read(code).filter((key) => en.has(key) || !plurals.has(key.replace(PLURAL, ""))));
  const missing = [...en].filter((key) => !locale.has(key));
  const stale = [...locale].filter((key) => !en.has(key));
  const done = Math.floor(((en.size - missing.length) / en.size) * 100);
  console.log(`${code}: ${done}% translated, ${missing.length} missing, ${stale.length} no longer used`);
  for (const key of missing) console.log(`  missing  ${key}`);
  for (const key of stale) console.log(`  unused   ${key}`);
}
