import { Ban } from 'lucide-react';
import SectionCard from './SectionCard';
import AiFieldTools from './AiFieldTools';

export default function CancellationPolicySection({ callSettings, updateField, t }) {
  return (
          <SectionCard icon={Ban} title={t('aiprof_hdr_cancellation_policy')} description={t('aiprof_cancellation_policy_desc')}>
            <textarea
              rows={2}
              maxLength={500}
              placeholder={t('aiprof_ph_cancellation_policy')}
              value={callSettings?.cancellation_policy || ''}
              onChange={(event) => updateField('cancellation_policy', event.target.value)}
              aria-label={t('aiprof_hdr_cancellation_policy')}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
            <AiFieldTools fieldKey="cancellation_policy" value={callSettings?.cancellation_policy || ''} onChange={(text) => updateField('cancellation_policy', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>
  );
}
