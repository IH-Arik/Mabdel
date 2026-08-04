import { TRANSLATIONS } from './src/i18n/translations.js';
const langs = Object.keys(TRANSLATIONS);
const enKeys = new Set(Object.keys(TRANSLATIONS['en-US']));
console.log('Languages:', langs.length, langs.join(', '));
console.log('en-US key count:', enKeys.size);
let allOk = true;
for (const lang of langs) {
  const keys = new Set(Object.keys(TRANSLATIONS[lang]));
  const missing = [...enKeys].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !enKeys.has(k));
  const emptyValues = [...keys].filter(k => TRANSLATIONS[lang][k] === '' || TRANSLATIONS[lang][k] == null);
  if (missing.length || extra.length || emptyValues.length) {
    allOk = false;
    console.log(lang, 'MISMATCH missing:', missing, 'extra:', extra, 'empty:', emptyValues);
  }
}
console.log(allOk ? 'ALL 10 LANGUAGES MATCH, NO EMPTY VALUES' : 'PROBLEMS FOUND');
