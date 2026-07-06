import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../api/services';

const PLATFORM_META = {
  facebook_messenger: { badge: 'f',  bg: '#1877F2', label: 'Facebook', desc: 'Manage page posts and messenger leads.' },
  instagram:          { badge: '▣', bg: '#C13584', label: 'Instagram',           desc: 'Sync visual content and DMs.' },
  whatsapp:           { badge: '✆', bg: '#25D366', label: 'WhatsApp',            desc: 'Customer service & automated replies.' },
  linkedin:           { badge: 'in', bg: '#0A66C2', label: 'LinkedIn',            desc: 'B2B outreach and company updates.' },
  twitter_x:          { badge: '𝕏',  bg: '#000000', label: 'X (Twitter)',         desc: 'Real-time engagement and support.' },
  youtube:            { badge: '▶', bg: '#FF0000', label: 'YouTube',             desc: 'Manage comments and video metrics.' },
  tiktok:             { badge: '♪', bg: '#010101', label: 'TikTok',             desc: 'Short-form video engagement.' },
  pinterest:          { badge: 'P',  bg: '#E60023', label: 'Pinterest',           desc: 'Visual discovery and traffic driving.' },
  telegram:           { badge: '✈', bg: '#229ED9', label: 'Telegram',            desc: 'Broadcast news and direct support.' },
  snapchat:           { badge: '👻', bg: '#FFFC00', label: 'Snapchat',            desc: 'Short-form content and analytics.', badgeColor: '#000' },
  google_business:    { badge: 'G',  bg: '#4285F4', label: 'Google Business',     desc: 'Manage reviews and business profile.' },
  threads:            { badge: '@',  bg: '#101010', label: 'Threads',             desc: 'Publish posts and manage replies.' },
};

const INPUT = 'w-full px-4 py-3 bg-[#0C0E12] border border-[#1E2530] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-[15px] placeholder:text-[#70829B]';

