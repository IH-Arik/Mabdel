import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Phone, Settings, Activity } from 'lucide-react';
import { smartflowApi } from '../api/services';

export default function VoiceConversation() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [listening, setListening] = useState(false);
  
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript]);

  const handleStartCall = () => {
    setIsCallActive(true);
    setTranscript([{ speaker: 'ai', text: 'Hello, I am ready to listen. How can I assist you today?' }]);
    // In a real app, this would establish a WebRTC connection or a WebSocket.
  };

  const handleEndCall = () => {
    setIsCallActive(false);
    setListening(false);
  };

  const toggleMute = () => {
      setIsMuted(!isMuted);
  };

  const handleSimulateUserSpeech = () => {
      if(!isCallActive) return;
      setListening(true);
      setTimeout(() => {
          setTranscript(prev => [...prev, { speaker: 'user', text: 'What is the status of my recent invoice?' }]);
          setListening(false);
          
          // Simulate AI response
          setTimeout(() => {
              setTranscript(prev => [...prev, { speaker: 'ai', text: 'Your recent invoice #INV-1004 is currently marked as pending. It was sent 2 days ago.' }]);
          }, 1500);
      }, 2000);
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] bg-[#0c101b] border border-[#243041]/60 rounded-3xl overflow-hidden shadow-xl">
      
      {/* Sidebar/Context area */}
      <div className="w-80 border-r border-[#243041]/40 bg-slate-950/20 p-6 flex flex-col hidden lg:flex">
         <h2 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
             <Activity className="text-cyan-400" /> AI Voice Session
         </h2>
         <p className="text-slate-400 text-xs mb-8">
             This is a continuous voice conversation with your Mabdel AI assistant. 
             You can ask questions, manage invoices, or get summaries using just your voice.
         </p>
         
         <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suggested Prompts</h3>
            <div className="space-y-2">
                {["Read my latest messages", "Create a new invoice", "What's on my schedule?"].map(prompt => (
                    <button key={prompt} className="w-full text-left px-4 py-3 bg-[#11C7E5]/5 border border-[#11C7E5]/10 rounded-xl text-xs text-cyan-300 font-semibold hover:bg-[#11C7E5]/10 transition-colors">
                        "{prompt}"
                    </button>
                ))}
            </div>
         </div>
      </div>

      {/* Main Conversation Area */}
      <div className="flex-1 flex flex-col relative">
          
          {!isCallActive ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="w-32 h-32 rounded-full bg-cyan-500/10 flex items-center justify-center mb-8 border border-cyan-500/20">
                      <Mic size={48} className="text-cyan-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Start Voice Conversation</h2>
                  <p className="text-slate-400 text-sm mb-8 text-center max-w-sm">
                      Connect with Mabdel AI for a hands-free, continuous interactive session.
                  </p>
                  <button 
                      onClick={handleStartCall}
                      className="px-8 py-4 bg-cyan-500 hover:bg-cyan-400 text-[#070a13] font-bold rounded-full transition-all shadow-lg shadow-cyan-500/20 text-lg flex items-center gap-2"
                  >
                      <Phone size={20} /> Connect
                  </button>
              </div>
          ) : (
              <>
                 <div className="p-4 border-b border-[#243041]/40 flex items-center justify-between bg-slate-950/40">
                     <div className="flex items-center gap-3">
                         <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                         <span className="text-cyan-400 font-bold text-sm">Active Session</span>
                     </div>
                     <span className="text-slate-500 font-mono text-xs">00:00:00</span>
                 </div>

                 {/* Transcript Area */}
                 <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-900/10">
                    {transcript.map((msg, i) => (
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={i} 
                            className={`flex ${msg.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[70%] p-4 rounded-3xl ${
                                msg.speaker === 'user' 
                                ? 'bg-cyan-500/20 border border-cyan-500/30 text-cyan-50 rounded-br-none' 
                                : 'bg-slate-800 border border-slate-700 text-white rounded-bl-none'
                            }`}>
                                <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                            </div>
                        </motion.div>
                    ))}
                    {listening && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-end">
                             <div className="px-4 py-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-3xl rounded-br-none text-sm font-medium flex items-center gap-2">
                                <Activity size={14} className="animate-pulse" /> Listening...
                             </div>
                        </motion.div>
                    )}
                    <div ref={bottomRef} />
                 </div>

                 {/* Controls */}
                 <div className="p-6 bg-slate-950/40 border-t border-[#243041]/40 flex items-center justify-center gap-6">
                     <button className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors" title="Settings">
                         <Settings size={24} />
                     </button>
                     
                     <button 
                         onClick={toggleMute}
                         className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
                             isMuted ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-slate-700 text-white hover:bg-slate-600'
                         }`}
                     >
                         {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
                     </button>

                     <button 
                         onClick={handleEndCall}
                         className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 transition-colors"
                         title="End Session"
                     >
                         <Phone size={28} className="rotate-[135deg]" />
                     </button>

                     <button onClick={handleSimulateUserSpeech} className="text-[10px] text-slate-600 absolute right-4 bottom-4">
                         Simulate Input
                     </button>
                 </div>
              </>
          )}

      </div>
    </div>
  );
}
