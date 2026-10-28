import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { smartflowApi } from '../../api/services';
import { useLanguage } from '../../context/LanguageContext';
import { DOCUMENT_TYPES, INPUT_CLS } from './utils';
import { Field } from './shared';

export default function DocumentCreator({ onCreated }) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [type, setType] = useState('others');
  const [fileUrl, setFileUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!name.trim() || !fileUrl.trim()) {
      setError(t('docs_err_document_fields_required'));
      return;
    }
    setCreating(true); setError('');
    try {
      await smartflowApi.createDocument({ name: name.trim(), type, file_url: fileUrl.trim() });
      setName(''); setFileUrl(''); setType('others');
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.message || t('docs_err_document_create_failed'));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="bg-[#131A24] border border-[#243041] rounded-[22px] p-5 space-y-4">
      <h3 className="font-bold text-white text-base">{t('docs_btn_new_document')}</h3>
      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">{error}</div>}
      <Field label={t('docs_lbl_document_name')}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={t('docs_ph_document_name')} className={INPUT_CLS} />
      </Field>
      <Field label={t('docs_lbl_document_type')}>
        <select value={type} onChange={e => setType(e.target.value)} className={INPUT_CLS}>
          {DOCUMENT_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
        </select>
      </Field>
      <Field label={t('docs_lbl_document_url')}>
        <input value={fileUrl} onChange={e => setFileUrl(e.target.value)} placeholder={t('docs_ph_document_url')} className={INPUT_CLS} />
      </Field>
      <button
        onClick={handleCreate} disabled={creating}
        className="w-full py-4 bg-[#9333ea] text-[#02080B] hover:bg-[#a855f7] rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer text-base"
      >
        {creating ? <Loader2 size={20} className="animate-spin" /> : <FileText size={20} />}
        {creating ? t('docs_creating') : t('docs_btn_save_document')}
      </button>
    </div>
  );
}
