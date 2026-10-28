import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X, Loader2 } from 'lucide-react';
import { smartflowApi } from '../../../../api/services';

export default function TestAIModal({ onClose, t }) {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]); // { id, role: 'ai' | 'user', text }
  const [input, setInput] = useState('');
  const [starting, setStarting] = useState(true);
  const [sending, setSending] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);
  const sessionIdRef = useRef(null);

  const scrollToBottom = () => {
    window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  };

  const startSession = useCallback(async () => {
    setStarting(true);
    setError('');
    setEnded(false);
    setMessages([]);
    try {
      const response = await smartflowApi.startAICallTest();
      const data = response.data?.data || {};
      setSessionId(data.session_id || null);
      sessionIdRef.current = data.session_id || null;
      setMessages([{ id: 'greeting', role: 'ai', text: data.greeting || '' }]);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiprof_test_err_start'));
    } finally {
      setStarting(false);
      scrollToBottom();
    }
  }, [t]);

  useEffect(() => {
    startSession();
    return () => {
      // Best-effort cleanup — don't block closing the modal on it.
      if (sessionIdRef.current) {
        smartflowApi.endAICallTest(sessionIdRef.current).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !sessionId || ended) return;
    setInput('');
    setError('');
    const userMessage = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);
    scrollToBottom();
    try {
      const response = await smartflowApi.sendAICallTestMessage(sessionId, text);
      const data = response.data?.data || {};
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'ai', text: data.reply || '' }]);
      if (data.ended) setEnded(true);
    } catch (err) {
      setError(err?.response?.data?.message || t('aiprof_test_err_send'));
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const handleNewTest = () => {
    if (sessionIdRef.current) {
      smartflowApi.endAICallTest(sessionIdRef.current).catch(() => {});
    }
    setSessionId(null);
    sessionIdRef.current = null;
    startSession();
  };

  const handleClose = () => {
    if (sessionIdRef.current) {
      smartflowApi.endAICallTest(sessionIdRef.current).catch(() => {});
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg bg-[#0A1019] border border-[#243041] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-[#243041]">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2">
              <MessageSquare size={16} className="text-[#9333ea]" />
              {t('aiprof_test_modal_title')}
            </h3>
            <p className="text-[#A4B0B7] text-xs mt-1">{t('aiprof_test_modal_desc')}</p>
          </div>
          <button type="button" onClick={handleClose} className="text-[#A4B0B7] hover:text-white cursor-pointer shrink-0">
            <X size={18} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
          {starting ? (
            <div className="flex items-center justify-center h-40 gap-2 text-[#A4B0B7] text-sm">
              <Loader2 size={16} className="animate-spin text-[#9333ea]" />
              {t('aiprof_test_starting')}
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm ${
                    message.role === 'user'
                      ? 'bg-[#9333ea]/20 border border-[#9333ea]/30 text-white rounded-br-none'
                      : 'bg-[#131A24] border border-[#243041] text-white rounded-bl-none'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))
          )}
          {sending ? (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 rounded-2xl rounded-bl-none bg-[#131A24] border border-[#243041] text-[#A4B0B7] text-sm flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
              </div>
            </div>
          ) : null}
          {ended ? (
            <p className="text-center text-[#4A5568] text-xs pt-2">{t('aiprof_test_ended')}</p>
          ) : null}
        </div>

        {error ? <div className="mx-4 mb-2 bg-rose-950/30 border border-rose-500/20 text-rose-300 text-xs rounded-xl p-2.5">{error}</div> : null}

        <div className="p-4 border-t border-[#243041] space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              disabled={starting || ended}
              placeholder={t('aiprof_test_input_ph')}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSend();
                }
              }}
              className="flex-1 bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-2.5 outline-none focus:border-[#9333ea]/50 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={starting || sending || ended || !input.trim()}
              className="p-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-white rounded-xl transition-all cursor-pointer disabled:opacity-60"
              title={t('aiprof_test_btn_send')}
            >
              <Send size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={handleNewTest}
              disabled={starting}
              className="text-xs font-bold text-[#9333ea] hover:underline cursor-pointer disabled:opacity-60"
            >
              {t('aiprof_test_btn_new')}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 bg-[#131A24] border border-[#243041] hover:border-[#9333ea]/50 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              {t('aiprof_test_btn_close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