// ── WhatsApp Modal ─────────────────────────────────────────────────────────────
function WhatsAppModal({ onClose, onSuccess }) {
  const [phone, setPhone] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('http://localhost:3001');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function connect() {
    if (!phone.trim()) { setError('Please enter a valid phone number.'); return; }
    setError(''); setLoading(true);
    try {
      await smartflowApi.connectWhatsAppManual({
        phone_number: phone.trim(),
        whatsapp_gateway_url: gatewayUrl.trim() || 'http://localhost:3001',
      });
      onSuccess('WhatsApp linked successfully!');
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to link WhatsApp.');
    } finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
      <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}}
        className="bg-[#111318] border border-[#1E2530] rounded-[20px] p-[22px] w-full max-w-sm space-y-3.5">
        <h3 className="font-bold text-[#F3F9FF] text-xl">Connect WhatsApp</h3>
        
        {error && <div className="text-rose-400 text-sm">{error}</div>}
        
        <div>
          <label className="text-[#9BA7BB] text-[13px] font-semibold mb-1 block">WhatsApp Number</label>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="e.g. 8801700000000" className={INPUT}/>
        </div>
        <div>
          <label className="text-[#9BA7BB] text-[13px] font-semibold mb-1 block">Gateway URL</label>
          <input value={gatewayUrl} onChange={e=>setGatewayUrl(e.target.value)} className={INPUT}/>
        </div>
        
        <div className="flex gap-2.5 pt-1.5">
          <button onClick={onClose} className="flex-1 h-[50px] bg-[#1E2530] text-[#F8FAFC] rounded-xl font-semibold hover:bg-slate-800 transition-colors cursor-pointer text-[15px]">
            Cancel
          </button>
          <button onClick={connect} disabled={loading} className="flex-1 h-[50px] bg-[#16CDE9] text-[#03141E] rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#12b0c9] transition-colors cursor-pointer disabled:opacity-60 text-[15px]">
            {loading ? <Loader2 size={16} className="animate-spin"/> : null}
            Connect
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Platform Card ─────────────────────────────────────────────────────────────
function PlatformCard({ item, onConnect, onDisconnect }) {
  const meta = PLATFORM_META[item.platform] || { badge: '?', bg: '#455A64', label: item.platform_label || item.platform, desc: 'Connect external channels.' };
  const isUnavailable = !item.is_available && item.cta_label === "Unavailable";
  const badgeTextColor = meta.badgeColor || '#fff';

  async function handleDisconnect() {
    if (!confirm(`Disconnect ${meta.label}?`)) return;
    try { await onDisconnect(item.platform); } catch {}
  }

  return (
    <div className={`bg-[#111318] border border-[#1E2530] rounded-2xl px-3.5 py-3.5 flex flex-row items-center gap-3 ${isUnavailable ? 'opacity-50' : ''}`}>
      <div className="w-[52px] h-[52px] rounded-xl flex items-center justify-center text-xl font-black shrink-0 border-[1.5px]"
        style={{backgroundColor: meta.bg, borderColor: '#333', color: badgeTextColor}}>
        {meta.badge}
      </div>
      
      <div className="flex-1 flex flex-col justify-center">
        <h3 className="font-bold text-[#F0F6FF] text-[16px] truncate">{meta.label}</h3>
        <p className="text-[13px] text-[#6B7A90] leading-[18px] line-clamp-2">{meta.desc}</p>
      </div>

      {item.connected ? (
        <button onClick={handleDisconnect}
          className="flex items-center gap-1.5 bg-[#0D2318] border border-[#1a4a2e] px-3 py-2 rounded-full cursor-pointer hover:bg-emerald-950 transition-colors shrink-0">
          <CheckCircle2 size={16} className="text-[#4DCE63]"/>
          <span className="text-[#4DCE63] text-[13px] font-semibold">Connected</span>
        </button>
      ) : (
        <button onClick={() => !isUnavailable && onConnect(item)}
          disabled={isUnavailable}
          className={`px-4 py-2 rounded-full min-w-[80px] flex items-center justify-center cursor-pointer transition-colors shrink-0 ${isUnavailable ? 'bg-[#1E2530] text-[#03141E]' : 'bg-[#16CDE9] text-[#03141E] hover:bg-[#12b0c9]'}`}>
          <span className="text-[14px] font-bold">{isUnavailable ? 'Soon' : 'Connect'}</span>
        </button>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Integrations() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [whatsappModal, setWhatsappModal] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const res = await smartflowApi.getIntegrationCatalog();
      setItems(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load platforms.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleConnect(item) {
    if (item.platform === 'whatsapp') { setWhatsappModal(true); return; }
    if (item.auth_mode === 'manual') {
      alert(`To connect ${item.platform_label}, please log into the Web Dashboard and enter the credentials.`);
      return;
    }
    if (item.platform === 'instagram') {
      if (!confirm("Instagram Business accounts are managed through Meta. You'll be redirected to Facebook to authorize access to your connected Instagram account.")) return;
    }
    try {
      const res = await smartflowApi.startIntegrationOAuth(item.platform);
      const url = res.data?.data?.auth_url || res.data?.auth_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      else alert('Did not receive authorization URL from server.');
    } catch (err) { alert(err.response?.data?.message || 'Failed to initiate connection.'); }
  }

  async function handleDisconnect(platform) {
    try { await smartflowApi.disconnectIntegration(platform); await fetchAll(); }
    catch (err) { alert(err.response?.data?.message || 'Failed to disconnect.'); }
  }

  return (
    <div className="flex flex-col h-full bg-[#020406] max-w-3xl mx-auto w-full">
      {/* Header matching mobile styling */}
      <div className="flex items-center justify-between py-2 mb-3">
        <button onClick={() => window.history.back()} className="w-9 h-9 flex items-center justify-center cursor-pointer hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft size={28} className="text-[#F1F7FF]"/>
        </button>
        <h1 className="text-[#F3F9FF] text-[20px] font-bold text-center flex-1">Connect Social Media</h1>
        <div className="w-9 h-9" />
      </div>

      <div className="flex-1 pb-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3.5">
            <Loader2 size={32} className="text-[#16CDE9] animate-spin" />
            <p className="text-[#9BA7BB] text-[15px]">Loading platforms...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3.5">
            <AlertCircle size={40} className="text-[#FF6B6B]" />
            <p className="text-[#9BA7BB] text-[15px]">Failed to load platforms.</p>
            <button onClick={fetchAll} className="px-6 py-2.5 rounded-xl bg-[#16CDE9] text-[#03141E] text-[15px] font-semibold hover:bg-[#12b0c9]">
              Retry
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {items.map(item => (
              <PlatformCard 
                key={item.platform} 
                item={item} 
                onConnect={handleConnect} 
                onDisconnect={handleDisconnect} 
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {whatsappModal && <WhatsAppModal onClose={()=>setWhatsappModal(false)} onSuccess={(msg)=>{ alert(msg); fetchAll();}}/>}
      </AnimatePresence>
    </div>
  );
}
