import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquare,
  Users2,
  Settings,
  LogOut,
  Mic,
  ArrowLeft,
  Contact,
  FileText,
  PhoneCall,
  ExternalLink
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import logoImg from '../assets/gocustify-mark.png';
import { TwilioVoiceProvider, useTwilioVoice } from '../context/TwilioVoiceContext';
import IncomingCallOverlay from '../components/Calls/IncomingCallOverlay';
import ActiveCallOverlay from '../components/Calls/ActiveCallOverlay';
import NotificationBellButton from '../components/NotificationBellButton';
import { useNotificationStore } from '../store/useNotificationStore';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Sidebar links match the primary mobile tabs + new desktop extensions
const primaryNavItems = [
  { name: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Messages', icon: MessageSquare, path: '/conversations' },
  { name: 'Voice Assistant', icon: Mic, path: '/ai-workflow' },
  { name: 'AI Calling', icon: PhoneCall, path: '/calls' },
  { name: 'Contacts', icon: Contact, path: '/contacts' },
  { name: 'Documents', icon: FileText, path: '/documents' },
  { name: 'Groups', icon: Users2, path: '/groups' },
  { name: 'Profile', icon: Settings, path: '/profile' },
];

// Team Management dashboard is a separate app (madbel-dashboard) shared with
// Owner/Manager only - Admin/Super Admin use their own dedicated dashboard login.
const TEAM_DASHBOARD_ROLES = new Set(['owner', 'manager']);
const TEAM_DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || 'http://localhost:5174';

function CallOverlayHost() {
  const {
    incomingCall,
    currentCall,
    currentCallerName,
    currentCallerNumber,
    acceptIncomingCall,
    rejectIncomingCall,
    endCurrentCall,
    toggleMute,
    toggleSpeaker,
    isMuted,
    isSpeakerOn,
    durationSeconds,
    transcriptSegments,
    callStatusText,
  } = useTwilioVoice();

  const latestTranscript = transcriptSegments.length
    ? transcriptSegments
        .slice(-3)
        .map((segment) => `${String(segment?.speaker || 'caller').toUpperCase()}: ${segment?.text || segment?.content || ''}`)
        .join('\n')
    : '';

  return (
    <>
      <IncomingCallOverlay
        callerName={currentCallerName}
        callerNumber={currentCallerNumber}
        isOpen={Boolean(incomingCall && !currentCall)}
        onAccept={acceptIncomingCall}
        onReject={rejectIncomingCall}
      />
      <ActiveCallOverlay
        callerName={currentCallerName}
        callerNumber={currentCallerNumber}
        isOpen={Boolean(currentCall)}
        onEndCall={endCurrentCall}
        onToggleMute={toggleMute}
        onToggleSpeaker={toggleSpeaker}
        isMuted={isMuted}
        isSpeaker={isSpeakerOn}
        durationSeconds={durationSeconds}
        statusText={callStatusText}
        latestTranscript={latestTranscript}
      />
    </>
  );
}

export default function MainLayout() {
  const { user, token, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const syncUnreadCount = useNotificationStore((state) => state.syncUnreadCount);
  const showTeamDashboardLink = TEAM_DASHBOARD_ROLES.has(user?.role || user?.primary_role);

  const openTeamDashboard = () => {
    const ssoUrl = token
      ? `${TEAM_DASHBOARD_URL}/sso?token=${encodeURIComponent(token)}`
      : `${TEAM_DASHBOARD_URL}/sign-in`;
    window.open(ssoUrl, '_blank', 'noopener,noreferrer');
  };

  const path = location.pathname;
  
  // Determine if we are on a primary page or a sub-page
  const isPrimaryPage = ['/dashboard', '/conversations', '/ai-workflow', '/calls', '/contacts', '/documents', '/groups', '/profile'].includes(path);

  // Map sub-page paths to friendly titles
  const getSubPageTitle = () => {
    switch (path) {
      case '/contacts': return 'Contacts Directory';
      case '/calendar': return 'Calendar Events';
      case '/invoices': return 'Billing Invoices';
      case '/documents': return 'Document Templates';
      case '/calls': return 'AI Call Analytics';
      case '/integrations': return 'Social Integrations';
      case '/notifications': return 'System Notifications';
      case '/bulk-messaging': return 'Bulk Messaging';
      case '/create-post': return 'Create Social Post';
      case '/admin': return 'System Administration';
      default: return 'Back to Home';
    }
  };

  useEffect(() => {
    syncUnreadCount().catch(() => {});
  }, [syncUnreadCount]);

  return (
    <TwilioVoiceProvider>
    <div className="flex h-screen bg-[#02080B] text-white font-sans overflow-hidden">
      <CallOverlayHost />
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#0c101b] border-r border-[#243041] flex flex-col shrink-0 select-none">
        
        {/* Brand Logo Header */}
        <div className="p-6 border-b border-[#243041]/40">
          <div className="flex items-center gap-3">
            <img 
              src={logoImg} 
              alt="GoCustify logo" 
              className="w-9 h-9 object-contain drop-shadow-[0_0_15px_rgba(17,199,229,0.2)]" 
            />
            <div className="text-left">
              <h1 className="text-sm font-black text-white tracking-tight leading-none uppercase">
                GoCustify
              </h1>
              <p className="text-[7.5px] font-bold text-[#11C7E5]/80 tracking-[0.2em] uppercase mt-1">
                AI CRM PLATFORM
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Nav Links (only the 5 primary tabs) */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {primaryNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => cn(
                "group flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 border border-transparent font-semibold text-sm text-left",
                isActive 
                  ? "bg-[#17324A] text-white border-[#3B82F6]/25 shadow-[inset_1px_1px_2px_rgba(59,130,246,0.08)]" 
                  : "text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon 
                    size={18} 
                    className={cn(
                      "transition-colors", 
                      isActive ? "text-[#60A5FA]" : "text-[#A4B0B7] group-hover:text-slate-200"
                    )} 
                  />
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#243041]/40 space-y-3">
          {/* Team Dashboard, Support and Logout */}
          <div className="space-y-1">
            {showTeamDashboardLink && (
              <button
                type="button"
                onClick={openTeamDashboard}
                className="flex items-center gap-3.5 px-4 py-2.5 w-full rounded-xl text-xs font-bold text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white transition-all text-left cursor-pointer"
              >
                <ExternalLink size={16} />
                <span>Team Dashboard</span>
              </button>
            )}
            <button
              onClick={logout}
              className="flex items-center gap-3.5 px-4 py-2.5 w-full rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/20 hover:text-rose-300 transition-all text-left"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="h-16 bg-[#0c101b]/80 backdrop-blur-md border-b border-[#243041]/40 flex items-center justify-between px-8 z-10 shrink-0">
          
          {/* Header Left Section */}
          <div className="flex items-center gap-4">
            {!isPrimaryPage ? (
              /* If on a sub-page, show Back button */
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="p-2 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer flex items-center justify-center"
                >
                  <ArrowLeft size={15} />
                </button>
                <h2 className="text-sm font-extrabold text-white tracking-wide">{getSubPageTitle()}</h2>
              </div>
            ) : (
              /* If on a primary page, show simple title */
              <h2 className="text-base font-extrabold text-white tracking-tight uppercase">
                {path === '/dashboard' ? 'Dashboard' : primaryNavItems.find(i => i.path === path)?.name}
              </h2>
            )}
          </div>

          {/* Header Right Section */}
          <div className="flex items-center gap-6">
            
            {/* Notification Bell */}
            <NotificationBellButton
              count={unreadCount}
              active={path === '/notifications'}
              onClick={() => navigate('/notifications')}
              size={24}
              strokeWidth={2.75}
              buttonClassName="hover:text-white transition-colors relative cursor-pointer"
              className={cn(path === '/notifications' ? 'text-[#11C7E5]' : 'text-slate-200')}
            />

            {/* Profile Avatar */}
            <div 
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-[#243041] flex items-center justify-center text-[#11C7E5] font-black overflow-hidden shadow-inner group-hover:border-[#11C7E5]/50 transition-colors">
                {user?.full_name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable outlet view */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#02080B] no-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
    </TwilioVoiceProvider>
  );
}

