import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  CalendarCheck2,
  FileText,
  Megaphone,
  Mic,
  MessageSquare,
  PhoneCall,
  Plus,
  ReceiptText,
  TrendingUp,
  Clock,
  Users,
} from 'lucide-react';
import { smartflowApi } from '../api/services';
import { formatCstDateTime } from '../utils/dateUtils';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useLanguage } from '../context/LanguageContext';

const HOME_DOC_ITEM_DEFS = [
  { id: 'agreement', key: 'dash_doc_agreement', icon: FileText, action: { path: '/documents', state: { tab: 'agreements' } } },
  { id: 'invoice', key: 'dash_doc_invoice', icon: ReceiptText, action: { path: '/invoices' } },
  { id: 'lease', key: 'dash_doc_lease', icon: Bot, action: { path: '/documents', state: { tab: 'leases' } } },
  { id: 'post', key: 'dash_doc_create_post', icon: Plus, action: { path: '/create-post' } },
];

const PLATFORM_BADGE_CONFIG = {
  instagram: { label: 'IG', backgroundColor: '#EA4C89', color: '#FFFFFF' },
  facebook: { label: 'f', backgroundColor: '#1877F2', color: '#FFFFFF' },
  x_twitter: { label: 'X', backgroundColor: '#FFFFFF', color: '#000000' },
  x: { label: 'X', backgroundColor: '#FFFFFF', color: '#000000' },
  whatsapp: { label: 'W', backgroundColor: '#25D366', color: '#FFFFFF' },
  telegram: { label: 'TG', backgroundColor: '#2AABEE', color: '#FFFFFF' },
  google_business: { label: 'G', backgroundColor: '#F4F4F4', color: '#EA4335' },
  linkedin: { label: 'in', backgroundColor: '#0A66C2', color: '#FFFFFF' },
};

function getDisplayName(user, t) {
  const emailPrefix = String(user?.email || user?.client_email || '')
    .split('@')[0]
    .trim();

  return (
    user?.full_name ||
    user?.fullName ||
    user?.name ||
    user?.username ||
    (emailPrefix ? emailPrefix : t('dash_fallback_there'))
  );
}

function normalizeConversationList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.data?.items)) return payload.data.data.items;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function normalizeContacts(payload) {
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data?.data?.items)) return payload.data.data.items;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload)) return payload;
  return [];
}

function normalizeCalls(payload) {
  const body = payload?.data?.data ?? payload?.data ?? payload;
  if (Array.isArray(body?.calls)) return body.calls;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body)) return body;
  return [];
}

function normalizeIntegrationItems(payload) {
  const body = payload?.data?.data ?? payload?.data ?? payload;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body)) return body;
  return [];
}

function normalizeCalendarEvents(payload) {
  const body = payload?.data?.data ?? payload?.data ?? payload;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body)) return body;
  return [];
}

function getLatestPeerName(thread, t) {
  return (
    thread?.contact_name ||
    thread?.contactName ||
    thread?.title ||
    thread?.directPeer?.fullName ||
    thread?.directPeer?.name ||
    thread?.peer?.full_name ||
    thread?.peer?.fullName ||
    thread?.peer?.name ||
    t('dash_no_contact')
  );
}

function getLatestMessageText(thread, t) {
  const text =
    thread?.last_message_preview ||
    thread?.lastMessagePreview ||
    thread?.lastMessage?.text ||
    thread?.last_message?.text ||
    thread?.last_message?.body ||
    thread?.lastMessage?.body ||
    '';

  return String(text || '').trim() || t('dash_no_messages_yet');
}

function getAvatarLabel(name, t) {
  return String(name || t('dash_fallback_user')).trim().charAt(0).toUpperCase() || 'U';
}

