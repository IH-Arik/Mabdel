import { useCallback, useEffect, useRef, useState } from 'react';
import { smartflowApi } from '../api/services';
import {
  AlertTriangle, Archive, Bot, CheckCheck, Filter,
  Info, Loader2, MessageSquare, Mic, MicOff, MoreVertical,
  Paperclip, Phone, Search, Send, Sparkles, Video, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const PLATFORM_COLORS = {
  whatsapp: '#25D366', instagram: '#E4405F', facebook: '#1877F2',
  telegram: '#229ED9', sms: '#A855F7', email: '#F59E0B',
};

const PLATFORM_BADGE = ({ platform }) => (
  <span className="text-[9px] font-bold uppercase tracking-widest"
    style={{ color: PLATFORM_COLORS[platform] || '#11C7E5' }}>
    {platform || 'chat'}
  </span>
);

// ── Voice Recorder Hook ──────────────────────────────────────────────────────
function useVoiceRecorder(onTranscript) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = e => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setLoading(true);
        try {
          const res = await smartflowApi.voiceChat(blob);
          const text = res.data?.data?.transcript || res.data?.transcript || '';
          if (text) onTranscript(text);
        } catch { /* ignore transcription errors */ }
        finally { setLoading(false); }
      };
      recorder.start();
      mediaRef.current = recorder;
      setRecording(true);
    } catch { alert('Microphone access denied.'); }
  }

  function stop() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  return { recording, loading, start, stop };
}

