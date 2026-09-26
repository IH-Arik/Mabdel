import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Archive, ArchiveRestore, ArrowLeft, Info, Loader2, MessageSquare, Trash2, X } from 'lucide-react';
import { smartflowApi } from '../api/services';
import { useAuthStore } from '../store/useAuthStore';
import { useLanguage } from '../context/LanguageContext';
import ModalShell from '../components/ModalShell';
import { MessagesThreadSkeleton } from '../components/Skeletons/MessageSkeleton';
import ChannelIcon from '../components/inbox/ChannelIcon';
import { CUSTOMER_CHANNELS, INBOX_CHANNELS, REPLY_WINDOW_CHANNELS, channelMeta } from '../constants/channels';
import ConversationList from '../components/inbox/ConversationList';
import MessageBubble from '../components/inbox/MessageBubble';
import Composer from '../components/inbox/Composer';
import ContactPanel from '../components/inbox/ContactPanel';
import useReconnectingSocket from '../components/inbox/useReconnectingSocket';
import {
  dayLabel,
  errorMessage,
  getApiData,
  hoursSince,
  isCustomerConversation,
  mergeMessages,
  normalizeConversation,
  sameDay,
  sortConversations,
  toList,
} from '../components/inbox/inboxUtils';

const LIST_PAGE_SIZE = 30;
const THREAD_PAGE_SIZE = 40;

