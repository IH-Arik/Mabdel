import { useCallback, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Bell, Building2, Calendar as CalIcon, CalendarDays,
  CheckCircle2, ChevronDown, ChevronUp, Clock, Link2, Loader2, Mail,
  MapPin, Mic, Phone, Plus, Share2, Sparkles, Trash2, Users, Video, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../api/services';

const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';
const LABEL = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';

const REMINDERS = ['10 min', '30 min', '1 hr', '2 hr', '1 day'];
const REMINDER_MIN = { '10 min': 10, '30 min': 30, '1 hr': 60, '2 hr': 120, '1 day': 1440 };

function Field({ label, children }) {
  return <div><label className={LABEL}>{label}</label>{children}</div>;
}

// ── Meeting Creator ─────────────────────────────────────────────────────────────
function MeetingCreator({ contacts, onCreated, onClose, prefill }) {
  const now = new Date();
  const [title, setTitle] = useState(prefill?.title || '');
  const [description, setDescription] = useState(prefill?.description || prefill?.notes || '');
  const [date, setDate] = useState(prefill?.date || now.toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(prefill?.startTime || prefill?.time || '10:00');
  const [endTime, setEndTime] = useState(prefill?.endTime || '11:00');
  const [mode, setMode] = useState(prefill?.mode || 'online');
  const [location, setLocation] = useState(prefill?.location || '');
  const [link, setLink] = useState(prefill?.link || '');
  const [reminder, setReminder] = useState('10 min');
  const [notifyPush, setNotifyPush] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifySMS, setNotifySMS] = useState(false);
  const [recipientIds, setRecipientIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id) => setRecipientIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  async function submit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Meeting title is required.'); return; }
    setError(''); setSaving(true);
    try {
      const starts_at = new Date(`${date}T${startTime}`).toISOString();
      const ends_at = new Date(`${date}T${endTime}`).toISOString();
      await smartflowApi.createCalendarEvent({
        title: title.trim(),
        description: description.trim() || undefined,
        starts_at, ends_at,
        meeting_mode: mode,
        location: mode === 'offline' ? location.trim() || undefined : undefined,
        meeting_link: mode === 'online' ? link.trim() || undefined : undefined,
        contact_ids: recipientIds,
        notify_via_push: notifyPush,
        notify_via_email: notifyEmail,
        notify_via_sms: notifySMS,
        reminder_minutes: REMINDER_MIN[reminder] || 10,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      onCreated?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Meeting could not be created.');
    } finally { setSaving(false); }
  }

  const Toggle = ({ label, value, onChange }) => (
    <div className="flex items-center justify-between p-3 bg-[#0A1019] border border-[#243246] rounded-xl">
      <span className="text-white text-sm font-semibold">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#11C7E5]' : 'bg-[#243041]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2 items-center"><AlertTriangle size={14}/>{error}</div>}
      
      <Field label="Meeting Title">
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Project Sync with Team" className={INPUT} required />
      </Field>
      <Field label="Description">
        <textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="Agenda or notes..." className={`${INPUT} min-h-20 resize-none`} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Date">
          <input type="date" value={date} onChange={e=>setDate(e.target.value)} className={INPUT} />
        </Field>
        <Field label="Start Time">
          <input type="time" value={startTime} onChange={e=>setStartTime(e.target.value)} className={INPUT} />
        </Field>
        <Field label="End Time">
          <input type="time" value={endTime} onChange={e=>setEndTime(e.target.value)} className={INPUT} />
        </Field>
      </div>

      {/* Mode */}
      <div className="grid grid-cols-2 gap-3">
        {['online','offline'].map(m => (
          <button key={m} type="button" onClick={()=>setMode(m)}
            className={`py-3 rounded-xl font-bold text-sm transition-all capitalize ${mode===m ? 'bg-[#11C7E5] text-[#02080B]' : 'bg-[#0A1019] border border-[#243246] text-[#A4B0B7]'}`}>
            {m === 'online' ? <><Video size={14} className="inline mr-1"/>Online</> : <><MapPin size={14} className="inline mr-1"/>Offline</>}
          </button>
        ))}
      </div>

      {mode === 'online'
        ? <Field label="Meeting Link"><input value={link} onChange={e=>setLink(e.target.value)} placeholder="https://meet.google.com/..." className={INPUT}/></Field>
        : <Field label="Location"><input value={location} onChange={e=>setLocation(e.target.value)} placeholder="HQ - Room 4, 2nd Floor" className={INPUT}/></Field>
      }

      {/* Recipients */}
      {contacts.length > 0 && (
        <div>
          <label className={LABEL}>Recipients ({recipientIds.length} selected)</label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
            {contacts.map(c => {
              const sel = recipientIds.includes(c.id);
              return (
                <button key={c.id} type="button" onClick={()=>toggle(c.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${sel ? 'border-[#11C7E5] bg-[#11C7E5]/10 text-[#11C7E5]' : 'border-[#243246] bg-[#0A1019] text-[#A4B0B7]'}`}>
                  <span className="w-5 h-5 rounded-full bg-[#243041] flex items-center justify-center text-[9px] text-[#11C7E5] font-black">
                    {(c.name||'?')[0].toUpperCase()}
                  </span>
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notify */}
      <div>
        <label className={LABEL}>Notify Via</label>
        <div className="space-y-2">
          <Toggle label="Push Notification" value={notifyPush} onChange={setNotifyPush} />
          <Toggle label="Email" value={notifyEmail} onChange={setNotifyEmail} />
          <Toggle label="SMS" value={notifySMS} onChange={setNotifySMS} />
        </div>
      </div>

      {/* Reminder */}
      <div>
        <label className={LABEL}>Reminder Time</label>
        <div className="flex flex-wrap gap-2">
          {REMINDERS.map(r => (
            <button key={r} type="button" onClick={()=>setReminder(r)}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${reminder===r ? 'border-[#11C7E5] bg-[#11C7E5]/10 text-[#11C7E5]' : 'border-[#243246] bg-[#0A1019] text-[#A4B0B7]'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <button disabled={saving}
        className="w-full py-4 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer">
        {saving ? <Loader2 size={18} className="animate-spin"/> : <CalendarDays size={18}/>}
        {saving ? 'Scheduling…' : 'Schedule Meeting'}
      </button>
    </form>
  );
}

// ── Event card ─────────────────────────────────────────────────────────────────
function EventCard({ item, onDelete, onShare }) {
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  async function share() {
    setSharing(true);
    try {
      await smartflowApi.shareCalendarEvent(item.id, {
        share_via: 'email',
        message: `You are invited to: ${item.title}`,
      });
      alert('Event shared!');
    } catch { alert('Share failed.'); }
    setSharing(false);
  }

  const start = item.starts_at ? new Date(item.starts_at) : null;
  const statusColor = item.meeting_mode === 'online' ? 'text-[#11C7E5]' : 'text-amber-400';

  return (
    <div className="border-b border-[#243041]/30 last:border-0">
      <div className="p-5 flex items-center justify-between hover:bg-[#1C2635]/10 transition-colors cursor-pointer" onClick={()=>setOpen(o=>!o)}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
              {item.meeting_mode || 'event'}
            </span>
          </div>
          <h3 className="font-bold text-white truncate text-sm">{item.title}</h3>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#A4B0B7]">
            {start && <span className="flex items-center gap-1"><Clock size={11}/>{start.toLocaleString()}</span>}
            {(item.meeting_link || item.location) && (
              <span className="flex items-center gap-1"><MapPin size={11}/>{item.meeting_link || item.location}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button onClick={e=>{e.stopPropagation(); share();}} disabled={sharing}
            className="p-2 text-[#11C7E5]/60 hover:text-[#11C7E5] hover:bg-[#11C7E5]/10 rounded-lg transition-all cursor-pointer">
            {sharing ? <Loader2 size={14} className="animate-spin"/> : <Share2 size={14}/>}
          </button>
          <button onClick={e=>{e.stopPropagation(); onDelete(item.id);}}
            className="p-2 text-rose-400/60 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-all cursor-pointer">
            <Trash2 size={14}/>
          </button>
          {open ? <ChevronUp size={15} className="text-[#A4B0B7]"/> : <ChevronDown size={15} className="text-[#A4B0B7]"/>}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.2}} className="overflow-hidden">
            <div className="px-5 pb-4 border-t border-[#243041]/30 pt-3 space-y-1.5 text-sm text-[#A4B0B7]">
              {item.description && <p>{item.description}</p>}
              {item.ends_at && <p className="flex items-center gap-1.5"><Clock size={12}/>Ends: {new Date(item.ends_at).toLocaleString()}</p>}
              {item.notify_via_push && <p className="flex items-center gap-1.5"><Bell size={12}/>Push notification enabled</p>}
              {item.notify_via_email && <p className="flex items-center gap-1.5"><Mail size={12}/>Email notification enabled</p>}
              {item.reminder_minutes && <p className="flex items-center gap-1.5"><Clock size={12}/>Reminder: {item.reminder_minutes} min before</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Calendar Stats ─────────────────────────────────────────────────────────────
function CalendarStats({ events }) {
  const online = events.filter(e => e.meeting_mode === 'online').length;
  const offline = events.filter(e => e.meeting_mode === 'offline').length;
  const upcoming = events.filter(e => e.starts_at && new Date(e.starts_at) > new Date()).length;

  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: 'Total Events', value: events.length, icon: CalIcon, color: '#11C7E5' },
        { label: 'Online Meetings', value: online, icon: Video, color: '#8B5CF6' },
        { label: 'Upcoming', value: upcoming, icon: Clock, color: '#10B981' },
      ].map(s => (
        <div key={s.label} className="bg-[#131A24] border border-[#243041] rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:`${s.color}18`}}>
            <s.icon size={18} style={{color:s.color}}/>
          </div>
          <div>
            <p className="text-[#A4B0B7] text-[10px] font-semibold uppercase tracking-wider">{s.label}</p>
            <p className="text-xl font-black text-white">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Calendar() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [prefillData, setPrefillData] = useState(null);

  useEffect(() => {
    if (location.state?.prefill) {
      setPrefillData(location.state.prefill);
      setShowCreate(true);
      // Clear state so it doesn't trigger on every re-render
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [evRes, ctRes] = await Promise.all([
        smartflowApi.getCalendarEvents({ page_size: 100 }),
        smartflowApi.getContacts().catch(()=>({ data: { data: { items: [] } } })),
      ]);
      setEvents(evRes.data?.data?.items || evRes.data?.data || []);
      setContacts(ctRes.data?.data?.items || ctRes.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Calendar events could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function deleteEvent(id) {
    try {
      await smartflowApi.deleteCalendarEvent(id);
      setEvents(ev => ev.filter(e => e.id !== id));
    } catch (err) { setError(err.response?.data?.message || 'Delete failed.'); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#243041]/40 pb-4">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Calendar</h1>
          <p className="text-[#A4B0B7] text-xs mt-1">Schedule meetings, set reminders, notify attendees — all from one place.</p>
        </div>
        <button onClick={()=>setShowCreate(s=>!s)}
          className="px-5 py-3 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-extrabold flex items-center gap-2 active:scale-95 transition-all cursor-pointer shrink-0">
          {showCreate ? <X size={18}/> : <Plus size={18}/>}
          {showCreate ? 'Close' : 'Schedule Meeting'}
        </button>
      </div>

      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">{error}</div>}

      {/* Stats */}
      {!loading && <CalendarStats events={events}/>}

      <div className={`grid gap-6 items-start ${showCreate ? 'grid-cols-1 xl:grid-cols-[1fr_420px]' : 'grid-cols-1'}`}>
        {/* Events List */}
        <div className="bg-[#131A24] border border-[#243041] rounded-[22px] overflow-hidden text-left order-2 xl:order-1">
          <div className="p-5 border-b border-[#243041]/40 flex items-center gap-2 font-bold text-white text-base">
            <CalendarDays size={20} className="text-[#11C7E5]"/> Upcoming Events
          </div>
          {loading
            ? Array(3).fill(0).map((_,i)=><div key={i} className="p-5 animate-pulse h-24 bg-[#1C2635]/20 border-b border-[#243041]/20"/>)
            : events.length
              ? events.map(item => (
                  <EventCard key={item.id} item={item} onDelete={deleteEvent}/>
                ))
              : (
                <div className="p-16 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center mx-auto mb-4">
                    <CalendarDays size={24} className="text-[#11C7E5]"/>
                  </div>
                  <p className="text-white font-bold">No events yet</p>
                  <p className="text-[#A4B0B7] text-sm mt-1">Click "Schedule Meeting" to create your first event.</p>
                </div>
              )
          }
        </div>

        {/* Create Panel */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} exit={{opacity:0,x:40}} transition={{duration:0.25}}
              className="order-1 xl:order-2 bg-[#131A24] border border-[#243041] rounded-[22px] p-6 max-h-[80vh] overflow-y-auto scrollbar-thin">
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#243041]/40">
                <h2 className="font-bold text-white flex items-center gap-2"><Sparkles size={16} className="text-[#11C7E5]"/>New Meeting</h2>
                <button type="button" onClick={()=>setShowCreate(false)} className="text-[#A4B0B7] hover:text-white p-1"><X size={16}/></button>
              </div>
              <MeetingCreator contacts={contacts} onCreated={fetchAll} onClose={()=>setShowCreate(false)} prefill={prefillData}/>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
