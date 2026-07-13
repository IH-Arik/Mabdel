import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { smartflowApi } from '../api/services';
import {
  AlertTriangle,
  Archive,
  CheckCheck,
  Info,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  Phone,
  Reply,
  Forward,
  Search,
  Send,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

const PLATFORM_COLORS = {
  ai: '#11C7E5',
  global: '#10B981',
  whatsapp: '#25D366',
  instagram: '#E4405F',
  facebook: '#1877F2',
  sms: '#A855F7',
  email: '#F59E0B',
};

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'ai', label: 'AI' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'Email' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
];

const getApiData = (response) => response?.data?.data || response?.data || response || {};

const getStoredAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('access_token');
};

const getCurrentUserId = () => useAuthStore.getState().user?.id || useAuthStore.getState().user?._id || null;

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  return [];
};

const toMessageArray = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.messages)) return value.messages;
  if (Array.isArray(value?.results)) return value.results;
  if (Array.isArray(value?.data?.items)) return value.data.items;
  if (Array.isArray(value?.data?.messages)) return value.data.messages;
  return [];
};

const normalizePlatform = (value) => {
  const lower = String(value || '').toLowerCase();
  if (lower.includes('whatsapp')) return 'whatsapp';
  if (lower.includes('facebook') || lower === 'fb') return 'facebook';
  if (lower.includes('instagram') || lower === 'ig') return 'instagram';
  if (lower.includes('email') || lower.includes('mail')) return 'email';
  if (lower.includes('sms') || lower.includes('text')) return 'sms';
  if (lower.includes('global')) return 'global';
  if (lower.includes('ai')) return 'ai';
  return lower || 'ai';
};

const getConversationName = (conversation) =>
  conversation?.contact_name ||
  conversation?.title ||
  conversation?.group?.name ||
  conversation?.directPeer?.fullName ||
  conversation?.directPeer?.name ||
  'Anonymous';

const normalizeConversation = (conversation) => ({
  ...conversation,
  id: conversation?.id || conversation?._id,
  contact_name: getConversationName(conversation),
  platform: normalizePlatform(conversation?.platform || conversation?.channel || conversation?.source || conversation?.type),
  last_message_preview:
    conversation?.last_message_preview ||
    conversation?.lastMessage?.text ||
    conversation?.latest_message?.content ||
    '',
  last_message_time:
    conversation?.last_message_time ||
    conversation?.lastMessage?.createdAt ||
    conversation?.updated_at ||
    conversation?.updatedAt ||
    conversation?.created_at ||
    conversation?.createdAt,
  unread_count: Number(conversation?.unread_count || conversation?.unreadCount || 0),
});

const mergeConversationIntoList = (list, conversation) => {
  const normalized = normalizeConversation(conversation);
  const withoutCurrent = list.filter((item) => item.id !== normalized.id);
  return [normalized, ...withoutCurrent].sort(
    (left, right) => new Date(right.last_message_time || 0).getTime() - new Date(left.last_message_time || 0).getTime(),
  );
};

const normalizeMessage = (message) => ({
  ...message,
  id: message?.id || message?._id || `${Date.now()}-${Math.random()}`,
  content: message?.content || message?.text || '',
  direction:
    message?.direction ||
    ((message?.sender_user_id && message.sender_user_id === getCurrentUserId()) || message?.sender_is_self ? 'outbound' : 'inbound'),
  timestamp:
    message?.timestamp ||
    message?.created_at ||
    message?.createdAt ||
    message?.updated_at ||
    message?.updatedAt,
  reply_to_message_preview: message?.reply_to_message_preview || null,
  forward_from_message_preview: message?.forward_from_message_preview || null,
  attachments: Array.isArray(message?.attachments) ? message.attachments : [],
  media_url: message?.media_url || message?.attachment_url || null,
});

const getPrimaryAttachment = (message) => {
  if (Array.isArray(message?.attachments) && message.attachments.length) return message.attachments[0];
  if (message?.media_url) return { type: 'file', url: message.media_url };
  return null;
};

