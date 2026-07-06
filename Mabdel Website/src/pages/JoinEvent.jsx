import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Calendar, Clock, Users, Navigation, Search, CheckCircle2, Ticket } from 'lucide-react';

const mockEvents = [
  { id: 1, title: 'Real Estate Investor Meetup', location: 'Downtown Hub', date: 'Oct 15, 2026', time: '18:00', participants: 45, max: 50, price: 0 },
  { id: 2, title: 'Property Tech Conference', location: 'Convention Center', date: 'Nov 02, 2026', time: '09:00', participants: 210, max: 300, price: 150 },
  { id: 3, title: 'First-Time Homebuyer Seminar', location: 'Community Library', date: 'Oct 20, 2026', time: '14:00', participants: 12, max: 20, price: 0 }
];

export default function JoinEvent() {
  const [search, setSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isJoined, setIsJoined] = useState(false);

  const filteredEvents = mockEvents.filter(e => e.title.toLowerCase().includes(search.toLowerCase()) || e.location.toLowerCase().includes(search.toLowerCase()));

  const handleJoin = (e) => {
      e.stopPropagation();
      setIsJoined(true);
      setTimeout(() => {
          setIsJoined(false);
          setSelectedEvent(null);
      }, 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#243041]/40 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
             <MapPin className="text-emerald-400" size={32} /> Discover & Join Events
          </h1>
          <p className="text-[#A4B0B7] mt-2 max-w-2xl text-sm leading-relaxed">
            Find local real estate meetups, open houses, and seminars. RSVP or purchase tickets to expand your network.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          
          {/* Map & List */}
          <div className="space-y-6">
             {/* Search */}
             <div className="relative">
                 <input 
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search by event name or location..."
                    className="w-full pl-12 pr-4 py-4 bg-[#131A24] border border-[#243041] rounded-2xl text-white outline-none focus:border-emerald-500/50 shadow-lg"
                 />
                 <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
             </div>

             {/* Map Placeholder */}
             <div className="w-full h-[400px] bg-[#0c101b] border border-[#243041] rounded-3xl overflow-hidden relative group">
                 <iframe 
                    title="Events Map"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d193595.2528000654!2d-74.1444874443187!3d40.69763123330689!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c24fa5d33f083b%3A0xc80b8f06e177fe62!2sNew%20York%2C%20NY!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus" 
                    className="w-full h-full opacity-60 group-hover:opacity-100 transition-opacity duration-500 filter invert contrast-125 hue-rotate-180"
                    allowFullScreen="" 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                 />
                 <div className="absolute top-4 left-4 right-4 flex gap-2">
                     <span className="px-3 py-1.5 bg-slate-900/80 backdrop-blur-md rounded-lg text-xs font-bold text-white shadow-lg border border-slate-700">New York, NY</span>
                     <span className="px-3 py-1.5 bg-emerald-500/80 backdrop-blur-md rounded-lg text-xs font-bold text-[#0c101b] shadow-lg">3 Events Nearby</span>
                 </div>
             </div>

             {/* Events List */}
             <div className="grid gap-4">
                 {filteredEvents.map(event => (
                     <div 
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row gap-5 ${selectedEvent?.id === event.id ? 'bg-[#131A24] border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-[#0c101b] border-[#243041] hover:border-slate-600'}`}
                     >
                         <div className="h-24 w-24 rounded-xl bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                             <Calendar size={32} className="text-slate-500" />
                         </div>
                         <div className="flex-1 flex flex-col justify-between">
                             <div>
                                 <h3 className="text-lg font-bold text-white">{event.title}</h3>
                                 <p className="text-emerald-400 text-sm font-semibold mt-1">${event.price === 0 ? 'FREE' : event.price}</p>
                             </div>
                             <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-slate-400 font-medium">
                                 <span className="flex items-center gap-1.5"><MapPin size={14} /> {event.location}</span>
                                 <span className="flex items-center gap-1.5"><Clock size={14} /> {event.date} at {event.time}</span>
                             </div>
                         </div>
                         <div className="flex sm:flex-col items-center justify-center sm:border-l border-[#243041] sm:pl-5 gap-2 shrink-0 pt-4 sm:pt-0 border-t sm:border-t-0 mt-4 sm:mt-0">
                             <Users size={20} className="text-emerald-500" />
                             <span className="text-sm font-bold text-white">{event.participants}/{event.max}</span>
                             <span className="text-[10px] uppercase tracking-wider text-slate-500">Attending</span>
                         </div>
                     </div>
                 ))}
             </div>
          </div>

          {/* Details Sidebar */}
          <div>
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
                         <p className="text-emerald-400 font-bold mb-6 text-lg">{selectedEvent.price === 0 ? 'Free Entry' : `$${selectedEvent.price}`}</p>
                         
                         <div className="space-y-4 mb-8">
                             <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                                 <MapPin size={18} className="text-slate-400 mt-0.5" />
                                 <div>
                                     <p className="text-white font-semibold text-sm">{selectedEvent.location}</p>
                                     <a href="#" className="text-emerald-400 text-xs font-semibold flex items-center gap-1 mt-1 hover:underline"><Navigation size={12} /> Get Directions</a>
                                 </div>
                             </div>
                             <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                                 <Calendar size={18} className="text-slate-400 mt-0.5" />
                                 <div>
                                     <p className="text-white font-semibold text-sm">{selectedEvent.date}</p>
                                     <p className="text-slate-400 text-xs mt-1">Starts at {selectedEvent.time}</p>
                                 </div>
                             </div>
                             <div className="flex items-start gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800">
                                 <Users size={18} className="text-slate-400 mt-0.5" />
                                 <div>
                                     <p className="text-white font-semibold text-sm">{selectedEvent.participants} / {selectedEvent.max} Joined</p>
                                     <div className="w-full h-1.5 bg-slate-800 rounded-full mt-2 overflow-hidden">
                                         <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(selectedEvent.participants / selectedEvent.max) * 100}%` }} />
                                     </div>
                                 </div>
                             </div>
                         </div>

                         {isJoined ? (
                             <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl font-bold flex items-center justify-center gap-2">
                                 <CheckCircle2 size={20} /> Successfully Joined!
                             </div>
                         ) : (
                             <button 
                                onClick={handleJoin}
                                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-[#070a13] rounded-xl font-extrabold flex items-center justify-center gap-2 transition-all hover:scale-105 shadow-lg shadow-emerald-500/20"
                             >
                                 <CheckCircle2 size={20} /> {selectedEvent.price === 0 ? 'RSVP Now' : 'Purchase Ticket'}
                             </button>
                         )}
                     </motion.div>
                 ) : (
                     <div className="bg-[#131A24] border border-[#243041] rounded-3xl p-10 flex flex-col items-center justify-center text-center h-[500px] sticky top-24 border-dashed">
                         <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4">
                             <MapPin size={24} className="text-slate-500" />
                         </div>
                         <h3 className="text-white font-bold text-lg mb-2">No Event Selected</h3>
                         <p className="text-slate-400 text-sm max-w-[250px]">Click on an event from the list to view details and RSVP.</p>
                     </div>
                 )}
             </AnimatePresence>
          </div>
      </div>
    </div>
  );
}
