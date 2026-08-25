import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2, Globe, Grid3x3, Loader2, Mic, Phone, PhoneOutgoing, Save, Sparkles, Trash2,
} from 'lucide-react';
import { smartflowApi } from '../../../api/services';
import { LABEL } from '../shared';
import { AI_LANGUAGE_OPTIONS, getStoredAiLanguage, setStoredAiLanguage } from '../../../utils/voiceAgentConfig';
import { useLanguage } from '../../../context/LanguageContext';

// The phone agent's TTS/translation table (app/services/call_phrases.py) only covers
// these eleven codes — notably no Bengali, unlike the web assistant's language list
// above. Offering a code the backend can't speak would either silently fall back to
// English or, for the keypad menu, get filtered out server-side with no explanation
// in the UI, so the two pickers intentionally use separate lists.
const PHONE_LANGUAGE_OPTIONS = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिंदी' },
  { code: 'ar', name: 'العربية' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
  { code: 'ur', name: 'اردو' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
];
const MAX_MENU_OPTIONS = 4;
const DIGIT_CHOICES = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// A curated starting list, not an enum enforced server-side — the field stays a
// free string so a business whose type isn't listed can still type it via "Other".
const BUSINESS_TYPE_OPTIONS = [
  'Dental Clinic', 'Medical Clinic', 'Law Firm', 'Real Estate Agency', 'Restaurant',
  'Salon / Spa', 'Home Services (Plumbing, Electrical, HVAC)', 'Auto Repair Shop',
  'Fitness Studio / Gym', 'Retail Store', 'Accounting / Bookkeeping Firm',
  'Insurance Agency', 'Veterinary Clinic', 'Photography Studio', 'Consulting Firm',
];

function SectionCard({ icon: Icon, title, description, children }) {
  return (
    <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5">
      <h3 className="font-bold text-white mb-1 flex items-center gap-2">
        <Icon size={16} className="text-[#9333ea]" />{title}
      </h3>
      {description ? <p className="text-[#A4B0B7] text-xs mb-3">{description}</p> : <div className="mb-3" />}
      {children}
    </div>
  );
}

function AIConfigTab() {
  const { t } = useLanguage();

  // Web voice assistant — unrelated to phone calls, unchanged from before.
  const [aiLanguage, setAiLanguage] = useState(() => getStoredAiLanguage());
  useEffect(() => { setStoredAiLanguage(aiLanguage); }, [aiLanguage]);

  // Phone call persona.
  const [voices, setVoices] = useState([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [callSettings, setCallSettings] = useState(null);
  const [businessTypeIsOther, setBusinessTypeIsOther] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fetchCallSettings = useCallback(async () => {
    try {
      setLoadingSettings(true);
      const response = await smartflowApi.getAICallSettings();
      const data = response.data?.data || null;
      setCallSettings(data);
      setBusinessTypeIsOther(Boolean(data?.business_type) && !BUSINESS_TYPE_OPTIONS.includes(data.business_type));
    } catch {
      setError(t('aiprof_err_load_failed'));
    } finally {
      setLoadingSettings(false);
    }
  }, [t]);

  useEffect(() => {
    smartflowApi.getAIVoices()
      .then((r) => setVoices(r.data?.data || []))
      .catch(() => setVoices([]))
      .finally(() => setLoadingVoices(false));
    fetchCallSettings();
  }, [fetchCallSettings]);

  const updateField = (field, value) => {
    setCallSettings((prev) => ({ ...(prev || {}), [field]: value }));
  };

  const updateMenuOption = (index, field, value) => {
    setCallSettings((prev) => {
      const menu = [...(prev?.language_menu || [])];
      menu[index] = { ...menu[index], [field]: value };
      return { ...prev, language_menu: menu };
    });
  };

  const addMenuOption = () => {
    setCallSettings((prev) => {
      const menu = [...(prev?.language_menu || [])];
      if (menu.length >= MAX_MENU_OPTIONS) return prev;
      const usedDigits = new Set(menu.map((option) => option.digit));
      const nextDigit = DIGIT_CHOICES.find((digit) => !usedDigits.has(digit)) || '1';
      const usedLanguages = new Set(menu.map((option) => option.language));
      const nextLanguage = PHONE_LANGUAGE_OPTIONS.find((lang) => !usedLanguages.has(lang.code))?.code || 'en';
      return { ...prev, language_menu: [...menu, { digit: nextDigit, language: nextLanguage }] };
    });
  };

  const removeMenuOption = (index) => {
    setCallSettings((prev) => {
      const menu = [...(prev?.language_menu || [])];
      menu.splice(index, 1);
      return { ...prev, language_menu: menu };
    });
  };

  const handleSave = async () => {
    if (!callSettings || saving) return;
    try {
      setSaving(true);
      setError('');
      const response = await smartflowApi.updateAICallSettings({
        assistant_name: callSettings.assistant_name || null,
        voice_id: callSettings.voice_id || null,
        business_type: callSettings.business_type || null,
        custom_instructions: callSettings.custom_instructions || null,
        greeting_inbound: callSettings.greeting_inbound || null,
        greeting_outbound: callSettings.greeting_outbound || null,
        language_menu_enabled: Boolean(callSettings.language_menu_enabled),
        language_menu: callSettings.language_menu || [],
      });
      setCallSettings(response.data?.data || callSettings);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiprof_err_save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const instructionsLength = (callSettings?.custom_instructions || '').length;

  return (
    <div className="space-y-5">
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Globe size={16} className="text-[#9333ea]" />{t('aiprof_hdr_lang')}</h3>
        <select
          value={aiLanguage}
          onChange={(event) => setAiLanguage(event.target.value)}
          className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none"
        >
          {AI_LANGUAGE_OPTIONS.map((language) => (
            <option key={language.code} value={language.code}>{language.name}</option>
          ))}
        </select>
        <p className="text-[#A4B0B7] text-xs mt-3">{t('aiprof_lang_desc')}</p>
      </div>

      {error ? <div className="bg-rose-950/30 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-3">{error}</div> : null}

      {loadingSettings ? (
        <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#9333ea]" /></div>
      ) : (
        <>
          <SectionCard icon={Sparkles} title={t('aiprof_hdr_persona')} description={t('aiprof_persona_desc')}>
            <label className={LABEL}>{t('aiprof_lbl_assistant_name')}</label>
            <input
              type="text"
              maxLength={60}
              placeholder={t('aiprof_ph_assistant_name')}
              value={callSettings?.assistant_name || ''}
              onChange={(event) => updateField('assistant_name', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50"
            />

            <label className={`${LABEL} mt-4`}>{t('aiprof_lbl_business_type')}</label>
            <p className="text-[#A4B0B7] text-xs mb-2">{t('aiprof_business_type_desc')}</p>
            <select
              value={businessTypeIsOther ? 'Other' : callSettings?.business_type || ''}
              onChange={(event) => {
                const nextIsOther = event.target.value === 'Other';
                setBusinessTypeIsOther(nextIsOther);
                updateField('business_type', nextIsOther ? '' : event.target.value);
              }}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50"
            >
              <option value="">{t('aiprof_ph_business_type')}</option>
              {BUSINESS_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
              <option value="Other">Other</option>
            </select>
            {businessTypeIsOther ? (
              <input
                type="text"
                maxLength={80}
                placeholder={t('aiprof_ph_business_type')}
                value={callSettings?.business_type || ''}
                onChange={(event) => updateField('business_type', event.target.value)}
                className="w-full mt-2 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50"
              />
            ) : null}
          </SectionCard>

          <SectionCard icon={Mic} title={t('aiprof_hdr_voices')}>
            {loadingVoices ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#9333ea]" /></div>
            ) : voices.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {voices.map((voice) => {
                  const voiceId = voice.id || voice.voice_id || voice.name;
                  const isSelected = (callSettings?.voice_id || 'female_warm') === voiceId;
                  return (
                    <button
                      key={voiceId}
                      type="button"
                      onClick={() => updateField('voice_id', voiceId)}
                      className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#9333ea]/10 border-[#9333ea]/50' : 'bg-[#131A24] border-[#243041] hover:border-[#9333ea]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-white font-semibold text-sm">{voice.label || voice.name || voice.voice_name}</p>
                        {isSelected ? <CheckCircle2 size={14} className="text-[#9333ea] shrink-0" /> : null}
                      </div>
                      {(voice.style || voice.language) && (
                        <p className="text-[#A4B0B7] text-xs mt-0.5 capitalize">{voice.style || voice.language}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-[#A4B0B7] text-sm">{t('aiprof_no_voices')}</p>}
          </SectionCard>

          <SectionCard icon={Phone} title={t('aiprof_hdr_greeting_inbound')} description={t('aiprof_greeting_inbound_desc')}>
            <textarea
              rows={2}
              maxLength={500}
              placeholder={t('aiprof_ph_greeting_default')}
              value={callSettings?.greeting_inbound || ''}
              onChange={(event) => updateField('greeting_inbound', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
          </SectionCard>

          <SectionCard icon={PhoneOutgoing} title={t('aiprof_hdr_greeting_outbound')} description={t('aiprof_greeting_outbound_desc')}>
            <textarea
              rows={2}
              maxLength={500}
              placeholder={t('aiprof_ph_greeting_default')}
              value={callSettings?.greeting_outbound || ''}
              onChange={(event) => updateField('greeting_outbound', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
          </SectionCard>

          <SectionCard icon={Sparkles} title={t('aiprof_hdr_instructions')} description={t('aiprof_instructions_desc')}>
            <textarea
              rows={4}
              maxLength={2000}
              placeholder={t('aiprof_ph_instructions')}
              value={callSettings?.custom_instructions || ''}
              onChange={(event) => updateField('custom_instructions', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
            <p className="text-[#4A5568] text-xs mt-1 text-right">{instructionsLength}/2000</p>
          </SectionCard>

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

          <div className="flex items-center justify-end gap-3">
            {saved ? <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1"><CheckCircle2 size={14} />{t('aiprof_saved')}</span> : null}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-white text-sm font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('aiprof_btn_save')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}


export default AIConfigTab;
