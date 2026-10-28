import { Phone, PhoneOff, PhoneOutgoing } from 'lucide-react';
import SectionCard from './SectionCard';
import AiFieldTools from './AiFieldTools';

export default function GreetingsSection({ callSettings, updateField, t }) {
  return (
    <>
          <SectionCard icon={Phone} title={t('aiprof_hdr_greeting_inbound')} description={t('aiprof_greeting_inbound_desc')}>
            <textarea
              rows={2}
              maxLength={500}
              placeholder={t('aiprof_ph_greeting_default')}
              value={callSettings?.greeting_inbound || ''}
              onChange={(event) => updateField('greeting_inbound', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
            <AiFieldTools fieldKey="greeting_inbound" value={callSettings?.greeting_inbound || ''} onChange={(text) => updateField('greeting_inbound', text)} businessType={callSettings?.business_type} t={t} />
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
            <AiFieldTools fieldKey="greeting_outbound" value={callSettings?.greeting_outbound || ''} onChange={(text) => updateField('greeting_outbound', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>

          <SectionCard icon={PhoneOff} title={t('aiprof_hdr_closing_message')} description={t('aiprof_closing_message_desc')}>
            <textarea
              rows={2}
              maxLength={500}
              placeholder={t('aiprof_ph_closing_message')}
              value={callSettings?.closing_message || ''}
              onChange={(event) => updateField('closing_message', event.target.value)}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-none"
            />
            <AiFieldTools fieldKey="closing_message" value={callSettings?.closing_message || ''} onChange={(text) => updateField('closing_message', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>
    </>
  );
}
