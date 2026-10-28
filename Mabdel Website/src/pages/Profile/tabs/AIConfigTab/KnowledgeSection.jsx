import { BookOpen } from 'lucide-react';
import ReceptionistDocuments from '../ReceptionistDocuments';
import SectionCard from './SectionCard';
import AiFieldTools from './AiFieldTools';

export default function KnowledgeSection({ callSettings, knowledgeLength, updateField, t }) {
  return (
          <SectionCard icon={BookOpen} title={t('aiprof_hdr_knowledge')} description={t('aiprof_knowledge_desc')}>
            <textarea
              rows={7}
              maxLength={8000}
              placeholder={t('aiprof_ph_knowledge')}
              value={callSettings?.knowledge_base || ''}
              onChange={(event) => updateField('knowledge_base', event.target.value)}
              aria-label={t('aiprof_hdr_knowledge')}
              className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none focus:border-[#9333ea]/50 resize-y"
            />
            <p className="text-[#4A5568] text-xs mt-1 text-right">{knowledgeLength}/8000</p>
            <ReceptionistDocuments />
            <AiFieldTools fieldKey="knowledge_base" value={callSettings?.knowledge_base || ''} onChange={(text) => updateField('knowledge_base', text)} businessType={callSettings?.business_type} t={t} />
          </SectionCard>
  );
}
