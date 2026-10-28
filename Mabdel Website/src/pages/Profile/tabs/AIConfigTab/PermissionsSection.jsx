import { ShieldCheck } from 'lucide-react';
import { AI_CAPABILITIES } from './constants';
import SectionCard from './SectionCard';

export default function PermissionsSection({ callSettings, updateCapability, t }) {
  return (
          <SectionCard icon={ShieldCheck} title={t('aiprof_hdr_permissions')} description={t('aiprof_permissions_desc')}>
            <div className="space-y-3">
              {AI_CAPABILITIES.map((capability) => {
                const effectiveDefault = capability.key === 'schedule'
                  ? (callSettings?.require_meeting_approval ? 'human_approval_required' : 'ai_allowed')
                  : capability.key === 'reschedule'
                    ? (callSettings?.require_approval_for_reschedules ? 'human_approval_required' : 'ai_allowed')
                    : capability.key === 'cancel'
                      ? (callSettings?.require_approval_for_cancellations ? 'human_approval_required' : 'ai_allowed')
                      : 'ai_allowed';
                const value = callSettings?.ai_capabilities?.[capability.key] || effectiveDefault;
                return (
                  <div key={capability.key} className="flex items-center justify-between gap-3 rounded-xl border border-[#243041] bg-[#131A24] px-4 py-3">
                    <span className="text-white text-sm font-semibold">{capability.label || t(capability.labelKey)}</span>
                    <select
                      aria-label={capability.label || t(capability.labelKey)}
                      value={value}
                      onChange={(event) => updateCapability(capability.key, event.target.value)}
                      className="bg-[#0A1019] border border-[#243246] rounded-lg text-xs text-white px-2.5 py-2 outline-none focus:border-[#9333ea]/50"
                    >
                      <option value="disabled">{t('aiprof_perm_disabled')}</option>
                      <option value="ai_allowed">{t('aiprof_perm_ai_allowed')}</option>
                      {capability.supportsApproval ? (
                        <option value="human_approval_required">{t('aiprof_perm_human_approval_required')}</option>
                      ) : null}
                    </select>
                  </div>
                );
              })}
            </div>
          </SectionCard>
  );
}
