import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Download, FileText, Loader2, User, XCircle } from 'lucide-react';
import { publicApi } from '../api/services';
import logoMark from '../assets/gocustify-mark.png';
import { useLanguage } from '../context/LanguageContext';

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#070a13] text-gray-100">
      <header className="border-b border-gray-900 bg-[#070a13]/95 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-center gap-2">
          <img src={logoMark} alt="GoCustify" className="w-9 h-9 rounded-lg shadow-lg shadow-purple-500/20" />
          <span className="text-lg font-bold tracking-tight text-white">GoCustify</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-16 md:py-20">{children}</main>
    </div>
  );
}

export default function SignDocument() {
  const { docType, token } = useParams();
  const { t } = useLanguage();
  const isLease = docType === 'lease';
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [signed, setSigned] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [signatureText, setSignatureText] = useState('');

  const getDocument = isLease ? publicApi.getSigningLease : publicApi.getSigningAgreement;
  const signDocument = isLease ? publicApi.signLease : publicApi.signAgreement;
  const pdfUrl = isLease ? publicApi.getSigningLeasePdfUrl(token) : publicApi.getSigningAgreementPdfUrl(token);

  useEffect(() => {
    let ignore = false;
    getDocument(token)
      .then((response) => {
        if (ignore) return;
        setRecord(response?.data?.data || null);
      })
      .catch((loadError) => {
        if (ignore) return;
        setError(loadError?.response?.data?.message || t('sign_doc_err_load'));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, docType]);

  const handleSign = async () => {
    if (signing) return;
    if (!signerName.trim() || !signatureText.trim()) {
      setError(t('sign_doc_err_required'));
      return;
    }
    setSigning(true);
    setError('');
    try {
      const response = await signDocument(token, {
        signer_name: signerName.trim(),
        signer_email: signerEmail.trim() || undefined,
        signature_text: signatureText.trim(),
      });
      setSigned(response?.data?.data || null);
    } catch (signError) {
      setError(signError?.response?.data?.message || t('sign_doc_err_sign'));
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="min-h-[40vh] flex items-center justify-center">
          <Loader2 className="animate-spin text-purple-400" size={28} />
        </div>
      </Shell>
    );
  }

  if (error && !record) {
    return (
      <Shell>
        <div className="rounded-[28px] border border-rose-500/20 bg-[#0c101b]/80 px-6 py-10 md:px-10 md:py-12 text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
            <XCircle size={30} className="text-rose-400" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">{t('sign_doc_err_title')}</h1>
          <p className="text-gray-400 text-sm">{error}</p>
        </div>
      </Shell>
    );
  }

  const finalRecord = signed || record;
  const alreadySigned = finalRecord?.status === 'signed';
  const docNumber = finalRecord?.lease_number || finalRecord?.agreement_number;

  return (
    <Shell>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-purple-400">
            {isLease ? t('sign_doc_eyebrow_lease') : t('sign_doc_eyebrow_agreement')}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{finalRecord?.title || t('sign_doc_title')}</h1>
          {docNumber ? <p className="text-sm text-gray-500">{docNumber}</p> : null}
        </div>

        <div className="rounded-[28px] border border-gray-900 bg-[#0c101b]/80 px-6 py-7 md:px-8 md:py-9 space-y-5">
          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-950/10 px-4 py-3 text-sm text-rose-300">{error}</div>
          ) : null}

          {finalRecord?.client_name ? (
            <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
              <User size={18} className="text-slate-400 mt-0.5" />
              <p className="text-white font-semibold text-sm">{finalRecord.client_name}</p>
            </div>
          ) : null}

          {finalRecord?.content ? (
            <div className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-xl border border-slate-800 max-h-72 overflow-y-auto">
              <FileText size={18} className="text-slate-400 mt-0.5 shrink-0" />
              <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-300 font-sans">{finalRecord.content}</pre>
            </div>
          ) : null}

          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A1019] border border-[#243246] text-gray-300 hover:text-white text-sm font-semibold transition-colors"
          >
            <Download size={15} /> {t('sign_doc_btn_download_pdf')}
          </a>

          {alreadySigned ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-4 py-3 text-sm text-emerald-300 flex items-center gap-2">
              <CheckCircle2 size={18} />
              {t('sign_doc_already_signed')}
            </div>
          ) : (
            <div className="space-y-3 pt-2 border-t border-gray-900">
              <p className="text-sm text-gray-400">{t('sign_doc_form_intro')}</p>
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder={t('sign_doc_ph_name')}
                className="w-full px-4 py-3 rounded-xl bg-[#0A1019] border border-[#243246] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
              <input
                value={signerEmail}
                onChange={(e) => setSignerEmail(e.target.value)}
                placeholder={t('sign_doc_ph_email')}
                className="w-full px-4 py-3 rounded-xl bg-[#0A1019] border border-[#243246] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500"
              />
              <textarea
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder={t('sign_doc_ph_signature')}
                className="w-full px-4 py-3 rounded-xl bg-[#0A1019] border border-[#243246] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500 min-h-24 resize-none"
              />
              <button
                type="button"
                onClick={handleSign}
                disabled={signing}
                className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070a13] font-extrabold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
              >
                {signing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                {t('sign_doc_btn_sign')}
              </button>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
