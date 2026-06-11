import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, CheckCircle, ExternalLink, Link2, Loader2,
  RefreshCw, ShieldCheck, Unplug, Wifi, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../api/services';

const PLATFORM_META = {
  facebook_messenger: { badge: 'f',  bg: '#1877F2', label: 'Facebook Messenger', desc: 'Manage page posts and messenger leads.' },
  instagram:          { badge: 'IG', bg: '#E4405F', label: 'Instagram',           desc: 'Sync visual content and DMs.' },
  whatsapp:           { badge: 'WA', bg: '#25D366', label: 'WhatsApp',            desc: 'Customer service & automated replies.' },
  linkedin:           { badge: 'in', bg: '#0A66C2', label: 'LinkedIn',            desc: 'B2B outreach and company updates.' },
  twitter_x:          { badge: 'X',  bg: '#111111', label: 'Twitter / X',         desc: 'Real-time engagement and support.' },
  youtube:            { badge: 'YT', bg: '#FF0000', label: 'YouTube',             desc: 'Manage comments and video metrics.' },
  tiktok:             { badge: 'TT', bg: '#2d2d2d', label: 'TikTok',             desc: 'Short-form video engagement.' },
  pinterest:          { badge: 'P',  bg: '#E60023', label: 'Pinterest',           desc: 'Visual discovery and traffic.' },
  telegram:           { badge: 'TG', bg: '#229ED9', label: 'Telegram',            desc: 'Broadcast news and direct support.' },
  snapchat:           { badge: 'SC', bg: '#FFFC00', label: 'Snapchat',            desc: 'Short-form content and analytics.' },
  google_business:    { badge: 'G',  bg: '#4285F4', label: 'Google Business',     desc: 'Manage reviews and business profile.' },
};

const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';