const isAudioAttachment = (attachment) => {
  if (!attachment?.url) return false;
  const hint = `${attachment.type || ''} ${attachment.mime_type || ''} ${attachment.url}`.toLowerCase();
  return hint.includes('audio') || hint.includes('.mp3') || hint.includes('.wav') || hint.includes('.m4a') || hint.includes('.webm') || hint.includes('.ogg');
};

const mergeMessages = (current, incoming) => {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    if (!item?.id) return;
    byId.set(item.id, { ...(byId.get(item.id) || {}), ...normalizeMessage(item) });
  });
  return Array.from(byId.values()).sort(
    (left, right) => new Date(left.timestamp || 0).getTime() - new Date(right.timestamp || 0).getTime(),
  );
};

const isAiAssistantConversation = (conversation) => {
  if (!conversation) return false;
  if (conversation.is_ai_assistant) return true;

  const name = String(
    conversation.contact_name ||
    conversation.title ||
    '',
  ).toLowerCase();

  return conversation.platform === 'ai' && name.includes('assistant');
};

const formatMessageTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'HH:mm');
};

const formatConversationTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return format(date, 'HH:mm');
};

function PLATFORM_BADGE({ platform }) {
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-widest"
      style={{ color: PLATFORM_COLORS[platform] || '#11C7E5' }}
    >
      {platform || 'chat'}
    </span>
  );
}

function useVoiceRecorder(onError) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const mediaRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);
  const timerRef = useRef(null);

  const clearPreview = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl('');
    setDurationSeconds(0);
  }, [audioUrl]);

  const start = async () => {
    try {
      clearPreview();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          onError('Recorded audio was empty.');
          return;
        }
        const nextUrl = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(nextUrl);
      };
      recorder.start();
      mediaRef.current = recorder;
      startedAtRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setDurationSeconds(Math.max(1, Math.floor((Date.now() - (startedAtRef.current || Date.now())) / 1000)));
      }, 250);
      setRecording(true);
    } catch {
      onError('Microphone access denied.');
    }
  };

  const stop = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    mediaRef.current?.stop();
    setRecording(false);
  };

  const cancel = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recording) {
      mediaRef.current?.stop();
    } else {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setRecording(false);
    setLoading(false);
    clearPreview();
  }, [clearPreview, recording]);

  useEffect(() => () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  return { recording, loading, durationSeconds, audioBlob, audioUrl, start, stop, cancel, clearPreview, setLoading };
}

