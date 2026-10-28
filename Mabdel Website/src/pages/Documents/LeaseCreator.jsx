import { useCallback, useState } from 'react';
import {
  AlertTriangle, Building2, CalendarDays, CheckCircle2, House, Loader2, PenLine, ScrollText, Sparkles, Users, Wallet,
} from 'lucide-react';
import { smartflowApi } from '../../api/services';
import VoiceFormFillModal from '../../components/Documents/VoiceFormFillModal';
import { DatePickerInput } from '../../components/ui/DateTimeInputs';
import { useLanguage } from '../../context/LanguageContext';
import { normalizeDate, INPUT_CLS } from './utils';
import { Field, SectionHeader, SigToggle } from './shared';

// ── Lease Creator ──────────────────────────────────────────────────────────────
export default function LeaseCreator({ onCreated, prefill }) {
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
