import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  Loader2,
  MapPin,
  Plus,
  Search,
  Ticket,
  Users,
} from 'lucide-react';
import { smartflowApi } from '../api/services';

const DEFAULT_CATEGORIES = ['General', 'Networking', 'Workshop', 'Meeting', 'Training', 'Online'];

const getApiData = (response) => response?.data?.data ?? response?.data ?? response;

const toItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const normalizeEvent = (event) => ({
  ...event,
  id: event?.id || event?._id,
  title: event?.title || event?.name || 'Untitled Event',
  description: event?.description || '',
  category: event?.category || 'General',
  organizer: event?.organizer || event?.hostName || 'Host',
  location: event?.location || 'Online',
  onlineLink: event?.onlineLink || '',
  date: event?.date || 'TBD',
  time: event?.time || 'TBD',
  endTime: event?.endTime || '',
  timezone: event?.timezone || 'UTC',
  attendee_count: Number(event?.attendee_count || event?.joinedCount || 0),
  capacity: Number(event?.capacity || event?.participantLimit || 0),
  joined: Boolean(event?.joined),
  imageUrl: event?.imageUrl || '',
});

export default function JoinEvent() {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [joiningId, setJoiningId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createForm, setCreateForm] = useState({
    title: '',
    category: 'General',
    description: '',
    location: 'Online',
    onlineLink: '',
    date: '',
    time: '',
    endTime: '',
    timezone: 'Asia/Dhaka',
    participantLimit: 25,
  });

  const fetchEvents = async (nextSearch = search, nextCategory = category) => {
    setLoading(true);
    try {
      const response = await smartflowApi.listEvents({
        search: nextSearch.trim() || undefined,
        category: nextCategory !== 'All' ? nextCategory : undefined,
      });
      const items = toItems(getApiData(response)).map(normalizeEvent);
      setEvents(items);
      setSelectedEventId((current) => {
        if (current && items.some((item) => item.id === current)) return current;
        return items[0]?.id || null;
      });
      setError('');
    } catch (fetchError) {
      setEvents([]);
      setError(fetchError?.response?.data?.message || 'Failed to load events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const categories = useMemo(() => {
    const fromEvents = events.map((event) => event.category).filter(Boolean);
    return ['All', ...Array.from(new Set([...DEFAULT_CATEGORIES, ...fromEvents]))];
  }, [events]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  const updateEventInState = (updatedEvent) => {
    const normalized = normalizeEvent(updatedEvent);
    setEvents((current) => {
      const existing = current.some((event) => event.id === normalized.id);
      const next = existing
        ? current.map((event) => (event.id === normalized.id ? normalized : event))
        : [normalized, ...current];
      return next;
    });
    setSelectedEventId(normalized.id);
  };

  const handleSearchSubmit = async (event) => {
    event.preventDefault();
    await fetchEvents(search, category);
  };

  const handleCreateEvent = async (event) => {
    event.preventDefault();
    if (!createForm.title.trim()) {
      setError('Event title is required.');
      setSuccess('');
      return;
    }
    if (!createForm.date || !createForm.time) {
      setError('Event date and start time are required.');
      setSuccess('');
      return;
    }

    setSaving(true);
    try {
      const response = await smartflowApi.createEvent({
        title: createForm.title.trim(),
        category: createForm.category,
        description: createForm.description.trim(),
        location: createForm.location.trim() || 'Online',
        onlineLink: createForm.onlineLink.trim() || undefined,
        date: createForm.date,
        time: createForm.time,
        endTime: createForm.endTime || undefined,
        timezone: createForm.timezone.trim() || 'UTC',
        participantLimit: Number(createForm.participantLimit) || 25,
      });
      updateEventInState(getApiData(response));
      setCreateForm({
        title: '',
        category: createForm.category,
        description: '',
        location: 'Online',
        onlineLink: '',
        date: '',
        time: '',
        endTime: '',
        timezone: createForm.timezone,
        participantLimit: 25,
      });
      setSuccess('Event created successfully.');
      setError('');
    } catch (createError) {
      setError(createError?.response?.data?.message || 'Failed to create event.');
      setSuccess('');
    } finally {
      setSaving(false);
    }
  };

  const handleJoinToggle = async (eventItem) => {
    if (!eventItem?.id) return;
    setJoiningId(eventItem.id);
    try {
      const response = eventItem.joined
        ? await smartflowApi.leaveEvent(eventItem.id)
        : await smartflowApi.joinEvent(eventItem.id);
      updateEventInState(getApiData(response));
      setSuccess(eventItem.joined ? 'You left the event.' : 'You joined the event.');
      setError('');
    } catch (joinError) {
      setError(joinError?.response?.data?.message || 'Failed to update event attendance.');
      setSuccess('');
    } finally {
      setJoiningId('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {(error || success) && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${error ? 'border-rose-500/30 bg-rose-950/20 text-rose-200' : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200'}`}>
          {error || success}
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#243041]/40 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <MapPin className="text-emerald-400" size={32} /> Discover & Join Events
          </h1>
          <p className="text-[#A4B0B7] mt-2 max-w-2xl text-sm leading-relaxed">
            Browse live community events, filter them from the backend, and create new ones without leaving this screen.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
        <div className="space-y-6">
          <form onSubmit={handleSearchSubmit} className="grid gap-4 md:grid-cols-[1fr_180px_auto]">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, description, organizer, or location..."
                className="w-full pl-12 pr-4 py-4 bg-[#131A24] border border-[#243041] rounded-2xl text-white outline-none focus:border-emerald-500/50 shadow-lg"
              />
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full px-4 py-4 bg-[#131A24] border border-[#243041] rounded-2xl text-white outline-none focus:border-emerald-500/50 shadow-lg"
            >
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-5 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-[#070a13] font-extrabold shadow-lg shadow-emerald-500/20"
            >
              Search
            </button>
          </form>

          <div className="w-full h-[220px] bg-[#0c101b] border border-[#243041] rounded-3xl overflow-hidden relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_45%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.12),transparent_40%)]" />
            <div className="absolute inset-0 p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-4">
                <span className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-lg text-xs font-bold text-white border border-slate-700">
                  {category === 'All' ? 'All Categories' : category}
                </span>
                <span className="px-3 py-1.5 bg-emerald-500/80 rounded-lg text-xs font-bold text-[#0c101b]">
                  {events.length} events
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-extrabold text-white">Community Event Feed</h2>
                <p className="mt-2 max-w-xl text-sm text-slate-300">
                  Search and category filters are hitting the backend directly, so the list stays in sync after create and join actions.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4">
            {loading ? (
              <div className="text-center text-slate-400 py-10 flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin text-emerald-400" /> Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="text-center text-slate-400 py-10 border border-dashed border-[#243041] rounded-3xl">
                No events found for this search and category.
              </div>
            ) : (
              events.map((event) => (
                <button
                  type="button"
                  key={event.id}
                  onClick={() => setSelectedEventId(event.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row gap-5 text-left ${(selectedEvent?.id === event.id) ? 'bg-[#131A24] border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-[#0c101b] border-[#243041] hover:border-slate-600'}`}
                >
                  <div className="h-24 w-24 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700 overflow-hidden">
                    {event.imageUrl ? (
                      <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
                    ) : (
                      <Calendar size={32} className="text-slate-500" />
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{event.title}</h3>
                        <span className="px-2 py-1 rounded-full bg-emerald-950/40 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                          {event.category}
                        </span>
                      </div>
                      <p className="text-slate-400 text-sm mt-2 line-clamp-2">{event.description || 'No description provided.'}</p>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-slate-400 font-medium">
                      <span className="flex items-center gap-1.5"><MapPin size={14} /> {event.location}</span>
                      <span className="flex items-center gap-1.5"><Clock size={14} /> {event.date} {event.time !== 'TBD' ? `at ${event.time}` : ''}</span>
                      <span className="flex items-center gap-1.5"><Globe size={14} /> {event.timezone}</span>
                      <span className="flex items-center gap-1.5"><Users size={14} /> {event.organizer}</span>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center justify-center sm:border-l border-[#243041] sm:pl-5 gap-2 shrink-0 pt-4 sm:pt-0 border-t sm:border-t-0 mt-4 sm:mt-0">
                    <Users size={20} className="text-emerald-500" />
                    <span className="text-sm font-bold text-white">{event.attendee_count}/{event.capacity || '--'}</span>
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">Attending</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#131A24] border border-[#243041] rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Plus size={18} className="text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Create Event</h2>
            </div>
            <form onSubmit={handleCreateEvent} className="space-y-3">
              <input
                type="text"
                value={createForm.title}
                onChange={(event) => setCreateForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Event title"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={createForm.category}
                  onChange={(event) => setCreateForm((current) => ({ ...current, category: event.target.value }))}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/40"
                >
                  {DEFAULT_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={createForm.participantLimit}
                  onChange={(event) => setCreateForm((current) => ({ ...current, participantLimit: event.target.value }))}
                  placeholder="Capacity"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
                />
              </div>
              <textarea
                value={createForm.description}
                onChange={(event) => setCreateForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Description"
                className="w-full min-h-24 px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
              />
              <input
                type="text"
                value={createForm.location}
                onChange={(event) => setCreateForm((current) => ({ ...current, location: event.target.value }))}
                placeholder="Location"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
              />
              <input
                type="url"
                value={createForm.onlineLink}
                onChange={(event) => setCreateForm((current) => ({ ...current, onlineLink: event.target.value }))}
                placeholder="Online meeting link"
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={createForm.date}
                  onChange={(event) => setCreateForm((current) => ({ ...current, date: event.target.value }))}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/40"
                />
                <input
                  type="text"
                  value={createForm.time}
                  onChange={(event) => setCreateForm((current) => ({ ...current, time: event.target.value }))}
                  placeholder="Start time (e.g. 18:30)"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={createForm.endTime}
                  onChange={(event) => setCreateForm((current) => ({ ...current, endTime: event.target.value }))}
                  placeholder="End time"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
                />
                <input
                  type="text"
                  value={createForm.timezone}
                  onChange={(event) => setCreateForm((current) => ({ ...current, timezone: event.target.value }))}
                  placeholder="Timezone"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/40"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070a13] font-extrabold flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Create Event
              </button>
            </form>
          </div>

          <AnimatePresence mode="wait">
            {selectedEvent ? (
              <motion.div
                key={selectedEvent.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-[#131A24] border border-[#243041] rounded-3xl p-6 sticky top-24 shadow-2xl"
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-5 border border-emerald-500/20">
                  <Ticket size={24} />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{selectedEvent.title}</h2>
                <p className="text-emerald-400 font-bold mb-1 text-sm uppercase tracking-widest">{selectedEvent.category}</p>
                <p className="text-slate-400 text-sm mb-6">{selectedEvent.description || 'No description provided.'}</p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                    <MapPin size={18} className="text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">{selectedEvent.location}</p>
                      <p className="text-slate-400 text-xs mt-1">{selectedEvent.onlineLink || 'No online link provided.'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                    <Calendar size={18} className="text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">{selectedEvent.date}</p>
                      <p className="text-slate-400 text-xs mt-1">
                        {selectedEvent.time}
                        {selectedEvent.endTime ? ` - ${selectedEvent.endTime}` : ''}
                        {' · '}
                        {selectedEvent.timezone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                    <Users size={18} className="text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-white font-semibold text-sm">{selectedEvent.attendee_count} / {selectedEvent.capacity || '--'} joined</p>
                      <p className="text-slate-400 text-xs mt-1">Organized by {selectedEvent.organizer}</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleJoinToggle(selectedEvent)}
                  disabled={joiningId === selectedEvent.id}
                  className={`w-full py-4 rounded-xl font-extrabold flex items-center justify-center gap-2 transition-all ${selectedEvent.joined ? 'bg-slate-900 border border-slate-700 text-slate-200' : 'bg-emerald-500 hover:bg-emerald-400 text-[#070a13] shadow-lg shadow-emerald-500/20'} disabled:opacity-60`}
                >
                  {joiningId === selectedEvent.id ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                  {selectedEvent.joined ? 'Leave Event' : 'Join Event'}
                </button>
              </motion.div>
            ) : (
              <div className="bg-[#131A24] border border-[#243041] rounded-3xl p-10 flex flex-col items-center justify-center text-center h-[500px] sticky top-24 border-dashed">
                <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                  <MapPin size={24} className="text-slate-500" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">No Event Selected</h3>
                <p className="text-slate-400 text-sm max-w-[250px]">Choose an event from the list to inspect details or attendance.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
