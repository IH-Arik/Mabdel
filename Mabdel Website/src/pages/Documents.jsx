import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronUp,
  CircleAlert, Download, FileCheck2, FileText, House, Loader2, Mail, Mic, PenLine,
  Plus, RefreshCw, ScrollText, Sparkles, Trash2, Upload, Users, Wallet, X,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../api/services';
import VoiceFormFillModal from '../components/Documents/VoiceFormFillModal';
import { DatePickerInput } from '../components/ui/DateTimeInputs';

// ── Tab definition ─────────────────────────────────────────────────────────────
const tabs = [
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

function extractSigningToken(signatureUrl) {
  const match = String(signatureUrl || '').match(/\/(?:agreements|leases)\/signing\/([^/]+)/);
  return match?.[1] || null;
}

function getAgreementStatusBadge(status) {
  switch (String(status || '').toLowerCase()) {
    case 'signed':
      return 'bg-emerald-950/40 text-emerald-400';
    case 'pending_signature':
      return 'bg-amber-950/40 text-amber-400';
    case 'expired':
      return 'bg-rose-950/40 text-rose-400';
    case 'cancelled':
      return 'bg-slate-800 text-slate-300';
    default:
      return 'bg-[#243041] text-[#A4B0B7]';
  }
}

function formatDisplayDate(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLeaseMoney(value, currency = 'USD', suffix = '') {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2,
  }).format(numeric) + suffix;
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
function AgreementCreator({ onCreated, prefill }) {
  const [form, setForm] = useState({
    title: prefill?.title || '', 
    client_name: prefill?.client_name || prefill?.clientName || prefill?.name || '', 
    client_email: prefill?.client_email || prefill?.clientEmail || '', 
    client_phone: prefill?.client_phone || prefill?.clientPhone || '',
    agreement_type: prefill?.agreement_type || prefill?.agreementType || 'contract', 
    start_date: prefill?.start_date || prefill?.startDate || '',
  });
  const [prompt, setPrompt]         = useState(prefill?.prompt || '');
  const [content, setContent]       = useState(prefill?.content || prefill?.body || '');
  const [aiReview, setAiReview]     = useState([]);
  const [signatureEnabled, setSig]  = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reviewing, setReviewing]   = useState(false);
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const generateDraftWithValues = useCallback(async ({ nextPrompt, nextTitle, nextClientName, nextAgreementType }) => {
    if (!String(nextPrompt || '').trim()) return;
    setError('');
    setGenerating(true);
    try {
      const res = await smartflowApi.generateAgreement({
        prompt: String(nextPrompt).trim(),
        title: String(nextTitle || '').trim() || undefined,
        client_name: String(nextClientName || '').trim() || undefined,
        agreement_type: nextAgreementType || 'contract',
      });
      const draft = res.data?.data || {};
      if (draft.title) set('title', draft.title);
      if (draft.client_name) set('client_name', draft.client_name);
      if (draft.agreement_type) set('agreement_type', draft.agreement_type);
      if (draft.content) setContent(draft.content);
      if (draft.ai_review) setAiReview(draft.ai_review);
    } catch (err) {
      setError(err.response?.data?.message || 'AI generation failed.');
    } finally {
      setGenerating(false);
    }
  }, []);

  const applyVoicePrefill = useCallback((voicePrefill) => {
    const nextForm = {
      title: voicePrefill?.title || form.title,
      client_name: voicePrefill?.client_name || form.client_name,
      client_email: voicePrefill?.client_email || form.client_email,
      client_phone: voicePrefill?.client_phone || form.client_phone,
      agreement_type: voicePrefill?.agreement_type || form.agreement_type,
      start_date: normalizeDate(voicePrefill?.start_date) || form.start_date,
    };
    setForm((prev) => ({
      ...prev,
      ...nextForm,
    }));
    const nextPrompt = voicePrefill?.prompt || prompt;
    const nextContent = voicePrefill?.content || voicePrefill?.body || '';

    if (voicePrefill?.prompt) setPrompt(voicePrefill.prompt);
    if (nextContent) {
      setContent(nextContent);
      return;
    }

    if (voicePrefill?.prompt) {
      void generateDraftWithValues({
        nextPrompt,
        nextTitle: nextForm.title,
        nextClientName: nextForm.client_name,
        nextAgreementType: nextForm.agreement_type,
      });
    }
  }, [form.agreement_type, form.client_email, form.client_name, form.client_phone, form.start_date, form.title, generateDraftWithValues, prompt]);

  async function runGenerate() {
    if (!prompt.trim()) { setError('Please enter a prompt to generate the agreement.'); return; }
    await generateDraftWithValues({
      nextPrompt: prompt,
      nextTitle: form.title,
      nextClientName: form.client_name,
      nextAgreementType: form.agreement_type,
    });
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
          <VoiceFormFillModal
            workflowIntent="agreement"
            label="Agreement"
            currentValues={{ ...form, prompt, content }}
            onApply={applyVoicePrefill}
            buttonClassName="absolute bottom-4 right-4 text-[#11C7E5] hover:text-white transition-colors"
          />
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
function LeaseCreator({ onCreated, prefill }) {
  const [prompt, setPrompt]       = useState(prefill?.prompt || '');
  const [address, setAddress]     = useState(prefill?.address || prefill?.property_address || '');
  const [propType, setPropType]   = useState(prefill?.propType || prefill?.property_type || 'apartment');
  const [landlord, setLandlord]   = useState(prefill?.landlord || prefill?.landlord_name || '');
  const [tenant, setTenant]       = useState(prefill?.tenant || prefill?.tenant_name || prefill?.name || '');
  const [tenantEmail, setTenantEmail] = useState(prefill?.tenantEmail || prefill?.tenant_email || '');
  const [tenantPhone, setTenantPhone] = useState(prefill?.tenantPhone || prefill?.tenant_phone || '');
  const [rent, setRent]           = useState(prefill?.rent || prefill?.monthly_rent || '');
  const [deposit, setDeposit]     = useState(prefill?.deposit || prefill?.security_deposit || '');
  const [startDate, setStartDate] = useState(prefill?.startDate || prefill?.start_date || '');
  const [endDate, setEndDate]     = useState(prefill?.endDate || prefill?.end_date || '');
  const [terms, setTerms]         = useState(prefill?.terms || prefill?.custom_terms || '');
  const [tenantSig, setTenantSig]     = useState(true);
  const [landlordSig, setLandlordSig] = useState(true);
  const [generating, setGenerating]   = useState(false);
  const [creating, setCreating]       = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const applyVoicePrefill = useCallback((voicePrefill) => {
    if (voicePrefill?.prompt) setPrompt(voicePrefill.prompt);
    if (voicePrefill?.property_address || voicePrefill?.address) setAddress(voicePrefill.property_address || voicePrefill.address);
    if (voicePrefill?.property_type) setPropType(String(voicePrefill.property_type).toLowerCase());
    if (voicePrefill?.landlord_name || voicePrefill?.landlord) setLandlord(voicePrefill.landlord_name || voicePrefill.landlord);
    if (voicePrefill?.tenant_name || voicePrefill?.tenant) setTenant(voicePrefill.tenant_name || voicePrefill.tenant);
    if (voicePrefill?.tenant_email) setTenantEmail(voicePrefill.tenant_email);
    if (voicePrefill?.tenant_phone) setTenantPhone(voicePrefill.tenant_phone);
    if (voicePrefill?.monthly_rent || voicePrefill?.rent) setRent(String(voicePrefill.monthly_rent || voicePrefill.rent));
    if (voicePrefill?.security_deposit || voicePrefill?.deposit) setDeposit(String(voicePrefill.security_deposit || voicePrefill.deposit));
    if (voicePrefill?.start_date) setStartDate(normalizeDate(voicePrefill.start_date) || voicePrefill.start_date);
    if (voicePrefill?.end_date) setEndDate(normalizeDate(voicePrefill.end_date) || voicePrefill.end_date);
    if (voicePrefill?.custom_terms || voicePrefill?.terms) setTerms(voicePrefill.custom_terms || voicePrefill.terms);
  }, []);

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
          <VoiceFormFillModal
            workflowIntent="lease"
            label="Lease"
            currentValues={{
              prompt,
              property_address: address,
              property_type: propType,
              landlord_name: landlord,
              tenant_name: tenant,
              tenant_email: tenantEmail,
              tenant_phone: tenantPhone,
              monthly_rent: rent,
              security_deposit: deposit,
              start_date: startDate,
              end_date: endDate,
              custom_terms: terms,
            }}
            onApply={applyVoicePrefill}
            buttonClassName="absolute bottom-4 right-4 text-[#11C7E5] hover:text-white transition-colors"
          />
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
            <DatePickerInput value={startDate} onChange={setStartDate} className="focus:border-[#11C7E5]/50" />
          </Field>
          <Field label="End Date">
            <DatePickerInput value={endDate} onChange={setEndDate} className="focus:border-[#11C7E5]/50" />
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

function LeaseRecordRow({ item, onDelete, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState(item);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [showSignPanel, setShowSignPanel] = useState(false);
  const [showImprovePanel, setShowImprovePanel] = useState(false);
  const [showRenewPanel, setShowRenewPanel] = useState(false);
  const [recipientName, setRecipientName] = useState(item.tenant_name || item.client_name || '');
  const [recipientEmail, setRecipientEmail] = useState(item.client_email || item.tenant_email || '');
  const [recipientPhone, setRecipientPhone] = useState(item.client_phone || item.tenant_phone || '');
  const [signerName, setSignerName] = useState(item.tenant_name || item.client_name || '');
  const [signerEmail, setSignerEmail] = useState(item.client_email || item.tenant_email || '');
  const [signatureText, setSignatureText] = useState('');
  const [signatureProvider, setSignatureProvider] = useState(item.signature_provider || 'native');
  const [docusignStatus, setDocusignStatus] = useState(null);
  const [improveFocus, setImproveFocus] = useState('balanced');
  const [improveTerms, setImproveTerms] = useState(item.lease?.custom_terms || '');
  const [improvePreview, setImprovePreview] = useState('');
  const [improveReview, setImproveReview] = useState([]);
  const [renewStartDate, setRenewStartDate] = useState(item.start_date || '');
  const [renewEndDate, setRenewEndDate] = useState(item.end_date || '');
  const [renewRent, setRenewRent] = useState(item.monthly_rent != null ? String(item.monthly_rent) : '');

  const record = detail || item;
  const reviewItems = record?.ai_review || [];

  useEffect(() => {
    setDetail(item);
    setRecipientName(item.tenant_name || item.client_name || '');
    setRecipientEmail(item.client_email || item.tenant_email || '');
    setRecipientPhone(item.client_phone || item.tenant_phone || '');
    setSignerName(item.tenant_name || item.client_name || '');
    setSignerEmail(item.client_email || item.tenant_email || '');
    setSignatureProvider(item.signature_provider || 'native');
    setImproveTerms(item.lease?.custom_terms || '');
    setRenewStartDate(item.start_date || '');
    setRenewEndDate(item.end_date || '');
    setRenewRent(item.monthly_rent != null ? String(item.monthly_rent) : '');
  }, [item]);

  useEffect(() => {
    let ignore = false;
    async function loadDetail() {
      if (!open) return;
      setLoadingDetail(true);
      try {
        const res = await smartflowApi.getLease(item.id);
        if (ignore) return;
        const next = res.data?.data || item;
        setDetail(next);
        setRecipientName(next.tenant_name || next.client_name || '');
        setRecipientEmail(next.client_email || next.tenant_email || '');
        setRecipientPhone(next.client_phone || next.tenant_phone || '');
        setSignerName(next.tenant_name || next.client_name || '');
        setSignerEmail(next.client_email || next.tenant_email || '');
        setSignatureProvider(next.signature_provider || 'native');
        setImproveTerms(next.lease?.custom_terms || '');
        setRenewStartDate(next.start_date || '');
        setRenewEndDate(next.end_date || '');
        setRenewRent(next.monthly_rent != null ? String(next.monthly_rent) : '');
      } catch (err) {
        if (!ignore) setMsg(err.response?.data?.message || 'Lease preview failed to load.');
      } finally {
        if (!ignore) setLoadingDetail(false);
      }
    }
    loadDetail();
    return () => { ignore = true; };
  }, [open, item, item.id]);

  useEffect(() => {
    let ignore = false;
    async function loadDocusignStatus() {
      if (!open) return;
      try {
        const res = await smartflowApi.getAgreementDocusignStatus();
        if (!ignore) setDocusignStatus(res.data?.data || null);
      } catch {
        if (!ignore) setDocusignStatus(null);
      }
    }
    loadDocusignStatus();
    return () => { ignore = true; };
  }, [open]);

  async function refreshDetail() {
    const res = await smartflowApi.getLease(item.id);
    const next = res.data?.data || item;
    setDetail(next);
    return next;
  }

  async function startDocusignConnect() {
    setBusy('connect-docusign');
    setMsg('');
    try {
      const res = await smartflowApi.startAgreementDocusignOAuth();
      const authUrl = res.data?.data?.auth_url;
      if (!authUrl) throw new Error('OAuth URL missing.');
      window.open(authUrl, '_blank', 'noopener,noreferrer,width=720,height=840');
      setMsg('DocuSign connection window opened.');
    } catch (err) {
      setMsg(err.response?.data?.message || err.message || 'Could not start DocuSign connection.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy('pdf');
    try {
      const res = await smartflowApi.downloadLeasePdf(record.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.lease_number || record.title || 'lease'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.response?.data?.message || 'PDF download failed.');
    } finally {
      setBusy(null);
    }
  }

  async function sendForSignature() {
    if (signatureProvider === 'docusign' && !docusignStatus?.connected) {
      setMsg('Connect DocuSign before sending with DocuSign.');
      return;
    }
    setBusy('send-signature');
    setMsg('');
    try {
      await smartflowApi.leaseSendSignature(record.id, {
        recipient_name: recipientName.trim() || undefined,
        recipient_email: recipientEmail.trim() || undefined,
        recipient_phone: recipientPhone.trim() || undefined,
        channel: recipientEmail.trim() ? 'email' : 'link',
        provider: signatureProvider,
      });
      await refreshDetail();
      onRefresh?.();
      setShowSendPanel(false);
      setMsg('Lease sent for signature successfully.');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Send signature failed.');
    } finally {
      setBusy(null);
    }
  }

  async function signLeaseNow() {
    if (!signerName.trim() || !signatureText.trim()) {
      setMsg('Signer name and signature text are required.');
      return;
    }
    setBusy('sign');
    setMsg('');
    try {
      await smartflowApi.leaseSign(record.id, {
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim() || undefined,
        signature_text: signatureText.trim(),
      });
      await refreshDetail();
      onRefresh?.();
      setShowSignPanel(false);
      setSignatureText('');
      setMsg('Lease signed successfully.');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Lease signing failed.');
    } finally {
      setBusy(null);
    }
  }

  async function previewImprove() {
    setBusy('improve');
    setMsg('');
    try {
      const res = await smartflowApi.leaseEnhanceTerms(record.id, {
        content: record.content || '',
        custom_terms: improveTerms || record.lease?.custom_terms || '',
        focus: improveFocus,
      });
      const next = res.data?.data || {};
      setImproveTerms(next.custom_terms || improveTerms);
      setImprovePreview(next.content || record.content || '');
      setImproveReview(next.ai_review || []);
      setShowImprovePanel(true);
      setMsg('AI preview ready.');
    } catch (err) {
      setMsg(err.response?.data?.message || 'AI improve failed.');
    } finally {
      setBusy(null);
    }
  }

  async function acceptImprove() {
    setBusy('save-improve');
    setMsg('');
    try {
      await smartflowApi.patchLease(record.id, {
        content: improvePreview || record.content,
        custom_terms: improveTerms || undefined,
      });
      await refreshDetail();
      onRefresh?.();
      setShowImprovePanel(false);
      setMsg('Lease improvements saved.');
    } catch (err) {
      setMsg(err.response?.data?.message || 'Could not save AI improvements.');
    } finally {
      setBusy(null);
    }
  }

  async function renewLeaseNow() {
    setBusy('renew');
    setMsg('');
    try {
      const res = await smartflowApi.leaseRenew(record.id, {
        start_date: normalizeDate(renewStartDate),
        end_date: normalizeDate(renewEndDate) || undefined,
        monthly_rent: renewRent ? Number(renewRent) : undefined,
      });
      const renewedLease = res.data?.data;
      onRefresh?.();
      setShowRenewPanel(false);
      setMsg(`Lease renewed as ${renewedLease?.lease_number || renewedLease?.agreement_number || 'a new lease'}.`);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Lease renewal failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-b border-[#243041]/30 last:border-0">
      <div
        className="flex items-center justify-between p-5 hover:bg-[#1C2635]/10 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white truncate text-sm">
            {item.lease_number || item.title || item.id}
          </h3>
          <p className="text-xs text-[#A4B0B7] mt-0.5 truncate">
            {item.tenant_name || item.client_name || 'Tenant'}
            {item.landlord_name ? ` · ${item.landlord_name}` : ''}
            {item.property_address ? ` · ${item.property_address}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {item.status && (
            <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getAgreementStatusBadge(item.status)}`}>
              {String(item.status).replace(/_/g, ' ')}
            </span>
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
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-sm text-[#A4B0B7] border-t border-[#243041]/30 pt-4 space-y-4">
              {msg && <p className={/failed|required|could not|connect/i.test(msg) ? 'text-rose-400' : 'text-emerald-400'}>{msg}</p>}
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-[#A4B0B7]"><Loader2 size={14} className="animate-spin" /> Loading lease preview…</div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">Lease Number</p>
                      <p className="mt-1 text-sm font-semibold text-white">{record.lease_number || record.agreement_number || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">Rent</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatLeaseMoney(record.monthly_rent, record.currency, '/mo')}</p>
                    </div>
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">Deposit</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatLeaseMoney(record.security_deposit, record.currency)}</p>
                    </div>
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">Duration</p>
                      <p className="mt-1 text-sm font-semibold text-white">{record.duration_label || `${formatDisplayDate(record.start_date)} → ${formatDisplayDate(record.end_date)}`}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">Parties</p>
                      <p className="mt-2 text-sm text-white"><span className="text-[#A4B0B7]">Tenant:</span> {record.tenant_name || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">Landlord:</span> {record.landlord_name || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">Email:</span> {record.client_email || record.tenant_email || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">Phone:</span> {record.client_phone || record.tenant_phone || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">Property</p>
                      <p className="mt-2 text-sm text-white">{record.property_address || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">Type:</span> {record.property_type_label || record.property_type || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">Start:</span> {formatDisplayDate(record.start_date)}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">End:</span> {formatDisplayDate(record.end_date)}</p>
                    </div>
                  </div>

                  {record.content && (
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91] mb-2">Preview</p>
                      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-[#D5DCE7] font-sans">{record.content}</pre>
                    </div>
                  )}

                  <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">AI Review</p>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setBusy('review');
                          setMsg('');
                          try {
                            await smartflowApi.leaseReview(record.id, {});
                            await refreshDetail();
                            setMsg('Lease review refreshed.');
                          } catch (err) {
                            setMsg(err.response?.data?.message || 'Lease review failed.');
                          } finally {
                            setBusy(null);
                          }
                        }}
                        disabled={busy === 'review'}
                        className="text-xs font-semibold text-[#11C7E5] disabled:opacity-60 cursor-pointer"
                      >
                        {busy === 'review' ? 'Refreshing…' : 'Refresh Review'}
                      </button>
                    </div>
                    <AIReviewPanel review={reviewItems} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={downloadPdf} disabled={busy === 'pdf'} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      {busy === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
                    </button>
                    <button onClick={() => setShowSendPanel(s => !s)} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-[#11C7E5] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      <Mail size={12} /> Send for Signature
                    </button>
                    <button onClick={() => setShowSignPanel(s => !s)} disabled={!!busy || record.signature_provider === 'docusign'} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/50 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      <CheckCircle2 size={12} /> Sign
                    </button>
                    <button onClick={() => setShowRenewPanel(s => !s)} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] hover:bg-[#11C7E5]/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      <RefreshCw size={12} /> Renew
                    </button>
                    <button onClick={previewImprove} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-amber-400 hover:bg-amber-950/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      {busy === 'improve' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI Improve
                    </button>
                  </div>

                  {showSendPanel && (
                    <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <Field label="Recipient Name"><input value={recipientName} onChange={e => setRecipientName(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label="Recipient Email"><input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label="Recipient Phone"><input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label="Signature Provider">
                        <select value={signatureProvider} onChange={e => setSignatureProvider(e.target.value)} className={INPUT_CLS}>
                          <option value="native">Native</option>
                          <option value="docusign">DocuSign</option>
                        </select>
                      </Field>
                      {signatureProvider === 'docusign' && (
                        <div className="sm:col-span-2 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-200">
                          <p>DocuSign status: {docusignStatus?.connection_status || 'disconnected'}</p>
                          {!docusignStatus?.connected && (
                            <button onClick={startDocusignConnect} disabled={busy === 'connect-docusign'} className="mt-3 px-3 py-2 rounded-lg bg-[#11C7E5] text-[#02080B] font-bold cursor-pointer disabled:opacity-60">
                              {busy === 'connect-docusign' ? 'Opening…' : 'Connect DocuSign'}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="sm:col-span-2 flex justify-end">
                        <button onClick={sendForSignature} disabled={!!busy} className="px-4 py-3 rounded-xl bg-[#11C7E5] text-[#02080B] font-bold cursor-pointer disabled:opacity-60">
                          {busy === 'send-signature' ? 'Sending…' : 'Send Lease'}
                        </button>
                      </div>
                    </div>
                  )}

                  {showSignPanel && (
                    <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <Field label="Signer Name"><input value={signerName} onChange={e => setSignerName(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label="Signer Email"><input value={signerEmail} onChange={e => setSignerEmail(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label="Signature Text">
                        <textarea value={signatureText} onChange={e => setSignatureText(e.target.value)} className={`${INPUT_CLS} min-h-24 resize-none`} />
                      </Field>
                      <div className="sm:col-span-2 flex justify-end">
                        <button onClick={signLeaseNow} disabled={!!busy} className="px-4 py-3 rounded-xl bg-emerald-500 text-[#03110B] font-bold cursor-pointer disabled:opacity-60">
                          {busy === 'sign' ? 'Signing…' : 'Sign Lease'}
                        </button>
                      </div>
                    </div>
                  )}

                  {showImprovePanel && (
                    <div className="space-y-4 rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Improve Focus">
                          <select value={improveFocus} onChange={e => setImproveFocus(e.target.value)} className={INPUT_CLS}>
                            <option value="balanced">Balanced</option>
                            <option value="tenant">Tenant</option>
                            <option value="landlord">Landlord</option>
                            <option value="compliance">Compliance</option>
                          </select>
                        </Field>
                        <Field label="Custom Terms Preview">
                          <textarea value={improveTerms} onChange={e => setImproveTerms(e.target.value)} className={`${INPUT_CLS} min-h-24 resize-none`} />
                        </Field>
                      </div>
                      {improvePreview && (
                        <div className="rounded-xl border border-[#243246] bg-[#091019] p-4">
                          <p className="text-[11px] uppercase tracking-wider text-[#6E7C91] mb-2">Improved Preview</p>
                          <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-[#D5DCE7] font-sans">{improvePreview}</pre>
                        </div>
                      )}
                      {!!improveReview.length && <AIReviewPanel review={improveReview} />}
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowImprovePanel(false)} className="px-4 py-3 rounded-xl border border-[#243246] text-[#A4B0B7] font-bold cursor-pointer">Discard</button>
                        <button onClick={acceptImprove} disabled={!!busy} className="px-4 py-3 rounded-xl bg-[#11C7E5] text-[#02080B] font-bold cursor-pointer disabled:opacity-60">
                          {busy === 'save-improve' ? 'Saving…' : 'Accept Changes'}
                        </button>
                      </div>
                    </div>
                  )}

                  {showRenewPanel && (
                    <div className="grid gap-4 sm:grid-cols-3 rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <Field label="Renewal Start"><input type="date" value={renewStartDate} onChange={e => setRenewStartDate(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label="Renewal End"><input type="date" value={renewEndDate} onChange={e => setRenewEndDate(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label="Monthly Rent"><input type="number" value={renewRent} onChange={e => setRenewRent(e.target.value)} className={INPUT_CLS} /></Field>
                      <div className="sm:col-span-3 rounded-xl border border-[#243246] bg-[#091019] p-3 text-xs text-[#A4B0B7]">
                        Renewal creates a brand-new lease linked to {record.lease_number || record.agreement_number}.
                      </div>
                      <div className="sm:col-span-3 flex justify-end">
                        <button onClick={renewLeaseNow} disabled={!!busy} className="px-4 py-3 rounded-xl bg-[#11C7E5] text-[#02080B] font-bold cursor-pointer disabled:opacity-60">
                          {busy === 'renew' ? 'Renewing…' : 'Create Renewal Lease'}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AgreementRecordRow({ item, onDelete, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('');
  const [detail, setDetail] = useState(item);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showSendPanel, setShowSendPanel] = useState(false);
  const [showSignPanel, setShowSignPanel] = useState(false);
  const [showImprovePanel, setShowImprovePanel] = useState(false);
  const [recipientName, setRecipientName] = useState(item.client_name || '');
  const [recipientEmail, setRecipientEmail] = useState(item.client_email || '');
  const [signerName, setSignerName] = useState(item.client_name || '');
  const [signerEmail, setSignerEmail] = useState(item.client_email || '');
  const [signatureText, setSignatureText] = useState('');
  const [improveInstruction, setImproveInstruction] = useState('Make more professional');
  const [improvePreview, setImprovePreview] = useState('');
  const [improveReview, setImproveReview] = useState([]);
  const [signatureProvider, setSignatureProvider] = useState(item.signature_provider || 'native');
  const [docusignStatus, setDocusignStatus] = useState(null);

  const record = detail || item;
  const signingToken = extractSigningToken(record.signature_request_url);

  useEffect(() => {
    setDetail(item);
    setRecipientName(item.client_name || '');
    setRecipientEmail(item.client_email || '');
    setSignerName(item.client_name || '');
    setSignerEmail(item.client_email || '');
    setSignatureProvider(item.signature_provider || 'native');
  }, [item]);

  useEffect(() => {
    let ignore = false;
    async function loadDetail() {
      if (!open) return;
      if (record?.content && Array.isArray(record?.ai_review)) return;
      setLoadingDetail(true);
      try {
        const res = await smartflowApi.getAgreement(item.id);
        if (ignore) return;
        const next = res.data?.data || item;
        setDetail(next);
        setRecipientName(next.client_name || '');
        setRecipientEmail(next.client_email || '');
        setSignerName(next.client_name || '');
        setSignerEmail(next.client_email || '');
      } catch (err) {
        if (!ignore) setMsg(err.response?.data?.message || 'Agreement preview failed to load.');
      } finally {
        if (!ignore) setLoadingDetail(false);
      }
    }
    loadDetail();
    return () => { ignore = true; };
  }, [open, item, item.id, record?.content, record?.ai_review]);

  useEffect(() => {
    let ignore = false;
    async function loadDocusignStatus() {
      if (!open) return;
      try {
        const res = await smartflowApi.getAgreementDocusignStatus();
        if (!ignore) setDocusignStatus(res.data?.data || null);
      } catch {
        if (!ignore) setDocusignStatus(null);
      }
    }
    loadDocusignStatus();
    return () => { ignore = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onMessage = async (event) => {
      if (event?.data?.type === 'mabdel-docusign-oauth') {
        const res = await smartflowApi.getAgreementDocusignStatus();
        setDocusignStatus(res.data?.data || null);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open]);

  async function action(label, fn) {
    setBusy(label);
    setMsg('');
    try {
      await fn();
      setMsg(`${label} successful!`);
      onRefresh?.();
    } catch (err) {
      setMsg(err.response?.data?.message || `${label} failed.`);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy('pdf');
    try {
      const res = await smartflowApi.downloadAgreementPdf(item.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.title || record.agreement_number || 'agreement'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg('PDF download failed.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadSignedPdf() {
    setBusy('signed-pdf');
    try {
      const res = await smartflowApi.downloadSignedAgreementPdf(item.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.agreement_number || record.title || 'agreement'}-signed.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Signed PDF download failed.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadCertificate() {
    setBusy('certificate');
    try {
      const res = await smartflowApi.downloadAgreementCompletionCertificate(item.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.agreement_number || record.title || 'agreement'}-certificate.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Completion certificate download failed.');
    } finally {
      setBusy(null);
    }
  }

  async function connectDocusign() {
    try {
      const response = await smartflowApi.startAgreementDocusignOAuth();
      const authUrl = response?.data?.data?.auth_url || response?.data?.auth_url;
      if (!authUrl) {
        setMsg('Did not receive a DocuSign authorization URL from the server.');
        return;
      }
      const popup = window.open(authUrl, 'mabdel-docusign-oauth', 'width=680,height=860,noopener,noreferrer');
      const startedAt = Date.now();
      const timer = window.setInterval(async () => {
        const closed = !popup || popup.closed;
        const expired = Date.now() - startedAt > 10 * 60 * 1000;
        if (!closed && !expired) return;
        window.clearInterval(timer);
        const statusRes = await smartflowApi.getAgreementDocusignStatus();
        setDocusignStatus(statusRes.data?.data || null);
      }, 1500);
    } catch (err) {
      setMsg(err.response?.data?.message || 'DocuSign connection could not be started.');
    }
  }

  async function sendAgreementForSignature() {
    await action('Send Signature', async () => {
      await smartflowApi.agreementSendSignature(item.id, signatureProvider === 'docusign'
        ? {
            provider: 'docusign',
            channel: 'email',
            recipient_name: recipientName.trim() || undefined,
            recipient_email: recipientEmail.trim() || undefined,
            signer_name: recipientName.trim() || undefined,
            signer_email: recipientEmail.trim() || undefined,
          }
        : {
            provider: 'native',
            recipient_name: recipientName.trim() || undefined,
            recipient_email: recipientEmail.trim() || undefined,
            channel: recipientEmail.trim() ? 'email' : 'link',
          });
      const updated = await smartflowApi.getAgreement(item.id);
      setDetail(updated.data?.data || record);
      setShowSendPanel(false);
    });
  }

  async function previewImprovement() {
    if (!record.content?.trim()) {
      setMsg('Agreement content is required before AI improvement.');
      return;
    }
    setBusy('Improve');
    setMsg('');
    try {
      const res = await smartflowApi.improveAgreementDraft({
        content: record.content,
        instruction: improveInstruction.trim() || undefined,
      });
      const data = res.data?.data || {};
      setImprovePreview(data.content || '');
      setImproveReview(Array.isArray(data.ai_review) ? data.ai_review : []);
      setShowImprovePanel(true);
    } catch (err) {
      setMsg(err.response?.data?.message || 'Improve failed.');
    } finally {
      setBusy(null);
    }
  }

  async function acceptImprovement() {
    if (!improvePreview.trim()) return;
    await action('Improve', async () => {
      const res = await smartflowApi.patchAgreement(item.id, { content: improvePreview.trim() });
      setDetail(res.data?.data || record);
      setImprovePreview('');
      setImproveReview([]);
      setShowImprovePanel(false);
    });
  }

  async function signAgreement() {
    if (!signingToken) {
      setMsg('Signing link is not available for this agreement.');
      return;
    }
    if (!signerName.trim() || !signatureText.trim()) {
      setMsg('Signer name and signature text are required.');
      return;
    }
    await action('Sign', async () => {
      await smartflowApi.signPublicAgreement(signingToken, {
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim() || undefined,
        signature_text: signatureText.trim(),
      });
      const updated = await smartflowApi.getAgreement(item.id);
      setDetail(updated.data?.data || record);
      setSignatureText('');
      setShowSignPanel(false);
    });
  }

  return (
    <div className="border-b border-[#243041]/30 last:border-0">
      <div
        className="flex items-center justify-between p-5 hover:bg-[#1C2635]/10 transition-colors cursor-pointer"
        onClick={() => setOpen(o => !o)}
      >
        <div className="min-w-0 flex-1">
          <h3 className="font-bold text-white truncate text-sm">{record.title || record.agreement_number || record.id}</h3>
          <p className="text-xs text-[#A4B0B7] mt-0.5 truncate">
            {record.agreement_type || 'agreement'}
            {record.client_name ? ` · ${record.client_name}` : ''}
            {record.client_email ? ` · ${record.client_email}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {record.status && (
            <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${getAgreementStatusBadge(record.status)}`}>
              {String(record.status).replace(/_/g, ' ')}
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDelete?.(item.id); }}
            className="p-2 text-rose-400 hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
          {open ? <ChevronUp size={16} className="text-[#A4B0B7]" /> : <ChevronDown size={16} className="text-[#A4B0B7]" />}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-sm text-[#A4B0B7] border-t border-[#243041]/30 pt-3 space-y-3">
              {msg && <p className={msg.toLowerCase().includes('failed') ? 'text-rose-400' : 'text-emerald-400'}>{msg}</p>}
              {loadingDetail && <p className="flex items-center gap-2 text-[#11C7E5]"><Loader2 size={14} className="animate-spin" /> Loading agreement details…</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <p>Agreement No: {record.agreement_number || '--'}</p>
                <p>Status: {record.status || '--'}</p>
                <p>Type: {record.agreement_type_label || record.agreement_type || '--'}</p>
                <p>Updated: {record.updated_at ? new Date(record.updated_at).toLocaleString() : '--'}</p>
                <p>Start: {record.start_date || '--'}</p>
                <p>End: {record.end_date || '--'}</p>
                <p>Signature Provider: {record.signature_provider || 'native'}</p>
                <p>Provider Status: {record.provider_status || '--'}</p>
              </div>
              {record.content && <p className="leading-relaxed whitespace-pre-wrap text-[#D5DFEC]">{record.content}</p>}
              {Array.isArray(record.ai_review) && record.ai_review.length > 0 && <AIReviewPanel review={record.ai_review} />}

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={e => { e.stopPropagation(); downloadPdf(); }} disabled={busy === 'pdf'} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  {busy === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} PDF
                </button>
                {record.signed_pdf_url && (
                  <button onClick={e => { e.stopPropagation(); downloadSignedPdf(); }} disabled={busy === 'signed-pdf'} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/25 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-950/40 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy === 'signed-pdf' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Signed PDF
                  </button>
                )}
                {record.completion_certificate_url && (
                  <button onClick={e => { e.stopPropagation(); downloadCertificate(); }} disabled={busy === 'certificate'} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#11C7E5] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy === 'certificate' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Certificate
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); setShowSendPanel(s => !s); }} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-[#11C7E5] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  <Mail size={12} /> Send for Signature
                </button>
                <button onClick={e => { e.stopPropagation(); setShowSignPanel(s => !s); }} disabled={!!busy || record.signature_provider === 'docusign'} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/50 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  <CheckCircle2 size={12} /> Sign
                </button>
                <button onClick={e => { e.stopPropagation(); action('Renew', () => smartflowApi.agreementRenew(item.id, {})); }} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] hover:bg-[#11C7E5]/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  {busy === 'Renew' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Renew
                </button>
                <button onClick={e => { e.stopPropagation(); previewImprovement(); }} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-amber-400 hover:bg-amber-950/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  {busy === 'Improve' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} AI Improve
                </button>
              </div>

              {showSendPanel && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <select value={signatureProvider} onChange={e => setSignatureProvider(e.target.value)} className={INPUT_CLS}>
                    <option value="native">Native signing</option>
                    <option value="docusign">DocuSign</option>
                  </select>
                  <div className="sm:col-span-1 flex items-center text-xs text-[#A4B0B7]">
                    {signatureProvider === 'docusign'
                      ? (docusignStatus?.connected ? `Connected to ${docusignStatus.account_name || 'DocuSign'}` : (docusignStatus?.last_error || 'DocuSign is not connected yet.'))
                      : 'Use the existing Mabdel signing link flow.'}
                  </div>
                  <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder="Recipient name" className={INPUT_CLS} />
                  <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder="Recipient email" className={INPUT_CLS} />
                  {signatureProvider === 'docusign' && !docusignStatus?.connected && (
                    <button onClick={connectDocusign} type="button" className="sm:col-span-2 py-3 border border-[#11C7E5]/30 text-[#11C7E5] rounded-xl font-bold cursor-pointer">
                      Connect DocuSign
                    </button>
                  )}
                  <button onClick={sendAgreementForSignature} disabled={!!busy || (signatureProvider === 'docusign' && !docusignStatus?.connected)} className="sm:col-span-2 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold disabled:opacity-60 cursor-pointer">
                    Confirm Send for Signature
                  </button>
                </div>
              )}

              {showSignPanel && (
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Signer name" className={INPUT_CLS} />
                  <input value={signerEmail} onChange={e => setSignerEmail(e.target.value)} placeholder="Signer email" className={INPUT_CLS} />
                  <textarea value={signatureText} onChange={e => setSignatureText(e.target.value)} placeholder="Type your signature" className={`${INPUT_CLS} min-h-24 resize-none`} />
                  <button onClick={signAgreement} disabled={!!busy || !signingToken} className="py-3 bg-emerald-500 text-[#04120d] rounded-xl font-bold disabled:opacity-60 cursor-pointer">
                    Complete Signature
                  </button>
                </div>
              )}

              {showImprovePanel && (
                <div className="space-y-3 pt-2">
                  <input value={improveInstruction} onChange={e => setImproveInstruction(e.target.value)} placeholder="Improve instruction" className={INPUT_CLS} />
                  {improvePreview ? <textarea value={improvePreview} readOnly className={`${INPUT_CLS} min-h-36 resize-none`} /> : null}
                  {improveReview.length ? <AIReviewPanel review={improveReview} /> : null}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={acceptImprovement} disabled={!!busy || !improvePreview.trim()} className="px-4 py-2.5 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold disabled:opacity-60 cursor-pointer">
                      Accept Improvement
                    </button>
                    <button onClick={() => { setShowImprovePanel(false); setImprovePreview(''); setImproveReview([]); }} className="px-4 py-2.5 border border-[#243246] text-[#A4B0B7] rounded-xl font-bold cursor-pointer">
                      Discard
                    </button>
                  </div>
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
  const location = useLocation();
  const navigate = useNavigate();

  const [active, setActive]         = useState('leases');
  const [documents, setDocuments]   = useState([]);
  const [leases, setLeases]         = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [prefillData, setPrefillData] = useState(null);
  const [leaseSearch, setLeaseSearch] = useState('');
  const [agreementSearch, setAgreementSearch] = useState('');
  const fetchVersionRef = useRef(0);

  useEffect(() => {
    if (location.state?.tab && tabs.some(tab => tab.id === location.state.tab)) {
      setActive(location.state.tab);
    }

    if (location.state?.prefill || location.state?.tab) {
      const prefill = location.state.prefill;
      setPrefillData(prefill || null);
      if (prefill?.type === 'lease' || location.state.action === 'new_lease') {
        setActive('leases');
      } else if (prefill?.type === 'agreement' || location.state.action === 'new_agreement') {
        setActive('agreements');
      }
      if (location.state?.prefill || location.state?.action?.startsWith('new_')) {
        setShowCreate(true);
      }
      // Clear state so it doesn't trigger on every re-render
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const fetchAll = useCallback(async () => {
    const fetchVersion = ++fetchVersionRef.current;
    try {
      setLoading(true);
      setError('');
      if (active === 'leases') setLeases([]);
      if (active === 'agreements') setAgreements([]);
      const docsPromise = smartflowApi.getDocuments();
      const leasesPromise = smartflowApi.getLeases({ page: 1, page_size: 100, search: leaseSearch.trim() || undefined });
      const agreementsPromise = smartflowApi.getAgreements({ page: 1, page_size: 100, search: agreementSearch.trim() || undefined });

      if (active === 'leases') {
        const leaseList = await leasesPromise;
        if (fetchVersion !== fetchVersionRef.current) return;
        setLeases(leaseList.data?.data?.items || leaseList.data?.data || []);
        setLoading(false);
        Promise.allSettled([docsPromise, agreementsPromise]).then(([docs, agreementList]) => {
          if (fetchVersion !== fetchVersionRef.current) return;
          if (docs.status === 'fulfilled') {
            setDocuments(docs.value.data?.data?.items || docs.value.data?.data || []);
          }
          if (agreementList.status === 'fulfilled') {
            setAgreements(agreementList.value.data?.data?.items || agreementList.value.data?.data || []);
          }
        });
        return;
      }

      if (active === 'agreements') {
        const agreementList = await agreementsPromise;
        if (fetchVersion !== fetchVersionRef.current) return;
        setAgreements(agreementList.data?.data?.items || agreementList.data?.data || []);
        setLoading(false);
        Promise.allSettled([docsPromise, leasesPromise]).then(([docs, leaseList]) => {
          if (fetchVersion !== fetchVersionRef.current) return;
          if (docs.status === 'fulfilled') {
            setDocuments(docs.value.data?.data?.items || docs.value.data?.data || []);
          }
          if (leaseList.status === 'fulfilled') {
            setLeases(leaseList.value.data?.data?.items || leaseList.value.data?.data || []);
          }
        });
        return;
      }

      const [docs, leaseList, agreementList] = await Promise.allSettled([docsPromise, leasesPromise, agreementsPromise]);
      if (fetchVersion !== fetchVersionRef.current) return;
      setDocuments(docs.status === 'fulfilled' ? (docs.value.data?.data?.items || docs.value.data?.data || []) : []);
      setLeases(leaseList.status === 'fulfilled' ? (leaseList.value.data?.data?.items || leaseList.value.data?.data || []) : []);
      setAgreements(agreementList.status === 'fulfilled' ? (agreementList.value.data?.data?.items || agreementList.value.data?.data || []) : []);

      if (docs.status === 'rejected' && leaseList.status === 'rejected' && agreementList.status === 'rejected') {
        console.error('Documents page data requests failed.', {
          documents: docs.reason,
          leases: leaseList.reason,
          agreements: agreementList.reason,
        });
      }
    } catch (err) {
      console.error('Documents page fetch crashed.', err);
    } finally { setLoading(false); }
  }, [active, agreementSearch, leaseSearch]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (active === 'leases') setLoading(false);
  }, [active, leases]);

  useEffect(() => {
    if (active === 'agreements') setLoading(false);
  }, [active, agreements]);

  useEffect(() => {
    if (active === 'documents') setLoading(false);
  }, [active, documents]);

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

  async function deleteAgreement(id) {
    try { await smartflowApi.deleteAgreement(id); fetchAll(); }
    catch (err) { setError(err.response?.data?.message || 'Delete failed.'); }
  }

  async function deleteLease(id) {
    if (!window.confirm('Are you sure you want to delete this lease?')) return;
    try { await smartflowApi.deleteLease(id); fetchAll(); }
    catch (err) { setError(err.response?.data?.message || 'Delete failed.'); }
  }

  const showForm = active === 'leases' || active === 'agreements';

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
          {showCreate ? 'Close Form' : active === 'leases' ? 'New Lease' : 'New Agreement'}
        </button>
      </div>

      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => navigate('/invoices')}
          className="px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent"
        >
          <FileText size={16} />
          Invoice
        </button>
        <button
          onClick={() => navigate('/create-post')}
          className="px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent"
        >
          <PenLine size={16} />
          Create Post
        </button>
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
                {tab.id === 'leases' ? leases.length : agreements.length}
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
          </div>
          {(active === 'agreements' || active === 'leases') && (
            <div className="p-5 border-b border-[#243041]/30">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A4B0B7]" />
                <input
                  value={active === 'leases' ? leaseSearch : agreementSearch}
                  onChange={e => active === 'leases' ? setLeaseSearch(e.target.value) : setAgreementSearch(e.target.value)}
                  placeholder={active === 'leases'
                    ? 'Search leases by title, number, tenant, landlord, property, email, phone, or status'
                    : 'Search agreements by title, number, client, or email'}
                  className={`${INPUT_CLS} pl-10`}
                />
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-12 flex items-center justify-center gap-3 text-[#A4B0B7]/60 text-sm">
              <Loader2 size={20} className="animate-spin" /> Loading…
            </div>
          ) : rows.length ? (
            <div className="divide-y divide-[#243041]/30">
              {rows.map(item => (
                active === 'agreements'
                  ? <AgreementRecordRow key={item.id || item._id} item={item} onDelete={deleteAgreement} onRefresh={fetchAll} />
                  : active === 'leases'
                    ? <LeaseRecordRow key={item.id || item._id} item={item} onDelete={deleteLease} onRefresh={fetchAll} />
                    : null
              ))}
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center mx-auto mb-4">
                {active === 'leases' ? <ScrollText size={24} className="text-[#11C7E5]" /> : <FileCheck2 size={24} className="text-[#11C7E5]" />}
              </div>
              <p className="text-white font-bold">No {tabs.find(t => t.id === active)?.label.toLowerCase()} yet</p>
              <p className="text-[#A4B0B7] text-sm mt-1">
                {`Click "${active === 'leases' ? 'New Lease' : 'New Agreement'}" to create one with AI.`}
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
              {active === 'agreements' && <AgreementCreator onCreated={() => { fetchAll(); setShowCreate(false); }} prefill={prefillData} />}
              {active === 'leases' && <LeaseCreator onCreated={() => { fetchAll(); setShowCreate(false); }} prefill={prefillData} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}



