// Mirrors madbel-mobile/src/i18n/appTranslations.js's language list exactly,
// so the Website and the app always support the same 10 languages.
export const LANGUAGE_OPTIONS = [
  { code: 'en-US', label: 'EN', name: 'English' },
  { code: 'bn-BD', label: 'বাংলা', name: 'বাংলা' },
  { code: 'hi-IN', label: 'हिं', name: 'हिंदी' },
  { code: 'ar-SA', label: 'عر', name: 'العربية' },
  { code: 'es-ES', label: 'ES', name: 'Español' },
  { code: 'fr-FR', label: 'FR', name: 'Français' },
  { code: 'pt-BR', label: 'PT', name: 'Português' },
  { code: 'ru-RU', label: 'RU', name: 'Русский' },
  { code: 'ur-PK', label: 'اُر', name: 'Urdu' },
  { code: 'tr-TR', label: 'TR', name: 'Türkçe' },
  { code: 'zh-CN', label: '中文', name: '中文' },
  { code: 'ja-JP', label: '日本語', name: '日本語' },
];

export const RTL_LANGUAGES = ['ar-SA', 'ur-PK'];

export const DEFAULT_LANGUAGE = 'en-US';

// Each language's full string table used to live in one ~1.6MB object here,
// bundled eagerly into every page load regardless of which language a visitor
// actually uses. Loaders below dynamically import one ./locales/<code>.js file
// at a time instead, so only the active language (plus English as the
// always-available fallback) is ever downloaded.
export const TRANSLATION_LOADERS = {
  'en-US': () => import('./locales/en-US.js'),
  'bn-BD': () => import('./locales/bn-BD.js'),
  'hi-IN': () => import('./locales/hi-IN.js'),
  'ar-SA': () => import('./locales/ar-SA.js'),
  'es-ES': () => import('./locales/es-ES.js'),
  'fr-FR': () => import('./locales/fr-FR.js'),
  'pt-BR': () => import('./locales/pt-BR.js'),
  'ru-RU': () => import('./locales/ru-RU.js'),
  'ur-PK': () => import('./locales/ur-PK.js'),
  'tr-TR': () => import('./locales/tr-TR.js'),
  'zh-CN': () => import('./locales/zh-CN.js'),
  'ja-JP': () => import('./locales/ja-JP.js'),
};
