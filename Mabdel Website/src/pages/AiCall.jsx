import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Activity, Sparkles, Bot, Square, PhoneCall, Loader2, AlertTriangle, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { smartflowApi } from '../api/services';
import { useLanguage } from '../context/LanguageContext';

// A turn ends after this much quiet once the person has spoken.
const SPEECH_LEVEL = 0.02;
const SILENCE_MS = 1200;
const MAX_TURN_MS = 30000;
const CHECK_EVERY_MS = 100;

const elapsedMs = () => performance.now();

const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type)) || '';
};

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export default function AiCall() {
  const { t } = useLanguage();
  // idle -> listening -> thinking -> speaking -> listening ... until the person ends it
  const [phase, setPhase] = useState('idle');
  const [muted, setMuted] = useState(false);
  const [turns, setTurns] = useState([]);
  const [error, setError] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(0);

  const sessionRef = useRef({ id: 0, active: false });
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const recorderRef = useRef(null);
  const monitorRef = useRef(null);
  const clockRef = useRef(null);
  const playerRef = useRef(null);
  const mutedRef = useRef(false);
  const transcriptEndRef = useRef(null);

  const releaseMedia = useCallback(() => {
    window.clearInterval(monitorRef.current);
    window.clearInterval(clockRef.current);
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    if (playerRef.current) {
      playerRef.current.onended = null;
      playerRef.current.pause();
      playerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  // Leaving the page must turn the microphone off.
  useEffect(() => () => {
    sessionRef.current.active = false;
    releaseMedia();
  }, [releaseMedia]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [turns, phase]);

  const currentLevel = () => {
    const analyser = analyserRef.current;
    if (!analyser || mutedRef.current) return 0;
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
    return Math.sqrt(sum / samples.length);
  };

  const listen = () => {
    const session = sessionRef.current;
    if (!session.active || !streamRef.current) return;
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    const chunks = [];
    const turnStartedAt = elapsedMs();
    let lastVoiceAt = turnStartedAt;
    let heardSpeech = false;

    recorder.ondataavailable = (event) => {
      if (event.data?.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      window.clearInterval(monitorRef.current);
      if (!sessionRef.current.active || sessionRef.current.id !== session.id) return;
      if (!heardSpeech) {
        listen(); // nothing was said: keep listening
        return;
      }
      ask(new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' }), session.id);
    };

    recorderRef.current = recorder;
    recorder.start(250);
    setPhase('listening');

    window.clearInterval(monitorRef.current);
    monitorRef.current = window.setInterval(() => {
      const at = elapsedMs();
      if (currentLevel() > SPEECH_LEVEL) {
        heardSpeech = true;
        lastVoiceAt = at;
      }
      const quietLongEnough = heardSpeech && at - lastVoiceAt > SILENCE_MS;
      if ((quietLongEnough || at - turnStartedAt > MAX_TURN_MS) && recorder.state !== 'inactive') recorder.stop();
    }, CHECK_EVERY_MS);
  };

  const ask = async (blob, sessionId) => {
    setPhase('thinking');
    setError('');
    try {
      const response = await smartflowApi.voiceChat(blob);
      if (!sessionRef.current.active || sessionRef.current.id !== sessionId) return;
      const data = response.data?.data || {};
      setTurns((current) => [...current, { id: `${sessionId}-${current.length}`, question: data.transcript, answer: data.ai_response }]);
      const audio = data.audio;
      if (audio?.audio_base64) {
        const player = new Audio(`data:${audio.mime_type || 'audio/wav'};base64,${audio.audio_base64}`);
        playerRef.current = player;
        player.onended = () => {
          playerRef.current = null;
          listen();
        };
        setPhase('speaking');
        await player.play().catch(() => listen());
        return;
      }
      listen();
    } catch (requestError) {
      if (!sessionRef.current.active || sessionRef.current.id !== sessionId) return;
      setError(requestError?.response?.data?.message || t('aicall_err_failed'));
      listen(); // e.g. "could not understand" - let them say it again
    }
  };

  const handleStart = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError(t('aicall_err_unsupported'));
      return;
    }
    setPhase('connecting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContextClass();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      streamRef.current = stream;
      audioContextRef.current = context;
      analyserRef.current = analyser;
      sessionRef.current = { id: sessionRef.current.id + 1, active: true };
      mutedRef.current = false;
      setMuted(false);
      setTurns([]);
      const at = Date.now();
      setStartedAt(at);
      setNow(at);
      clockRef.current = window.setInterval(() => setNow(Date.now()), 1000);
      listen();
    } catch {
      releaseMedia();
      setPhase('idle');
      setError(t('aicall_err_mic'));
    }
  };

  const handleEnd = () => {
    sessionRef.current.active = false;
    releaseMedia();
    setPhase('idle');
    setMuted(false);
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    setMuted(next);
  };

  const active = phase !== 'idle' && phase !== 'connecting';
  const seconds = active ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const statusText = {
    connecting: t('aicall_connecting'),
    listening: muted ? t('aicall_muted') : t('aicall_listening'),
    thinking: t('aicall_thinking'),
    speaking: t('aicall_speaking'),
  }[phase];

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-10rem)]">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-purple-500/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold text-white">{t('aicall_title')}</h1>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {t('aicall_badge')}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{t('aicall_notice')}</p>
          </div>
        </div>

        <Link
          to="/calls"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors"
        >
          <PhoneCall size={14} className="text-emerald-400" />
          <span>{t('aicall_phone_link')}</span>
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center relative p-8 pb-36 bg-[#0c101b] border border-[#243041]/60 rounded-3xl overflow-hidden shadow-2xl min-h-[500px]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
          {active ? (
            <>
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute w-[500px] h-[500px] bg-purple-500/20 rounded-full blur-[100px]"
              />
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.25, 0.1] }}
                transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                className="absolute w-[320px] h-[320px] bg-indigo-500/20 rounded-full blur-[80px]"
              />
            </>
          ) : null}
        </div>

        <div className="z-10 flex flex-col items-center max-w-md text-center">
          <div className="relative mb-6">
            <div className="w-32 h-32 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center shadow-2xl relative z-10">
              {phase === 'thinking' ? (
                <Loader2 size={48} className="text-purple-400 animate-spin" />
              ) : phase === 'speaking' ? (
                <Volume2 size={48} className="text-purple-400 animate-pulse" />
              ) : phase === 'listening' && !muted ? (
                <Activity size={48} className="text-purple-400 animate-pulse" />
              ) : (
                <Bot size={48} className="text-purple-400/80" />
              )}
            </div>
            {phase === 'listening' && !muted ? (
              <div className="absolute inset-[-16px] border border-purple-500/40 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
            ) : null}
          </div>

          <h2 className="text-3xl font-black text-white mb-3">{t('aicall_agent_name')}</h2>

          <div className="h-8 flex items-center justify-center gap-3" data-testid="aicall-status">
            {active ? (
              <span className="text-emerald-400 font-mono font-bold text-lg">{formatDuration(seconds)}</span>
            ) : null}
            <span className={`text-sm font-semibold ${active ? 'text-purple-300' : 'text-slate-400'}`}>{statusText || t('aicall_ready')}</span>
          </div>
        </div>

        {error ? (
          <div role="alert" className="z-10 mt-4 flex max-w-lg items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 px-4 py-2.5 text-xs text-rose-200">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        ) : null}

        {turns.length ? (
          <div className="z-10 mt-6 w-full max-w-2xl max-h-72 overflow-y-auto space-y-3 text-left" aria-live="polite">
            {turns.map((turn) => (
              <div key={turn.id} className="space-y-2">
                <div className="flex justify-end">
                  <p className="max-w-[80%] rounded-2xl rounded-tr-none bg-purple-600/80 px-4 py-2.5 text-sm text-white">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-100/80">{t('aicall_you')}</span>
                    {turn.question}
                  </p>
                </div>
                <div className="flex justify-start">
                  <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-tl-none border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-sm text-slate-200">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-400">{t('aicall_agent_name')}</span>
                    {turn.answer}
                  </p>
                </div>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        ) : null}

        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-6 z-10">
          {active ? (
            <>
              <button
                type="button"
                onClick={toggleMute}
                title={muted ? t('aicall_unmute') : t('aicall_mute')}
                aria-label={muted ? t('aicall_unmute') : t('aicall_mute')}
                aria-pressed={muted}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                  muted ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
                }`}
              >
                {muted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>
              <button
                type="button"
                onClick={handleEnd}
                title={t('aicall_end')}
                aria-label={t('aicall_end')}
                className="w-20 h-20 rounded-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 transition-transform hover:scale-105 cursor-pointer border border-rose-400/40"
              >
                <Square size={28} className="fill-current" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={phase === 'connecting'}
              className="flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-xl shadow-purple-600/30 transition-all cursor-pointer border border-purple-400/30 disabled:opacity-50"
            >
              {phase === 'connecting' ? <Loader2 size={24} className="animate-spin" /> : <Mic size={24} />}
              <span>{t('aicall_start')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
