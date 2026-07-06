import { useState, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Settings, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AiCall() {
  const [isCalling, setIsCalling] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

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

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartCall = () => {
    setIsCalling(true);
    // Simulate connection delay
    setTimeout(() => {
        setIsCalling(false);
        setIsConnected(true);
    }, 2000);
  };

  const handleEndCall = () => {
    setIsCalling(false);
    setIsConnected(false);
  };

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-[#0c101b] border border-[#243041]/60 rounded-3xl overflow-hidden shadow-xl">
       <div className="flex-1 flex flex-col items-center justify-center relative p-6">
           
           {/* Visualizer Background */}
           <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
               {isConnected && (
                  <>
                     <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }} transition={{ duration: 3, repeat: Infinity }} className="absolute w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[100px]" />
                     <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} className="absolute w-[300px] h-[300px] bg-blue-500/20 rounded-full blur-[80px]" />
                  </>
               )}
           </div>

           <div className="z-10 flex flex-col items-center">
               <div className="relative mb-8">
                   <div className="w-32 h-32 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl relative z-10">
                       <Activity size={48} className={isConnected ? "text-cyan-400 animate-pulse" : "text-slate-600"} />
                   </div>
                   
                   {isCalling && (
                       <div className="absolute inset-[-10px] border-2 border-cyan-500/30 rounded-full animate-ping" />
                   )}
                   {isConnected && (
                       <>
                         <div className="absolute inset-[-15px] border border-cyan-500/40 rounded-full animate-ping" style={{ animationDuration: '2s' }} />
                         <div className="absolute inset-[-30px] border border-cyan-500/20 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                       </>
                   )}
               </div>

               <h2 className="text-3xl font-black text-white mb-2">Mabdel AI</h2>
               
               <div className="h-6 flex items-center justify-center">
                   {isCalling ? (
                       <span className="text-cyan-400 font-bold animate-pulse">Connecting...</span>
                   ) : isConnected ? (
                       <span className="text-emerald-400 font-mono font-bold text-lg">{formatDuration(duration)}</span>
                   ) : (
                       <span className="text-slate-500 font-medium">Ready for your call</span>
                   )}
               </div>
           </div>

           <div className="absolute bottom-12 left-0 right-0 flex justify-center items-center gap-8 z-10">
               {isConnected ? (
                   <>
                       <button onClick={() => setIsMuted(!isMuted)} className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors ${isMuted ? 'bg-white text-[#070a13]' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                           {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                       </button>
                       <button onClick={handleEndCall} className="w-20 h-20 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 transition-transform hover:scale-105">
                           <PhoneOff size={32} />
                       </button>
                       <button className="w-16 h-16 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors">
                           <Settings size={24} />
                       </button>
                   </>
               ) : (
                   <button onClick={handleStartCall} disabled={isCalling} className={`w-20 h-20 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#070a13] flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-all ${isCalling ? 'opacity-50 scale-95' : 'hover:scale-105'}`}>
                       <Phone size={32} className="fill-current" />
                   </button>
               )}
           </div>
       </div>
    </div>
  );
}
