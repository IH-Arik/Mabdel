import { AlertTriangle, Plus, X } from 'lucide-react';
import { LABEL } from '../../shared';
import SectionCard from './SectionCard';

export default function EmergencySection({
  callSettings, newEmergencyKeyword, setNewEmergencyKeyword, updateField,
  addEmergencyKeyword, removeEmergencyKeyword, t,
}) {
  return (
          <SectionCard icon={AlertTriangle} title={t('aiprof_hdr_emergency_keywords')} description={t('aiprof_emergency_keywords_desc')}>
            <p className="text-xs text-[#70829B] mb-2">{t('aiprof_emergency_keywords_builtin_hint')}</p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                maxLength={80}
                placeholder={t('aiprof_ph_emergency_keyword')}
                value={newEmergencyKeyword}
                onChange={(event) => setNewEmergencyKeyword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addEmergencyKeyword();
                  }
                }}
                className="flex-1 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-[#9333ea]/50"
              />
              <button
                type="button"
                id="aiprof-emergency-add"
                onClick={addEmergencyKeyword}
                className="px-3 rounded-xl bg-[#131A24] border border-[#243041] text-[#9BA7BB] hover:text-white flex items-center gap-1 text-xs font-semibold cursor-pointer"
              >
                <Plus size={14} />
                {t('aiprof_btn_add_keyword')}
              </button>
            </div>
            {(callSettings?.emergency_keywords || []).length === 0 ? (
              <p className="text-xs text-[#70829B]">{t('aiprof_emergency_keywords_empty')}</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {(callSettings?.emergency_keywords || []).map((keyword) => (
                  <span
                    key={keyword}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#131A24] border border-[#243041] text-[#9BA7BB] flex items-center gap-1.5"
                  >
                    {keyword}
                    <button type="button" onClick={() => removeEmergencyKeyword(keyword)} title={t('aiprof_btn_remove_keyword')} className="cursor-pointer hover:text-rose-400">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="pt-4 mt-4 border-t border-[#243041] space-y-3">
              <div>
                <label className={LABEL}>{t('aiprof_lbl_emergency_mode')}</label>
                <div className="space-y-2 mt-1.5">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="emergency_response_mode"
                      checked={(callSettings?.emergency_response_mode || 'take_message') === 'take_message'}
                      onChange={() => updateField('emergency_response_mode', 'take_message')}
                      className="w-4 h-4 mt-0.5 accent-[#9333ea]"
                    />
                    <span>
                      <span className="text-white text-sm font-semibold block">{t('aiprof_emergency_mode_message_title')}</span>
                      <span className="text-[#A4B0B7] text-xs">{t('aiprof_emergency_mode_message_hint')}</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="emergency_response_mode"
                      checked={callSettings?.emergency_response_mode === 'direct_to_911'}
                      onChange={() => updateField('emergency_response_mode', 'direct_to_911')}
                      className="w-4 h-4 mt-0.5 accent-[#9333ea]"
                    />
                    <span>
                      <span className="text-white text-sm font-semibold block">{t('aiprof_emergency_mode_911_title')}</span>
                      <span className="text-[#A4B0B7] text-xs">{t('aiprof_emergency_mode_911_hint')}</span>
                    </span>
                  </label>
                </div>
              </div>
              <div>
                <label className={LABEL} htmlFor="aiprof-emergency-alert-phone">{t('aiprof_lbl_emergency_alert_phone')}</label>
                <input
                  id="aiprof-emergency-alert-phone"
                  type="tel"
                  maxLength={32}
                  placeholder={t('aiprof_ph_emergency_alert_phone')}
                  value={callSettings?.emergency_alert_phone || ''}
                  onChange={(event) => updateField('emergency_alert_phone', event.target.value)}
                  className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-[#9333ea]/50"
                />
                <p className="text-[#70829B] text-xs mt-1">{t('aiprof_emergency_alert_phone_hint')}</p>
              </div>
            </div>
          </SectionCard>
  );
}
