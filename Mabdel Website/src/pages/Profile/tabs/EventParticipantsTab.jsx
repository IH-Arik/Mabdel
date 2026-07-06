import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, UserCircle2, Mail, Phone, Calendar, ArrowRight, ShieldCheck, Ticket } from 'lucide-react';

const mockParticipants = [
  { id: 1, name: 'Alex Johnson', role: 'Investor', email: 'alex@example.com', phone: '+1 234 567 8900', event: 'Real Estate Investor Meetup', registeredAt: '2026-10-01', status: 'Confirmed' },
  { id: 2, name: 'Sarah Williams', role: 'Realtor', email: 'sarah.w@example.com', phone: '+1 987 654 3210', event: 'Property Tech Conference', registeredAt: '2026-10-05', status: 'Pending' },
  { id: 3, name: 'Michael Chen', role: 'First-time Buyer', email: 'michael.c@example.com', phone: '+1 555 123 4567', event: 'First-Time Homebuyer Seminar', registeredAt: '2026-10-10', status: 'Confirmed' },
  { id: 4, name: 'Emily Davis', role: 'Broker', email: 'emily@example.com', phone: '+1 555 987 6543', event: 'Real Estate Investor Meetup', registeredAt: '2026-10-12', status: 'Cancelled' },
];

export default function EventParticipantsTab() {
  const [search, setSearch] = useState('');

  const filtered = mockParticipants.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.event.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Ticket className="text-blue-400" /> Event Participants
          </h2>
          <p className="text-sm text-slate-400 mt-1">Manage attendees for events you are hosting.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search attendees or events..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.length === 0 ? (
           <div className="p-8 text-center text-slate-400 bg-slate-900/50 border border-slate-800 rounded-2xl">
               No participants found.
           </div>
        ) : (
           filtered.map((participant) => (
             <motion.div 
               key={participant.id}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-[#131A24] border border-[#243041] rounded-2xl p-5 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between hover:border-slate-600 transition-colors group"
             >
               <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <UserCircle2 size={24} className="text-slate-400" />
                 </div>
                 <div>
                   <h3 className="text-white font-bold text-base flex items-center gap-2">
                       {participant.name}
                       {participant.status === 'Confirmed' && <ShieldCheck size={14} className="text-emerald-400" />}
                   </h3>
                   <p className="text-blue-400 text-xs font-semibold">{participant.role}</p>
                 </div>
               </div>
               
               <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto md:px-8 border-y md:border-y-0 md:border-l border-[#243041] py-4 md:py-0 my-4 md:my-0">
                  <div className="space-y-1">
                      <p className="text-slate-400 text-xs flex items-center gap-1.5"><Calendar size={14} /> {participant.event}</p>
                      <p className="text-slate-500 text-xs flex items-center gap-1.5"><ArrowRight size={14} /> Registered: {participant.registeredAt}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-slate-400 text-xs flex items-center gap-1.5"><Mail size={14} /> {participant.email}</p>
                      <p className="text-slate-400 text-xs flex items-center gap-1.5"><Phone size={14} /> {participant.phone}</p>
                  </div>
               </div>

               <div className="flex items-center gap-3 w-full md:w-auto">
                   <span className={`px-3 py-1 text-xs font-bold rounded-full ${participant.status === 'Confirmed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : participant.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                       {participant.status}
                   </span>
                   <button className="flex-1 md:flex-none px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors border border-slate-800">
                       Message
                   </button>
               </div>
             </motion.div>
           ))
        )}
      </div>
    </div>
  );
}
