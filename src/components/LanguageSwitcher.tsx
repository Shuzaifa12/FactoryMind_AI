import { useI18n, type Locale } from "@/lib/i18n";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "en", label: "English" },
  { locale: "ur", label: "اردو" },
];

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className="inline-flex rounded-md border border-line bg-panel p-0.5"
    >
      {OPTIONS.map((o) => (
        <button
          key={o.locale}
          type="button"
          lang={o.locale}
          aria-pressed={locale === o.locale}
          onClick={() => setLocale(o.locale)}
          className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
            locale === o.locale
              ? "bg-accent text-accent-ink"
              : "text-ink hover:bg-accent-soft"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