// ── Conversation Sidebar Item ─────────────────────────────────────────────────
function ConvItem({ conv, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full p-4 flex gap-3 hover:bg-slate-900/40 border-b border-[#243041]/10 last:border-none transition-all text-left ${selected ? 'bg-[#11C7E5]/10 border-l-4 border-l-[#11C7E5]' : ''}`}
    >
      <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 shrink-0 flex items-center justify-center text-[#11C7E5] font-black uppercase text-sm">
        {conv.contact_name?.[0] || 'C'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline gap-1">
          <h4 className="font-bold text-white text-xs truncate">{conv.contact_name || 'Anonymous'}</h4>
          <span className="text-[9px] text-slate-500 font-bold shrink-0">
            {conv.last_message_time ? format(new Date(conv.last_message_time), 'HH:mm') : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <PLATFORM_BADGE platform={conv.platform} />
          <span className="text-[#A4B0B7] text-[10px] truncate ml-1">{conv.last_message_preview || 'No messages'}</span>
        </div>
      </div>
      {conv.unread_count > 0 && (
        <div className="w-5 h-5 bg-[#11C7E5] rounded-full flex items-center justify-center text-[10px] text-[#070a13] font-black shrink-0 self-center">
          {conv.unread_count}
        </div>
      )}
    </button>
  );
}

// ── Message Bubble ────────────────────────────────────────────────────────────
function MsgBubble({ msg }) {
  const out = msg.direction === 'outbound';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex ${out ? 'justify-end' : 'justify-start'}`}
    >
      {!out && (
        <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-[10px] font-bold text-[#11C7E5] mr-2 shrink-0 self-end">
          {msg.contact_name?.[0] || 'C'}
        </div>
      )}
      <div className={`max-w-[72%] p-3.5 rounded-2xl text-xs leading-relaxed font-semibold shadow-md ${
        out ? 'bg-[#11C7E5]/90 text-[#070a13] rounded-tr-none' : 'bg-[#121625]/60 border border-slate-900 text-slate-200 rounded-tl-none'
      }`}>
        <p className="text-left">{msg.content}</p>
        <div className={`flex items-center justify-end gap-1 mt-1.5 ${out ? 'text-[#070a13]/50' : 'text-slate-500'}`}>
          <span className="text-[8px] font-bold uppercase tracking-wider">
            {msg.timestamp ? format(new Date(msg.timestamp), 'HH:mm') : ''}
          </span>
          {out && <CheckCheck size={10}/>}
        </div>
      </div>
    </motion.div>
  );
}

// ── AI Reply Suggestion ───────────────────────────────────────────────────────
function AISuggestion({ convId, onUse }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const res = await smartflowApi.aiChat('Suggest 3 short reply options for this conversation', {
        workflow_intent: 'conversation_reply',
        current_values: { conversation_id: convId },
      });
      const text = res.data?.data?.content || res.data?.data?.response || '';
      const lines = text.split('\n').filter(l => l.trim()).slice(0, 3);
      setSuggestions(lines.length ? lines : ['How can I help you further?', 'I understand, let me check on that.', 'Thank you for reaching out!']);
    } catch {
      setSuggestions(['How can I help you further?', 'I understand, let me check on that.', 'Thank you for reaching out!']);
    } finally { setLoading(false); }
  }

  return (
    <div className="px-4 pb-2">
      {suggestions.length === 0 ? (
        <button onClick={generate} disabled={loading}
          className="flex items-center gap-1.5 text-[#11C7E5] text-xs font-bold hover:underline cursor-pointer disabled:opacity-60">
          {loading ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
          {loading ? 'Generating suggestions…' : 'AI Reply Suggestions'}
        </button>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[#11C7E5] text-xs font-bold flex items-center gap-1"><Sparkles size={11}/>AI Suggestions</span>
            <button onClick={()=>setSuggestions([])} className="text-[#A4B0B7] hover:text-white cursor-pointer"><X size={12}/></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button key={i} onClick={()=>{onUse(s); setSuggestions([]);}}
                className="px-3 py-1.5 bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] rounded-xl text-xs font-semibold hover:bg-[#11C7E5]/20 transition-colors cursor-pointer text-left">
                {s.replace(/^[0-9]+[.)]\s*/, '')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Conversations() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [archiving, setArchiving] = useState(false);
  const bottomRef = useRef(null);

  const { recording, loading: voiceLoading, start: startRec, stop: stopRec } = useVoiceRecorder(text => {
    setNewMessage(prev => prev ? `${prev} ${text}` : text);
  });

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await smartflowApi.getConversations();
      setConversations(res.data?.data?.items || res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load conversations.');
    } finally { setLoading(false); }
  }, []);

  const fetchMessages = useCallback(async (id) => {
    try {
      const res = await smartflowApi.getMessages(id);
      setMessages(res.data?.data?.items || res.data?.data || []);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch { setMessages([]); }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);
  useEffect(() => { if (selectedId) { fetchMessages(selectedId); } }, [fetchMessages, selectedId]);

  async function handleSend(e) {
    e?.preventDefault();
    if (!newMessage.trim() || !selectedId) return;
    setSending(true);
    try {
      await smartflowApi.sendMessage({
        conversation_id: selectedId,
        content: newMessage,
        platform: selectedConv?.platform || 'whatsapp',
        direction: 'outbound',
      });
      setNewMessage('');
      fetchMessages(selectedId);
    } catch (err) {
      setError(err.response?.data?.message || 'Send failed.');
    } finally { setSending(false); }
  }

  async function handleArchive() {
    if (!selectedId) return;
    setArchiving(true);
    try {
      await smartflowApi.archiveConversation(selectedId);
      setConversations(c => c.filter(x => x.id !== selectedId));
      setSelectedId(null);
      setMessages([]);
    } catch { setError('Archive failed.'); }
    finally { setArchiving(false); }
  }

  const selectedConv = conversations.find(c => c.id === selectedId);
  const platforms = [...new Set(conversations.map(c => c.platform).filter(Boolean))];
  const filtered = conversations.filter(c =>
    (!search || c.contact_name?.toLowerCase().includes(search.toLowerCase()) || c.last_message_preview?.toLowerCase().includes(search.toLowerCase())) &&
    (!filterPlatform || c.platform === filterPlatform)
  );

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-[#0c101b] border border-[#243041]/60 rounded-3xl overflow-hidden shadow-xl">

      {/* ── Sidebar ── */}
      <div className="w-80 border-r border-[#243041]/40 flex flex-col bg-slate-950/20 shrink-0">
        {/* Search */}
        <div className="p-4 space-y-2 border-b border-[#243041]/20">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search conversations…"
              className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-900 focus:border-[#11C7E5]/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder-slate-600"
            />
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"><X size={12}/></button>}
          </div>
          {/* Platform filter */}
          {platforms.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterPlatform('')}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${!filterPlatform ? 'bg-[#11C7E5]/10 text-[#11C7E5]' : 'text-slate-500 hover:text-white'}`}>
                All
              </button>
              {platforms.map(p => (
                <button key={p} onClick={() => setFilterPlatform(p === filterPlatform ? '' : p)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${filterPlatform === p ? 'bg-[#11C7E5]/10 text-[#11C7E5]' : 'text-slate-500 hover:text-white'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading
            ? Array(5).fill(0).map((_, i) => <div key={i} className="p-4 h-16 animate-pulse border-b border-[#243041]/10 bg-slate-950/10"/>)
            : filtered.length
              ? filtered.map(c => <ConvItem key={c.id} conv={c} selected={selectedId === c.id} onClick={() => setSelectedId(c.id)}/>)
              : (
                <div className="p-8 text-center text-slate-500">
                  <MessageSquare size={32} className="mx-auto mb-2 opacity-40"/>
                  <p className="text-xs font-semibold">No conversations found</p>
                </div>
              )
          }
        </div>
      </div>

      {/* ── Chat Area ── */}
      <div className="flex-1 flex flex-col bg-slate-950/10 min-w-0">
        {error && (
          <div className="p-3 bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 px-4">
            <AlertTriangle size={12}/>{error}
            <button onClick={() => setError('')} className="ml-auto cursor-pointer"><X size={12}/></button>
          </div>
        )}

        {selectedId ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-[#243041]/40 flex items-center justify-between bg-[#0c101b]/60 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] flex items-center justify-center font-black text-sm">
                  {selectedConv?.contact_name?.[0] || 'C'}
                </div>
                <div className="text-left">
                  <h3 className="font-extrabold text-white text-sm">{selectedConv?.contact_name || 'Conversation'}</h3>
                  <PLATFORM_BADGE platform={selectedConv?.platform}/>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <button title="Call" onClick={() => smartflowApi.createOutboundCall({ contact_id: selectedConv?.contact_id, call_type: 'ai_call' }).catch(()=>{})}
                  className="p-2 hover:bg-slate-900 rounded-xl hover:text-[#11C7E5] transition-colors cursor-pointer"><Phone size={16}/></button>
                <button title="Video" className="p-2 hover:bg-slate-900 rounded-xl hover:text-[#11C7E5] transition-colors cursor-pointer"><Video size={16}/></button>
                <button title="Info" className="p-2 hover:bg-slate-900 rounded-xl hover:text-[#11C7E5] transition-colors cursor-pointer"><Info size={16}/></button>
                <button title="Archive" onClick={handleArchive} disabled={archiving}
                  className="p-2 hover:bg-rose-950/20 rounded-xl hover:text-rose-400 transition-colors cursor-pointer disabled:opacity-60">
                  {archiving ? <Loader2 size={16} className="animate-spin"/> : <Archive size={16}/>}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <AnimatePresence initial={false}>
                {messages.length
                  ? messages.map(m => <MsgBubble key={m.id} msg={m}/>)
                  : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 py-16">
                      <MessageSquare size={36} className="opacity-30 mb-2"/>
                      <p className="text-xs font-semibold">No messages yet — start the conversation!</p>
                    </div>
                  )
                }
              </AnimatePresence>
              <div ref={bottomRef}/>
            </div>

            {/* AI Suggestions */}
            <AISuggestion convId={selectedId} onUse={text => setNewMessage(text)}/>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 bg-[#0c101b]/60 border-t border-[#243041]/40 flex gap-2 items-end">
              <button type="button" className="p-3 bg-slate-950 border border-slate-900 text-slate-500 hover:text-white rounded-xl transition-all cursor-pointer shrink-0" title="Attach">
                <Paperclip size={15}/>
              </button>
              <input
                type="text" value={newMessage} onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message…"
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-900 focus:border-[#11C7E5]/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder-slate-600"
              />
              {/* Voice mic button */}
              <button
                type="button"
                onMouseDown={startRec} onMouseUp={stopRec} onTouchStart={startRec} onTouchEnd={stopRec}
                disabled={voiceLoading}
                title={recording ? 'Release to send voice' : 'Hold to record voice'}
                className={`p-3 rounded-xl shrink-0 transition-all cursor-pointer ${recording ? 'bg-rose-500 text-white scale-110 shadow-lg shadow-rose-500/30' : 'bg-slate-950 border border-slate-900 text-slate-500 hover:text-[#11C7E5]'} disabled:opacity-60`}>
                {voiceLoading ? <Loader2 size={15} className="animate-spin"/> : recording ? <MicOff size={15}/> : <Mic size={15}/>}
              </button>
              <button
                type="submit" disabled={sending || !newMessage.trim()}
                className="bg-[#11C7E5] text-[#070a13] p-3 rounded-xl hover:bg-[#0fd0f0] transition-all shadow-lg shadow-cyan-400/10 active:scale-95 flex items-center justify-center shrink-0 disabled:opacity-60 cursor-pointer">
                {sending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center">
              <MessageSquare size={32} className="text-[#11C7E5]"/>
            </div>
            <div className="text-center">
              <p className="font-bold text-white text-sm">Select a conversation</p>
              <p className="text-xs mt-1">Choose from the left to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
