import { useEffect, useState } from 'react';
import { smartflowApi } from '../../../api/services';

const unwrap = (response) => response?.data?.data ?? response?.data;

export default function ReceptionistDocuments() {
  const [documents, setDocuments] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = async () => setDocuments(unwrap(await smartflowApi.getAICallSettings())?.knowledge_documents || []);
  useEffect(() => { refresh().catch(() => setError('Unable to load business documents.')); }, []);
  const run = async (action) => {
    setBusy(true); setError('');
    try { await action(); await refresh(); }
    catch (err) { setError(err.response?.data?.error?.message || err.response?.data?.message || 'Unable to update document. Please try again.'); }
    finally { setBusy(false); }
  };
  return <div className="mt-4 border-t border-[#243246] pt-4 space-y-3">
    <p className="text-sm font-semibold text-white">Approved business documents</p>
    <p className="text-xs text-[#A4B0B7]">Upload PDF, TXT or DOCX, review the extracted text, then approve it for calls. Up to 10 documents, 5 MB and 12,000 characters each. Scanned PDFs need readable text.</p>
    <input type="file" aria-label="Upload business document" accept=".pdf,.txt,.docx" disabled={busy} className="text-xs text-[#A4B0B7]" onChange={(event) => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (file) run(async () => setSelected(unwrap(await smartflowApi.uploadReceptionistDocument(file))));
    }} />
    {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
    {documents.map((doc) => <div key={doc.id} className="flex gap-3 items-center text-xs text-white">
      <span className="flex-1 break-all">{doc.filename} · {doc.approved ? 'Approved' : 'Needs review'}</span>
      <button type="button" disabled={busy} onClick={() => run(async () => setSelected(unwrap(await smartflowApi.previewReceptionistDocument(doc.id))))}>Review</button>
      {doc.approved && <button type="button" disabled={busy} onClick={() => run(async () => { await smartflowApi.approveReceptionistDocument(doc.id, false); setSelected(null); })}>Revoke</button>}
      <button type="button" disabled={busy} onClick={() => run(async () => { await smartflowApi.deleteReceptionistDocument(doc.id); if (selected?.id === doc.id) setSelected(null); })}>Remove</button>
    </div>)}
    {selected && <div className="space-y-2">
      <p className="text-xs text-white">Review: {selected.filename}</p>
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-[#A4B0B7] bg-[#0A1019] p-3 rounded-lg">{selected.preview}</pre>
      <button type="button" disabled={busy || selected.approved} className="text-xs text-purple-400" onClick={() => run(async () => setSelected(unwrap(await smartflowApi.approveReceptionistDocument(selected.id, true))))}>Approve reviewed text for calls</button>
      <button type="button" className="ml-4 text-xs text-[#A4B0B7]" onClick={() => setSelected(null)}>Close preview</button>
    </div>}
  </div>;
}
