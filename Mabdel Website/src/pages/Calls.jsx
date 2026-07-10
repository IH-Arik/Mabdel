import { useCallback, useEffect, useState, useRef } from 'react';
import {
  AlertTriangle, Brain, CheckCircle2, ChevronDown, ChevronUp, Clock,
  Download, FileText, Loader2, Mic, Phone, PhoneIncoming, PhoneMissed,
  PhoneOutgoing, Play, RefreshCw, ScrollText, Sparkles, Volume2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { smartflowApi } from '../api/services';

// ── Call Summary Stats ─────────────────────────────────────────────────────────
function CallStats({ summary }) {
  if (!summary) return null;
  const stats = [
    { label: 'Total Calls',   value: summary.total_calls   || 0, icon: Phone,         color: '#11C7E5' },
    { label: 'Inbound',       value: summary.inbound_calls  || 0, icon: PhoneIncoming, color: '#10B981' },
    { label: 'Outbound',      value: summary.outbound_calls || 0, icon: PhoneOutgoing, color: '#8B5CF6' },
    { label: 'Missed',        value: summary.missed_calls   || 0, icon: PhoneMissed,   color: '#EF4444' },
    { label: 'Avg Duration',  value: summary.avg_duration ? `${Math.round(summary.avg_duration)}s` : '—', icon: Clock, color: '#F59E0B' },
    { label: 'AI Analyzed',   value: summary.ai_analyzed   || 0, icon: Brain,          color: '#06B6D4' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map(s => (
        <div key={s.label} className="bg-[#131A24] border border-[#243041] rounded-2xl p-4 flex flex-col gap-1.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:`${s.color}18`}}>
            <s.icon size={15} style={{color:s.color}}/>
          </div>
          <p className="text-xl font-black text-white">{s.value}</p>
          <p className="text-[#A4B0B7] text-[10px] font-semibold uppercase tracking-wider">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Call Analysis Panel ────────────────────────────────────────────────────────
function CallAnalysisPanel({ callId, onClose }) {
  const [aiSummary, setAiSummary] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [recording, setRecording] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('summary');
  const audioRef = useRef(null);

  useEffect(() => {
    if (!callId) return;
    setLoading(true);
    Promise.all([
      smartflowApi.getCallAISummary(callId).catch(() => ({ data: { data: null } })),
      smartflowApi.getCallTranscript(callId).catch(() => ({ data: { data: [] } })),
      smartflowApi.getCallRecordingUrl(callId).catch(() => ({ data: { data: null } })),
    ]).then(([ai, tr, rec]) => {
      setAiSummary(ai.data?.data || null);
      setTranscript(tr.data?.data?.segments || tr.data?.data || []);
      setRecording(rec.data?.data?.url || null);
    }).finally(() => setLoading(false));
  }, [callId]);

  return (
    <div className="bg-[#131A24] border border-[#243041] rounded-[22px] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-[#0C1420] border-b border-[#243041]/40">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[#11C7E5]"/>
          <span className="font-bold text-white text-sm">AI Call Analysis</span>
        </div>
        <div className="flex items-center gap-2">
          {['summary','transcript','recording'].map(t => (
            <button key={t} onClick={()=>setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer capitalize ${tab===t ? 'bg-[#11C7E5]/10 text-[#11C7E5] border border-[#11C7E5]/20' : 'text-[#A4B0B7] hover:text-white'}`}>
              {t}
            </button>
          ))}
          <button onClick={onClose} className="ml-2 text-[#A4B0B7] hover:text-white cursor-pointer"><X size={16}/></button>
        </div>
      </div>
      <div className="p-5 min-h-48">
        {loading ? (
          <div className="flex items-center justify-center h-32 gap-2 text-[#A4B0B7]"><Loader2 size={18} className="animate-spin"/>Loading analysis…</div>
        ) : tab === 'summary' ? (
          aiSummary ? (
            <div className="space-y-4">
              {aiSummary.summary && (
                <div className="p-4 bg-[#0A1019] border border-[#243041] rounded-xl">
                  <p className="text-xs font-bold text-[#11C7E5] uppercase tracking-wider mb-2">AI Summary</p>
                  <p className="text-[#A4B0B7] text-sm leading-relaxed">{aiSummary.summary}</p>
                </div>
              )}
              {aiSummary.sentiment && (
                <div className="p-4 bg-[#0A1019] border border-[#243041] rounded-xl">
                  <p className="text-xs font-bold text-[#11C7E5] uppercase tracking-wider mb-2">Sentiment</p>
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                    aiSummary.sentiment === 'positive' ? 'bg-emerald-950/40 text-emerald-400' :
                    aiSummary.sentiment === 'negative' ? 'bg-rose-950/40 text-rose-400' :
                    'bg-amber-950/40 text-amber-400'
                  }`}>{aiSummary.sentiment}</span>
                </div>
              )}
              {aiSummary.action_items?.length > 0 && (
                <div className="p-4 bg-[#0A1019] border border-[#243041] rounded-xl">
                  <p className="text-xs font-bold text-[#11C7E5] uppercase tracking-wider mb-2">Action Items</p>
                  <ul className="space-y-1.5">
                    {aiSummary.action_items.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#A4B0B7]">
                        <CheckCircle2 size={13} className="text-[#11C7E5] mt-0.5 shrink-0"/> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {aiSummary.key_points?.length > 0 && (
                <div className="p-4 bg-[#0A1019] border border-[#243041] rounded-xl">
                  <p className="text-xs font-bold text-[#11C7E5] uppercase tracking-wider mb-2">Key Points</p>
                  <ul className="space-y-1.5">
                    {aiSummary.key_points.map((p, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#A4B0B7]">
                        <Sparkles size={13} className="text-amber-400 mt-0.5 shrink-0"/> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : <div className="p-8 text-center text-[#A4B0B7] text-sm">No AI summary available for this call yet.</div>
        ) : tab === 'transcript' ? (
          transcript.length > 0 ? (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {transcript.map((seg, i) => (
                <div key={i} className={`flex gap-3 ${seg.speaker === 'agent' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${seg.speaker==='agent' ? 'bg-[#11C7E5]/20 text-[#11C7E5]' : 'bg-[#243041] text-[#A4B0B7]'}`}>
                    {seg.speaker === 'agent' ? 'AI' : 'U'}
                  </div>
                  <div className={`max-w-sm p-3 rounded-2xl text-sm ${seg.speaker==='agent' ? 'bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-white' : 'bg-[#0A1019] border border-[#243041] text-[#A4B0B7]'}`}>
                    {seg.text || seg.content}
                    {seg.timestamp && <span className="block text-[10px] mt-1 opacity-60">{seg.timestamp}</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="p-8 text-center text-[#A4B0B7] text-sm">No transcript available for this call.</div>
        ) : (
          recording ? (
            <div className="p-4 space-y-3">
              <p className="text-[#A4B0B7] text-sm">Call Recording</p>
              <audio ref={audioRef} controls src={recording} className="w-full"/>
              <a href={recording} download className="inline-flex items-center gap-2 px-4 py-2 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl text-sm hover:text-white transition-colors">
                <Download size={14}/> Download Recording
              </a>
            </div>
          ) : <div className="p-8 text-center text-[#A4B0B7] text-sm">No recording available for this call.</div>
        )}
      </div>
    </div>
  );
}

// ── Call Row ──────────────────────────────────────────────────────────────────
function CallRow({ item, onAnalyze }) {
  const dir = item.direction || item.call_type || 'inbound';
  const DirIcon = dir === 'outbound' ? PhoneOutgoing : dir === 'missed' ? PhoneMissed : PhoneIncoming;
  const dirColor = dir === 'outbound' ? 'text-[#8B5CF6]' : dir === 'missed' ? 'text-rose-400' : 'text-emerald-400';

  return (
    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#1C2635]/10 transition-colors border-b border-[#243041]/30 last:border-0">
      <div className="flex items-center gap-4">
        <div className={`w-10 h-10 rounded-xl bg-[#0A1019] border border-[#243041] flex items-center justify-center ${dirColor}`}>
          <DirIcon size={18}/>
        </div>
        <div>
          <p className="font-bold text-white text-sm">{item.contact_name || item.caller_name || item.phone_number || 'Unknown'}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-[#A4B0B7]">
            <span className={`capitalize font-semibold ${dirColor}`}>{dir}</span>
            {item.duration && <span className="flex items-center gap-1"><Clock size={10}/>{item.duration}s</span>}
            {item.created_at && <span>{new Date(item.created_at).toLocaleString()}</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 self-start sm:self-auto">
        {item.status && (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
            item.status==='completed' ? 'bg-emerald-950/40 border-emerald-500/20 text-emerald-400' :
            item.status==='missed' ? 'bg-rose-950/40 border-rose-500/20 text-rose-400' :
            'bg-[#243041] border-[#2A3550] text-[#A4B0B7]'
          }`}>{item.status}</span>
        )}
        <button onClick={()=>onAnalyze(item.id)}
          className="px-3 py-2 bg-[#11C7E5]/10 border border-[#11C7E5]/20 text-[#11C7E5] hover:bg-[#11C7E5]/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
          <Brain size={13}/> Analyze
        </button>
      </div>
    </div>
  );
}

// ── Make Call Modal ───────────────────────────────────────────────────────────
function MakeCallModal({ onClose, onSuccess, initialPhone = '' }) {
  const [phone, setPhone] = useState(initialPhone);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState('');

  async function call() {
    if (!phone.trim()) { setError('Enter a phone number.'); return; }
    setCalling(true); setError('');
    try {
      await smartflowApi.createOutboundCall({ phone_number: phone.trim(), call_type: 'ai_call' });
      onSuccess('Outbound call initiated!');
      onClose();
    } catch(err) { setError(err.response?.data?.message || 'Call failed.'); }
    finally { setCalling(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
        className="bg-[#131A24] border border-[#243041] rounded-2xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2"><PhoneOutgoing size={16} className="text-[#11C7E5]"/>Make AI Call</h3>
          <button onClick={onClose} className="text-[#A4B0B7] hover:text-white cursor-pointer"><X size={18}/></button>
        </div>
        {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">{error}</div>}
        <div>
          <label className="text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5 block">Phone Number</label>
          <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1 234 567 890"
            className="w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm"
            onKeyDown={e=>e.key==='Enter'&&call()}/>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl font-bold hover:text-white transition-colors cursor-pointer">Cancel</button>
          <button onClick={call} disabled={calling} className="flex-1 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60">
            {calling ? <Loader2 size={16} className="animate-spin"/> : <Phone size={16}/>}
            {calling ? 'Calling…' : 'Call Now'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Calls() {
  const [calls, setCalls] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [analyzingId, setAnalyzingId] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [initialPhone, setInitialPhone] = useState('');

  const location = useLocation();

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [callRes, sumRes] = await Promise.all([
        smartflowApi.getCalls(),
        smartflowApi.getCallSummary().catch(() => ({ data: { data: null } })),
      ]);
      setCalls(callRes.data?.data?.items || callRes.data?.data || []);
      setSummary(sumRes.data?.data || null);
    } catch (err) {
      setError(err.response?.data?.message || 'Calls could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (location.state?.prefill) {
      const p = location.state.prefill;
      if (p.phone || p.phone_number || p.client_phone) {
        setInitialPhone(p.phone || p.phone_number || p.client_phone || '');
        setShowCallModal(true);
      }
      
      // Clear state so it doesn't re-trigger
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-[#243041]/40 pb-4">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">AI Call Analytics</h1>
          <p className="text-[#A4B0B7] text-xs mt-1">Track calls, analyze conversations with AI, and review transcripts.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={()=>setShowCallModal(true)}
            className="px-5 py-3 bg-[#11C7E5] text-[#02080B] hover:bg-[#0fd0f0] rounded-xl font-extrabold flex items-center gap-2 active:scale-95 transition-all cursor-pointer">
            <Phone size={18}/> Make AI Call
          </button>
          <button onClick={fetchAll} className="px-4 py-3 bg-[#0A1019] border border-[#243246] text-[#A4B0B7] rounded-xl hover:text-white transition-colors cursor-pointer">
            <RefreshCw size={16}/>
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm">{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm">{success}</div>}

      {/* Stats */}
      {!loading && <CallStats summary={summary}/>}

      {/* Analysis Panel */}
      <AnimatePresence>
        {analyzingId && (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}>
            <CallAnalysisPanel callId={analyzingId} onClose={()=>setAnalyzingId(null)}/>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calls List */}
      <div className="bg-[#131A24] border border-[#243041] rounded-[22px] overflow-hidden text-left">
        <div className="p-5 border-b border-[#243041]/40 flex items-center gap-2 font-bold text-white text-base">
          <Phone size={18} className="text-[#11C7E5]"/> Call History
          <span className="ml-auto text-sm text-[#A4B0B7] font-normal">{calls.length} records</span>
        </div>
        {loading
          ? Array(4).fill(0).map((_,i) => <div key={i} className="p-5 animate-pulse h-20 bg-[#1C2635]/20 border-b border-[#243041]/20"/>)
          : calls.length
            ? calls.map(c => <CallRow key={c.id} item={c} onAnalyze={setAnalyzingId}/>)
            : (
              <div className="p-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center mx-auto mb-4"><Phone size={24} className="text-[#11C7E5]"/></div>
                <p className="text-white font-bold">No calls yet</p>
                <p className="text-[#A4B0B7] text-sm mt-1">Click "Make AI Call" to initiate your first call.</p>
              </div>
            )
        }
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showCallModal && <MakeCallModal initialPhone={initialPhone} onClose={()=>setShowCallModal(false)} onSuccess={(msg)=>{setSuccess(msg); setTimeout(()=>setSuccess(''),3000); fetchAll();}}/>}
      </AnimatePresence>
    </div>
  );
}
