import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LANGUAGE_OPTIONS, RTL_LANGUAGES, TRANSLATIONS } from '../i18n/translations';

const LANGUAGE_STORAGE_KEY = 'mabdel_website_lang';
const DEFAULT_LANGUAGE = 'en-US';

export const LANGUAGES = LANGUAGE_OPTIONS;

const interpolate = (template, params = {}) =>
  String(template ?? '').replace(/\{(\w+)\}/g, (_, key) => (params[key] == null ? '' : String(params[key])));

const isSupportedLanguage = (code) => Boolean(code) && LANGUAGE_OPTIONS.some((lang) => lang.code === code);

const detectInitialLanguage = () => {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isSupportedLanguage(stored)) return stored;
  } catch {
    // localStorage unavailable (SSR/private mode) — fall through to default.
  }
  return DEFAULT_LANGUAGE;
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage);

  const isRtl = RTL_LANGUAGES.includes(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  }, [language, isRtl]);

  const setLanguage = useCallback((code) => {
    if (!isSupportedLanguage(code)) return;
    setLanguageState(code);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    } catch {
      // Best-effort persistence only.
    }
  }, []);

  const t = useCallback(
    (key, params) => {
      const template = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS[DEFAULT_LANGUAGE]?.[key] ?? key;
      return interpolate(template, params);
    },
    [language],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, isRtl, languages: LANGUAGE_OPTIONS }),
    [language, setLanguage, t, isRtl],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
}
