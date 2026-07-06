import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mic, MicOff, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';

export default function ActiveCallOverlay({ callerName, isOpen, onEndCall, isExpanded: initialExpanded = false }) {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  useEffect(() => {
    let interval;
    if (isOpen) {
      interval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [isOpen]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className={`fixed z-[90] bg-[#0c101b]/90 backdrop-blur-2xl border border-[#243041] rounded-t-3xl shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.5)] flex flex-col transition-all duration-300 ${
            isExpanded ? 'bottom-0 left-0 right-0 h-full sm:h-[80vh] sm:rounded-3xl sm:m-8 p-8' : 'bottom-0 left-1/2 -translate-x-1/2 w-full sm:w-[400px] p-4 sm:bottom-6 sm:rounded-3xl'
        }`}
      >
          {/* Header Controls */}
          <div className="flex justify-between items-start mb-4">
              <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 bg-slate-900/50 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                  {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              
              <div className={`px-3 py-1 rounded-full text-xs font-mono font-bold border ${duration > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                  {formatDuration(duration)}
              </div>
          </div>

          {/* Caller Info */}
          <div className={`flex flex-col items-center justify-center flex-1 transition-all ${isExpanded ? 'mb-12' : 'mb-6'}`}>
              <div className="relative">
                  <div className={`rounded-full bg-[#11C7E5]/10 flex items-center justify-center text-[#11C7E5] font-black border border-[#11C7E5]/20 relative z-10 transition-all ${isExpanded ? 'w-32 h-32 text-4xl' : 'w-20 h-20 text-2xl'}`}>
                      {callerName?.[0] || 'C'}
                  </div>
                  {/* Active audio rings */}
                  {!isMuted && (
                      <>
                        <div className="absolute inset-0 border border-[#11C7E5]/30 rounded-full animate-ping opacity-50" />
                        <div className="absolute inset-[-10px] border border-[#11C7E5]/10 rounded-full animate-ping opacity-30" style={{ animationDelay: '0.5s' }} />
                      </>
                  )}
              </div>
              
              <h3 className={`font-extrabold text-white mt-4 transition-all ${isExpanded ? 'text-2xl' : 'text-lg'}`}>
                  {callerName || 'Unknown Caller'}
              </h3>
              <p className="text-[#A4B0B7] text-sm font-semibold mt-1">Mabdel Voice Call</p>
          </div>

          {/* Call Controls */}
          <div className="flex items-center justify-center gap-6 mt-auto">
              <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-white text-[#070a13]' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
              >
                  {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              <button 
                  onClick={onEndCall}
                  className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 transition-all hover:scale-105"
              >
                  <PhoneOff size={28} />
              </button>

              <button 
                  onClick={() => setIsSpeaker(!isSpeaker)}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isSpeaker ? 'bg-white text-[#070a13]' : 'bg-slate-800 text-white hover:bg-slate-700'}`}
              >
                  {isSpeaker ? <Volume2 size={24} /> : <VolumeX size={24} />}
              </button>
          </div>
          
      </motion.div>
    </AnimatePresence>
  );
}
