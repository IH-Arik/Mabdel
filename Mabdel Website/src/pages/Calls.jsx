import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  RefreshCw,
  Search,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { smartflowApi } from '../api/services';
import { useTwilioVoice } from '../context/TwilioVoiceContext';

const PAGE_SIZE = 20;

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
}

function normalizePhone(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  const compact = trimmed.replace(/[^\d+]/g, '');
  if (compact.startsWith('+')) return compact;
  if (/^\d{10,15}$/.test(compact)) return `+${compact}`;
  return trimmed;
}

function getDirection(call) {
  const callType = String(call.call_type || '').toLowerCase();
  const status = String(call.status || '').toLowerCase();
  if (status === 'missed' || callType === 'missed') return 'missed';
  if (['outbound', 'outgoing_direct', 'outgoing_automated'].includes(callType) || String(call.direction || '').toLowerCase() === 'outbound') return 'outbound';
  return 'incoming';
}

function hasAiHandledState(call) {
  return Boolean(call.ai_ready || call.ai_summary_available || call.transcript_available);
}

function normalizeCall(call) {
  const direction = getDirection(call);
  const phoneNumber = call.phone_number || call.from_number || '';
  return {
    ...call,
    direction,
    phone_number: phoneNumber,
    contact_name: call.contact_name || call.caller_name || call.contact?.name || null,
    display_name: call.contact_name || call.caller_name || call.contact?.name || phoneNumber || 'Unknown Caller',
    display_time: call.display_time_label || (call.timestamp ? new Date(call.timestamp).toLocaleString() : ''),
    duration_label: call.duration_label || (call.duration ? `${call.duration}s` : '--'),
    recording_available: Boolean(call.recording_available || call.recording_url),
    transcript_available: Boolean(call.transcript_available || call.transcript),
    ai_summary_available: Boolean(call.ai_summary_available || call.ai_summary || call.ai_ready),
    callback_available: Boolean(phoneNumber || call.contact_id),
    ai_handled: hasAiHandledState(call),
  };
}

function matchesSearch(call, search) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const haystacks = [
    call.display_name,
    call.contact_name,
    call.phone_number,
    call.direction,
    call.status,
    call.status_label,
    call.call_type_label,
    call.ai_handled ? 'ai' : 'human',
    call.ai_handled ? 'ai handled' : '',
  ]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  return haystacks.some((value) => value.includes(query));
}

function buildSummary(calls, historySummary, analyticsSummary) {
  const durations = calls.map((call) => Number(call.duration || 0)).filter((value) => value > 0);
  const inbound = calls.filter((call) => call.direction === 'incoming').length;
  const outbound = calls.filter((call) => call.direction === 'outbound').length;
  const missed = calls.filter((call) => call.direction === 'missed').length;
  const aiAnalyzed = calls.filter((call) => call.ai_handled).length;
  const avgDuration = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;

  return {
    total_calls: historySummary?.total_calls ?? calls.length,
    inbound_calls: inbound,
    outbound_calls: outbound,
    missed_calls: historySummary?.missed_calls ?? missed,
    avg_duration: avgDuration,
    ai_analyzed: historySummary?.ai_summary_calls ?? aiAnalyzed,
    total_minutes_saved: analyticsSummary?.total_minutes_saved ?? 0,
    callback_queue: analyticsSummary?.callback_queue ?? [],
  };
}

