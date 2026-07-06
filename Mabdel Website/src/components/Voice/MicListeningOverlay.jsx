import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, X, Loader2 } from 'lucide-react';

export default function MicListeningOverlay({ isOpen, onClose, onFinish }) {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let recognition;
    if (isOpen) {
      if ('webkitSpeechRecognition' in window) {
        recognition = new window.webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => setIsListening(true);
        
        recognition.onresult = (event) => {
          let currentTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            currentTranscript += event.results[i][0].transcript;
          }
          setTranscript(currentTranscript);
        };

        recognition.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
          // If we have a transcript, process it, otherwise just close or wait
          if (transcript) {
              handleFinish(transcript);
          }
        };

        recognition.start();
      } else {
        alert('Web Speech API is not supported in this browser.');
        onClose();
      }
    }

    return () => {
      if (recognition) {
        recognition.stop();
      }
    };
  }, [isOpen]);

  const handleFinish = (finalText) => {
      setIsProcessing(true);
      // Simulate processing time
      setTimeout(() => {
          setIsProcessing(false);
          onFinish(finalText);
          onClose();
          setTranscript('');
      }, 1500);
  }

  const handleManualStop = () => {
      setIsListening(false);
      handleFinish(transcript);
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col items-center justify-end sm:justify-center bg-[#070a13]/80 backdrop-blur-xl p-6"
      >
        <button 
            onClick={onClose}
            className="absolute top-6 right-6 p-2 bg-slate-900/50 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
        >
            <X size={24} />
        </button>

        <motion.div 
            initial={{ y: 50, scale: 0.9 }}
            animate={{ y: 0, scale: 1 }}
            className="w-full max-w-md bg-[#0c101b] border border-cyan-500/20 rounded-3xl p-8 flex flex-col items-center relative overflow-hidden shadow-2xl shadow-cyan-500/10"
        >
            
            {/* Pulsing background effect */}
            {isListening && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <motion.div 
                        animate={{ scale: [1, 1.5, 2], opacity: [0.5, 0.2, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                        className="w-32 h-32 bg-cyan-500/20 rounded-full blur-xl"
                    />
                </div>
            )}

            <div className="mb-8 relative">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center ${isListening ? 'bg-cyan-500' : 'bg-slate-800'} shadow-lg transition-colors duration-500 z-10 relative`}>
                    {isProcessing ? (
                         <Loader2 size={40} className="text-[#070a13] animate-spin" />
                    ) : (
                        <Mic size={40} className={isListening ? 'text-[#070a13]' : 'text-slate-400'} />
                    )}
                </div>
            </div>

            <div className="text-center space-y-4 w-full z-10">
                <h3 className="text-xl font-bold text-white">
                    {isProcessing ? 'Processing...' : isListening ? 'Listening...' : 'Tap mic to speak'}
                </h3>
                
                <div className="min-h-[80px] w-full bg-slate-950/50 border border-slate-900 rounded-2xl p-4 flex items-center justify-center">
                    <p className={`text-center font-medium ${transcript ? 'text-cyan-400 text-lg' : 'text-slate-500 text-sm'}`}>
                        {transcript || (isListening ? 'Go ahead, I am listening...' : 'Say something like "Schedule a meeting"')}
                    </p>
                </div>
            </div>

            {isListening && (
                <button 
                    onClick={handleManualStop}
                    className="mt-8 px-8 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-full text-white font-bold transition-all z-10"
                >
                    Done
                </button>
            )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
