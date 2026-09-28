import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { smartflowApi } from '../api/services';
import { formatCstTime } from '../utils/dateUtils';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CheckCheck,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  Paperclip,
  Reply,
  Forward,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../context/LanguageContext';
import { ConversationSkeletonList, MessagesThreadSkeleton } from '../components/Skeletons/MessageSkeleton';
import { Attachment } from '../components/inbox/MessageBubble';
import useReconnectingSocket from '../components/inbox/useReconnectingSocket';
import { dayLabel, sameDay } from '../components/inbox/inboxUtils';

const PLATFORM_COLORS = {
  ai: '#9333ea',
  global: '#10B981',
  team: '#64748B',
  whatsapp: '#25D366',
  instagram: '#E4405F',
  facebook: '#1877F2',
  sms: '#A855F7',
  email: '#F59E0B',
};

const FILTER_OPTION_DEFS = [
  { key: 'all', labelKey: 'conv_filter_all' },
  { key: 'unread', labelKey: 'notif_filter_unread' },
  { key: 'archived', labelKey: 'conv_filter_archived' },
];

const getApiData = (response) => response?.data?.data || response?.data || response || {};

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

// External channels stay on the Unified Conversations inbox; AI chats stay on
// the Voice Assistant page. Neither belongs in this internal team-messaging view.
const HIDDEN_INBOX_PLATFORMS = ['whatsapp', 'facebook', 'instagram', 'email', 'sms'];

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

// The server flags customer threads (any channel, incl. Telegram/LinkedIn/...); the platform
// list is only a fallback for older payloads.
const isExternalConversation = (conversation) =>
  Boolean(conversation?.is_customer_conversation) || HIDDEN_INBOX_PLATFORMS.includes(normalizePlatform(conversation?.platform));

const getConversationName = (conversation, t) =>
  conversation?.contact_name ||
  conversation?.title ||
  conversation?.group?.name ||
  conversation?.directPeer?.fullName ||
  conversation?.directPeer?.name ||
  t('conv_anonymous');

// Plain internal conversations (team groups, and direct messages started from
// a contact's "Message" button) are stored with platform: "ai" on the backend
// — a filler value, since the schema has no dedicated "internal" platform —
// which is also what real AI-assistant chats use. Without an override every
// such conversation shows a confusing "AI" badge. Real AI chats (type "ai")
// and global chat (its own "global" platform) are excluded from the override.
//
// This is display-only (platformBadge), kept separate from platform itself —
// platform is also sent back to the backend as-is when actually sending a
// message (see handleSend), and "team" isn't a value the backend's platform
// schema accepts. Overwriting platform directly broke sending messages in
// these conversations with a validation error.
const normalizeConversation = (conversation, t) => {
  const realPlatform = normalizePlatform(
    conversation?.platform || conversation?.channel || conversation?.source || conversation?.type
  );
  const isInternalFiller = conversation?.platform === 'ai' && conversation?.type !== 'ai' && !conversation?.is_global_chat;
  return {
    ...conversation,
    id: conversation?.id || conversation?._id,
    contact_name: getConversationName(conversation, t),
    // platform stays whatever the backend sent (e.g. "global_chat", "ai",
    // "whatsapp") since it's also what gets sent back on message-send —
    // normalizePlatform's output is a display-only value ("global", "team")
    // and must never overwrite it. platformBadge is the display-only field.
    platformBadge: isInternalFiller ? 'team' : realPlatform,
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
  };
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
  return formatCstTime(date, { hour: '2-digit', hour12: false });
};

const formatConversationTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatCstTime(date, { hour: '2-digit', hour12: false });
};

