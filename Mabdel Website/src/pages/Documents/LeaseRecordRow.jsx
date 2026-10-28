import { useEffect, useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, Download, Loader2, Mail, RefreshCw, Sparkles, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../../api/services';
import { useLanguage } from '../../context/LanguageContext';
import { normalizeDate, formatLeaseMoney, formatDisplayDate, getAgreementStatusBadge, INPUT_CLS } from './utils';
import { Field, AIReviewPanel } from './shared';

export default function LeaseRecordRow({ item, onDelete, onRefresh }) {
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
