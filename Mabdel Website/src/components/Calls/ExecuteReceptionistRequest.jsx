import { useState } from 'react';

export default function ExecuteReceptionistRequest({ item, busy, onExecute }) {
  const [expanded, setExpanded] = useState(false);
  const [approved, setApproved] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [action, setAction] = useState('create_task');
  const [email, setEmail] = useState('');
  if (item.execution_status === 'completed') return <p className="text-sm text-green-400">{item.execution_result?.note || 'Business record created.'}</p>;
  if (item.status === 'cancelled' || item.status === 'completed') return null;
  const submit = (event) => {
    event.preventDefault();
    const data = { approved: true };
    if (item.kind === 'quote') Object.assign(data, { quote_amount: amount, currency });
    if (item.kind === 'workflow') Object.assign(data, { workflow_action: action, ...(email ? { contact_email: email } : {}) });
    onExecute(data);
  };
  return <div className="mt-3 border-t border-slate-700 pt-3">
    <button type="button" disabled={busy} onClick={() => setExpanded(!expanded)} className="rounded-lg border border-blue-500 px-3 py-2 text-sm text-blue-300">{expanded ? 'Close review' : 'Review & create business record'}</button>
    {expanded && <form onSubmit={submit} className="mt-3 space-y-3">
      <p className="text-sm text-slate-300">{item.kind === 'quote' ? 'Enter your approved price to create a draft quote. It will not be sent to the customer.' : item.kind === 'callback' ? 'Create a callback task for your team. This does not place a phone call.' : 'Create a business record from this request. No external message or phone call will be sent.'}</p>
      {item.kind === 'quote' && <div className="flex gap-3">
        <label className="text-sm">Approved amount<input aria-label="Approved quote amount" type="number" min="0" max="999999999.99" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} className="ml-2 w-36 rounded border border-slate-600 bg-slate-900 p-2" /></label>
        <label className="text-sm">Currency<select value={currency} onChange={(event) => setCurrency(event.target.value)} className="ml-2 rounded border border-slate-600 bg-slate-900 p-2">{['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'BDT', 'INR', 'AED'].map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>}
      {item.kind === 'workflow' && <div className="space-y-2">
        <label className="text-sm">Business workflow<select value={action} onChange={(event) => setAction(event.target.value)} className="ml-2 rounded border border-slate-600 bg-slate-900 p-2"><option value="create_task">Create task</option><option value="create_service_ticket">Create service ticket</option><option value="create_crm_contact">Save CRM contact</option></select></label>
        {action === 'create_crm_contact' && <label className="block text-sm">Contact email (optional if caller phone is available)<input type="email" value={email} required={!item.caller_phone} onChange={(event) => setEmail(event.target.value)} className="ml-2 rounded border border-slate-600 bg-slate-900 p-2" /></label>}
      </div>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} required />I reviewed these details and approve creating this record.</label>
      {item.execution_error && <p role="alert" className="text-sm text-red-400">{item.execution_error}</p>}
      <button type="submit" disabled={busy || !approved} className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50">{item.execution_status === 'failed' ? 'Retry creating record' : 'Approve & create record'}</button>
    </form>}
  </div>;
}