function PLATFORM_BADGE({ platform }) {
  const color = PLATFORM_COLORS[platform] || '#9333ea';
  return (
    <span
      className="text-[9px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-md border"
      style={{
        color,
        borderColor: `${color}33`,
        backgroundColor: `${color}15`,
      }}
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

const ConvItem = memo(function ConvItem({ conversation, selected, onClick, t }) {
  return (
    <button
      onClick={onClick}
      className={`w-full border-b border-[#243041]/10 p-4 text-left transition-all hover:bg-slate-900/40 cursor-pointer ${
        selected ? 'border-l-4 border-l-[#9333ea] bg-gradient-to-r from-[#9333ea]/20 to-transparent' : ''
      }`}
    >
      <div className="flex gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-sm font-black uppercase text-[#9333ea]">
          {conversation.contact_name?.[0] || 'C'}
          {conversation.presence === 'online' ? (
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0c101b]" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="truncate text-xs font-bold text-white">{conversation.contact_name}</h4>
            <span className="shrink-0 text-[9px] font-bold text-slate-500">
              {formatConversationTime(conversation.last_message_time)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <PLATFORM_BADGE platform={conversation.platformBadge ?? conversation.platform} />
            <span className="ml-1 truncate text-[10px] text-[#A4B0B7]">
              {conversation.last_message_preview || t('conv_no_messages')}
            </span>
          </div>
        </div>
        {conversation.unread_count > 0 ? (
          <div className="flex h-5 w-5 shrink-0 self-center items-center justify-center rounded-full bg-[#9333ea] text-[10px] font-black text-[#070a13]">
            {Math.min(conversation.unread_count, 99)}
          </div>
        ) : null}
      </div>
    </button>
  );
});

function MessagePreview({ label, preview }) {
  if (!preview?.content) return null;
  return (
    <div className="mb-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-left">
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-[11px] opacity-85">{preview.content}</p>
    </div>
  );
}

const MsgBubble = memo(function MsgBubble({ message, onReply, onForward, showSenderName, t }) {
  const outbound = message.direction === 'outbound';
  const attachments = message.attachments?.length ? message.attachments : message.media_url ? [{ url: message.media_url }] : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`group flex ${outbound ? 'justify-end' : 'justify-start'}`}
    >
      {!outbound ? (
        <div className="mr-2 flex h-7 w-7 shrink-0 self-end items-center justify-center rounded-lg bg-slate-900 text-[10px] font-bold text-[#9333ea]">
          {message.sender_name?.[0] || message.contact_name?.[0] || 'C'}
        </div>
      ) : null}

      {outbound ? (
        <div className="mr-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button aria-label={t('conv_reply_label')} title={t('conv_reply_label')} onClick={() => onReply(message)} className="text-slate-500 hover:text-[#9333ea]">
            <Reply size={14} />
          </button>
          <button aria-label={t('conv_forwarded_label')} title={t('conv_forwarded_label')} onClick={() => onForward(message)} className="text-slate-500 hover:text-[#9333ea]">
            <Forward size={14} />
          </button>
        </div>
      ) : null}

      <div
        className={`max-w-[72%] rounded-2xl p-3.5 text-xs font-semibold leading-relaxed shadow-md ${
          outbound
            ? 'rounded-tr-none bg-[#9333ea]/90 text-[#070a13]'
            : 'rounded-tl-none border border-slate-900 bg-[#121625]/60 text-slate-200'
        }`}
      >
        <MessagePreview label={t('conv_reply_label')} preview={message.reply_to_message_preview} />
        <MessagePreview label={t('conv_forwarded_label')} preview={message.forward_from_message_preview} />
        {showSenderName && !outbound && message.sender_name ? (
          <p className="mb-1 text-[10px] font-extrabold text-[#c084fc]">{message.sender_name}</p>
        ) : null}
        {message.content ? <p className="whitespace-pre-wrap break-words text-left">{message.content}</p> : null}
        {attachments.map((attachment, index) => (
          <Attachment key={`${attachment.url}-${index}`} attachment={attachment} outbound={outbound} t={t} />
        ))}
        <div className={`mt-1.5 flex items-center justify-end gap-1 ${outbound ? 'text-[#070a13]/50' : 'text-slate-500'}`}>
          <span className="text-[8px] font-bold uppercase tracking-wider">{formatMessageTime(message.timestamp)}</span>
          {outbound ? <CheckCheck size={10} /> : null}
        </div>
      </div>

      {!outbound ? (
        <div className="ml-2 flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button aria-label={t('conv_reply_label')} title={t('conv_reply_label')} onClick={() => onReply(message)} className="text-slate-500 hover:text-[#9333ea]">
            <Reply size={14} />
          </button>
          <button aria-label={t('conv_forwarded_label')} title={t('conv_forwarded_label')} onClick={() => onForward(message)} className="text-slate-500 hover:text-[#9333ea]">
            <Forward size={14} />
          </button>
        </div>
      ) : null}
    </motion.div>
  );
});

function AISuggestion({ conversationId, onUse, t }) {
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      // Written from this conversation's actual messages; never lands in the AI assistant's chat history.
      const data = getApiData(await smartflowApi.composeMessage({ action: 'draft_reply', conversation_id: conversationId }));
      setSuggestion(data?.text || t('conv_fallback_reply_1'));
    } catch {
      setSuggestion(t('conv_fallback_reply_1'));
    } finally {
      setLoading(false);
    }
  };

  if (!conversationId) return null;

  return (
    <div className="px-4 pb-2">
      {!suggestion ? (
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="flex cursor-pointer items-center gap-1.5 text-xs font-bold text-[#9333ea] hover:underline disabled:opacity-60"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? t('conv_generating_suggestions') : t('conv_ai_reply_suggestions')}
        </button>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs font-bold text-[#9333ea]">
              <Sparkles size={11} />
              {t('conv_ai_suggestions')}
            </span>
            <button type="button" onClick={() => setSuggestion('')} aria-label={t('conv_close')} className="cursor-pointer text-[#A4B0B7] hover:text-white">
              <X size={12} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              onUse(suggestion);
              setSuggestion('');
            }}
            className="cursor-pointer rounded-xl border border-[#9333ea]/20 bg-[#9333ea]/10 px-3 py-1.5 text-left text-xs font-semibold text-[#9333ea] transition-colors hover:bg-[#9333ea]/20"
          >
            {suggestion}
          </button>
        </div>
      )}
    </div>
  );
}

