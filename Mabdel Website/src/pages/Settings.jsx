import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, Building2, Camera, CheckCircle2, ChevronDown, ChevronUp, 
  CreditCard, Cpu, Globe, Key, LifeBuoy, Loader2, LogOut, Mail, Mic, 
  Phone, Play, Save, Shield, Trash2, TrendingUp, Upload, User, Lock,
  ArrowUpRight, Wallet, Clock, DollarSign, Bell, Eye, EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../api/services';
import { useAuthStore } from '../store/useAuthStore';

const tabs = [
  { id: 'profile',        label: 'Profile',          icon: User },
  { id: 'business',       label: 'Business Profile',  icon: Building2 },
  { id: 'notifications',  label: 'Notifications',    icon: Bell },
  { id: 'billing',        label: 'Billing',           icon: CreditCard },
  { id: 'voice',          label: 'Voice History',     icon: Mic },
  { id: 'earnings',       label: 'My Earnings',       icon: TrendingUp },
  { id: 'support',        label: 'Support',           icon: LifeBuoy },
  { id: 'ai',             label: 'AI Config',         icon: Cpu },
  { id: 'security',       label: 'Security',          icon: Shield },
];

const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';
const LABEL = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';

function Field({ label, children }) { return <div><label className={LABEL}>{label}</label>{children}</div>; }

