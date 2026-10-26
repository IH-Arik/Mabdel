import { useCallback, useEffect, useState } from 'react';
import client from '../../api/client';
import ExecuteReceptionistRequest from './ExecuteReceptionistRequest';

const base = '/api/v1/smartflow/receptionist';
const label = (value) => String(value || '').replaceAll('_', ' ');

export default function ReceptionistWorkQueue() {
  const [approvals, setApprovals] = useState([]);
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [records, setRecords] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [actions, work, team, business] = await Promise.all([
        client.get(`${base}/actions`),
        client.get(`${base}/work-items`),
        client.get('/api/v1/smartflow/team'),
        client.get(`${base}/business-records`),
      ]);
      const data = actions.data?.data;
      setApprovals(Array.isArray(data) ? data : data?.items || []);
      setRequests(work.data?.data?.items || []);
      setMembers(team.data?.data?.items || []);
      setRecords(business.data?.data?.items || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load receptionist requests. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);
  async function act(path, method, body) {
    setBusy(true);
    try {
      const response = await client[method](`${base}/${path}`, body);
      await load();
      if (response.data?.data?.status === 'failed') {
        setError(response.data.data.result?.error || response.data.data.result?.note || 'The approved action could not be completed. Please follow up with the caller.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'The action could not be completed.');
    } finally { setBusy(false); }
  }
  return (
    <section className="rounded-2xl border border-[#243041] bg-[#131A24] text-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Receptionist approvals & follow-up</h2>
        <button type="button" onClick={load} disabled={loading || busy} className="text-sm text-blue-600 disabled:opacity-50">Refresh</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {loading && <p role="status" className="text-sm text-gray-500">Loading requests…</p>}
      {!loading && !approvals.length && !requests.length && <p className="text-sm text-gray-500">No receptionist requests yet.</p>}
      {approvals.map((item) => (
        <article key={item.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="font-medium text-slate-900">{label(item.status)}: {label(item.capability || item.tool)}</p>
          <p className="text-sm text-slate-800">{item.caller_phone || 'Unknown caller'}</p>
          <dl className="text-sm text-slate-800 space-y-1">{Object.entries(item.arguments || {}).map(([key, value]) => (
            <div key={key}><dt className="inline font-medium">{label(key)}: </dt><dd className="inline break-words">{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}</dd></div>
          ))}</dl>
          {item.result?.error && <p className="text-sm text-red-700">{item.result.error}</p>}
          {item.result?.note && <p className="text-sm text-slate-800">{item.result.note}</p>}
          {item.status === 'pending' && <div className="flex gap-3">
            <button type="button" disabled={busy} onClick={() => act(`actions/${item.id}/approve`, 'post')} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">Approve & execute</button>
            <button type="button" disabled={busy} onClick={() => act(`actions/${item.id}/decline`, 'post')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50">Decline</button>
          </div>}
        </article>
      ))}
      {requests.map((item) => (
        <article key={item.id} className="rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="font-medium capitalize">{label(item.kind)} · {label(item.status)}</p>
          <p className="text-sm whitespace-pre-wrap">{item.summary}</p>
          <p className="text-sm text-gray-500">{[item.caller_name, item.caller_phone, item.department, item.preferred_time].filter(Boolean).join(' · ')}</p>
          <label className="text-sm">Status <select aria-label={`Status for ${item.summary}`} value={item.status} disabled={busy} onChange={(event) => act(`work-items/${item.id}`, 'patch', { status: event.target.value })} className="ml-2 rounded-lg border p-2">
            {['open', 'in_progress', 'completed', 'cancelled'].map((status) => <option key={status} value={status}>{label(status)}</option>)}
          </select></label>
          <label className="ml-3 text-sm">Assign to <select aria-label={`Assign ${item.summary}`} value={item.assignee_ids?.[0] || ''} disabled={busy} onChange={(event) => act(`work-items/${item.id}`, 'patch', { status: item.status, assignee_id: event.target.value })} className="ml-2 rounded-lg border p-2">
            <option value="" disabled>Choose employee</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name || member.email}</option>)}
          </select></label>
          <ExecuteReceptionistRequest item={item} busy={busy} onExecute={(data) => act(`work-items/${item.id}/execute`, 'post', data)} />
        </article>
      ))}
      {records.length > 0 && <h3 className="pt-4 font-semibold">Business records</h3>}
      {records.map((record) => <article key={`${record.kind}-${record.id}`} className="rounded-xl border border-slate-700 p-4 space-y-2">
        <p className="font-medium capitalize">{label(record.kind)}: {record.title}</p>
        <p className="text-sm whitespace-pre-wrap">{record.description}</p>
        {record.kind === 'quote' && <p className="text-sm">{record.currency} {record.amount} · Draft quote; no automatic delivery</p>}
        <label className="text-sm">Record status<select aria-label={`Business record status for ${record.title}`} value={record.status} disabled={busy} onChange={(event) => act(`business-records/${record.kind}/${record.id}`, 'patch', { status: event.target.value })} className="ml-2 rounded-lg border border-slate-600 bg-slate-900 p-2">
          {(record.kind === 'quote' ? ['draft', 'accepted', 'declined', 'cancelled'] : ['open', 'in_progress', 'completed', 'cancelled']).map((value) => <option key={value} value={value}>{label(value)}</option>)}
        </select></label>
      </article>)}
    </section>
  );
}
