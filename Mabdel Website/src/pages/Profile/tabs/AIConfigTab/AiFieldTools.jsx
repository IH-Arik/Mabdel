import { useState } from 'react';
import { Loader2, Mic, Sparkles, Zap } from 'lucide-react';
import { smartflowApi } from '../../../../api/services';
import useDictation from '../../../../components/inbox/useDictation';

// The three AI tools (generate / dictate / improve) for one text field. Self-contained:
// each instance owns its own recorder and loading state, so one field's "Generate" spinner
// never affects the others.
export default function AiFieldTools({ fieldKey, value, onChange, businessType, t }) {
  const [busy, setBusy] = useState(null); // 'generate' | 'improve' | null
  const [error, setError] = useState('');
  const { recording, transcribing, toggle } = useDictation({
    onText: (text) => onChange(value ? `${value} ${text}` : text),
    onError: setError,
    t,
  });

  async function runAction(kind) {
    if (kind === 'generate' && value.trim() && !window.confirm(t('aiprof_confirm_overwrite_field'))) return;
    if (kind === 'improve' && !value.trim()) return;
    setBusy(kind);
    setError('');
    try {
      const response = await smartflowApi.composeReceptionistFields({
        fields: [fieldKey],
        action: kind === 'generate' ? 'draft' : 'improve',
        business_type: businessType || '',
        current_texts: kind === 'improve' ? { [fieldKey]: value } : {},
      });
      const text = response?.data?.data?.[fieldKey];
      if (text) onChange(text);
      else setError(t('aiprof_ai_unavailable'));
    } catch (err) {
      setError(err?.response?.data?.message || t('aiprof_ai_unavailable'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => runAction('generate')}
        disabled={busy !== null}
        title={t('aiprof_btn_generate_hint')}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#131A24] border border-[#243041] text-[#A78BFA] hover:border-[#9333ea]/50 text-xs font-semibold cursor-pointer disabled:opacity-50"
      >
        {busy === 'generate' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {t('aiprof_btn_generate')}
      </button>
      <button
        type="button"
        onClick={toggle}
        disabled={transcribing}
        title={t('aiprof_btn_dictate_hint')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer disabled:opacity-50 ${
          recording ? 'bg-rose-500/10 border-rose-500/40 text-rose-400' : 'bg-[#131A24] border-[#243041] text-[#9BA7BB] hover:border-[#9333ea]/50'
        }`}
      >
        {transcribing ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
        {recording ? t('aiprof_btn_dictate_stop') : t('aiprof_btn_dictate')}
      </button>
      <button
        type="button"
        onClick={() => runAction('improve')}
        disabled={busy !== null || !value.trim()}
        title={t('aiprof_btn_improve_hint')}
        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#131A24] border border-[#243041] text-[#9BA7BB] hover:border-[#9333ea]/50 text-xs font-semibold cursor-pointer disabled:opacity-50"
      >
        {busy === 'improve' ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
        {t('aiprof_btn_improve')}
      </button>
      {error ? <span className="text-rose-400 text-[11px]">{error}</span> : null}
    </div>
  );
}