function downloadFromUrl(url, filename) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function CallStats({ summary }) {
  if (!summary) return null;
  const stats = [
    { label: 'Total Calls', value: summary.total_calls || 0, icon: Phone, color: '#11C7E5' },
    { label: 'Inbound', value: summary.inbound_calls || 0, icon: PhoneIncoming, color: '#10B981' },
    { label: 'Outbound', value: summary.outbound_calls || 0, icon: PhoneOutgoing, color: '#8B5CF6' },
    { label: 'Missed', value: summary.missed_calls || 0, icon: PhoneMissed, color: '#EF4444' },
    { label: 'Avg Duration', value: summary.avg_duration ? `${summary.avg_duration}s` : '--', icon: Clock, color: '#F59E0B' },
    { label: 'AI Analyzed', value: summary.ai_analyzed || 0, icon: Brain, color: '#06B6D4' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1.5 rounded-2xl border border-[#243041] bg-[#131A24] p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${stat.color}18` }}>
            <stat.icon size={15} style={{ color: stat.color }} />
          </div>
          <p className="text-xl font-black text-white">{stat.value}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#A4B0B7]">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

function CallAnalysisPanel({ call, onClose, onCallback, onDownloadRecording }) {
  const [aiSummary, setAiSummary] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('summary');
  const audioRef = useRef(null);

  useEffect(() => {
    if (!call?.id) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [aiResponse, transcriptResponse, recordingResponse] = await Promise.all([
          smartflowApi.getCallAISummary(call.id).catch(() => ({ data: { data: null } })),
          smartflowApi.getCallTranscript(call.id).catch(() => ({ data: { data: null } })),
          smartflowApi.getCallRecordingUrl(call.id).catch(() => ({ data: { data: null } })),
        ]);

        if (cancelled) return;

        const aiPayload = aiResponse?.data?.data?.ai_summary || aiResponse?.data?.data || null;
        const transcriptPayload = transcriptResponse?.data?.data || {};
        const recordingPayload = recordingResponse?.data?.data || {};
        const segments = toArray(transcriptPayload.speaker_segments).filter(Boolean);
        const fallbackTranscript = transcriptPayload.transcript
          ? [{ speaker: 'caller', text: transcriptPayload.transcript }]
          : [];

        setAiSummary(aiPayload);
        setTranscript(segments.length ? segments : fallbackTranscript);
        setRecordingUrl(recordingPayload.recording_url || recordingPayload.url || '');
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.response?.data?.message || 'Call analysis could not be loaded.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [call?.id]);

  const summaryPurpose = aiSummary?.purpose || aiSummary?.summary || '';
  const keyPoints = toArray(aiSummary?.key_points || aiSummary?.highlights);
  const actionItems = toArray(aiSummary?.action_items || aiSummary?.actionItems);

  return (
    <div className="overflow-hidden rounded-[22px] border border-[#243041] bg-[#131A24]">
      <div className="flex items-center justify-between border-b border-[#243041]/40 bg-[#0C1420] px-5 py-4">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-[#11C7E5]" />
              <span className="text-sm font-bold text-white">AI Call Analysis</span>
            </div>
            <p className="mt-1 text-xs text-[#A4B0B7]">{call.display_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['summary', 'transcript', 'recording'].map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-all ${
                tab === item
                  ? 'border border-[#11C7E5]/20 bg-[#11C7E5]/10 text-[#11C7E5]'
                  : 'text-[#A4B0B7] hover:text-white'
              }`}
            >
              {item}
            </button>
          ))}
          <button onClick={onClose} className="cursor-pointer text-[#A4B0B7] hover:text-white">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="min-h-48 p-5">
        {loading ? (
          <div className="flex h-32 items-center justify-center gap-2 text-[#A4B0B7]">
            <Loader2 size={18} className="animate-spin" />
            Loading analysis...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-sm text-rose-300">{error}</div>
        ) : tab === 'summary' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#243041] bg-[#0A1019] p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#11C7E5]">Call Overview</p>
              <div className="grid gap-2 text-sm text-[#A4B0B7] sm:grid-cols-2">
                <p>Direction: <span className="text-white">{call.call_type_label || call.direction}</span></p>
                <p>Status: <span className="text-white">{call.status_label || call.status}</span></p>
                <p>Duration: <span className="text-white">{call.duration_label}</span></p>
                <p>Time: <span className="text-white">{call.display_time}</span></p>
              </div>
            </div>

            <div className="rounded-xl border border-[#243041] bg-[#0A1019] p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#11C7E5]">AI Summary</p>
              <p className="text-sm leading-relaxed text-[#A4B0B7]">
                {summaryPurpose || 'No AI summary available for this call yet.'}
              </p>
            </div>

            {keyPoints.length > 0 && (
              <div className="rounded-xl border border-[#243041] bg-[#0A1019] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#11C7E5]">Key Points</p>
                <ul className="space-y-1.5">
                  {keyPoints.map((point, index) => (
                    <li key={`${point}-${index}`} className="flex items-start gap-2 text-sm text-[#A4B0B7]">
                      <Sparkles size={13} className="mt-0.5 shrink-0 text-amber-400" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {actionItems.length > 0 && (
              <div className="rounded-xl border border-[#243041] bg-[#0A1019] p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#11C7E5]">Action Items</p>
                <ul className="space-y-1.5">
                  {actionItems.map((item, index) => (
                    <li key={`${item}-${index}`} className="flex items-start gap-2 text-sm text-[#A4B0B7]">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[#11C7E5]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => onCallback(call)}
                className="cursor-pointer rounded-xl border border-[#11C7E5]/20 bg-[#11C7E5]/10 px-4 py-2 text-sm font-bold text-[#11C7E5] transition-colors hover:bg-[#11C7E5]/20"
              >
                Callback
              </button>
              <button
                onClick={() => onDownloadRecording(call)}
                disabled={!recordingUrl}
                className="cursor-pointer rounded-xl border border-[#243246] bg-[#0A1019] px-4 py-2 text-sm font-bold text-[#A4B0B7] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Download Recording
              </button>
            </div>
          </div>
        ) : tab === 'transcript' ? (
          transcript.length > 0 ? (
            <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
              {transcript.map((segment, index) => {
                const speaker = String(segment.speaker || '').toLowerCase();
                const isAgent = speaker === 'agent' || speaker === 'ai' || speaker === 'assistant';
                return (
                  <div key={`${segment.text || segment.content || 'segment'}-${index}`} className={`flex gap-3 ${isAgent ? 'flex-row-reverse' : ''}`}>
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                        isAgent ? 'bg-[#11C7E5]/20 text-[#11C7E5]' : 'bg-[#243041] text-[#A4B0B7]'
                      }`}
                    >
                      {isAgent ? 'AI' : 'U'}
                    </div>
                    <div
                      className={`max-w-sm rounded-2xl border p-3 text-sm ${
                        isAgent
                          ? 'border-[#11C7E5]/20 bg-[#11C7E5]/10 text-white'
                          : 'border-[#243041] bg-[#0A1019] text-[#A4B0B7]'
                      }`}
                    >
                      {segment.text || segment.content}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-[#A4B0B7]">No transcript available for this call.</div>
          )
        ) : recordingUrl ? (
          <div className="space-y-3 rounded-xl border border-[#243041] bg-[#0A1019] p-4">
            <p className="text-sm text-[#A4B0B7]">Call Recording</p>
            <audio ref={audioRef} controls src={recordingUrl} className="w-full" />
            <button
              onClick={() => onDownloadRecording(call, recordingUrl)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#243246] px-4 py-2 text-sm text-[#A4B0B7] transition-colors hover:text-white"
            >
              <Download size={14} />
              Download Recording
            </button>
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-[#A4B0B7]">No recording available for this call.</div>
        )}
      </div>
    </div>
  );
}

function CallRow({ item, onAnalyze, onCallback, onDownloadRecording, callbackPending }) {
  const iconMap = {
    outbound: { icon: PhoneOutgoing, color: 'text-[#8B5CF6]' },
    missed: { icon: PhoneMissed, color: 'text-rose-400' },
    incoming: { icon: PhoneIncoming, color: 'text-emerald-400' },
  };
  const { icon: DirectionIcon, color } = iconMap[item.direction] || iconMap.incoming;

  return (
    <div className="border-b border-[#243041]/30 p-5 transition-colors last:border-0 hover:bg-[#1C2635]/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl border border-[#243041] bg-[#0A1019] ${color}`}>
            <DirectionIcon size={18} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">{item.display_name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#A4B0B7]">
              <span className={`font-semibold capitalize ${color}`}>{item.direction}</span>
              <span>{item.phone_number || 'No number'}</span>
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {item.duration_label}
              </span>
              <span>{item.display_time}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
              item.status_tone === 'success'
                ? 'border-emerald-500/20 bg-emerald-950/40 text-emerald-400'
                : item.status_tone === 'danger'
                  ? 'border-rose-500/20 bg-rose-950/40 text-rose-400'
                  : 'border-[#2A3550] bg-[#243041] text-[#A4B0B7]'
            }`}
          >
            {item.status_label || item.status}
          </span>

          {item.callback_available && (
            <button
              onClick={() => onCallback(item)}
              disabled={callbackPending}
              className="cursor-pointer rounded-xl border border-[#22c55e]/20 bg-[#22c55e]/10 px-3 py-2 text-xs font-bold text-[#22c55e] transition-colors hover:bg-[#22c55e]/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {callbackPending ? 'Calling...' : 'Callback'}
            </button>
          )}

          {item.recording_available && (
            <button
              onClick={() => onDownloadRecording(item)}
              className="cursor-pointer rounded-xl border border-[#243246] bg-[#0A1019] px-3 py-2 text-xs font-bold text-[#A4B0B7] transition-colors hover:text-white"
            >
              Recording
            </button>
          )}

          <button
            onClick={() => onAnalyze(item)}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#11C7E5]/20 bg-[#11C7E5]/10 px-3 py-2 text-xs font-bold text-[#11C7E5] transition-colors hover:bg-[#11C7E5]/20"
          >
            <Brain size={13} />
            Analyze
          </button>
        </div>
      </div>
    </div>
  );
}

function MakeCallModal({ onClose, onSuccess, onCall, runtimeReady, initialPhone = '' }) {
  const [phone, setPhone] = useState(initialPhone);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState('');

  async function call() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError('Enter a phone number.');
      return;
    }
    if (!/^\+\d{10,15}$/.test(normalized)) {
      setError('Enter a valid phone number in international format.');
      return;
    }

    setCalling(true);
    setError('');
    try {
      await onCall(normalized);
      onSuccess('Browser call initiated.');
      onClose();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Call failed.');
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-[#243041] bg-[#131A24] p-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-bold text-white">
            <PhoneOutgoing size={16} className="text-[#11C7E5]" />
            Make AI Call
          </h3>
          <button onClick={onClose} className="cursor-pointer text-[#A4B0B7] hover:text-white">
            <X size={18} />
          </button>
        </div>

        {error && <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</div>}

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-[#A4B0B7]">Phone Number</label>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+15551234567"
            className="w-full rounded-xl border border-[#243246] bg-[#0A1019] px-4 py-3 text-sm text-white outline-none transition-colors focus:border-[#11C7E5]/50"
            onKeyDown={(event) => event.key === 'Enter' && call()}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-xl border border-[#243246] bg-[#0A1019] py-3 font-bold text-[#A4B0B7] transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={call}
            disabled={calling || !runtimeReady}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#11C7E5] py-3 font-bold text-[#02080B] transition-colors hover:bg-[#0fd0f0] disabled:opacity-60"
          >
            {calling ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
            {calling ? 'Calling...' : runtimeReady ? 'Call Now' : 'Voice Unavailable'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function Calls() {
  const [calls, setCalls] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [analyzingCall, setAnalyzingCall] = useState(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [initialPhone, setInitialPhone] = useState('');
  const [pendingCallbackId, setPendingCallbackId] = useState('');
  const location = useLocation();
  const { startOutboundCall, isReady: isVoiceReady, error: voiceError } = useTwilioVoice();

  const fetchCalls = useCallback(async (nextPage = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const [callRes, analyticsRes] = await Promise.all([
        smartflowApi.getCalls({ page: nextPage, page_size: PAGE_SIZE }),
        smartflowApi.getCallSummary().catch(() => ({ data: { data: null } })),
      ]);

      const payload = callRes?.data?.data || {};
      const items = toArray(payload.items).map(normalizeCall);
      let resolvedCalls = items;
      setCalls((previous) => {
        const mergedCalls = append ? [...previous, ...items] : items;
        resolvedCalls = Array.from(new Map(mergedCalls.map((call) => [call.id, call])).values());
        return resolvedCalls;
      });
      setPage(payload.pagination?.page || nextPage);
      setTotalPages(payload.pagination?.pages || 1);
      setSummary(buildSummary(resolvedCalls, payload.summary, analyticsRes?.data?.data));
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Calls could not be loaded.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchCalls(1, false);
  }, [fetchCalls]);

  useEffect(() => {
    if (location.state?.prefill) {
      const prefill = location.state.prefill;
      const prefillPhone = prefill.phone || prefill.phone_number || prefill.client_phone || '';
      if (prefillPhone) {
        setInitialPhone(prefillPhone);
        setShowCallModal(true);
      }
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    if (!success) return undefined;
    const timeout = window.setTimeout(() => setSuccess(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [success]);

  useEffect(() => {
    const handleSync = () => {
      fetchCalls(1, false);
    };
    window.addEventListener('mabdel:calls-sync', handleSync);
    return () => window.removeEventListener('mabdel:calls-sync', handleSync);
  }, [fetchCalls]);

  const filteredCalls = useMemo(() => calls.filter((call) => matchesSearch(call, search)), [calls, search]);

  const canLoadMore = page < totalPages;

  const handleAnalyze = (call) => {
    setAnalyzingCall(call);
  };

  const handleCallback = async (call) => {
    const phoneNumber = normalizePhone(call.phone_number || '');
    if (!phoneNumber) {
      setError('No callback number is available for this call.');
      return;
    }

    try {
      setPendingCallbackId(call.id);
      await startOutboundCall({
        phoneNumber,
        displayName: call.display_name || call.contact_name || phoneNumber,
      });
      setSuccess('Browser callback started.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError?.message || 'Callback could not be started.');
    } finally {
      setPendingCallbackId('');
    }
  };

  const handleDownloadRecording = async (call, directUrl = '') => {
    try {
      let recordingUrl = directUrl;
      if (!recordingUrl) {
        const response = await smartflowApi.getCallRecordingUrl(call.id);
        recordingUrl = response?.data?.data?.recording_url || response?.data?.data?.url || '';
      }
      if (!recordingUrl) {
        setError('No recording is available for this call.');
        return;
      }
      downloadFromUrl(recordingUrl, `call-${call.id}.mp3`);
      setSuccess('Recording download started.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Recording could not be downloaded.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 border-b border-[#243041]/40 pb-4 lg:flex-row lg:items-end">
        <div className="text-left">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">AI Calling</h1>
          <p className="mt-1 text-xs text-[#A4B0B7]">Track calls, analyze conversations with AI, and review transcripts.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCallModal(true)}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#11C7E5] px-5 py-3 font-extrabold text-[#02080B] transition-all active:scale-95 hover:bg-[#0fd0f0]"
          >
            <Phone size={18} />
            Make AI Call
          </button>
          <button
            onClick={() => fetchCalls(1, false)}
            className="cursor-pointer rounded-xl border border-[#243246] bg-[#0A1019] px-4 py-3 text-[#A4B0B7] transition-colors hover:text-white"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-300">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-sm text-emerald-300">{success}</div>}
      {voiceError ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-300">
          Browser calling is not ready: {voiceError}
        </div>
      ) : null}

      {!loading && <CallStats summary={summary} />}

      <AnimatePresence>
        {analyzingCall && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            <CallAnalysisPanel
              call={analyzingCall}
              onClose={() => setAnalyzingCall(null)}
              onCallback={handleCallback}
              onDownloadRecording={handleDownloadRecording}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-[22px] border border-[#243041] bg-[#131A24] text-left">
        <div className="flex flex-col gap-4 border-b border-[#243041]/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Phone size={18} className="text-[#11C7E5]" />
            Call History
            <span className="ml-2 text-sm font-normal text-[#A4B0B7]">{filteredCalls.length} records</span>
          </div>
          <div className="relative w-full max-w-sm">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A4B0B7]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search calls by name, phone, status, direction, AI..."
              className="w-full rounded-xl border border-[#243246] bg-[#0A1019] py-2.5 pl-9 pr-3 text-sm text-white outline-none transition-colors focus:border-[#11C7E5]/50"
            />
          </div>
        </div>

        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={`loading-${index}`} className="h-20 animate-pulse border-b border-[#243041]/20 bg-[#1C2635]/20 p-5" />
          ))
        ) : filteredCalls.length ? (
          <>
            {filteredCalls.map((call) => (
              <CallRow
                key={call.id}
                item={call}
                onAnalyze={handleAnalyze}
                onCallback={handleCallback}
                onDownloadRecording={handleDownloadRecording}
                callbackPending={pendingCallbackId === call.id}
              />
            ))}
            {canLoadMore && (
              <div className="p-5">
                <button
                  onClick={() => fetchCalls(page + 1, true)}
                  disabled={loadingMore}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#243246] bg-[#0A1019] py-3 text-sm font-bold text-[#A4B0B7] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingMore ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {loadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="p-16 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#11C7E5]/10">
              <Phone size={24} className="text-[#11C7E5]" />
            </div>
            <p className="font-bold text-white">{search.trim() ? 'No matching calls found' : 'No calls yet'}</p>
            <p className="mt-1 text-sm text-[#A4B0B7]">
              {search.trim() ? 'Try a different name, number, status, or AI filter.' : 'Click "Make AI Call" to initiate your first call.'}
            </p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCallModal && (
            <MakeCallModal
              initialPhone={initialPhone}
              onClose={() => setShowCallModal(false)}
              runtimeReady={isVoiceReady}
              onCall={(phoneNumber) => startOutboundCall({ phoneNumber, displayName: phoneNumber })}
              onSuccess={async (message) => {
                setSuccess(message);
                await fetchCalls(1, false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
