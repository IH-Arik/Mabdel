import { useRef, useState } from 'react';
import { AlertTriangle, Loader2, Mic, Send, Sparkles, Square, Undo2, X } from 'lucide-react';
import { smartflowApi } from '../../api/services';
import { channelMeta } from '../../constants/channels';
import { getApiData } from './inboxUtils';
import useDictation from './useDictation';

const TYPING_PING_MS = 3000;

const REWRITE_ACTIONS = ['improve', 'shorter', 'friendlier', 'professional'];
const TRANSLATE_LANGUAGES = ['English', 'Bangla', 'Hindi', 'Urdu', 'Arabic', 'Spanish', 'French', 'Portuguese', 'Turkish', 'Russian', 'Chinese', 'Japanese'];

const chipClass =
  'inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#9333ea]/25 bg-[#9333ea]/10 px-2.5 py-1 text-[11px] font-bold text-[#d8b4fe] hover:bg-[#9333ea]/20 disabled:cursor-not-allowed disabled:opacity-50';

// Draft a reply from the conversation, or rework what the user has typed.
function AiWriter({ conversationId, draft, onDraft, onError, t }) {
  const [busy, setBusy] = useState('');
  const [previous, setPrevious] = useState(null);

  const run = async (action, language = '') => {
    setBusy(action);
    try {
      const response = await smartflowApi.composeMessage({ action, draft, conversation_id: conversationId, language });
      const text = getApiData(response)?.text;
      if (text) {
        setPrevious(draft);
        onDraft(text);
      }
    } catch (error) {
      onError(error?.response?.data?.message || t('conv_err_ai_writer'));
    } finally {
      setBusy('');
    }
  };

  const hasDraft = Boolean(draft.trim());
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('conv_ai_writer')}>
      <button type="button" onClick={() => run('draft_reply')} disabled={Boolean(busy)} className={chipClass}>
        {busy === 'draft_reply' ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
        {t('conv_ai_draft_reply')}
      </button>
      {REWRITE_ACTIONS.map((action) => (
        <button key={action} type="button" onClick={() => run(action)} disabled={!hasDraft || Boolean(busy)} className={chipClass}>
          {busy === action ? <Loader2 size={11} className="animate-spin" /> : null}
          {t(`conv_ai_${action}`)}
        </button>
      ))}
      <label className="sr-only" htmlFor="conv-translate">{t('conv_ai_translate')}</label>
      <select
        id="conv-translate"
        value=""
        disabled={!hasDraft || Boolean(busy)}
        onChange={(event) => event.target.value && run('translate', event.target.value)}
        className="cursor-pointer rounded-lg border border-[#9333ea]/25 bg-[#12091f] px-2 py-1 text-[11px] font-bold text-[#d8b4fe] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{busy === 'translate' ? t('conv_ai_working') : t('conv_ai_translate')}</option>
        {TRANSLATE_LANGUAGES.map((language) => (
          <option key={language} value={language}>
            {language}
          </option>
        ))}
      </select>
      {previous !== null ? (
        <button
          type="button"
          onClick={() => {
            onDraft(previous);
            setPrevious(null);
          }}
          className="inline-flex cursor-pointer items-center gap-1 px-1 text-[11px] font-bold text-slate-400 hover:text-white"
        >
          <Undo2 size={11} />
          {t('conv_ai_undo')}
        </button>
      ) : null}
    </div>
  );
}

export default function Composer({
  conversation,
  value,
  onChange,
  onSend,
  sending,
  replyTo,
  onCancelReply,
  replyWindowClosed,
  onError,
  t,
}) {
  const lastTypingPingRef = useRef(0);
  const stopTypingTimerRef = useRef(null);
  const label = channelMeta(conversation?.platform).label;
  const dictation = useDictation({
    onText: (text) => onChange(value.trim() ? `${value.trim()} ${text}` : text),
    onError,
    t,
  });

  const pingTyping = (text) => {
    if (!conversation?.id) return;
    const now = Date.now();
    // One "typing" signal every few seconds is enough; one per keystroke floods the API.
    if (text.trim() && now - lastTypingPingRef.current > TYPING_PING_MS) {
      lastTypingPingRef.current = now;
      smartflowApi.setTypingStatus(conversation.id, { is_typing: true, actor_type: 'user', preview_text: null }).catch(() => {});
    }
    clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(() => {
      lastTypingPingRef.current = 0;
      smartflowApi.setTypingStatus(conversation.id, { is_typing: false, actor_type: 'user', preview_text: null }).catch(() => {});
    }, TYPING_PING_MS);
  };

  const submit = (event) => {
    event?.preventDefault();
    if (!value.trim() || sending) return;
    clearTimeout(stopTypingTimerRef.current);
    onSend();
  };

  return (
    <div className="space-y-2 border-t border-[#243041]/40 bg-[#0c101b]/80 p-3 md:p-4">
      <AiWriter conversationId={conversation?.id} draft={value} onDraft={onChange} onError={onError} t={t} />

      {replyWindowClosed ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>{t('conv_reply_window_closed', { channel: label })}</span>
        </div>
      ) : null}

      {replyTo ? (
        <div className="flex items-center justify-between rounded-lg border-l-2 border-[#9333ea] bg-slate-900 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-[10px] font-bold text-[#c084fc]">
              {replyTo.direction === 'outbound'
                ? t('conv_replying_to_self')
                : t('conv_replying_to_them', { name: conversation?.contact_name || t('conv_them_fallback') })}
            </p>
            <p className="truncate text-xs text-slate-400">{replyTo.content}</p>
          </div>
          <button type="button" onClick={onCancelReply} aria-label={t('conv_close')} className="cursor-pointer p-1 text-slate-500 hover:text-white">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <form onSubmit={submit} className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            pingTyping(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) submit(event);
          }}
          placeholder={t('conv_reply_placeholder', { channel: label })}
          aria-label={t('conv_reply_placeholder', { channel: label })}
          rows={2}
          className="max-h-40 min-h-[48px] flex-1 resize-none rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 text-[13px] text-white placeholder-slate-600 focus:border-[#9333ea]/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={dictation.toggle}
          disabled={dictation.transcribing}
          aria-pressed={dictation.recording}
          aria-label={dictation.recording ? t('conv_stop_recording') : t('conv_dictate')}
          title={dictation.recording ? t('conv_stop_recording') : t('conv_dictate')}
          className={`flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border transition-colors disabled:opacity-60 ${
            dictation.recording ? 'border-rose-500/60 bg-rose-950/40 text-rose-300' : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-[#c084fc]'
          }`}
        >
          {dictation.transcribing ? <Loader2 size={16} className="animate-spin" /> : dictation.recording ? <Square size={14} /> : <Mic size={16} />}
        </button>
        <button
          type="submit"
          disabled={sending || !value.trim()}
          aria-label={t('conv_send_message')}
          className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#9333ea] text-white shadow-lg transition-all hover:bg-[#a855f7] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
      <p className="hidden text-[10px] text-slate-600 md:block">{t('conv_enter_to_send')}</p>
    </div>
  );
}
