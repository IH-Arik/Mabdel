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


export default NotificationsTab;
