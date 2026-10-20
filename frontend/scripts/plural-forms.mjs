// The plural forms a locale uses for whole-number counts: 0-999 plus powers of ten, so forms only large
// round numbers take (French and Spanish `many` for 1,000,000) count too. Fractional-only forms (Lithuanian
// `many`) are left out.
const SAMPLES = [...Array.from({ length: 1000 }, (_, n) => n), ...Array.from({ length: 10 }, (_, k) => 10 ** (k + 3))];

export function pluralForms(code) {
  const rules = new Intl.PluralRules(code);
  return new Set(SAMPLES.map((n) => rules.select(n)));
}
