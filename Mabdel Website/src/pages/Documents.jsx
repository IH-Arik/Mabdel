import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronUp,
  CircleAlert, Download, FileCheck2, FileText, House, Loader2, Mail, PenLine,
  Plus, RefreshCw, ScrollText, Sparkles, Trash2, Users, Wallet, X,
  Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../api/services';
import { formatCalendarDate, formatCstDateTime } from '../utils/dateUtils';
import VoiceFormFillModal from '../components/Documents/VoiceFormFillModal';
import { DatePickerInput } from '../components/ui/DateTimeInputs';
import { useLanguage } from '../context/LanguageContext';

// ── Tab definition ─────────────────────────────────────────────────────────────
const tabs = [
  { id: 'leases',     labelKey: 'docs_tab_leases',      icon: ScrollText },
  { id: 'agreements', labelKey: 'docs_tab_agreements',  icon: FileCheck2 },
];

// ── Small helpers ──────────────────────────────────────────────────────────────
const INPUT_CLS = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#9333ea]/50 transition-colors text-sm placeholder:text-[#4A5568]';
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
      <Icon size={18} className="text-[#9333ea]" />
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
  return formatCalendarDate(dt);
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
  const { t } = useLanguage();
  if (!review?.length) return (
    <div className="p-4 text-[#A4B0B7] text-sm text-center">
      {t('docs_no_review_yet')}
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
  const { t } = useLanguage();
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
      setError(err.response?.data?.message || t('docs_err_ai_gen_failed'));
    } finally {
      setGenerating(false);
    }
  }, [t]);

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
    if (!prompt.trim()) { setError(t('docs_err_enter_prompt')); return; }
    await generateDraftWithValues({
      nextPrompt: prompt,
      nextTitle: form.title,
      nextClientName: form.client_name,
      nextAgreementType: form.agreement_type,
    });
  }

  async function runReview() {
    if (!content.trim()) { setError(t('docs_err_write_content_first')); return; }
    setError(''); setReviewing(true);
    try {
      const res = await smartflowApi.reviewAgreement({ content: content.trim(), agreement_type: form.agreement_type });
      const data = res.data?.data;
      setAiReview(Array.isArray(data?.ai_review) ? data.ai_review : Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || t('docs_err_ai_review_failed'));
    } finally { setReviewing(false); }
  }

  async function handleCreate() {
    if (!form.title.trim() || !form.client_name.trim() || !content.trim()) {
      setError(t('docs_err_required_fields')); return;
    }
    setError(''); setCreating(true);
    try {
      await smartflowApi.createAgreement({
        ...form,
        start_date: normalizeDate(form.start_date),
        content: content.trim(),
        status: signatureEnabled ? 'pending_signature' : 'draft',
      });
      setSuccess(t('docs_msg_agreement_created'));
      setForm({ title: '', client_name: '', client_email: '', client_phone: '', agreement_type: 'contract', start_date: '' });
      setPrompt(''); setContent(''); setAiReview([]);
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || t('docs_err_create_agreement_failed'));
    } finally { setCreating(false); }
  }

  return (
    <div className="space-y-5">
      {error   && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2"><AlertTriangle size={14} />{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2"><CheckCircle2 size={14} />{success}</div>}

      {/* Basic Info */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={CircleAlert} title={t('docs_agreement_basic_info')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('docs_agreement_title')}>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder={t('docs_ph_website_design')} className={INPUT_CLS} />
          </Field>
          <Field label={t('docs_agreement_type')}>
            <select value={form.agreement_type} onChange={e => set('agreement_type', e.target.value)} className={INPUT_CLS}>
              <option value="contract">{t('docs_type_contract')}</option>
              <option value="nda">{t('docs_type_nda')}</option>
              <option value="service">{t('docs_type_service')}</option>
              <option value="lease">{t('docs_type_lease')}</option>
              <option value="legal">{t('docs_type_legal')}</option>
            </select>
          </Field>
          <Field label={t('docs_client_name')}>
            <input value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder={t('docs_ph_enter_client_name')} className={INPUT_CLS} />
          </Field>
          <Field label={t('docs_client_email')}>
            <input value={form.client_email} onChange={e => set('client_email', e.target.value)} placeholder="email@example.com" className={INPUT_CLS} />
          </Field>
          <Field label={t('docs_client_phone')}>
            <input value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+1 234 567 890" className={INPUT_CLS} />
          </Field>
          <Field label={t('docs_date')}>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>
      </div>

      {/* AI Generate */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={Sparkles} title={t('docs_generate_with_ai')} />
        <div className="relative">
          <textarea
            value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder={t('docs_ph_agreement_prompt')}
            className={`${INPUT_CLS} min-h-28 resize-none pr-12`}
          />
          <VoiceFormFillModal
            workflowIntent="agreement"
            label="Agreement"
            currentValues={{ ...form, prompt, content }}
            onApply={applyVoicePrefill}
            buttonClassName="absolute bottom-4 right-4 text-[#9333ea] hover:text-white transition-colors"
          />
        </div>
        <button
          onClick={runGenerate} disabled={generating}
          className="mt-3 w-full py-3.5 bg-[#9333ea] text-[#02080B] hover:bg-[#a855f7] rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {generating ? t('docs_generating') : t('docs_btn_generate_agreement')}
        </button>
      </div>

      {/* Content + AI Review */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={PenLine} title={t('docs_agreement_content')} />
        <textarea
          value={content} onChange={e => setContent(e.target.value)}
          placeholder={t('docs_ph_agreement_content')}
          className={`${INPUT_CLS} min-h-48 resize-none font-mono`}
        />
        <button
          onClick={runReview} disabled={reviewing}
          className="mt-3 w-full py-3 border border-[#9333ea]/30 text-[#9333ea] hover:bg-[#9333ea]/10 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {reviewing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {reviewing ? t('docs_reviewing') : t('docs_btn_run_ai_review')}
        </button>
      </div>

      {/* AI Review Results */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 bg-[#0C1420] border-b border-[#243041]/40">
          <Sparkles size={16} className="text-[#9333ea]" />
          <span className="text-white font-bold text-sm">{t('docs_ai_review')}</span>
          {aiReview.length > 0 && <span className="ml-auto text-xs text-[#A4B0B7]">{t('docs_review_items_count', { n: aiReview.length })}</span>}
        </div>
        <div className="p-4">
          <AIReviewPanel review={aiReview} />
        </div>
      </div>

      {/* Signature toggle + Create button */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5 flex items-center justify-between">
        <span className="text-white font-semibold text-sm">{t('docs_require_signature')}</span>
        <button
          onClick={() => setSig(s => !s)}
          className={`relative w-12 h-6 rounded-full transition-colors ${signatureEnabled ? 'bg-[#9333ea]' : 'bg-[#243041]'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${signatureEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <button
        onClick={handleCreate} disabled={creating}
        className="w-full py-4 bg-[#9333ea] text-[#02080B] hover:bg-[#a855f7] rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer text-base"
      >
        {creating ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
        {creating ? t('docs_creating') : signatureEnabled ? t('docs_btn_send_signature') : t('docs_btn_save_draft')}
      </button>
    </div>
  );
}

function SigToggle({ label, icon: Icon, value, onChange }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 bg-[#0A1019] border border-[#243246] rounded-xl">
      <span className="flex items-center gap-2.5 text-white text-sm font-semibold"><Icon size={16} className="text-[#A4B0B7]" />{label}</span>
      <button onClick={() => onChange(!value)} className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-[#9333ea]' : 'bg-[#243041]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

// ── Lease Creator ──────────────────────────────────────────────────────────────
function LeaseCreator({ onCreated, prefill }) {
  const { t } = useLanguage();
  const [prompt, setPrompt]       = useState(prefill?.prompt || '');
  const [address, setAddress]     = useState(prefill?.address || prefill?.property_address || '');
  const [propType, setPropType]   = useState(prefill?.propType || prefill?.property_type || 'apartment');
  const [selfRole, setSelfRole]   = useState(prefill?.self_role || 'landlord');
  const [landlord, setLandlord]   = useState(prefill?.landlord || prefill?.landlord_name || '');
  const [landlordEmail, setLandlordEmail] = useState(prefill?.landlordEmail || prefill?.landlord_email || '');
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
    self_role: selfRole,
    landlord_name: landlord.trim() || undefined,
    landlord_email: landlordEmail.trim() || undefined,
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
    if (!prompt.trim()) { setError(t('docs_err_enter_lease_prompt')); return; }
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
      setError(err.response?.data?.message || t('docs_err_ai_lease_failed'));
    } finally { setGenerating(false); }
  }

  async function handleCreate() {
    const otherPartyName = selfRole === 'landlord' ? tenant : landlord;
    if (!address.trim() || !otherPartyName.trim() || !rent) {
      setError(selfRole === 'landlord' ? t('docs_err_lease_required_tenant') : t('docs_err_lease_required_landlord')); return;
    }
    setError(''); setCreating(true);
    try {
      await smartflowApi.createLease(buildPayload());
      setSuccess(t('docs_msg_lease_created'));
      setPrompt(''); setAddress(''); setLandlord(''); setLandlordEmail(''); setTenant('');
      setTenantEmail(''); setTenantPhone(''); setRent(''); setDeposit('');
      setStartDate(''); setEndDate(''); setTerms(''); setSelfRole('landlord');
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || t('docs_err_create_lease_failed'));
    } finally { setCreating(false); }
  }

  return (
    <div className="space-y-5">
      {error   && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex items-center gap-2"><AlertTriangle size={14} />{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex items-center gap-2"><CheckCircle2 size={14} />{success}</div>}

      {/* AI Generate */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <p className="text-[#9333ea] text-xs font-bold uppercase tracking-widest mb-3">{t('docs_generate_lease_ai')}</p>
        <div className="relative">
          <textarea
            value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder={t('docs_ph_lease_prompt')}
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
            buttonClassName="absolute bottom-4 right-4 text-[#9333ea] hover:text-white transition-colors"
          />
        </div>
        <button
          onClick={runGenerate} disabled={generating}
          className="mt-3 w-full py-3.5 bg-[#9333ea] text-[#02080B] hover:bg-[#a855f7] rounded-xl font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {generating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
          {generating ? t('docs_generating') : t('docs_btn_generate_lease')}
        </button>
      </div>

      {/* Property Details */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={House} title={t('docs_property_details')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('docs_property_address')}>
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder={t('docs_ph_address')} className={INPUT_CLS} />
          </Field>
          <Field label={t('docs_property_type')}>
            <select value={propType} onChange={e => setPropType(e.target.value)} className={INPUT_CLS}>
              <option value="apartment">{t('docs_prop_apartment')}</option>
              <option value="house">{t('docs_prop_house')}</option>
              <option value="commercial">{t('docs_prop_commercial')}</option>
              <option value="studio">{t('docs_prop_studio')}</option>
              <option value="villa">{t('docs_prop_villa')}</option>
            </select>
          </Field>
        </div>
      </div>

      {/* Parties Info */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={Users} title={t('docs_parties_info')} />
        <Field label={t('docs_signing_as')}>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSelfRole('landlord')}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${selfRole === 'landlord' ? 'bg-[#9333ea]/10 border-[#9333ea] text-[#9333ea]' : 'bg-[#0A1019] border-[#243246] text-[#A4B0B7]'}`}
            >
              {t('docs_landlord')}
            </button>
            <button
              type="button"
              onClick={() => setSelfRole('tenant')}
              className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${selfRole === 'tenant' ? 'bg-[#9333ea]/10 border-[#9333ea] text-[#9333ea]' : 'bg-[#0A1019] border-[#243246] text-[#A4B0B7]'}`}
            >
              {t('docs_tenant')}
            </button>
          </div>
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Field label={selfRole === 'landlord' ? t('docs_landlord_name_you') : t('docs_landlord_name')}>
            <input value={landlord} onChange={e => setLandlord(e.target.value)} placeholder="e.g. John Doe" className={INPUT_CLS} />
          </Field>
          <Field label={selfRole === 'landlord' ? t('docs_landlord_email_hint') : t('docs_landlord_email')}>
            <input value={landlordEmail} onChange={e => setLandlordEmail(e.target.value)} placeholder="email@example.com" className={INPUT_CLS} />
          </Field>
          <Field label={selfRole === 'tenant' ? t('docs_tenant_name_you') : t('docs_tenant_name')}>
            <input value={tenant} onChange={e => setTenant(e.target.value)} placeholder="e.g. Jane Smith" className={INPUT_CLS} />
          </Field>
          <Field label={selfRole === 'tenant' ? t('docs_tenant_email_hint') : t('docs_tenant_email')}>
            <input value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} placeholder="email@example.com" className={INPUT_CLS} />
          </Field>
          <Field label={t('docs_tenant_phone')}>
            <input value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} placeholder="+1 234 567 890" className={INPUT_CLS} />
          </Field>
        </div>
      </div>

      {/* Payment Details */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={Wallet} title={t('docs_payment_details')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('docs_monthly_rent')}>
            <input type="number" value={rent} onChange={e => setRent(e.target.value)} placeholder="2500" className={INPUT_CLS} />
          </Field>
          <Field label={t('docs_security_deposit')}>
            <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="5000" className={INPUT_CLS} />
          </Field>
        </div>
      </div>

      {/* Lease Duration */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={CalendarDays} title={t('docs_lease_duration')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label={t('docs_start_date')}>
            <DatePickerInput value={startDate} onChange={setStartDate} className="focus:border-[#9333ea]/50" />
          </Field>
          <Field label={t('docs_end_date')}>
            <DatePickerInput value={endDate} onChange={setEndDate} className="focus:border-[#9333ea]/50" />
          </Field>
        </div>
      </div>

      {/* Lease Terms */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5">
        <SectionHeader icon={PenLine} title={t('docs_lease_terms')} />
        <textarea
          value={terms} onChange={e => setTerms(e.target.value)}
          placeholder={t('docs_ph_lease_terms')}
          className={`${INPUT_CLS} min-h-32 resize-none`}
        />
      </div>

      {/* Signature Fields */}
      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-5 space-y-3">
        <SectionHeader icon={PenLine} title={t('docs_signature_fields')} />
        <SigToggle label={t('docs_tenant_signature')} icon={Users} value={tenantSig} onChange={setTenantSig} />
        <SigToggle label={t('docs_landlord_signature')} icon={Building2} value={landlordSig} onChange={setLandlordSig} />
      </div>

      <button
        onClick={handleCreate} disabled={creating}
        className="w-full py-4 bg-[#9333ea] text-[#02080B] hover:bg-[#a855f7] rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer text-base"
      >
        {creating ? <Loader2 size={20} className="animate-spin" /> : <ScrollText size={20} />}
        {creating ? t('docs_creating') : t('docs_btn_preview_lease')}
      </button>
    </div>
  );
}

// ── Record row ────────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
function RecordRow({ item, type, onDelete, onRefresh }) {
  const { t } = useLanguage();
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
    } catch { setMsg(t('docs_err_pdf_download_failed')); }
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
              {item.file_url && <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="text-[#9333ea] hover:underline">{t('docs_view_file')}</a>}

              {/* Action buttons for lease/agreement */}
              {showActions && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button onClick={e=>{e.stopPropagation();downloadPdf();}} disabled={busy==='pdf'}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='pdf' ? <Loader2 size={12} className="animate-spin"/> : <Download size={12}/>} {t('docs_btn_pdf')}
                  </button>
                  <button onClick={e=>{e.stopPropagation(); action('Send Signature', ()=>(isLease ? smartflowApi.leaseSendSignature(item.id,{}) : smartflowApi.agreementSendSignature(item.id,{})));}} disabled={!!busy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-[#9333ea] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='Send Signature' ? <Loader2 size={12} className="animate-spin"/> : <Mail size={12}/>} {t('docs_btn_send_for_signature')}
                  </button>
                  <button onClick={e=>{e.stopPropagation(); action('Sign', ()=>(isLease ? smartflowApi.leaseSign(item.id,{signature:'web'}) : smartflowApi.agreementSign(item.id,{signature:'web'})));}} disabled={!!busy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/50 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='Sign' ? <Loader2 size={12} className="animate-spin"/> : <CheckCircle2 size={12}/>} {t('docs_btn_sign')}
                  </button>
                  <button onClick={e=>{e.stopPropagation(); action('Renew', ()=>(isLease ? smartflowApi.leaseRenew(item.id,{}) : smartflowApi.agreementRenew(item.id,{})));}} disabled={!!busy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#9333ea]/10 border border-[#9333ea]/20 text-[#9333ea] hover:bg-[#9333ea]/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='Renew' ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>} {t('docs_btn_renew')}
                  </button>
                  <button onClick={e=>{e.stopPropagation(); action('Improve', ()=>(isLease ? smartflowApi.leaseEnhanceTerms(item.id,{}) : smartflowApi.agreementImprove(item.id,{})));}} disabled={!!busy}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-amber-400 hover:bg-amber-950/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy==='Improve' ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} {t('docs_btn_ai_improve')}
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
  const { t } = useLanguage();
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
  const otherParty = record.self_role === 'tenant'
    ? { role: t('docs_landlord'), name: record.landlord_name, email: record.landlord_email }
    : { role: t('docs_tenant'), name: record.tenant_name || record.client_name, email: record.tenant_email || record.client_email };

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
        if (!ignore) setMsg(err.response?.data?.message || t('docs_err_lease_preview_failed'));
      } finally {
        if (!ignore) setLoadingDetail(false);
      }
    }
    loadDetail();
    return () => { ignore = true; };
  }, [open, item, item.id, t]);

  useEffect(() => {
    if (!open || record.signature_provider !== 'docusign' || record.status !== 'pending_signature') return undefined;
    const interval = window.setInterval(async () => {
      try {
        const res = await smartflowApi.getLease(item.id);
        const next = res.data?.data;
        if (next) {
          setDetail(next);
          onRefresh?.();
        }
      } catch {
        // Ignore transient polling errors
      }
    }, 15000);
    return () => window.clearInterval(interval);
  }, [open, record.signature_provider, record.status, item.id, onRefresh]);

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
      if (!authUrl) throw new Error(t('docs_err_docusign_conn_failed'));
      const popup = window.open(authUrl, 'mabdel-docusign-oauth', 'width=680,height=860');
      setMsg(t('docs_msg_docusign_window_opened'));
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
      setMsg(err.response?.data?.message || err.message || t('docs_err_docusign_conn_failed'));
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
      setMsg(err.response?.data?.message || t('docs_err_pdf_download_failed'));
    } finally {
      setBusy(null);
    }
  }

  async function downloadSignedPdf() {
    setBusy('signed-pdf');
    try {
      const res = await smartflowApi.downloadSignedLeasePdf(record.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.lease_number || record.title || 'lease'}-signed.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.response?.data?.message || t('docs_err_signed_pdf_failed'));
    } finally {
      setBusy(null);
    }
  }

  async function downloadCertificate() {
    setBusy('certificate');
    try {
      const res = await smartflowApi.downloadLeaseCompletionCertificate(record.id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${record.lease_number || record.title || 'lease'}-certificate.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setMsg(err.response?.data?.message || t('docs_err_certificate_failed'));
    } finally {
      setBusy(null);
    }
  }

  async function sendForSignature() {
    if (signatureProvider === 'docusign' && !docusignStatus?.connected) {
      setMsg(t('docs_err_connect_docusign_first'));
      return;
    }
    setBusy('send-signature');
    setMsg('');
    try {
      const res = await smartflowApi.leaseSendSignature(record.id, signatureProvider === 'docusign'
        ? { provider: 'docusign', channel: 'email' }
        : {
            recipient_name: recipientName.trim() || undefined,
            recipient_email: recipientEmail.trim() || undefined,
            recipient_phone: recipientPhone.trim() || undefined,
            channel: recipientEmail.trim() ? 'email' : 'link',
            provider: signatureProvider,
          });
      const ownSigningUrl = res.data?.data?.signature_request_url;
      await refreshDetail();
      onRefresh?.();
      setShowSendPanel(false);
      if (signatureProvider === 'docusign' && ownSigningUrl) {
        setMsg(t('docs_msg_sent_sign_popup'));
        const popup = window.open(ownSigningUrl, 'mabdel-docusign-self-sign', 'width=800,height=900');
        const startedAt = Date.now();
        const timer = window.setInterval(async () => {
          const closed = !popup || popup.closed;
          const expired = Date.now() - startedAt > 20 * 60 * 1000;
          if (!closed && !expired) return;
          window.clearInterval(timer);
          await refreshDetail();
          onRefresh?.();
        }, 1500);
      } else {
        setMsg(t('docs_msg_lease_sent_sig'));
      }
    } catch (err) {
      setMsg(err.response?.data?.message || t('docs_err_send_sig_failed'));
    } finally {
      setBusy(null);
    }
  }

  async function signLeaseNow() {
    if (!signerName.trim() || !signatureText.trim()) {
      setMsg(t('docs_err_signer_required'));
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
      setMsg(t('docs_msg_lease_signed'));
    } catch (err) {
      setMsg(err.response?.data?.message || t('docs_err_lease_signing_failed'));
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
      setMsg(t('docs_msg_ai_preview_ready'));
    } catch (err) {
      setMsg(err.response?.data?.message || t('docs_err_ai_improve_failed'));
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
      setMsg(t('docs_msg_lease_improvements_saved'));
    } catch (err) {
      setMsg(err.response?.data?.message || t('docs_err_save_improvements_failed'));
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
      setMsg(t('docs_msg_lease_renewed', { leaseNumber: renewedLease?.lease_number || renewedLease?.agreement_number || 'a new lease' }));
    } catch (err) {
      setMsg(err.response?.data?.message || t('docs_err_lease_renewal_failed'));
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
            {item.tenant_name || item.client_name || t('docs_tenant')}
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
                <div className="flex items-center gap-2 text-[#A4B0B7]"><Loader2 size={14} className="animate-spin" /> {t('docs_loading_lease_preview')}</div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">{t('docs_lbl_lease_number')}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{record.lease_number || record.agreement_number || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">{t('docs_lbl_rent')}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatLeaseMoney(record.monthly_rent, record.currency, '/mo')}</p>
                    </div>
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">{t('docs_lbl_deposit')}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatLeaseMoney(record.security_deposit, record.currency)}</p>
                    </div>
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">{t('docs_lbl_duration')}</p>
                      <p className="mt-1 text-sm font-semibold text-white">{record.duration_label || `${formatDisplayDate(record.start_date)} → ${formatDisplayDate(record.end_date)}`}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">{t('docs_lbl_parties')}</p>
                      <p className="mt-2 text-sm text-white"><span className="text-[#A4B0B7]">{t('docs_tenant')}:</span> {record.tenant_name || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">{t('docs_landlord')}:</span> {record.landlord_name || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">{t('docs_email_label')}:</span> {record.client_email || record.tenant_email || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">{t('docs_phone_label')}:</span> {record.client_phone || record.tenant_phone || '—'}</p>
                    </div>
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">{t('docs_lbl_property')}</p>
                      <p className="mt-2 text-sm text-white">{record.property_address || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">{t('docs_lbl_type_colon')}</span> {record.property_type_label || record.property_type || '—'}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">{t('docs_lbl_start_colon')}</span> {formatDisplayDate(record.start_date)}</p>
                      <p className="mt-1 text-sm text-white"><span className="text-[#A4B0B7]">{t('docs_lbl_end_colon')}</span> {formatDisplayDate(record.end_date)}</p>
                    </div>
                  </div>

                  {record.content && (
                    <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91] mb-2">{t('docs_lbl_preview')}</p>
                      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-[#D5DCE7] font-sans">{record.content}</pre>
                    </div>
                  )}

                  <div className="rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <p className="text-[11px] uppercase tracking-wider text-[#6E7C91]">{t('docs_ai_review')}</p>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setBusy('review');
                          setMsg('');
                          try {
                            await smartflowApi.leaseReview(record.id, {});
                            await refreshDetail();
                            setMsg(t('docs_msg_lease_review_refreshed'));
                          } catch (err) {
                            setMsg(err.response?.data?.message || t('docs_err_lease_review_failed'));
                          } finally {
                            setBusy(null);
                          }
                        }}
                        disabled={busy === 'review'}
                        className="text-xs font-semibold text-[#9333ea] disabled:opacity-60 cursor-pointer"
                      >
                        {busy === 'review' ? t('docs_refreshing') : t('docs_btn_refresh_review')}
                      </button>
                    </div>
                    <AIReviewPanel review={reviewItems} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={downloadPdf} disabled={busy === 'pdf'} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      {busy === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} {t('docs_btn_pdf')}
                    </button>
                    {record.signed_pdf_url && (
                      <button onClick={downloadSignedPdf} disabled={busy === 'signed-pdf'} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/25 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-950/40 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                        {busy === 'signed-pdf' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} {t('docs_btn_signed_pdf')}
                      </button>
                    )}
                    {record.completion_certificate_url && (
                      <button onClick={downloadCertificate} disabled={busy === 'certificate'} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#9333ea] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                        {busy === 'certificate' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} {t('docs_btn_certificate')}
                      </button>
                    )}
                    <button onClick={() => setShowSendPanel(s => !s)} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-[#9333ea] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      <Mail size={12} /> {t('docs_btn_send_for_signature')}
                    </button>
                    <button onClick={() => setShowSignPanel(s => !s)} disabled={!!busy || record.signature_provider === 'docusign'} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/50 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      <CheckCircle2 size={12} /> {t('docs_btn_sign')}
                    </button>
                    <button onClick={() => setShowRenewPanel(s => !s)} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#9333ea]/10 border border-[#9333ea]/20 text-[#9333ea] hover:bg-[#9333ea]/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      <RefreshCw size={12} /> {t('docs_btn_renew')}
                    </button>
                    <button onClick={previewImprove} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-amber-400 hover:bg-amber-950/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                      {busy === 'improve' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {t('docs_btn_ai_improve')}
                    </button>
                  </div>

                  {showSendPanel && (
                    <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <Field label={t('docs_signature_provider')}>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setSignatureProvider('native')}
                            className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${signatureProvider === 'native' ? 'bg-[#9333ea]/10 border-[#9333ea] text-[#9333ea]' : 'bg-[#0A1019] border-[#243246] text-[#A4B0B7]'}`}
                          >
                            {t('docs_sig_provider_native')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setSignatureProvider('docusign')}
                            className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${signatureProvider === 'docusign' ? 'bg-[#9333ea]/10 border-[#9333ea] text-[#9333ea]' : 'bg-[#0A1019] border-[#243246] text-[#A4B0B7]'}`}
                          >
                            {t('docs_sig_provider_docusign')}
                          </button>
                        </div>
                      </Field>
                      <div />
                      {signatureProvider === 'docusign' ? (
                        <div className="sm:col-span-2 rounded-xl border border-[#243246] bg-[#131A24] p-3 text-xs text-[#A4B0B7]">
                          <p>{t('docs_docusign_flow_hint', { role: String(otherParty.role).toLowerCase() })}</p>
                          <p className="mt-1 text-white font-semibold">{otherParty.role}: {otherParty.name || '—'} · {otherParty.email || 'no email on file'}</p>
                          {!otherParty.email && <p className="mt-1 text-amber-300">{t('docs_docusign_add_email_warning', { role: String(otherParty.role).toLowerCase() })}</p>}
                        </div>
                      ) : (
                        <>
                          <Field label={t('docs_recipient_name')}><input value={recipientName} onChange={e => setRecipientName(e.target.value)} className={INPUT_CLS} /></Field>
                          <Field label={t('docs_recipient_email')}><input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} className={INPUT_CLS} /></Field>
                          <Field label={t('docs_recipient_phone')}><input value={recipientPhone} onChange={e => setRecipientPhone(e.target.value)} className={INPUT_CLS} /></Field>
                        </>
                      )}
                      {signatureProvider === 'docusign' && (
                        <div className="sm:col-span-2 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-200">
                          <p>{t('docs_docusign_status', { status: docusignStatus?.connection_status || 'disconnected' })}</p>
                          {!docusignStatus?.connected && (
                            <button onClick={startDocusignConnect} disabled={busy === 'connect-docusign'} className="mt-3 px-3 py-2 rounded-lg bg-[#9333ea] text-[#02080B] font-bold cursor-pointer disabled:opacity-60">
                              {busy === 'connect-docusign' ? t('docs_opening') : t('docs_btn_connect_docusign')}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="sm:col-span-2 flex justify-end">
                        <button
                          onClick={sendForSignature}
                          disabled={!!busy || (signatureProvider === 'docusign' && !otherParty.email)}
                          className="px-4 py-3 rounded-xl bg-[#9333ea] text-[#02080B] font-bold cursor-pointer disabled:opacity-60"
                        >
                          {busy === 'send-signature' ? t('docs_sending') : t('docs_btn_send_lease')}
                        </button>
                      </div>
                    </div>
                  )}

                  {showSignPanel && (
                    <div className="grid gap-4 sm:grid-cols-2 rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <Field label={t('docs_signer_name')}><input value={signerName} onChange={e => setSignerName(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label={t('docs_signer_email')}><input value={signerEmail} onChange={e => setSignerEmail(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label={t('docs_signature_text')}>
                        <textarea value={signatureText} onChange={e => setSignatureText(e.target.value)} className={`${INPUT_CLS} min-h-24 resize-none`} />
                      </Field>
                      <div className="sm:col-span-2 flex justify-end">
                        <button onClick={signLeaseNow} disabled={!!busy} className="px-4 py-3 rounded-xl bg-emerald-500 text-[#03110B] font-bold cursor-pointer disabled:opacity-60">
                          {busy === 'sign' ? t('docs_signing') : t('docs_btn_sign_lease')}
                        </button>
                      </div>
                    </div>
                  )}

                  {showImprovePanel && (
                    <div className="space-y-4 rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('docs_improve_focus')}>
                          <select value={improveFocus} onChange={e => setImproveFocus(e.target.value)} className={INPUT_CLS}>
                            <option value="balanced">{t('docs_focus_balanced')}</option>
                            <option value="tenant">{t('docs_focus_tenant')}</option>
                            <option value="landlord">{t('docs_focus_landlord')}</option>
                            <option value="compliance">{t('docs_focus_compliance')}</option>
                          </select>
                        </Field>
                        <Field label={t('docs_custom_terms_preview')}>
                          <textarea value={improveTerms} onChange={e => setImproveTerms(e.target.value)} className={`${INPUT_CLS} min-h-24 resize-none`} />
                        </Field>
                      </div>
                      {improvePreview && (
                        <div className="rounded-xl border border-[#243246] bg-[#091019] p-4">
                          <p className="text-[11px] uppercase tracking-wider text-[#6E7C91] mb-2">{t('docs_improved_preview')}</p>
                          <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-[#D5DCE7] font-sans">{improvePreview}</pre>
                        </div>
                      )}
                      {!!improveReview.length && <AIReviewPanel review={improveReview} />}
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setShowImprovePanel(false)} className="px-4 py-3 rounded-xl border border-[#243246] text-[#A4B0B7] font-bold cursor-pointer">{t('docs_btn_discard')}</button>
                        <button onClick={acceptImprove} disabled={!!busy} className="px-4 py-3 rounded-xl bg-[#9333ea] text-[#02080B] font-bold cursor-pointer disabled:opacity-60">
                          {busy === 'save-improve' ? t('docs_saving') : t('docs_btn_accept_changes')}
                        </button>
                      </div>
                    </div>
                  )}

                  {showRenewPanel && (
                    <div className="grid gap-4 sm:grid-cols-3 rounded-xl border border-[#243246] bg-[#0A1019] p-4">
                      <Field label={t('docs_renewal_start')}><input type="date" value={renewStartDate} onChange={e => setRenewStartDate(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label={t('docs_renewal_end')}><input type="date" value={renewEndDate} onChange={e => setRenewEndDate(e.target.value)} className={INPUT_CLS} /></Field>
                      <Field label={t('docs_monthly_rent')}><input type="number" value={renewRent} onChange={e => setRenewRent(e.target.value)} className={INPUT_CLS} /></Field>
                      <div className="sm:col-span-3 rounded-xl border border-[#243246] bg-[#091019] p-3 text-xs text-[#A4B0B7]">
                        {t('docs_renewal_hint', { number: record.lease_number || record.agreement_number })}
                      </div>
                      <div className="sm:col-span-3 flex justify-end">
                        <button onClick={renewLeaseNow} disabled={!!busy} className="px-4 py-3 rounded-xl bg-[#9333ea] text-[#02080B] font-bold cursor-pointer disabled:opacity-60">
                          {busy === 'renew' ? t('docs_renewing') : t('docs_btn_create_renewal_lease')}
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
  const { t } = useLanguage();
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
        if (!ignore) setMsg(err.response?.data?.message || t('docs_err_agreement_preview_failed'));
      } finally {
        if (!ignore) setLoadingDetail(false);
      }
    }
    loadDetail();
    return () => { ignore = true; };
  }, [open, item, item.id, record?.content, record?.ai_review, t]);

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
      setMsg(t('docs_err_pdf_download_failed'));
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
      setMsg(err.response?.data?.message || t('docs_err_signed_pdf_failed'));
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
      setMsg(err.response?.data?.message || t('docs_err_certificate_failed'));
    } finally {
      setBusy(null);
    }
  }

  async function connectDocusign() {
    try {
      const response = await smartflowApi.startAgreementDocusignOAuth();
      const authUrl = response?.data?.data?.auth_url || response?.data?.auth_url;
      if (!authUrl) {
        setMsg(t('docs_err_no_docusign_url'));
        return;
      }
      const popup = window.open(authUrl, 'mabdel-docusign-oauth', 'width=680,height=860');
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
      setMsg(err.response?.data?.message || t('docs_err_docusign_start_failed'));
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
      setMsg(t('docs_err_agreement_content_required'));
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
      setMsg(err.response?.data?.message || t('docs_err_improve_failed'));
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
      setMsg(t('docs_err_signing_link_unavailable'));
      return;
    }
    if (!signerName.trim() || !signatureText.trim()) {
      setMsg(t('docs_err_signer_required'));
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
              {loadingDetail && <p className="flex items-center gap-2 text-[#9333ea]"><Loader2 size={14} className="animate-spin" /> {t('docs_loading_agreement_details')}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <p>{t('docs_lbl_agreement_no')} {record.agreement_number || '--'}</p>
                <p>{t('docs_lbl_status_colon')} {record.status || '--'}</p>
                <p>{t('docs_lbl_type_colon')} {record.agreement_type_label || record.agreement_type || '--'}</p>
                <p>{t('docs_lbl_updated_colon')} {record.updated_at ? formatCstDateTime(record.updated_at) : '--'}</p>
                <p>{t('docs_lbl_start_colon')} {record.start_date || '--'}</p>
                <p>{t('docs_lbl_end_colon')} {record.end_date || '--'}</p>
                <p>{t('docs_signature_provider')}: {record.signature_provider || 'native'}</p>
                <p>{t('docs_lbl_provider_status_colon')} {record.provider_status || '--'}</p>
              </div>
              {record.content && <p className="leading-relaxed whitespace-pre-wrap text-[#D5DFEC]">{record.content}</p>}
              {Array.isArray(record.ai_review) && record.ai_review.length > 0 && <AIReviewPanel review={record.ai_review} />}

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={e => { e.stopPropagation(); downloadPdf(); }} disabled={busy === 'pdf'} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  {busy === 'pdf' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} {t('docs_btn_pdf')}
                </button>
                {record.signed_pdf_url && (
                  <button onClick={e => { e.stopPropagation(); downloadSignedPdf(); }} disabled={busy === 'signed-pdf'} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/25 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-950/40 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy === 'signed-pdf' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} {t('docs_btn_signed_pdf')}
                  </button>
                )}
                {record.completion_certificate_url && (
                  <button onClick={e => { e.stopPropagation(); downloadCertificate(); }} disabled={busy === 'certificate'} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#9333ea] hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                    {busy === 'certificate' ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} {t('docs_btn_certificate')}
                  </button>
                )}
                <button onClick={e => { e.stopPropagation(); setShowSendPanel(s => !s); }} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] hover:text-[#9333ea] rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  <Mail size={12} /> {t('docs_btn_send_for_signature')}
                </button>
                <button onClick={e => { e.stopPropagation(); setShowSignPanel(s => !s); }} disabled={!!busy || record.signature_provider === 'docusign'} className="flex items-center gap-1.5 px-3 py-2 bg-emerald-950/30 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/50 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  <CheckCircle2 size={12} /> {t('docs_btn_sign')}
                </button>
                <button onClick={e => { e.stopPropagation(); action('Renew', () => smartflowApi.agreementRenew(item.id, {})); }} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#9333ea]/10 border border-[#9333ea]/20 text-[#9333ea] hover:bg-[#9333ea]/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  {busy === 'Renew' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} {t('docs_btn_renew')}
                </button>
                <button onClick={e => { e.stopPropagation(); previewImprovement(); }} disabled={!!busy} className="flex items-center gap-1.5 px-3 py-2 bg-[#0A1019] border border-[#243246] text-amber-400 hover:bg-amber-950/20 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60">
                  {busy === 'Improve' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} {t('docs_btn_ai_improve')}
                </button>
              </div>

              {showSendPanel && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <select value={signatureProvider} onChange={e => setSignatureProvider(e.target.value)} className={INPUT_CLS}>
                    <option value="native">{t('docs_sig_provider_native_signing')}</option>
                    <option value="docusign">{t('docs_sig_provider_docusign')}</option>
                  </select>
                  <div className="sm:col-span-1 flex items-center text-xs text-[#A4B0B7]">
                    {signatureProvider === 'docusign'
                      ? (docusignStatus?.connected ? t('docs_docusign_connected_to', { name: docusignStatus.account_name || 'DocuSign' }) : (docusignStatus?.last_error || t('docs_docusign_not_connected')))
                      : t('docs_native_signing_hint')}
                  </div>
                  <input value={recipientName} onChange={e => setRecipientName(e.target.value)} placeholder={t('docs_ph_recipient_name')} className={INPUT_CLS} />
                  <input value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)} placeholder={t('docs_ph_recipient_email')} className={INPUT_CLS} />
                  {signatureProvider === 'docusign' && !docusignStatus?.connected && (
                    <button onClick={connectDocusign} type="button" className="sm:col-span-2 py-3 border border-[#9333ea]/30 text-[#9333ea] rounded-xl font-bold cursor-pointer">
                      {t('docs_btn_connect_docusign')}
                    </button>
                  )}
                  <button onClick={sendAgreementForSignature} disabled={!!busy || (signatureProvider === 'docusign' && !docusignStatus?.connected)} className="sm:col-span-2 py-3 bg-[#9333ea] text-[#02080B] rounded-xl font-bold disabled:opacity-60 cursor-pointer">
                    {t('docs_btn_confirm_send_signature')}
                  </button>
                </div>
              )}

              {showSignPanel && (
                <div className="grid grid-cols-1 gap-3 pt-2">
                  <input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder={t('docs_ph_signer_name')} className={INPUT_CLS} />
                  <input value={signerEmail} onChange={e => setSignerEmail(e.target.value)} placeholder={t('docs_ph_signer_email')} className={INPUT_CLS} />
                  <textarea value={signatureText} onChange={e => setSignatureText(e.target.value)} placeholder={t('docs_ph_type_signature')} className={`${INPUT_CLS} min-h-24 resize-none`} />
                  <button onClick={signAgreement} disabled={!!busy || !signingToken} className="py-3 bg-emerald-500 text-[#04120d] rounded-xl font-bold disabled:opacity-60 cursor-pointer">
                    {t('docs_btn_complete_signature')}
                  </button>
                </div>
              )}

              {showImprovePanel && (
                <div className="space-y-3 pt-2">
                  <input value={improveInstruction} onChange={e => setImproveInstruction(e.target.value)} placeholder={t('docs_ph_improve_instruction')} className={INPUT_CLS} />
                  {improvePreview ? <textarea value={improvePreview} readOnly className={`${INPUT_CLS} min-h-36 resize-none`} /> : null}
                  {improveReview.length ? <AIReviewPanel review={improveReview} /> : null}
                  <div className="flex flex-wrap gap-2">
                    <button onClick={acceptImprovement} disabled={!!busy || !improvePreview.trim()} className="px-4 py-2.5 bg-[#9333ea] text-[#02080B] rounded-xl font-bold disabled:opacity-60 cursor-pointer">
                      {t('docs_btn_accept_improvement')}
                    </button>
                    <button onClick={() => { setShowImprovePanel(false); setImprovePreview(''); setImproveReview([]); }} className="px-4 py-2.5 border border-[#243246] text-[#A4B0B7] rounded-xl font-bold cursor-pointer">
                      {t('docs_btn_discard')}
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
  const { t } = useLanguage();
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

  const reconcilePendingDocusign = useCallback((items, kind) => {
    const pending = (items || []).filter(it => it.signature_provider === 'docusign' && it.status === 'pending_signature');
    if (!pending.length) return;
    const fetcher = kind === 'lease' ? smartflowApi.getLease : smartflowApi.getAgreement;
    const setter = kind === 'lease' ? setLeases : setAgreements;
    (async () => {
      for (const it of pending) {
        try {
          const res = await fetcher(it.id);
          const next = res.data?.data;
          if (next && next.status !== it.status) {
            setter(prev => prev.map(p => (p.id === next.id ? next : p)));
          }
        } catch {
          // Best-effort reconciliation
        }
      }
    })();
  }, []);

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
        const leaseItems = leaseList.data?.data?.items || leaseList.data?.data || [];
        setLeases(leaseItems);
        setLoading(false);
        reconcilePendingDocusign(leaseItems, 'lease');
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
        const agreementItems = agreementList.data?.data?.items || agreementList.data?.data || [];
        setAgreements(agreementItems);
        setLoading(false);
        reconcilePendingDocusign(agreementItems, 'agreement');
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
      if (leaseList.status === 'fulfilled') {
        const leaseItems = leaseList.value.data?.data?.items || leaseList.value.data?.data || [];
        setLeases(leaseItems);
        reconcilePendingDocusign(leaseItems, 'lease');
      } else {
        setLeases([]);
      }
      if (agreementList.status === 'fulfilled') {
        const agreementItems = agreementList.value.data?.data?.items || agreementList.value.data?.data || [];
        setAgreements(agreementItems);
        reconcilePendingDocusign(agreementItems, 'agreement');
      } else {
        setAgreements([]);
      }

      if (docs.status === 'rejected' && leaseList.status === 'rejected' && agreementList.status === 'rejected') {
        console.error('Documents page data requests failed.', {
          documents: docs.reason,
          leases: leaseList.reason,
          agreements: agreementList.reason,
        });
        setError('Failed to load documents data from server.');
      }
    } catch (err) {
      if (fetchVersion !== fetchVersionRef.current) return;
      console.error('Documents page fetchAll error.', err);
      setError(err.response?.data?.message || 'Could not load documents.');
    } finally {
      if (fetchVersion === fetchVersionRef.current) {
        setLoading(false);
      }
    }
  }, [active, agreementSearch, leaseSearch, reconcilePendingDocusign]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const rows = useMemo(() => {
    if (active === 'leases') return leases;
    if (active === 'agreements') return agreements;
    return documents;
  }, [active, agreements, documents, leases]);

  async function deleteAgreement(id) {
    if (!window.confirm(t('docs_confirm_delete_agreement'))) return;
    try { await smartflowApi.deleteAgreement(id); fetchAll(); }
    catch (err) { setError(err.response?.data?.message || t('docs_err_delete_failed')); }
  }

  async function deleteLease(id) {
    if (!window.confirm(t('docs_confirm_delete_lease'))) return;
    try { await smartflowApi.deleteLease(id); fetchAll(); }
    catch (err) { setError(err.response?.data?.message || t('docs_err_delete_failed')); }
  }

  const showForm = active === 'leases' || active === 'agreements';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#243041]/40 pb-4">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('docs_title')}</h1>
          <p className="text-[#A4B0B7] text-xs mt-1">{t('docs_subtitle')}</p>
        </div>
        <button
          onClick={() => { setShowCreate(c => !c); }}
          className="px-5 py-3 bg-[#9333ea] text-[#02080B] hover:bg-[#a855f7] rounded-xl font-extrabold flex items-center gap-2 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          {showCreate ? <X size={18} /> : <Plus size={18} />}
          {showCreate ? t('docs_btn_close_form') : active === 'leases' ? t('docs_btn_new_lease') : t('docs_btn_new_agreement')}
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
          {t('docs_nav_invoice')}
        </button>
        <button
          onClick={() => navigate('/create-post')}
          className="px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent"
        >
          <PenLine size={16} />
          {t('docs_nav_create_post')}
        </button>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const tabLabel = t(tab.labelKey);
          return (
            <button
              key={tab.id}
              onClick={() => { setActive(tab.id); setShowCreate(false); }}
              className={`px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer ${active === tab.id ? 'bg-[#9333ea]/10 text-white border-[#9333ea]/20' : 'text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent'}`}
            >
              <Icon size={16} className={active === tab.id ? 'text-[#9333ea]' : ''} />
              {tabLabel}
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
            <span className="font-bold text-white text-base">{t(tabs.find(t => t.id === active)?.labelKey)}</span>
          </div>
          {(active === 'agreements' || active === 'leases') && (
            <div className="p-5 border-b border-[#243041]/30">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A4B0B7]" />
                <input
                  value={active === 'leases' ? leaseSearch : agreementSearch}
                  onChange={e => active === 'leases' ? setLeaseSearch(e.target.value) : setAgreementSearch(e.target.value)}
                  placeholder={active === 'leases'
                    ? t('docs_ph_search_leases')
                    : t('docs_ph_search_agreements')}
                  className={`${INPUT_CLS} pl-10`}
                />
              </div>
            </div>
          )}
          {loading ? (
            <div className="p-12 flex items-center justify-center gap-3 text-[#A4B0B7]/60 text-sm">
              <Loader2 size={20} className="animate-spin" /> {t('docs_loading')}
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
              <div className="w-14 h-14 rounded-2xl bg-[#9333ea]/10 flex items-center justify-center mx-auto mb-4">
                {active === 'leases' ? <ScrollText size={24} className="text-[#9333ea]" /> : <FileCheck2 size={24} className="text-[#9333ea]" />}
              </div>
              <p className="text-white font-bold">{active === 'leases' ? t('docs_no_leases_yet') : t('docs_no_agreements_yet')}</p>
              <p className="text-[#A4B0B7] text-sm mt-1">
                {t('docs_click_new_to_create', { btn: active === 'leases' ? t('docs_btn_new_lease') : t('docs_btn_new_agreement') })}
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
