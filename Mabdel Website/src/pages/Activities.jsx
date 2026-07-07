import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Search, Plus, MapPin, Calendar, Clock, Users, X, Info, CheckCircle2, Ticket } from 'lucide-react';
import { smartflowApi } from '../api/services';


const categories = [
  { id: 'all', label: 'All Activities' },
  { id: 'walking', label: 'Walking' },
  { id: 'running', label: 'Running' },
  { id: 'cycling', label: 'Cycling' },
  { id: 'swimming', label: 'Swimming' },
  { id: 'workout', label: 'Workout' }
];

export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showHostModal, setShowHostModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Host Form State
  const [hostForm, setHostForm] = useState({
    name: '',
    category: 'running',
    description: '',
    location: '',
    date: '',
    time: '',
    price: '0',
    maxParticipants: '15'
  });

  async function loadActivities() {
    setLoading(true);
    try {
      const response = await smartflowApi.listActivities();
      if (response.data?.success && response.data?.data?.length > 0) {
        setActivities(response.data.data);
      } else {
        setActivities([]);
      }
    } catch (err) {
      console.error('Failed to list activities:', err);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadActivities();
  }, []);

  const handleJoin = async (activityId) => {
    try {
      setSuccessMessage('');
      setErrorMessage('');
      const response = await smartflowApi.joinActivity(activityId);
      if (response.data?.success) {
        setSuccessMessage('Successfully joined the activity! Get ready to meet your fitness partners.');
        setSelectedActivity(null);
        loadActivities();
      } else {
        setErrorMessage(response.data?.message || 'Could not join activity.');
      }
    } catch (err) {
      setErrorMessage('Could not join activity. Backend error.');
      setSelectedActivity(null);
    }
  };

  const handleHostSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    
    if (!hostForm.name || !hostForm.location || !hostForm.date || !hostForm.time) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    try {
      const payload = {
        ...hostForm,
        price: parseFloat(hostForm.price) || 0.0,
        maxParticipants: parseInt(hostForm.maxParticipants) || 15
      };
      
      const response = await smartflowApi.createActivity(payload);
      if (response.data?.success) {
        setSuccessMessage('Activity hosted successfully! Event is now visible in the community feed.');
        setShowHostModal(false);
        // Reset form
        setHostForm({
          name: '',
          category: 'running',
          description: '',
          location: '',
          date: '',
          time: '',
          price: '0',
          maxParticipants: '15'
        });
        loadActivities();
      }
    } catch (err) {
      console.warn('Backend hosting failed:', err);
      setErrorMessage('Could not host activity.');
    }
  };

  const filteredActivities = activities.filter(act => {
    const matchesCategory = selectedCategory === 'all' || act.category?.toLowerCase() === selectedCategory;
    const matchesSearch = act.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          act.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          act.hostName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 text-white pb-12 max-w-7xl mx-auto">
      {/* Top Title Header */}
      <div className="border-b border-[#243041]/40 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Community Activities</h1>
          <p className="text-[#A4B0B7] text-xs mt-1">Browse, join, and host local physical fitness and networking events.</p>
        </div>
        <button
          onClick={() => setShowHostModal(true)}
          className="flex items-center gap-2 px-5 py-3 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-xl shadow-lg shadow-[#11C7E5]/10 active:scale-95 transition-all cursor-pointer"
        >
          <Plus size={16} /> Host Activity
        </button>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm text-left flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm text-left">{errorMessage}</div>
      )}

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#11C7E5]/10 text-[#11C7E5] border-[#11C7E5]/30'
                  : 'bg-[#0c101b] text-[#A4B0B7] border-[#243041]/40 hover:text-white hover:border-[#243041]/80'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <input
            type="text"
            placeholder="Search activities or hosts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0c101b] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
          />
          <Search size={15} className="absolute left-3.5 top-3.5 text-[#A4B0B7]" />
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#11C7E5]" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <div className="py-20 text-center bg-[#0c101b] rounded-3xl border border-[#243041]/60">
          <Flame size={48} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-lg font-bold text-white">No Activities Found</h3>
          <p className="text-slate-500 text-xs mt-1">Be the first to host one by clicking the "Host Activity" button!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredActivities.map((act) => (
            <motion.div
              layout
              key={act.id || act._id}
              className="bg-[#0c101b] border border-[#243041]/50 rounded-[22px] overflow-hidden flex flex-col hover:border-[#11C7E5]/30 transition-all duration-300"
            >
              <div className="flex flex-col sm:flex-row h-full">
                {/* Cover Photo */}
                <div className="w-full sm:w-48 h-48 sm:h-auto relative shrink-0 bg-slate-900">
                  <img
                    src={act.imageUrl || 'https://images.unsplash.com/photo-1502904585520-fa49580603f6?w=400&h=300&fit=crop'}
                    alt={act.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3 bg-[#02080B]/70 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/5 text-[9px] font-black uppercase text-[#11C7E5]">
                    {act.category}
                  </div>
                </div>

                {/* Details Content */}
                <div className="flex-1 p-5 text-left flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="font-extrabold text-white text-base leading-snug line-clamp-1">{act.name}</h3>
                    <p className="text-[10px] text-[#A4B0B7] mt-0.5 font-bold">Hosted by <span className="text-white">{act.hostName || 'Organizer'}</span></p>
                    <p className="text-[#A4B0B7] text-xs mt-2 line-clamp-2 leading-relaxed">{act.description}</p>
                  </div>

                  <div className="space-y-1.5 text-[11px] text-[#A4B0B7]/90 pt-1 border-t border-[#243041]/20">
                    <div className="flex items-center gap-2">
                      <Calendar size={13} className="text-[#11C7E5]" />
                      <span>{act.date}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={13} className="text-[#11C7E5]" />
                      <span>{act.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={13} className="text-[#11C7E5]" />
                      <span className="truncate max-w-[200px]">{act.location}</span>
                    </div>
                  </div>

                  {/* Pricing and Action */}
                  <div className="pt-2 flex justify-between items-center border-t border-[#243041]/20">
                    <div className="flex items-center gap-1.5">
                      <Users size={14} className="text-slate-400" />
                      <span className="text-xs text-white font-bold">{act.joinedCount}/{act.maxParticipants || act.participantLimit || 15}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white px-2 py-1 bg-[#131A24] border border-[#243041] rounded-lg">
                        {act.price > 0 ? `$${act.price.toFixed(2)}` : 'Free'}
                      </span>
                      <button
                        onClick={() => setSelectedActivity(act)}
                        className="px-3.5 py-1.5 bg-[#11C7E5]/10 hover:bg-[#11C7E5] text-[#11C7E5] hover:text-[#02080B] font-extrabold text-[10px] rounded-lg border border-[#11C7E5]/20 hover:border-transparent transition-all cursor-pointer"
                      >
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Activity Details & Joining Modal */}
      <AnimatePresence>
        {selectedActivity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedActivity(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#0c101b] border border-[#243041] rounded-[28px] overflow-hidden shadow-2xl z-10 text-left"
            >
              {/* Close Button */}
              <button
                onClick={() => setSelectedActivity(null)}
                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-slate-400 hover:text-white rounded-full transition-colors z-20 cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="w-full aspect-video relative">
                <img
                  src={selectedActivity.imageUrl || 'https://images.unsplash.com/photo-1502904585520-fa49580603f6?w=600&h=400&fit=crop'}
                  alt={selectedActivity.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c101b] via-transparent to-transparent" />
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <span className="text-[10px] bg-[#11C7E5]/10 text-[#11C7E5] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border border-[#11C7E5]/10">
                    {selectedActivity.category}
                  </span>
                  <h2 className="text-xl font-extrabold text-white mt-3">{selectedActivity.name}</h2>
                  <p className="text-[11px] text-[#A4B0B7] font-bold">Hosted by {selectedActivity.hostName}</p>
                </div>

                <p className="text-[#A4B0B7] text-xs leading-relaxed">{selectedActivity.description}</p>

                <div className="grid grid-cols-2 gap-4 py-1 text-xs">
                  <div className="bg-[#131A24] border border-[#243041]/40 rounded-xl p-3 flex items-center gap-3">
                    <Calendar size={18} className="text-[#11C7E5]" />
                    <div>
                      <span className="text-slate-500 block mb-0.5 text-[10px]">Date</span>
                      <span className="font-bold text-white">{selectedActivity.date}</span>
                    </div>
                  </div>
                  <div className="bg-[#131A24] border border-[#243041]/40 rounded-xl p-3 flex items-center gap-3">
                    <Clock size={18} className="text-[#11C7E5]" />
                    <div>
                      <span className="text-slate-500 block mb-0.5 text-[10px]">Time</span>
                      <span className="font-bold text-white">{selectedActivity.time}</span>
                    </div>
                  </div>
                  <div className="bg-[#131A24] border border-[#243041]/40 rounded-xl p-3 flex items-center gap-3">
                    <MapPin size={18} className="text-[#11C7E5]" />
                    <div>
                      <span className="text-slate-500 block mb-0.5 text-[10px]">Location</span>
                      <span className="font-bold text-white truncate max-w-[140px] block">{selectedActivity.location}</span>
                    </div>
                  </div>
                  <div className="bg-[#131A24] border border-[#243041]/40 rounded-xl p-3 flex items-center gap-3">
                    <Users size={18} className="text-[#11C7E5]" />
                    <div>
                      <span className="text-slate-500 block mb-0.5 text-[10px]">Participants</span>
                      <span className="font-bold text-white">{selectedActivity.joinedCount}/{selectedActivity.maxParticipants || 15} Joined</span>
                    </div>
                  </div>
                </div>

                {selectedActivity.price > 0 && (
                  <div className="p-4 bg-[#0C2028] border border-[#1B5E6E]/60 text-[#EAF8FF] rounded-2xl flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Ticket size={16} className="text-[#11C7E5]" />
                      <span className="text-xs font-bold">Entry Fee</span>
                    </div>
                    <span className="font-black text-sm text-[#11C7E5]">${selectedActivity.price.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setSelectedActivity(null)}
                    className="flex-1 py-3 border border-[#243041] hover:border-[#A4B0B7]/40 rounded-xl text-xs font-bold text-slate-300 transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleJoin(selectedActivity.id || selectedActivity._id)}
                    className="flex-1 py-3 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center"
                  >
                    Confirm & Join
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Host Event Modal Form */}
      <AnimatePresence>
        {showHostModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHostModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#0c101b] border border-[#243041] rounded-[28px] p-6 shadow-2xl z-10 text-left space-y-4"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowHostModal(false)}
                className="absolute top-4 right-4 p-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white rounded-full transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>

              <div>
                <h3 className="text-xl font-extrabold text-white">Host Community Activity</h3>
                <p className="text-[#A4B0B7] text-xs mt-1">Fill out the information below to schedule and publish your session.</p>
              </div>

              <form onSubmit={handleHostSubmit} className="space-y-4 pt-2">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-[#A4B0B7] uppercase font-bold block mb-1">Activity Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Evening Running / Cycling Session"
                      value={hostForm.name}
                      onChange={(e) => setHostForm({ ...hostForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#A4B0B7] uppercase font-bold block mb-1">Category *</label>
                      <select
                        value={hostForm.category}
                        onChange={(e) => setHostForm({ ...hostForm, category: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                      >
                        <option value="walking">Walking</option>
                        <option value="running">Running</option>
                        <option value="cycling">Cycling</option>
                        <option value="swimming">Swimming</option>
                        <option value="workout">Workout</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#A4B0B7] uppercase font-bold block mb-1">Participant Limit</label>
                      <input
                        type="number"
                        min="2"
                        value={hostForm.maxParticipants}
                        onChange={(e) => setHostForm({ ...hostForm, maxParticipants: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#A4B0B7] uppercase font-bold block mb-1">Description</label>
                    <textarea
                      placeholder="Describe the fitness session goals, pace, target participants, etc."
                      value={hostForm.description}
                      onChange={(e) => setHostForm({ ...hostForm, description: e.target.value })}
                      className="w-full min-h-20 px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#A4B0B7] uppercase font-bold block mb-1">Location Address *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Greenwood Park Main Gate"
                      value={hostForm.location}
                      onChange={(e) => setHostForm({ ...hostForm, location: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#A4B0B7] uppercase font-bold block mb-1">Date *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. June 24, 2026"
                        value={hostForm.date}
                        onChange={(e) => setHostForm({ ...hostForm, date: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#A4B0B7] uppercase font-bold block mb-1">Time *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 7:00 AM"
                        value={hostForm.time}
                        onChange={(e) => setHostForm({ ...hostForm, time: e.target.value })}
                        className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#A4B0B7] uppercase font-bold block mb-1">Entry Price ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={hostForm.price}
                      onChange={(e) => setHostForm({ ...hostForm, price: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#131A24] border border-[#243041] text-xs text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHostModal(false)}
                    className="flex-1 py-3 border border-[#243041] hover:border-[#A4B0B7]/40 rounded-xl text-xs font-bold text-slate-300 transition-colors cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-[#11C7E5] hover:bg-[#0fd0f0] text-[#02080B] font-extrabold text-xs rounded-xl transition-all cursor-pointer text-center"
                  >
                    Publish Activity
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