const AvatarStack = memo(function AvatarStack({ avatars, countText, size = 36, overlap = -10, t }) {
  return (
    <div className="flex items-center">
      {avatars.map((avatar, index) => (
        <div
          key={`${avatar.name}-${index}`}
          className="border-2 border-[#131A24] bg-slate-900 overflow-hidden flex items-center justify-center font-bold text-[11px] text-[#9333ea]"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            marginLeft: index === 0 ? 0 : overlap,
          }}
        >
          {avatar.uri ? (
            <img src={avatar.uri} alt={avatar.name} className="w-full h-full object-cover" />
          ) : (
            getAvatarLabel(avatar.name, t)
          )}
        </div>
      ))}
      {countText ? (
        <div
          className="border-2 border-[#131A24] bg-[#0D131D] flex items-center justify-center font-bold text-[10px] text-[#A4B0B7]"
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            marginLeft: overlap,
          }}
        >
          {countText}
        </div>
      ) : null}
    </div>
  );
});

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12 animate-pulse text-white">
      <div className="h-10 w-72 rounded-2xl bg-[#131A24]" />
      <div className="h-16 rounded-[26px] bg-[#131A24]" />
      <div className="h-14 rounded-[18px] bg-[#131A24]" />
      
      {/* KPI skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-2xl bg-[#131A24]" />
        ))}
      </div>

      <div className="h-48 rounded-[26px] bg-[#131A24]" />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5">
        <div className="h-64 rounded-[26px] bg-[#131A24]" />
        <div className="space-y-5">
          <div className="h-36 rounded-[26px] bg-[#131A24]" />
          <div className="h-24 rounded-[26px] bg-[#131A24]" />
        </div>
      </div>
      <div className="h-44 rounded-[26px] bg-[#131A24]" />
      <div className="h-72 rounded-[26px] bg-[#131A24]" />
    </div>
  );
}

function SectionCard({ children, className = '', onClick }) {
  const base =
    'bg-[#131A24] border border-[#243041] rounded-[26px] p-5 md:p-6 text-left shadow-lg';

  if (!onClick) {
    return <div className={`${base} ${className}`}>{children}</div>;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={`${base} ${className} cursor-pointer transition-all hover:border-[#9333ea]/40 active:scale-[0.995]`}
    >
      {children}
    </div>
  );
}

/* Memoized sub-components to eliminate unnecessary re-renders */
const KpiMetricsRow = memo(function KpiMetricsRow({ totalChats, totalContacts, totalCalls, minutesSaved }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-4 flex items-center justify-between shadow-md">
        <div>
          <span className="text-[11px] font-bold text-[#A4B0B7] uppercase tracking-wider block">Conversations</span>
          <span className="text-2xl font-black text-white mt-1 block">{totalChats}</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
          <MessageSquare size={20} />
        </div>
      </div>

      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-4 flex items-center justify-between shadow-md">
        <div>
          <span className="text-[11px] font-bold text-[#A4B0B7] uppercase tracking-wider block">Contacts</span>
          <span className="text-2xl font-black text-white mt-1 block">{totalContacts}</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
          <Users size={20} />
        </div>
      </div>

      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-4 flex items-center justify-between shadow-md">
        <div>
          <span className="text-[11px] font-bold text-[#A4B0B7] uppercase tracking-wider block">AI Calls</span>
          <span className="text-2xl font-black text-white mt-1 block">{totalCalls}</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
          <PhoneCall size={20} />
        </div>
      </div>

      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-4 flex items-center justify-between shadow-md">
        <div>
          <span className="text-[11px] font-bold text-[#A4B0B7] uppercase tracking-wider block">Mins Saved</span>
          <span className="text-2xl font-black text-[#9333ea] mt-1 block">{minutesSaved}m</span>
        </div>
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <Clock size={20} />
        </div>
      </div>
    </div>
  );
});

