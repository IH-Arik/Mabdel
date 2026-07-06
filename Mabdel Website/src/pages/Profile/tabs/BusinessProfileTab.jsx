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


export default BusinessProfileTab;
