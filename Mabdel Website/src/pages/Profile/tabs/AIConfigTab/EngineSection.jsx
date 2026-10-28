import { CheckCircle2, Zap } from 'lucide-react';
import SectionCard from './SectionCard';

export default function EngineSection({ engine, updateField, t }) {
  return (
          <SectionCard icon={Zap} title={t('aiprof_hdr_engine')} description={t('aiprof_engine_desc')}>
            <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label={t('aiprof_hdr_engine')}>
              {[
                { key: 'realtime', title: t('aiprof_engine_realtime'), body: t('aiprof_engine_realtime_desc') },
                { key: 'classic', title: t('aiprof_engine_classic'), body: t('aiprof_engine_classic_desc') },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={engine === option.key}
                  onClick={() => updateField('voice_engine', option.key)}
                  className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                    engine === option.key ? 'bg-[#9333ea]/10 border-[#9333ea]/50' : 'bg-[#131A24] border-[#243041] hover:border-[#9333ea]/30'
                  }`}
                >
                  <p className="text-white font-semibold text-sm flex items-center justify-between">
                    {option.title}
                    {engine === option.key ? <CheckCircle2 size={14} className="text-[#9333ea]" /> : null}
                  </p>
                  <p className="text-[#A4B0B7] text-xs mt-1">{option.body}</p>
                </button>
              ))}
            </div>
          </SectionCard>
  );
}
