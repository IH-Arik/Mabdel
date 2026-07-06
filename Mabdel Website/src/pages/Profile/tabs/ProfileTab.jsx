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

function ProfileTab() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({ full_name: user?.full_name || '', email: user?.email || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

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


export default ProfileTab;
