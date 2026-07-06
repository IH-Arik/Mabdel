import { useState } from 'react';
import { Mic, Search, Play, MoreVertical } from 'lucide-react';
import { format } from 'date-fns';

export default function VoiceHistoryTab() {
  const [search, setSearch] = useState('');

  // Dummy data representing past voice interactions
  const history = [
    {
      id: 1,
      date: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      transcript: "Schedule a follow-up meeting with John for next Tuesday at 2 PM.",
      aiResponse: "Meeting scheduled with John for next Tuesday at 2:00 PM.",
      duration: "0:12"
    },
    {
      id: 2,
      date: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      transcript: "Create a new invoice for Acme Corp for the web design project.",
      aiResponse: "Draft invoice created for Acme Corp. Total amount is pending your review.",
      duration: "0:08"
    },
    {
      id: 3,
      date: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
      transcript: "What are my total earnings for this month so far?",
      aiResponse: "Your total earnings for this month are $12,450.00.",
      duration: "0:05"
    }
  ];

  const filteredHistory = history.filter(item => 
    item.transcript.toLowerCase().includes(search.toLowerCase()) || 
    item.aiResponse.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Mic className="text-cyan-400" /> Voice History
          </h2>
          <p className="text-slate-400 text-sm mt-1">Review your past voice commands and AI responses.</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            type="text"
            placeholder="Search transcripts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64 pl-10 pr-4 py-2 bg-[#070a13] border border-[#243041] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
      </div>

      <div className="bg-[#0c101b] border border-[#243041]/60 rounded-3xl overflow-hidden">
        {filteredHistory.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Mic size={48} className="mx-auto mb-4 opacity-20" />
            <p>No voice history found.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#243041]/40">
            {filteredHistory.map((item) => (
              <div key={item.id} className="p-6 hover:bg-slate-900/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  
                  <div className="flex items-start gap-4 flex-1">
                    <button className="w-10 h-10 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 hover:bg-cyan-500/20 transition-colors" title="Play audio">
                      <Play size={16} className="ml-0.5" />
                    </button>
                    
                    <div className="space-y-2 flex-1">
                      <div>
                        <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">You Said:</span>
                        <p className="text-white font-medium text-sm mt-0.5">"{item.transcript}"</p>
                      </div>
                      
                      <div className="pl-4 border-l-2 border-slate-800">
                        <span className="text-[10px] text-cyan-500/70 font-bold uppercase tracking-wider">AI Response:</span>
                        <p className="text-slate-400 text-sm mt-0.5">{item.aiResponse}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 shrink-0">
                     <span className="text-xs text-slate-500 font-medium">
                       {format(item.date, 'MMM d, h:mm a')}
                     </span>
                     <span className="text-[10px] font-mono text-slate-600 bg-slate-900 px-2 py-0.5 rounded">
                       {item.duration}
                     </span>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
