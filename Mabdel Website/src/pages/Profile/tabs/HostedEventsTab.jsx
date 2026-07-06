import { useState } from 'react';
import { Calendar, Users } from 'lucide-react';
import { useProfileStore } from '../../../store/useProfileStore';

export default function HostedEventsTab() {
  const { hostedEvents } = useProfileStore();

  return (
    <div className="space-y-6">
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Calendar size={16} className="text-[#11C7E5]"/>Hosted Events & Activities</h3>
        <p className="text-[#A4B0B7] text-sm">Manage your created events and track participants here.</p>
        
        {hostedEvents.length > 0 ? (
          <div className="space-y-3 mt-4">
            {hostedEvents.map(event => (
              <div key={event.id} className="bg-[#131A24] border border-[#243041] p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-white font-bold">{event.title}</h4>
                  <p className="text-[#A4B0B7] text-xs mt-1">Date: {event.date}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-[#11C7E5] justify-end">
                    <Users size={14}/>
                    <span className="font-bold text-sm">{event.participants}</span>
                  </div>
                  <p className="text-emerald-400 text-xs mt-1 font-semibold">{event.revenue}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-[#A4B0B7] border border-dashed border-[#243041] rounded-xl">No events hosted yet.</div>
        )}
      </div>
    </div>
  );
}