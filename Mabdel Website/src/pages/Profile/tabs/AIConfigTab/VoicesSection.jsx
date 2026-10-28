import { CheckCircle2, Loader2, Mic } from 'lucide-react';
import SectionCard from './SectionCard';

export default function VoicesSection({ voices, loadingVoices, callSettings, updateField, t }) {
  return (
          <SectionCard icon={Mic} title={t('aiprof_hdr_voices')}>
            {loadingVoices ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#9333ea]" /></div>
            ) : voices.length ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {voices.map((voice) => {
                  const voiceId = voice.id || voice.voice_id || voice.name;
                  const isSelected = (callSettings?.voice_id || 'female_warm') === voiceId;
                  return (
                    <button
                      key={voiceId}
                      type="button"
                      onClick={() => updateField('voice_id', voiceId)}
                      className={`text-left p-3 rounded-xl border transition-colors cursor-pointer ${
                        isSelected ? 'bg-[#9333ea]/10 border-[#9333ea]/50' : 'bg-[#131A24] border-[#243041] hover:border-[#9333ea]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-white font-semibold text-sm">{voice.label || voice.name || voice.voice_name}</p>
                        {isSelected ? <CheckCircle2 size={14} className="text-[#9333ea] shrink-0" /> : null}
                      </div>
                      {(voice.style || voice.language) && (
                        <p className="text-[#A4B0B7] text-xs mt-0.5 capitalize">{voice.style || voice.language}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : <p className="text-[#A4B0B7] text-sm">{t('aiprof_no_voices')}</p>}
          </SectionCard>
  );
}
