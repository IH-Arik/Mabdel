import { useRef } from 'react';
import { AlertCircle, Loader2, MessageSquare, Plug, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import ChannelIcon from './ChannelIcon';
import { INBOX_CHANNELS, channelMeta } from '../../constants/channels';
import { ConversationSkeletonList } from '../Skeletons/MessageSkeleton';
import { formatListTime } from './inboxUtils';

const chip = (active) =>
  `inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors ${
    active ? 'bg-[#9333ea]/20 text-[#c084fc]' : 'text-slate-400 hover:bg-slate-900 hover:text-white'
  }`;

function ConversationRow({ conversation, selected, onSelect, assigneeName, t }) {
  const failed = conversation.last_message_status === 'failed';
  const unread = conversation.unread_count > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={selected ? 'true' : undefined}
      className={`w-full border-b border-[#243041]/20 px-4 py-3 text-left transition-colors hover:bg-slate-900/40 ${
        selected ? 'border-l-4 border-l-[#9333ea] bg-[#9333ea]/10' : 'border-l-4 border-l-transparent'
      }`}
    >
      <div className="flex gap-3">
        <div className="relative h-11 w-11 shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-sm font-black uppercase text-[#c084fc]">
            {conversation.contact_name?.[0] || '?'}
          </div>
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-[#0c101b] bg-[#0c101b]">
            <ChannelIcon platform={conversation.platform} size={11} />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className={`truncate text-[13px] ${unread ? 'font-extrabold text-white' : 'font-bold text-slate-200'}`}>
              {conversation.contact_name}
            </h4>
            <span className={`shrink-0 text-[10px] font-bold ${unread ? 'text-[#c084fc]' : 'text-slate-500'}`}>
              {formatListTime(conversation.last_message_at)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {failed ? <AlertCircle size={12} className="shrink-0 text-rose-400" aria-label={t('conv_status_failed')} /> : null}
            <span className={`truncate text-[11px] ${failed ? 'text-rose-300' : unread ? 'text-slate-200' : 'text-[#A4B0B7]'}`}>
              {conversation.last_message_direction === 'outbound' && conversation.last_message_preview ? `${t('conv_you_prefix')} ` : ''}
              {conversation.last_message_preview || t('conv_no_messages')}
            </span>
          </div>
          {assigneeName ? (
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
              {t('conv_assigned_to_name', { name: assigneeName })}
            </p>
          ) : null}
        </div>
        {unread ? (
          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center self-center rounded-full bg-[#9333ea] px-1.5 text-[10px] font-black text-white">
            {Math.min(conversation.unread_count, 99)}
          </span>
        ) : null}
      </div>
    </button>
  );
}

export default function ConversationList({
  conversations,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  channel,
  onChannelChange,
  assignee,
  onAssigneeChange,
  unreadOnly,
  onUnreadOnlyChange,
  summary,
  membersById,
  loadError,
  onRetry,
  className = '',
  t,
}) {
  const listRef = useRef(null);
  const activeCounts = summary?.conversation_counts || {};
  const archivedCounts = summary?.archived_conversation_counts || {};
  const sum = (counts) => Object.values(counts).reduce((total, value) => total + (Number(value) || 0), 0);

  const tabs = [
    { key: 'all', label: t('conv_filter_all'), count: sum(activeCounts) },
    ...INBOX_CHANNELS.map((key) => ({ key, label: channelMeta(key).label, count: activeCounts[key] || 0 })),
    { key: 'archived', label: t('conv_filter_archived'), count: sum(archivedCounts) },
  ];
  const noFilters = !search.trim() && channel === 'all' && assignee === 'all' && !unreadOnly;

  const handleScroll = (event) => {
    const element = event.currentTarget;
    if (hasMore && !loadingMore && element.scrollHeight - element.scrollTop - element.clientHeight < 200) {
      onLoadMore();
    }
  };

  return (
    <div className={`flex min-h-0 flex-col border-r border-[#243041]/40 bg-slate-950/20 ${className}`}>
      <div className="space-y-2.5 border-b border-[#243041]/30 p-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('conv_search_placeholder')}
            aria-label={t('conv_search_placeholder')}
            className="w-full rounded-xl border border-slate-900 bg-slate-950 py-2 pl-9 pr-9 text-xs font-semibold text-white placeholder-slate-600 focus:border-[#9333ea]/40 focus:outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label={t('conv_clear_search')}
              className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-slate-500 hover:text-white"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t('conv_channels_label')}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={channel === tab.key}
              onClick={() => onChannelChange(tab.key)}
              className={chip(channel === tab.key)}
            >
              {INBOX_CHANNELS.includes(tab.key) ? <ChannelIcon platform={tab.key} size={12} /> : null}
              {tab.label}
              <span className="opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {[
            { key: 'all', label: t('conv_assignee_all') },
            { key: 'me', label: t('conv_assignee_mine'), count: summary?.assigned_to_me_count },
            { key: 'unassigned', label: t('conv_assignee_unassigned'), count: summary?.unassigned_count },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={assignee === option.key}
              onClick={() => onAssigneeChange(option.key)}
              className={chip(assignee === option.key)}
            >
              {option.label}
              {option.count != null ? <span className="opacity-70">{option.count}</span> : null}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-slate-400">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(event) => onUnreadOnlyChange(event.target.checked)}
              className="accent-[#9333ea]"
            />
            {t('conv_unread_only')}
          </label>
        </div>
      </div>

      <div ref={listRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <ConversationSkeletonList />
        ) : loadError ? (
          <div className="p-8 text-center text-slate-400">
            <AlertCircle size={28} className="mx-auto mb-2 text-rose-400" />
            <p className="text-xs font-semibold">{loadError}</p>
            <button type="button" onClick={onRetry} className="mt-3 cursor-pointer text-xs font-bold text-[#c084fc] hover:underline">
              {t('conv_retry')}
            </button>
          </div>
        ) : conversations.length ? (
          <>
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                selected={selectedId === conversation.id}
                onSelect={onSelect}
                assigneeName={conversation.assigned_to ? membersById[conversation.assigned_to]?.name : null}
                t={t}
              />
            ))}
            {loadingMore ? (
              <div className="flex justify-center p-4 text-slate-500">
                <Loader2 size={16} className="animate-spin" />
              </div>
            ) : null}
          </>
        ) : (
          <div className="p-8 text-center text-slate-500">
            <MessageSquare size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs font-semibold">{noFilters ? t('conv_empty_inbox') : t('conv_no_filter_match')}</p>
            {noFilters ? (
              <Link
                to="/integrations"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#9333ea] px-4 py-2 text-xs font-bold text-white hover:bg-[#a855f7]"
              >
                <Plug size={14} />
                {t('conv_connect_channel')}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
