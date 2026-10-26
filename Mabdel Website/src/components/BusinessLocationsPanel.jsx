import { useState } from 'react';
import { smartflowApi } from '../api/services';

const field = 'w-full rounded-lg border border-[#243246] bg-[#0A1019] p-2 text-white';
const empty = { name: '', address: '', capacity: 1, working_days: null, working_hours: null };
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function BusinessLocationsPanel({ locations, onChange, providers, appointmentTypes, onProvidersChange, onTypesChange }) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(empty);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const payload = { ...draft, name: draft.name.trim(), capacity: Number(draft.capacity) };
      if (payload.working_hours && payload.working_hours.start_hour >= payload.working_hours.end_hour) throw new Error('Closing hour must be after opening hour.');
      const res = editingId ? await smartflowApi.updateLocation(editingId, payload) : await smartflowApi.createLocation(payload);
      const item = res.data.data;
      onChange(editingId ? locations.map((old) => old.id === editingId ? item : old) : [...locations, item]);
      setDraft(empty); setEditingId(null);
    } catch (err) { setError(err.response?.data?.message || err.message || 'Unable to save location.'); }
    finally { setBusy(false); }
  }
  async function toggle(item) {
    setBusy(true); setError('');
    try {
      const res = await smartflowApi.updateLocation(item.id, { active: !item.active });
      onChange(locations.map((old) => old.id === item.id ? res.data.data : old));
    } catch (err) { setError(err.response?.data?.message || 'Unable to update location.'); }
    finally { setBusy(false); }
  }
  async function assign(item, ids, isProvider) {
    setBusy(true); setError('');
    try {
      const res = isProvider ? await smartflowApi.updateProvider(item.id, { location_ids: ids }) : await smartflowApi.updateAppointmentType(item.id, { eligible_location_ids: ids });
      const all = isProvider ? providers : appointmentTypes;
      (isProvider ? onProvidersChange : onTypesChange)(all.map((old) => old.id === item.id ? res.data.data : old));
    } catch (err) { setError(err.response?.data?.message || 'Unable to assign locations.'); }
    finally { setBusy(false); }
  }
  return <section className="my-4 rounded-2xl border border-[#243041] bg-[#131A24] p-5 text-white">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="font-semibold">Business locations {open ? '-' : '+'}</button>
    {open && <div className="mt-4 space-y-4">
      <p className="text-sm text-[#A4B0B7]">Set locations, opening hours and the maximum number of simultaneous appointments. Hours use your business timezone.</p>
      {error && <p role="alert" className="text-red-300">{error}</p>}
      {locations.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-3 border-b border-[#243041] pb-3">
        <span className="flex-1">{item.name}{!item.active ? ' (inactive)' : ''}<small className="block text-[#A4B0B7]">{item.address} ? Capacity: {item.capacity}</small></span>
        <button type="button" disabled={busy} onClick={() => { setEditingId(item.id); setDraft({ name: item.name, address: item.address || '', capacity: item.capacity, working_days: item.working_days, working_hours: item.working_hours }); }}>Edit</button>
        <button type="button" disabled={busy} onClick={() => toggle(item)}>{item.active ? 'Deactivate' : 'Activate'}</button>
      </div>)}
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <label>Name<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={field} /></label>
        <label>Address<input value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} className={field} /></label>
        <label>Simultaneous appointment capacity<input type="number" min="1" max="1000" required value={draft.capacity} onChange={(e) => setDraft({ ...draft, capacity: e.target.value })} className={field} /></label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!draft.working_hours} onChange={(e) => setDraft({ ...draft, working_hours: e.target.checked ? { start_hour: 9, end_hour: 17 } : null })} />Restrict location hours</label>
        {draft.working_hours && <div className="flex gap-3">
          <label>Opening hour<input aria-label="Location opening hour" className={field} type="number" min="0" max="23" value={draft.working_hours.start_hour} onChange={(e) => setDraft({ ...draft, working_hours: { ...draft.working_hours, start_hour: Number(e.target.value) } })} /></label>
          <label>Closing hour<input aria-label="Location closing hour" className={field} type="number" min="1" max="24" value={draft.working_hours.end_hour} onChange={(e) => setDraft({ ...draft, working_hours: { ...draft.working_hours, end_hour: Number(e.target.value) } })} /></label>
        </div>}
        <fieldset className="sm:col-span-2"><legend>Open weekdays (none selected follows business hours)</legend><div className="flex flex-wrap gap-3">{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={draft.working_days?.includes(index) || false} onChange={(e) => { const days = e.target.checked ? [...(draft.working_days || []), index] : (draft.working_days || []).filter((d) => d !== index); setDraft({ ...draft, working_days: days.length ? days : null }); }} /> {day}</label>)}</div></fieldset>
        <button disabled={busy} className="rounded-lg bg-purple-600 p-2" type="submit">{editingId ? 'Save location' : 'Add location'}</button>
        {editingId && <button type="button" onClick={() => { setEditingId(null); setDraft(empty); }}>Cancel edit</button>}
      </form>
      {locations.some((item) => item.active) && <div className="grid gap-4 sm:grid-cols-2">
        {[...providers.map((item) => ({ item, provider: true })), ...appointmentTypes.map((item) => ({ item, provider: false }))].map(({ item, provider }) => <label key={`${provider}-${item.id}`} className="text-sm">{provider ? 'Provider' : 'Service'}: {item.name}<select multiple aria-label={`Locations for ${item.name}`} className={field} disabled={busy} value={(provider ? item.location_ids : item.eligible_location_ids) || []} onChange={(e) => assign(item, Array.from(e.target.selectedOptions, (option) => option.value), provider)}>{locations.filter((location) => location.active).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select><small className="text-[#A4B0B7]">No selection allows all locations. Hold Ctrl or Command to select multiple.</small></label>)}
      </div>}
    </div>}
  </section>;
}
