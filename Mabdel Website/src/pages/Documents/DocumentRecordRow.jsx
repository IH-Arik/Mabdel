import { useState } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, Loader2, PenLine, Trash2, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../../api/services';
import { useLanguage } from '../../context/LanguageContext';

// ── Document row (plain uploaded/linked files, distinct from agreements/leases) ─
export default function DocumentRecordRow({ item, onDelete, onRefresh }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(item.name || '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function saveRename() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === item.name) { setRenaming(false); return; }
    setBusy(true); setMsg('');
    try {
      await smartflowApi.updateDocument(item.id, { name: trimmed });
      setRenaming(false);
      onRefresh?.();
    } catch (err) {
      setMsg(err.response?.data?.message || t('docs_err_rename_failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-[#243041]/30 last:border-0">
      <div
        className="flex items-center justify-between p-5 hover:bg-[#1C2635]/10 transition-colors cursor-pointer"
        onClick={() => !renaming && setOpen(o => !o)}
      >
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={e => setNameDraft(e.target.value)}
              onClick={e => e.stopPropagation()}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') { setRenaming(false); setNameDraft(item.name || ''); } }}
              className="w-full px-2 py-1 bg-[#0A1019] border border-[#9333ea]/50 text-white rounded-lg text-sm outline-none"
            />
          ) : (
            <h3 className="font-bold text-white truncate text-sm">{item.name || item.id}</h3>
          )}
          <p className="text-xs text-[#A4B0B7] mt-0.5 truncate">{item.type || 'others'}</p>
        </div>
        <div className="flex items-center gap-2 ml-3">
          {renaming ? (
            <>
              <button onClick={e => { e.stopPropagation(); saveRename(); }} disabled={busy}
                className="p-2 text-emerald-400 hover:bg-emerald-950/20 rounded-lg transition-all cursor-pointer disabled:opacity-60">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              </button>
              <button onClick={e => { e.stopPropagation(); setRenaming(false); setNameDraft(item.name || ''); }}
                className="p-2 text-[#A4B0B7] hover:bg-slate-900/40 rounded-lg transition-all cursor-pointer">
                <X size={15} />
              </button>
            </>
          ) : (
            <button onClick={e => { e.stopPropagation(); setRenaming(true); }}
              className="p-2 text-[#A4B0B7] hover:text-white hover:bg-slate-900/40 rounded-lg transition-all cursor-pointer">
              <PenLine size={15} />
            </button>
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
            <div className="px-5 pb-4 text-sm text-[#A4B0B7] border-t border-[#243041]/30 pt-3 space-y-2">
              {msg && <p className="text-rose-400">{msg}</p>}
              {item.file_url && <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="text-[#9333ea] hover:underline">{t('docs_view_file')}</a>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
