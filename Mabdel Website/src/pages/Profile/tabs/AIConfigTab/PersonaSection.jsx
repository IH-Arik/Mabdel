import { Loader2, Sparkles } from 'lucide-react';
import { LABEL } from '../../shared';
import { BUSINESS_TYPE_OPTIONS } from './constants';
import SectionCard from './SectionCard';

export default function PersonaSection({
  callSettings, businessTypeIsOther, setBusinessTypeIsOther, generatingAll, generateAllError,
  updateField, generateAllFieldsForBusinessType, t,
}) {
  return (
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
                if (!nextIsOther && event.target.value) generateAllFieldsForBusinessType(event.target.value);
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
                onBlur={(event) => generateAllFieldsForBusinessType(event.target.value)}
                className="w-full mt-2 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50"
              />
            ) : null}
            {generatingAll ? (
              <p className="text-[#A78BFA] text-xs mt-2 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />{t('aiprof_generating_all')}</p>
            ) : null}
            {generateAllError ? <p className="text-rose-400 text-xs mt-2">{generateAllError}</p> : null}
          </SectionCard>
  );
}
