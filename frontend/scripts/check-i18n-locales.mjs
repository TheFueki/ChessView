import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = dirname(fileURLToPath(import.meta.url));
const root = join(scriptRoot, "../src/locales");
const requiredLocales = ["en", "ru", "kk"];
const ignoredHardcodedText = new Set([
  "ChessView",
  "ChessView Logo",
  "Discord",
  "Google",
  "BYE_SYSTEM_ALLOC",
  "Promise",
  "[Event ...]",
]);

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

const localeFiles = readdirSync(root).filter((file) => file.endsWith(".json")).sort();
const expectedLocaleFiles = requiredLocales.map((locale) => `${locale}.json`).sort();
const unsupportedLocaleFiles = localeFiles.filter((file) => !expectedLocaleFiles.includes(file));

if (unsupportedLocaleFiles.length) {
  hasError = true;
  console.error(`Unsupported locale files found: ${unsupportedLocaleFiles.join(", ")}`);
}

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

function scanHardcodedJsxText() {
  const srcRoot = join(scriptRoot, "../src");
  const files = [];

  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "test") {
          continue;
        }
        visit(path);
      } else if (entry.isFile() && path.endsWith(".tsx") && !path.endsWith(".test.tsx")) {
        files.push(path);
      }
    }
  }

  visit(srcRoot);

  const hardcoded = new Set();
  const textPattern = />([^<>{}]*[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі][^<>{}]*)</g;
  const attributePattern = /\b(?:aria-label|alt|placeholder|title)="([^"]*[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі][^"]*)"/g;

  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const lines = source.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      let match;
      while ((match = textPattern.exec(line))) {
        const text = match[1].trim().replace(/\s+/g, " ");
        if (isTranslatableLiteral(text)) {
          hardcoded.add(`${text}\t${file}:${index + 1}`);
        }
      }

      while ((match = attributePattern.exec(line))) {
        const text = match[1].trim().replace(/\s+/g, " ");
        if (isTranslatableLiteral(text)) {
          hardcoded.add(`${text}\t${file}:${index + 1}`);
        }
      }
    }
  }

  return [...hardcoded].sort().map((entry) => {
    const [text, location] = entry.split("\t");
    return { text, location };
  });
}

const hardcoded = scanHardcodedJsxText();
const uncovered = hardcoded.filter(({ text }) => {
  return requiredLocales.some((locale) => {
    const value = locales[locale]?.literals?.[text];
    return typeof value !== "string" || value.trim().length === 0;
  });
});

if (uncovered.length) {
  hasError = true;
  console.error("Hardcoded JSX text is missing literal translations:");
  for (const { text, location } of uncovered) {
    console.error(`  ${location}: ${text}`);
  }
}

if (hasError) {
  process.exit(1);
}

console.log(`i18n locale parity checks passed for ${requiredLocales.join(", ")}.`);

function isTranslatableLiteral(text) {
  if (!text || ignoredHardcodedText.has(text)) {
    return false;
  }

  if (/^[\\w.]+$/.test(text)) {
    return false;
  }

  if (text.includes("=>") || text.includes("?.") || text.includes("http.") || text.includes("sessionState")) {
    return false;
  }

  return true;
}
