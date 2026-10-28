import { MessageSquare } from 'lucide-react';
import { LABEL } from '../../shared';
import { SMS_WORDING_KINDS } from './constants';
import SectionCard from './SectionCard';
import AiFieldTools from './AiFieldTools';

export default function SmsWordingSection({ callSettings, updateWordingField, t }) {
  return (
          <SectionCard icon={MessageSquare} title={t('aiprof_hdr_sms_wording')} description={t('aiprof_sms_wording_desc')}>
            <div className="space-y-3">
              {SMS_WORDING_KINDS.map((kind) => (
                <div key={kind.key}>
                  <label className={LABEL} htmlFor={`aiprof-wording-${kind.key}`}>{kind.label}</label>
                  <input
                    id={`aiprof-wording-${kind.key}`}
                    type="text"
                    maxLength={300}
                    placeholder={kind.builtIn}
                    value={callSettings?.sms_wording?.[kind.key] || ''}
                    onChange={(event) => updateWordingField(kind.key, event.target.value)}
                    className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-[#9333ea]/50"
                  />
                  <AiFieldTools
                    fieldKey={`sms_${kind.key}`}
                    value={callSettings?.sms_wording?.[kind.key] || ''}
                    onChange={(text) => updateWordingField(kind.key, text)}
                    businessType={callSettings?.business_type}
                    t={t}
                  />
                </div>
              ))}
            </div>
            <p className="text-[#4A5568] text-xs mt-3">{t('aiprof_sms_wording_placeholders_hint')}</p>
          </SectionCard>
  );
}
