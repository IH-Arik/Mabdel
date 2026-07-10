import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { smartflowApi } from '../api/services';
import {
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Megaphone,
  Mic,
  PhoneCall,
  PhoneMissed,
  Receipt,
  Send,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [callSummary, setCallSummary] = useState(null);
  const [recentCalls, setRecentCalls] = useState([]);
  const [integrations, setIntegrations] = useState([]);
  const [events, setEvents] = useState([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [
        homeRes,
        convRes,
        contactsRes,
        callSummaryRes,
        callsRes,
        integrationsRes,
        eventsRes,
      ] = await Promise.allSettled([
        smartflowApi.getHome(),
        smartflowApi.getConversations({ page: 1, limit: 10 }),
        smartflowApi.getContacts({ page: 1, limit: 10 }),
        smartflowApi.getCallSummary(),
        smartflowApi.getCalls({ limit: 5 }),
        smartflowApi.getIntegrationStatus(),
        smartflowApi.getCalendarEvents({ page_size: 20 }),
      ]);

      if (homeRes.status === 'fulfilled') setDashboardData(homeRes.value.data?.data || null);
      if (convRes.status === 'fulfilled') setConversations(convRes.value.data?.data || []);
      if (contactsRes.status === 'fulfilled') setContacts(contactsRes.value.data?.data || []);
      if (callSummaryRes.status === 'fulfilled') setCallSummary(callSummaryRes.value.data?.data || null);
      if (callsRes.status === 'fulfilled') setRecentCalls(callsRes.value.data?.data || []);
      if (integrationsRes.status === 'fulfilled') setIntegrations(integrationsRes.value.data?.data || []);
      if (eventsRes.status === 'fulfilled') setEvents(eventsRes.value.data?.data?.items || eventsRes.value.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const greetingName = dashboardData?.greeting_name || user?.full_name?.split(' ')[0] || 'Raihan';
  const unreadCount = conversations.filter((conversation) => conversation.unread_count > 0).length || dashboardData?.inbox?.unread_count || 0;
  const totalContacts = dashboardData?.contacts?.count ?? contacts.length;
  const totalCallsCount = callSummary?.total_calls ?? dashboardData?.ai_call_analytics?.total_calls ?? 0;
  const minutesSavedCount = callSummary?.total_minutes_saved ?? dashboardData?.ai_call_analytics?.minutes_saved ?? 0;
  const upcomingEvents = [...events]
    .filter((event) => event?.starts_at && new Date(event.starts_at) > new Date())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const nextEvent = upcomingEvents[0] || null;
  const nextEventTime = nextEvent?.starts_at
    ? new Date(nextEvent.starts_at).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  const [currentTime, setCurrentTime] = useState(
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6 text-white pb-12 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#243041]/40 pb-4">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Good Morning, <span className="text-[#11C7E5]">{greetingName}</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">Here is a quick summary of your Mabdel AI dashboard status.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-[#131A24] border border-[#243041] text-xs px-4 py-2 rounded-full flex items-center gap-2 text-slate-300 font-bold select-none">
            <Clock size={14} className="text-[#11C7E5]" />
            <span>{currentTime}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 space-y-6 flex flex-col justify-between">
          <div
            onClick={() => navigate('/ai-workflow')}
            className="bg-[#131A24] border border-[#243041] px-5 py-4 rounded-[22px] flex items-center justify-between w-full shadow-lg hover:border-[#11C7E5]/30 cursor-pointer group active:scale-[0.99] transition-all"
          >
            <div className="flex items-center gap-4 flex-1">
              <Mic size={22} className="text-[#11C7E5] group-hover:scale-105 transition-transform" />
              <span className="text-sm font-semibold text-[#A4B0B7] select-none text-left">
                Tap to ask SmartFlow / Mabdel AI...
              </span>
            </div>
            <span className="text-xl font-bold text-[#11C7E5] select-none">...</span>
          </div>

          <div
            onClick={() => navigate('/bulk-messaging')}
            className="rounded-[18px] border border-[#1B5E6E]/60 bg-[#0C2028] min-h-[50px] px-5 py-3 flex items-center justify-between cursor-pointer hover:border-[#11C7E5]/40 active:scale-[0.99] transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <Megaphone size={18} className="text-[#11C7E5]" />
              <span className="text-sm font-bold text-[#EAF8FF]">Bulk Messaging</span>
            </div>
            <span className="text-xs font-bold text-[#78B7C7]">Open Panel</span>
          </div>

          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-6 flex flex-col justify-between shadow-lg relative overflow-hidden text-left min-h-[180px]">
            <div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] bg-[#123B4A] text-[#11C7E5] font-extrabold px-3 py-1 rounded-[6px] tracking-wider uppercase">
                  INBOX
                </span>
                <span className="text-xs text-[#8093AC] font-semibold">
                  {unreadCount} Active Chats
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mt-4 tracking-tight">Unified Conversations</h3>
              <p className="text-xs text-[#A4B0B7] mt-2 max-w-[90%] leading-relaxed truncate">
                {conversations.length > 0
                  ? `Latest message: ${conversations[0].peer?.full_name || 'Unknown'} - "${conversations[0].last_message?.text || ''}"`
                  : 'No recent messages'}
              </p>
            </div>

            <div className="flex items-center justify-between mt-6 pt-2 border-t border-[#243041]/35">
              <div className="flex -space-x-2.5 overflow-hidden">
                {conversations.slice(0, 3).map((conversation, index) => (
                  <div key={conversation.id || index} className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#131A24] flex items-center justify-center font-bold text-xs text-[#11C7E5] overflow-hidden">
                    {conversation.peer?.avatar_url ? (
                      <img src={conversation.peer.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                    ) : (
                      conversation.peer?.full_name?.charAt(0)?.toUpperCase() || 'U'
                    )}
                  </div>
                ))}
                {conversations.length > 3 && (
                  <div className="w-8 h-8 rounded-full bg-[#0d131d] border-2 border-[#131A24] flex items-center justify-center font-bold text-[10px] text-[#A4B0B7] font-mono">
                    +{conversations.length - 3}
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate('/conversations')}
                className="px-6 py-2.5 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-full active:scale-95 transition-all shadow-md shadow-[#11C7E5]/10"
              >
                View Messages
              </button>
            </div>
          </div>

          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-6 text-left shadow-lg space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#123b4a] flex items-center justify-center text-[#11C7E5]">
                  <Users size={18} />
                </div>
                <h3 className="text-base font-bold text-white">Contacts Directory</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-900 border border-[#243041] px-2.5 py-1 rounded-full">
                {totalContacts} Connections
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contacts.length > 0 ? contacts.slice(0, 3).map((contact, index) => (
                <div
                  key={contact.id || index}
                  onClick={() => navigate('/contacts')}
                  className="p-4 bg-[#0A1019] border border-[#243246] hover:border-[#11C7E5]/30 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-[#11C7E5] overflow-hidden">
                      {contact.avatar_url ? (
                        <img src={contact.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                      ) : (
                        contact.full_name?.charAt(0)?.toUpperCase() || 'C'
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{contact.full_name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{contact.company || contact.email || 'Contact'}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-slate-500 col-span-3">No contacts found. Add some connections!</p>
              )}
            </div>

            <button
              onClick={() => navigate('/contacts')}
              className="w-full py-2 bg-[#0d131d] border border-[#243041] hover:border-slate-800 text-white font-bold text-xs rounded-xl text-center active:scale-99 transition-all"
            >
              View Directory Details
            </button>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6 flex flex-col justify-between">
          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-5 text-left flex flex-col justify-between shadow-md">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-[#8093AC] tracking-wider uppercase">UPCOMING</span>
              <Calendar size={18} className="text-[#11C7E5]" />
            </div>
            <h3 className="text-base font-bold text-white mt-3">Upcoming Meetings</h3>
            <p className="text-xs text-[#A4B0B7] mt-1">
              {nextEvent
                ? `${nextEvent.title || 'Untitled meeting'}${nextEventTime ? ` | ${nextEventTime}` : ''}`
                : 'No meetings scheduled yet. Add your next meeting now.'}
            </p>
            <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
              <span className="text-[#11C7E5]">{upcomingEvents.length} Upcoming</span>
              {nextEvent?.meeting_mode && <span className="text-slate-500">{nextEvent.meeting_mode}</span>}
            </div>
            <button
              onClick={() => navigate('/calendar')}
              className="w-full mt-4 py-2.5 bg-[#11C7E5] text-[#02080B] font-extrabold text-xs rounded-xl text-center active:scale-95 transition-all shadow-md shadow-[#11C7E5]/10"
            >
              {nextEvent ? 'Open Calendar' : 'Schedule Meeting'}
            </button>
          </div>

          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-5 text-left shadow-md">
            <span className="text-[9px] font-bold text-[#8093AC] tracking-wider uppercase">CONNECTED CHANNELS</span>
            <h3 className="text-sm font-bold text-white mt-1.5">Social Integrations</h3>
            <div className="flex items-center gap-2.5 mt-3">
              {integrations.filter((integration) => integration.connected).map((integration, index) => (
                <span key={index} className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white text-[9px] font-bold select-none uppercase" title={integration.platform}>
                  {integration.platform?.substring(0, 2)}
                </span>
              ))}
              <button
                onClick={() => navigate('/integrations')}
                className="w-7 h-7 rounded-full bg-[#0d131d] border border-[#243041] border-dashed flex items-center justify-center text-slate-500 text-xs font-bold hover:text-white transition-colors"
              >
                +
              </button>
            </div>
          </div>

          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-5 text-left shadow-lg space-y-3">
            <h3 className="text-sm font-bold text-white">Document Templates</h3>
            <div className="grid grid-cols-2 gap-2.5">
              <div
                onClick={() => navigate('/documents', { state: { tab: 'agreements' } })}
                className="bg-[#12303F] border border-[#214457] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[#11C7E5]/40 active:scale-95 transition-all text-center"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0e2a38] flex items-center justify-center text-[#11C7E5]">
                  <FileText size={14} />
                </div>
                <span className="text-[10px] font-bold text-[#E9F2FF]">Agreements</span>
              </div>

              <div
                onClick={() => navigate('/invoices')}
                className="bg-[#12303F] border border-[#214457] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[#11C7E5]/40 active:scale-95 transition-all text-center"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0e2a38] flex items-center justify-center text-[#11C7E5]">
                  <Receipt size={14} />
                </div>
                <span className="text-[10px] font-bold text-[#E9F2FF]">Invoices</span>
              </div>

              <div
                onClick={() => navigate('/documents', { state: { tab: 'leases' } })}
                className="bg-[#12303F] border border-[#214457] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[#11C7E5]/40 active:scale-95 transition-all text-center"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0e2a38] flex items-center justify-center text-[#11C7E5]">
                  <CheckCircle size={14} />
                </div>
                <span className="text-[10px] font-bold text-[#E9F2FF]">Leases</span>
              </div>

              <div
                onClick={() => navigate('/create-post')}
                className="bg-[#12303F] border border-[#214457] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[#11C7E5]/40 active:scale-95 transition-all text-center"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0e2a38] flex items-center justify-center text-[#11C7E5]">
                  <Send size={14} />
                </div>
                <span className="text-[10px] font-bold text-[#E9F2FF]">Create Post</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        onClick={() => navigate('/calls')}
        className="bg-[#131A24] border border-[#243041] rounded-[22px] p-6 text-left shadow-lg cursor-pointer hover:border-[#11C7E5]/20 transition-all space-y-5"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <PhoneCall size={18} className="text-[#11C7E5]" />
            <h3 className="text-base font-bold text-white tracking-tight">AI Call Analytics</h3>
          </div>
          <span className="text-xs text-[#11C7E5] font-semibold hover:underline">View History</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0A1019] border border-[#243246] rounded-xl p-4 flex justify-between items-center">
            <div>
              <span className="text-[9.5px] font-bold text-[#8E9FB5] uppercase tracking-wider block">Total Outbound Calls</span>
              <span className="text-2xl font-black text-white mt-1 block">{totalCallsCount}</span>
            </div>
          </div>
          <div className="bg-[#0A1019] border border-[#243246] rounded-xl p-4 flex justify-between items-center">
            <div>
              <span className="text-[9.5px] font-bold text-[#8E9FB5] uppercase tracking-wider block">Minutes Saved via AI</span>
              <span className="text-2xl font-black text-[#11C7E5] mt-1 block">{minutesSavedCount}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentCalls.length > 0 ? recentCalls.slice(0, 2).map((call, index) => (
            <div key={call.id || index} className="bg-slate-950/30 border border-slate-900 rounded-xl p-4 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${call.status === 'completed' ? 'bg-[#0F3A48] text-[#11C7E5]' : 'bg-slate-900 border border-slate-850 text-slate-400'}`}>
                  {call.status === 'completed' ? <PhoneCall size={14} /> : <PhoneMissed size={14} />}
                </div>
                <div>
                  <h5 className="font-bold text-slate-200">{call.contact?.full_name || call.to_number || 'Unknown Prospect'}</h5>
                  <p className="text-[10px] text-slate-500 capitalize">{call.type || 'Outbound'} | {call.status}</p>
                </div>
              </div>
              {call.status === 'completed' && (
                <span className="text-[9px] font-bold bg-[#184833] text-[#3ADF87] px-2.5 py-0.5 rounded-full uppercase tracking-wider">Completed</span>
              )}
            </div>
          )) : (
            <p className="text-xs text-slate-500 col-span-2">No recent calls found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