export default function UnifiedConversations() {
  const { t } = useLanguage();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const currentUserId = useAuthStore((state) => state.user?.id || state.user?._id || null);
  const forwardTitleId = useId();

  // ── list state ───────────────────────────────────────────────────────────
  const initialChannel = searchParams.get('channel');
  const [channel, setChannel] = useState(INBOX_CHANNELS.includes(initialChannel) ? initialChannel : 'all');
  const [assignee, setAssignee] = useState('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [conversations, setConversations] = useState([]);
  const [summary, setSummary] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState('');
  const listRequestRef = useRef(0);

  // ── thread state ─────────────────────────────────────────────────────────
  // Opens straight into a thread when navigated here with one (e.g. from a contact).
  const [selectedId, setSelectedId] = useState(location.state?.conversationId || null);
  const [openedConversation, setOpenedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [threadPage, setThreadPage] = useState(1);
  const [hasOlder, setHasOlder] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [typing, setTyping] = useState(null);
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const scrollRef = useRef(null);
  const stickToBottomRef = useRef(true);

  // ── side panel / team ────────────────────────────────────────────────────
  const [showInfo, setShowInfo] = useState(false);
  const [contactDetails, setContactDetails] = useState(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [forwarding, setForwarding] = useState(null);

  const membersById = useMemo(() => Object.fromEntries(members.map((member) => [member.id, member])), [members]);
  const filtersRef = useRef({ channel, assignee, unreadOnly, search });
  useEffect(() => {
    filtersRef.current = { channel, assignee, unreadOnly, search };
  }, [channel, assignee, unreadOnly, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    smartflowApi
      .getConversationAssignees()
      .then((response) => setMembers(toList(getApiData(response))))
      .catch(() => setMembers([]));
  }, []);

  const listParams = useCallback((targetPage) => {
    const { channel: tab, assignee: who, unreadOnly: unread, search: query } = filtersRef.current;
    const params = { page: targetPage, page_size: LIST_PAGE_SIZE, archived: tab === 'archived' };
    if (INBOX_CHANNELS.includes(tab)) params.platform = tab;
    else params.platforms = CUSTOMER_CHANNELS.join(',');
    if (who !== 'all') params.assignee = who;
    if (unread) params.unread_only = true;
    if (query) params.search = query;
    return params;
  }, []);

  const loadList = useCallback(
    async (targetPage = 1) => {
      const requestId = ++listRequestRef.current;
      if (targetPage === 1) setListLoading(true);
      else setLoadingMore(true);
      try {
        const data = getApiData(await smartflowApi.getConversations(listParams(targetPage)));
        if (requestId !== listRequestRef.current) return;
        const items = toList(data).filter(isCustomerConversation).map((item) => normalizeConversation(item, t));
        setConversations((previous) => (targetPage === 1 ? items : sortConversations([...previous.filter((p) => !items.some((i) => i.id === p.id)), ...items])));
        setSummary(data?.summary || {});
        setPage(targetPage);
        setHasMore(targetPage < Number(data?.pagination?.pages || 1));
        setListError('');
      } catch (loadError) {
        if (requestId === listRequestRef.current) setListError(errorMessage(loadError, t('conv_err_load_list')));
      } finally {
        if (requestId === listRequestRef.current) {
          setListLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [listParams, t],
  );

  useEffect(() => {
    loadList(1);
  }, [channel, assignee, unreadOnly, search, loadList]);

  // Counts change whenever anything arrives; refresh them at most every few seconds.
  const countsTimerRef = useRef(null);
  const refreshCountsSoon = useCallback(() => {
    window.clearTimeout(countsTimerRef.current);
    countsTimerRef.current = window.setTimeout(async () => {
      try {
        const data = getApiData(await smartflowApi.getConversations({ ...listParams(1), page_size: 1 }));
        setSummary(data?.summary || {});
      } catch {
        // Counts are a nicety; the list itself is already up to date.
      }
    }, 2000);
  }, [listParams]);
  useEffect(() => () => window.clearTimeout(countsTimerRef.current), []);

  const matchesFilters = useCallback(
    (conversation) => {
      const { channel: tab, assignee: who, unreadOnly: unread, search: query } = filtersRef.current;
      if (query) return false; // search results come from the server only
      if (tab === 'archived' ? !conversation.archived : conversation.archived) return false;
      if (INBOX_CHANNELS.includes(tab) && conversation.platform !== tab) return false;
      if (who === 'me' && conversation.assigned_to !== currentUserId) return false;
      if (who === 'unassigned' && conversation.assigned_to) return false;
      if (unread && !conversation.unread_count) return false;
      return true;
    },
    [currentUserId],
  );

  const upsertConversation = useCallback(
    (raw) => {
      if (!isCustomerConversation(raw)) return;
      const conversation = normalizeConversation(raw, t);
      setConversations((previous) => {
        const without = previous.filter((item) => item.id !== conversation.id);
        return matchesFilters(conversation) ? sortConversations([conversation, ...without]) : without;
      });
      setOpenedConversation((previous) => (previous?.id === conversation.id ? conversation : previous));
    },
    [matchesFilters, t],
  );

  useReconnectingSocket('/api/v1/smartflow/ws/inbox', (payload) => {
    if (payload?.event !== 'inbox.updated' || !payload?.data?.conversation) return;
    const incoming = payload.data.conversation;
    // The open thread was just read on screen; don't let a stale count flash back.
    upsertConversation(incoming.id === selectedId ? { ...incoming, unread_count: 0 } : incoming);
    refreshCountsSoon();
  });

  // ── selected conversation ────────────────────────────────────────────────
  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) || (openedConversation?.id === selectedId ? openedConversation : null),
    [conversations, openedConversation, selectedId],
  );

  useEffect(() => {
    if (!selectedId || conversations.some((item) => item.id === selectedId)) return;
    // Opened from a link or the "also on" panel while not in the current list.
    smartflowApi
      .getConversation(selectedId)
      .then((response) => setOpenedConversation(normalizeConversation(getApiData(response), t)))
      .catch(() => setError(t('conv_err_load_thread')));
  }, [conversations, selectedId, t]);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const element = scrollRef.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);

  const loadThread = useCallback(
    async (conversationId, targetPage = 1) => {
      const element = scrollRef.current;
      const previousHeight = element?.scrollHeight || 0;
      if (targetPage === 1) setThreadLoading(true);
      else setLoadingOlder(true);
      try {
        const data = getApiData(await smartflowApi.getMessages(conversationId, { page: targetPage, page_size: THREAD_PAGE_SIZE }));
        const items = toList(data);
        setMessages((previous) => (targetPage === 1 ? mergeMessages([], items) : mergeMessages(previous, items)));
        setThreadPage(targetPage);
        setHasOlder(targetPage < Number(data?.pagination?.pages || data?.pages || 1));
        requestAnimationFrame(() => {
          if (targetPage === 1) scrollToBottom();
          else if (element) element.scrollTop = element.scrollHeight - previousHeight; // keep the reader's place
        });
      } catch (threadError) {
        setError(errorMessage(threadError, t('conv_err_load_thread')));
      } finally {
        setThreadLoading(false);
        setLoadingOlder(false);
      }
    },
    [scrollToBottom, t],
  );

  const loadContact = useCallback(async (conversationId) => {
    setContactLoading(true);
    try {
      setContactDetails(getApiData(await smartflowApi.getConversationContact(conversationId)));
    } catch {
      setContactDetails(null);
    } finally {
      setContactLoading(false);
    }
  }, []);

  useEffect(() => {
    setMessages([]);
    setReplyTo(null);
    setTyping(null);
    setDraft('');
    setContactDetails(null);
    stickToBottomRef.current = true;
    if (!selectedId) return;
    loadThread(selectedId, 1);
    loadContact(selectedId);
    smartflowApi.markConversationRead(selectedId).catch(() => {});
    setConversations((previous) => previous.map((item) => (item.id === selectedId ? { ...item, unread_count: 0 } : item)));
  }, [selectedId, loadThread, loadContact]);

  useReconnectingSocket(selectedId ? `/api/v1/smartflow/ws/conversations/${selectedId}` : null, (payload) => {
    if (payload?.event === 'message.created' || payload?.event === 'message.updated') {
      if (payload.data?.conversation_id && payload.data.conversation_id !== selectedId) return;
      setMessages((previous) => mergeMessages(previous, [payload.data]));
      if (payload.event === 'message.created' && payload.data?.direction === 'inbound') {
        smartflowApi.markConversationRead(selectedId).catch(() => {});
      }
    } else if (payload?.event === 'typing.updated') {
      setTyping(payload.data?.is_typing ? payload.data : null);
    }
  });

  useEffect(() => {
    if (stickToBottomRef.current) scrollToBottom('smooth');
  }, [messages.length, typing, scrollToBottom]);

  const handleThreadScroll = (event) => {
    const element = event.currentTarget;
    stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 150;
  };

  // ── actions ──────────────────────────────────────────────────────────────
  const sendText = async (content, { replyContext = null, tempId } = {}) => {
    const optimistic = {
      id: tempId,
      content,
      direction: 'outbound',
      status: 'pending',
      timestamp: new Date().toISOString(),
      sender_is_self: true,
      reply_to_message_preview: replyContext ? { id: replyContext.id, content: replyContext.content } : null,
    };
    setMessages((previous) => mergeMessages(previous, [optimistic]));
    stickToBottomRef.current = true;
    try {
      const body = { content, platform: selectedConversation.platform, conversation_id: selectedId, direction: 'outbound' };
      const response = replyContext ? await smartflowApi.replyToMessage(replyContext.id, body) : await smartflowApi.sendMessage(body);
      const saved = getApiData(response);
      setMessages((previous) => mergeMessages(previous.filter((item) => item.id !== tempId), saved?.id ? [saved] : []));
      return true;
    } catch (sendError) {
      setMessages((previous) => previous.filter((item) => item.id !== tempId));
      setError(errorMessage(sendError, t('conv_err_send_failed')));
      return false;
    }
  };

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !selectedConversation) return;
    const replyContext = replyTo;
    setSending(true);
    setError('');
    setDraft('');
    setReplyTo(null);
    const ok = await sendText(content, { replyContext, tempId: `temp-${Date.now()}` });
    if (!ok) {
      setDraft(content);
      setReplyTo(replyContext);
    }
    setSending(false);
  };

  const handleRetry = async (message) => {
    setRetryingId(message.id);
    await sendText(message.content, { tempId: `temp-${Date.now()}` });
    setRetryingId(null);
  };

  const handleAssign = async (assigneeId) => {
    if (!selectedId) return;
    setAssigning(true);
    try {
      upsertConversation(getApiData(await smartflowApi.assignConversation(selectedId, assigneeId)));
      refreshCountsSoon();
    } catch (assignError) {
      setError(errorMessage(assignError, t('conv_err_assign_failed')));
    } finally {
      setAssigning(false);
    }
  };

  const handleArchive = async () => {
    if (!selectedConversation) return;
    setBusyAction('archive');
    try {
      await smartflowApi.archiveConversation(selectedId, !selectedConversation.archived);
      setSelectedId(null);
      await loadList(1);
    } catch (archiveError) {
      setError(errorMessage(archiveError, t('conv_err_archive_failed')));
    } finally {
      setBusyAction('');
    }
  };

  const handleDelete = async () => {
    if (!selectedId || !window.confirm(t('conv_confirm_delete'))) return;
    setBusyAction('delete');
    try {
      await smartflowApi.deleteConversation(selectedId);
      setSelectedId(null);
      await loadList(1);
    } catch (deleteError) {
      setError(errorMessage(deleteError, t('conv_err_delete_failed')));
    } finally {
      setBusyAction('');
    }
  };

  const handleForward = async (target) => {
    const message = forwarding;
    setForwarding(null);
    try {
      await smartflowApi.forwardMessage(message.id, { conversation_id: target.id, platform: target.platform });
    } catch (forwardError) {
      setError(errorMessage(forwardError, t('conv_err_forward_failed')));
    }
  };

  // Meta only accepts replies within 24h of the customer's last message.
  const lastInboundAt = useMemo(() => [...messages].reverse().find((message) => message.direction === 'inbound')?.timestamp, [messages]);
  const replyWindowClosed =
    REPLY_WINDOW_CHANNELS.includes(selectedConversation?.platform) && Boolean(lastInboundAt) && hoursSince(lastInboundAt) > 24;

  const contact = contactDetails?.contact;
  const headerSubtitle = [channelMeta(selectedConversation?.platform).label, contact?.phone || contact?.email].filter(Boolean).join(' · ');

  return (
    <div className="@container flex h-[calc(100vh-10rem)] min-h-[520px] overflow-hidden rounded-3xl border border-[#243041]/60 bg-[#0c101b] shadow-xl">
      <ConversationList
        className={`${selectedId ? 'hidden @3xl:flex' : 'flex'} w-full @3xl:w-80 @5xl:w-96 @3xl:shrink-0`}
        conversations={conversations}
        loading={listLoading}
        loadingMore={loadingMore}
        hasMore={hasMore}
        onLoadMore={() => loadList(page + 1)}
        selectedId={selectedId}
        onSelect={setSelectedId}
        search={searchInput}
        onSearchChange={setSearchInput}
        channel={channel}
        onChannelChange={setChannel}
        assignee={assignee}
        onAssigneeChange={setAssignee}
        unreadOnly={unreadOnly}
        onUnreadOnlyChange={setUnreadOnly}
        summary={summary}
        membersById={membersById}
        loadError={listError}
        onRetry={() => loadList(1)}
        t={t}
      />

      <section className={`${selectedId ? 'flex' : 'hidden @3xl:flex'} min-w-0 flex-1 flex-col bg-slate-950/10`}>
        {error ? (
          <div role="alert" className="flex items-center gap-2 border-b border-rose-500/30 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200">
            <AlertTriangle size={13} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError('')} aria-label={t('conv_close')} className="cursor-pointer">
              <X size={13} />
            </button>
          </div>
        ) : null}

        {selectedId ? (
          <div className="flex min-h-0 flex-1">
            <div className={`${showInfo ? 'hidden @5xl:flex' : 'flex'} min-w-0 flex-1 flex-col`}>
              <header className="flex items-center gap-3 border-b border-[#243041]/40 bg-[#0c101b]/70 px-3 py-3 md:px-4">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label={t('conv_back_to_list')}
                  className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:text-white @3xl:hidden"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="relative h-10 w-10 shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#9333ea]/20 bg-[#9333ea]/10 text-sm font-black uppercase text-[#c084fc]">
                    {selectedConversation?.contact_name?.[0] || '?'}
                  </div>
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#0c101b]">
                    <ChannelIcon platform={selectedConversation?.platform} size={11} />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-extrabold text-white">{selectedConversation?.contact_name || t('conv_header_fallback')}</h2>
                  <p className="truncate text-[11px] font-semibold text-slate-400">{headerSubtitle}</p>
                </div>
                <div className="flex items-center gap-1 text-slate-400">
                  <button
                    type="button"
                    onClick={() => setShowInfo((value) => !value)}
                    aria-pressed={showInfo}
                    title={t('conv_contact_details')}
                    aria-label={t('conv_contact_details')}
                    className={`cursor-pointer rounded-xl p-2 hover:bg-slate-900 hover:text-[#c084fc] ${showInfo ? 'text-[#c084fc]' : ''}`}
                  >
                    <Info size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleArchive}
                    disabled={Boolean(busyAction)}
                    title={selectedConversation?.archived ? t('conv_unarchive') : t('conv_archive')}
                    aria-label={selectedConversation?.archived ? t('conv_unarchive') : t('conv_archive')}
                    className="cursor-pointer rounded-xl p-2 hover:bg-slate-900 hover:text-[#c084fc] disabled:opacity-50"
                  >
                    {busyAction === 'archive' ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : selectedConversation?.archived ? (
                      <ArchiveRestore size={16} />
                    ) : (
                      <Archive size={16} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={Boolean(busyAction)}
                    title={t('conv_delete')}
                    aria-label={t('conv_delete')}
                    className="cursor-pointer rounded-xl p-2 hover:bg-rose-950/30 hover:text-rose-400 disabled:opacity-50"
                  >
                    {busyAction === 'delete' ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  </button>
                </div>
              </header>

              <div ref={scrollRef} onScroll={handleThreadScroll} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
                {threadLoading ? (
                  <MessagesThreadSkeleton />
                ) : (
                  <div className="space-y-3">
                    {hasOlder ? (
                      <div className="flex justify-center">
                        <button
                          type="button"
                          onClick={() => loadThread(selectedId, threadPage + 1)}
                          disabled={loadingOlder}
                          className="cursor-pointer rounded-full border border-slate-800 px-4 py-1.5 text-[11px] font-bold text-slate-300 hover:border-[#9333ea]/40 disabled:opacity-60"
                        >
                          {loadingOlder ? <Loader2 size={12} className="inline animate-spin" /> : t('conv_load_older')}
                        </button>
                      </div>
                    ) : null}
                    {messages.length ? (
                      messages.map((message, index) => (
                        <div key={message.id}>
                          {index === 0 || !sameDay(messages[index - 1].timestamp, message.timestamp) ? (
                            <div className="my-3 flex justify-center">
                              <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold text-slate-400">
                                {dayLabel(message.timestamp, t)}
                              </span>
                            </div>
                          ) : null}
                          <MessageBubble
                            message={message}
                            onReply={setReplyTo}
                            onForward={setForwarding}
                            onRetry={handleRetry}
                            retrying={retryingId === message.id}
                            t={t}
                          />
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                        <MessageSquare size={36} className="mb-2 opacity-30" />
                        <p className="text-xs font-semibold">{t('conv_no_messages_yet')}</p>
                      </div>
                    )}
                    {typing ? (
                      <p className="px-1 text-[11px] font-semibold text-slate-400">
                        {typing.actor_name || selectedConversation?.contact_name} {t('conv_is_typing')}…
                      </p>
                    ) : null}
                  </div>
                )}
              </div>

              <Composer
                conversation={selectedConversation}
                value={draft}
                onChange={setDraft}
                onSend={handleSend}
                sending={sending}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                recentMessages={messages}
                replyWindowClosed={replyWindowClosed}
                t={t}
              />
            </div>

            {showInfo ? (
              <ContactPanel
                details={contactDetails}
                loading={contactLoading}
                onClose={() => setShowInfo(false)}
                onOpenConversation={(id) => {
                  setShowInfo(false);
                  setSelectedId(id);
                }}
                conversation={selectedConversation}
                members={members}
                onAssign={handleAssign}
                assigning={assigning}
                t={t}
              />
            ) : null}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-slate-500">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#9333ea]/10">
              <MessageSquare size={32} className="text-[#c084fc]" />
            </div>
            <p className="text-sm font-bold text-white">{t('conv_select_conversation')}</p>
            <p className="max-w-xs text-xs">{t('conv_choose_from_left')}</p>
          </div>
        )}
      </section>

      {forwarding ? (
        <ModalShell titleId={forwardTitleId} onClose={() => setForwarding(null)} className="p-0">
          <div className="flex max-h-[70vh] flex-col">
            <h3 id={forwardTitleId} className="border-b border-[#243041] p-4 text-sm font-bold text-white">
              {t('conv_forward_to')}
            </h3>
            <div className="flex-1 overflow-y-auto p-2">
              {conversations.filter((item) => item.id !== selectedId).length ? (
                conversations
                  .filter((item) => item.id !== selectedId)
                  .map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleForward(item)}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-900/60"
                    >
                      <ChannelIcon platform={item.platform} size={14} />
                      <span className="flex-1 truncate text-xs font-bold text-slate-200">{item.contact_name}</span>
                      <span className="text-[10px] text-slate-500">{channelMeta(item.platform).label}</span>
                    </button>
                  ))
              ) : (
                <p className="p-6 text-center text-xs text-slate-500">{t('conv_no_forward_targets')}</p>
              )}
            </div>
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
