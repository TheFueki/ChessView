import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  I18nContext,
  isLocale,
  localeStorageKey,
  readTranslation,
  resources,
  type Locale,
  type I18nContextValue,
} from "./context";

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(localeStorageKey);
  if (isLocale(stored)) {
    return stored;
  }

  const browserLocale = window.navigator.language.split("-")[0];
  return isLocale(browserLocale) ? browserLocale : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    window.localStorage.setItem(localeStorageKey, nextLocale);
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key: string) => readTranslation(resources[locale], key) ?? readTranslation(resources.en, key) ?? key,
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