const UnifiedConversationsCard = memo(function UnifiedConversationsCard({
  totalChats,
  latestPeerName,
  truncatedLatestMessage,
  inboxAvatars,
  inboxCountText,
  openUnifiedConversations,
  t,
}) {
  return (
    <SectionCard>
      <div className="flex justify-between items-center">
        <div className="bg-[#13263D] text-[#60A5FA] font-extrabold px-3 py-1 rounded-[6px] tracking-wider uppercase text-[10px]">
          {t('dash_inbox')}
        </div>
        <span className="text-xs text-[#CBD5E1] font-semibold">
          {t('dash_chats_count', { n: totalChats })}
        </span>
      </div>

      <h3 className="text-xl font-bold text-white mt-4 tracking-tight">{t('dash_unified_conversations')}</h3>
      <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
        {t('dash_latest_message', { name: latestPeerName, message: truncatedLatestMessage })}
      </p>

      <div className="flex items-center justify-between mt-6 pt-2">
        <AvatarStack avatars={inboxAvatars} countText={inboxCountText} t={t} />
        <button
          type="button"
          onClick={openUnifiedConversations}
          className="px-6 py-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-[#02080B] font-extrabold text-xs rounded-full active:scale-95 transition-all shadow-md shadow-[#9333ea]/10 cursor-pointer"
        >
          {t('dash_view_all')}
        </button>
      </div>
    </SectionCard>
  );
});

const ContactsCard = memo(function ContactsCard({
  totalContacts,
  contactAvatars,
  contactCountText,
  openContacts,
  t,
}) {
  return (
    <SectionCard onClick={openContacts} className="min-h-[260px]">
      <div className="w-12 h-12 rounded-2xl bg-[#0D1822] flex items-center justify-center">
        <Users size={24} className="text-[#60A5FA]" />
      </div>
      <div className="mt-5 flex items-center justify-between gap-3">
        <h3 className="text-xl font-bold text-white">{t('dash_contacts')}</h3>
        <span className="text-xs font-semibold text-[#CBD5E1]">
          {t('dash_contacts_count', { n: totalContacts })}
        </span>
      </div>
      <div className="mt-5">
        <AvatarStack avatars={contactAvatars} countText={contactCountText} size={34} overlap={-10} t={t} />
      </div>
      <div className="mt-8">
        <button
          type="button"
          onClick={openContacts}
          className="px-6 py-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-[#02080B] font-extrabold text-xs rounded-full active:scale-95 transition-all shadow-md shadow-[#9333ea]/10 cursor-pointer"
        >
          {t('dash_view_all')}
        </button>
      </div>
    </SectionCard>
  );
});