let conversationsListCache = null;

// Outside the component so the compiler doesn't mistake event-handler clocks for render-time impurity.
const timestampMs = () => Date.now();

const MESSAGE_PAGE_SIZE = 40;
const TYPING_PING_MS = 3000;

const byMostRecent = (list) =>
  [...list].sort((left, right) => new Date(right.last_message_time || 0).getTime() - new Date(left.last_message_time || 0).getTime());

export default function Conversations() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  // One list per tab is the single source of truth; what is on screen is derived from
  // them, so a realtime update can never leave the list, the counts and the open tab
  // disagreeing (they used to, e.g. active chats popping into the Archived tab).
  const [activeList, setActiveList] = useState(() => conversationsListCache?.activeList || []);
  const [archivedList, setArchivedList] = useState(() => conversationsListCache?.archivedList || []);
  // A contact's "Message" button can deep-link straight into its conversation
  // instead of landing on the generic inbox with nothing selected.
  const [selectedId, setSelectedId] = useState(location.state?.conversationId || null);
  const [messages, setMessages] = useState([]);
  const [messagesPage, setMessagesPage] = useState(1);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(!conversationsListCache);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [archiving, setArchiving] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [typingState, setTypingState] = useState({ is_typing: false, actor_name: null, preview_text: null });
  const [audioSending, setAudioSending] = useState(false);
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);
  const selectedIdRef = useRef(selectedId);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTypingPingRef = useRef(0);
  const searchTimeoutRef = useRef(null);
  const messagesCacheRef = useRef({});

  const conversations = useMemo(() => {
    if (activeFilter === 'archived') return archivedList;
    if (activeFilter === 'unread') return activeList.filter((item) => item.unread_count > 0);
    return activeList;
  }, [activeFilter, activeList, archivedList]);

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedId || !selectedConversation) return;

    setSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('attachment_file', file);
      const uploadResponse = await smartflowApi.uploadConversationAttachment(selectedId, formData);
      const attachment = getApiData(uploadResponse);
      await smartflowApi.sendMessage({
        conversation_id: selectedId,
        content: '',
        platform: selectedConversation.platform || 'whatsapp',
        direction: 'outbound',
        attachments: [attachment],
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      await Promise.all([fetchMessages(selectedId, true), fetchConversationCollections()]);
    } catch (sendError) {
      setError(sendError?.response?.data?.message || t('conv_err_file_failed') || 'Failed to attach file');
    } finally {
      setSending(false);
    }
  };

  const setComposerError = useCallback((message) => {
    setError(message);
  }, []);

  const filterOptions = useMemo(
    () => FILTER_OPTION_DEFS.map((option) => ({ ...option, label: option.labelKey ? t(option.labelKey) : option.label })),
    [t],
  );

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
      const searchValue = (options.search ?? search).trim();
      // scope=team: this page is the team's own chats. Customer threads live in Unified
      // and would otherwise fill the 100-item page and push team chats out of it.
      const params = { page: 1, page_size: 100, scope: 'team' };
      if (searchValue) params.search = searchValue;

      const [activeRes, archivedRes] = await Promise.all([
        smartflowApi.getConversations({ ...params, archived: false }),
        smartflowApi.getConversations({ ...params, archived: true }),
      ]);

      const keep = (item) => !isExternalConversation(item) && !isAiAssistantConversation(item);
      const parsedActive = toArray(getApiData(activeRes)).map((item) => normalizeConversation(item, t)).filter(keep);
      const parsedArchived = toArray(getApiData(archivedRes)).map((item) => normalizeConversation(item, t)).filter(keep);

      setActiveList(parsedActive);
      setArchivedList(parsedArchived);
      setLoading(false);

      const combined = [...parsedActive, ...parsedArchived];
      if (selectedId && !combined.some((item) => item.id === selectedId)) {
        setSelectedId(null);
        setMessages([]);
      }
    },
    [search, selectedId, t],
  );

  const handleFilterSelect = (key) => {
    setActiveFilter(key);
  };

  const fetchMessages = useCallback(async (conversationId, forceRefresh = false) => {
    if (!conversationId) return;

    const cached = messagesCacheRef.current[conversationId];
    if (cached) {
      setMessages(cached);
      if (!forceRefresh) {
        setThreadLoading(false);
      }
    } else {
      setMessages([]);
      setThreadLoading(true);
    }

    try {
      // Newest page first; older pages are loaded on demand (this used to fetch only
      // the newest 20 messages and offer no way to see the rest of a long chat).
      const data = getApiData(await smartflowApi.getMessages(conversationId, { page: 1, page_size: MESSAGE_PAGE_SIZE }));
      if (selectedIdRef.current !== conversationId) return; // the user moved on to another chat
      const latest = toMessageArray(data).map(normalizeMessage);
      setMessages((previous) => {
        // Keep older pages already loaded; drop the optimistic copies the server now has.
        const merged = mergeMessages(previous.filter((item) => !String(item.id).startsWith('temp-')), latest);
        messagesCacheRef.current[conversationId] = merged;
        return merged;
      });
      if (!forceRefresh) {
        setMessagesPage(1);
        setHasOlder(Number(data?.pagination?.pages || 1) > 1);
      }
      setError('');
    } catch (threadError) {
      if (!messagesCacheRef.current[conversationId]) {
        setMessages([]);
      }
      setError(threadError?.response?.data?.message || t('conv_err_load_thread'));
    } finally {
      setThreadLoading(false);
    }
  }, [t]);

  const loadOlderMessages = async () => {
    if (!selectedId || loadingOlder) return;
    const container = scrollRef.current;
    const previousHeight = container?.scrollHeight || 0;
    const nextPage = messagesPage + 1;
    setLoadingOlder(true);
    stickToBottomRef.current = false;
    try {
      const data = getApiData(await smartflowApi.getMessages(selectedId, { page: nextPage, page_size: MESSAGE_PAGE_SIZE }));
      const older = toMessageArray(data).map(normalizeMessage);
      setMessages((previous) => {
        const merged = mergeMessages(previous, older);
        messagesCacheRef.current[selectedId] = merged;
        return merged;
      });
      setMessagesPage(nextPage);
      setHasOlder(nextPage < Number(data?.pagination?.pages || nextPage));
      requestAnimationFrame(() => {
        if (container) container.scrollTop = container.scrollHeight - previousHeight; // stay where the reader was
      });
    } catch (olderError) {
      setError(olderError?.response?.data?.message || t('conv_err_load_thread'));
    } finally {
      setLoadingOlder(false);
    }
  };

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
    if (location.state?.conversationId) {
      navigate(location.pathname, { replace: true, state: {} });
    }
    // Only ever meant to fire once, right after a deep-link navigation lands —
    // re-running on every location/navigate identity change would wipe
    // selectedId's already-consumed source state for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    conversationsListCache = { activeList, archivedList };
  }, [activeList, archivedList]);

  useEffect(() => {
    let active = true;

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        await fetchConversationCollections({ search });
        if (active) setError('');
      } catch (loadError) {
        if (active) setError(loadError?.response?.data?.message || t('conv_err_load_list'));
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [fetchConversationCollections, search, t]);

  useReconnectingSocket('/api/v1/smartflow/ws/inbox', (payload) => {
    if (payload?.event !== 'inbox.updated' || !payload?.data?.conversation) return;
    const incoming = normalizeConversation(payload.data.conversation, t);
    if (isExternalConversation(incoming) || isAiAssistantConversation(incoming)) return;
    // The open chat is being read right now; don't let a stale count flash back.
    const conversation = incoming.id === selectedIdRef.current ? { ...incoming, unread_count: 0 } : incoming;
    const upsert = (list) => byMostRecent([conversation, ...list.filter((item) => item.id !== conversation.id)]);
    const drop = (list) => list.filter((item) => item.id !== conversation.id);
    setActiveList((previous) => (conversation.archived ? drop(previous) : upsert(previous)));
    setArchivedList((previous) => (conversation.archived ? upsert(previous) : drop(previous)));
  });

  useEffect(() => {
    // Open the newest chat when there is nothing unread there; with unread messages waiting,
    // leave them unread until the user chooses to open them.
    if (!selectedId && !loading && conversations.length > 0 && !conversations[0].unread_count) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId, loading]);

  useEffect(() => {
    stickToBottomRef.current = true;
    setMessagesPage(1);
    setHasOlder(false);
    setReplyToMessage(null);
    if (!selectedId) return undefined;
    fetchMessages(selectedId);
    smartflowApi.markConversationRead(selectedId).catch(() => {});
    const markRead = (item) => (item.id === selectedId ? { ...item, unread_count: 0 } : item);
    setActiveList((previous) => previous.map(markRead));
    setArchivedList((previous) => previous.map(markRead));
    fetchTypingState(selectedId);

    const interval = window.setInterval(() => fetchTypingState(selectedId), 3000);
    return () => window.clearInterval(interval);
  }, [fetchMessages, fetchTypingState, selectedId]);

  useReconnectingSocket(selectedId ? `/api/v1/smartflow/ws/conversations/${selectedId}` : null, (payload) => {
    if (payload?.event === 'message.created' || payload?.event === 'message.updated') {
      setMessages((previous) => {
        const updated = mergeMessages(previous, [payload.data]);
        messagesCacheRef.current[selectedId] = updated;
        return updated;
      });
      if (payload.event === 'message.created' && payload.data?.direction === 'inbound') {
        smartflowApi.markConversationRead(selectedId).catch(() => {});
      }
    }
    if (payload?.event === 'typing.updated') {
      setTypingState(payload.data || { is_typing: false, actor_name: null, preview_text: null });
    }
  });

  useEffect(() => {
    // Follow new messages only while the reader is already at the bottom; loading older
    // history or scrolling up must not be yanked back down.
    if (stickToBottomRef.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingState]);

  const handleThreadScroll = (event) => {
    const element = event.currentTarget;
    stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 150;
  };

  const selectedConversation = activeList.find((item) => item.id === selectedId) || archivedList.find((item) => item.id === selectedId);

  const filterCounts = useMemo(() => {
    const counts = Object.fromEntries(filterOptions.map((option) => [option.key, 0]));
    counts.all = activeList.length;
    counts.unread = activeList.filter((item) => item.unread_count > 0).length;
    counts.archived = archivedList.length;
    return counts;
  }, [activeList, archivedList, filterOptions]);

  const handleSend = async (event) => {
    event?.preventDefault();
    const content = newMessage.trim();
    if (!content || !selectedId || !selectedConversation) return;

    setSending(true);
    setError('');
    const replyContext = replyToMessage;
    const optimisticId = `temp-${timestampMs()}`;
    stickToBottomRef.current = true;

    if (!isAiAssistantConversation(selectedConversation)) {
      setMessages((previous) => {
        const updated = mergeMessages(previous, [
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
        ]);
        messagesCacheRef.current[selectedId] = updated;
        return updated;
      });
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
          fetchMessages(conversationId, true),
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
      await Promise.all([fetchMessages(selectedId, true), fetchConversationCollections()]);
    } catch (sendError) {
      setMessages((previous) => {
        const filtered = previous.filter((item) => item.id !== optimisticId);
        messagesCacheRef.current[selectedId] = filtered;
        return filtered;
      });
      setNewMessage(content);
      setReplyToMessage(replyContext);
      setError(sendError?.response?.data?.message || t('conv_err_send_failed'));
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
      setError(forwardError?.response?.data?.message || t('conv_err_forward_failed'));
    }
  };

  const handleArchive = async () => {
    if (!selectedId) return;
    setArchiving(true);
    const targetArchived = !selectedConversation?.archived;
    try {
      await smartflowApi.archiveConversation(selectedId, targetArchived);
      setSelectedId(null);
      setMessages([]);
      await fetchConversationCollections();
    } catch (archiveError) {
      setError(archiveError?.response?.data?.message || t('conv_err_archive_failed'));
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!window.confirm(t('conv_confirm_delete'))) return;
    try {
      await smartflowApi.deleteConversation(selectedId);
      setSelectedId(null);
      setMessages([]);
      delete messagesCacheRef.current[selectedId];
      await fetchConversationCollections();
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message || t('conv_err_delete_failed'));
    }
  };

  const handleSendAudio = async () => {
    if (!audioBlob || !selectedId || !selectedConversation) return;

    setAudioSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('attachment_file', audioBlob, `voice-message-${timestampMs()}.webm`);
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
      await Promise.all([fetchMessages(selectedId, true), fetchConversationCollections()]);
    } catch (sendError) {
      setError(sendError?.response?.data?.message || t('conv_err_audio_failed'));
    } finally {
      setVoiceLoading(false);
      setAudioSending(false);
    }
  };

  const handleComposerChange = async (value) => {
    setNewMessage(value);
    if (!selectedId) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    // One "typing" signal every few seconds is plenty; one per keystroke floods the API.
    const now = Date.now();
    if (value.trim() && now - lastTypingPingRef.current > TYPING_PING_MS) {
      lastTypingPingRef.current = now;
      smartflowApi.setTypingStatus(selectedId, {
        is_typing: true,
        actor_name: 'You',
        actor_type: 'user',
        preview_text: 'Typing...',
      }).catch(() => {});
    }

    typingTimeoutRef.current = setTimeout(() => {
      lastTypingPingRef.current = 0;
      smartflowApi.setTypingStatus(selectedId, {
        is_typing: false,
        actor_name: 'You',
        actor_type: 'user',
        preview_text: null,
      }).catch(() => {});
    }, 2500);
  };

  const headerName = selectedConversation?.contact_name || t('conv_header_fallback');
  const isLiveSupport = headerName.toLowerCase() === 'live support';

  const isGlobalChat = Boolean(selectedConversation?.is_global_chat);
  // Only whoever started a team chat can archive or delete it; the API refuses anyone else.
  const cannotManage = isGlobalChat || selectedConversation?.can_manage === false;
  const manageHint = selectedConversation?.can_manage === false ? t('conv_only_starter_can_manage') : undefined;

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
              placeholder={t('conv_search_placeholder')}
              className="w-full rounded-xl border border-slate-900 bg-slate-950 py-2 pl-9 pr-10 text-xs font-semibold text-white placeholder-slate-600 transition-all focus:border-[#9333ea]/40 focus:outline-none"
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
            {filterOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => handleFilterSelect(option.key)}
                className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  activeFilter === option.key ? 'bg-[#9333ea]/20 text-[#c084fc] shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {option.label}
                <span className="ml-1 opacity-80">({filterCounts[option.key] || 0})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <ConversationSkeletonList count={6} />
          ) : conversations.length ? (
            conversations.map((conversation) => (
              <ConvItem
                key={conversation.id}
                conversation={conversation}
                selected={selectedId === conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                t={t}
              />
            ))
          ) : (
            <div className="p-8 text-center text-slate-500">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-xs font-semibold">{search.trim() ? t('conv_no_search_match') : t('conv_none_found')}</p>
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
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#9333ea]/20 bg-[#9333ea]/10 text-sm font-black text-[#9333ea]">
                  {selectedConversation?.contact_name?.[0] || 'C'}
                  {selectedConversation?.presence === 'online' ? (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-[#0c101b]" />
                  ) : null}
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-extrabold text-white">{headerName}</h3>
                    {selectedConversation?.presence === 'online' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {t('conv_active')}
                      </span>
                    ) : null}
                  </div>
                  <PLATFORM_BADGE platform={selectedConversation?.platformBadge ?? selectedConversation?.platform} />
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400">
                <button
                  type="button"
                  title={manageHint || (selectedConversation?.archived ? t('conv_unarchive') : t('conv_archive'))}
                  aria-label={selectedConversation?.archived ? t('conv_unarchive') : t('conv_archive')}
                  disabled={archiving || cannotManage}
                  onClick={handleArchive}
                  className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-slate-900 hover:text-[#9333ea] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {archiving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : selectedConversation?.archived ? (
                    <ArchiveRestore size={16} className="text-purple-400" />
                  ) : (
                    <Archive size={16} />
                  )}
                </button>
                <button
                  type="button"
                  title={manageHint || t('conv_delete')}
                  aria-label={t('conv_delete')}
                  disabled={cannotManage}
                  onClick={handleDelete}
                  className="cursor-pointer rounded-xl p-2 transition-colors hover:bg-rose-950/30 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div ref={scrollRef} onScroll={handleThreadScroll} className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {threadLoading ? (
                <MessagesThreadSkeleton />
              ) : (
                <div className="space-y-4">
                  {hasOlder ? (
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={loadOlderMessages}
                        disabled={loadingOlder}
                        className="cursor-pointer rounded-full border border-slate-800 px-4 py-1.5 text-[11px] font-bold text-slate-300 hover:border-[#9333ea]/40 disabled:opacity-60"
                      >
                        {loadingOlder ? <Loader2 size={12} className="inline animate-spin" /> : t('conv_load_older')}
                      </button>
                    </div>
                  ) : null}
                  <AnimatePresence initial={false}>
                    {messages.length ? (
                      messages.map((message, index) => {
                        const prevMsg = messages[index - 1];
                        const showDateDivider = Boolean(message.timestamp) && (!prevMsg || !sameDay(prevMsg.timestamp, message.timestamp));
                        const currentDateLabel = showDateDivider ? dayLabel(message.timestamp, t) : '';

                        return (
                          <div key={message.id} className="space-y-3">
                            {showDateDivider ? (
                              <div className="my-4 flex items-center justify-center">
                                <span className="rounded-full border border-[#243041]/40 bg-slate-900 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 shadow-sm">
                                  {currentDateLabel}
                                </span>
                              </div>
                            ) : null}
                            <MsgBubble
                              message={message}
                              onReply={setReplyToMessage}
                              onForward={(item) => {
                                setForwardMessage(item);
                                setForwardModalVisible(true);
                              }}
                              showSenderName={Boolean(selectedConversation?.is_group)}
                              t={t}
                            />
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center py-16 text-slate-500">
                        <MessageSquare size={36} className="mb-2 opacity-30" />
                        <p className="text-xs font-semibold">{t('conv_no_messages_yet')}</p>
                      </div>
                    )}
                  </AnimatePresence>

                  {typingState?.is_typing && typingState?.actor_name !== 'You' && typingState?.actor_type !== 'user' ? (
                    <div className="flex justify-start">
                      <div className="rounded-2xl rounded-tl-none border border-slate-900 bg-[#121625]/60 px-3.5 py-2.5 text-xs font-semibold text-slate-300">
                        {selectedConversation?.contact_name || typingState.actor_name || t('conv_someone')} {t('conv_is_typing')}
                        {typingState.preview_text ? `: ${typingState.preview_text}` : '...'}
                      </div>
                    </div>
                  ) : null}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            <AISuggestion key={selectedId} conversationId={selectedId} onUse={setNewMessage} t={t} />

            {isLiveSupport ? (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {[t('conv_quick_billing'), t('conv_quick_technical'), t('conv_quick_account')].map((item) => (
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
                <div className="flex items-center justify-between rounded-lg border border-[#9333ea]/20 bg-slate-900 px-3 py-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#9333ea]">
                    <span className="h-2 w-2 rounded-full bg-rose-400 animate-pulse" />
                    {t('conv_recording_label')} {String(Math.floor(durationSeconds / 60)).padStart(2, '0')}:{String(durationSeconds % 60).padStart(2, '0')}
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={cancelVoiceRecording} className="cursor-pointer p-1 text-slate-500 hover:text-white">
                      <X size={14} />
                    </button>
                    <button type="button" onClick={stopVoiceRecording} className="cursor-pointer rounded-lg bg-[#9333ea] px-3 py-1 text-[11px] font-bold text-[#031218]">
                      {t('conv_stop')}
                    </button>
                  </div>
                </div>
              ) : null}

              {!recording && audioUrl ? (
                <div className="flex flex-col gap-2 rounded-lg border border-[#9333ea]/20 bg-slate-900 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#9333ea]">{t('conv_voice_preview')}</p>
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
                      className="cursor-pointer rounded-lg bg-[#9333ea] px-3 py-1.5 text-[11px] font-bold text-[#031218] disabled:opacity-60"
                    >
                      {audioSending || voiceLoading ? t('conv_sending') : t('conv_send_voice_message')}
                    </button>
                  </div>
                </div>
              ) : null}

              {replyToMessage ? (
                <div className="flex items-center justify-between rounded-lg border-l-2 border-[#9333ea] bg-slate-900 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="mb-0.5 text-[10px] font-bold text-[#9333ea]">
                      {replyToMessage.direction === 'outbound' ? t('conv_replying_to_self') : t('conv_replying_to_them', { name: selectedConversation?.contact_name || t('conv_them_fallback') })}
                    </p>
                    <p className="truncate text-xs text-slate-400">{replyToMessage.content}</p>
                  </div>
                  <button onClick={() => setReplyToMessage(null)} className="cursor-pointer p-1 text-slate-500 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
              ) : null}

              <form onSubmit={handleSend} className="flex items-end gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,application/pdf,.doc,.docx,.txt"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 cursor-pointer rounded-xl border border-slate-900 bg-slate-950 p-3 text-slate-500 transition-all hover:text-white"
                  title={t('conv_attach')}
                  aria-label={t('conv_attach')}
                >
                  <Paperclip size={15} />
                </button>
                <textarea
                  value={newMessage}
                  onChange={(event) => handleComposerChange(event.target.value)}
                  placeholder={t('conv_message_placeholder')}
                  rows={2}
                  className="max-h-32 min-h-[48px] flex-1 resize-none rounded-xl border border-slate-900 bg-slate-950 px-4 py-3 text-xs font-semibold text-white placeholder-slate-600 transition-all focus:border-[#9333ea] focus:ring-2 focus:ring-[#9333ea]/30 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={recording ? stopVoiceRecording : startVoiceRecording}
                  disabled={voiceLoading || audioSending || Boolean(audioUrl)}
                  title={recording ? t('conv_stop_recording') : t('conv_record_voice')}
                  aria-label={recording ? t('conv_stop_recording') : t('conv_record_voice')}
                  className="shrink-0 cursor-pointer rounded-xl border border-slate-900 bg-slate-950 p-3 text-slate-500 transition-all hover:text-[#9333ea] disabled:opacity-60"
                >
                  {voiceLoading ? <Loader2 size={15} className="animate-spin" /> : recording ? <MicOff size={15} /> : <Mic size={15} />}
                </button>
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  aria-label={t('conv_send_message')}
                  className="flex shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#9333ea] p-3 text-[#070a13] shadow-lg shadow-purple-400/10 transition-all active:scale-95 hover:bg-[#a855f7] disabled:opacity-60"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#9333ea]/10">
              <MessageSquare size={32} className="text-[#9333ea]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">{t('conv_select_conversation')}</p>
              <p className="mt-1 text-xs">{t('conv_choose_from_left')}</p>
            </div>
          </div>
        )}
      </div>

      {forwardModalVisible ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[#243041] bg-[#0c101b] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#243041] p-4">
              <h3 className="text-sm font-bold text-white">{t('conv_forward_to')}</h3>
              <button onClick={() => setForwardModalVisible(false)} className="cursor-pointer text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {activeList.filter((item) => item.id !== selectedId).length ? (
                activeList
                  .filter((item) => item.id !== selectedId)
                  .map((conversation) => (
                    <button
                      key={conversation.id}
                      onClick={() => handleForwardTarget(conversation)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-slate-900/50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-black text-[#9333ea]">
                        {conversation.contact_name?.[0] || 'C'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-slate-200">{conversation.contact_name}</p>
                        <p className="text-[10px] capitalize text-slate-500">{conversation.platformBadge ?? conversation.platform}</p>
                      </div>
                    </button>
                  ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">{t('conv_no_forward_targets')}</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
