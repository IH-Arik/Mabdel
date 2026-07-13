import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Send, UserRound } from 'lucide-react';
import { smartflowApi } from '../../../api/services';
import { INPUT } from '../shared';

const getApiData = (response) => response?.data?.data || response?.data || response || {};

const normalizeMessage = (message) => ({
  ...message,
  id: message?.id || `${Date.now()}-${Math.random()}`,
  sender_type: message?.sender_type || 'support',
  sender_name: message?.sender_name || 'Support',
  content: message?.content || '',
  created_at: message?.created_at || new Date().toISOString(),
});

function SupportTab() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [supportTyping, setSupportTyping] = useState(false);
  const listRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const isMountedRef = useRef(false);

  const loadSupportState = useCallback(async () => {
    const [sessionResponse, messagesResponse] = await Promise.all([
      smartflowApi.getSupportSession(),
      smartflowApi.getSupportMessages(),
    ]);

    const sessionData = getApiData(sessionResponse);
    const messagesData = getApiData(messagesResponse);
    const nextSession = messagesData?.session || sessionData || null;
    const nextMessages = Array.isArray(messagesData?.items)
      ? messagesData.items.map(normalizeMessage)
      : Array.isArray(nextSession?.latest_messages)
        ? nextSession.latest_messages.map(normalizeMessage)
        : [];

    setSession(nextSession);
    setMessages(nextMessages);
    setSupportTyping(Boolean(nextSession?.support_typing));
    setError('');
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadSupportState()
      .catch((loadError) => {
        setSession(null);
        setMessages([]);
        setError(loadError?.response?.data?.message || 'Could not load support chat.');
      })
      .finally(() => setLoading(false));

    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
    };
  }, [loadSupportState]);

  useEffect(() => {
    if (!isMountedRef.current) return undefined;

    if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = window.setInterval(() => {
      loadSupportState().catch((pollError) => {
        setError(pollError?.response?.data?.message || 'Could not refresh support chat.');
      });
    }, 1000);

    return () => {
      if (pollIntervalRef.current) window.clearInterval(pollIntervalRef.current);
    };
  }, [loadSupportState]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, supportTyping]);

  const quickReplies = useMemo(
    () => (Array.isArray(session?.quick_replies) ? session.quick_replies : []),
    [session],
  );

  async function send() {
    const content = newMsg.trim();
    if (!content) return;

    setSending(true);
    setError('');
    try {
      const response = await smartflowApi.sendSupportMessage({ content });
      const data = getApiData(response);
      const createdMessage = normalizeMessage(
        data?.message || { content, sender_type: 'user', sender_name: 'You' },
      );

      setMessages((current) => [...current, createdMessage]);
      setNewMsg('');
      setSupportTyping(Boolean(data?.support_typing));
    } catch (sendError) {
      setError(sendError?.response?.data?.message || 'Support message failed.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#A4B0B7]">Chat with our support team directly.</p>

      {session ? (
        <div className="rounded-2xl border border-[#243041] bg-[#0A1019] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#11C7E5]/10 text-[#11C7E5]">
              <UserRound size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">{session?.agent?.display_name || 'Support'}</p>
              <p className="text-xs capitalize text-[#A4B0B7]">{session?.topic || 'general'} support</p>
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">
          <AlertTriangle size={14} />
          <span>{error}</span>
        </div>
      ) : null}

      <div
        ref={listRef}
        className="min-h-64 max-h-80 space-y-3 overflow-y-auto rounded-2xl border border-[#243041] bg-[#0A1019] p-4"
      >
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="animate-spin text-[#11C7E5]" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#A4B0B7]">No messages yet. Send a message to start.</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs rounded-2xl px-4 py-2.5 text-sm ${
                  message.sender_type === 'user'
                    ? 'bg-[#11C7E5] text-[#02080B]'
                    : 'border border-[#243041] bg-[#131A24] text-white'
                }`}
              >
                {message.content}
                {message.attachment_url ? (
                  <a
                    href={message.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className={`mt-2 block text-xs underline ${
                      message.sender_type === 'user' ? 'text-[#02080B]' : 'text-[#11C7E5]'
                    }`}
                  >
                    Open attachment
                  </a>
                ) : null}
              </div>
            </div>
          ))
        )}

        {supportTyping ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-[#243041] bg-[#131A24] px-4 py-2.5 text-sm text-white">
              Support is typing...
            </div>
          </div>
        ) : null}
      </div>

      {quickReplies.length ? (
        <div className="flex flex-wrap gap-2">
          {quickReplies.map((reply, index) => (
            <button
              key={`${reply?.value || reply?.label || 'reply'}-${index}`}
              onClick={() => setNewMsg(reply?.value || reply?.label || '')}
              className="cursor-pointer rounded-xl border border-[#11C7E5]/20 bg-[#11C7E5]/10 px-3 py-1.5 text-xs font-semibold text-[#11C7E5] transition-colors hover:bg-[#11C7E5]/20"
            >
              {reply?.label || reply?.value || 'Quick reply'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex gap-3">
        <input
          value={newMsg}
          onChange={(event) => setNewMsg(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Type your message..."
          className={`${INPUT} flex-1`}
        />
        <button
          onClick={send}
          disabled={sending || !newMsg.trim()}
          className="cursor-pointer rounded-xl bg-[#11C7E5] px-5 py-3 font-bold text-[#02080B] transition-colors disabled:opacity-60"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

export default SupportTab;
