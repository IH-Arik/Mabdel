import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileCheck2, FileText, Loader2, PenLine, Plus, ScrollText, Search, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../../api/services';
import { useLanguage } from '../../context/LanguageContext';
import { INPUT_CLS, tabs } from './utils';
import AgreementCreator from './AgreementCreator';
import LeaseCreator from './LeaseCreator';
import DocumentCreator from './DocumentCreator';
import AgreementRecordRow from './AgreementRecordRow';
import LeaseRecordRow from './LeaseRecordRow';
import DocumentRecordRow from './DocumentRecordRow';

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

  async function deleteDocumentItem(id) {
    if (!window.confirm(t('docs_confirm_delete_document'))) return;
    try { await smartflowApi.deleteDocument(id); fetchAll(); }
    catch (err) { setError(err.response?.data?.message || t('docs_err_delete_failed')); }
  }

  const showForm = active === 'leases' || active === 'agreements' || active === 'documents';

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
          {showCreate
            ? t('docs_btn_close_form')
            : active === 'leases'
              ? t('docs_btn_new_lease')
              : active === 'documents'
                ? t('docs_btn_new_document')
                : t('docs_btn_new_agreement')}
        </button>
      </div>

      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">{error}</div>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setActive('agreements'); setShowCreate(false); }}
          className={`px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer ${active === 'agreements' ? 'bg-[#9333ea]/10 text-white border-[#9333ea]/20' : 'text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent'}`}
        >
          <FileCheck2 size={16} className={active === 'agreements' ? 'text-[#9333ea]' : ''} />
          {t('docs_tab_agreements')}
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#243041] text-[#A4B0B7] text-xs">
            {agreements.length}
          </span>
        </button>

        <button
          onClick={() => navigate('/invoices')}
          className="px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent"
        >
          <FileText size={16} />
          {t('docs_nav_invoice')}
        </button>

        <button
          onClick={() => { setActive('leases'); setShowCreate(false); }}
          className={`px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer ${active === 'leases' ? 'bg-[#9333ea]/10 text-white border-[#9333ea]/20' : 'text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent'}`}
        >
          <ScrollText size={16} className={active === 'leases' ? 'text-[#9333ea]' : ''} />
          {t('docs_tab_leases')}
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#243041] text-[#A4B0B7] text-xs">
            {leases.length}
          </span>
        </button>

        <button
          onClick={() => { setActive('documents'); setShowCreate(false); }}
          className={`px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer ${active === 'documents' ? 'bg-[#9333ea]/10 text-white border-[#9333ea]/20' : 'text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent'}`}
        >
          <FileText size={16} className={active === 'documents' ? 'text-[#9333ea]' : ''} />
          {t('docs_tab_documents')}
          <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#243041] text-[#A4B0B7] text-xs">
            {documents.length}
          </span>
        </button>

        <button
          onClick={() => navigate('/create-post')}
          className="px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 border transition-all cursor-pointer text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border-transparent"
        >
          <PenLine size={16} />
          {t('docs_nav_create_post')}
        </button>
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
                    : <DocumentRecordRow key={item.id || item._id} item={item} onDelete={deleteDocumentItem} onRefresh={fetchAll} />
              ))}
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#9333ea]/10 flex items-center justify-center mx-auto mb-4">
                {active === 'leases' ? <ScrollText size={24} className="text-[#9333ea]" /> : active === 'agreements' ? <FileCheck2 size={24} className="text-[#9333ea]" /> : <FileText size={24} className="text-[#9333ea]" />}
              </div>
              <p className="text-white font-bold">{active === 'leases' ? t('docs_no_leases_yet') : active === 'agreements' ? t('docs_no_agreements_yet') : t('docs_no_documents_yet')}</p>
              <p className="text-[#A4B0B7] text-sm mt-1">
                {t('docs_click_new_to_create', { btn: active === 'leases' ? t('docs_btn_new_lease') : active === 'agreements' ? t('docs_btn_new_agreement') : t('docs_btn_new_document') })}
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
              {active === 'documents' && <DocumentCreator onCreated={() => { fetchAll(); setShowCreate(false); }} />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
