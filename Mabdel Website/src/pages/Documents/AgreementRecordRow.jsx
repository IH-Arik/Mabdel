import { useEffect, useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, Download, Loader2, Mail, RefreshCw, Sparkles, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../../api/services';
import { formatCstDateTime } from '../../utils/dateUtils';
import { useLanguage } from '../../context/LanguageContext';
import { extractSigningToken, getAgreementStatusBadge, INPUT_CLS } from './utils';
import { AIReviewPanel } from './shared';

export default function AgreementRecordRow({ item, onDelete, onRefresh }) {
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
