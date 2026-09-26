import { useRef, useState } from 'react';
import { AlertTriangle, Loader2, Send, Sparkles, X } from 'lucide-react';
import { smartflowApi } from '../../api/services';
import { channelMeta } from '../../constants/channels';
import { getApiData } from './inboxUtils';

const TYPING_PING_MS = 3000;

function AiSuggestions({ recentMessages, contactName, onUse, t }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const fallback = [t('conv_fallback_reply_1'), t('conv_fallback_reply_2'), t('conv_fallback_reply_3')];
    // Give the model the actual conversation, otherwise the replies are generic.
    const transcript = recentMessages
      .filter((message) => message.content)
      .slice(-8)
      .map((message) => `${message.direction === 'outbound' ? 'Business' : contactName || 'Customer'}: ${message.content}`)
      .join('\n');
    try {
      const response = await smartflowApi.aiChat(
        `Suggest 3 short, friendly replies the business could send next. One per line, no numbering, no quotes.\n\n${transcript}`,
        { response_mode: 'text' },
      );
      const data = getApiData(response);
      const text = data?.ai_message?.content || data?.response || '';
      const lines = text
        .split('\n')
        .map((line) => line.replace(/^[-*0-9.)\s]+/, '').replace(/^"|"$/g, '').trim())
        .filter(Boolean)
        .slice(0, 3);
      setSuggestions(lines.length ? lines : fallback);
    } catch {
      setSuggestions(fallback);
    } finally {
      setLoading(false);
    }
  };

  if (!suggestions.length) {
    return (
      <button
        type="button"
        onClick={generate}
        disabled={loading}
        className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[#c084fc] hover:underline disabled:opacity-60"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        {loading ? t('conv_generating_suggestions') : t('conv_ai_reply_suggestions')}
      </button>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-bold text-[#c084fc]">
          <Sparkles size={11} />
          {t('conv_ai_suggestions')}
        </span>
        <button type="button" onClick={() => setSuggestions([])} aria-label={t('conv_close')} className="cursor-pointer text-[#A4B0B7] hover:text-white">
          <X size={12} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <button
            key={`${suggestion}-${index}`}
            type="button"
            onClick={() => {
              onUse(suggestion);
              setSuggestions([]);
            }}
            className="cursor-pointer rounded-xl border border-[#9333ea]/25 bg-[#9333ea]/10 px-3 py-1.5 text-left text-xs font-semibold text-[#d8b4fe] hover:bg-[#9333ea]/20"
          >
            {suggestion}
          </button>
        ))}
      </div>
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
  recentMessages,
  replyWindowClosed,
  t,
}) {
  const lastTypingPingRef = useRef(0);
  const stopTypingTimerRef = useRef(null);
  const label = channelMeta(conversation?.platform).label;

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
      <AiSuggestions recentMessages={recentMessages} contactName={conversation?.contact_name} onUse={onChange} t={t} />

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