const CalendarWidget = memo(function CalendarWidget({
  nextUpcomingEvent,
  upcomingEvents,
  upcomingEventLabel,
  openScheduleMeeting,
  t,
}) {
  return (
    <SectionCard onClick={openScheduleMeeting}>
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-bold text-[#CBD5E1] tracking-wider uppercase">{t('dash_upcoming')}</span>
        <CalendarCheck2 size={23} className="text-[#60A5FA]" />
      </div>
      <h3 className="text-xl font-bold text-white mt-3">{t('dash_calendar')}</h3>
      <div className="mt-4 min-h-[52px] text-left">
        {nextUpcomingEvent ? (
          <>
            <p className="text-sm font-bold text-white truncate">{nextUpcomingEvent.title || t('dash_untitled_meeting')}</p>
            <p className="text-xs text-[#CBD5E1] mt-1">
              {t('dash_upcoming_meetings_count', { n: upcomingEvents.length })}
            </p>
            <p className="text-xs text-[#CBD5E1] mt-1">{upcomingEventLabel}</p>
          </>
        ) : (
          <p className="text-xs text-[#CBD5E1] leading-relaxed">{upcomingEventLabel}</p>
        )}
      </div>
      <button
        type="button"
        onClick={openScheduleMeeting}
        className="mt-5 px-6 py-2.5 bg-[#9333ea] hover:bg-[#a855f7] text-[#02080B] font-extrabold text-xs rounded-full active:scale-95 transition-all shadow-md shadow-[#9333ea]/10 cursor-pointer"
      >
        {t('dash_add_your_calendar')}
      </button>
    </SectionCard>
  );
});

const IntegrationsWidget = memo(function IntegrationsWidget({
  connectedBadges,
  openSocialIntegrations,
  t,
}) {
  return (
    <SectionCard>
      <span className="text-[10px] font-bold text-[#CBD5E1] tracking-wider uppercase">{t('dash_integrations')}</span>
      <div className="flex items-center gap-2.5 mt-3">
        {connectedBadges.map((item) => (
          <div
            key={item.id}
            className="w-8 h-8 rounded-full border border-[#243041] flex items-center justify-center text-[10px] font-bold"
            style={{ backgroundColor: item.backgroundColor, color: item.color }}
            title={item.id}
          >
            {item.label}
          </div>
        ))}
        <button
          type="button"
          onClick={openSocialIntegrations}
          className="w-8 h-8 rounded-full bg-[#0D131D] border border-[#243041] border-dashed flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          aria-label={t('dash_open_social_integrations')}
        >
          <Plus size={16} />
        </button>
      </div>
    </SectionCard>
  );
});

const DocumentsGrid = memo(function DocumentsGrid({ navigate, t }) {
  return (
    <SectionCard>
      <h3 className="text-xl font-bold text-white">{t('dash_documents')}</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        {HOME_DOC_ITEM_DEFS.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => navigate(item.action.path, item.action.state ? { state: item.action.state } : undefined)}
            className="bg-[#122437] border border-[#254669] rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#3B82F6]/40 active:scale-95 transition-all text-center min-h-[112px]"
          >
            <div className="w-11 h-11 rounded-2xl bg-[#13263D] flex items-center justify-center text-[#60A5FA]">
              <item.icon size={22} />
            </div>
            <span className="text-xs font-bold text-[#E9F2FF] leading-tight">{t(item.key)}</span>
          </button>
        ))}
      </div>
    </SectionCard>
  );
});

