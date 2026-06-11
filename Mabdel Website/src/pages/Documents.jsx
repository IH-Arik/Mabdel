import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronUp,
  CircleAlert, Download, FileCheck2, FileText, House, Loader2, Mail, Mic, PenLine,
  Plus, RefreshCw, ScrollText, Sparkles, Trash2, Upload, Users, Wallet, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../api/services';

// ── Tab definition ─────────────────────────────────────────────────────────────
const tabs = [
  { id: 'documents',  label: 'Documents',   icon: FileText },
  { id: 'leases',     label: 'Leases',      icon: ScrollText },
  { id: 'agreements', label: 'Agreements',  icon: FileCheck2 },
];

// ── Small helpers ──────────────────────────────────────────────────────────────
const INPUT_CLS = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';
const LABEL_CLS = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';

function Field({ label, children }) {
  return (
    <div>
      <label className={LABEL_CLS}>{label}</label>
      {children}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2.5 mb-4 pb-3 border-b border-[#243041]/40">
      <Icon size={18} className="text-[#11C7E5]" />
      <h3 className="text-white font-bold text-sm">{title}</h3>
    </div>
  );
}

function normalizeDate(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

// ── AI Review Panel ─────────────────────────────────────────────────────────────
function AIReviewPanel({ review }) {
  if (!review?.length) return (
    <div className="p-4 text-[#A4B0B7] text-sm text-center">
      No review yet. Generate content first, then click "Run AI Review".
    </div>
  );
  return (
    <div className="space-y-2">
      {review.map((item, i) => {
        const isWarning = item.severity === 'warning' || item.severity === 'error';
        return (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${isWarning ? 'bg-rose-950/30 border border-rose-500/20' : 'bg-emerald-950/20 border border-emerald-500/20'}`}>
            {isWarning
              ? <AlertTriangle size={16} className="text-rose-400 mt-0.5 shrink-0" />
              : <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />}
            <div>
              <p className={`font-semibold text-sm ${isWarning ? 'text-rose-300' : 'text-emerald-300'}`}>{item.title}</p>
              {item.message && <p className="text-xs mt-0.5 text-[#A4B0B7]">{item.message}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Agreement Creator ──────────────────────────────────────────────────────────
function AgreementCreator({ onCreated }) {
  const [form, setForm] = useState({
    title: '', client_name: '', client_email: '', client_phone: '',
    agreement_type: 'contract', start_date: '',
  });
  const [prompt, setPrompt]         = useState('');
  const [content, setContent]       = useState('');
  const [aiReview, setAiReview]     = useState([]);
  const [signatureEnabled, setSig]  = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing]   = useState(false);
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function runGenerate() {
    if (!prompt.trim()) { setError('Please enter a prompt to generate the agreement.'); return; }
    setError(''); setGenerating(true);
    try {
      const res = await smartflowApi.generateAgreement({
        prompt: prompt.trim(),
        title: form.title.trim() || undefined,
        client_name: form.client_name.trim() || undefined,
        agreement_type: form.agreement_type,
      });
      const draft = res.data?.data || {};
      if (draft.title)          set('title', draft.title);
      if (draft.client_name)    set('client_name', draft.client_name);
      if (draft.agreement_type) set('agreement_type', draft.agreement_type);
      if (draft.content)        setContent(draft.content);
      if (draft.ai_review)      setAiReview(draft.ai_review);
    } catch (err) {
      setError(err.response?.data?.message || 'AI generation failed.');
    } finally { setGenerating(false); }
  }

  async function runReview() {
    if (!content.trim()) { setError('Generate or write agreement content first.'); return; }
    setError(''); setReviewing(true);
    try {
      const res = await smartflowApi.reviewAgreement({ content: content.trim(), agreement_type: form.agreement_type });
      const data = res.data?.data;
      setAiReview(Array.isArray(data?.ai_review) ? data.ai_review : Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'AI review failed.');
    } finally { setReviewing(false); }
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.client_name.trim() || !content.trim()) {
      setError('Title, client name, and agreement content are required.'); return;
    }
    setError(''); setCreating(true);
    try {
      await smartflowApi.createAgreement({
        ...form,
        start_date: normalizeDate(form.start_date),
        content: content.trim(),
        status: signatureEnabled ? 'pending_signature' : 'draft',
      });
      setSuccess('Agreement created successfully!');
      setForm({ title: '', client_name: '', client_email: '', client_phone: '', agreement_type: 'contract', start_date: '' });
      setPrompt(''); setContent(''); setAiReview([]);
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create agreement.');
    } finally { setCreating(false); }
  }

  return (
    <div className="space-y-5">
      {error   && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2"><AlertTriangle size={14} />{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2"><CheckCircle2 size={14} />{success}</div>}

      {/* Basic Info */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={CircleAlert} title="Agreement Basic Info" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Agreement Title">
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Website Design Service" className={INPUT_CLS} />
          </Field>
          <Field label="Agreement Type">
            <select value={form.agreement_type} onChange={e => set('agreement_type', e.target.value)} className={INPUT_CLS}>
              <option value="contract">Contract</option>
              <option value="nda">NDA</option>
              <option value="service">Service</option>
              <option value="lease">Lease</option>
              <option value="legal">Legal</option>
            </select>
          </Field>
          <Field label="Client Name">
            <input value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Enter client name" className={INPUT_CLS} />
          </Field>
          <Field label="Client Email">
            <input value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="email@example.com" className={INPUT_CLS} />
          </Field>
          <Field label="Client Phone">
            <input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+1 234 567 890" className={INPUT_CLS} />
          </Field>
          <Field label="Date">
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>
      </div>

      {/* AI Generate */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={Sparkles} title="Generate with AI" />
        <div className="relative">
          <textarea
            value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Create agreement draft... e.g. A 6-month freelance contract for Acme Corp covering web development services at $5,000/month"
            className={`${INPUT_CLS} min-h-28 resize-none pr-12`}
          />
          <Mic size={18} className="absolute bottom-4 right-4 text-[#11C7E5]" />
        </div>
        <button
          onClick={runGenerate} disabled={generating}
          className="mt-3 w-full py-3.5 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {generating ? 'Generating…' : 'Generate Agreement'}
        </button>
      </div>

      {/* Content + AI Review */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={PenLine} title="Agreement Content" />
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder="Agreement content will appear here after generation, or write your own..."
          className={`${INPUT_CLS} min-h-48 resize-none font-mono`}
        />
        <button
          onClick={runReview} disabled={reviewing}
          className="mt-3 w-full py-3 border border-[#11C7E5]/30 text-[#11C7E5] hover:bg-[#11C7E5]/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {reviewing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {reviewing ? 'Reviewing…' : 'Run AI Review'}
        </button>
      </div>

      {/* AI Review Results */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 bg-[#0C1420] border-b border-[#243041]/40">
          <Sparkles size={16} className="text-[#11C7E5]" />
          <span className="text-white font-bold text-sm">AI Review</span>
          {aiReview.length > 0 && <span className="ml-auto text-xs text-[#A4B0B7]">{aiReview.length} item{aiReview.length !== 1 ? 's' : ''}</span>}
        </div>
        <div className="p-4">
          <AIReviewPanel review={aiReview} />
        </div>
      </div>

      {/* Signature toggle + Create button */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5 flex items-center justify-between">
        <span className="text-white font-semibold text-sm">Require Signature Field</span>
        <button
          onClick={() => setSig(s => !s)}
          className={`relative w-12 h-6 rounded-full transition-colors ${signatureEnabled ? 'bg-[#11C7E5]' : 'bg-[#243041]'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${signatureEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <button
        onClick={handleCreate} disabled={creating}
        className="w-full py-4 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer text-base"
      >
        {creating ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
        {creating ? 'Creating…' : signatureEnabled ? 'Send For Signature' : 'Save as Draft'}
      </button>
    </div>
  );
}

// ── Lease Creator ──────────────────────────────────────────────────────────────
function LeaseCreator({ onCreated }) {
  const [prompt, setPrompt]       = useState('');
  const [address, setAddress]     = useState('');
  const [propType, setPropType]   = useState('apartment');
  const [landlord, setLandlord]   = useState('');
  const [tenant, setTenant]       = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [rent, setRent]           = useState('');
  const [deposit, setDeposit]     = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate]     = useState('');
  const [terms, setTerms]         = useState('');
  const [tenantSig, setTenantSig]     = useState(true);
  const [landlordSig, setLandlordSig] = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [creating, setCreating]       = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  const buildPayload = () => ({
    property_address: address.trim(),
    property_type: propType.toLowerCase(),
    landlord_name: landlord.trim() || undefined,
    tenant_name: tenant.trim() || undefined,
    tenant_email: tenantEmail.trim() || undefined,
    tenant_phone: tenantPhone.trim() || undefined,
    monthly_rent: Number(rent) || undefined,
    security_deposit: Number(deposit) || undefined,
    start_date: normalizeDate(startDate),
    end_date: normalizeDate(endDate),
    custom_terms: terms.trim() || undefined,
    signature_fields: { tenant_signature: tenantSig, landlord_signature: landlordSig },
  });

  async function runGenerate() {
    if (!prompt.trim()) { setError('Please enter a prompt to generate the lease.'); return; }
    setError(''); setGenerating(true);
    try {
      const res = await smartflowApi.generateLease({ prompt: prompt.trim(), ...buildPayload() });
      const draft = res.data?.data || {};
      if (draft.property_address) setAddress(draft.property_address);
      if (draft.property_type)    setPropType(draft.property_type);
      if (draft.landlord_name)    setLandlord(draft.landlord_name);
      if (draft.tenant_name)      setTenant(draft.tenant_name);
      if (draft.tenant_email)     setTenantEmail(draft.tenant_email);
      if (draft.tenant_phone)     setTenantPhone(draft.tenant_phone);
      if (draft.monthly_rent)     setRent(String(draft.monthly_rent));
      if (draft.security_deposit) setDeposit(String(draft.security_deposit));
      if (draft.start_date)       setStartDate(draft.start_date);
      if (draft.end_date)         setEndDate(draft.end_date);
      if (draft.custom_terms)     setTerms(draft.custom_terms);
    } catch (err) {
      setError(err.response?.data?.message || 'AI lease generation failed.');
    } finally { setGenerating(false); }
  }

  async function handleCreate() {
    if (!address.trim() || !tenant.trim() || !rent) {
      setError('Property address, tenant name, and monthly rent are required.'); return;
    }
    setError(''); setCreating(true);
    try {
      await smartflowApi.createLease(buildPayload());
      setSuccess('Lease created successfully!');
      setPrompt(''); setAddress(''); setLandlord(''); setTenant('');
      setTenantEmail(''); setTenantPhone(''); setRent(''); setDeposit('');
      setStartDate(''); setEndDate(''); setTerms('');
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create lease.');
    } finally { setCreating(false); }
  }

  function SigToggle({ label, icon: Icon, value, onChange }) {
    return (
      <div className="flex items-center justify-between px-4 py-3.5 bg-[#0A1019] border border-[#243246] rounded-xl">
        <span className="flex items-center gap-2.5 text-white text-sm font-semibold"><Icon size={16} className="text-[#A4B0B7]" />{label}</span>
        <button onClick={() => onChange(!value)} className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-[#11C7E5]' : 'bg-[#243041]'}`}>
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error   && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2"><AlertTriangle size={14} />{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2"><CheckCircle2 size={14} />{success}</div>}

      {/* AI Generate */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <p className="text-[#11C7E5] text-xs font-bold uppercase tracking-widest mb-3">Generate Lease with AI</p>
        <div className="relative">
          <textarea
            value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Create a 1-year apartment lease for tenant John Smith at $2,500/month..."
            className={`${INPUT_CLS} min-h-24 resize-none pr-12`}
          />
          <Mic size={18} className="absolute bottom-4 right-4 text-[#11C7E5]" />
        </div>
        <button
          onClick={runGenerate} disabled={generating}
          className="mt-3 w-full py-3.5 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {generating ? 'Generating…' : 'Generate Lease'}
        </button>
      </div>

      {/* Property Details */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={House} title="Property Details" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Property Address">
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Skyview Terrace, Suite 402" className={INPUT_CLS} />
          </Field>
          <Field label="Property Type">
            <select value={propType} onChange={e => setPropType(e.target.value)} className={INPUT_CLS}>
              <option value="apartment">Apartment</option>
              <option value="house">House</option>
              <option value="commercial">Commercial</option>
              <option value="studio">Studio</option>
              <option value="villa">Villa</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Parties Info */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={Users} title="Parties Info" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Landlord Full Name">
            <input value={landlord} onChange={e => setLandlord(e.target.value)} placeholder="e.g. John Doe" className={INPUT_CLS} />
          </Field>
          <Field label="Tenant Full Name">
            <input value={tenant} onChange={e => setTenant(e.target.value)} placeholder="e.g. Jane Smith" className={INPUT_CLS} />
          </Field>
          <Field label="Tenant Email">
            <input value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} placeholder="email@example.com" className={INPUT_CLS} />
          </Field>
          <Field label="Tenant Phone">
            <input value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} placeholder="+1 234 567 890" className={INPUT_CLS} />
          </Field>
        </div>
      </div>

      {/* Payment Details */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={Wallet} title="Payment Details" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Monthly Rent ($)">
            <input type="number" value={rent} onChange={e => setRent(e.target.value)} placeholder="2500" className={INPUT_CLS} />
          </Field>
          <Field label="Security Deposit ($)">
            <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="5000" className={INPUT_CLS} />
          </Field>
        </div>
      </div>

      {/* Lease Duration */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={CalendarDays} title="Lease Duration" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Start Date">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field label="End Date">
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>
      </div>

      {/* Lease Terms */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={PenLine} title="Lease Terms" />
        <textarea
          value={terms} onChange={e => setTerms(e.target.value)}
          placeholder="Enter custom terms or let AI generate legal clauses..."
          className={`${INPUT_CLS} min-h-32 resize-none`}
        />
      </div>

      {/* Signature Fields */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5 space-y-3">
        <SectionHeader icon={PenLine} title="Signature Fields" />
        <SigToggle label="Tenant Signature" icon={Users} value={tenantSig} onChange={setTenantSig} />
        <SigToggle label="Landlord Signature" icon={Building2} value={landlordSig} onChange={setLandlordSig} />
      </div>

      <button
        onClick={handleCreate} disabled={creating}
        className="w-full py-4 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer text-base"
      >
        {creating ? <Loader2 size={20} className="animate-spin" /> : <ScrollText size={20} />}
        {creating ? 'Creating…' : 'Preview Lease'}
      </button>
    </div>
  );
}

// ── Record row ────────────────────────────────────────────────────────────────
function RecordRow({ item, type, onDelete, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');

  async function action(label, fn) {
    setBusy(label); setMsg('');
    try { await fn(); setMsg(`${label} successful!`); onRefresh?.(); }
    catch(err) { setMsg(err.response?.data?.message || `${label} failed.`); }
    finally { setBusy(null); }
  }

  async function downloadPdf() {
    setBusy('pdf');
    try {
      const fn = type === 'leases' ? smartflowApi.downloadLeasePdf : smartflowApi.downloadAgreementPdf;
      const res = await fn(item.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url;
      a.download = `${item.title || 'document'}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { setMsg('PDF download failed.'); }
    finally { setBusy(null); }
  }

  const isLease = type === 'leases';
  const isAgreement = type === 'agreements';
  const showActions = isLease || isAgreement;

  return (
    <div className="border-b border-[#243041]/30 last:border-0">
      <div
        className="flex items-center justify-between p-5 hover:bg-[#1C2635]/10 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white truncate text-sm">{item.title || item.name || item.agreement_number || item.lease_number || item.id}</h3>
          <p className="text-xs text-[#A4B0B7] mt-0.5 truncate">
            {item.agreement_type || item.property_type || item.type || item.status || 'Document'} 
            {item.client_name && ` · ${item.client_name}`}
            {item.tenant_name && ` · Tenant: ${item.tenant_name}`}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {item.status && (
            <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
              item.status === 'active' || item.status === 'signed'   ? 'bg-emerald-950/40 text-emerald-400' :
              item.status === 'pending_signature' || item.status === 'pending' ? 'bg-amber-950/40 text-amber-400' :
              'bg-[#243041] text-[#A4B0B7]'
            }`}>{item.status.replace(/_/g, ' ')}</span>
          )}
          {onDelete && (
            <button
              onClick={e => { e.stopPropagation(); onDelete(item.id); }}
              className="p-2 text-rose-400 hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer"
            >
              <Trash2 size={15} />
            </button>
          )}
          {open ? <ChevronUp size={16} className="text-[#A4B0B7]" /> : <ChevronDown size={16} className="text-[#A4B0B7]" />}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-sm text-[#A4B0B7] border-t border-[#243041]/30 pt-3 space-y-3">
              {msg && <p className={msg.includes('failed') ? 'text-rose-400' : 'text-emerald-400'}>{msg}</p>}
              {item.content && <p className="line-clamp-4 leading-relaxed">{item.content}</p>}
              {item.property_address && <p>📍 {item.property_address}</p>}
              {item.monthly_rent && <p>💰 ${item.monthly_rent}/month</p>}
              {item.start_date && <p>📅 {item.start_date} → {item.end_date || '—'}</p>}
              {item.file_url && <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="text-[#11C7E5] hover:underline">View File ↗</a>}

              {/* Action buttons for lease/agreement */}
              {showActions && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={e=>{e.stopPropagation();downloadPdf();}} disabled={busy==='pdf'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='pdf' ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>} PDF
                  </button>
                  <button onClick={e=>{e.stopPropagation(); action('Send Signature', ()=>(isLease ? smartflowApi.leaseSendSignature(item.id,{}) : smartflowApi.agreementSendSignature(item.id,{})));}} disabled={!!busy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-[#11C7E5] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='Send Signature' ? <Loader2 size={12} className="animate-spin"/> : <Mail size={12}/>} Send for Signature
                  </button>
                  <button onClick={e=>{e.stopPropagation(); action('Sign', ()=>(isLease ? smartflowApi.leaseSign(item.id,{signature:'web'}) : smartflowApi.agreementSign(item.id,{signature:'web'})));}} disabled={!!busy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/50 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='Sign' ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>} Sign
                  </button>
                  <button onClick={e=>{e.stopPropagation(); action('Renew', ()=>(isLease ? smartflowApi.leaseRenew(item.id,{}) : smartflowApi.agreementRenew(item.id,{})));}} disabled={!!busy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] hover:bg-[#11C7E5]/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='Renew' ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>} Renew
                  </button>
                  <button onClick={e=>{e.stopPropagation(); action('Improve', ()=>(isLease ? smartflowApi.leaseEnhanceTerms(item.id,{}) : smartflowApi.agreementImprove(item.id,{})));}} disabled={!!busy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-amber-400 hover:bg-amber-950/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='Improve' ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} AI Improve
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Documents() {
  const [active, setActive]         = useState('documents');
  const [documents, setDocuments]   = useState([]);
  const [leases, setLeases]         = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [docs, leaseList, agreementList] = await Promise.all([
        smartflowApi.getDocuments(),
        smartflowApi.getLeases(),
        smartflowApi.getAgreements(),
      ]);
      setDocuments(docs.data?.data?.items || docs.data?.data || []);
      setLeases(leaseList.data?.data?.items || leaseList.data?.data || []);
      setAgreements(agreementList.data?.data?.items || agreementList.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Documents could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const rows = useMemo(() => {
    if (active === 'leases') return leases;
    if (active === 'agreements') return agreements;
    return documents;
  }, [active, agreements, documents, leases]);

  async function quickCreateDocument() {
    setError('');
    try {
      await smartflowApi.createDocument({ name: `Document ${Date.now()}`, type: 'others', file_url: 'https://example.com/document.pdf' });
      fetchAll();
    } catch (err) { setError(err.response?.data?.message || 'Create failed.'); }
  }

  async function deleteDoc(id) {
    try { await smartflowApi.deleteDocument(id); fetchAll(); }
    catch (err) { setError(err.response?.data?.message || 'Delete failed.'); }
  }

  const showForm = active !== 'documents';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#243041]/40 pb-4">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Documents</h1>
          <p className="text-[#A4B0B7] text-xs mt-1">Manage files, leases, agreements, AI drafts, reviews, and signatures.</p>
        </div>
        <button
          onClick={() => { setShowCreate(c => !c); }}
          className="px-5 py-3 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-extrabold flex items-center gap-2 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          {showCreate ? <X size={18} /> : <Plus size={18} />}
          {showCreate ? 'Close Form' : active === 'documents' ? 'Upload Document' : active === 'leases' ? 'New Lease' : 'New Agreement'}
        </button>
      </div>

      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setActive(tab.id); setShowCreate(false); }}
              className={`px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer ${active === tab.id ? 'bg-[#11C7E5]/10 text-white border-[#11C7E5]/20' : 'text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent'}`}
            >
              <Icon size={16} className={active === tab.id ? 'text-[#11C7E5]' : ''} />
              {tab.label}
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#243041] text-[#A4B0B7] text-xs">
                {tab.id === 'documents' ? documents.length : tab.id === 'leases' ? leases.length : agreements.length}
              </span>
            </button>
          );
        })}
      </div>

      <div className={`grid gap-6 items-start ${showCreate && showForm ? 'grid-cols-1 xl:grid-cols-[1fr_420px]' : 'grid-cols-1'}`}>
        {/* Records list */}
        <div className="bg-[#131A24] border border-[#243041] rounded-[22px] overflow-hidden text-left order-2 xl:order-1">
          <div className="p-5 border-b border-[#243041]/40 flex items-center justify-between">
            <span className="font-bold text-white text-base">{tabs.find(t => t.id === active)?.label}</span>
            {active === 'documents' && (
              <button onClick={quickCreateDocument} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#11C7E5] border border-[#11C7E5]/30 rounded-lg hover:bg-[#11C7E5]/10 transition-colors cursor-pointer">
                <Upload size={13} /> Quick Upload
              </button>
            )}
          </div>
          {loading ? (
            <div className="p-12 flex items-center justify-center gap-3 text-[#A4B0B7]/60 text-sm">
              <Loader2 size={20} className="animate-spin" /> Loading…
            </div>
          ) : rows.length ? (
            <div className="divide-y divide-[#243041]/30">
              {rows.map(item => (
                <RecordRow key={item.id || item._id} item={item} type={active} onDelete={active === 'documents' ? deleteDoc : undefined} onRefresh={fetchAll} />
              ))}
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center mx-auto mb-4">
                {active === 'documents' ? <FileText size={24} className="text-[#11C7E5]" /> : active === 'leases' ? <ScrollText size={24} className="text-[#11C7E5]" /> : <FileCheck2 size={24} className="text-[#11C7E5]" />}
              </div>
              <p className="text-white font-bold">No {tabs.find(t => t.id === active)?.label.toLowerCase()} yet</p>
              <p className="text-[#A4B0B7] text-sm mt-1">
                {active === 'documents' ? 'Upload files above.' : `Click "${active === 'leases' ? 'New Lease' : 'New Agreement'}" to create one with AI.`}
              </p>
            </div>
          )}
        </div>

        {/* Creation panel */}
        <AnimatePresence>
          {showCreate && (
            <motion.div
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25 }}
              className="order-1 xl:order-2 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#243041]"
            >
              {active === 'agreements' && <AgreementCreator onCreated={() => { fetchAll(); setShowCreate(false); }} />}
              {active === 'leases' && <LeaseCreator onCreated={() => { fetchAll(); setShowCreate(false); }} />}
              {active === 'documents' && (
                <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-6 text-center space-y-4">
                  <Upload size={32} className="text-[#11C7E5] mx-auto" />
                  <p className="text-white font-bold">Upload Document</p>
                  <p className="text-[#A4B0B7] text-sm">File upload via the quick upload button or drag-and-drop will be available here.</p>
                  <button onClick={() => { quickCreateDocument(); setShowCreate(false); }} className="w-full py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold cursor-pointer">
                    Create Sample Document
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
