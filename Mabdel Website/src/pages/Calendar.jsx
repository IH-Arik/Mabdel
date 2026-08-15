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
import { formatCstDate, formatCstDateTime, formatCstTime } from '../utils/dateUtils';
import { useLanguage } from '../context/LanguageContext';

const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#9333ea]/50 transition-colors text-sm placeholder:text-[#4A5568]';
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

function formatDateTimeRange(event, t) {
  const startsAt = parseDate(event?.starts_at);
  const endsAt = parseDate(event?.ends_at);
  if (!startsAt) return t ? t('cal_date_unavailable') : 'Date unavailable';

  const sameDay = endsAt
    && startsAt.getFullYear() === endsAt.getFullYear()
    && startsAt.getMonth() === endsAt.getMonth()
    && startsAt.getDate() === endsAt.getDate();

  const startDate = formatCstDate(startsAt);
  const startTime = formatCstTime(startsAt);

  if (!endsAt) return `${startDate} • ${startTime}`;

  const endDate = formatCstDate(endsAt);
  const endTime = formatCstTime(endsAt);

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
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#9333ea]' : 'bg-[#243041]'}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
    </div>
  );
}

function MeetingEditor({ contacts, event, prefill, onSaved, onCancel, googleConnected = false }) {
  const { t } = useLanguage();
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
      setError(t('cal_err_title_required'));
      return;
    }
    if (!startsAt || !endsAt) {
      setError(t('cal_err_times_required'));
      return;
    }
    if (endsAt <= startsAt) {
      setError(t('cal_err_end_after_start'));
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
      setError(err.response?.data?.message || err.response?.data?.error?.message || t('cal_err_save_failed', { action: isEditing ? t('cal_action_updated') : t('cal_action_created') }));
    } finally {
      setSaving(false);
    }
  }

  const getReminderLabel = (remKey) => {
    switch (remKey) {
      case '10 min': return t('cal_rem_10min');
      case '30 min': return t('cal_rem_30min');
      case '1 hr': return t('cal_rem_1hr');
      case '2 hr': return t('cal_rem_2hr');
      case '1 day': return t('cal_rem_1day');
      default: return remKey;
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-left">
      {error ? (
        <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2 items-center">
          <AlertTriangle size={14} />
          {error}
        </div>
      ) : null}

      <Field label={t('cal_lbl_meeting_title')}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('cal_ph_meeting_title')} className={INPUT} required />
      </Field>

      <Field label={t('cal_lbl_description')}>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('cal_ph_description')} className={`${INPUT} min-h-20 resize-none`} />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={t('cal_lbl_date')}>
          <DatePickerInput value={date} onChange={setDate} className="focus:border-[#9333ea]/50" />
        </Field>
        <Field label={t('cal_lbl_start_time')}>
          <TimePickerInput value={startTime} onChange={setStartTime} className="focus:border-[#9333ea]/50" />
        </Field>
        <Field label={t('cal_lbl_end_time')}>
          <TimePickerInput value={endTime} onChange={setEndTime} className="focus:border-[#9333ea]/50" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {['online', 'offline'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMode(option)}
            className={`py-3 rounded-xl font-bold text-sm transition-all capitalize cursor-pointer ${mode === option ? 'bg-[#9333ea] text-[#02080B]' : 'bg-[#0A1019] border border-[#243246] text-[#A4B0B7]'}`}
          >
            {option === 'online' ? <><Video size={14} className="inline mr-1" />{t('cal_opt_online')}</> : <><MapPin size={14} className="inline mr-1" />{t('cal_opt_offline')}</>}
          </button>
        ))}
      </div>

      {mode === 'online' ? (
        googleConnected ? (
          <div className="flex items-center gap-2.5 p-3 bg-[#0A1019] border border-[#9333ea]/25 rounded-xl">
            <Video size={15} className="text-[#9333ea] shrink-0" />
            <p className="text-[#A4B0B7] text-xs leading-5">
              <span className="text-white font-semibold">{t('cal_lbl_google_meet_link')}</span>
              {t('cal_google_meet_hint')}
            </p>
          </div>
        ) : (
          <Field label={t('cal_lbl_meeting_link')}>
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/..." className={INPUT} />
          </Field>
        )
      ) : (
        <Field label={t('cal_lbl_location')}>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="HQ - Room 4, 2nd Floor" className={INPUT} />
        </Field>
      )}

      {contacts.length > 0 ? (
        <div>
          <label className={LABEL}>{t('cal_lbl_attendees_selected', { count: recipientIds.length })}</label>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
            {contacts.map((contact) => {
              const selected = recipientIds.includes(contact.id);
              return (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => toggleRecipient(contact.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${selected ? 'border-[#9333ea] bg-[#9333ea]/10 text-[#9333ea]' : 'border-[#243246] bg-[#0A1019] text-[#A4B0B7]'}`}
                >
                  <span className="w-5 h-5 rounded-full bg-[#243041] flex items-center justify-center text-[9px] text-[#9333ea] font-black">
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
        <label className={LABEL}>{t('cal_lbl_notify_via')}</label>
        <div className="space-y-2">
          <Toggle label={t('cal_lbl_push_notification')} value={notifyPush} onChange={setNotifyPush} />
          <Toggle label={t('cal_lbl_email')} value={notifyEmail} onChange={setNotifyEmail} />
          <Toggle label={t('cal_lbl_sms')} value={notifySMS} onChange={setNotifySMS} />
        </div>
      </div>

      <div>
        <label className={LABEL}>{t('cal_lbl_reminder_time')}</label>
        <div className="flex flex-wrap gap-2">
          {REMINDERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setReminder(option)}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all cursor-pointer ${reminder === option ? 'border-[#9333ea] bg-[#9333ea]/10 text-[#9333ea]' : 'border-[#243246] bg-[#0A1019] text-[#A4B0B7]'}`}
            >
              {getReminderLabel(option)}
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
          {t('cal_btn_cancel')}
        </button>
        <button
          disabled={saving}
          className="flex-1 py-4 bg-[#9333ea] text-[#02080B] hover:bg-[#a855f7] rounded-xl font-extrabold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <CalendarDays size={18} />}
          {saving ? (isEditing ? t('cal_saving') : t('cal_adding')) : (isEditing ? t('cal_btn_save_changes') : t('cal_btn_add_to_calendar'))}
        </button>
      </div>
    </form>
  );
}

function EventCard({ item, onOpen }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const startsAt = parseDate(item.starts_at);
  const detailText = formatDateTimeRange(item, t);
  const statusColor = item.meeting_mode === 'online' ? 'text-[#9333ea]' : 'text-amber-400';

  return (
    <div className="border-b border-[#243041]/30 last:border-0 text-left">
      <div className="p-5 hover:bg-[#1C2635]/10 transition-colors">
        <div className="flex items-start justify-between gap-4">
          <button type="button" onClick={() => onOpen(item.id)} className="min-w-0 flex-1 text-left cursor-pointer">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>
                {item.meeting_mode || t('cal_lbl_event')}
              </span>
              {item.sync_status === 'synced' ? <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{t('cal_lbl_synced')}</span> : null}
            </div>
            <h3 className="font-bold text-white truncate text-sm">{item.title}</h3>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-[#A4B0B7]">
              <span className="flex items-center gap-1"><Clock size={11} />{detailText}</span>
              {(item.meeting_link || item.location) ? (
                <span className="flex items-center gap-1 min-w-0"><MapPin size={11} />{item.meeting_link || item.location}</span>
              ) : null}
              <span className="flex items-center gap-1"><Users size={11} />{t('cal_attendees_count', { n: item.attendee_count || 0 })}</span>
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
              {startsAt ? <p className="flex items-center gap-1.5"><CalendarDays size={12} />{t('cal_starts_at', { time: formatCstDateTime(startsAt) })}</p> : null}
              {item.notify_via_push ? <p className="flex items-center gap-1.5"><Bell size={12} />{t('cal_push_enabled')}</p> : null}
              {item.notify_via_email ? <p className="flex items-center gap-1.5"><Mail size={12} />{t('cal_email_enabled')}</p> : null}
              {item.reminder_minutes ? <p className="flex items-center gap-1.5"><Clock size={12} />{t('cal_reminder_minutes_before', { n: item.reminder_minutes })}</p> : null}
              <button type="button" onClick={() => onOpen(item.id)} className="pt-1 text-[#9333ea] font-semibold cursor-pointer">
                {t('cal_btn_view_details')}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CalendarStats({ events }) {
  const { t } = useLanguage();
  const online = events.filter((event) => event.meeting_mode === 'online').length;
  const upcoming = events.filter((event) => parseDate(event.starts_at) && parseDate(event.starts_at) > new Date()).length;

  return (
    <div className="grid grid-cols-3 gap-4 text-left">
      {[
        { label: t('cal_stat_total_events'), value: events.length, icon: CalIcon, color: '#9333ea' },
        { label: t('cal_stat_online_meetings'), value: online, icon: Video, color: '#8B5CF6' },
        { label: t('cal_stat_upcoming'), value: upcoming, icon: Clock, color: '#10B981' },
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
    'PRODID:-//Gocustify//Calendar Event//EN',
    'BEGIN:VEVENT',
    `UID:${event.id || `${Date.now()}@gocustify.com`}`,
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

function EventDetailsModal({ eventId, onClose, onDeleted, onSaved, googleConnected = false }) {
  const { t } = useLanguage();
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
      setError(err.response?.data?.message || t('cal_err_load_details'));
    }
  }, [eventId, t]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  async function handleDelete() {
    if (!event?.id) return;
    if (!window.confirm(t('cal_confirm_delete', { title: event.title }))) return;

    setDeleting(true);
    try {
      await smartflowApi.deleteCalendarEvent(event.id);
      onDeleted?.(event.id);
    } catch (err) {
      setError(err.response?.data?.message || t('cal_err_delete'));
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
        formatDateTimeRange(event, t),
        event.meeting_link || event.location || '',
        shareUrl || '',
      ].filter(Boolean).join('\n');

      if (navigator.share) {
        await navigator.share({ title: event.title, text: message, url: shareUrl || undefined });
      } else if (shareUrl && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        window.alert(t('cal_msg_link_copied'));
      } else {
        window.alert(shareUrl || message);
      }
      setEvent((current) => ({ ...current, share_url: shareUrl || current?.share_url || null }));
    } catch (err) {
      setError(err.response?.data?.message || t('cal_err_share'));
    } finally {
      setSharing(false);
    }
  }

  function handleAppleExport() {
    if (!event) return;
    const content = buildICSFile(event);
    if (!content) {
      setError(t('cal_err_invalid_time_export'));
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
    <div className="fixed inset-0 bg-black/70 z-50 p-4 flex items-center justify-center text-left">
      <div className={`${PANEL} w-full max-w-4xl max-h-[90vh] overflow-hidden`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#243041]/40">
          <div>
            <h2 className="font-bold text-white text-lg">{t('cal_details_title')}</h2>
            <p className="text-[#A4B0B7] text-xs mt-1">{t('cal_details_subtitle')}</p>
          </div>
          <button type="button" onClick={onClose} className="text-[#A4B0B7] hover:text-white p-2 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-82px)]">
          {loading ? (
            <div className="h-48 flex items-center justify-center gap-3 text-[#A4B0B7]">
              <Loader2 size={20} className="animate-spin" />
              {t('cal_loading_details')}
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
              {error}
            </div>
          ) : editing ? (
            <MeetingEditor
              contacts={contacts}
              event={event}
              googleConnected={googleConnected}
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
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${event.meeting_mode === 'online' ? 'text-[#9333ea]' : 'text-amber-400'}`}>
                      {event.meeting_mode}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">{event.sync_status}</span>
                  </div>
                  <h3 className="text-2xl font-extrabold text-white">{event.title}</h3>
                  <p className="text-[#A4B0B7]">{formatDateTimeRange(event, t)}</p>
                  <p className="text-[#6F8092] text-sm">{formatRelativeMeta(event)}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl bg-[#0A1019] border border-[#243246] text-white font-semibold cursor-pointer">
                    {t('cal_btn_edit')}
                  </button>
                  <button type="button" onClick={handleShare} disabled={sharing} className="px-4 py-2 rounded-xl bg-[#9333ea] text-[#02080B] font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60">
                    {sharing ? <Loader2 size={15} className="animate-spin" /> : <Share2 size={15} />}
                    {t('cal_btn_share')}
                  </button>
                  <button type="button" onClick={handleAppleExport} className="px-4 py-2 rounded-xl bg-[#0A1019] border border-[#243246] text-white font-semibold flex items-center gap-2 cursor-pointer">
                    <ExternalLink size={15} />
                    {t('cal_btn_apple_calendar')}
                  </button>
                  <button type="button" onClick={handleDelete} disabled={deleting} className="px-4 py-2 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60">
                    {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    {t('cal_btn_delete')}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className={`${PANEL} p-4 space-y-3`}>
                  <div className="flex items-start gap-3">
                    <Clock size={16} className="text-[#9333ea] mt-1" />
                    <div>
                      <p className="text-white font-semibold">{t('cal_lbl_date_time')}</p>
                      <p className="text-[#A4B0B7] text-sm">{formatDateTimeRange(event, t)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-[#9333ea] mt-1" />
                    <div>
                      <p className="text-white font-semibold">{event.meeting_mode === 'online' ? t('cal_lbl_meeting_link') : t('cal_lbl_location')}</p>
                      <p className="text-[#A4B0B7] text-sm break-all">{event.meeting_mode === 'online' ? (event.meeting_link || t('cal_auto_generated')) : (event.location || t('cal_not_provided'))}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Bell size={16} className="text-[#9333ea] mt-1" />
                    <div>
                      <p className="text-white font-semibold">{t('cal_lbl_reminder')}</p>
                      <p className="text-[#A4B0B7] text-sm">{event.reminder_minutes ? t('cal_min_before', { n: event.reminder_minutes }) : t('cal_no_reminder')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Link2 size={16} className="text-[#9333ea] mt-1" />
                    <div>
                      <p className="text-white font-semibold">{t('cal_lbl_share_link')}</p>
                      <p className="text-[#A4B0B7] text-sm break-all">{event.share_url || t('cal_generate_via_share')}</p>
                    </div>
                  </div>
                </div>

                <div className={`${PANEL} p-4 space-y-3`}>
                  <div className="flex items-start gap-3">
                    <Users size={16} className="text-[#9333ea] mt-1" />
                    <div className="min-w-0">
                      <p className="text-white font-semibold">{t('cal_lbl_attendees')}</p>
                      {event.attendees?.length ? (
                        <div className="mt-2 space-y-2">
                          {event.attendees.map((attendee) => (
                            <div key={attendee.id} className="flex items-center gap-2 text-sm text-[#A4B0B7]">
                              <span className="w-7 h-7 rounded-full bg-[#243041] text-[#9333ea] text-[11px] font-bold flex items-center justify-center">
                                {attendee.initials}
                              </span>
                              <span>{attendee.name}</span>
                              {attendee.email ? <span className="text-[#6F8092] truncate">{attendee.email}</span> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[#A4B0B7] text-sm">{t('cal_no_attendees')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <UserRound size={16} className="text-[#9333ea] mt-1" />
                    <div>
                      <p className="text-white font-semibold">{t('cal_lbl_organizer')}</p>
                      <p className="text-[#A4B0B7] text-sm">{t('cal_signed_in_owner')}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CalendarDays size={16} className="text-[#9333ea] mt-1" />
                    <div>
                      <p className="text-white font-semibold">{t('cal_lbl_created_updated')}</p>
                      <p className="text-[#A4B0B7] text-sm">{event.created_at ? formatCstDateTime(event.created_at) : t('cal_unavailable')}</p>
                      <p className="text-[#6F8092] text-xs mt-1">{event.updated_at ? t('cal_updated_time', { time: formatCstDateTime(event.updated_at) }) : ''}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${PANEL} p-4`}>
                <p className="text-white font-semibold mb-2">{t('cal_lbl_description')}</p>
                <p className="text-[#A4B0B7] text-sm whitespace-pre-wrap">{event.description || t('cal_no_description')}</p>
              </div>
            </div>
          ) : (
            <div className="text-[#A4B0B7]">{t('cal_meeting_not_found')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function CalendarSyncPanel({
  googleConnected,
  googleNeedsReauth,
  googleSyncMode,
  integrationsLoading,
  onConnectGoogle,
  onDisconnectGoogle,
  appleConnected,
  appleUsername,
  appleLoading,
  onConnectApple,
  onDisconnectApple,
  zoomConnected,
  zoomNeedsReauth,
  onConnectZoom,
  onDisconnectZoom,
  primaryProvider,
  providerSettingsLoading,
  onChangePrimaryProvider,
}) {
  const { t } = useLanguage();
  const label = googleNeedsReauth ? t('cal_btn_reconnect_google') : googleConnected ? t('cal_btn_google_connected') : t('cal_btn_connect_google');
  const zoomLabel = zoomNeedsReauth ? t('cal_btn_reconnect_zoom') : zoomConnected ? t('cal_btn_zoom_connected') : t('cal_btn_connect_zoom');

  const connectedOptions = [
    appleConnected ? { value: 'caldav', label: t('cal_provider_apple') } : null,
    googleConnected ? { value: 'google_business', label: t('cal_provider_google') } : null,
    zoomConnected ? { value: 'zoom', label: t('cal_provider_zoom') } : null,
  ].filter(Boolean);

  // Once any provider is connected, it's the primary calendar and the other two
  // connect buttons hide — disconnecting brings all three back. (A provider already
  // connected stays visible with its own disconnect control regardless.)
  const anyConnected = appleConnected || googleConnected || zoomConnected;

  return (
    <div className={`${PANEL} p-5 flex flex-col gap-4 text-left`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-white text-base">{t('cal_sync_providers')}</h2>
          <p className="text-[#A4B0B7] text-sm mt-1">{t('cal_sync_hint')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {googleConnected ? (
            <button
              type="button"
              onClick={googleNeedsReauth ? onConnectGoogle : onDisconnectGoogle}
              disabled={integrationsLoading}
              className={`px-4 py-3 rounded-xl bg-[#0A1019] border font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60 ${googleNeedsReauth ? 'border-amber-500/40 text-amber-300' : 'border-[#243246] text-white'}`}
            >
              {integrationsLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : googleNeedsReauth ? (
                <AlertTriangle size={15} className="text-amber-400" />
              ) : (
                <CheckCircle2 size={15} className="text-emerald-400" />
              )}
              {label}
              {googleSyncMode === 'meet_link_only' ? (
                <span className="text-[10px] font-normal text-[#6F8092] normal-case ml-1">{t('cal_meet_links_only')}</span>
              ) : null}
            </button>
          ) : !anyConnected ? (
            <button
              type="button"
              onClick={onConnectGoogle}
              disabled={integrationsLoading}
              className="px-4 py-3 rounded-xl bg-[#0A1019] border border-[#243246] text-white font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {integrationsLoading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              {label}
            </button>
          ) : null}
          {appleConnected ? (
            <button
              type="button"
              onClick={onDisconnectApple}
              disabled={appleLoading}
              className="px-4 py-3 rounded-xl bg-[#0A1019] border border-[#243246] text-white font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {appleLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} className="text-emerald-400" />}
              {t('cal_btn_apple_connected', { user: appleUsername ? ` (${appleUsername})` : '' })}
            </button>
          ) : !anyConnected ? (
            <button
              type="button"
              onClick={onConnectApple}
              disabled={appleLoading}
              className="px-4 py-3 rounded-xl bg-[#0A1019] border border-[#243246] text-white font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {appleLoading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
              {t('cal_btn_connect_apple')}
            </button>
          ) : null}
          {zoomConnected ? (
            <button
              type="button"
              onClick={onDisconnectZoom}
              disabled={integrationsLoading}
              className={`px-4 py-3 rounded-xl bg-[#0A1019] border font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60 ${zoomNeedsReauth ? 'border-amber-500/40 text-amber-300' : 'border-[#243246] text-white'}`}
            >
              {zoomNeedsReauth ? <AlertTriangle size={15} className="text-amber-400" /> : <CheckCircle2 size={15} className="text-emerald-400" />}
              {zoomLabel}
            </button>
          ) : !anyConnected ? (
            <button
              type="button"
              onClick={onConnectZoom}
              disabled={integrationsLoading}
              className="px-4 py-3 rounded-xl bg-[#0A1019] border border-[#243246] text-white font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              <Link2 size={15} />
              {zoomLabel}
            </button>
          ) : null}
        </div>
      </div>
      {connectedOptions.length > 1 ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-3 border-t border-[#243246]">
          <label htmlFor="cal-primary-provider" className="text-sm text-[#A4B0B7] shrink-0">
            {t('cal_primary_provider_label')}
          </label>
          <select
            id="cal-primary-provider"
            value={primaryProvider || ''}
            disabled={providerSettingsLoading}
            onChange={(event) => onChangePrimaryProvider(event.target.value)}
            className="bg-[#0A1019] border border-[#243246] text-white text-sm rounded-lg px-3 py-2 disabled:opacity-60"
          >
            {connectedOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

function AppleCalendarConnectModal({ onClose, onSubmit, submitting, error }) {
  const { t } = useLanguage();
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 text-left">
      <div className={`${PANEL} w-full max-w-md p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">{t('cal_apple_modal_title')}</h3>
          <button type="button" onClick={onClose} className="text-[#A4B0B7] hover:text-white cursor-pointer">
            <X size={18} />
          </button>
        </div>
        <p className="text-[#A4B0B7] text-sm mb-4">
          {t('cal_apple_modal_hint_1')}
          <strong className="text-white">{t('cal_apple_modal_hint_2')}</strong>
          {t('cal_apple_modal_hint_3')}
          <a
            href="https://appleid.apple.com/account/manage"
            target="_blank"
            rel="noreferrer"
            className="text-[#9333ea] underline"
          >
            appleid.apple.com
          </a>
          {t('cal_apple_modal_hint_4')}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit({ username, app_password: appPassword });
          }}
          className="space-y-4"
        >
          <Field label={t('cal_lbl_apple_id')}>
            <input
              type="email"
              required
              className={INPUT}
              placeholder="you@icloud.com"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </Field>
          <Field label={t('cal_lbl_app_password')}>
            <input
              type="password"
              required
              className={INPUT}
              placeholder="xxxx-xxxx-xxxx-xxxx"
              value={appPassword}
              onChange={(event) => setAppPassword(event.target.value)}
            />
          </Field>
          {error ? <p className="text-rose-400 text-sm">{error}</p> : null}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-[#0A1019] border border-[#243246] text-white font-semibold cursor-pointer"
            >
              {t('cal_btn_cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-3 rounded-xl bg-[#9333ea] text-[#06131B] font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
              {t('cal_btn_connect')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Calendar() {
  const { t } = useLanguage();
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
  const [googleSyncMode, setGoogleSyncMode] = useState('full');
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [appleConnected, setAppleConnected] = useState(false);
  const [appleUsername, setAppleUsername] = useState('');
  const [appleLoading, setAppleLoading] = useState(false);
  const [showAppleModal, setShowAppleModal] = useState(false);
  const [appleSubmitting, setAppleSubmitting] = useState(false);
  const [appleError, setAppleError] = useState('');
  const [zoomConnected, setZoomConnected] = useState(false);
  const [zoomNeedsReauth, setZoomNeedsReauth] = useState(false);
  const [primaryProvider, setPrimaryProvider] = useState(null);
  const [providerSettingsLoading, setProviderSettingsLoading] = useState(false);

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
      setError(err.response?.data?.message || t('cal_err_load_events'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const fetchIntegrationState = useCallback(async () => {
    try {
      setIntegrationsLoading(true);
      const response = await smartflowApi.getIntegrationStatus();
      const items = normalizeListPayload(response);
      const google = items.find((item) => item.platform === 'google_business');
      setGoogleConnected(Boolean(google?.connected));
      setGoogleNeedsReauth(google?.health_status === 'needs_reauth' || google?.sync_status === 'needs_reauth');
      setGoogleSyncMode(google?.sync_mode || 'full');
      const zoom = items.find((item) => item.platform === 'zoom');
      setZoomConnected(Boolean(zoom?.connected));
      setZoomNeedsReauth(zoom?.health_status === 'needs_reauth' || zoom?.sync_status === 'needs_reauth');
    } catch {
      setGoogleConnected(false);
      setGoogleNeedsReauth(false);
      setZoomConnected(false);
      setZoomNeedsReauth(false);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  const fetchAppleState = useCallback(async () => {
    try {
      setAppleLoading(true);
      const response = await smartflowApi.getCalDAVStatus();
      const data = response?.data?.data || response?.data || {};
      setAppleConnected(Boolean(data.connected));
      setAppleUsername(data.username || '');
    } catch {
      setAppleConnected(false);
      setAppleUsername('');
    } finally {
      setAppleLoading(false);
    }
  }, []);

  const fetchProviderSettings = useCallback(async () => {
    try {
      const response = await smartflowApi.getCalendarProviderSettings();
      const data = response?.data?.data || response?.data || {};
      setPrimaryProvider(data.primary_calendar_provider || null);
    } catch {
      setPrimaryProvider(null);
    }
  }, []);

  const handleChangePrimaryProvider = useCallback(
    async (provider) => {
      setProviderSettingsLoading(true);
      try {
        await smartflowApi.setPrimaryCalendarProvider(provider);
        await fetchProviderSettings();
      } catch (err) {
        window.alert(err.response?.data?.message || t('cal_err_primary_provider'));
      } finally {
        setProviderSettingsLoading(false);
      }
    },
    [fetchProviderSettings, t]
  );

  useEffect(() => {
    fetchAll();
    fetchIntegrationState();
    fetchAppleState();
    fetchProviderSettings();
  }, [fetchAll, fetchIntegrationState, fetchAppleState, fetchProviderSettings]);

  async function handleAppleConnectSubmit(formValues) {
    try {
      setAppleSubmitting(true);
      setAppleError('');
      await smartflowApi.connectCalDAV(formValues);
      setShowAppleModal(false);
      await fetchAppleState();
      await fetchIntegrationState();
    } catch (err) {
      setAppleError(err.response?.data?.message || t('cal_err_apple_connect'));
    } finally {
      setAppleSubmitting(false);
    }
  }

  async function handleAppleDisconnect() {
    try {
      setAppleLoading(true);
      await smartflowApi.disconnectCalDAV();
      await fetchAppleState();
    } catch (err) {
      window.alert(err.response?.data?.message || t('cal_err_apple_disconnect'));
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleGoogleConnect() {
    try {
      const response = await smartflowApi.startIntegrationOAuth('google_business');
      const authUrl = response?.data?.data?.auth_url || response?.data?.auth_url;
      if (!authUrl) {
        window.alert(t('cal_err_no_auth_url'));
        return;
      }
      const popup = window.open(authUrl, 'mabdel-google-calendar', 'width=640,height=820');
      const startedAt = Date.now();
      const timer = window.setInterval(async () => {
        const closed = !popup || popup.closed;
        const expired = Date.now() - startedAt > 10 * 60 * 1000;
        if (!closed && !expired) return;
        window.clearInterval(timer);
        await fetchIntegrationState();
        await fetchProviderSettings();
        await fetchAll();
      }, 1500);
    } catch (err) {
      window.alert(err.response?.data?.message || t('cal_err_google_start'));
    }
  }

  async function handleGoogleDisconnect() {
    try {
      await smartflowApi.disconnectIntegration('google_business');
      await fetchIntegrationState();
      await fetchProviderSettings();
    } catch (err) {
      window.alert(err.response?.data?.message || t('cal_err_google_disconnect'));
    }
  }

  async function handleZoomConnect() {
    try {
      const response = await smartflowApi.startIntegrationOAuth('zoom');
      const authUrl = response?.data?.data?.auth_url || response?.data?.auth_url;
      if (!authUrl) {
        window.alert(t('cal_err_no_auth_url'));
        return;
      }
      const popup = window.open(authUrl, 'mabdel-zoom-calendar', 'width=640,height=820');
      const startedAt = Date.now();
      const timer = window.setInterval(async () => {
        const closed = !popup || popup.closed;
        const expired = Date.now() - startedAt > 10 * 60 * 1000;
        if (!closed && !expired) return;
        window.clearInterval(timer);
        await fetchIntegrationState();
        await fetchProviderSettings();
        await fetchAll();
      }, 1500);
    } catch (err) {
      window.alert(err.response?.data?.message || t('cal_err_zoom_start'));
    }
  }

  async function handleZoomDisconnect() {
    try {
      await smartflowApi.disconnectIntegration('zoom');
      await fetchIntegrationState();
      await fetchProviderSettings();
    } catch (err) {
      window.alert(err.response?.data?.message || t('cal_err_zoom_disconnect'));
    }
  }

  useEffect(() => {
    const onFocus = () => {
      fetchIntegrationState();
      fetchProviderSettings();
      fetchAll();
    };
    const onMessage = (event) => {
      if (
        event?.data?.type === 'mabdel-google-calendar-oauth' ||
        event?.data?.type === 'mabdel-zoom-calendar-oauth'
      ) {
        fetchIntegrationState();
        fetchProviderSettings();
        fetchAll();
      }
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('message', onMessage);
    };
  }, [fetchAll, fetchIntegrationState, fetchProviderSettings]);

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
          <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('cal_title')}</h1>
          <p className="text-[#A4B0B7] text-xs mt-1">{t('cal_subtitle')}</p>
        </div>
        <button
          onClick={() => {
            setPrefillData(null);
            setShowCreate((current) => !current);
          }}
          className="px-5 py-3 bg-[#9333ea] text-[#02080B] hover:bg-[#a855f7] rounded-xl font-extrabold flex items-center gap-2 active:scale-95 transition-all cursor-pointer shrink-0"
        >
          {showCreate ? <X size={18} /> : <Plus size={18} />}
          {showCreate ? t('cal_btn_close') : t('cal_btn_add_to_calendar')}
        </button>
      </div>

      {error ? (
        <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm text-left">
          {error}
        </div>
      ) : null}

      <CalendarSyncPanel
        googleConnected={googleConnected}
        googleNeedsReauth={googleNeedsReauth}
        googleSyncMode={googleSyncMode}
        integrationsLoading={integrationsLoading}
        onConnectGoogle={handleGoogleConnect}
        onDisconnectGoogle={handleGoogleDisconnect}
        appleConnected={appleConnected}
        appleUsername={appleUsername}
        appleLoading={appleLoading}
        onConnectApple={() => {
          setAppleError('');
          setShowAppleModal(true);
        }}
        onDisconnectApple={handleAppleDisconnect}
        zoomConnected={zoomConnected}
        zoomNeedsReauth={zoomNeedsReauth}
        onConnectZoom={handleZoomConnect}
        onDisconnectZoom={handleZoomDisconnect}
        primaryProvider={primaryProvider}
        providerSettingsLoading={providerSettingsLoading}
        onChangePrimaryProvider={handleChangePrimaryProvider}
      />

      {showAppleModal ? (
        <AppleCalendarConnectModal
          onClose={() => setShowAppleModal(false)}
          onSubmit={handleAppleConnectSubmit}
          submitting={appleSubmitting}
          error={appleError}
        />
      ) : null}

      {!loading ? <CalendarStats events={events} /> : null}

      <div className={`grid gap-6 items-start ${showCreate ? 'grid-cols-1 xl:grid-cols-[1fr_420px]' : 'grid-cols-1'}`}>
        <div className={`${PANEL} overflow-hidden text-left order-2 xl:order-1`}>
          <div className="p-5 border-b border-[#243041]/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-bold text-white text-base">
              <CalendarDays size={20} className="text-[#9333ea]" />
              {t('cal_upcoming_events')}
            </div>
            <button type="button" onClick={fetchAll} className="text-sm text-[#9333ea] font-semibold cursor-pointer">
              {t('cal_btn_refresh')}
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
              <div className="w-14 h-14 rounded-2xl bg-[#9333ea]/10 flex items-center justify-center mx-auto mb-4">
                <CalendarDays size={24} className="text-[#9333ea]" />
              </div>
              <p className="text-white font-bold">{t('cal_no_upcoming_events')}</p>
              <p className="text-[#A4B0B7] text-sm mt-1">{t('cal_no_events_hint')}</p>
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
              className={`order-1 xl:order-2 ${PANEL} p-6 max-h-[80vh] overflow-y-auto scrollbar-thin text-left`}
            >
              <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#243041]/40">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-[#9333ea]" />
                  {t('cal_new_meeting')}
                </h2>
                <button type="button" onClick={() => setShowCreate(false)} className="text-[#A4B0B7] hover:text-white p-1 cursor-pointer">
                  <X size={16} />
                </button>
              </div>
              <MeetingEditor
                contacts={contacts}
                prefill={prefillData}
                googleConnected={googleConnected}
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
            googleConnected={googleConnected}
            onClose={() => setSelectedEventId(null)}
            onDeleted={handleEventDeleted}
            onSaved={handleEventSaved}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
