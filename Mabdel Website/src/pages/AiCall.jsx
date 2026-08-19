import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Settings, Activity, Sparkles, Bot, Square, Info, PhoneCall } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { smartflowApi } from '../api/services';
import { useLanguage } from '../context/LanguageContext';

export default function AiCall() {
  const { t } = useLanguage();
  const [isCalling, setIsCalling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    let interval;
    if (isConnected) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  // Handle mute/unmute
  useEffect(() => {
    if (mediaRef.current && mediaRef.current.stream) {
      mediaRef.current.stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCall = async () => {
    setIsCalling(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = e => chunksRef.current.push(e.data);

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

        try {
          const res = await smartflowApi.voiceChat(blob);
          const audioUrl = res.data?.data?.audio_url || res.data?.audio_url;
          if (audioUrl) {
            const audio = new Audio(audioUrl);
            audio.play().catch(() => {});
          }
        } catch (err) {
          console.error("AI Voice Chat Error:", err);
        }
      };

      recorder.start();
      mediaRef.current = recorder;

      // We simulate a tiny connection delay just for UI effect
      setTimeout(() => {
        setIsCalling(false);
        setIsConnected(true);
      }, 1000);

    } catch (err) {
      console.error(err);
      alert(t('aicall_err_mic') || 'Microphone access denied. Please grant microphone permissions.');
      setIsCalling(false);
    }
  };

  const handleEndCall = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
    }
    setIsCalling(false);
    setIsConnected(false);
    setIsMuted(false);
  };

  return (
    <div className="flex flex-col gap-6 min-h-[calc(100vh-10rem)]">
      {/* Informational Header Pill */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/80 border border-purple-500/20 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white">
                {t('aicall_title') || 'AI Voice Assistant'}
              </h1>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {t('aicall_badge') || 'Web Audio Chat • Browser Microphone'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('aicall_notice') || 'Interactive browser audio assistant session. For PSTN phone calls, visit the Calls page.'}
            </p>
          </div>
        </div>

        <Link
          to="/calls"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors"
        >
          <PhoneCall size={14} className="text-emerald-400" />
          <span>Phone Call & Dialer</span>
        </Link>
      </div>

      {/* Main Interactive Audio Studio Container */}
      <div className="flex-1 flex flex-col items-center justify-center relative p-8 bg-[#0c101b] border border-[#243041]/60 rounded-3xl overflow-hidden shadow-2xl min-h-[500px]">
        {/* Animated Soundwave Visualizer Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
          {isConnected && (
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
          )}
        </div>

        <div className="z-10 flex flex-col items-center max-w-md text-center">
          {/* Avatar / Visualizer Node */}
          <div className="relative mb-8">
            <div className="w-36 h-36 rounded-full bg-slate-900 border border-slate-700/80 flex items-center justify-center shadow-2xl relative z-10">
              {isConnected && !isMuted ? (
                <Activity size={52} className="text-purple-400 animate-pulse" />
              ) : (
                <Bot size={52} className="text-purple-400/80" />
              )}
            </div>

            {isCalling && (
              <div className="absolute inset-[-12px] border-2 border-purple-500/40 rounded-full animate-ping" />
            )}
            {isConnected && !isMuted && (
              <>
                <div className="absolute inset-[-16px] border border-purple-500/40 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-[-32px] border border-purple-500/20 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
              </>
            )}
          </div>

          <h2 className="text-3xl font-black text-white mb-2">{t('aicall_agent_name') || 'GoCustify AI Assistant'}</h2>
          
          <div className="flex items-center gap-2 mb-6 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-full border border-slate-800">
            <Info size={14} className="text-purple-400" />
            <span>Web Audio Assistant (Microphone & Speaker)</span>
          </div>

          <div className="h-8 flex items-center justify-center">
            {isCalling ? (
              <span className="text-purple-400 font-bold animate-pulse text-sm">
                {t('aicall_connecting') || 'Initializing Audio Session...'}
              </span>
            ) : isConnected ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-emerald-400 font-mono font-bold text-xl">{formatDuration(duration)}</span>
              </div>
            ) : (
              <span className="text-slate-400 font-medium text-sm">
                {t('aicall_ready') || 'Click microphone to start voice chat'}
              </span>
            )}
          </div>
        </div>

        {/* Audio Session Controls */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-6 z-10">
          {isConnected ? (
            <>
              <button
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? "Unmute Mic" : "Mute Mic"}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                  isMuted
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-700'
                }`}
              >
                {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
              </button>

              <button
                onClick={handleEndCall}
                title="End Voice Session"
                className="w-20 h-20 rounded-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white flex items-center justify-center shadow-lg shadow-rose-500/25 transition-transform hover:scale-105 cursor-pointer border border-rose-400/40"
              >
                <Square size={28} className="fill-current" />
              </button>

              <button
                title="Audio Settings"
                className="w-14 h-14 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700 hover:bg-slate-700"
              >
                <Settings size={22} />
              </button>
            </>
          ) : (
            <button
              onClick={handleStartCall}
              disabled={isCalling}
              className={`flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-xl shadow-purple-600/30 transition-all cursor-pointer border border-purple-400/30 ${
                isCalling ? 'opacity-50 scale-95' : 'hover:scale-105'
              }`}
            >
              <Mic size={24} />
              <span>{t('aicall_start') || 'Start Voice Chat'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
