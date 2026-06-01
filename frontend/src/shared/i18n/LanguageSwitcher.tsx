import { Globe2 } from "lucide-react";
import type { Locale } from "./context";
import { useI18n } from "./useI18n";

const localeOptions: { code: Locale; labelKey: string }[] = [
  { code: "en", labelKey: "common.languages.en" },
  { code: "ru", labelKey: "common.languages.ru" },
  { code: "kk", labelKey: "common.languages.kk" },
];

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950/80 px-2.5 py-2 text-xs font-medium text-neutral-300">
      <Globe2 className="h-4 w-4 text-neutral-500" />
      {compact ? <span className="sr-only">{t("common.language")}</span> : <span>{t("common.language")}</span>}
      <select
        className="bg-transparent text-xs font-semibold text-neutral-100 outline-none"
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        aria-label={t("common.language")}
      >
        {localeOptions.map((option) => (
          <option key={option.code} value={option.code} className="bg-neutral-950 text-neutral-100">
            {t(option.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}
