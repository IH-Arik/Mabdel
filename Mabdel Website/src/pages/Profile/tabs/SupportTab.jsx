import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, Camera, CheckCircle2, ChevronDown, ChevronUp, 
  CreditCard, Cpu, Globe, Key, LifeBuoy, Loader2, LogOut, Mail, Mic, 
  Phone, Play, Save, Shield, Trash2, TrendingUp, Upload, User, Lock,
  ArrowUpRight, Wallet, Clock, DollarSign, Bell, Eye, EyeOff, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../../../api/services';
import { useAuthStore } from '../../../store/useAuthStore';
import { INPUT, LABEL, Field, Badge, StatCard } from '../shared';

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


export default SupportTab;
