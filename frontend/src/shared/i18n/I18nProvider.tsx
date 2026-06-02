import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  I18nContext,
  isLocale,
  localeStorageKey,
  readLiteral,
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

  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") {
      return;
    }

    let isLocalizing = false;
    let frame: number | null = null;
    const localizedAttributes = ["aria-label", "alt", "placeholder", "title"];

    const localizeNode = (root: ParentNode) => {
      if (isLocalizing) {
        return;
      }

      isLocalizing = true;
      try {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let textNode = walker.nextNode() as Text | null;

        while (textNode) {
          const value = textNode.nodeValue ?? "";
          const translated = readLiteral(locale, value);
          if (translated && translated !== value.trim()) {
            textNode.nodeValue = value.replace(value.trim(), translated);
          }
          textNode = walker.nextNode() as Text | null;
        }

        const elements = root instanceof Element ? [root, ...Array.from(root.querySelectorAll("*"))] : Array.from(root.querySelectorAll("*"));
        for (const element of elements) {
          for (const attribute of localizedAttributes) {
            const value = element.getAttribute(attribute);
            if (!value) {
              continue;
            }

            const translated = readLiteral(locale, value);
            if (translated && translated !== value) {
              element.setAttribute(attribute, translated);
            }
          }
        }
      } finally {
        isLocalizing = false;
      }
    };

    const scheduleLocalize = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(() => {
        frame = null;
        localizeNode(document.body);
      });
    };

    localizeNode(document.body);
    const observer = new MutationObserver(scheduleLocalize);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: localizedAttributes,
      childList: true,
      subtree: true,
    });

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      observer.disconnect();
    };
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t: (key: string) => readTranslation(resources[locale], key) ?? readTranslation(resources.en, key) ?? key,
  }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
