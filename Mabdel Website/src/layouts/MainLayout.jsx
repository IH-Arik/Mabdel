import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Users2,
  Settings, 
  LogOut,
  Bell,
  Mic,
  ArrowLeft,
  Search,
  Grid,
  ShoppingBag,
  Flame
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import logoImg from '../assets/logo.png';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Sidebar links match the primary mobile tabs + new desktop extensions
const primaryNavItems = [
  { name: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { name: 'Messages', icon: MessageSquare, path: '/conversations' },
  { name: 'Voice Assistant', icon: Mic, path: '/ai-workflow' },
  { name: 'Groups', icon: Users2, path: '/groups' },
  { name: 'Shop', icon: ShoppingBag, path: '/shop' },
  { name: 'Activities', icon: Flame, path: '/activities' },
  { name: 'Settings', icon: Settings, path: '/settings' },
];

export default function MainLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname;
  
  // Determine if we are on a primary page or a sub-page
  const isPrimaryPage = ['/dashboard', '/conversations', '/ai-workflow', '/groups', '/shop', '/activities', '/settings'].includes(path);

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
      case '/admin': return 'System Administration';
      case '/shop': return 'Mabdel Shop';
      case '/activities': return 'Fitness Activities';
      default: return 'Back to Home';
    }
  };

  return (
    <div className="flex h-screen bg-[#02080B] text-white font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#0c101b] border-r border-[#243041] flex flex-col shrink-0 select-none">
        
        {/* Brand Logo Header */}
        <div className="p-6 border-b border-[#243041]/40">
          <div className="flex items-center gap-3">
            <img 
              src={logoImg} 
              alt="Mabdel Logo" 
              className="w-9 h-9 object-contain drop-shadow-[0_0_15px_rgba(17,199,229,0.2)]" 
            />
            <div className="text-left">
              <h1 className="text-sm font-black text-white tracking-tight leading-none uppercase">
                Mabdel <span className="text-[#11C7E5]">AI</span>
              </h1>
              <p className="text-[7.5px] font-bold text-[#11C7E5]/80 tracking-[0.2em] uppercase mt-1">
                AUTOMATING FUTURE
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
                  ? "bg-[#11C7E5]/10 text-white border-[#11C7E5]/20 shadow-[inset_1px_1px_2px_rgba(17,199,229,0.05)]" 
                  : "text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white"
              )}
            >
              {({ isActive }) => (
                <>
                  <item.icon 
                    size={18} 
                    className={cn(
                      "transition-colors", 
                      isActive ? "text-[#11C7E5]" : "text-[#A4B0B7] group-hover:text-slate-200"
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
          {/* Support and Logout */}
          <div className="space-y-1">
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
            <button 
              onClick={() => navigate('/notifications')}
              className={cn(
                "hover:text-white transition-colors relative cursor-pointer",
                path === '/notifications' ? "text-[#11C7E5]" : "text-slate-400"
              )}
            >
              <Bell size={18} />
              <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#11C7E5] rounded-full"></span>
            </button>

            {/* Profile Avatar */}
            <div 
              onClick={() => navigate('/settings')}
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
  );
}
