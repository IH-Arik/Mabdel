import { useCallback, useEffect, useState } from 'react';
import { 
  Sparkles, 
  User, 
  Calendar, 
  Cpu, 
  Bell, 
  CheckCheck, 
  Trash2, 
  Check, 
  Loader2,
  FileText
} from 'lucide-react';
import { smartflowApi } from '../api/services';

const MOCK_NOTIFICATIONS = [
  {
    id: 'mock-1',
    type: 'ai_insight',
    title: 'AI Smart Insight',
    body: 'Based on your last 3 calls, SmartFlow recommends adjusting the Q3 forecast by...',
    unread: true,
    created_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    display_time_label: '2m ago',
    sender: 'System Generated',
    details: 'Based on your last 3 calls, SmartFlow recommends adjusting the Q3 forecast by reviewing shipping cost variance and call conversion trends.',
    points: [
      '12% increase in expedited shipping requests.',
      'Call conversion dropped by 2.4% in Northeast region.',
      'Client sentiment remains \'Positive\' overall.'
    ],
    suggested_action: 'Generate a comprehensive Q3 forecast summary incorporating these new variables.',
    button_text: 'Generate Summary',
    action_type: 'generate_summary'
  },
  {
    id: 'mock-2',
    type: 'message',
    title: 'Sarah Jenkins',
    body: 'I\'ve reviewed the proposal. The client is asking for a follow-up meeting this Thursday.',
    unread: true,
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    display_time_label: '15m ago',
    sender: 'Sarah Jenkins',
    details: 'I\'ve reviewed the proposal. The client is asking for a follow-up meeting this Thursday at 2:00 PM EST. Please confirm your availability.',
    suggested_action: 'Add follow-up meeting to calendar',
    button_text: 'Add to Calendar',
    action_type: 'add_to_calendar'
  },
  {
    id: 'mock-3',
    type: 'calendar',
    title: 'Stakeholder Meeting',
    body: 'Room 402 - Main Office. Don\'t forget to bring the updated performance metrics for the...',
    unread: true,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    display_time_label: '1h ago',
    sender: 'Calendar Service',
    details: 'Room 402 - Main Office. Don\'t forget to bring the updated performance metrics for the Q3 presentation.',
    suggested_action: 'Open event details',
    button_text: 'Open Calendar',
    action_type: 'open_calendar'
  },
  {
    id: 'mock-4',
    type: 'ai_insight',
    title: 'Daily Digest',
    body: 'Your productivity was 15% higher today compared to last Tuesday. Great work,...',
    unread: false,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    display_time_label: '6h ago',
    sender: 'System Generated',
    details: 'Your productivity was 15% higher today compared to last Tuesday. Great work, you completed 8 tasks and resolved 3 client concerns.',
    suggested_action: 'View productivity report',
    button_text: 'View Report',
    action_type: 'view_report'
  },
  {
    id: 'mock-5',
    type: 'system',
    title: 'System Update',
    body: 'Version 2.4.0 is now live. Explore the new contextual awareness features...',
    unread: false,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    display_time_label: 'Yesterday',
    sender: 'System Generated',
    details: 'Version 2.4.0 is now live. Explore the new contextual awareness features, updated sidebar navigation, and the FlowAgent chatbot side-panel.',
    suggested_action: 'View release notes',
    button_text: 'View Release Notes',
    action_type: 'view_release_notes'
  }
];

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('All');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      let apiItems = [];
      try {
        const response = await smartflowApi.getNotifications({ page_size: 50 });
        apiItems = response.data.data.items || [];
      } catch (e) {
        console.warn("Could not fetch notifications from API, using mock items.", e);
      }
      
      // Map API alerts to our notifications structure
      const mappedApiItems = apiItems.map(item => ({
        id: item.id || item._id?.$oid || String(Math.random()),
        type: item.type || 'system',
        title: item.title || 'Notification',
        body: item.body || '',
        unread: item.unread !== undefined ? item.unread : (item.read !== undefined ? !item.read : true),
        created_at: item.created_at || new Date().toISOString(),
        display_time_label: item.display_time_label || new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sender: item.sender || 'System',
        details: item.body || '',
        isRealApi: true
      }));

      // Combine mock alerts with real API alerts
      const combined = [...mappedApiItems, ...MOCK_NOTIFICATIONS];
      
      // Sort by created_at descending
      combined.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setNotifications(combined);
      
      // Select first item by default if none selected
      if (combined.length > 0) {
        setSelectedId(combined[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await smartflowApi.markAllNotificationsRead();
    } catch (e) {
      console.warn("API markAllRead failed, updating local state only.", e);
    }
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const handleToggleRead = async (id, currentUnread) => {
    const target = notifications.find(n => n.id === id);
    if (!target) return;
    
    // Toggle state locally
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, unread: !currentUnread } : n));

    if (target.isRealApi) {
      try {
        if (currentUnread) {
          await smartflowApi.markNotificationRead(id);
        }
      } catch (e) {
        console.warn("API toggle read failed.", e);
      }
    }
  };

  const handleDelete = async (id) => {
    const target = notifications.find(n => n.id === id);
    if (!target) return;

    // Deselect if active
    if (selectedId === id) {
      const remaining = notifications.filter(n => n.id !== id);
      setSelectedId(remaining.length > 0 ? remaining[0].id : null);
    }

    setNotifications(prev => prev.filter(n => n.id !== id));

    if (target.isRealApi) {
      try {
        await smartflowApi.deleteNotification(id);
      } catch (e) {
        console.warn("API delete failed.", e);
      }
    }
  };

  const handleRunSuggestedAction = async (actionType) => {
    setActionLoading(true);
    setActionSuccess(null);
    
    // Simulate API call for suggested action
    setTimeout(() => {
      setActionLoading(false);
      if (actionType === 'generate_summary') {
        setActionSuccess('Q3 Forecast Summary generated successfully and added to Documents!');
      } else if (actionType === 'add_to_calendar') {
        setActionSuccess('Event successfully added to your calendar!');
      } else {
        setActionSuccess('Action completed successfully!');
      }
    }, 2000);
  };

  // Filter logic
  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'All') return true;
    if (activeTab === 'AI Insights') return n.type === 'ai_insight';
    if (activeTab === 'Messages') return n.type === 'message';
    if (activeTab === 'Meetings') return n.type === 'calendar';
    if (activeTab === 'System') return n.type === 'system';
    if (activeTab === 'Unread') return n.unread;
    return true;
  });

  const selectedNotification = notifications.find(n => n.id === selectedId);
  const unreadCount = notifications.filter(n => n.unread).length;

  // Helper to choose the right icon
  const getIcon = (type) => {
    switch(type) {
      case 'ai_insight':
        return <Sparkles size={18} className="text-cyan-400" />;
      case 'message':
        return <User size={18} className="text-purple-400" />;
      case 'calendar':
        return <Calendar size={18} className="text-indigo-400" />;
      case 'system':
      default:
        return <Cpu size={18} className="text-blue-400" />;
    }
  };

  // Group by Today and Earlier
  const getGroupedNotifications = () => {
    const today = [];
    const earlier = [];
    const oneDay = 24 * 60 * 60 * 1000;
    
    filteredNotifications.forEach(n => {
      const diff = Date.now() - new Date(n.created_at).getTime();
      if (diff < oneDay) {
        today.push(n);
      } else {
        earlier.push(n);
      }
    });
    return { today, earlier };
  };

  const { today, earlier } = getGroupedNotifications();

  return (
    <div className="h-full flex flex-col space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            Notifications
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Stay updated on messages, meetings, AI insights, and system activity.
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <span className="px-2.5 py-1 bg-[#0c101b]/95 border border-cyan-500/20 text-cyan-400 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg shadow-cyan-500/5 animate-pulse">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full"></span>
              {unreadCount} New
            </span>
          )}
          <button 
            onClick={handleMarkAllRead} 
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <CheckCheck size={16} />
            <span>Mark all as read</span>
          </button>
        </div>
      </div>

      {/* Tabs Filter Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-900/60">
        {['All', 'AI Insights', 'Messages', 'Meetings', 'System', 'Unread'].map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setActionSuccess(null);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
              activeTab === tab 
                ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.05)]' 
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Split Pane Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        {/* Left Column: List */}
        <div className="lg:col-span-7 flex flex-col space-y-6 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex-1 flex items-center justify-center p-12 text-slate-500">
              <Loader2 className="animate-spin text-cyan-400 mr-2" size={24} />
              <span>Fetching notification feeds...</span>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#0c101b]/50 border border-slate-900 rounded-2xl">
              <Bell size={36} className="text-slate-600 mb-3" />
              <p className="text-slate-400 font-bold">No notifications found</p>
              <p className="text-xs text-slate-600 mt-1">Try switching filter tabs or check back later.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* TODAY SECTION */}
              {today.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Today</h2>
                  <div className="space-y-2.5">
                    {today.map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedId(item.id);
                          setActionSuccess(null);
                          if (item.unread) {
                            handleToggleRead(item.id, true);
                          }
                        }}
                        className={`p-4 rounded-2xl border transition-all flex items-start gap-4 cursor-pointer hover:border-slate-800 ${
                          selectedId === item.id 
                            ? 'bg-[#0c101b] border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.02)]' 
                            : 'bg-[#0c101b]/60 border-slate-900/60'
                        }`}
                      >
                        {/* Icon & Unread Pin */}
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            selectedId === item.id ? 'bg-cyan-950/80 border border-cyan-500/20' : 'bg-slate-950/60 border border-slate-900'
                          }`}>
                            {getIcon(item.type)}
                          </div>
                          {item.unread && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border-2 border-[#070a13] rounded-full animate-pulse" />
                          )}
                        </div>

                        {/* Text details */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-bold text-sm truncate ${item.unread ? 'text-white' : 'text-slate-300'}`}>
                              {item.title}
                            </span>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap font-medium">
                              {item.display_time_label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                            {item.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* EARLIER SECTION */}
              {earlier.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Earlier</h2>
                  <div className="space-y-2.5">
                    {earlier.map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedId(item.id);
                          setActionSuccess(null);
                          if (item.unread) {
                            handleToggleRead(item.id, true);
                          }
                        }}
                        className={`p-4 rounded-2xl border transition-all flex items-start gap-4 cursor-pointer hover:border-slate-800 ${
                          selectedId === item.id 
                            ? 'bg-[#0c101b] border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.02)]' 
                            : 'bg-[#0c101b]/60 border-slate-900/60'
                        }`}
                      >
                        {/* Icon & Unread Pin */}
                        <div className="relative">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            selectedId === item.id ? 'bg-cyan-950/80 border border-cyan-500/20' : 'bg-slate-950/60 border border-slate-900'
                          }`}>
                            {getIcon(item.type)}
                          </div>
                          {item.unread && (
                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border-2 border-[#070a13] rounded-full" />
                          )}
                        </div>

                        {/* Text details */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-bold text-sm truncate ${item.unread ? 'text-white' : 'text-slate-300'}`}>
                              {item.title}
                            </span>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap font-medium">
                              {item.display_time_label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                            {item.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Details */}
        <div className="lg:col-span-5">
          {selectedNotification ? (
            <div className="bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 h-full flex flex-col justify-between hover:shadow-[0_0_30px_rgba(6,182,212,0.02)] transition-shadow">
              <div className="space-y-6">
                {/* Details Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-900/60">
                  <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">Details</span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleRead(selectedNotification.id, !selectedNotification.unread)}
                      title={selectedNotification.unread ? "Mark as Read" : "Mark as Unread"}
                      className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                    >
                      <CheckCheck size={14} className={selectedNotification.unread ? "" : "text-cyan-400"} />
                    </button>
                    <button
                      onClick={() => handleDelete(selectedNotification.id)}
                      title="Delete notification"
                      className="p-2 bg-slate-950/60 hover:bg-red-950/20 border border-slate-900 text-slate-400 hover:text-red-400 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Details Content Card */}
                <div className="space-y-5 text-left">
                  {/* Sender & Time row */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/20 flex items-center justify-center shadow-md shadow-cyan-500/5">
                      {getIcon(selectedNotification.type)}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-white text-base leading-tight">
                        {selectedNotification.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                        {selectedNotification.display_time_label} • {selectedNotification.sender || 'System Generated'}
                      </p>
                    </div>
                  </div>

                  {/* Body description */}
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {selectedNotification.details}
                  </p>

                  {/* Bullet points (if any) */}
                  {selectedNotification.points && selectedNotification.points.length > 0 && (
                    <div className="space-y-2 mt-4 p-4 bg-[#121625]/20 border border-slate-900/60 rounded-2xl">
                      <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Key factors identified:</h4>
                      <ul className="space-y-2 text-xs text-slate-400 list-none pl-1">
                        {selectedNotification.points.map((pt, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-cyan-400 mt-1 select-none flex-shrink-0">•</span>
                            <span className="leading-relaxed">{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Suggested Action Callout */}
              {selectedNotification.suggested_action && (
                <div className="mt-8 pt-4 border-t border-slate-900/60 space-y-4 text-left">
                  <div className="p-5 rounded-2xl bg-[#0e1322]/40 border border-cyan-500/10 shadow-[0_0_20px_rgba(6,182,212,0.03)] space-y-4">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                        <Sparkles size={10} className="fill-current" /> Suggested Action
                      </span>
                    </div>
                    
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {selectedNotification.suggested_action}
                    </p>

                    {actionSuccess ? (
                      <div className="flex items-center gap-2 p-2.5 bg-emerald-950/20 border border-emerald-500/25 rounded-xl text-emerald-400 text-xs font-semibold">
                        <Check size={14} className="stroke-[3]" />
                        <span>{actionSuccess}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRunSuggestedAction(selectedNotification.action_type)}
                        disabled={actionLoading}
                        className="w-full py-2.5 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] disabled:opacity-60 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-cyan-400/10 active:scale-[0.99] transition-all cursor-pointer"
                      >
                        {actionLoading ? (
                          <>
                            <Loader2 className="animate-spin" size={14} />
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <FileText size={14} />
                            <span>{selectedNotification.button_text || 'Run Action'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full border border-slate-900 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
              <Bell size={24} className="text-slate-600 mb-2" />
              <p className="text-sm font-semibold">Select a notification</p>
              <p className="text-xs text-slate-600 mt-1">Select an item from the list to view its complete details and run recommended actions.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
