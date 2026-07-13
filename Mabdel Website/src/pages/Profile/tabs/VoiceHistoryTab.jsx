import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Mic, Play, RefreshCw, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { smartflowApi } from '../../../api/services';

const getApiData = (response) => response?.data?.data || response?.data || response || {};

const getHistoryItems = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

export default function VoiceHistoryTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replayingId, setReplayingId] = useState(null);
  const [error, setError] = useState('');

  const loadHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await smartflowApi.getVoiceHistory();
      const payload = getApiData(response);
      setHistory(getHistoryItems(payload));
    } catch (loadError) {
      setHistory([]);
      setError(loadError?.response?.data?.message || 'Unable to load voice history right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return history;
    return history.filter((item) => {
      const transcript = item.command_text || '';
      const responseText = item.response_text || item.preview_text || '';
      return transcript.toLowerCase().includes(term) || responseText.toLowerCase().includes(term);
    });
  }, [history, search]);

  const handleReplay = async (item) => {
    setReplayingId(item.id);
    setError('');
    try {
      const response = await smartflowApi.replayVoiceHistory(item.id);
      const payload = getApiData(response);
      navigate('/voice-conversation', {
        state: {
          replayResult: payload,
        },
      });
    } catch (replayError) {
      setError(replayError?.response?.data?.message || 'Replay failed for this history item.');
    } finally {
      setReplayingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white">
            <Mic className="text-cyan-400" />
            Voice History
          </h2>
          <p className="mt-1 text-sm text-slate-400">Replay real AI voice interactions from your account history.</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Search voice history"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-xl border border-[#243041] bg-[#070a13] py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-cyan-500/50 focus:outline-none sm:w-64"
            />
          </div>

          <button
            onClick={loadHistory}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#243041] bg-[#070a13] px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-950/20 px-4 py-3 text-sm text-rose-200">
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-[#243041]/60 bg-[#0c101b]">
        {loading ? (
          <div className="flex items-center justify-center gap-3 px-6 py-16 text-slate-300">
            <Loader2 size={20} className="animate-spin text-cyan-400" />
            Loading voice history...
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="px-6 py-16 text-center text-slate-500">
            <Mic size={40} className="mx-auto mb-4 opacity-25" />
            <p className="text-sm">{history.length === 0 ? 'No voice history yet.' : 'No history items match your search.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-[#243041]/40">
            {filteredHistory.map((item) => {
              const timestamp = item.timestamp ? new Date(item.timestamp) : null;
              const responseText = item.response_text || item.preview_text || item.status_label || 'Replay this interaction to view the latest AI response.';

              return (
                <div key={item.id} className="p-6 transition-colors hover:bg-slate-900/30">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <button
                        onClick={() => handleReplay(item)}
                        disabled={replayingId === item.id}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400 transition-colors hover:bg-cyan-500/20 disabled:opacity-60"
                        title="Replay conversation"
                      >
                        {replayingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} className="ml-0.5" />}
                      </button>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                            {item.command_type_label || 'AI Voice'}
                          </span>
                          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {item.status_label || 'Completed'}
                          </span>
                        </div>

                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">You Said</span>
                          <p className="mt-1 text-sm font-medium text-white">{item.command_text || 'No transcript available.'}</p>
                        </div>

                        <div className="border-l-2 border-slate-800 pl-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-500/70">Result</span>
                          <p className="mt-1 text-sm text-slate-400">{responseText}</p>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium text-slate-500">
                        {timestamp && !Number.isNaN(timestamp.getTime()) ? format(timestamp, 'MMM d, h:mm a') : 'Unknown time'}
                      </p>
                      {item.date_bucket ? (
                        <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-600">{item.date_bucket}</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
