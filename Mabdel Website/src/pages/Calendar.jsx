import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Calendar as CalIcon,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Plus,
  Share2,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { smartflowApi } from '../api/services';
import { DatePickerInput, TimePickerInput } from '../components/ui/DateTimeInputs';

const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';
const LABEL = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';
const PANEL = 'bg-[#131A24] border border-[#243041] rounded-[22px]';
const REMINDERS = ['10 min', '30 min', '1 hr', '2 hr', '1 day'];
const REMINDER_MIN = { '10 min': 10, '30 min': 30, '1 hr': 60, '2 hr': 120, '1 day': 1440 };
const REMINDER_BY_MIN = { 10: '10 min', 30: '30 min', 60: '1 hr', 120: '2 hr', 1440: '1 day' };

function Field({ label, children }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

function normalizeListPayload(payload) {
  const body = payload?.data?.data ?? payload?.data ?? payload;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body)) return body;
  return [];
}

function normalizeEventPayload(payload) {
  return payload?.data?.data ?? payload?.data ?? payload ?? null;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateInput(value) {
  const date = parseDate(value) || new Date();
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInput(value, fallback = '10:00') {
  const date = parseDate(value);
  if (!date) return fallback;
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function combineLocalDateTime(date, time) {
  if (!date || !time) return null;
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTimeRange(event) {
  const startsAt = parseDate(event?.starts_at);
  const endsAt = parseDate(event?.ends_at);
  if (!startsAt) return 'Date unavailable';

  const sameDay = endsAt
    && startsAt.getFullYear() === endsAt.getFullYear()
    && startsAt.getMonth() === endsAt.getMonth()
    && startsAt.getDate() === endsAt.getDate();

  const startDate = startsAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const startTime = startsAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (!endsAt) return `${startDate} • ${startTime}`;

  const endDate = endsAt.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const endTime = endsAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  return sameDay
    ? `${startDate} • ${startTime} - ${endTime}`
    : `${startDate} ${startTime} - ${endDate} ${endTime}`;
}

function formatRelativeMeta(event) {
  const parts = [event?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone];
  if (event?.status) parts.push(event.status);
  if (event?.sync_status) parts.push(event.sync_status);
  return parts.filter(Boolean).join(' • ');
}

function getInitialFormState(prefill) {
  const defaultStart = new Date();
  defaultStart.setMinutes(0, 0, 0);
  defaultStart.setHours(defaultStart.getHours() + 1);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000);

  return {
    title: prefill?.title || '',
    description: prefill?.description || prefill?.notes || '',
    date: toDateInput(prefill?.starts_at || prefill?.date || defaultStart),
    startTime: toTimeInput(prefill?.starts_at || prefill?.time || defaultStart, '10:00'),
    endTime: toTimeInput(prefill?.ends_at || prefill?.endTime || defaultEnd, '11:00'),
    mode: prefill?.meeting_mode || prefill?.mode || 'online',
    location: prefill?.location || '',
    link: prefill?.meeting_link || prefill?.link || '',
    reminder: REMINDER_BY_MIN[prefill?.reminder_minutes] || '10 min',
    notifyPush: prefill?.notify_via_push ?? true,
    notifyEmail: prefill?.notify_via_email ?? false,
    notifySMS: prefill?.notify_via_sms ?? false,
    recipientIds: Array.isArray(prefill?.contact_ids) ? prefill.contact_ids : [],
  };
}

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 bg-[#0A1019] border border-[#243246] rounded-xl">
      <span className="text-white text-sm font-semibold">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#11C7E5]' : 'bg-[#243041]'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

function MeetingEditor({ contacts, event, prefill, onSaved, onCancel }) {
  const isEditing = Boolean(event?.id);
  const seed = useMemo(() => getInitialFormState(event || prefill || {}), [event, prefill]);
  const [title, setTitle] = useState(seed.title);
  const [description, setDescription] = useState(seed.description);
  const [date, setDate] = useState(seed.date);
  const [startTime, setStartTime] = useState(seed.startTime);
  const [endTime, setEndTime] = useState(seed.endTime);
  const [mode, setMode] = useState(seed.mode);
  const [location, setLocation] = useState(seed.location);
  const [link, setLink] = useState(seed.link);
  const [reminder, setReminder] = useState(seed.reminder);
  const [notifyPush, setNotifyPush] = useState(seed.notifyPush);
  const [notifyEmail, setNotifyEmail] = useState(seed.notifyEmail);
  const [notifySMS, setNotifySMS] = useState(seed.notifySMS);
  const [recipientIds, setRecipientIds] = useState(seed.recipientIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTitle(seed.title);
    setDescription(seed.description);
    setDate(seed.date);
    setStartTime(seed.startTime);
    setEndTime(seed.endTime);
    setMode(seed.mode);
    setLocation(seed.location);
    setLink(seed.link);
    setReminder(seed.reminder);
    setNotifyPush(seed.notifyPush);
    setNotifyEmail(seed.notifyEmail);
    setNotifySMS(seed.notifySMS);
    setRecipientIds(seed.recipientIds);
  }, [seed]);

  const toggleRecipient = (id) => {
    setRecipientIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  };

  async function submit(e) {
    e.preventDefault();
    const startsAt = combineLocalDateTime(date, startTime);
    const endsAt = combineLocalDateTime(date, endTime);

    if (!title.trim()) {
      setError('Meeting title is required.');
      return;
    }
    if (!startsAt || !endsAt) {
      setError('Meeting start and end time are required.');
      return;
    }
    if (endsAt <= startsAt) {
      setError('Meeting end time must be later than start time.');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      meeting_mode: mode,
      location: mode === 'offline' ? location.trim() || null : null,
      meeting_link: mode === 'online' ? link.trim() || null : null,
      contact_ids: recipientIds,
      notify_via_push: notifyPush,
      notify_via_email: notifyEmail,
      notify_via_sms: notifySMS,
      reminder_minutes: REMINDER_MIN[reminder] || 10,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    setError('');
    setSaving(true);
    try {
      const response = isEditing
        ? await smartflowApi.updateCalendarEvent(event.id, payload)
        : await smartflowApi.createCalendarEvent(payload);
      onSaved?.(normalizeEventPayload(response));
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error?.message || `Meeting could not be ${isEditing ? 'updated' : 'created'}.`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? (
        <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2 items-center">
          <AlertTriangle size={14} />
          {error}
        </div>
      ) : null}

      <Field label="Meeting Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Project Sync with Team" className={INPUT} required />
      </Field>

      <Field label="Description">
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Agenda or notes..." className={`${INPUT} min-h-20 resize-none`} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Date">
          <DatePickerInput value={date} onChange={setDate} className="focus:border-[#11C7E5]/50" />
        </Field>
        <Field label="Start Time">
          <TimePickerInput value={startTime} onChange={setStartTime} className="focus:border-[#11C7E5]/50" />
        </Field>
        <Field label="End Time">
          <TimePickerInput value={endTime} onChange={setEndTime} className="focus:border-[#11C7E5]/50" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {['online', 'offline'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`py-3 rounded-xl font-bold text-sm transition-all capitalize ${mode === option ? 'bg-[#11C7E5] text-[#02080B]' : 'bg-[#0A1019] border border-[#243246] text-[#A4B0B7]'}`}
          >
            {option === 'online' ? <><Video size={14} className="inline mr-1" />Online</> : <><MapPin size={14} className="inline mr-1" />Offline</>}
          </button>
        ))}
      </div>

      {mode === 'online' ? (
        <Field label="Meeting Link">
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." className={INPUT} />
        </Field>
      ) : (
        <Field label="Location">
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="HQ - Room 4, 2nd Floor" className={INPUT} />
        </Field>
      )}

      {contacts.length > 0 ? (
        <div>
          <label className={LABEL}>Attendees ({recipientIds.length} selected)</label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
            {contacts.map((contact) => {
              const selected = recipientIds.includes(contact.id);
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => toggleRecipient(contact.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${selected ? 'border-[#11C7E5] bg-[#11C7E5]/10 text-[#11C7E5]' : 'border-[#243246] bg-[#0A1019] text-[#A4B0B7]'}`}
                >
                  <span className="w-5 h-5 rounded-full bg-[#243041] flex items-center justify-center text-[9px] text-[#11C7E5] font-black">
                    {(contact.name || '?')[0].toUpperCase()}
                  </span>
                  {contact.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div>
        <label className={LABEL}>Notify Via</label>
        <div className="space-y-2">
          <Toggle label="Push Notification" value={notifyPush} onChange={setNotifyPush} />
          <Toggle label="Email" value={notifyEmail} onChange={setNotifyEmail} />
          <Toggle label="SMS" value={notifySMS} onChange={setNotifySMS} />
        </div>
      </div>

      <div>
        <label className={LABEL}>Reminder Time</label>
        <div className="flex flex-wrap gap-2">
          {REMINDERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setReminder(option)}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${reminder === option ? 'border-[#11C7E5] bg-[#11C7E5]/10 text-[#11C7E5]' : 'border-[#243246] bg-[#0A1019] text-[#A4B0B7]'}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-4 bg-[#0A1019] border border-[#243246] text-white rounded-xl font-bold cursor-pointer"
        >
          Cancel
        </button>
        <button
          disabled={saving}
          className="flex-1 py-4 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <CalendarDays size={18} />}
          {saving ? (isEditing ? 'Saving...' : 'Adding...') : (isEditing ? 'Save Changes' : 'Add to Calendar')}
        </button>
      </div>
    </form>
  );
}

function EventCard({ item, onOpen }) {
  const [open, setOpen] = useState(false);
  const startsAt = parseDate(item.starts_at);
  const detailText = formatDateTimeRange(item);
  const statusColor = item.meeting_mode === 'online' ? 'text-[#11C7E5]' : 'text-amber-400';

  return (
    <div className="border-b border-[#243041]/30 last:border-0">
      <div className="p-5 hover:bg-[#1C2635]/10 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left cursor-pointer">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                {item.meeting_mode || 'event'}
              </span>
              {item.sync_status === 'synced' ? <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">synced</span> : null}
            </div>
            <h3 className="font-bold text-white truncate text-sm">{item.title}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#A4B0B7]">
              <span className="flex items-center gap-1"><Clock size={11} />{detailText}</span>
              {(item.meeting_link || item.location) ? (
                <span className="flex items-center gap-1 min-w-0"><MapPin size={11} />{item.meeting_link || item.location}</span>
              ) : null}
              <span className="flex items-center gap-1"><Users size={11} />{item.attendee_count || 0} attendees</span>
            </div>
          </button>
          <button type="button" onClick={() => setOpen((current) => !current)} className="text-[#A4B0B7] hover:text-white p-2 cursor-pointer">
            {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-4 border-t border-[#243041]/30 pt-3 space-y-2 text-sm text-[#A4B0B7]">
              {item.description ? <p>{item.description}</p> : null}
              <p className="flex items-center gap-1.5"><Clock size={12} />{formatRelativeMeta(item)}</p>
              {startsAt ? <p className="flex items-center gap-1.5"><CalendarDays size={12} />Starts {startsAt.toLocaleString()}</p> : null}
              {item.notify_via_push ? <p className="flex items-center gap-1.5"><Bell size={12} />Push notification enabled</p> : null}
              {item.notify_via_email ? <p className="flex items-center gap-1.5"><Mail size={12} />Email notification enabled</p> : null}
              {item.reminder_minutes ? <p className="flex items-center gap-1.5"><Clock size={12} />Reminder: {item.reminder_minutes} min before</p> : null}
              <button type="button" onClick={() => onOpen(item.id)} className="pt-1 text-[#11C7E5] font-semibold cursor-pointer">
                View details
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CalendarStats({ events }) {
  const online = events.filter((event) => event.meeting_mode === 'online').length;
  const upcoming = events.filter((event) => parseDate(event.starts_at) && parseDate(event.starts_at) > new Date()).length;

  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        { label: 'Total Events', value: events.length, icon: CalIcon, color: '#11C7E5' },
        { label: 'Online Meetings', value: online, icon: Video, color: '#8B5CF6' },
        { label: 'Upcoming', value: upcoming, icon: Clock, color: '#10B981' },
      ].map((stat) => (
        <div key={stat.label} className={`${PANEL} p-4 flex items-center gap-3`}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${stat.color}18` }}>
            <stat.icon size={18} style={{ color: stat.color }} />
          </div>
          <div>
            <p className="text-[#A4B0B7] text-[10px] font-semibold uppercase tracking-wider">{stat.label}</p>
            <p className="text-xl font-black text-white">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function buildICSFile(event) {
  const startsAt = parseDate(event?.starts_at);
  const endsAt = parseDate(event?.ends_at);
  if (!startsAt || !endsAt) return null;

  const formatUtc = (date) => (
    `${date.getUTCFullYear()}${`${date.getUTCMonth() + 1}`.padStart(2, '0')}${`${date.getUTCDate()}`.padStart(2, '0')}T${`${date.getUTCHours()}`.padStart(2, '0')}${`${date.getUTCMinutes()}`.padStart(2, '0')}${`${date.getUTCSeconds()}`.padStart(2, '0')}Z`
  );

  const escapeValue = (value) => String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mabdel AI//Calendar Event//EN',
    'BEGIN:VEVENT',
    `UID:${event.id || `${Date.now()}@mabdel.ai`}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(startsAt)}`,
    `DTEND:${formatUtc(endsAt)}`,
    `SUMMARY:${escapeValue(event.title)}`,
    `DESCRIPTION:${escapeValue(event.description || '')}`,
    `LOCATION:${escapeValue(event.location || event.meeting_link || '')}`,
    event.meeting_link ? `URL:${escapeValue(event.meeting_link)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

function EventDetailsModal({ eventId, onClose, onDeleted, onSaved }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [contacts, setContacts] = useState([]);

  const fetchDetails = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError('');
    try {
      const [eventResponse, contactsResponse] = await Promise.all([
        smartflowApi.getCalendarEvent(eventId),
        smartflowApi.getContacts({ page_size: 100 }).catch(() => ({ data: { data: { items: [] } } })),
      ]);
      setEvent(normalizeEventPayload(eventResponse));
      setContacts(normalizeListPayload(contactsResponse));
    } catch (err) {
      setError(err.response?.data?.message || 'Meeting details could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  async function handleDelete() {
    if (!event?.id) return;
    if (!window.confirm(`Delete "${event.title}"?`)) return;

    setDeleting(true);
    try {
      await smartflowApi.deleteCalendarEvent(event.id);
      onDeleted?.(event.id);
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleShare() {
    if (!event?.id) return;
    setSharing(true);
    setError('');
    try {
      const response = await smartflowApi.shareCalendarEvent(event.id, { channel: 'link' });
      const share = normalizeEventPayload(response);
      const shareUrl = share?.share_url || share?.shareUrl;
      const message = [
        event.title,
        formatDateTimeRange(event),
        event.meeting_link || event.location || '',
        shareUrl || '',
      ].filter(Boolean).join('\n');

      if (navigator.share) {
        await navigator.share({ title: event.title, text: message, url: shareUrl || undefined });
      } else if (shareUrl && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        window.alert('Meeting link copied to clipboard.');
      } else {
        window.alert(shareUrl || message);
      }
      setEvent((current) => ({ ...current, share_url: shareUrl || current?.share_url || null }));
    } catch (err) {
      setError(err.response?.data?.message || 'Share failed.');
    } finally {
      setSharing(false);
    }
  }

  function handleAppleExport() {
    if (!event) return;
    const content = buildICSFile(event);
    if (!content) {
      setError('This event does not have valid time data for calendar export.');
      return;
    }
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(event.title || 'meeting').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-50 p-4 flex items-center justify-center">
      <div className={`${PANEL} w-full max-w-4xl max-h-[90vh] overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#243041]/40">
          <div>
            <h2 className="font-bold text-white text-lg">Meeting Details</h2>
            <p className="text-[#A4B0B7] text-xs mt-1">Live data from the calendar service.</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#A4B0B7] hover:text-white p-2 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-82px)]">
          {loading ? (
            <div className="h-48 flex items-center justify-center gap-3 text-[#A4B0B7]">
              <Loader2 size={20} className="animate-spin" />
              Loading meeting details...
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
              {error}
            </div>
          ) : editing ? (
            <MeetingEditor
              contacts={contacts}
              event={event}
              onCancel={() => setEditing(false)}
              onSaved={(updated) => {
                setEvent(updated);
                setEditing(false);
                onSaved?.(updated);
              }}
            />
          ) : event ? (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${event.meeting_mode === 'online' ? 'text-[#11C7E5]' : 'text-amber-400'}`}>
                      {event.meeting_mode}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{event.sync_status}</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-white">{event.title}</h3>
                  <p className="text-[#A4B0B7]">{formatDateTimeRange(event)}</p>
                  <p className="text-[#6F8092] text-sm">{formatRelativeMeta(event)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl bg-[#0A1019] border border-[#243246] text-white font-semibold cursor-pointer">
                    Edit
                  </button>
                  <button type="button" onClick={handleShare} disabled={sharing} className="px-4 py-2 rounded-xl bg-[#11C7E5] text-[#02080B] font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60">
                    {sharing ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                    Share
                  </button>
                  <button type="button" onClick={handleAppleExport} className="px-4 py-2 rounded-xl bg-[#0A1019] border border-[#243246] text-white font-semibold flex items-center gap-2 cursor-pointer">
                    <ExternalLink size={15} />
                    Apple Calendar
                  </button>
                  <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60">
                    {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className={`${PANEL} p-4 space-y-3`}>
                  <div className="flex items-start gap-3">
                    <Clock size={16} className="text-[#11C7E5] mt-1" />
                    <div>
                      <p className="text-white font-semibold">Date & Time</p>
                      <p className="text-[#A4B0B7] text-sm">{formatDateTimeRange(event)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-[#11C7E5] mt-1" />
                    <div>
                      <p className="text-white font-semibold">{event.meeting_mode === 'online' ? 'Meeting Link' : 'Location'}</p>
                      <p className="text-[#A4B0B7] text-sm break-all">{event.meeting_mode === 'online' ? (event.meeting_link || 'Auto-generated when available') : (event.location || 'Not provided')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Bell size={16} className="text-[#11C7E5] mt-1" />
                    <div>
                      <p className="text-white font-semibold">Reminder</p>
                      <p className="text-[#A4B0B7] text-sm">{event.reminder_minutes ? `${event.reminder_minutes} min before` : 'No reminder'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Link2 size={16} className="text-[#11C7E5] mt-1" />
                    <div>
                      <p className="text-white font-semibold">Share Link</p>
                      <p className="text-[#A4B0B7] text-sm break-all">{event.share_url || 'Generate via Share'}</p>
                    </div>
                  </div>
                </div>

                <div className={`${PANEL} p-4 space-y-3`}>
                  <div className="flex items-start gap-3">
                    <Users size={16} className="text-[#11C7E5] mt-1" />
                    <div className="min-w-0">
                      <p className="text-white font-semibold">Attendees</p>
                      {event.attendees?.length ? (
                        <div className="mt-2 space-y-2">
                          {event.attendees.map((attendee) => (
                            <div key={attendee.id} className="flex items-center gap-2 text-sm text-[#A4B0B7]">
                              <span className="w-7 h-7 rounded-full bg-[#243041] text-[#11C7E5] text-[11px] font-bold flex items-center justify-center">
                                {attendee.initials}
                              </span>
                              <span>{attendee.name}</span>
                              {attendee.email ? <span className="text-[#6F8092] truncate">{attendee.email}</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[#A4B0B7] text-sm">No attendees selected</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <UserRound size={16} className="text-[#11C7E5] mt-1" />
                    <div>
                      <p className="text-white font-semibold">Organizer</p>
                      <p className="text-[#A4B0B7] text-sm">Current signed-in workspace owner</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarDays size={16} className="text-[#11C7E5] mt-1" />
                    <div>
                      <p className="text-white font-semibold">Created / Updated</p>
                      <p className="text-[#A4B0B7] text-sm">{event.created_at ? new Date(event.created_at).toLocaleString() : 'Unavailable'}</p>
                      <p className="text-[#6F8092] text-xs mt-1">{event.updated_at ? `Updated ${new Date(event.updated_at).toLocaleString()}` : ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${PANEL} p-4`}>
                <p className="text-white font-semibold mb-2">Description</p>
                <p className="text-[#A4B0B7] text-sm whitespace-pre-wrap">{event.description || 'No description provided.'}</p>
              </div>
            </div>
          ) : (
            <div className="text-[#A4B0B7]">Meeting not found.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarSyncPanel({ googleConnected, googleNeedsReauth, integrationsLoading, onConnectGoogle }) {
  const label = googleNeedsReauth ? 'Reconnect Google Calendar' : googleConnected ? 'Google Connected' : 'Connect Google Calendar';
  return (
    <div className={`${PANEL} p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4`}>
      <div>
        <h2 className="font-bold text-white text-base">Calendar Providers</h2>
        <p className="text-[#A4B0B7] text-sm mt-1">
          Google uses the existing backend OAuth flow. Apple Calendar is supported as one-time `.ics` export from the meeting details panel.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onConnectGoogle}
          disabled={integrationsLoading}
          className={`px-4 py-3 rounded-xl bg-[#0A1019] border font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60 ${googleNeedsReauth ? 'border-amber-500/40 text-amber-300' : 'border-[#243246] text-white'}`}
        >
          {integrationsLoading ? (
            <Loader2 size={15} className="animate-spin" />
          ) : googleNeedsReauth ? (
            <AlertTriangle size={15} className="text-amber-400" />
          ) : googleConnected ? (
            <CheckCircle2 size={15} className="text-emerald-400" />
          ) : (
            <Link2 size={15} />
          )}
          {label}
        </button>
        <div className="px-4 py-3 rounded-xl bg-[#0A1019] border border-[#243246] text-[#A4B0B7] text-sm">
          Apple Calendar: `.ics` export
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const location = useLocation();
  const navigate = useNavigate();

  const [events, setEvents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [prefillData, setPrefillData] = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleNeedsReauth, setGoogleNeedsReauth] = useState(false);
  const [integrationsLoading, setIntegrationsLoading] = useState(true);

  useEffect(() => {
    if (location.state?.prefill) {
      setPrefillData(location.state.prefill);
      setShowCreate(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [eventsResponse, contactsResponse] = await Promise.all([
        smartflowApi.getCalendarEvents({ page_size: 100, upcoming_only: true }),
        smartflowApi.getContacts({ page_size: 100 }).catch(() => ({ data: { data: { items: [] } } })),
      ]);

      const normalizedEvents = normalizeListPayload(eventsResponse)
        .filter((item) => {
          const startsAt = parseDate(item.starts_at);
          return startsAt ? startsAt >= new Date(Date.now() - 60 * 1000) : true;
        })
        .sort((left, right) => {
          const leftDate = parseDate(left.starts_at)?.getTime() || 0;
          const rightDate = parseDate(right.starts_at)?.getTime() || 0;
          return leftDate - rightDate;
        });

      setEvents(normalizedEvents);
      setContacts(normalizeListPayload(contactsResponse));
    } catch (err) {
      setError(err.response?.data?.message || 'Calendar events could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIntegrationState = useCallback(async () => {
    try {
      setIntegrationsLoading(true);
      const response = await smartflowApi.getIntegrationStatus();
      const items = normalizeListPayload(response);
      const google = items.find((item) => item.platform === 'google_business');
      setGoogleConnected(Boolean(google?.connected));
      setGoogleNeedsReauth(google?.health_status === 'needs_reauth' || google?.sync_status === 'needs_reauth');
    } catch {
      setGoogleConnected(false);
      setGoogleNeedsReauth(false);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    fetchIntegrationState();
  }, [fetchAll, fetchIntegrationState]);

  async function handleGoogleConnect() {
    try {
      const response = await smartflowApi.startIntegrationOAuth('google_business');
      const authUrl = response?.data?.data?.auth_url || response?.data?.auth_url;
      if (!authUrl) {
        window.alert('Did not receive authorization URL from server.');
        return;
      }
      const popup = window.open(authUrl, 'mabdel-google-calendar', 'width=640,height=820,noopener,noreferrer');
      const startedAt = Date.now();
      const timer = window.setInterval(async () => {
        const closed = !popup || popup.closed;
        const expired = Date.now() - startedAt > 10 * 60 * 1000;
        if (!closed && !expired) return;
        window.clearInterval(timer);
        await fetchIntegrationState();
        await fetchAll();
      }, 1500);
    } catch (err) {
      window.alert(err.response?.data?.message || 'Google Calendar connection could not be started.');
    }
  }

  useEffect(() => {
    const onFocus = () => {
      fetchIntegrationState();
      fetchAll();
    };
    const onMessage = (event) => {
      if (event?.data?.type === 'mabdel-google-calendar-oauth') {
        fetchIntegrationState();
        fetchAll();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('message', onMessage);
    };
  }, [fetchAll, fetchIntegrationState]);

  function handleEventSaved(saved) {
    if (!saved?.id) {
      fetchAll();
      return;
    }
    setEvents((current) => {
      const next = current.some((event) => event.id === saved.id)
        ? current.map((event) => (event.id === saved.id ? saved : event))
        : [...current, saved];
      return next
        .filter((item) => {
          const startsAt = parseDate(item.starts_at);
          return startsAt ? startsAt >= new Date(Date.now() - 60 * 1000) : true;
        })
        .sort((left, right) => (parseDate(left.starts_at)?.getTime() || 0) - (parseDate(right.starts_at)?.getTime() || 0));
    });
    setShowCreate(false);
    setPrefillData(null);
  }

  function handleEventDeleted(eventId) {
    setEvents((current) => current.filter((event) => event.id !== eventId));
    setSelectedEventId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#243041]/40 pb-4">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Calendar</h1>
          <p className="text-[#A4B0B7] text-xs mt-1">Schedule meetings, set reminders, notify attendees - all from one place.</p>
        </div>
        <button
          onClick={() => {
            setPrefillData(null);
            setShowCreate((current) => !current);
          }}
          className="px-5 py-3 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-extrabold flex items-center gap-2 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          {showCreate ? <X size={18} /> : <Plus size={18} />}
          {showCreate ? 'Close' : 'Add to Calendar'}
        </button>
      </div>

      {error ? (
        <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
          {error}
        </div>
      ) : null}

      <CalendarSyncPanel
        googleConnected={googleConnected}
        googleNeedsReauth={googleNeedsReauth}
        integrationsLoading={integrationsLoading}
        onConnectGoogle={handleGoogleConnect}
      />

      {!loading ? <CalendarStats events={events} /> : null}

      <div className={`grid gap-6 items-start ${showCreate ? 'grid-cols-1 xl:grid-cols-[1fr_420px]' : 'grid-cols-1'}`}>
        <div className={`${PANEL} overflow-hidden text-left order-2 xl:order-1`}>
          <div className="p-5 border-b border-[#243041]/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-white text-base">
              <CalendarDays size={20} className="text-[#11C7E5]" />
              Upcoming Events
            </div>
            <button type="button" onClick={fetchAll} className="text-sm text-[#11C7E5] font-semibold cursor-pointer">
              Refresh
            </button>
          </div>

          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="p-5 animate-pulse h-24 bg-[#1C2635]/20 border-b border-[#243041]/20" />
            ))
          ) : events.length ? (
            events.map((item) => (
              <EventCard key={item.id} item={item} onOpen={setSelectedEventId} />
            ))
          ) : (
            <div className="p-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center mx-auto mb-4">
                <CalendarDays size={24} className="text-[#11C7E5]" />
              </div>
              <p className="text-white font-bold">No upcoming events</p>
              <p className="text-[#A4B0B7] text-sm mt-1">Create a meeting to see it here and on the dashboard.</p>
            </div>
          )}
        </div>

        <AnimatePresence>
          {showCreate ? (
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.25 }}
              className={`order-1 xl:order-2 ${PANEL} p-6 max-h-[80vh] overflow-y-auto scrollbar-thin`}
            >
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#243041]/40">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-[#11C7E5]" />
                  New Meeting
                </h2>
                <button type="button" onClick={() => setShowCreate(false)} className="text-[#A4B0B7] hover:text-white p-1 cursor-pointer">
                  <X size={16} />
                </button>
              </div>
              <MeetingEditor
                contacts={contacts}
                prefill={prefillData}
                onCancel={() => {
                  setShowCreate(false);
                  setPrefillData(null);
                }}
                onSaved={handleEventSaved}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedEventId ? (
          <EventDetailsModal
            eventId={selectedEventId}
            onClose={() => setSelectedEventId(null)}
            onDeleted={handleEventDeleted}
            onSaved={handleEventSaved}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
