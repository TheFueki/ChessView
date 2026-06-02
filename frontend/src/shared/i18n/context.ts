import { createContext } from "react";
import en from "@/locales/en.json";
import kk from "@/locales/kk.json";
import ru from "@/locales/ru.json";

export const resources = { en, ru, kk } as const;
export const localeStorageKey = "chessview.locale";

export type Locale = keyof typeof resources;

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function isLocale(value: string | null | undefined): value is Locale {
  return Boolean(value && value in resources);
}

export function readTranslation(source: Record<string, unknown>, key: string): string | undefined {
  const value = key.split(".").reduce<unknown>((current, part) => {
    if (current && typeof current === "object" && part in current) {
      return (current as Record<string, unknown>)[part];
    }

    return undefined;
  }, source);

  return typeof value === "string" ? value : undefined;
}

export function readLiteral(locale: Locale, value: string): string | undefined {
  const normalized = value.trim().replace(/\s+/g, " ");
  const canonical = findCanonicalLiteral(normalized);
  if (!canonical) {
    return undefined;
  }

  return readTranslation(resources[locale], `literals.${canonical}`);
}

function findCanonicalLiteral(value: string): string | undefined {
  const entries = Object.entries(resources.en.literals);
  if (value in resources.en.literals) {
    return value;
  }

  for (const [canonical] of entries) {
    if (Object.values(resources).some((resource) => resource.literals[canonical as keyof typeof resources.en.literals] === value)) {
      return canonical;
    }
  }

  return undefined;
}