const AiCallAnalyticsCard = memo(function AiCallAnalyticsCard({
  totalCallsCount,
  minutesSavedCount,
  analyticsCallRows,
  openCallHistory,
  t,
}) {
  return (
    <SectionCard onClick={openCallHistory}>
      <div className="flex items-center gap-2">
        <PhoneCall size={21} className="text-[#12D2ED]" />
        <h3 className="text-xl font-bold text-white tracking-tight">{t('dash_ai_call_analytics')}</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div className="bg-[#0A1019] border border-[#243246] rounded-2xl p-4">
          <span className="text-[10px] font-bold text-[#CBD5E1] uppercase tracking-wider block">{t('dash_total_calls')}</span>
          <span className="text-3xl font-black text-white mt-1 block">{totalCallsCount}</span>
        </div>
        <div className="bg-[#0A1019] border border-[#243246] rounded-2xl p-4">
          <span className="text-[10px] font-bold text-[#CBD5E1] uppercase tracking-wider block">{t('dash_minutes_saved')}</span>
          <span className="text-3xl font-black text-[#9333ea] mt-1 block">{minutesSavedCount}</span>
        </div>
      </div>

      <div className="space-y-3 mt-5">
        {analyticsCallRows.length > 0 ? (
          analyticsCallRows.map((item) => (
            <div key={item.id} className="bg-slate-950/30 border border-slate-900 rounded-2xl p-4 flex items-center justify-between gap-4 text-left">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.status === 'missed' ? 'bg-rose-950/40 text-rose-400' : 'bg-[#0F3A48] text-[#11D1ED]'}`}>
                  <PhoneCall size={16} />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-200 truncate">{item.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{item.subtitle}</div>
                </div>
              </div>
              {item.rightType === 'badge' ? (
                <div className="text-[10px] font-bold rounded-full px-3 py-1 bg-[#184833] text-[#3ADF87] uppercase tracking-wider shrink-0">
                  {item.rightText}
                </div>
              ) : (
                <div className="text-xs font-semibold text-[#11D1ED] shrink-0">
                  {item.rightText}
                </div>
              )}
            </div>
          ))
        ) : (
          <p className="text-xs text-slate-400">{t('dash_no_recent_calls')}</p>
        )}
      </div>
    </SectionCard>
  );
});

let dashboardCache = null;

export default function Dashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuthStore();
  const syncUnreadCount = useNotificationStore((state) => state.syncUnreadCount);
  const [isLoading, setIsLoading] = useState(!dashboardCache);
  const [threads, setThreads] = useState(() => dashboardCache?.threads || []);
  const [totalConversationsCount, setTotalConversationsCount] = useState(() => dashboardCache?.totalConversationsCount || 0);
  const [contacts, setContacts] = useState(() => dashboardCache?.contacts || []);
  const [totalContactsCount, setTotalContactsCount] = useState(() => dashboardCache?.totalContactsCount || 0);
  const [callSummary, setCallSummary] = useState(() => dashboardCache?.callSummary || null);
  const [recentCalls, setRecentCalls] = useState(() => dashboardCache?.recentCalls || []);
  const [integrationItems, setIntegrationItems] = useState(() => dashboardCache?.integrationItems || []);
  const [calendarEvents, setCalendarEvents] = useState(() => dashboardCache?.calendarEvents || []);

  const fetchAll = useCallback(async () => {
    try {
      const [conversationsRes, contactsRes, callSummaryRes, callsRes, integrationsRes, calendarEventsRes] =
        await Promise.allSettled([
          smartflowApi.getConversations({ page: 1, page_size: 100 }),
          smartflowApi.getContacts({ page: 1, page_size: 100 }),
          smartflowApi.getCallSummary(),
          smartflowApi.getCalls({ page: 1, page_size: 5 }),
          smartflowApi.getIntegrationStatus(),
          smartflowApi.getCalendarEvents({ page: 1, page_size: 25, upcoming_only: true }),
        ]);

      let nextThreads = threads;
      let nextTotalConversations = totalConversationsCount;
      let nextContacts = contacts;
      let nextTotalContacts = totalContactsCount;
      let nextCallSummary = callSummary;
      let nextRecentCalls = recentCalls;
      let nextIntegrations = integrationItems;
      let nextCalendarEvents = calendarEvents;

      if (conversationsRes.status === 'fulfilled') {
        const payload = conversationsRes.value?.data?.data || conversationsRes.value?.data || conversationsRes.value;
        nextThreads = normalizeConversationList(conversationsRes.value);
        nextTotalConversations = payload?.pagination?.total ?? payload?.total ?? nextThreads.length;
        setThreads(nextThreads);
        setTotalConversationsCount(nextTotalConversations);
      }

      if (contactsRes.status === 'fulfilled') {
        // The backend caps page_size at 100, so with 400+ real contacts,
        // contacts.length here is only ever "how many fit on page 1" — never
        // the real total. Same bug as the Contacts page had; fixed the same
        // way, by reading the backend's own pagination.total instead of
        // counting the (necessarily incomplete) fetched page.
        const contactsPayload = contactsRes.value?.data?.data || contactsRes.value?.data || contactsRes.value;
        nextContacts = normalizeContacts(contactsRes.value);
        nextTotalContacts = contactsPayload?.pagination?.total ?? nextContacts.length;
        setContacts(nextContacts);
        setTotalContactsCount(nextTotalContacts);
      }

      if (callSummaryRes.status === 'fulfilled') {
        nextCallSummary = callSummaryRes.value?.data?.data || callSummaryRes.value?.data || null;
        setCallSummary(nextCallSummary);
      }

      if (callsRes.status === 'fulfilled') {
        nextRecentCalls = normalizeCalls(callsRes.value);
        setRecentCalls(nextRecentCalls);
      }

      if (integrationsRes.status === 'fulfilled') {
        nextIntegrations = normalizeIntegrationItems(integrationsRes.value);
        setIntegrationItems(nextIntegrations);
      }

      if (calendarEventsRes.status === 'fulfilled') {
        nextCalendarEvents = normalizeCalendarEvents(calendarEventsRes.value);
        setCalendarEvents(nextCalendarEvents);
      }

      dashboardCache = {
        threads: nextThreads,
        totalConversationsCount: nextTotalConversations,
        contacts: nextContacts,
        totalContactsCount: nextTotalContacts,
        callSummary: nextCallSummary,
        recentCalls: nextRecentCalls,
        integrationItems: nextIntegrations,
        calendarEvents: nextCalendarEvents,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll().catch((error) => {
      console.error('Failed to fetch dashboard data:', error);
      setIsLoading(false);
    });
  }, [fetchAll]);

  useEffect(() => {
    syncUnreadCount().catch(() => {});
  }, [syncUnreadCount]);

  useEffect(() => {
    const handleCallSync = () => {
      fetchAll().catch(() => {});
    };
    window.addEventListener('mabdel:calls-sync', handleCallSync);
    return () => {
      window.removeEventListener('mabdel:calls-sync', handleCallSync);
    };
  }, [fetchAll]);

  const openVoiceAssistant = useCallback(() => navigate('/voice-conversation', { state: { autoStart: true } }), [navigate]);
  const openBulkMessaging = useCallback(() => navigate('/bulk-messaging'), [navigate]);
  const openUnifiedConversations = useCallback(() => navigate('/unified-conversation'), [navigate]);
  const openContacts = useCallback(() => navigate('/contacts'), [navigate]);
  const openScheduleMeeting = useCallback(() => navigate('/calendar'), [navigate]);
  const openSocialIntegrations = useCallback(() => navigate('/integrations'), [navigate]);
  const openCallHistory = useCallback(() => navigate('/calls'), [navigate]);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const displayName = getDisplayName(user, t);
  const totalChats = totalConversationsCount || threads.length;
  const latestThread = totalChats > 0 ? threads[0] : null;
  const latestPeerName = latestThread ? getLatestPeerName(latestThread, t) : t('dash_no_contact');
  const latestMessage = latestThread ? getLatestMessageText(latestThread, t) : t('dash_no_messages_yet');
  const truncatedLatestMessage =
    latestMessage.length > 50 ? `${latestMessage.slice(0, 47)}...` : latestMessage;

  const inboxAvatars = threads.slice(0, 2).map((thread) => ({
    uri:
      thread?.avatar_url ||
      thread?.avatar ||
      thread?.directPeer?.profileImage ||
      thread?.directPeer?.avatar ||
      thread?.peer?.avatar_url ||
      thread?.peer?.avatar ||
      '',
    name: getLatestPeerName(thread, t),
  }));
  const inboxCountText = totalChats > inboxAvatars.length ? `+${totalChats - inboxAvatars.length}` : null;

  const contactAvatars = contacts.slice(0, 3).map((contact) => ({
    uri:
      contact?.avatar_url ||
      contact?.avatar ||
      contact?.profileImage ||
      contact?.image ||
      '',
    name:
      contact?.name ||
      contact?.full_name ||
      contact?.fullName ||
      contact?.first_name ||
      contact?.firstName ||
      String(contact?.email || '').split('@')[0] ||
      t('dash_fallback_user'),
  }));
  const totalContacts = totalContactsCount || contacts.length;
  const contactCountText =
    totalContacts > contactAvatars.length ? `+${totalContacts - contactAvatars.length}` : null;

  const connectedBadges = integrationItems
    .filter((item) => item?.connected)
    .map((item) => {
      const platform = item?.platform ?? '';
      const cfg = PLATFORM_BADGE_CONFIG[platform] ?? {
        label: platform.slice(0, 2).toUpperCase(),
        backgroundColor: '#1D2A38',
        color: '#FFFFFF',
      };
      return { id: platform, ...cfg };
    });

  const totalCallsCount = callSummary?.total_calls ?? 0;
  const minutesSavedCount = callSummary?.total_minutes_saved ?? 0;
  const upcomingEvents = calendarEvents
    .filter((item) => item?.starts_at && new Date(item.starts_at).getTime() > Date.now())
    .sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime());
  const nextUpcomingEvent = upcomingEvents[0] ?? null;
  const upcomingEventLabel = nextUpcomingEvent
    ? formatCstDateTime(nextUpcomingEvent.starts_at)
    : t('dash_no_upcoming_meetings');

  const analyticsCallRows = recentCalls.slice(0, 3).map((call, index) => {
    const durationMinutes = call?.duration ? Math.round(Number(call.duration) / 60) : null;
    return {
      id: call?._id || call?.id || `call-${index}`,
      name: call?.contact_name || call?.caller_name || call?.phone_number || t('dash_unknown_caller'),
      subtitle: call?.ai_summary?.purpose || call?.summary || call?.status || '',
      rightType: durationMinutes ? 'text' : 'badge',
      rightText: durationMinutes
        ? `${durationMinutes}m`
        : call?.status === 'completed'
          ? t('dash_call_done')
          : t('dash_ai_ready'),
      status: call?.status,
    };
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12 text-white">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[30px] leading-tight font-bold tracking-tight text-[#F3F8FF]">
          {t('dash_good_morning', { name: displayName })}
        </h1>
      </div>

      <button
        type="button"
        onClick={openVoiceAssistant}
        className="w-full bg-[#131A24] border border-[#243041] px-5 py-4 rounded-[26px] flex items-center justify-between shadow-lg hover:border-[#9333ea]/40 cursor-pointer active:scale-[0.99] transition-all text-left"
      >
        <div className="flex items-center gap-4">
          <Mic size={22} className="text-[#60A5FA]" />
          <span className="text-sm font-semibold text-[#A4B0B7]">
            {t('dash_tap_ask_smartflow')}
          </span>
        </div>
        <span className="text-xl font-bold text-[#60A5FA]">...</span>
      </button>

      <button
        type="button"
        onClick={openBulkMessaging}
        className="w-full rounded-[18px] border border-[#244C7A]/60 bg-[#102033] min-h-[50px] px-5 py-3 flex items-center justify-between cursor-pointer hover:border-[#3B82F6]/40 active:scale-[0.99] transition-all text-left"
      >
        <div className="flex items-center gap-3">
          <Megaphone size={18} className="text-[#60A5FA]" />
          <span className="text-sm font-bold text-[#EAF8FF]">{t('dash_bulk_messaging')}</span>
        </div>
        <span className="text-xs font-bold text-[#93C5FD]">{t('dash_open')}</span>
      </button>

      {/* KPI Stat Cards Summary Row */}
      <KpiMetricsRow
        totalChats={totalChats}
        totalContacts={totalContacts}
        totalCalls={totalCallsCount}
        minutesSaved={minutesSavedCount}
      />

      <UnifiedConversationsCard
        totalChats={totalChats}
        latestPeerName={latestPeerName}
        truncatedLatestMessage={truncatedLatestMessage}
        inboxAvatars={inboxAvatars}
        inboxCountText={inboxCountText}
        openUnifiedConversations={openUnifiedConversations}
        t={t}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] gap-5">
        <ContactsCard
          totalContacts={totalContacts}
          contactAvatars={contactAvatars}
          contactCountText={contactCountText}
          openContacts={openContacts}
          t={t}
        />

        <div className="space-y-5">
          <CalendarWidget
            nextUpcomingEvent={nextUpcomingEvent}
            upcomingEvents={upcomingEvents}
            upcomingEventLabel={upcomingEventLabel}
            openScheduleMeeting={openScheduleMeeting}
            t={t}
          />

          <IntegrationsWidget
            connectedBadges={connectedBadges}
            openSocialIntegrations={openSocialIntegrations}
            t={t}
          />
        </div>
      </div>

      <DocumentsGrid navigate={navigate} t={t} />

      <AiCallAnalyticsCard
        totalCallsCount={totalCallsCount}
        minutesSavedCount={minutesSavedCount}
        analyticsCallRows={analyticsCallRows}
        openCallHistory={openCallHistory}
        t={t}
      />
    </div>
  );
}

