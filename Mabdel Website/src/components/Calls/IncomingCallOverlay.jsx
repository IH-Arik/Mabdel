import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function IncomingCallOverlay({ callerName, callerNumber, isOpen, onAccept, onReject }) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm"
      >
        <div className="bg-[#0c101b]/90 backdrop-blur-xl border border-purple-500/30 rounded-3xl p-4 shadow-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="relative">
                 <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 font-bold text-lg relative z-10 border border-purple-500/20">
                     {callerName?.[0] || 'A'}
                 </div>
                 {/* Ringing animation */}
                 <div className="absolute inset-0 border-2 border-purple-500 rounded-full animate-ping opacity-50" />
                 <div className="absolute inset-[-4px] border border-purple-500/50 rounded-full animate-ping opacity-30" style={{ animationDelay: '0.2s' }} />
             </div>
             <div>
                 <h4 className="text-white font-bold text-sm">{callerName || t('call_unknown_caller')}</h4>
                 <p className="text-purple-400 text-xs font-semibold mt-0.5 animate-pulse">{t('call_incoming_call')}</p>
                 {callerNumber ? <p className="text-[#A4B0B7] text-[11px] mt-1">{callerNumber}</p> : null}
             </div>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
                 onClick={onReject}
                 className="w-10 h-10 rounded-full bg-rose-500/20 hover:bg-rose-500/40 text-rose-500 flex items-center justify-center transition-colors cursor-pointer"
                 title={t('call_decline')}
             >
                 <PhoneOff size={18} />
             </button>
             <button 
                 onClick={onAccept}
                 className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-[#070a13] flex items-center justify-center shadow-lg shadow-emerald-500/20 transition-colors animate-bounce cursor-pointer"
                 title={t('call_accept')}
             >
                 <Phone size={18} className="fill-current" />
             </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
