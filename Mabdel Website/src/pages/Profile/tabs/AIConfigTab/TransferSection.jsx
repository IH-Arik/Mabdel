import { PhoneForwarded } from 'lucide-react';
import SectionCard from './SectionCard';

export default function TransferSection({ callSettings, updateField, t }) {
  return (
          <SectionCard icon={PhoneForwarded} title={t('aiprof_hdr_transfer')} description={t('aiprof_transfer_desc')}>
            <input
              type="tel"
              maxLength={32}
              placeholder="+1 555 000 1111"
              value={callSettings?.transfer_number || ''}
              onChange={(event) => updateField('transfer_number', event.target.value)}
              aria-label={t('aiprof_hdr_transfer')}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50"
            />
          </SectionCard>
  );
}
