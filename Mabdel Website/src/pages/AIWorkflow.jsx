import { useState } from 'react';
import { smartflowApi } from '../api/services';
import { Sparkles, Send, CheckCircle2, AlertCircle, Mic, Image as ImageIcon, Calendar, FileText, MessageSquare, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export default function AIWorkflow() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);

  const startVoiceRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (voiceActive) {
      if (recognitionInstance) {
        recognitionInstance.stop();
      }
      setVoiceActive(false);
      return;
    }

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onstart = () => {
        setVoiceActive(true);
        setPrompt('Listening...');
      };

      rec.onresult = (event) => {
        const text = event.results[0][0].transcript;
        setPrompt(text);
      };

      rec.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setVoiceActive(false);
      };

      rec.onend = () => {
        setVoiceActive(false);
        setPrompt(prev => prev === 'Listening...' ? '' : prev);
      };

      setRecognitionInstance(rec);
      rec.start();
    } catch (e) {
      console.error(e);
      setVoiceActive(false);
    }
  };

  const handleProcess = async (e, directPrompt = null) => {
    if (e) e.preventDefault();
    const textToProcess = directPrompt || prompt;
    if (!textToProcess.trim()) return;

    setLoading(true);
    setResult(null);
    setGeneratedImage(null);
    
    try {
      // Check if it's an image generation request
      if (textToProcess.toLowerCase().includes('generate image') || textToProcess.toLowerCase().includes('create image')) {
         const res = await smartflowApi.generateAIImage({ prompt: textToProcess });
         const data = res.data?.data || res.data;
         setGeneratedImage(data.image_url);
         setLoading(false);
         return;
      }

      const res = await smartflowApi.getAIWorkflowPrefill(textToProcess);
      const data = res.data?.data || res.data;
      
      // If no specific intent, navigate to normal AI chat
      if (!data.workflow || !data.workflow.intent || data.workflow.intent.toLowerCase() === 'none' || data.workflow.intent.toLowerCase() === 'unknown') {
         navigate('/voice-conversation', { state: { initialVoiceResult: textToProcess } });
         return;
      }

      setResult(data);
      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  const executeWorkflow = () => {
    if (!result || !result.workflow?.intent) return;
    
    const intent = result.workflow.intent.toLowerCase();
    const prefill = result.prefill || {};

    switch (intent) {
      case 'invoice':
      case 'create_invoice':
        navigate('/invoices', { state: { prefill } });
        break;
      case 'bulk_message':
      case 'message':
      case 'email':
        navigate('/bulk-messaging', { state: { prefill } });
        break;
      case 'meeting':
      case 'schedule_meeting':
      case 'calendar':
        navigate('/calendar', { state: { prefill } });
        break;
      case 'agreement':
      case 'lease':
      case 'document':
        navigate('/documents', { state: { prefill, type: intent } });
        break;
      case 'contact':
        navigate('/contacts', { state: { prefill } });
        break;
      case 'group':
        navigate('/groups', { state: { prefill } });
        break;
      case 'call':
        navigate('/calls', { state: { prefill } });
        break;
      default:
        navigate('/voice-conversation', { state: { initialVoiceResult: prompt } });
        break;
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div className="text-left space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#11C7E5]/10 border border-[#11C7E5]/25 text-[#11C7E5] font-bold text-xs uppercase tracking-wider">
            <Sparkles size={14} className="fill-current" />
            Mabdel Intelligence
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight leading-none uppercase">
            What can I help you <span className="text-[#11C7E5]">with today?</span>
          </h1>
          <p className="text-slate-400 text-sm font-semibold">Generate invoices, schedule meetings, create documents, or generate images by asking.</p>
        </div>
        <button 
          onClick={() => navigate('/profile?tab=voice-history')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-[#11C7E5] hover:border-[#11C7E5]/50 transition-all cursor-pointer shadow-lg"
        >
          <History size={16} />
          <span className="text-sm font-bold">History</span>
        </button>
      </div>

      <div className="bg-[#0c101b] border border-slate-900 p-2 rounded-3xl shadow-2xl">
        <form onSubmit={(e) => handleProcess(e)} className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., Generate an invoice for Sarah Jenkins for $500 for web design services..."
            className="w-full h-40 p-6 rounded-2xl bg-slate-950 border border-slate-900 focus:border-cyan-500/20 text-slate-300 placeholder-slate-600 focus:ring-0 text-lg outline-none resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleProcess(e);
              }
            }}
          />
          <div className="absolute bottom-4 right-4 flex items-center gap-3">
            <button
              type="button"
              onClick={startVoiceRecognition}
              title="Voice Input"
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                voiceActive 
                  ? 'bg-cyan-500 text-[#070a13] border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse'
                  : 'bg-slate-950 border-slate-900 text-cyan-400 hover:bg-slate-900 hover:text-cyan-300'
              }`}
            >
              <Mic size={18} />
            </button>
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider hidden sm:inline">Enter to submit</span>
            <button 
              disabled={loading}
              className="bg-[#11C7E5] text-[#070a13] px-6 py-3 rounded-xl font-extrabold flex items-center gap-2 hover:bg-cyan-400 transition-all disabled:opacity-50 shadow-lg shadow-cyan-400/10 active:scale-95 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#070a13] border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Send size={18} />
                  Run
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="flex flex-wrap gap-3">
        <button 
          onClick={() => { setPrompt("Create an invoice for "); }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 text-slate-300 hover:bg-[#11C7E5]/10 hover:border-[#11C7E5]/50 hover:text-[#11C7E5] transition-all text-sm font-semibold cursor-pointer"
        >
          <FileText size={16} /> Create Invoice
        </button>
        <button 
          onClick={() => { setPrompt("Send a bulk message to "); }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 text-slate-300 hover:bg-[#11C7E5]/10 hover:border-[#11C7E5]/50 hover:text-[#11C7E5] transition-all text-sm font-semibold cursor-pointer"
        >
          <MessageSquare size={16} /> Bulk Message
        </button>
        <button 
          onClick={() => { setPrompt("Schedule a meeting for "); }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 text-slate-300 hover:bg-[#11C7E5]/10 hover:border-[#11C7E5]/50 hover:text-[#11C7E5] transition-all text-sm font-semibold cursor-pointer"
        >
          <Calendar size={16} /> Schedule Meeting
        </button>
        <button 
          onClick={() => { setPrompt("Draft a new agreement for "); }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 text-slate-300 hover:bg-[#11C7E5]/10 hover:border-[#11C7E5]/50 hover:text-[#11C7E5] transition-all text-sm font-semibold cursor-pointer"
        >
          <FileText size={16} /> New Agreement
        </button>
        <button 
          onClick={() => { setPrompt("Generate an image of "); }}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 text-slate-300 hover:bg-[#11C7E5]/10 hover:border-[#11C7E5]/50 hover:text-[#11C7E5] transition-all text-sm font-semibold cursor-pointer"
        >
          <ImageIcon size={16} /> Generate Image
        </button>
      </div>

      {generatedImage && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#0c101b]/95 border border-[#11C7E5]/35 p-6 rounded-3xl"
        >
           <h3 className="text-xl font-extrabold text-white mb-4">Generated Image</h3>
           <img src={generatedImage} alt="AI Generated" className="w-full max-w-2xl mx-auto rounded-2xl shadow-lg border border-slate-800" />
        </motion.div>
      )}

      {result && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0c101b]/95 border border-cyan-500/35 p-8 rounded-3xl text-left"
        >
          <div className="flex items-start gap-4">
            <div className="p-3 bg-cyan-950/80 border border-cyan-500/20 text-[#11C7E5] rounded-2xl shadow-lg shadow-cyan-500/5">
              <CheckCircle2 size={24} />
            </div>
            <div className="flex-1 space-y-6">
              <div>
                <h3 className="text-xl font-extrabold text-white">AI Successfully Prepared Workflow</h3>
                <p className="text-slate-400 text-sm mt-1">Intent detected: <span className="font-bold uppercase text-[#11C7E5]">{result.workflow?.intent}</span></p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(result.prefill || {}).map(([key, value]) => (
                  <div key={key} className="bg-slate-950/60 p-4 rounded-xl border border-slate-900">
                    <p className="text-[10px] text-[#11C7E5] font-bold uppercase tracking-wider">{key.replace(/_/g, ' ')}</p>
                    <p className="text-white font-medium mt-1 truncate">{typeof value === 'object' ? JSON.stringify(value) : value}</p>
                  </div>
                ))}
              </div>

              {result.missing_fields?.length > 0 && (
                <div className="p-4 bg-yellow-950/20 border border-yellow-500/20 rounded-xl flex items-center gap-3 text-yellow-500">
                  <AlertCircle size={20} />
                  <p className="text-sm font-medium">Missing fields: {result.missing_fields.join(', ')}</p>
                </div>
              )}

              <button 
                onClick={executeWorkflow}
                className="w-full py-4 bg-[#11C7E5] hover:bg-cyan-400 text-[#070a13] rounded-xl font-extrabold transition-all shadow-lg shadow-cyan-400/10 active:scale-98 cursor-pointer"
              >
                Confirm and Execute {result.workflow?.intent}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
