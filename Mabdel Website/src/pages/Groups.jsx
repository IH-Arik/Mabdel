import { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  User,
  MessageSquare, 
  Plus, 
  Search, 
  ArrowLeft, 
  Trash2, 
  Check, 
  Settings, 
  Video, 
  Info, 
  FileText, 
  Download, 
  Sparkles, 
  CheckCheck,
  Send,
  MoreVertical,
  Paperclip,
  Share2,
  Lock,
  Loader2,
  Pencil
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

// Seeding contact directory
const CONTACTS_DIRECTORY = [
  { id: 'c-1', name: 'Alex Rivera', role: 'Art Director', email: 'alex.r@smartflow.com', avatar: 'AR' },
  { id: 'c-2', name: 'Jordan Smith', role: 'Brand Manager', email: 'jordan.s@smartflow.com', avatar: 'JS' },
  { id: 'c-3', name: 'Sarah Chen', role: 'UX Designer', email: 'sarah.c@smartflow.com', avatar: 'SC' },
  { id: 'c-4', name: 'Marcus Wright', role: 'Lead Dev', email: 'marcus.w@smartflow.com', avatar: 'MW' },
  { id: 'c-5', name: 'Sarah Jenkins', role: 'Brand Manager', email: 'sarah.j@smartflow.com', avatar: 'SJ' },
  { id: 'c-6', name: 'David Thompson', role: 'Senior Manager', email: 'david.t@smartflow.com', avatar: 'DT' },
  { id: 'c-7', name: 'Emily Carter', role: 'Marketing Lead', email: 'emily.c@smartflow.com', avatar: 'EC' },
  { id: 'c-8', name: 'Michael Brown', role: 'Art Director', email: 'm.brown@smartflow.com', avatar: 'MB' }
];

const INITIAL_GROUPS = [
  {
    id: 'grp-1',
    name: 'Marketing Team',
    avatarText: 'MT',
    type: 'Team',
    memberCount: 12,
    created: 'Oct 2023',
    configurations: { invites: false, summarize: true, privacy: true },
    activity: [
      { text: 'Project Brief shared by Sarah J.', author: 'Sarah J.', time: 'Today 10:29 AM', type: 'file' },
      { text: 'AI Summary generated for Weekly Sync', author: 'System', time: 'Yesterday', type: 'ai' }
    ],
    members: [
      { name: 'Sarah Jenkins', email: 'sarah.j@smartflow.com', role: 'ADMIN', avatar: 'SJ' },
      { name: 'David Thompson', email: 'david.t@smartflow.com', role: 'MEMBER', avatar: 'DT' },
      { name: 'Emily Carter', email: 'emily.c@smartflow.com', role: 'MEMBER', avatar: 'EC' },
      { name: 'Michael Brown', email: 'm.brown@smartflow.com', role: 'MEMBER', avatar: 'MB' }
    ],
    chatHistory: [
      { id: 'msg-1', sender: 'Alex Rivera', role: 'Art Director', text: 'Hey team! Has anyone finished the @Sarah brand guidelines yet?', time: '10:25 AM', avatar: 'AR' },
      { id: 'msg-2', sender: 'Me', text: 'I\'m just finishing the typography section now. Will upload in a second!', time: '10:27 AM', isMe: true },
      { id: 'msg-3', sender: 'Sarah Jenkins', role: 'Brand Manager', text: 'Awesome. Here is the moodboard and the brief document for reference.', time: '10:28 AM', avatar: 'SJ', hasImage: true, docName: 'Project_Brief_Q1.pdf', docSize: '2.4 MB' }
    ],
    sharedFiles: [
      { name: 'Q1_Moodboard_v2.png', date: 'Today 10:28 AM', size: '1.8 MB' },
      { name: 'Project_Brief_Q1.pdf', date: 'Today 10:29 AM', size: '2.4 MB' }
    ]
  },
  {
    id: 'grp-2',
    name: 'Clients - 2026',
    avatarText: 'C',
    type: 'Clients',
    memberCount: 48,
    created: 'Jan 2026',
    configurations: { invites: true, summarize: true, privacy: false },
    activity: [],
    members: [],
    chatHistory: [],
    sharedFiles: []
  },
  {
    id: 'grp-3',
    name: 'Investors',
    avatarText: 'I',
    type: 'Investors',
    memberCount: 7,
    created: 'Oct 2023',
    configurations: { invites: false, summarize: true, privacy: true },
    activity: [
      { text: 'Q3 Report shared', author: 'Sarah L.', time: '2 hours ago', type: 'file' },
      { text: 'AI Summary generated for Weekly Sync', author: 'System', time: 'Yesterday', type: 'ai' },
      { text: 'David Chen joined the group', author: 'System', time: 'Oct 12', type: 'system' }
    ],
    members: [
      { name: 'Sarah L.', email: 'sarah.l@acme.com', role: 'ADMIN', avatar: 'SL' },
      { name: 'David Chen', email: 'david.c@capital.com', role: 'MEMBER', avatar: 'DC' }
    ],
    chatHistory: [],
    sharedFiles: []
  },
  {
    id: 'grp-4',
    name: 'Design Partners',
    avatarText: 'DP',
    type: 'Partners',
    memberCount: 5,
    created: 'Dec 2024',
    configurations: { invites: true, summarize: false, privacy: false },
    activity: [],
    members: [],
    chatHistory: [],
    sharedFiles: []
  }
];

export default function Groups() {
  const [groups, setGroups] = useState(INITIAL_GROUPS);
  
  const location = useLocation();

  const [selectedGroupId, setSelectedGroupId] = useState('grp-3'); // Investors selected by default in Screenshot 4
  const [searchQuery, setSearchQuery] = useState('');
  
  // View states: 'dashboard', 'chat', 'create', 'settings'
  const [viewMode, setViewMode] = useState('dashboard');

  // Create group form state
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState('Clients');
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([
    CONTACTS_DIRECTORY[0], // Alex Rivera
    CONTACTS_DIRECTORY[1], // Jordan Smith
    CONTACTS_DIRECTORY[2], // Sarah Chen
    CONTACTS_DIRECTORY[3]  // Marcus Wright
  ]);

  // Chat conversation state
  const [currentMessageText, setCurrentMessageText] = useState('');
  const [isTyping, setIsTyping] = useState(true); // Sarah typing indicator by default

  // AI helper states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiResultType, setAiResultType] = useState(''); // 'summary', 'action_items'

  const activeGroup = groups.find(g => g.id === selectedGroupId) || groups[0];
  const chatBottomRef = useRef(null);

  // Auto scroll chat list
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeGroup?.chatHistory, isTyping, viewMode]);

  useEffect(() => {
    if (location.state?.prefill) {
      const p = location.state.prefill;
      setNewGroupName(p.group_name || p.groupName || p.name || p.title || '');
      setNewGroupType(p.group_type || p.groupType || p.type || 'Team');
      setViewMode('create');
      
      // Clear state so it doesn't re-trigger
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Handle message dispatch
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!currentMessageText.trim()) return;

    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: 'Me',
      text: currentMessageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true
    };

    setGroups(prev => prev.map(g => {
      if (g.id === selectedGroupId) {
        return {
          ...g,
          chatHistory: [...g.chatHistory, newMsg]
        };
      }
      return g;
    }));

    setCurrentMessageText('');
    
    // Simulate AI stop typing
    setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  };

  // Run AI action helpers
  const runAIAction = (type) => {
    setAiLoading(true);
    setAiResult(null);
    setAiResultType(type);

    setTimeout(() => {
      setAiLoading(false);
      if (type === 'summary') {
        setAiResult({
          title: 'AI Thread Summary',
          body: 'Alex Rivera requested the status on Sarah brand guidelines. User (Me) confirmed typography sections are nearly finished and will be uploaded shortly. Sarah Jenkins shared the Q1 moodboard and Project Brief document for team reference.'
        });
      } else if (type === 'action_items') {
        setAiResult({
          title: 'AI Extracted Actions',
          list: [
            'Upload finished typography layouts (Assigned to Me / Today)',
            'Review Sarah Jenkins moodboard and brief attachment (Assigned to Design Team / Friday)',
            'Confirm guideline feedback details with Sarah Jenkins'
          ]
        });
      } else if (type === 'draft') {
        // Appends a draft to input
        setCurrentMessageText('No problem! Reviewing the brief now and will submit the typography layouts shortly.');
      }
    }, 1500);
  };

  // Group creation handler
  const handleCreateGroup = (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup = {
      id: `grp-${Date.now()}`,
      name: newGroupName,
      avatarText: newGroupName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'GP',
      type: newGroupType,
      memberCount: selectedMembers.length,
      created: 'Jun 2026',
      configurations: { invites: true, summarize: true, privacy: false },
      activity: [
        { text: `Group created with ${selectedMembers.length} members.`, author: 'System', time: 'Just now', type: 'system' }
      ],
      members: selectedMembers.map(m => ({ name: m.name, email: m.email, role: 'MEMBER', avatar: m.avatar })),
      chatHistory: [
        { id: 'msg-init', sender: 'System', text: `Welcome to the ${newGroupName} chat room!`, time: 'Just now' }
      ],
      sharedFiles: []
    };

    setGroups(prev => [newGroup, ...prev]);
    setSelectedGroupId(newGroup.id);
    setNewGroupName('');
    setViewMode('dashboard');
  };

  // Toggle member invite select
  const handleSelectMemberToggle = (contact) => {
    if (selectedMembers.some(m => m.id === contact.id)) {
      setSelectedMembers(prev => prev.filter(m => m.id !== contact.id));
    } else {
      setSelectedMembers(prev => [...prev, contact]);
    }
  };

  // Configuration updates inside Settings
  const handleToggleConfig = (key, val) => {
    setGroups(prev => prev.map(g => {
      if (g.id === selectedGroupId) {
        return {
          ...g,
          configurations: { ...g.configurations, [key]: val }
        };
      }
      return g;
    }));
  };

  // Delete active group
  const handleDeleteGroup = () => {
    const remaining = groups.filter(g => g.id !== selectedGroupId);
    setGroups(remaining);
    setSelectedGroupId(remaining.length > 0 ? remaining[0].id : null);
    setViewMode('dashboard');
  };

  // Search filter
  const filteredGroupsList = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col space-y-6">

      {/* =========================================================================
          VIEW MODE: CREATE GROUP (SCREENSHOT 2)
          ========================================================================= */}
      {viewMode === 'create' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0 relative text-left">
          {/* Back Trigger */}
          <div className="lg:col-span-8 flex-1 bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 pb-6 border-b border-slate-900/60">
                <button 
                  onClick={() => setViewMode('dashboard')}
                  className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} />
                </button>
                <h1 className="text-xl font-bold text-white">Create Group</h1>
              </div>

              {/* Group configuration details */}
              <form onSubmit={handleCreateGroup} className="space-y-6 mt-6">
                
                {/* Upload logo placeholder row */}
                <div className="flex flex-col items-center space-y-3">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full bg-slate-900 border border-dashed border-cyan-500/30 flex items-center justify-center text-cyan-400 cursor-pointer hover:bg-slate-800 transition-colors">
                      <User size={32} />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Group Image</span>
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 tracking-wide uppercase">Group Name</label>
                  <input 
                    type="text" 
                    placeholder="Enter group name..."
                    className="w-full px-4 py-3 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-semibold text-white placeholder:text-gray-600"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    required
                  />
                </div>

                {/* Group type selector */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold text-slate-400 tracking-wide uppercase">Group Type</label>
                  <div className="flex flex-wrap gap-2.5">
                    {['Team', 'Clients', 'Investors', 'Partners'].map(type => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setNewGroupType(type)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap cursor-pointer ${
                          newGroupType === type 
                            ? 'bg-cyan-950/40 text-cyan-400 border-cyan-500/35 shadow-[0_0_15px_rgba(6,182,212,0.08)]' 
                            : 'bg-transparent text-slate-400 border-slate-900/60 hover:text-slate-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Members list checkbox selector */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-400 tracking-wide uppercase">Members ({selectedMembers.length} Selected)</label>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search for members..."
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 transition-colors"
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Selected Tags list */}
                  {selectedMembers.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {selectedMembers.map(member => (
                        <div 
                          key={member.id} 
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#121625]/60 border border-slate-900 rounded-full text-xs font-bold text-slate-300"
                        >
                          <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[8px] text-cyan-400 font-bold overflow-hidden">
                            {member.avatar}
                          </div>
                          <span>{member.name}</span>
                          <button 
                            type="button"
                            onClick={() => setSelectedMembers(prev => prev.filter(m => m.id !== member.id))}
                            className="text-slate-500 hover:text-red-400 text-xs font-bold ml-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Directory list options */}
                  <div className="max-h-36 overflow-y-auto space-y-1.5 p-1 border border-slate-900 rounded-2xl">
                    {CONTACTS_DIRECTORY.filter(c => c.name.toLowerCase().includes(memberSearchQuery.toLowerCase())).map(contact => {
                      const isChosen = selectedMembers.some(m => m.id === contact.id);
                      return (
                        <div 
                          key={contact.id}
                          onClick={() => handleSelectMemberToggle(contact)}
                          className={`flex items-center justify-between p-2 rounded-xl cursor-pointer hover:bg-slate-950 ${
                            isChosen ? 'bg-cyan-950/20' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-400">
                              {contact.avatar}
                            </div>
                            <div>
                              <p className="text-xs text-white font-bold">{contact.name}</p>
                              <p className="text-[10px] text-slate-500">{contact.email}</p>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                            isChosen ? 'border-cyan-500 bg-cyan-950/80 text-cyan-400' : 'border-slate-800'
                          }`}>
                            {isChosen && <Check size={10} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Manual add & CSV links */}
                  <div className="flex items-center gap-3 pt-2">
                    <button type="button" className="flex-1 py-2 bg-slate-950 border border-slate-900 border-dashed text-slate-400 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                      <Plus size={14} /> Add Member
                    </button>
                    <button type="button" className="flex-1 py-2 bg-slate-950 border border-slate-900 border-dashed text-slate-400 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                      <FileText size={14} /> Import CSV
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 mt-6 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-400/10 active:scale-[0.99] transition-all cursor-pointer text-center flex items-center justify-center"
                >
                  Create Group
                </button>

              </form>
            </div>
          </div>

          {/* Right Column: AI & Preview */}
          <div className="lg:col-span-4 w-full lg:w-[400px] flex flex-col justify-between space-y-6">
            {/* AI Assistant Context */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-4">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={12} className="fill-current" /> AI Assistant
              </span>
              <p className="text-xs text-slate-400 leading-relaxed">
                You can use this <span className="text-cyan-400 font-bold">{newGroupName || 'New'}</span> group for automated bulk messaging and targeted workflow triggers. Setting up integration with your CRM is recommended.
              </p>
              <button type="button" className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1">
                Configure Workflow →
              </button>
            </div>

            {/* LIVE PREVIEW BOX */}
            <div className="flex-1 bg-[#0c101b] border-2 border-cyan-500/40 rounded-3xl p-6 flex flex-col justify-between items-center relative min-h-[300px]">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest absolute top-6 left-6">Live Preview</span>
              
              {/* Profile display */}
              <div className="flex flex-col items-center space-y-4 my-auto pt-8">
                <div className="w-20 h-20 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-3xl text-cyan-400 font-bold shadow-lg shadow-cyan-500/5">
                  {newGroupName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || <Users size={32} />}
                </div>
                <h3 className="text-xl font-extrabold text-white tracking-tight text-center">
                  {newGroupName || 'New Client Group'}
                </h3>
                
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-cyan-950/80 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold rounded-full">
                    {newGroupType}
                  </span>
                  <span className="text-slate-700 text-xs">•</span>
                  <span className="text-xs text-slate-400 font-bold">
                    {selectedMembers.length} Members
                  </span>
                </div>

                {/* Overlapping avatars preview */}
                {selectedMembers.length > 0 && (
                  <div className="flex items-center -space-x-2.5 pt-2">
                    {selectedMembers.slice(0, 6).map((m, idx) => (
                      <div 
                        key={idx}
                        className="w-8 h-8 rounded-full border border-slate-950 bg-slate-900 flex items-center justify-center text-[9px] text-cyan-400 font-bold overflow-hidden shadow-md"
                        title={m.name}
                      >
                        {m.avatar}
                      </div>
                    ))}
                    {selectedMembers.length > 6 && (
                      <div className="w-8 h-8 rounded-full border border-slate-950 bg-slate-950 flex items-center justify-center text-[9px] text-slate-400 font-bold">
                        +{selectedMembers.length - 6}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: GROUP SETTINGS (SCREENSHOT 1)
          ========================================================================= */}
      {viewMode === 'settings' && activeGroup && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0 relative text-left">
          
          {/* Main Pane: Details & Members list */}
          <div className="lg:col-span-8 flex-1 bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 flex flex-col space-y-6 overflow-y-auto">
            
            {/* Header back link */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-900/60">
              <button 
                onClick={() => setViewMode('chat')}
                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Back to chat</span>
              </button>
              <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">Group Settings</span>
            </div>

            {/* Profile Overview Card */}
            <div className="p-6 bg-slate-950/40 border border-slate-900 rounded-2xl flex items-center gap-5">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-tr from-cyan-400 to-teal-500 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/5">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-2xl text-cyan-400 font-bold">
                  {activeGroup.avatarText}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-extrabold text-white leading-tight truncate">{activeGroup.name}</h2>
                  <button className="text-slate-500 hover:text-slate-300 transition-colors" title="Edit Group Name">
                    <Pencil size={14} />
                  </button>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  {activeGroup.memberCount} Members • Created {activeGroup.created}
                </p>
              </div>
            </div>

            {/* Members grid list */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-500 tracking-wider uppercase">Members ({activeGroup.members.length})</h3>
              
              <div className="space-y-2.5">
                {activeGroup.members.map((member, idx) => (
                  <div 
                    key={idx}
                    className="p-4 bg-slate-950/30 border border-slate-900 rounded-2xl flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-400">
                        {member.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-bold truncate">{member.name}</p>
                        <p className="text-xs text-slate-500 truncate">{member.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wider ${
                        member.role === 'ADMIN' ? 'bg-cyan-950/80 border border-cyan-500/20 text-cyan-400' : 'bg-slate-900 text-slate-500'
                      }`}>
                        {member.role}
                      </span>
                      <button className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-500 hover:text-slate-300" title="Options">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add member dashed button */}
                <button className="w-full p-4 border border-dashed border-slate-900 hover:border-slate-800 rounded-2xl flex items-center justify-center gap-1.5 text-xs font-bold text-cyan-400 hover:bg-cyan-950/5 transition-all cursor-pointer">
                  <Plus size={16} /> Add Members
                </button>
              </div>
            </div>

          </div>

          {/* Right sidebar column: configuration parameters & danger zones */}
          <div className="lg:col-span-4 w-full lg:w-80 space-y-6">
            {/* Configurations toggles */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 space-y-5">
              <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase pb-2 border-b border-slate-900/60">Group Configurations</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-left">
                    <p className="text-xs text-slate-200 font-bold">Allow Member Invites</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Members can invite others</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={activeGroup.configurations.invites}
                      onChange={(e) => handleToggleConfig('invites', e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-950 border border-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500/80 peer-checked:after:bg-[#070a13] peer-checked:after:border-transparent"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="text-left">
                    <p className="text-xs text-slate-200 font-bold">AI Auto-Summarize</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Daily activity digests</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={activeGroup.configurations.summarize}
                      onChange={(e) => handleToggleConfig('summarize', e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-950 border border-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500/80 peer-checked:after:bg-[#070a13] peer-checked:after:border-transparent"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="text-left">
                    <p className="text-xs text-slate-200 font-bold">Strict Privacy Mode</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Hide group from search</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={activeGroup.configurations.privacy}
                      onChange={(e) => handleToggleConfig('privacy', e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-950 border border-slate-900 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-500 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500/80 peer-checked:after:bg-[#070a13] peer-checked:after:border-transparent"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase pb-2 border-b border-slate-900/60">Danger Zone</h3>
              
              <div className="space-y-3">
                <button 
                  onClick={() => setViewMode('dashboard')}
                  className="w-full py-3 border border-red-500/30 hover:border-red-500/60 text-red-400 rounded-2xl text-xs font-bold transition-all cursor-pointer bg-transparent"
                >
                  Leave Group
                </button>
                <button 
                  onClick={handleDeleteGroup}
                  className="w-full py-3 bg-red-400 hover:bg-red-500 text-[#070a13] rounded-2xl text-xs font-extrabold shadow-md shadow-red-500/10 transition-all cursor-pointer"
                >
                  Delete Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: ACTIVE GROUP CHAT WORKSPACE (SCREENSHOT 3)
          ========================================================================= */}
      {viewMode === 'chat' && activeGroup && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0 relative text-left">
          
          {/* Main Chat Pane */}
          <div className="lg:col-span-8 flex-1 bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between min-h-[450px]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-900/60">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setViewMode('dashboard')}
                  className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <h2 className="text-base font-extrabold text-white tracking-tight">{activeGroup.name}</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">{activeGroup.memberCount} Members</p>
                </div>
              </div>

              {/* Action buttons (Video call, settings cog) */}
              <div className="flex items-center gap-2">
                <button className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl transition-all" title="Start Video Call">
                  <Video size={16} />
                </button>
                <button 
                  onClick={() => setViewMode('settings')}
                  className="p-2 bg-slate-950/60 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                  title="Group Settings"
                >
                  <Info size={16} />
                </button>
              </div>
            </div>

            {/* Conversation Feed */}
            <div className="flex-1 overflow-y-auto my-4 space-y-4 pr-1">
              <div className="text-center my-4">
                <span className="px-3 py-1 bg-slate-950/40 border border-slate-900 rounded-full text-[9px] font-bold text-slate-500 uppercase tracking-widest">Today</span>
              </div>

              {activeGroup.chatHistory.map((msg, idx) => (
                <div 
                  key={msg.id || idx}
                  className={`flex gap-3 text-left ${msg.isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {/* Avatar left */}
                  {!msg.isMe && (
                    <div className="w-8 h-8 rounded-lg bg-slate-900 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-400">
                      {msg.avatar || 'U'}
                    </div>
                  )}

                  {/* Body message details */}
                  <div className={`flex flex-col space-y-1 max-w-[70%] ${msg.isMe ? 'items-end' : 'items-start'}`}>
                    {!msg.isMe && (
                      <span className="text-[10px] font-bold text-slate-400">{msg.sender}</span>
                    )}
                    
                    <div className={`p-3.5 rounded-2xl text-xs leading-relaxed font-semibold ${
                      msg.isMe 
                        ? 'bg-cyan-500/90 text-[#070a13] rounded-tr-none' 
                        : 'bg-[#121625]/60 border border-slate-900 text-slate-200 rounded-tl-none'
                    }`}>
                      {msg.text}
                    </div>

                    {/* Inline images attachments snippet */}
                    {msg.hasImage && (
                      <div className="w-36 h-64 border border-slate-900 rounded-xl overflow-hidden mt-1 bg-slate-950/40 p-1">
                        <div className="w-full h-full bg-[#121625]/60 border border-slate-900 rounded-lg flex flex-col justify-end p-3 relative">
                          <span className="text-[8px] font-bold text-cyan-400 uppercase tracking-widest absolute top-3 left-3">Moodboard</span>
                          {/* Sub mockup display */}
                          <div className="w-full h-44 bg-[#070a13]/80 border border-slate-900 rounded p-1 text-[7px] text-slate-400 overflow-hidden font-mono flex flex-col justify-between">
                            <span className="text-cyan-400 font-extrabold uppercase">Guidelines</span>
                            <div className="w-full h-1/2 bg-cyan-950/30 border border-cyan-500/20 rounded flex items-center justify-center text-cyan-400 font-bold">MT</div>
                            <span className="truncate">ittesafarik.typography.doc</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* File Attachment card block */}
                    {msg.docName && (
                      <div className="flex items-center justify-between gap-6 p-3 bg-slate-950/50 border border-slate-900 rounded-xl mt-1.5 w-60">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={16} className="text-cyan-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-slate-300 font-bold truncate">{msg.docName}</p>
                            <p className="text-[9px] text-slate-500 font-medium">{msg.docSize}</p>
                          </div>
                        </div>
                        <button className="text-slate-500 hover:text-white transition-colors" title="Download Document">
                          <Download size={14} />
                        </button>
                      </div>
                    )}

                    <span className="text-[8px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">{msg.time}</span>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isTyping && (
                <div className="flex gap-3 justify-start items-center">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-400">
                    SJ
                  </div>
                  <div className="flex flex-col space-y-1 items-start">
                    <span className="text-[10px] font-bold text-slate-400">Sarah Jenkins is typing</span>
                    <div className="bg-[#121625]/20 border border-slate-900/60 text-cyan-400 text-xs py-2 px-3.5 rounded-xl rounded-tl-none flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Input Composer form */}
            <form onSubmit={handleSendMessage} className="border-t border-slate-900/60 pt-4 flex items-center gap-3">
              <button type="button" className="p-3 bg-slate-950 border border-slate-900 text-slate-500 hover:text-white rounded-xl transition-all" title="Attach file">
                <Paperclip size={16} />
              </button>
              
              <input 
                type="text" 
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder-slate-500"
                value={currentMessageText}
                onChange={(e) => setCurrentMessageText(e.target.value)}
              />

              <button 
                type="submit"
                className="p-3 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-400/10 transition-all cursor-pointer"
                title="Send Message"
              >
                <Send size={16} />
              </button>
            </form>
          </div>

          {/* Right Column Pane: AI Actions & files */}
          <div className="lg:col-span-4 w-full lg:w-80 flex flex-col justify-between space-y-6">
            
            {/* AI ACTIONS */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-4">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={12} className="fill-current" /> AI Actions
              </span>
              
              <div className="space-y-2.5">
                <button 
                  onClick={() => runAIAction('summary')}
                  className="w-full py-2.5 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-300 text-xs font-bold rounded-xl text-center transition-all cursor-pointer"
                >
                  Summarize Thread
                </button>
                <button 
                  onClick={() => runAIAction('draft')}
                  className="w-full py-2.5 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-300 text-xs font-bold rounded-xl text-center transition-all cursor-pointer"
                >
                  Draft Reply
                </button>
                <button 
                  onClick={() => runAIAction('action_items')}
                  className="w-full py-2.5 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-300 text-xs font-bold rounded-xl text-center transition-all cursor-pointer"
                >
                  Extract Action Items
                </button>
              </div>

              {/* AI action output panel */}
              {aiLoading && (
                <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl flex items-center justify-center text-slate-500 text-xs font-semibold">
                  <Loader2 className="animate-spin text-cyan-400 mr-2" size={16} />
                  <span>AI Agent processing...</span>
                </div>
              )}

              {aiResult && !aiLoading && (
                <div className="p-4 bg-[#121625]/20 border border-cyan-500/20 rounded-2xl space-y-2 animate-fadeIn">
                  <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                    <CheckCheck size={11} /> {aiResult.title}
                  </span>
                  
                  {aiResult.body && (
                    <p className="text-slate-300 text-[11px] leading-relaxed font-semibold">
                      {aiResult.body}
                    </p>
                  )}

                  {aiResult.list && (
                    <ul className="space-y-1.5 text-[11px] text-slate-300 pl-1">
                      {aiResult.list.map((act, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-cyan-400 mt-1 flex-shrink-0">•</span>
                          <span className="leading-relaxed font-semibold">{act}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Members & Shared Files panel */}
            <div className="flex-1 bg-[#0c101b] border border-slate-900 rounded-3xl p-6 text-left space-y-5 overflow-y-auto max-h-[300px]">
              
              {/* Members Preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Members</span>
                  <span className="text-xs text-slate-500 font-bold">{activeGroup.members.length}</span>
                </div>
                <div className="space-y-2">
                  {activeGroup.members.slice(0, 3).map((m, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-slate-900 flex items-center justify-center text-[10px] text-slate-400 font-bold">
                        {m.avatar}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-300 font-bold truncate">{m.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">{m.role}</p>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => setViewMode('settings')}
                    className="text-[10px] font-bold text-cyan-400 hover:underline mt-1 cursor-pointer block"
                  >
                    View all {activeGroup.memberCount} members...
                  </button>
                </div>
              </div>

              {/* Shared Files list */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-t border-slate-900/60 pt-4">
                  <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Shared Files</span>
                  <span className="text-xs text-slate-500 font-bold">{activeGroup.sharedFiles.length}</span>
                </div>
                
                {activeGroup.sharedFiles.length > 0 ? (
                  <div className="space-y-2">
                    {activeGroup.sharedFiles.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-950/40 border border-slate-900 rounded-xl">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} className="text-cyan-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-slate-300 font-bold truncate">{f.name}</p>
                            <p className="text-[9px] text-slate-600 font-semibold uppercase mt-0.5">{f.date}</p>
                          </div>
                        </div>
                        <button className="text-slate-500 hover:text-white transition-colors" title="Download File">
                          <Download size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-600 italic">No files shared yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: GROUPS MAIN DASHBOARD (SCREENSHOT 4)
          ========================================================================= */}
      {viewMode === 'dashboard' && (
        <div className="h-full flex flex-col space-y-6">
          {/* Top Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Groups</h1>
              <p className="text-slate-400 text-sm mt-1">
                Manage your contact groups and team conversations.
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Search input */}
              <div className="relative w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                <input 
                  type="text"
                  placeholder="Search groups..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 transition-colors"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Create group button */}
              <button 
                onClick={() => {
                  setNewGroupName('');
                  setSelectedMembers([
                    CONTACTS_DIRECTORY[0],
                    CONTACTS_DIRECTORY[1],
                    CONTACTS_DIRECTORY[2],
                    CONTACTS_DIRECTORY[3]
                  ]);
                  setViewMode('create');
                }}
                className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] hover:shadow-cyan-400/10 rounded-xl text-xs font-extrabold shadow-lg shadow-cyan-500/5 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Create Group</span>
              </button>
            </div>
          </div>

          {/* Split Pane Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
            {/* Left Column: Groups Grid */}
            <div className="lg:col-span-8 overflow-y-auto pr-1">
              {filteredGroupsList.length === 0 ? (
                <div className="p-12 text-center bg-[#0c101b]/50 border border-slate-900 rounded-2xl text-slate-500">
                  <Users size={36} className="mx-auto mb-3 text-slate-600" />
                  <p className="font-bold">No groups found</p>
                  <p className="text-xs text-slate-600 mt-1">Change your search query or create a new group.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredGroupsList.map(item => {
                    const isSelected = selectedGroupId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setSelectedGroupId(item.id)}
                        className={`p-5 rounded-2xl border transition-all flex flex-col justify-between h-40 text-left cursor-pointer relative overflow-hidden group ${
                          isSelected 
                            ? 'bg-[#0c101b] border-cyan-500/35 shadow-[0_0_20px_rgba(6,182,212,0.02)]' 
                            : 'bg-[#0c101b]/60 border-slate-900/60 hover:border-slate-800'
                        }`}
                      >
                        {/* Top detail (Icon initial & config dots) */}
                        <div className="flex items-center justify-between">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isSelected ? 'bg-cyan-950/80 border border-cyan-500/20 text-cyan-400 shadow-md shadow-cyan-500/5' : 'bg-slate-950 border border-slate-900 text-slate-400'
                          }`}>
                            {item.avatarText}
                          </div>
                          
                          <button className="p-1 text-slate-600 hover:text-white rounded-lg hover:bg-slate-950 transition-colors" title="Actions">
                            <MoreVertical size={14} />
                          </button>
                        </div>

                        {/* Title and details */}
                        <div>
                          <h3 className="font-extrabold text-white text-base leading-tight truncate">
                            {item.name}
                          </h3>
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                            <Users size={10} /> {item.memberCount} Members
                          </p>
                        </div>

                        {/* Hover visual controls */}
                        <div className="absolute right-5 bottom-5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex gap-2">
                          {item.chatHistory.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedGroupId(item.id);
                                setViewMode('chat');
                              }}
                              className="p-2 bg-slate-950 border border-slate-900 text-slate-400 hover:text-white hover:border-slate-800 rounded-xl transition-all"
                              title="Open Chat"
                            >
                              <MessageSquare size={14} />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedGroupId(item.id);
                              setViewMode('settings');
                            }}
                            className="p-2 bg-slate-950 border border-slate-900 text-slate-400 hover:text-white hover:border-slate-800 rounded-xl transition-all"
                            title="Group Settings"
                          >
                            <Settings size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Group Preview details (Investor detail in Screenshot 4) */}
            <div className="lg:col-span-4">
              {activeGroup ? (
                <div className="bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 h-full flex flex-col justify-between hover:shadow-[0_0_35px_rgba(6,182,212,0.02)] transition-shadow">
                  
                  <div className="space-y-6">
                    {/* Header title */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-900/60">
                      <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">Group Preview</span>
                      <button 
                        onClick={() => {
                          setGroups(prev => prev.filter(g => g.id !== activeGroup.id));
                          setSelectedGroupId(groups.filter(g => g.id !== activeGroup.id)?.[0]?.id || null);
                        }}
                        className="p-2 bg-slate-950/60 hover:bg-red-950/20 border border-slate-900 text-slate-400 hover:text-red-400 rounded-xl transition-all"
                        title="Delete Group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Overview Card */}
                    <div className="flex flex-col items-center space-y-3.5 text-center">
                      <div className="w-16 h-16 rounded-full bg-cyan-950/80 border border-cyan-500/25 flex items-center justify-center text-2xl text-cyan-400 font-bold shadow-lg shadow-cyan-500/5">
                        {activeGroup.avatarText}
                      </div>
                      <div>
                        <h3 className="text-lg font-extrabold text-white leading-tight">{activeGroup.name}</h3>
                        <p className="text-xs text-slate-500 font-semibold mt-1">
                          {activeGroup.memberCount} Members • Created {activeGroup.created}
                        </p>
                      </div>

                      {/* Quick Action buttons */}
                      <div className="flex items-center gap-3.5 pt-2 text-xs font-bold">
                        <button 
                          onClick={() => setViewMode('chat')}
                          className="px-4 py-2 bg-cyan-950/40 border border-cyan-500/20 hover:bg-cyan-950/70 text-cyan-400 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <MessageSquare size={12} /> Message
                        </button>
                        <button 
                          onClick={() => setViewMode('settings')}
                          className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                        >
                          + Add
                        </button>
                        <button 
                          onClick={() => window.location.href = '/bulk-messaging'}
                          className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-900 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
                        >
                          <Share2 size={12} /> Broadcast
                        </button>
                      </div>
                    </div>

                    {/* Recent Activity list */}
                    <div className="space-y-3 text-left pt-2">
                      <h4 className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Recent Activity</h4>
                      
                      {activeGroup.activity.length > 0 ? (
                        <div className="space-y-2.5">
                          {activeGroup.activity.map((act, idx) => (
                            <div key={idx} className="flex items-start gap-2.5 p-3 bg-slate-950/30 border border-slate-900 rounded-xl">
                              {act.type === 'file' ? (
                                <FileText size={14} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                              ) : act.type === 'ai' ? (
                                <Sparkles size={14} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Users size={14} className="text-slate-500 mt-0.5 flex-shrink-0" />
                              )}
                              <div className="min-w-0 leading-normal">
                                <p className="text-xs text-slate-300 font-semibold">{act.text}</p>
                                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mt-1">
                                  {act.author ? `${act.author} • ` : ''}{act.time}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-slate-950/20 border border-slate-900 border-dashed rounded-xl text-center text-slate-600 text-xs italic">
                          No recent activity recorded.
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Settings redirect link */}
                  <div className="mt-8 pt-4 border-t border-slate-900/60">
                    <button
                      onClick={() => setViewMode('settings')}
                      className="w-full py-2.5 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Settings size={12} />
                      <span>Group Settings</span>
                    </button>
                  </div>

                </div>
              ) : (
                <div className="h-full border border-slate-900 border-dashed rounded-3xl flex flex-col items-center justify-center p-8 text-center text-slate-500">
                  <Users size={24} className="text-slate-600 mb-2" />
                  <p className="text-sm font-semibold">Select a group</p>
                  <p className="text-xs text-slate-600 mt-1">Choose a group card to view its activity timeline, admin details, and chat panel.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
