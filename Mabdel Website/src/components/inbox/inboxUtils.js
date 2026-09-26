import { formatCstDate, formatCstTime } from '../../utils/dateUtils';
import { CUSTOMER_CHANNELS } from '../../constants/channels';

export const getApiData = (response) => response?.data?.data ?? response?.data ?? response ?? {};

export const toList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.messages)) return value.messages;
  return [];
};

export const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;

export const isCustomerConversation = (conversation) =>
  Boolean(conversation) &&
  CUSTOMER_CHANNELS.includes(conversation.platform) &&
  !conversation.is_global_chat &&
  !conversation.is_ai_assistant;

export const normalizeConversation = (conversation, t) => ({
  ...conversation,
  id: conversation?.id || conversation?._id,
  contact_name: conversation?.contact_name || conversation?.title || t('conv_anonymous'),
  last_message_preview: conversation?.last_message_preview || '',
  last_message_at: conversation?.last_message_at || conversation?.updated_at || conversation?.created_at,
  unread_count: Number(conversation?.unread_count || 0),
});

export const normalizeMessage = (message) => ({
  ...message,
  id: message?.id || message?._id,
  content: message?.content || '',
  direction: message?.direction || (message?.sender_is_self ? 'outbound' : 'inbound'),
  timestamp: message?.timestamp || message?.created_at,
  attachments: Array.isArray(message?.attachments) ? message.attachments : [],
});

const byTimeAsc = (left, right) => new Date(left.timestamp || 0).getTime() - new Date(right.timestamp || 0).getTime();

export const mergeMessages = (current, incoming) => {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    const normalized = normalizeMessage(item);
    if (!normalized.id) return;
    byId.set(normalized.id, { ...(byId.get(normalized.id) || {}), ...normalized });
  });
  return Array.from(byId.values()).sort(byTimeAsc);
};

export const sortConversations = (list) =>
  [...list].sort((left, right) => new Date(right.last_message_at || 0).getTime() - new Date(left.last_message_at || 0).getTime());

// Calendar day in the app's display timezone (CST), for "is it today?" checks.
const cstDayKey = (value) => formatCstDate(value, { year: 'numeric', month: '2-digit', day: '2-digit' });

const daysAgo = (value) => {
  const then = new Date(cstDayKey(value));
  const today = new Date(cstDayKey(new Date()));
  return Math.round((today.getTime() - then.getTime()) / 86400000);
};

// Sidebar time: 3:42 PM today, the weekday within a week, else the date.
export const formatListTime = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '';
  const age = daysAgo(value);
  if (age <= 0) return formatCstTime(value);
  if (age < 7) return formatCstDate(value, { weekday: 'short', month: undefined, day: undefined, year: undefined });
  const sameYear = cstDayKey(value).slice(-4) === cstDayKey(new Date()).slice(-4);
  return formatCstDate(value, sameYear ? { year: undefined } : {});
};

export const formatBubbleTime = (value) => (value ? formatCstTime(value) : '');

export const dayLabel = (value, t) => {
  const age = daysAgo(value);
  if (age <= 0) return t('conv_day_today');
  if (age === 1) return t('conv_day_yesterday');
  return formatCstDate(value, { weekday: 'short' });
};

export const sameDay = (left, right) => Boolean(left && right) && cstDayKey(left) === cstDayKey(right);

export const hoursSince = (value) => (value ? (Date.now() - new Date(value).getTime()) / 3600000 : Infinity);
