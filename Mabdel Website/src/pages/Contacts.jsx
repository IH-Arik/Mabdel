import { useCallback, useEffect, useState } from 'react';
import { 
  Search, MoreVertical, Mail, Phone, User, 
  Trash2, Filter, Download, UserPlus, ArrowLeft, 
  Check, Calendar, MapPin, Building, ChevronLeft, 
  ChevronRight, Plus, ShieldCheck, Sparkles, MessageSquare, 
  PhoneCall, Pencil, Grid, List, Activity, FileText
} from 'lucide-react';
import { smartflowApi } from '../api/services';

const SEED_CONTACTS = [
  {
    id: 'c-1',
    name: 'Sarah Jenkins',
    phone: '+1 (555) 012-3456',
    email: 'sarah.j@creativehub.com',
    billing_address: '123 Broadway, Apt 4B, New York, NY 10001',
    company: 'Creative Hub',
    location: 'New York, NY',
    last_interaction: '2 hours ago',
    status: 'active',
    dob: '1988-11-12',
    notes: 'Leading visual campaigns for Creative Hub. Prefers Slack or email contact. Highly active client.',
    last_contact_days: 'Today',
    total_calls: 24,
    avatarText: 'SJ',
    online: true,
    activity_chart: [6, 4, 10, 15, 8]
  },
  {
    id: 'c-2',
    name: 'James Wilson',
    phone: '+1 (555) 987-6543',
    email: 'james.w@stark.com',
    billing_address: '10880 Malibu Point, Los Angeles, CA 90265',
    company: 'Stark Industries',
    location: 'Los Angeles, CA',
    last_interaction: 'Yesterday',
    status: 'pending',
    dob: '1970-05-29',
    notes: 'Awaiting contract sign-off for Stark Industries bulk migration. Keep warm and follow up weekly.',
    last_contact_days: 'Yesterday',
    total_calls: 5,
    avatarText: 'JW',
    online: false,
    activity_chart: [2, 1, 3, 2, 4]
  },
  {
    id: 'c-3',
    name: 'Elena Rodriguez',
    phone: '+1 (555) 234-5678',
    email: 'elena@creativehub.io',
    billing_address: '701 Brazos St, Austin, TX 78701',
    company: 'Creative Hub',
    location: 'Austin, TX',
    last_interaction: '3 days ago',
    status: 'active',
    dob: '1992-04-18',
    notes: 'Tech lead on creative pipeline automation. Very interested in scheduling calls via conversational AI.',
    last_contact_days: '3 days ago',
    total_calls: 16,
    avatarText: 'ER',
    online: true,
    activity_chart: [3, 5, 2, 8, 4]
  },
  {
    id: 'c-4',
    name: 'Leslie Alexander',
    phone: '+1 (555) 345-6789',
    email: 'leslie.alex@company.com',
    billing_address: '1201 3rd Ave, Seattle, WA 98101',
    company: 'Design Co',
    location: 'Seattle, WA',
    last_interaction: '2 weeks ago',
    status: 'inactive',
    dob: '1995-09-02',
    notes: 'Currently inactive. Scheduled check-in email next month for Q3 planning needs.',
    last_contact_days: '14 days ago',
    total_calls: 2,
    avatarText: 'LA',
    online: false,
    activity_chart: [1, 0, 0, 1, 0]
  },
  {
    id: 'c-5',
    name: 'John Doe',
    phone: '+1 234 567 890',
    email: 'john@email.com',
    billing_address: '1 Juniper Dr, Delmar, NY 12054',
    company: 'Mabdel AI Corp',
    location: 'Delmar, NY',
    last_interaction: 'Yesterday',
    status: 'active',
    dob: '1999-04-12',
    notes: 'Interested in long-term lease renewal for the downtown commercial hub. Prefers communication via AI assistant for scheduling. Follow up scheduled for next Tuesday regarding the mezzanine floor expansion proposal.',
    last_contact_days: 'Yesterday',
    total_calls: 12,
    avatarText: 'JD',
    online: true,
    activity_chart: [4, 2, 8, 12, 5]
  }
];

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // viewMode: 'dashboard', 'detail', 'create'
  const [viewMode, setViewMode] = useState('dashboard');
  const [selectedContactId, setSelectedContactId] = useState('c-5'); // John Doe selected default

  // Create Contact form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [dob, setDob] = useState('');
  const [leadStatus, setLeadStatus] = useState('New Prospect');
  const [notes, setNotes] = useState('');
  const [workflowSequence, setWorkflowSequence] = useState(true);

  // Layout view config
  const [layoutMode, setLayoutMode] = useState('list'); // 'grid' or 'list'

  // Fetch Contacts from backend
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const response = await smartflowApi.getContacts();
      const rawItems = response.data?.data?.items || [];
      const backendItems = rawItems.map(item => {
        let avatarText = item.avatarText;
        if (!avatarText) {
          if (item.first_name) {
            avatarText = (item.first_name[0] || '') + (item.last_name?.[0] || '');
          } else if (item.name) {
            const parts = item.name.split(' ');
            avatarText = parts.map(p => p[0]).join('').substring(0, 2);
          }
          avatarText = avatarText ? avatarText.toUpperCase() : '??';
        }
        return {
          ...item,
          avatarText,
          online: item.online !== undefined ? item.online : (item.presence === 'online'),
          location: item.location || item.address || 'Remote',
          company: item.company || 'Individual',
          last_interaction: item.last_interaction || 'Active',
          last_contact_days: item.last_contact_days || 'Today',
          total_calls: item.total_calls !== undefined ? item.total_calls : 0,
          activity_chart: item.activity_chart || [0, 0, 0, 0, 0]
        };
      });

      setContacts(backendItems);
    } catch (error) {
      console.error('Error fetching contacts from backend:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Selected Contact
  const activeContact = contacts.find(c => c.id === selectedContactId) || contacts[0];

  // Save Contact trigger
  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) return;

    const fullName = `${firstName} ${lastName}`.trim();
    const payload = {
      name: fullName,
      phone: phone || undefined,
      email: email || undefined,
      billing_address: address || undefined,
      status: leadStatus === 'New Prospect' ? 'pending' : 'active',
      notes: notes || undefined
    };

    try {
      setLoading(true);
      const res = await smartflowApi.createContact(payload);
      if (res.data?.data) {
        const created = res.data.data;
        setContacts(prev => [
          {
            ...created,
            avatarText: firstName[0] + (lastName[0] || ''),
            last_interaction: 'Just now',
            last_contact_days: 'Today',
            total_calls: 0,
            activity_chart: [0, 0, 0, 0, 0]
          },
          ...prev
        ]);
        setSelectedContactId(created.id);
      }
    } catch (err) {
      console.error('Failed to create in backend, running fallback local prefill:', err);
      const localContact = {
        id: `c-${Date.now()}`,
        name: fullName,
        phone,
        email,
        billing_address: address,
        company: 'Individual',
        location: address ? address.split(',').slice(-2).join(',').trim() : 'Remote',
        last_interaction: 'Just now',
        status: leadStatus === 'New Prospect' ? 'pending' : 'active',
        dob,
        notes,
        last_contact_days: 'Today',
        total_calls: 0,
        avatarText: (firstName[0] || '') + (lastName[0] || '').toUpperCase(),
        online: true,
        activity_chart: [0, 0, 0, 0, 0]
      };
      setContacts(prev => [localContact, ...prev]);
      setSelectedContactId(localContact.id);
    } finally {
      setLoading(false);
      setViewMode('dashboard');
    }
  };

  // Delete Contact trigger
  const handleDeleteContact = async (id) => {
    try {
      setLoading(true);
      await smartflowApi.deleteContact(id);
    } catch (err) {
      console.error('Delete Contact API failed, deleting locally:', err);
    }
    const remaining = contacts.filter(c => c.id !== id);
    setContacts(remaining);
    setSelectedContactId(remaining.length > 0 ? remaining[0].id : null);
    setViewMode('dashboard');
    setLoading(false);
  };

  // Status Styles
  const getStatusBadgeStyle = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
      case 'pending':
        return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      case 'inactive':
      default:
        return 'bg-slate-800 border-slate-700 text-slate-400';
    }
  };

  // Filters search list
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  return (
    <div className="h-full flex flex-col space-y-6">

      {/* =========================================================================
          VIEW MODE: CONTACTS DASHBOARD (Image 2)
          ========================================================================= */}
      {viewMode === 'dashboard' && (
        <div className="h-full flex flex-col space-y-6">
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="text-left">
              <h1 className="text-3xl font-extrabold text-white tracking-tight">Contacts</h1>
              <p className="text-slate-400 text-sm mt-1">
                You have {contacts.length} active relationship connections.
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button className="px-4 py-2.5 bg-slate-950 border border-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                <Filter size={14} /> Filter
              </button>
              <button className="px-4 py-2.5 bg-slate-950 border border-slate-900 text-slate-400 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                <Download size={14} /> Export
              </button>
              <button 
                onClick={() => {
                  setFirstName('');
                  setLastName('');
                  setPhone('');
                  setEmail('');
                  setAddress('');
                  setDob('');
                  setNotes('');
                  setViewMode('create');
                }}
                className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-[#070a13] hover:shadow-cyan-400/10 rounded-xl text-xs font-extrabold shadow-lg shadow-cyan-500/5 active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus size={14} /> Add Contact
              </button>
            </div>
          </div>

          {/* Prospects row & Network Reach Card grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            
            {/* Top Prospects Box (2/3 width) */}
            <div className="lg:col-span-8 bg-[#0c101b]/90 border border-slate-900 rounded-3xl p-6 text-left flex flex-col justify-between space-y-4">
              <div className="flex justify-between items-center pb-2">
                <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase">Top Prospects</h3>
                <button className="text-[10px] font-bold text-cyan-400 hover:underline">View All</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contacts.slice(0, 2).map((item, idx) => (
                  <div 
                    key={item.id || idx}
                    onClick={() => {
                      setSelectedContactId(item.id);
                      setViewMode('detail');
                    }}
                    className="p-4 bg-slate-950/40 border border-slate-900 hover:border-slate-800 rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-extrabold text-cyan-400">
                          {item.avatarText}
                        </div>
                        {item.online && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#070a13] rounded-full" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{item.name}</p>
                        <p className="text-[9px] text-slate-500 truncate">{item.email}</p>
                      </div>
                    </div>
                    {/* Micro trend indicator icon */}
                    <div className="text-cyan-400 bg-cyan-950/40 p-1.5 rounded-lg border border-cyan-500/20">
                      <Activity size={12} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Network Reach Panel (1/3 width) */}
            <div className="lg:col-span-4 bg-gradient-to-br from-cyan-400 to-teal-500 rounded-3xl p-6 text-[#070a13] flex flex-col justify-between text-left shadow-lg shadow-cyan-500/10 min-h-[150px]">
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">Network Reach</span>
                <span className="p-1 bg-[#070a13]/10 rounded-lg">
                  <Plus size={14} />
                </span>
              </div>
              <div>
                <p className="text-4xl font-extrabold tracking-tight">94.2k</p>
                <p className="text-[10px] font-bold opacity-80 mt-1">+12.4% vs last month</p>
              </div>
              <div className="flex items-center -space-x-2 pt-2">
                {contacts.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="w-6 h-6 rounded-full border border-[#070a13] bg-[#0c101b] flex items-center justify-center text-[7px] text-cyan-400 font-extrabold shadow-md overflow-hidden">
                    {item.avatarText}
                  </div>
                ))}
                <div className="w-6 h-6 rounded-full border border-[#070a13] bg-[#070a13] flex items-center justify-center text-[7px] text-white font-extrabold shadow-md">
                  +25
                </div>
              </div>
            </div>

          </div>

          {/* Directory section (Full-width list layout) */}
          <div className="bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 flex flex-col space-y-4 text-left">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-slate-900/60">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-extrabold text-white">Directory</h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider bg-slate-950 border border-slate-900 px-2 py-0.5 rounded-full">
                  Showing {filteredContacts.length} connections
                </span>
              </div>

              {/* View options grid/list layout */}
              <div className="flex items-center gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                  <input 
                    type="text" 
                    placeholder="Search directory..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500/40 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-950 border border-slate-900 p-1 rounded-xl">
                  <button 
                    onClick={() => setLayoutMode('grid')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${layoutMode === 'grid' ? 'bg-slate-900 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Grid layout"
                  >
                    <Grid size={14} />
                  </button>
                  <button 
                    onClick={() => setLayoutMode('list')}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${layoutMode === 'list' ? 'bg-slate-900 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
                    title="List layout"
                  >
                    <List size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* List Layout Table */}
            {layoutMode === 'list' ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-900/60 bg-slate-950/20 text-slate-500 text-[10px] font-bold uppercase tracking-wider text-left">
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Company</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">Last Interaction</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/50">
                    {filteredContacts.map(item => (
                      <tr 
                        key={item.id}
                        onClick={() => {
                          setSelectedContactId(item.id);
                          setViewMode('detail');
                        }}
                        className="hover:bg-slate-950/40 cursor-pointer transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-850 flex items-center justify-center text-xs font-bold text-slate-400">
                                {item.avatarText}
                              </div>
                              {item.online && (
                                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 border border-[#070a13] rounded-full" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white leading-none">{item.name}</p>
                              <p className="text-[10px] text-slate-500 mt-1.5">{item.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wide ${getStatusBadgeStyle(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-300 font-semibold">{item.company}</td>
                        <td className="px-6 py-4 text-xs text-slate-400">{item.location}</td>
                        <td className="px-6 py-4 text-xs text-slate-400">{item.last_interaction}</td>
                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => {
                                setSelectedContactId(item.id);
                                setViewMode('detail');
                              }}
                              className="p-2 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                            >
                              <Pencil size={12} />
                            </button>
                            <button 
                              onClick={() => handleDeleteContact(item.id)}
                              className="p-2 bg-slate-950 border border-slate-900 hover:border-red-950/20 text-slate-400 hover:text-red-400 rounded-xl transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* Grid Layout View mode fallback */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                {filteredContacts.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => {
                      setSelectedContactId(item.id);
                      setViewMode('detail');
                    }}
                    className="p-5 bg-slate-950/30 border border-slate-900 hover:border-slate-800 rounded-2xl flex flex-col justify-between gap-4 cursor-pointer hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-400">
                            {item.avatarText}
                          </div>
                          {item.online && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border border-[#070a13] rounded-full" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-white">{item.name}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{item.company}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wide ${getStatusBadgeStyle(item.status)}`}>
                        {item.status}
                      </span>
                    </div>

                    <div className="space-y-2 border-t border-slate-900/60 pt-3 text-[10px] text-slate-400">
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-slate-500" /> <span>{item.phone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="text-slate-500" /> <span className="truncate">{item.email}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Footer */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-900/60">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                Showing 1 to {filteredContacts.length} of {filteredContacts.length} entries
              </span>

              <div className="flex items-center gap-1.5">
                <button className="p-1.5 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-500 rounded-lg transition-colors cursor-pointer">
                  <ChevronLeft size={14} />
                </button>
                <span className="w-7 h-7 bg-cyan-950/60 border border-cyan-500/30 text-cyan-400 flex items-center justify-center rounded-lg text-xs font-extrabold">1</span>
                <span className="w-7 h-7 hover:bg-slate-900 text-slate-500 hover:text-white flex items-center justify-center rounded-lg text-xs font-bold cursor-pointer">2</span>
                <span className="w-7 h-7 hover:bg-slate-900 text-slate-500 hover:text-white flex items-center justify-center rounded-lg text-xs font-bold cursor-pointer">3</span>
                <button className="p-1.5 bg-slate-950 border border-slate-900 hover:border-slate-800 text-slate-500 rounded-lg transition-colors cursor-pointer">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW MODE: CONTACT DETAIL REVIEW (Image 1)
          ========================================================================= */}
      {viewMode === 'detail' && activeContact && (
        <div className="flex-grow flex flex-col space-y-6">
          
          {/* Header row */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-900/60 text-left">
            <button 
              onClick={() => setViewMode('dashboard')}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Back to Directory</span>
            </button>
            <span className="text-xs font-bold text-slate-500 tracking-widest uppercase">Contact Profile</span>
          </div>

          {/* John Doe Profile summary header card */}
          <div className="bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 text-left">
            <div className="flex items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-slate-950 border-2 border-cyan-500/40 p-0.5 flex items-center justify-center shadow-lg shadow-cyan-500/5">
                  <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center text-3xl font-extrabold text-cyan-400">
                    {activeContact.avatarText}
                  </div>
                </div>
                {activeContact.online && (
                  <span className="absolute bottom-0.5 right-0.5 w-4.5 h-4.5 bg-emerald-500 border-4 border-[#0c101b] rounded-full" />
                )}
              </div>

              <div>
                <h2 className="text-2xl font-extrabold text-white leading-tight">{activeContact.name}</h2>
                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 font-semibold">
                  <span className="flex items-center gap-1.5"><Phone size={12} className="text-slate-500" /> {activeContact.phone}</span>
                  <span className="text-slate-700">•</span>
                  <span className="flex items-center gap-1.5"><Mail size={12} className="text-slate-500" /> {activeContact.email}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions call / msg / edit triggers */}
            <div className="flex items-center gap-3">
              <button className="px-5 py-3.5 bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-2xl flex flex-col items-center justify-center min-w-[72px] text-xs font-bold text-slate-400 hover:text-white transition-all">
                <PhoneCall size={16} className="text-cyan-400 mb-1" />
                <span>Call</span>
              </button>
              <button 
                onClick={() => window.location.href = `/conversations`}
                className="px-5 py-3.5 bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-2xl flex flex-col items-center justify-center min-w-[72px] text-xs font-bold text-slate-400 hover:text-white transition-all"
              >
                <MessageSquare size={16} className="text-cyan-400 mb-1" />
                <span>Message</span>
              </button>
              <button className="px-5 py-3.5 bg-slate-950 border border-slate-900 hover:border-slate-800 rounded-2xl flex flex-col items-center justify-center min-w-[72px] text-xs font-bold text-slate-400 hover:text-white transition-all">
                <Pencil size={16} className="text-cyan-400 mb-1" />
                <span>Edit</span>
              </button>
            </div>
          </div>

          {/* Quick stats & details row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch text-left">
            
            {/* Quick Stats card (1/3 width) */}
            <div className="lg:col-span-4 bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 flex flex-col justify-between min-h-[200px]">
              <div className="flex justify-between items-start">
                <span className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-900 flex items-center justify-center text-cyan-400">
                  <Activity size={14} />
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-1">Quick Stats</span>
              </div>

              <div className="space-y-4 mt-6">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Last Contact</span>
                  <p className="text-base font-extrabold text-white mt-0.5">{activeContact.last_contact_days}</p>
                </div>
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Total Calls</span>
                  <p className="text-2xl font-extrabold text-white tracking-tight mt-0.5">{activeContact.total_calls}</p>
                </div>
              </div>

              {/* mini bar chart */}
              <div className="flex items-end gap-1.5 h-10 mt-6 pt-2 w-full justify-start">
                {(activeContact.activity_chart || [4, 2, 8, 12, 5]).map((val, idx) => (
                  <div 
                    key={idx}
                    className="flex-1 bg-cyan-950/40 border border-cyan-500/20 rounded-md transition-all hover:bg-cyan-500/50 hover:border-cyan-400"
                    style={{ height: `${(val / 15) * 100}%` }}
                    title={`Calls count: ${val}`}
                  />
                ))}
              </div>
            </div>

            {/* Contact Details card (2/3 width) */}
            <div className="lg:col-span-8 bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 space-y-5 flex flex-col justify-between">
              <h3 className="text-xs font-bold text-slate-500 tracking-widest uppercase pb-2 border-b border-slate-900/60">Contact Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-xs font-semibold text-slate-400">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-950 border border-slate-900 text-slate-500 rounded-xl">
                    <Mail size={14} />
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Email</span>
                    <span className="text-white mt-0.5 block truncate">{activeContact.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-950 border border-slate-900 text-slate-500 rounded-xl">
                    <Phone size={14} />
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Phone</span>
                    <span className="text-white mt-0.5 block">{activeContact.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-950 border border-slate-900 text-slate-500 rounded-xl">
                    <Building size={14} />
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Address</span>
                    <span className="text-white mt-0.5 block truncate">{activeContact.billing_address || 'No Address Listed'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-950 border border-slate-900 text-slate-500 rounded-xl">
                    <Calendar size={14} />
                  </div>
                  <div>
                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider block">Date of Birth (DOB)</span>
                    <span className="text-white mt-0.5 block">
                      {activeContact.dob ? new Date(activeContact.dob).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '04/12/1999'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center text-[10px] text-slate-500">
                <span>Account Company: <strong className="text-slate-350 font-bold">{activeContact.company}</strong></span>
                <span>Location Area: <strong className="text-slate-350 font-bold">{activeContact.location}</strong></span>
              </div>
            </div>

          </div>

          {/* Notes description panel & Remove Contact button */}
          <div className="bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 space-y-6 text-left flex flex-col justify-between">
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase flex items-center gap-1.5">
                <FileText size={12} /> Notes
              </span>
              <p className="p-4 bg-slate-950/40 border border-slate-900 rounded-2xl text-xs font-semibold text-slate-300 leading-relaxed max-w-none">
                {activeContact.notes || 'No administrative notes added to this contact directory.'}
              </p>
            </div>

            <div className="pt-4 flex justify-center border-t border-slate-900/60">
              <button 
                onClick={() => handleDeleteContact(activeContact.id)}
                className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white hover:shadow-rose-500/10 rounded-2xl text-xs font-extrabold shadow-md active:scale-98 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Remove Contact</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* =========================================================================
          VIEW MODE: CREATE CONTACT VIEW (Image 3)
          ========================================================================= */}
      {viewMode === 'create' && (
        <div className="flex-grow flex flex-col space-y-6">
          
          {/* Header row */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-900/60 text-left">
            <button 
              onClick={() => setViewMode('dashboard')}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={16} />
              <span>Back to Directory</span>
            </button>
            <span className="px-2.5 py-0.5 bg-cyan-950/80 border border-cyan-500/20 text-cyan-400 text-[9px] font-bold rounded-full uppercase tracking-wider">
              Creating Draft
            </span>
          </div>

          {/* Form container */}
          <form onSubmit={handleSaveContact} className="bg-[#0c101b]/95 border border-slate-900 rounded-3xl p-6 space-y-6 text-left">
            
            {/* profile upload block */}
            <div className="flex flex-col items-center justify-center space-y-2 pb-2">
              <div className="relative cursor-pointer group">
                <div className="w-20 h-20 rounded-full bg-slate-950 border-2 border-dashed border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:bg-slate-900 transition-colors">
                  <User size={32} />
                </div>
                <span className="absolute bottom-0 right-0 w-6 h-6 bg-cyan-400 rounded-full flex items-center justify-center text-[#070a13] font-bold text-xs shadow-md">
                  +
                </span>
              </div>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Upload Profile Picture</span>
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* First Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">First Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="text" 
                    placeholder="e.g. Alex"
                    required
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </div>
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Last Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="text" 
                    placeholder="e.g. Thompson"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="text" 
                    placeholder="+1 (415) 555-0123"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              {/* Email Address */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="email" 
                    placeholder="alex.t@lumina.ai"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* Physical Address */}
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Physical Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="text" 
                    placeholder="123 Innovation Drive, San Francisco, CA"
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* DOB */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Date of Birth (DOB)</label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <input 
                    type="date" 
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-750"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
              </div>

              {/* Lead Status select */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Lead Status</label>
                <div className="relative">
                  <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                  <select 
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white"
                    value={leadStatus}
                    onChange={(e) => setLeadStatus(e.target.value)}
                  >
                    <option value="New Prospect">New Prospect</option>
                    <option value="Active Partner">Active Partner</option>
                    <option value="Client Partner">Client Partner</option>
                  </select>
                </div>
              </div>

              {/* Admin Notes */}
              <div className="col-span-1 md:col-span-2 space-y-2">
                <label className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">Administrative Notes</label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3.5 text-slate-500" size={14} />
                  <textarea 
                    placeholder="Add key decision maker insights, communication preferences, or relevant background information here..."
                    className="w-full pl-9 pr-4 py-3 bg-slate-950 border border-slate-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all text-xs font-semibold text-white placeholder:text-gray-700 min-h-[100px]"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>

            </div>

            {/* Form actions save contact */}
            <div className="flex items-center gap-3 pt-2">
              <button 
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-[#070a13] hover:shadow-cyan-400/15 rounded-xl text-xs font-extrabold shadow-md transition-all cursor-pointer"
              >
                Save Contact
              </button>
              <button 
                type="button"
                onClick={() => setViewMode('dashboard')}
                className="px-6 py-3 bg-transparent border border-slate-900 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>

          {/* Privacy & Safety, and Welcome workflow triggers panels (Image 3 bottom) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch text-left">
            
            {/* Privacy details */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-5 flex items-start gap-4">
              <div className="p-2.5 bg-slate-950 border border-slate-900 text-cyan-400 rounded-xl flex-shrink-0 mt-0.5">
                <ShieldCheck size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Privacy & Safety</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed mt-1.5 font-semibold">
                  This contact data is encrypted and only visible to your assigned team members.
                </p>
              </div>
            </div>

            {/* Automated Sequence switch */}
            <div className="bg-[#0c101b] border border-slate-900 rounded-3xl p-5 flex flex-col justify-between">
              <div>
                <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Automated Workflow</h4>
                <p className="text-xs text-white mt-1.5 font-bold leading-normal">Schedule welcome sequence upon saving?</p>
              </div>

              {/* Yes/No switch buttons */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-900 p-1 rounded-xl self-start mt-4">
                <button 
                  type="button"
                  onClick={() => setWorkflowSequence(true)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    workflowSequence 
                      ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/20' 
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  Yes
                </button>
                <button 
                  type="button"
                  onClick={() => setWorkflowSequence(false)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    !workflowSequence 
                      ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-500/20' 
                      : 'text-slate-500 hover:text-slate-300 border border-transparent'
                  }`}
                >
                  No
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