function Badge({ children, color='cyan' }) {
  const p = { cyan:'bg-[#11C7E5]/10 text-[#11C7E5] border-[#11C7E5]/20', green:'bg-emerald-950/30 text-emerald-400 border-emerald-500/20', yellow:'bg-amber-950/30 text-amber-400 border-amber-500/20', red:'bg-rose-950/30 text-rose-400 border-rose-500/20' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${p[color]}`}>{children}</span>;
}

function StatCard({ label, value, sub, icon: Icon, accent='#11C7E5' }) {
  return (
    <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:`${accent}18`}}>
        <Icon size={20} style={{color:accent}}/>
      </div>
      <div>
        <p className="text-[#A4B0B7] text-xs">{label}</p>
        <p className="text-2xl font-black text-white mt-0.5">{value}</p>
        {sub && <p className="text-[#A4B0B7] text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({ full_name: user?.full_name || '', email: user?.email || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef ? null : null;

  async function save() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await smartflowApi.updateSettings({ full_name: form.full_name, phone: form.phone });
      setSuccess('Profile saved!');
      if (res.data?.data) setUser?.(res.data.data);
    } catch(err) { setError(err.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    const fd = new FormData(); fd.append('avatar', file);
    try {
      const res = await smartflowApi.uploadAvatar(fd);
      setSuccess('Avatar updated!');
      if (res.data?.data) setUser?.(res.data.data);
    } catch(err) { setError(err.response?.data?.message || 'Avatar upload failed.'); }
    finally { setUploading(false); }
  }

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2"><AlertTriangle size={14}/>{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex gap-2"><CheckCircle2 size={14}/>{success}</div>}

      {/* Avatar */}
      <div className="flex items-center gap-5">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-[#11C7E5]/10 border-2 border-[#11C7E5]/20 flex items-center justify-center text-3xl font-black text-[#11C7E5]">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="avatar" className="w-full h-full rounded-2xl object-cover"/>
              : (user?.full_name?.[0]?.toUpperCase() || 'U')
            }
          </div>
          {uploading && <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center"><Loader2 size={20} className="animate-spin text-white"/></div>}
        </div>
        <div>
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-white hover:border-[#11C7E5]/40 rounded-xl text-sm font-semibold transition-all">
            <Camera size={15}/> Upload Photo
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload}/>
          </label>
          <p className="text-[#A4B0B7] text-xs mt-1.5">JPG, PNG up to 5MB</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Full Name"><input value={form.full_name} onChange={e=>setForm(f=>({...f,full_name:e.target.value}))} className={INPUT} placeholder="Your Name"/></Field>
        <Field label="Email Address"><input value={form.email} disabled className={`${INPUT} opacity-50 cursor-not-allowed`} placeholder="email@example.com"/></Field>
        <Field label="Phone Number"><input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} className={INPUT} placeholder="+1 234 567 890"/></Field>
      </div>

      <button onClick={save} disabled={saving}
        className="px-6 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
        {saving ? 'Saving…' : 'Save Profile'}
      </button>
    </div>
  );
}

// ── Business Profile Tab ──────────────────────────────────────────────────────
function BusinessProfileTab() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    smartflowApi.getBusinessProfile()
      .then(r => setData(r.data?.data || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const set = (k,v) => setData(d => ({...d,[k]:v}));

  async function save() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await smartflowApi.updateBusinessProfile({
        business_name: data.business_name, industry: data.industry,
        description: data.description, website: data.website,
        phone: data.phone, email: data.email, address: data.address,
      });
      setData(res.data?.data || data);
      setSuccess('Business profile saved!');
    } catch(err) { setError(err.response?.data?.message || 'Save failed.'); }
    finally { setSaving(false); }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]; if(!file) return;
    setUploading(true); setError('');
    const fd = new FormData(); fd.append('logo', file);
    try {
      const res = await smartflowApi.uploadBusinessLogo(fd);
      setData(res.data?.data || data);
      setSuccess('Logo updated!');
    } catch(err) { setError(err.response?.data?.message || 'Logo upload failed.'); }
    finally { setUploading(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#11C7E5]"/></div>;

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2"><AlertTriangle size={14}/>{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex gap-2"><CheckCircle2 size={14}/>{success}</div>}

      {/* Logo */}
      <div className="flex items-center gap-5">
        <div className="relative w-20 h-20 rounded-2xl bg-[#11C7E5]/10 border-2 border-[#11C7E5]/20 flex items-center justify-center overflow-hidden">
          {data.logo_url ? <img src={data.logo_url} alt="logo" className="w-full h-full object-cover"/> : <Building2 size={32} className="text-[#11C7E5]/40"/>}
          {uploading && <div className="absolute inset-0 bg-black/50 flex items-center justify-center"><Loader2 size={18} className="animate-spin text-white"/></div>}
        </div>
        <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-white hover:border-[#11C7E5]/40 rounded-xl text-sm font-semibold transition-all">
          <Upload size={15}/> Upload Logo
          <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Business Name"><input value={data.business_name||''} onChange={e=>set('business_name',e.target.value)} className={INPUT} placeholder="Acme Corp"/></Field>
        <Field label="Industry"><input value={data.industry||''} onChange={e=>set('industry',e.target.value)} className={INPUT} placeholder="Technology, Real Estate…"/></Field>
        <Field label="Business Email"><input value={data.email||''} onChange={e=>set('email',e.target.value)} className={INPUT} placeholder="business@example.com"/></Field>
        <Field label="Business Phone"><input value={data.phone||''} onChange={e=>set('phone',e.target.value)} className={INPUT} placeholder="+1 234 567 890"/></Field>
        <Field label="Website"><input value={data.website||''} onChange={e=>set('website',e.target.value)} className={INPUT} placeholder="https://yoursite.com"/></Field>
        <Field label="Address"><input value={data.address||''} onChange={e=>set('address',e.target.value)} className={INPUT} placeholder="123 Business St, City"/></Field>
      </div>
      <Field label="Description">
        <textarea value={data.description||''} onChange={e=>set('description',e.target.value)} className={`${INPUT} min-h-24 resize-none`} placeholder="What does your business do?"/>
      </Field>

      <button onClick={save} disabled={saving}
        className="px-6 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
        {saving ? 'Saving…' : 'Save Business Profile'}
      </button>
    </div>
  );
}

// ── Voice History Tab ─────────────────────────────────────────────────────────
function VoiceHistoryTab() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    smartflowApi.getVoiceHistory()
      .then(r => setHistory(r.data?.data || r.data || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleReplay(id) {
    setReplaying(id);
    try { await smartflowApi.replayVoiceHistory(id); } catch (_) {}
    setTimeout(() => setReplaying(null), 2000);
  }

  if (loading) return <div className="flex items-center justify-center h-48 text-[#A4B0B7] animate-pulse">Loading voice history…</div>;
  if (!history.length) return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center"><Mic size={28} className="text-[#11C7E5]/60"/></div>
      <div><p className="font-bold text-white">No voice history yet</p><p className="text-[#A4B0B7] text-sm">Use the AI voice assistant to get started.</p></div>
    </div>
  );

  return (
    <div className="space-y-3">
      {history.map((item, i) => (
        <div key={item.id||i} className="bg-[#0A1019] border border-[#243041] rounded-2xl">
          <div className="p-4 flex items-center justify-between cursor-pointer" onClick={()=>setExpanded(expanded===i?null:i)}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#11C7E5]/10 flex items-center justify-center"><Mic size={16} className="text-[#11C7E5]"/></div>
              <div>
                <p className="font-semibold text-white text-sm">{item.intent || item.workflow_intent || 'Voice Command'}</p>
                <p className="text-[#A4B0B7] text-xs">{item.created_at ? new Date(item.created_at).toLocaleString() : 'Recent'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={e=>{e.stopPropagation();handleReplay(item.id);}} disabled={replaying===item.id}
                className="p-2 text-[#11C7E5] hover:bg-[#11C7E5]/10 rounded-lg transition-all cursor-pointer">
                {replaying===item.id ? <Loader2 size={14} className="animate-spin"/> : <Play size={14}/>}
              </button>
              {expanded===i ? <ChevronUp size={15} className="text-[#A4B0B7]"/> : <ChevronDown size={15} className="text-[#A4B0B7]"/>}
            </div>
          </div>
          <AnimatePresence initial={false}>
            {expanded===i && (
              <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                <div className="px-4 pb-4 border-t border-[#243041]/40 pt-3 text-sm text-[#A4B0B7]">
                  {item.transcript && <p className="italic">"{item.transcript}"</p>}
                  {item.response && <p className="mt-2">Response: {item.response}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

// ── Earnings Tab ──────────────────────────────────────────────────────────────
function EarningsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    smartflowApi.getUserEarnings()
      .then(r => setData(r.data?.data || null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  async function withdraw() {
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return; }
    setWithdrawing(true); setError(''); setSuccess('');
    try {
      await smartflowApi.requestWithdrawal({ amount: Number(amount) });
      setSuccess('Withdrawal request submitted!');
      setAmount('');
    } catch(err) { setError(err.response?.data?.message || 'Withdrawal failed.'); }
    finally { setWithdrawing(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#11C7E5]"/></div>;

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2"><AlertTriangle size={14}/>{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex gap-2"><CheckCircle2 size={14}/>{success}</div>}
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Earned" value={`$${data?.total_earned || '0.00'}`} icon={DollarSign} accent="#10B981"/>
        <StatCard label="Available Balance" value={`$${data?.available_balance || '0.00'}`} icon={Wallet} accent="#11C7E5"/>
        <StatCard label="Total Withdrawn" value={`$${data?.total_withdrawn || '0.00'}`} icon={ArrowUpRight} accent="#8B5CF6"/>
      </div>

      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white">Request Withdrawal</h3>
        <div className="flex gap-3">
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount (USD)"
            className={`${INPUT} flex-1`}/>
          <button onClick={withdraw} disabled={withdrawing}
            className="px-5 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60">
            {withdrawing ? <Loader2 size={16} className="animate-spin"/> : <Wallet size={16}/>}
            Withdraw
          </button>
        </div>
        {data?.recent_transactions?.length > 0 && (
          <div className="space-y-2">
            <p className="text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider">Recent Transactions</p>
            {data.recent_transactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#131A24] border border-[#243041] rounded-xl">
                <div><p className="text-white text-sm font-semibold">{tx.description || 'Transaction'}</p><p className="text-[#A4B0B7] text-xs">{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : ''}</p></div>
                <span className={`font-bold text-sm ${tx.type==='credit'?'text-emerald-400':'text-rose-400'}`}>{tx.type==='credit'?'+':'-'}${tx.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────
function NotificationsTab() {
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    smartflowApi.getNotificationSettings()
      .then(r => setPrefs(r.data?.data || {}))
      .catch(() => setPrefs({}))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (k) => setPrefs(p => ({...p,[k]:!p[k]}));

  async function save() {
    setSaving(true);
    try { await smartflowApi.updateNotificationSettings(prefs); setSuccess('Saved!'); setTimeout(()=>setSuccess(''),2000); }
    catch {}
    finally { setSaving(false); }
  }

  const items = [
    { key:'push_notifications', label:'Push Notifications', icon:Bell },
    { key:'email_notifications', label:'Email Notifications', icon:Mail },
    { key:'sms_notifications', label:'SMS Notifications', icon:Phone },
    { key:'call_alerts', label:'Call Alerts', icon:Phone },
    { key:'message_alerts', label:'Message Alerts', icon:Bell },
  ];

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#11C7E5]"/></div>;

  return (
    <div className="space-y-4">
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex gap-2"><CheckCircle2 size={14}/>{success}</div>}
      {items.map(item => (
        <div key={item.key} className="flex items-center justify-between p-4 bg-[#0A1019] border border-[#243041] rounded-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#11C7E5]/10 flex items-center justify-center"><item.icon size={16} className="text-[#11C7E5]"/></div>
            <span className="text-white font-semibold text-sm">{item.label}</span>
          </div>
          <button onClick={()=>toggle(item.key)}
            className={`relative w-12 h-6 rounded-full transition-colors ${prefs[item.key] ? 'bg-[#11C7E5]' : 'bg-[#243041]'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${prefs[item.key] ? 'translate-x-6' : 'translate-x-0.5'}`}/>
          </button>
        </div>
      ))}
      <button onClick={save} disabled={saving}
        className="px-6 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60">
        {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>}
        Save Preferences
      </button>
    </div>
  );
}

// ── Billing Tab ───────────────────────────────────────────────────────────────
function BillingTab() {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      smartflowApi.getSubscriptionPlans().catch(()=>({data:{data:[]}})),
      smartflowApi.getCurrentSubscription().catch(()=>({data:{data:null}})),
    ]).then(([p,c]) => {
      setPlans(p.data?.data || []);
      setCurrent(c.data?.data || null);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-[#11C7E5]"/></div>;

  return (
    <div className="space-y-6">
      {current && (
        <div className="bg-[#0A1019] border border-[#11C7E5]/20 rounded-2xl p-5">
          <p className="text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1">Current Plan</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-black text-white">{current.plan_name || 'Free'}</p>
              <p className="text-[#A4B0B7] text-sm">{current.status === 'active' ? 'Active' : current.status}</p>
            </div>
            <Badge color={current.status==='active'?'green':'yellow'}>{current.status || 'free'}</Badge>
          </div>
        </div>
      )}
      {plans.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className={`bg-[#0A1019] border rounded-2xl p-5 ${plan.is_popular ? 'border-[#11C7E5]/30' : 'border-[#243041]'}`}>
              {plan.is_popular && <Badge>Popular</Badge>}
              <h3 className="font-bold text-white text-lg mt-2">{plan.name}</h3>
              <p className="text-3xl font-black text-[#11C7E5] mt-1">${plan.price}<span className="text-sm text-[#A4B0B7]">/{plan.period||'mo'}</span></p>
              <ul className="mt-3 space-y-1.5">
                {(plan.features||[]).map((f,i) => <li key={i} className="text-[#A4B0B7] text-xs flex items-center gap-1.5"><CheckCircle2 size={12} className="text-[#11C7E5]"/>{f}</li>)}
              </ul>
              <button className="mt-4 w-full py-2.5 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold text-sm hover:bg-[#0fd0f0] transition-colors cursor-pointer">
                {current?.plan_id===plan.id ? 'Current Plan' : 'Upgrade'}
              </button>
            </div>
          ))}
        </div>
      )}
      {!plans.length && (
        <div className="p-12 text-center text-[#A4B0B7]">No subscription plans available at the moment.</div>
      )}
    </div>
  );
}

