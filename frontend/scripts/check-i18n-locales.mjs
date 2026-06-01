import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../src/locales");
const requiredLocales = ["en", "ru", "kk"];

function flatten(value, prefix = "") {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
  }

  return [{ key: prefix, value }];
}

function readLocale(locale) {
  const file = join(root, `${locale}.json`);
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read valid JSON for locale "${locale}" at ${file}: ${error.message}`);
  }
}

const locales = Object.fromEntries(requiredLocales.map((locale) => [locale, readLocale(locale)]));
const expectedKeys = flatten(locales.en).map((entry) => entry.key).sort();
let hasError = false;

for (const locale of requiredLocales) {
  const entries = flatten(locales[locale]);
  const keys = entries.map((entry) => entry.key).sort();
  const missing = expectedKeys.filter((key) => !keys.includes(key));
  const extra = keys.filter((key) => !expectedKeys.includes(key));
  const blank = entries.filter((entry) => typeof entry.value !== "string" || entry.value.trim().length === 0);

  if (missing.length || extra.length || blank.length) {
    hasError = true;
    console.error(`Locale ${locale} is not valid.`);
    if (missing.length) console.error(`  Missing: ${missing.join(", ")}`);
    if (extra.length) console.error(`  Extra: ${extra.join(", ")}`);
    if (blank.length) console.error(`  Blank/non-string: ${blank.map((entry) => entry.key).join(", ")}`);
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`i18n locale parity checks passed for ${requiredLocales.join(", ")}.`);
