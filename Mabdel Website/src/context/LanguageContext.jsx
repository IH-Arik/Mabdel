import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, RTL_LANGUAGES, TRANSLATION_LOADERS } from '../i18n/translations';
import ENGLISH_TRANSLATIONS from '../i18n/locales/en-US.js';

const LANGUAGE_STORAGE_KEY = 'mabdel_website_lang';

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
  // English ships eagerly (it's the fallback for missing keys and the most
  // common language), every other language's strings load on demand.
  const [dicts, setDicts] = useState({ [DEFAULT_LANGUAGE]: ENGLISH_TRANSLATIONS });
  const loadingRef = useRef(new Set());

  const isRtl = RTL_LANGUAGES.includes(language);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  }, [language, isRtl]);

  useEffect(() => {
    if (dicts[language] || loadingRef.current.has(language)) return;
    const loader = TRANSLATION_LOADERS[language];
    if (!loader) return;
    loadingRef.current.add(language);
    loader()
      .then((mod) => {
        setDicts((prev) => ({ ...prev, [language]: mod.default }));
      })
      .catch(() => {
        // Stay on the English fallback already in `dicts` if a language chunk fails to load.
      })
      .finally(() => {
        loadingRef.current.delete(language);
      });
  }, [language, dicts]);

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
      const template = dicts[language]?.[key] ?? dicts[DEFAULT_LANGUAGE]?.[key] ?? key;
      return interpolate(template, params);
    },
    [language, dicts],
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