// ── Support Tab ───────────────────────────────────────────────────────────────
function SupportTab() {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      smartflowApi.getSupportSession().catch(()=>({data:{data:null}})),
      smartflowApi.getSupportMessages().catch(()=>({data:{data:[]}})),
    ]).then(([_, m]) => setMessages(m.data?.data || []))
    .finally(() => setLoading(false));
  }, []);

  async function send() {
    if (!newMsg.trim()) return;
    setSending(true);
    try {
      await smartflowApi.sendSupportMessage({ content: newMsg.trim() });
      setMessages(m => [...m, { id: Date.now(), content: newMsg, role: 'user', created_at: new Date().toISOString() }]);
      setNewMsg('');
    } catch {}
    finally { setSending(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-[#A4B0B7] text-sm">Chat with our support team directly.</p>
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl min-h-64 max-h-80 overflow-y-auto p-4 space-y-3">
        {loading ? <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-[#11C7E5]"/></div>
          : messages.length === 0 ? <p className="text-center text-[#A4B0B7] text-sm py-8">No messages yet. Send a message to start!</p>
          : messages.map(m => (
            <div key={m.id} className={`flex ${m.role==='user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs px-4 py-2.5 rounded-2xl text-sm ${m.role==='user' ? 'bg-[#11C7E5] text-[#02080B]' : 'bg-[#131A24] border border-[#243041] text-white'}`}>
                {m.content}
              </div>
            </div>
          ))
        }
      </div>
      <div className="flex gap-3">
        <input value={newMsg} onChange={e=>setNewMsg(e.target.value)}
          onKeyDown={e=>e.key==='Enter'&&send()}
          placeholder="Type your message…" className={`${INPUT} flex-1`}/>
        <button onClick={send} disabled={sending||!newMsg.trim()}
          className="px-5 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold transition-colors cursor-pointer disabled:opacity-60">
          {sending ? <Loader2 size={16} className="animate-spin"/> : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ── AI Config Tab ─────────────────────────────────────────────────────────────
function AIConfigTab() {
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    smartflowApi.getAIVoices()
      .then(r => setVoices(r.data?.data || []))
      .catch(() => setVoices([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Mic size={16} className="text-[#11C7E5]"/>Available AI Voices</h3>
        {loading ? <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#11C7E5]"/></div>
          : voices.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {voices.map(v => (
                <div key={v.id||v.voice_id||v.name} className="p-3 bg-[#131A24] border border-[#243041] rounded-xl">
                  <p className="text-white font-semibold text-sm">{v.name||v.voice_name}</p>
                  {v.language && <p className="text-[#A4B0B7] text-xs mt-0.5">{v.language}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-[#A4B0B7] text-sm">No voices configured.</p>
        }
      </div>
    </div>
  );
}

// ── Security Tab ─────────────────────────────────────────────────────────────
function SecurityTab() {
  const { logout } = useAuthStore();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changing, setChanging] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function changePassword() {
    setError(''); setSuccess('');
    if (!oldPw || !newPw || !confirmPw) { setError('All fields are required.'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setChanging(true);
    try {
      await smartflowApi.changePassword({ current_password: oldPw, new_password: newPw });
      setSuccess('Password changed successfully!');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch(err) { setError(err.response?.data?.message || 'Password change failed.'); }
    finally { setChanging(false); }
  }

  async function revokeSessions() {
    setRevoking(true);
    try { await smartflowApi.revokeSessions(); setSuccess('All sessions revoked. Please log in again.'); setTimeout(()=>logout(), 2000); }
    catch(err) { setError(err.response?.data?.message || 'Revoke failed.'); }
    finally { setRevoking(false); }
  }

  async function deleteAccount() {
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
    setDeleting(true);
    try { await smartflowApi.deleteAccount(); logout(); }
    catch(err) { setError(err.response?.data?.message || 'Delete account failed.'); setDeleting(false); }
  }

  const PwInput = ({ label, value, onChange, show, onToggle }) => (
    <Field label={label}>
      <div className="relative">
        <input type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} className={`${INPUT} pr-11`} placeholder="••••••••"/>
        <button type="button" onClick={onToggle} className="absolute right-3 top-3.5 text-[#A4B0B7] hover:text-white">
          {show ? <EyeOff size={16}/> : <Eye size={16}/>}
        </button>
      </div>
    </Field>
  );

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2"><AlertTriangle size={14}/>{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex gap-2"><CheckCircle2 size={14}/>{success}</div>}

      {/* Change Password */}
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Key size={16} className="text-[#11C7E5]"/>Change Password</h3>
        <PwInput label="Current Password" value={oldPw} onChange={setOldPw} show={showOld} onToggle={()=>setShowOld(s=>!s)}/>
        <PwInput label="New Password" value={newPw} onChange={setNewPw} show={showNew} onToggle={()=>setShowNew(s=>!s)}/>
        <Field label="Confirm New Password">
          <input type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} className={INPUT} placeholder="••••••••"/>
        </Field>
        <button onClick={changePassword} disabled={changing}
          className="px-6 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60">
          {changing ? <Loader2 size={16} className="animate-spin"/> : <Lock size={16}/>}
          {changing ? 'Changing…' : 'Change Password'}
        </button>
      </div>

      {/* Session Management */}
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Shield size={16} className="text-[#11C7E5]"/>Session Management</h3>
        <p className="text-[#A4B0B7] text-sm">Revoke all active sessions and force re-authentication on all devices.</p>
        <button onClick={revokeSessions} disabled={revoking}
          className="px-6 py-3 bg-amber-900/20 border border-amber-500/30 text-amber-400 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-900/30 transition-colors cursor-pointer disabled:opacity-60">
          {revoking ? <Loader2 size={16} className="animate-spin"/> : <LogOut size={16}/>}
          {revoking ? 'Revoking…' : 'Revoke All Sessions'}
        </button>
      </div>

      {/* Delete Account */}
      <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-rose-300 flex items-center gap-2"><AlertTriangle size={16}/>Danger Zone</h3>
        <p className="text-[#A4B0B7] text-sm">Once you delete your account, all data will be permanently removed. This action cannot be undone.</p>
        <button onClick={deleteAccount} disabled={deleting}
          className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60">
          {deleting ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}
          {deleting ? 'Deleting…' : 'Delete My Account'}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Settings() {
  const [active, setActive] = useState('profile');

  const components = {
    profile: ProfileTab,
    business: BusinessProfileTab,
    notifications: NotificationsTab,
    billing: BillingTab,
    voice: VoiceHistoryTab,
    earnings: EarningsTab,
    support: SupportTab,
    ai: AIConfigTab,
    security: SecurityTab,
  };

  const ActiveComponent = components[active] || ProfileTab;

  return (
    <div className="space-y-6">
      <div className="border-b border-[#243041]/40 pb-4 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Settings</h1>
        <p className="text-[#A4B0B7] text-xs mt-1">Manage your profile, business, security, and integrations.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 shrink-0">
          <nav className="bg-[#131A24] border border-[#243041] rounded-2xl p-2 space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={()=>setActive(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left ${active===tab.id ? 'bg-[#11C7E5]/10 text-white border border-[#11C7E5]/20' : 'text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border border-transparent'}`}>
                  <Icon size={15} className={active===tab.id ? 'text-[#11C7E5]' : ''}/>
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-6 text-left">
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.15}}>
                <ActiveComponent/>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