// ── WhatsApp Modal ─────────────────────────────────────────────────────────────
function WhatsAppModal({ onClose, onSuccess }) {
  const [phone, setPhone] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:3001');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function connect() {
    if (!phone.trim()) { setError('Please enter a phone number.'); return; }
    setError(''); setLoading(true);
    try {
      await smartflowApi.connectWhatsAppManual({
        phone_number: phone.trim(),
        whatsapp_gateway_url: gatewayUrl.trim() || 'http://localhost:3001',
      });
      onSuccess('WhatsApp linked! Scan the QR code on your gateway to log in.');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'WhatsApp connection failed.');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
        className="bg-[#131A24] border border-[#243041] rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#25D366] flex items-center justify-center text-white text-xs font-black">WA</span>
            Connect WhatsApp
          </h3>
          <button onClick={onClose} className="text-[#A4B0B7] hover:text-white cursor-pointer"><X size={18}/></button>
        </div>
        {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">{error}</div>}
        <div className="space-y-3">
          <div><label className="text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5 block">WhatsApp Number</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 8801700000000" className={INPUT}/>
          </div>
          <div><label className="text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5 block">Gateway URL</label>
            <input value={gatewayUrl} onChange={e=>setGatewayUrl(e.target.value)} className={INPUT}/>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl font-bold hover:text-white transition-colors cursor-pointer">
            Cancel
          </button>
          <button onClick={connect} disabled={loading} className="flex-1 py-3 bg-[#25D366] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#20c05c] transition-colors cursor-pointer disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin"/> : null}
            Connect
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Telegram Modal ─────────────────────────────────────────────────────────────
function TelegramModal({ onClose, onSuccess }) {
  const [botToken, setBotToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function connect() {
    if (!botToken.trim()) { setError('Bot token is required.'); return; }
    setError(''); setLoading(true);
    try {
      await smartflowApi.connectTelegramManual({ bot_token: botToken.trim() });
      onSuccess('Telegram bot connected successfully!');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Telegram connection failed.');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
        className="bg-[#131A24] border border-[#243041] rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-[#229ED9] flex items-center justify-center text-white text-xs font-black">TG</span>
            Connect Telegram
          </h3>
          <button onClick={onClose} className="text-[#A4B0B7] hover:text-white cursor-pointer"><X size={18}/></button>
        </div>
        {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">{error}</div>}
        <div>
          <label className="text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5 block">Bot Token</label>
          <input value={botToken} onChange={e=>setBotToken(e.target.value)} placeholder="123456:ABC-DEF..." className={INPUT}/>
          <p className="text-[#A4B0B7] text-xs mt-1.5">Get your bot token from @BotFather on Telegram.</p>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl font-bold hover:text-white transition-colors cursor-pointer">Cancel</button>
          <button onClick={connect} disabled={loading} className="flex-1 py-3 bg-[#229ED9] text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#1e8fc0] transition-colors cursor-pointer disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin"/> : null}
            Connect
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Platform Card ─────────────────────────────────────────────────────────────
function PlatformCard({ item, onConnect, onDisconnect, onSync }) {
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const meta = PLATFORM_META[item.platform] || { badge: '?', bg: '#455A64', label: item.platform_label || item.platform, desc: 'External platform integration.' };

  async function handleSync() {
    setSyncing(true);
    try { await onSync(item.platform); } catch {}
    setSyncing(false);
  }

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${meta.label}?`)) return;
    setDisconnecting(true);
    try { await onDisconnect(item.platform); } catch {}
    setDisconnecting(false);
  }

  const badgeTextColor = meta.bg === '#FFFC00' ? '#111' : '#fff';

  return (
    <div className={`bg-[#131A24] border rounded-[22px] p-5 flex flex-col gap-4 transition-all ${item.connected ? 'border-[#11C7E5]/20' : 'border-[#243041]'} ${!item.is_available && 'opacity-60'}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black shrink-0"
            style={{background:meta.bg, color:badgeTextColor}}>
            {meta.badge}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm">{meta.label}</h3>
            <p className="text-xs text-[#A4B0B7] mt-0.5 leading-relaxed">{meta.desc}</p>
          </div>
        </div>
        {item.connected && (
          <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-full shrink-0">
            <CheckCircle size={10}/> Connected
          </span>
        )}
      </div>

      <div className="mt-auto flex gap-2">
        {!item.connected ? (
          <button onClick={() => onConnect(item)}
            disabled={!item.is_available}
            className="flex-1 px-3 py-2.5 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-xs disabled:opacity-50 disabled:cursor-not-allowed">
            <Link2 size={13}/> {item.cta_label || 'Connect'}
          </button>
        ) : (
          <button onClick={handleDisconnect} disabled={disconnecting}
            className="flex-1 px-3 py-2.5 bg-[#0A1019] border border-rose-950/30 text-rose-400 hover:bg-rose-950/30 rounded-xl font-bold flex items-center justify-center gap-2 transition-all cursor-pointer text-xs disabled:opacity-60">
            {disconnecting ? <Loader2 size={13} className="animate-spin"/> : <Unplug size={13}/>}
            Disconnect
          </button>
        )}
        <button onClick={handleSync} disabled={syncing}
          className="px-3 py-2.5 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:border-slate-700 hover:text-white rounded-xl transition-all cursor-pointer disabled:opacity-60"
          title="Sync">
          {syncing ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}
        </button>
        {item.connected && (
          <button onClick={()=>window.open(`/integrations/${item.platform}/settings`,'_blank')}
            className="px-3 py-2.5 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:border-slate-700 hover:text-white rounded-xl transition-all cursor-pointer"
            title="View">
            <ExternalLink size={14}/>
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Integrations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [whatsappModal, setWhatsappModal] = useState(false);
  const [telegramModal, setTelegramModal] = useState(false);
  const [status, setStatus] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [cat, stat] = await Promise.all([
        smartflowApi.getIntegrationCatalog(),
        smartflowApi.getIntegrationStatus().catch(()=>({data:{data:null}})),
      ]);
      setItems(cat.data?.data || []);
      setStatus(stat.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load integrations.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleConnect(item) {
    setError('');
    if (item.platform === 'whatsapp') { setWhatsappModal(true); return; }
    if (item.platform === 'telegram') { setTelegramModal(true); return; }
    if (item.auth_mode === 'manual') {
      setError(`${item.platform_label} requires manual setup. Use the Dashboard to enter credentials.`);
      return;
    }
    try {
      const res = await smartflowApi.startIntegrationOAuth(item.platform);
      const url = res.data?.data?.auth_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else setError('Did not receive authorization URL from server.');
    } catch (err) { setError(err.response?.data?.message || 'OAuth initiation failed.'); }
  }

  async function handleDisconnect(platform) {
    try { await smartflowApi.disconnectIntegration(platform); await fetchAll(); setSuccess('Integration disconnected.'); setTimeout(()=>setSuccess(''), 3000); }
    catch (err) { setError(err.response?.data?.message || 'Disconnect failed.'); }
  }

  async function handleSync(platform) {
    try { await smartflowApi.syncIntegration(platform); setSuccess(`${platform} synced!`); setTimeout(()=>setSuccess(''), 2000); }
    catch (err) { setError(err.response?.data?.message || 'Sync failed.'); }
  }

  const connected = items.filter(i => i.connected);
  const disconnected = items.filter(i => !i.connected);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#243041]/40 pb-4">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Integrations</h1>
          <p className="text-[#A4B0B7] text-xs mt-1">Connect social media, messaging, and business channels to Mabdel AI.</p>
        </div>
        <div className="flex items-center gap-3">
          {connected.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-950/30 border border-emerald-500/20 rounded-xl">
              <Wifi size={14} className="text-emerald-400"/>
              <span className="text-emerald-400 text-xs font-bold">{connected.length} connected</span>
            </div>
          )}
          <button onClick={fetchAll} className="px-4 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl hover:text-white transition-colors cursor-pointer">
            <RefreshCw size={15}/>
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2"><AlertTriangle size={14}/>{error}<button onClick={()=>setError('')} className="ml-auto"><X size={14}/></button></div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex gap-2"><CheckCircle2 size={14}/>{success}</div>}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array(6).fill(0).map((_,i) => <div key={i} className="bg-[#131A24] border border-[#243041] rounded-[22px] h-48 animate-pulse"/>)}
        </div>
      ) : (
        <>
          {connected.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-[#A4B0B7] uppercase tracking-wider mb-3 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400"/>Connected ({connected.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {connected.map(item => <PlatformCard key={item.platform} item={item} onConnect={handleConnect} onDisconnect={handleDisconnect} onSync={handleSync}/>)}
              </div>
            </div>
          )}
          <div>
            {connected.length > 0 && <h2 className="text-sm font-bold text-[#A4B0B7] uppercase tracking-wider mb-3 mt-2">Available Platforms ({disconnected.length})</h2>}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {disconnected.map(item => <PlatformCard key={item.platform} item={item} onConnect={handleConnect} onDisconnect={handleDisconnect} onSync={handleSync}/>)}
            </div>
          </div>
        </>
      )}

      <div className="border border-[#11C7E5]/20 bg-gradient-to-br from-[#11C7E5]/10 to-transparent rounded-[22px] p-4 text-xs text-[#11C7E5] flex gap-2 items-center text-left">
        <ShieldCheck size={18} strokeWidth={2.3}/>
        OAuth providers require credentials configured in your backend `.env`. WhatsApp and Telegram support manual token-based connection.
      </div>

      {/* Modals */}
      <AnimatePresence>
        {whatsappModal && <WhatsAppModal onClose={()=>setWhatsappModal(false)} onSuccess={(msg)=>{setSuccess(msg); fetchAll();}}/>}
        {telegramModal && <TelegramModal onClose={()=>setTelegramModal(false)} onSuccess={(msg)=>{setSuccess(msg); fetchAll();}}/>}
      </AnimatePresence>
    </div>
  );
}
