import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  CalendarCheck2,
  FileText,
  Megaphone,
  Mic,
  PhoneCall,
  Plus,
  ReceiptText,
  Send,
  Users,
} from 'lucide-react';
import { smartflowApi } from '../api/services';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';

const HOME_DOC_ITEMS = [
  { id: 'agreement', title: 'Agreement', icon: FileText, action: { path: '/documents', state: { tab: 'agreements' } } },
  { id: 'invoice', title: 'Invoice', icon: ReceiptText, action: { path: '/invoices' } },
  { id: 'lease', title: 'Lease', icon: Bot, action: { path: '/documents', state: { tab: 'leases' } } },
  { id: 'post', title: 'Create Post', icon: Plus, action: { path: '/create-post' } },
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

function getDisplayName(user) {
  const emailPrefix = String(user?.email || user?.client_email || '')
    .split('@')[0]
    .trim();

  return (
    user?.full_name ||
    user?.fullName ||
    user?.name ||
    user?.username ||
    (emailPrefix ? emailPrefix : 'there')
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

function getLatestPeerName(thread) {
  return (
    thread?.contact_name ||
    thread?.contactName ||
    thread?.title ||
    thread?.directPeer?.fullName ||
    thread?.directPeer?.name ||
    thread?.peer?.full_name ||
    thread?.peer?.fullName ||
    thread?.peer?.name ||
    'No Contact'
  );
}

function getLatestMessageText(thread) {
  const text =
    thread?.last_message_preview ||
    thread?.lastMessagePreview ||
    thread?.lastMessage?.text ||
    thread?.last_message?.text ||
    thread?.last_message?.body ||
    thread?.lastMessage?.body ||
    '';

  return String(text || '').trim() || 'No messages yet';
}

function getAvatarLabel(name) {
  return String(name || 'User').trim().charAt(0).toUpperCase() || 'U';
}

function AvatarStack({ avatars, countText, size = 36, overlap = -10 }) {
  return (
    <div className="flex items-center">
      {avatars.map((avatar, index) => (
        <div
          key={`${avatar.name}-${index}`}
          className="border-2 border-[#131A24] bg-slate-900 overflow-hidden flex items-center justify-center font-bold text-[11px] text-[#11C7E5]"
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
            getAvatarLabel(avatar.name)
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
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-10 w-72 rounded-2xl bg-[#131A24]" />
        <div className="h-10 w-10 rounded-full bg-[#131A24]" />
      </div>
      <div className="h-20 rounded-[26px] bg-[#131A24]" />
      <div className="h-14 rounded-[22px] bg-[#131A24]" />
      <div className="h-48 rounded-[26px] bg-[#131A24]" />
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-5">
        <div className="h-64 rounded-[26px] bg-[#131A24]" />
        <div className="space-y-5">
          <div className="h-36 rounded-[26px] bg-[#131A24]" />
          <div className="h-28 rounded-[26px] bg-[#131A24]" />
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
      className={`${base} ${className} cursor-pointer transition-all hover:border-[#11C7E5]/30 active:scale-[0.995]`}
    >
      {children}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const syncUnreadCount = useNotificationStore((state) => state.syncUnreadCount);
  const [isLoading, setIsLoading] = useState(true);
  const [threads, setThreads] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [callSummary, setCallSummary] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);
  const [integrationItems, setIntegrationItems] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  const fetchAll = useCallback(async () => {
    const [conversationsRes, contactsRes, callSummaryRes, callsRes, integrationsRes, calendarEventsRes] =
      await Promise.allSettled([
        smartflowApi.getConversations({ page: 1, limit: 100 }),
        smartflowApi.getContacts({ page: 1, page_size: 100 }),
        smartflowApi.getCallSummary(),
        smartflowApi.getCalls({ page: 1, limit: 5 }),
        smartflowApi.getIntegrationStatus(),
        smartflowApi.getCalendarEvents({ page: 1, page_size: 25, upcoming_only: true }),
      ]);

    if (conversationsRes.status === 'fulfilled') {
      setThreads(normalizeConversationList(conversationsRes.value));
    }

    if (contactsRes.status === 'fulfilled') {
      setContacts(normalizeContacts(contactsRes.value));
    }

    if (callSummaryRes.status === 'fulfilled') {
      setCallSummary(callSummaryRes.value?.data?.data || callSummaryRes.value?.data || null);
    }

    if (callsRes.status === 'fulfilled') {
      setRecentCalls(normalizeCalls(callsRes.value));
    }

    if (integrationsRes.status === 'fulfilled') {
      setIntegrationItems(normalizeIntegrationItems(integrationsRes.value));
    }

    if (calendarEventsRes.status === 'fulfilled') {
      setCalendarEvents(normalizeCalendarEvents(calendarEventsRes.value));
    }
  }, []);

  useEffect(() => {
    fetchAll().catch((error) => {
      console.error('Failed to fetch dashboard data:', error);
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

  const displayName = getDisplayName(user);
  const totalChats = threads.length;
  const latestThread = totalChats > 0 ? threads[0] : null;
  const latestPeerName = latestThread ? getLatestPeerName(latestThread) : 'No Contact';
  const latestMessage = latestThread ? getLatestMessageText(latestThread) : 'No messages yet';
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
    name: getLatestPeerName(thread),
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
      'User',
  }));
  const totalContacts = contacts.length;
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
    ? new Date(nextUpcomingEvent.starts_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'No upcoming meetings scheduled.';
  const analyticsCallRows = recentCalls.slice(0, 3).map((call, index) => {
    const durationMinutes = call?.duration ? Math.round(Number(call.duration) / 60) : null;
    return {
      id: call?._id || call?.id || `call-${index}`,
      name: call?.contact_name || call?.caller_name || call?.phone_number || 'Unknown',
      subtitle: call?.ai_summary?.purpose || call?.summary || call?.status || '',
      rightType: durationMinutes ? 'text' : 'badge',
      rightText: durationMinutes
        ? `${durationMinutes}m`
        : call?.status === 'completed'
          ? 'Done.'
          : 'AI Ready',
      status: call?.status,
    };
  });

  const openVoiceAssistant = () => navigate('/voice-conversation', { state: { autoStart: true } });
  const openBulkMessaging = () => navigate('/bulk-messaging');
  const openUnifiedConversations = () => navigate('/conversations');
  const openContacts = () => navigate('/contacts');
  const openScheduleMeeting = () => navigate('/calendar');
  const openSocialIntegrations = () => navigate('/integrations');
  const openCallHistory = () => navigate('/calls');

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-12 text-white">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[30px] leading-tight font-bold tracking-tight text-[#F3F8FF]">
          Good Morning, {displayName}
        </h1>
      </div>

      <button
        type="button"
        onClick={openVoiceAssistant}
        className="w-full bg-[#131A24] border border-[#243041] px-5 py-4 rounded-[26px] flex items-center justify-between shadow-lg hover:border-[#3B82F6]/30 cursor-pointer active:scale-[0.99] transition-all text-left"
      >
        <div className="flex items-center gap-4">
          <Mic size={22} className="text-[#60A5FA]" />
          <span className="text-sm font-semibold text-[#A4B0B7]">
            Tap to ask SmartFlow
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
          <span className="text-sm font-bold text-[#EAF8FF]">Bulk Messaging</span>
        </div>
        <span className="text-xs font-bold text-[#93C5FD]">Open</span>
      </button>

      <SectionCard>
        <div className="flex justify-between items-center">
          <div className="bg-[#13263D] text-[#60A5FA] font-extrabold px-3 py-1 rounded-[6px] tracking-wider uppercase text-[10px]">
            Inbox
          </div>
          <span className="text-xs text-[#8093AC] font-semibold">
            {totalChats} Chats
          </span>
        </div>

        <h3 className="text-xl font-bold text-white mt-4 tracking-tight">Unified Conversations</h3>
        <p className="text-xs text-[#A4B0B7] mt-2 leading-relaxed">
          Latest: {latestPeerName} - "{truncatedLatestMessage}"
        </p>

        <div className="flex items-center justify-between mt-6 pt-2">
          <AvatarStack avatars={inboxAvatars} countText={inboxCountText} />
            <button
              type="button"
              onClick={openUnifiedConversations}
            className="px-6 py-2.5 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-full active:scale-95 transition-all shadow-md shadow-[#11C7E5]/10 cursor-pointer"
            >
              View All
            </button>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.95fr)] gap-5">
        <SectionCard onClick={openContacts} className="min-h-[260px]">
          <div className="w-12 h-12 rounded-2xl bg-[#0D1822] flex items-center justify-center">
            <Users size={24} className="text-[#60A5FA]" />
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-white">Contacts</h3>
            <span className="text-xs font-semibold text-[#8093AC]">
              {totalContacts} {totalContacts === 1 ? 'Contact' : 'Contacts'}
            </span>
          </div>
          <div className="mt-5">
            <AvatarStack avatars={contactAvatars} countText={contactCountText} size={34} overlap={-10} />
          </div>
          <div className="mt-8">
            <button
              type="button"
              onClick={openContacts}
              className="px-6 py-2.5 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-full active:scale-95 transition-all shadow-md shadow-[#11C7E5]/10 cursor-pointer"
            >
              View All
            </button>
          </div>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard onClick={openScheduleMeeting}>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-bold text-[#8093AC] tracking-wider uppercase">Upcoming</span>
              <CalendarCheck2 size={23} className="text-[#60A5FA]" />
            </div>
            <h3 className="text-xl font-bold text-white mt-3">Calendar</h3>
            <div className="mt-4 min-h-[52px] text-left">
              {nextUpcomingEvent ? (
                <>
                  <p className="text-sm font-bold text-white truncate">{nextUpcomingEvent.title || 'Untitled meeting'}</p>
                  <p className="text-xs text-[#A4B0B7] mt-1">
                    {upcomingEvents.length} upcoming {upcomingEvents.length === 1 ? 'meeting' : 'meetings'}
                  </p>
                  <p className="text-xs text-[#A4B0B7] mt-1">{upcomingEventLabel}</p>
                </>
              ) : (
                <p className="text-xs text-[#A4B0B7] leading-relaxed">{upcomingEventLabel}</p>
              )}
            </div>
            <button
              type="button"
              onClick={openScheduleMeeting}
              className="mt-5 px-6 py-2.5 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-full active:scale-95 transition-all shadow-md shadow-[#11C7E5]/10 cursor-pointer"
            >
              Add Your Calendar
            </button>
          </SectionCard>

          <SectionCard>
            <span className="text-[10px] font-bold text-[#8093AC] tracking-wider uppercase">Integrations</span>
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
                className="w-8 h-8 rounded-full bg-[#0D131D] border border-[#243041] border-dashed flex items-center justify-center text-slate-500 hover:text-white transition-colors cursor-pointer"
                aria-label="Open social integrations"
              >
                <Plus size={16} />
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard>
        <h3 className="text-xl font-bold text-white">Documents</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          {HOME_DOC_ITEMS.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => navigate(item.action.path, item.action.state ? { state: item.action.state } : undefined)}
              className="bg-[#122437] border border-[#254669] rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#3B82F6]/40 active:scale-95 transition-all text-center min-h-[112px]"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#13263D] flex items-center justify-center text-[#60A5FA]">
                <item.icon size={22} />
              </div>
              <span className="text-xs font-bold text-[#E9F2FF] leading-tight">{item.title}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard onClick={openCallHistory}>
        <div className="flex items-center gap-2">
          <PhoneCall size={21} className="text-[#12D2ED]" />
          <h3 className="text-xl font-bold text-white tracking-tight">AI Call Analytics</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div className="bg-[#0A1019] border border-[#243246] rounded-2xl p-4">
            <span className="text-[10px] font-bold text-[#8E9FB5] uppercase tracking-wider block">Total Calls</span>
            <span className="text-3xl font-black text-white mt-1 block">{totalCallsCount}</span>
          </div>
          <div className="bg-[#0A1019] border border-[#243246] rounded-2xl p-4">
            <span className="text-[10px] font-bold text-[#8E9FB5] uppercase tracking-wider block">Minutes Saved</span>
            <span className="text-3xl font-black text-[#11C7E5] mt-1 block">{minutesSavedCount}</span>
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
                    <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
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
            <p className="text-xs text-slate-500">No recent calls found.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
