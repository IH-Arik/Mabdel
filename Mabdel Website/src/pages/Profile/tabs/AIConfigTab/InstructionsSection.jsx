import { Sparkles } from 'lucide-react';
import SectionCard from './SectionCard';
import AiFieldTools from './AiFieldTools';

export default function InstructionsSection({ callSettings, instructionsLength, updateField, t }) {
  return (
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
            <AiFieldTools fieldKey="custom_instructions" value={callSettings?.custom_instructions || ''} onChange={(text) => updateField('custom_instructions', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>
  );
}
