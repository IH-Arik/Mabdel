import { Grid3x3, Trash2 } from 'lucide-react';
import { DIGIT_CHOICES, MAX_MENU_OPTIONS, PHONE_LANGUAGE_OPTIONS } from './constants';
import SectionCard from './SectionCard';

export default function LanguageMenuSection({
  callSettings, updateField, updateMenuOption, addMenuOption, removeMenuOption, t,
}) {
  return (
          <SectionCard icon={Grid3x3} title={t('aiprof_hdr_language_menu')} description={t('aiprof_language_menu_desc')}>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={Boolean(callSettings?.language_menu_enabled)}
                onChange={(event) => updateField('language_menu_enabled', event.target.checked)}
                className="w-4 h-4 accent-[#9333ea]"
              />
              <span className="text-white text-sm font-semibold">{t('aiprof_toggle_language_menu')}</span>
            </label>

            {callSettings?.language_menu_enabled ? (
              <div className="space-y-2">
                {(callSettings?.language_menu || []).map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={option.digit}
                      onChange={(event) => updateMenuOption(index, 'digit', event.target.value)}
                      className="w-16 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-2 py-2 outline-none"
                    >
                      {DIGIT_CHOICES.map((digit) => <option key={digit} value={digit}>{digit}</option>)}
                    </select>
                    <select
                      value={option.language}
                      onChange={(event) => updateMenuOption(index, 'language', event.target.value)}
                      className="flex-1 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2 outline-none"
                    >
                      {PHONE_LANGUAGE_OPTIONS.map((lang) => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeMenuOption(index)}
                      className="p-2 text-[#A4B0B7] hover:text-rose-400 transition-colors cursor-pointer"
                      title={t('aiprof_btn_remove_option')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(callSettings?.language_menu || []).length < MAX_MENU_OPTIONS ? (
                  <button
                    type="button"
                    onClick={addMenuOption}
                    className="text-xs font-bold text-[#9333ea] hover:underline cursor-pointer"
                  >
                    + {t('aiprof_btn_add_option')}
                  </button>
                ) : null}
                <p className="text-[#4A5568] text-xs mt-2">{t('aiprof_language_menu_hint')}</p>
              </div>
            ) : null}
          </SectionCard>
  );
}