function ConvItem({ conversation, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full border-b border-[#243041]/10 p-4 text-left transition-all hover:bg-slate-900/40 ${
        selected ? 'border-l-4 border-l-[#11C7E5] bg-[#11C7E5]/10' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-sm font-black uppercase text-[#11C7E5]">
          {conversation.contact_name?.[0] || 'C'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="truncate text-xs font-bold text-white">{conversation.contact_name}</h4>
            <span className="shrink-0 text-[9px] font-bold text-slate-500">
              {formatConversationTime(conversation.last_message_time)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1">
            <PLATFORM_BADGE platform={conversation.platform} />
            <span className="ml-1 truncate text-[10px] text-[#A4B0B7]">
              {conversation.last_message_preview || 'No messages'}
            </span>
          </div>
        </div>
        {conversation.unread_count > 0 ? (
          <div className="flex h-5 w-5 shrink-0 self-center items-center justify-center rounded-full bg-[#11C7E5] text-[10px] font-black text-[#070a13]">
            {Math.min(conversation.unread_count, 99)}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function MessagePreview({ label, preview }) {
  if (!preview?.content) return null;
  return (
    <div className="mb-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-left">
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-[11px] opacity-85">{preview.content}</p>
    </div>
  );
}

function MsgBubble({ message, onReply, onForward }) {
  const outbound = message.direction === 'outbound';
  const attachment = getPrimaryAttachment(message);
  const audioAttachment = isAudioAttachment(attachment) ? attachment : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`group flex ${outbound ? 'justify-end' : 'justify-start'}`}
    >
      {!outbound ? (
        <div className="mr-2 flex h-7 w-7 shrink-0 self-end items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-[#11C7E5]">
          {message.sender_name?.[0] || message.contact_name?.[0] || 'C'}
        </div>
      ) : null}

      {outbound ? (
        <div className="mr-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button aria-label="Reply to message" title="Reply" onClick={() => onReply(message)} className="text-slate-500 hover:text-[#11C7E5]">
            <Reply size={14} />
          </button>
          <button aria-label="Forward message" title="Forward" onClick={() => onForward(message)} className="text-slate-500 hover:text-[#11C7E5]">
            <Forward size={14} />
          </button>
        </div>
      ) : null}

      <div
        className={`max-w-[72%] rounded-2xl p-3.5 text-xs font-semibold leading-relaxed shadow-md ${
          outbound
            ? 'rounded-tr-none bg-[#11C7E5]/90 text-[#070a13]'
            : 'rounded-tl-none border border-slate-900 bg-[#121625]/60 text-slate-200'
        }`}
      >
        <MessagePreview label="Reply" preview={message.reply_to_message_preview} />
        <MessagePreview label="Forwarded" preview={message.forward_from_message_preview} />
        {message.content ? <p className="whitespace-pre-wrap text-left">{message.content}</p> : null}
        {audioAttachment ? (
          <audio
            controls
            preload="metadata"
            src={audioAttachment.url}
            className="mt-2 max-w-full"
          />
        ) : null}
        {!audioAttachment && message.media_url ? (
          <a
            href={message.media_url}
            target="_blank"
            rel="noreferrer"
            className={`mt-2 block text-[11px] underline ${outbound ? 'text-[#031218]' : 'text-cyan-300'}`}
          >
            Open attachment
          </a>
        ) : null}
        <div className={`mt-1.5 flex items-center justify-end gap-1 ${outbound ? 'text-[#070a13]/50' : 'text-slate-500'}`}>
          <span className="text-[8px] font-bold uppercase tracking-wider">{formatMessageTime(message.timestamp)}</span>
          {outbound ? <CheckCheck size={10} /> : null}
        </div>
      </div>

      {!outbound ? (
        <div className="ml-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button aria-label="Reply to message" title="Reply" onClick={() => onReply(message)} className="text-slate-500 hover:text-[#11C7E5]">
            <Reply size={14} />
          </button>
          <button aria-label="Forward message" title="Forward" onClick={() => onForward(message)} className="text-slate-500 hover:text-[#11C7E5]">
            <Forward size={14} />
          </button>
        </div>
      ) : null}
    </motion.div>
  );
}

function AISuggestion({ conversationId, onUse }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const response = await smartflowApi.aiChat('Suggest 3 short reply options for this conversation', {
        response_mode: 'text',
      });
      const data = getApiData(response);
      const text = data?.ai_message?.content || data?.response || '';
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3);
      setSuggestions(lines.length ? lines : ['How can I help you further?', 'I understand, let me check on that.', 'Thank you for reaching out!']);
    } catch {
      setSuggestions(['How can I help you further?', 'I understand, let me check on that.', 'Thank you for reaching out!']);
    } finally {
      setLoading(false);
    }
  };

  if (!conversationId) return null;

  return (
    <div className="px-4 pb-2">
      {suggestions.length === 0 ? (
        <button
          onClick={generate}
          disabled={loading}
          className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[#11C7E5] hover:underline disabled:opacity-60"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? 'Generating suggestions...' : 'AI Reply Suggestions'}
        </button>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs font-bold text-[#11C7E5]">
              <Sparkles size={11} />
              AI Suggestions
            </span>
            <button onClick={() => setSuggestions([])} className="cursor-pointer text-[#A4B0B7] hover:text-white">
              <X size={12} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={`${suggestion}-${index}`}
                onClick={() => {
                  onUse(suggestion.replace(/^[0-9]+[.)]\s*/, ''));
                  setSuggestions([]);
                }}
                className="cursor-pointer rounded-xl border border-[#11C7E5]/20 bg-[#11C7E5]/10 px-3 py-1.5 text-left text-xs font-semibold text-[#11C7E5] transition-colors hover:bg-[#11C7E5]/20"
              >
                {suggestion.replace(/^[0-9]+[.)]\s*/, '')}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Conversations() {
  const navigate = useNavigate();
  const [allConversations, setAllConversations] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [archiving, setArchiving] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [typingState, setTypingState] = useState({ is_typing: false, actor_name: null, preview_text: null });
  const [audioSending, setAudioSending] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const conversationSocketRef = useRef(null);
  const inboxSocketRef = useRef(null);

  const setComposerError = useCallback((message) => {
    setError(message);
  }, []);

  const {
    recording,
    loading: voiceLoading,
    durationSeconds,
    audioBlob,
    audioUrl,
    start: startVoiceRecording,
    stop: stopVoiceRecording,
    cancel: cancelVoiceRecording,
    clearPreview: clearVoicePreview,
    setLoading: setVoiceLoading,
  } = useVoiceRecorder(setComposerError);

  const fetchConversationCollections = useCallback(
    async (options = {}) => {
      const searchValue = options.search ?? search;
      const platformValue = options.platform ?? filterPlatform;
      const params = {
        page: 1,
        page_size: 100,
        archived: false,
      };
      if (searchValue.trim()) params.search = searchValue.trim();
      if (platformValue && platformValue !== 'all') params.platform = platformValue;

      const [allResponse, visibleResponse] = await Promise.all([
        smartflowApi.getConversations({ page: 1, page_size: 100, archived: false }),
        smartflowApi.getConversations(params),
      ]);

      const allData = getApiData(allResponse);
      const visibleData = getApiData(visibleResponse);

      const allItems = toArray(allData).map(normalizeConversation);
      const visibleItems = toArray(visibleData).map(normalizeConversation);

      setAllConversations(allItems);
      setConversations(visibleItems);
      setSummary(allData?.summary || {});

      if (selectedId && !allItems.some((item) => item.id === selectedId)) {
        setSelectedId(null);
        setMessages([]);
      }
    },
    [filterPlatform, search, selectedId],
  );

  const fetchMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;
    setThreadLoading(true);
    try {
      const response = await smartflowApi.getMessages(conversationId);
      const data = getApiData(response);
      const nextMessages = toMessageArray(data)
        .map(normalizeMessage)
        .sort((left, right) => new Date(left.timestamp || 0).getTime() - new Date(right.timestamp || 0).getTime());
      setMessages(nextMessages);
      setError('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    } catch (threadError) {
      setMessages([]);
      setError(threadError?.response?.data?.message || 'Could not load this conversation thread.');
    } finally {
      setThreadLoading(false);
    }
  }, []);

  const fetchTypingState = useCallback(async (conversationId) => {
    if (!conversationId) return;
    try {
      const response = await smartflowApi.getTypingStatus(conversationId);
      setTypingState(getApiData(response));
    } catch {
      setTypingState({ is_typing: false, actor_name: null, preview_text: null });
    }
  }, []);

  useEffect(() => {
    let active = true;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const searchValue = search.trim();
        const params = {
          page: 1,
          page_size: 100,
          archived: false,
        };
        if (searchValue) params.search = searchValue;
        if (filterPlatform && filterPlatform !== 'all') params.platform = filterPlatform;

        const [allResponse, visibleResponse] = await Promise.all([
          smartflowApi.getConversations({ page: 1, page_size: 100, archived: false }),
          smartflowApi.getConversations(params),
        ]);

        const allData = getApiData(allResponse);
        const visibleData = getApiData(visibleResponse);
        const allItems = toArray(allData).map(normalizeConversation);
        const visibleItems = toArray(visibleData).map(normalizeConversation);

        if (!active) return;

        setAllConversations(allItems);
        setConversations(visibleItems);
        setSummary(allData?.summary || {});
        setError('');

        if (selectedId && !allItems.some((item) => item.id === selectedId)) {
          setSelectedId(null);
          setMessages([]);
        }
      } catch (loadError) {
        if (!active) return;
        setAllConversations([]);
        setConversations([]);
        setSummary({});
        setError(loadError?.response?.data?.message || 'Could not load conversations.');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [filterPlatform, search, selectedId]);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return undefined;

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(`${protocol}://127.0.0.1:8000/api/v1/smartflow/ws/inbox?token=${encodeURIComponent(token)}`);
    inboxSocketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.event !== 'inbox.updated') return;

        const nextConversation = payload?.data?.conversation;
        const nextSummary = payload?.data?.summary;

        if (nextConversation) {
          setAllConversations((previous) => mergeConversationIntoList(previous, nextConversation));
          setConversations((previous) => {
            const merged = mergeConversationIntoList(previous, nextConversation);
            return filterPlatform === 'all'
              ? merged
              : merged.filter((item) => normalizePlatform(item.platform) === filterPlatform);
          });
        }

        if (nextSummary) {
          setSummary(nextSummary);
        }
      } catch {
        // Ignore malformed realtime payloads and keep the page usable.
      }
    };

    return () => {
      socket.close();
      inboxSocketRef.current = null;
    };
  }, [filterPlatform]);

  useEffect(() => {
    if (!selectedId) return;
    fetchMessages(selectedId);
    smartflowApi.markConversationRead(selectedId).catch(() => {});
    setAllConversations((previous) => previous.map((item) => (item.id === selectedId ? { ...item, unread_count: 0 } : item)));
    setConversations((previous) => previous.map((item) => (item.id === selectedId ? { ...item, unread_count: 0 } : item)));
    fetchTypingState(selectedId);

    const interval = window.setInterval(() => fetchTypingState(selectedId), 3000);
    const token = getStoredAccessToken();
    let socket = null;

    if (token) {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      socket = new WebSocket(`${protocol}://127.0.0.1:8000/api/v1/smartflow/ws/conversations/${selectedId}?token=${encodeURIComponent(token)}`);
      conversationSocketRef.current = socket;
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.event === 'message.created' || payload?.event === 'message.updated') {
            setMessages((previous) => mergeMessages(previous, [payload.data]));
          }
          if (payload?.event === 'typing.updated') {
            setTypingState(payload.data || { is_typing: false, actor_name: null, preview_text: null });
          }
        } catch {
          // Ignore malformed realtime payloads and keep polling fallback active.
        }
      };
    }

    return () => {
      window.clearInterval(interval);
      if (socket) socket.close();
      conversationSocketRef.current = null;
    };
  }, [fetchMessages, fetchTypingState, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingState]);

  const selectedConversation = useMemo(
    () => allConversations.find((item) => item.id === selectedId) || conversations.find((item) => item.id === selectedId),
    [allConversations, conversations, selectedId],
  );

  const visibleFilters = useMemo(
    () => FILTER_OPTIONS.filter((option) => option.key !== 'ai' || allConversations.some((item) => normalizePlatform(item.platform) === 'ai')),
    [allConversations],
  );

  const filterCounts = useMemo(() => {
    const counts = Object.fromEntries(FILTER_OPTIONS.map((option) => [option.key, 0]));
    counts.all = allConversations.length;
    allConversations.forEach((conversation) => {
      const platform = normalizePlatform(conversation.platform);
      counts[platform] = (counts[platform] || 0) + 1;
    });
    return counts;
  }, [allConversations]);

  const handleSend = async (event) => {
    event?.preventDefault();
    const content = newMessage.trim();
    if (!content || !selectedId || !selectedConversation) return;

    setSending(true);
    setError('');
    const replyContext = replyToMessage;
    const optimisticId = `temp-${Date.now()}`;

    if (!isAiAssistantConversation(selectedConversation)) {
      setMessages((previous) =>
        mergeMessages(previous, [
          {
            id: optimisticId,
            content,
            direction: 'outbound',
            timestamp: new Date().toISOString(),
            sender_name: 'You',
            sender_is_self: true,
            reply_to_message_preview: replyContext
              ? {
                  id: replyContext.id,
                  content: replyContext.content,
                }
              : null,
          },
        ]),
      );
      setNewMessage('');
      setReplyToMessage(null);
    }

    try {
      if (isAiAssistantConversation(selectedConversation)) {
        const response = await smartflowApi.aiChat(content, {
          response_mode: 'text',
        });
        const data = getApiData(response);
        const conversationId = data?.conversation_id || selectedId;

        setNewMessage('');
        setReplyToMessage(null);

        if (conversationId && conversationId !== selectedId) {
          setSelectedId(conversationId);
        }

        await Promise.all([
          fetchMessages(conversationId),
          fetchConversationCollections(),
        ]);
      } else if (replyToMessage) {
        await smartflowApi.replyToMessage(replyContext.id, {
          content,
          platform: selectedConversation.platform || 'whatsapp',
        });
      } else {
        await smartflowApi.sendMessage({
          conversation_id: selectedId,
          content,
          platform: selectedConversation.platform || 'whatsapp',
          direction: 'outbound',
        });
      }

      setNewMessage('');
      setReplyToMessage(null);
      await Promise.all([fetchMessages(selectedId), fetchConversationCollections()]);
    } catch (sendError) {
      setMessages((previous) => previous.filter((item) => item.id !== optimisticId));
      setNewMessage(content);
      setReplyToMessage(replyContext);
      setError(sendError?.response?.data?.message || 'Send failed.');
    } finally {
      setSending(false);
    }
  };

  const handleForwardTarget = async (targetConversation) => {
    if (!forwardMessage || !targetConversation?.id) return;
    setForwardModalVisible(false);
    try {
      await smartflowApi.forwardMessage(forwardMessage.id, {
        conversation_id: targetConversation.id,
        platform: targetConversation.platform || selectedConversation?.platform || 'ai',
      });
      setForwardMessage(null);
      setError('');
    } catch (forwardError) {
      setError(forwardError?.response?.data?.message || 'Forward failed.');
    }
  };

  const handleArchive = async () => {
    if (!selectedId) return;
    setArchiving(true);
    try {
      await smartflowApi.archiveConversation(selectedId);
      setSelectedId(null);
      setMessages([]);
      await fetchConversationCollections();
    } catch (archiveError) {
      setError(archiveError?.response?.data?.message || 'Archive failed.');
    } finally {
      setArchiving(false);
    }
  };

  const handleSendAudio = async () => {
    if (!audioBlob || !selectedId || !selectedConversation) return;

    setAudioSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('attachment_file', audioBlob, `voice-message-${Date.now()}.webm`);
      setVoiceLoading(true);
      const uploadResponse = await smartflowApi.uploadConversationAttachment(selectedId, formData);
      const attachment = getApiData(uploadResponse);
      await smartflowApi.sendMessage({
        conversation_id: selectedId,
        content: '',
        platform: selectedConversation.platform || 'whatsapp',
        direction: 'outbound',
        attachments: [attachment],
      });
      clearVoicePreview();
      await Promise.all([fetchMessages(selectedId), fetchConversationCollections()]);
    } catch (sendError) {
      setError(sendError?.response?.data?.message || 'Audio message failed.');
    } finally {
      setVoiceLoading(false);
      setAudioSending(false);
    }
  };

  const handleComposerChange = async (value) => {
    setNewMessage(value);
    if (!selectedId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    smartflowApi.setTypingStatus(selectedId, {
      is_typing: Boolean(value.trim()),
      actor_name: 'You',
      actor_type: 'user',
      preview_text: value.trim() ? 'Typing...' : null,
    }).catch(() => {});

    typingTimeoutRef.current = setTimeout(() => {
      smartflowApi.setTypingStatus(selectedId, {
        is_typing: false,
        actor_name: 'You',
        actor_type: 'user',
        preview_text: null,
      }).catch(() => {});
    }, 2500);
  };

  const headerName = selectedConversation?.contact_name || 'Conversation';
  const isLiveSupport = headerName.toLowerCase() === 'live support';
  const isAiAssistant = isAiAssistantConversation(selectedConversation);
  const isGlobalChat = Boolean(selectedConversation?.is_global_chat);

  return (
    <div className="flex h-[calc(100vh-10rem)] overflow-hidden rounded-3xl border border-[#243041]/60 bg-[#0c101b] shadow-xl">
      <div className="flex w-80 shrink-0 flex-col border-r border-[#243041]/40 bg-slate-950/20">
        <div className="space-y-2 border-b border-[#243041]/20 p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl border border-slate-900 bg-slate-950 py-2 pl-9 pr-10 text-xs font-semibold text-white placeholder-slate-600 transition-all focus:border-[#11C7E5]/40 focus:outline-none"
            />
            {search ? (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-500 hover:text-white"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {visibleFilters.map((option) => (
              <button
                key={option.key}
                onClick={() => setFilterPlatform(option.key)}
                className={`cursor-pointer rounded-lg px-2 py-1 text-[10px] font-bold transition-all ${
                  filterPlatform === option.key ? 'bg-[#11C7E5]/10 text-[#11C7E5]' : 'text-slate-500 hover:text-white'
                }`}
              >
                {option.label}
                <span className="ml-1 opacity-70">({filterCounts[option.key] || 0})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse border-b border-[#243041]/10 bg-slate-950/10 p-4" />
            ))
          ) : conversations.length ? (
            conversations.map((conversation) => (
              <ConvItem
                key={conversation.id}
                conversation={conversation}
                selected={selectedId === conversation.id}
                onClick={() => setSelectedId(conversation.id)}
              />
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">{search.trim() ? 'No conversations match your search' : 'No conversations found'}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-slate-950/10">
        {error ? (
          <div className="flex items-center gap-2 border border-rose-500/30 bg-rose-950/30 px-4 py-3 text-xs text-rose-300">
            <AlertTriangle size={12} />
            {error}
            <button onClick={() => setError('')} className="ml-auto cursor-pointer">
              <X size={12} />
            </button>
          </div>
        ) : null}

        {selectedId ? (
          <>
            <div className="flex items-center justify-between border-b border-[#243041]/40 bg-[#0c101b]/60 p-4 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#11C7E5]/20 bg-[#11C7E5]/10 text-sm font-black text-[#11C7E5]">
                  {selectedConversation?.contact_name?.[0] || 'C'}
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-extrabold text-white">{headerName}</h3>
                  <PLATFORM_BADGE platform={selectedConversation?.platform} />
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <button
                  title="Call"
                  disabled={isGlobalChat}
                  onClick={() => smartflowApi.createOutboundCall({ contact_id: selectedConversation?.contact_id, call_type: 'ai_call' }).catch(() => {})}
                  className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-slate-900 hover:text-[#11C7E5] disabled:opacity-40"
                >
                  <Phone size={16} />
                </button>
                <button title="Video" className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-slate-900 hover:text-[#11C7E5]">
                  <Video size={16} />
                </button>
                <button title="Info" className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-slate-900 hover:text-[#11C7E5]">
                  <Info size={16} />
                </button>
                <button
                  title="Archive"
                  disabled={archiving || isGlobalChat}
                  onClick={handleArchive}
                  className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-rose-950/20 hover:text-rose-400 disabled:opacity-60"
                >
                  {archiving ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {threadLoading ? (
                <div className="flex h-full items-center justify-center text-slate-400">
                  <Loader2 size={18} className="mr-2 animate-spin text-[#11C7E5]" />
                  Loading conversation...
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {messages.length ? (
                      messages.map((message) => (
                        <MsgBubble
                          key={message.id}
                          message={message}
                          onReply={setReplyToMessage}
                          onForward={(item) => {
                            setForwardMessage(item);
                            setForwardModalVisible(true);
                          }}
                        />
                      ))
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center py-16 text-slate-500">
                        <MessageSquare size={36} className="mb-2 opacity-30" />
                        <p className="text-xs font-semibold">No messages yet - start the conversation!</p>
                      </div>
                    )}
                  </AnimatePresence>

                  {typingState?.is_typing ? (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-tl-none border border-slate-900 bg-[#121625]/60 px-3.5 py-2.5 text-xs font-semibold text-slate-300">
                        {typingState.actor_name || selectedConversation?.contact_name || 'Someone'} is typing
                        {typingState.preview_text ? `: ${typingState.preview_text}` : '...'}
                      </div>
                    </div>
                  ) : null}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <AISuggestion conversationId={selectedId} onUse={setNewMessage} />

            {isLiveSupport ? (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {['billing issue', 'technical help', 'account problem'].map((item) => (
                  <button
                    key={item}
                    onClick={() => setNewMessage(item)}
                    className="cursor-pointer rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold capitalize text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 border-t border-[#243041]/40 bg-[#0c101b]/60 p-4">
              {recording ? (
                <div className="flex items-center justify-between rounded-lg border border-[#11C7E5]/20 bg-slate-900 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#11C7E5]">
                    <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                    Recording {String(Math.floor(durationSeconds / 60)).padStart(2, '0')}:{String(durationSeconds % 60).padStart(2, '0')}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={cancelVoiceRecording} className="cursor-pointer p-1 text-slate-500 hover:text-white">
                      <X size={14} />
                    </button>
                    <button type="button" onClick={stopVoiceRecording} className="cursor-pointer rounded-lg bg-[#11C7E5] px-3 py-1 text-[11px] font-bold text-[#031218]">
                      Stop
                    </button>
                  </div>
                </div>
              ) : null}

              {!recording && audioUrl ? (
                <div className="flex flex-col gap-2 rounded-lg border border-[#11C7E5]/20 bg-slate-900 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#11C7E5]">Voice message preview</p>
                    <button type="button" onClick={cancelVoiceRecording} className="cursor-pointer p-1 text-slate-500 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                  <audio controls src={audioUrl} className="w-full" />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSendAudio}
                      disabled={audioSending || voiceLoading}
                      className="cursor-pointer rounded-lg bg-[#11C7E5] px-3 py-1.5 text-[11px] font-bold text-[#031218] disabled:opacity-60"
                    >
                      {audioSending || voiceLoading ? 'Sending...' : 'Send voice message'}
                    </button>
                  </div>
                </div>
              ) : null}

              {replyToMessage ? (
                <div className="flex items-center justify-between rounded-lg border-l-2 border-[#11C7E5] bg-slate-900 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-[10px] font-bold text-[#11C7E5]">
                      Replying to {replyToMessage.direction === 'outbound' ? 'yourself' : selectedConversation?.contact_name || 'them'}
                    </p>
                    <p className="truncate text-xs text-slate-400">{replyToMessage.content}</p>
                  </div>
                  <button onClick={() => setReplyToMessage(null)} className="cursor-pointer p-1 text-slate-500 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              ) : null}

              <form onSubmit={handleSend} className="flex items-end gap-2">
                <button
                  type="button"
                  className="shrink-0 cursor-pointer rounded-xl border border-slate-900 bg-slate-950 p-3 text-slate-500 transition-all hover:text-white"
                  title="Attach"
                  aria-label="Attach file"
                >
                  <Paperclip size={15} />
                </button>
                <textarea
                  value={newMessage}
                  onChange={(event) => handleComposerChange(event.target.value)}
                  placeholder="Type a message..."
                  rows={2}
                  className="max-h-32 min-h-[48px] flex-1 resize-none rounded-xl border border-slate-900 bg-slate-950 px-4 py-3 text-xs font-semibold text-white placeholder-slate-600 transition-all focus:border-[#11C7E5]/40 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={recording ? stopVoiceRecording : startVoiceRecording}
                  disabled={voiceLoading || audioSending || Boolean(audioUrl)}
                  title={recording ? 'Stop recording' : 'Record voice message'}
                  aria-label={recording ? 'Stop recording' : 'Record voice message'}
                  className="shrink-0 cursor-pointer rounded-xl border border-slate-900 bg-slate-950 p-3 text-slate-500 transition-all hover:text-[#11C7E5] disabled:opacity-60"
                >
                  {voiceLoading ? <Loader2 size={15} className="animate-spin" /> : recording ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  aria-label="Send message"
                  className="flex shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#11C7E5] p-3 text-[#070a13] shadow-lg shadow-cyan-400/10 transition-all active:scale-95 hover:bg-[#0fd0f0] disabled:opacity-60"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#11C7E5]/10">
              <MessageSquare size={32} className="text-[#11C7E5]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">Select a conversation</p>
              <p className="mt-1 text-xs">Choose from the left to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {forwardModalVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[#243041] bg-[#0c101b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#243041] p-4">
              <h3 className="text-sm font-bold text-white">Forward to...</h3>
              <button onClick={() => setForwardModalVisible(false)} className="cursor-pointer text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {allConversations.filter((item) => item.id !== selectedId).length ? (
                allConversations
                  .filter((item) => item.id !== selectedId)
                  .map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => handleForwardTarget(conversation)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-slate-900/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-[#11C7E5]">
                        {conversation.contact_name?.[0] || 'C'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-200">{conversation.contact_name}</p>
                        <p className="text-[10px] capitalize text-slate-500">{conversation.platform}</p>
                      </div>
                    </button>
                  ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">No other conversations to forward to.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
