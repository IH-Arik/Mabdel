import { useCallback, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, CircleAlert, Loader2, PenLine, Sparkles,
} from 'lucide-react';
import { smartflowApi } from '../../api/services';
import VoiceFormFillModal from '../../components/Documents/VoiceFormFillModal';
import { useLanguage } from '../../context/LanguageContext';
import { normalizeDate, INPUT_CLS } from './utils';
import { Field, SectionHeader, AIReviewPanel } from './shared';

// ── Agreement Creator ──────────────────────────────────────────────────────────
export default function AgreementCreator({ onCreated, prefill }) {
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
