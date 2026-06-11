import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { smartflowApi } from '../api/services';
import { 
  Users, 
  MessageSquare, 
  FileText, 
  Calendar,
  Mic,
  MoreVertical,
  Plus,
  Receipt,
  Send,
  PhoneCall,
  PhoneMissed,
  Bell,
  Megaphone,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch stats from getHome API
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await smartflowApi.getHome();
      setDashboardData(response.data?.data || null);
    } catch (error) {
      console.error('Failed to fetch home dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Helper values with API bindings and mock fallbacks
  const greetingName = dashboardData?.greeting_name || user?.full_name?.split(' ')[0] || 'Raihan';
  const unreadCount = dashboardData?.inbox?.unread_count ?? 3;
  const contactsCount = dashboardData?.contacts?.count ?? 14;
  const totalCalls = dashboardData?.ai_call_analytics?.total_calls ?? 128;
  const minutesSaved = dashboardData?.ai_call_analytics?.minutes_saved ?? 450;

  // Clock time
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6 text-white pb-12 max-w-7xl mx-auto">
      
      {/* Top Greeting Header Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#243041]/40 pb-4">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
            Good Morning, <span className="text-[#11C7E5]">{greetingName}</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1">Here is a quick summary of your Mabdel AI dashboard status.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Clock Pill */}
          <div className="bg-[#131A24] border border-[#243041] text-xs px-4 py-2 rounded-full flex items-center gap-2 text-slate-300 font-bold select-none">
            <Clock size={14} className="text-[#11C7E5]" />
            <span>{currentTime}</span>
          </div>
        </div>
      </div>

      {/* Main Grid Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* ==================== LEFT COLUMN (8 Columns) ==================== */}
        <div className="lg:col-span-8 space-y-6 flex flex-col justify-between">
          
          {/* Mic Command Search Bar */}
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

          {/* Bulk Messaging Action Strip */}
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

          {/* Unified Conversations (Inbox) Card */}
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
              <p className="text-xs text-[#A4B0B7] mt-2 max-w-[90%] leading-relaxed">
                Latest message: Sarah Jenkins - "Project Proposal details attached for mezzanine floor expansion"
              </p>
            </div>

            <div className="flex items-center justify-between mt-6 pt-2 border-t border-[#243041]/35">
              {/* Avatars Stack */}
              <div className="flex -space-x-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-yellow-500 border-2 border-[#131A24] flex items-center justify-center font-bold text-xs text-[#02080B]">S</div>
                <div className="w-8 h-8 rounded-full bg-orange-400 border-2 border-[#131A24] flex items-center justify-center font-bold text-xs text-[#02080B]">D</div>
                <div className="w-8 h-8 rounded-full bg-[#0d131d] border-2 border-[#131A24] flex items-center justify-center font-bold text-[10px] text-[#A4B0B7] font-mono">+1</div>
              </div>
              <button 
                onClick={() => navigate('/conversations')}
                className="px-6 py-2.5 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-full active:scale-95 transition-all shadow-md shadow-[#11C7E5]/10"
              >
                View Messages
              </button>
            </div>
          </div>

          {/* Contacts Widget */}
          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-6 text-left shadow-lg space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#123b4a] flex items-center justify-center text-[#11C7E5]">
                  <Users size={18} />
                </div>
                <h3 className="text-base font-bold text-white">Contacts Directory</h3>
              </div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-900 border border-[#243041] px-2.5 py-1 rounded-full">
                {contactsCount} Connections
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Profile Card 1 */}
              <div 
                onClick={() => navigate('/contacts')}
                className="p-4 bg-[#0A1019] border border-[#243246] hover:border-[#11C7E5]/30 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-[#11C7E5]">SJ</div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0A1019] rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Sarah Jenkins</p>
                    <p className="text-[10px] text-slate-500 truncate">Creative Hub</p>
                  </div>
                </div>
              </div>

              {/* Profile Card 2 */}
              <div 
                onClick={() => navigate('/contacts')}
                className="p-4 bg-[#0A1019] border border-[#243246] hover:border-[#11C7E5]/30 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-[#11C7E5]">JW</div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">James Wilson</p>
                    <p className="text-[10px] text-slate-500 truncate">Stark Industries</p>
                  </div>
                </div>
              </div>

              {/* Profile Card 3 */}
              <div 
                onClick={() => navigate('/contacts')}
                className="p-4 bg-[#0A1019] border border-[#243246] hover:border-[#11C7E5]/30 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-bold text-[#11C7E5]">ER</div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-[#0A1019] rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">Elena Rodriguez</p>
                    <p className="text-[10px] text-slate-500 truncate">Creative Hub</p>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => navigate('/contacts')}
              className="w-full py-2 bg-[#0d131d] border border-[#243041] hover:border-slate-800 text-white font-bold text-xs rounded-xl text-center active:scale-99 transition-all"
            >
              View Directory Details
            </button>
          </div>

        </div>

        {/* ==================== RIGHT COLUMN (4 Columns) ==================== */}
        <div className="lg:col-span-4 space-y-6 flex flex-col justify-between">
          
          {/* Calendar Card */}
          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-5 text-left flex flex-col justify-between shadow-md">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-bold text-[#8093AC] tracking-wider uppercase">CALENDAR</span>
              <Calendar size={18} className="text-[#11C7E5]" />
            </div>
            <h3 className="text-base font-bold text-white mt-3">Scheduled Automation</h3>
            <p className="text-xs text-[#A4B0B7] mt-1">Manage scheduled voice pipelines and emails.</p>
            <button 
              onClick={() => navigate('/calendar')}
              className="w-full mt-4 py-2.5 bg-[#11C7E5] text-[#02080B] font-extrabold text-xs rounded-xl text-center active:scale-95 transition-all shadow-md shadow-[#11C7E5]/10"
            >
              Add New Event
            </button>
          </div>

          {/* Integrations Card */}
          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-5 text-left shadow-md">
            <span className="text-[9px] font-bold text-[#8093AC] tracking-wider uppercase">CONNECTED CHANNELS</span>
            <h3 className="text-sm font-bold text-white mt-1.5">Social Integrations</h3>
            <div className="flex items-center gap-2.5 mt-3">
              <span className="w-7 h-7 rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-bold select-none">ig</span>
              <span className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[9px] font-bold select-none">fb</span>
              <span className="w-7 h-7 rounded-full bg-black flex items-center justify-center text-white text-[9px] font-bold border border-slate-800 select-none">X</span>
              <button 
                onClick={() => navigate('/integrations')}
                className="w-7 h-7 rounded-full bg-[#0d131d] border border-[#243041] border-dashed flex items-center justify-center text-slate-500 text-xs font-bold hover:text-white transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Documents Matrix */}
          <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-5 text-left shadow-lg space-y-3">
            <h3 className="text-sm font-bold text-white">Document Templates</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {/* Agreement */}
              <div 
                onClick={() => navigate('/documents')}
                className="bg-[#12303F] border border-[#214457] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[#11C7E5]/40 active:scale-95 transition-all text-center"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0e2a38] flex items-center justify-center text-[#11C7E5]">
                  <FileText size={14} />
                </div>
                <span className="text-[10px] font-bold text-[#E9F2FF]">Agreement</span>
              </div>

              {/* Invoice */}
              <div 
                onClick={() => navigate('/invoices')}
                className="bg-[#12303F] border border-[#214457] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[#11C7E5]/40 active:scale-95 transition-all text-center"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0e2a38] flex items-center justify-center text-[#11C7E5]">
                  <Receipt size={14} />
                </div>
                <span className="text-[10px] font-bold text-[#E9F2FF]">Invoice</span>
              </div>

              {/* Lease */}
              <div 
                onClick={() => navigate('/documents')}
                className="bg-[#12303F] border border-[#214457] rounded-xl p-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-[#11C7E5]/40 active:scale-95 transition-all text-center"
              >
                <div className="w-7 h-7 rounded-lg bg-[#0e2a38] flex items-center justify-center text-[#11C7E5]">
                  <CheckCircle size={14} />
                </div>
                <span className="text-[10px] font-bold text-[#E9F2FF]">Lease</span>
              </div>

              {/* Create Post */}
              <div 
                onClick={() => navigate('/conversations')}
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

      {/* Bottom Area: AI Call Analytics Dashboard */}
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

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-[#0A1019] border border-[#243246] rounded-xl p-4 flex justify-between items-center">
            <div>
              <span className="text-[9.5px] font-bold text-[#8E9FB5] uppercase tracking-wider block">Total Outbound Calls</span>
              <span className="text-2xl font-black text-white mt-1 block">{totalCalls}</span>
            </div>
          </div>
          <div className="bg-[#0A1019] border border-[#243246] rounded-xl p-4 flex justify-between items-center">
            <div>
              <span className="text-[9.5px] font-bold text-[#8E9FB5] uppercase tracking-wider block">Minutes Saved via AI</span>
              <span className="text-2xl font-black text-[#11C7E5] mt-1 block">{minutesSaved}</span>
            </div>
          </div>
        </div>

        {/* Call Feed logs list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-[#0F3A48] flex items-center justify-center text-[#11C7E5] shrink-0">
                <PhoneCall size={14} />
              </div>
              <div>
                <h5 className="font-bold text-slate-200">Sarah Jenkins</h5>
                <p className="text-[10px] text-slate-500">Scheduled: Tomorrow 10:00 AM</p>
              </div>
            </div>
            <span className="text-[9px] font-bold bg-[#184833] text-[#3ADF87] px-2.5 py-0.5 rounded-full uppercase tracking-wider">Ready</span>
          </div>

          <div className="bg-slate-950/30 border border-slate-900 rounded-xl p-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-850 flex items-center justify-center text-slate-400 shrink-0">
                <PhoneMissed size={14} />
              </div>
              <div>
                <h5 className="font-bold text-slate-200">Unknown Prospect</h5>
                <p className="text-[10px] text-slate-500">Missed Outbound • 2 hours ago</p>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
