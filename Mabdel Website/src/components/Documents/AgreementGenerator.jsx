import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Check, ChevronRight, X, User, Scale, Handshake, Loader2 } from 'lucide-react';
import SignaturePad from './SignaturePad';

const steps = [
  { id: 'parties', title: 'Parties', icon: User },
  { id: 'terms', title: 'Terms', icon: Scale },
  { id: 'review', title: 'Review & Sign', icon: Handshake }
];

export default function AgreementGenerator({ onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    partyOneName: '',
    partyTwoName: '',
    agreementDescription: '',
    governingLaw: 'State of Delaware',
  });
  const [signature, setSignature] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleGenerate();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleGenerate = () => {
      setIsGenerating(true);
      setTimeout(() => {
          setIsGenerating(false);
          setIsGenerated(true);
      }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#070a13]/80 backdrop-blur-xl p-4 sm:p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-3xl bg-[#0c101b] border border-[#243041] rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#243041]/60 flex items-center justify-between bg-slate-950/40">
           <div>
               <h2 className="text-xl font-bold text-white flex items-center gap-2">
                   <FileText className="text-blue-400" /> Agreement Generator
               </h2>
               <p className="text-slate-400 text-xs mt-1">Draft a custom legal agreement between two parties.</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-full text-slate-500 hover:text-white transition-colors">
               <X size={20} />
           </button>
        </div>

        {/* Stepper */}
        {!isGenerated && (
            <div className="px-12 py-4 bg-[#131A24] border-b border-[#243041]/40 flex justify-between relative">
                <div className="absolute top-1/2 left-12 right-12 h-[2px] bg-slate-800 -translate-y-1/2 z-0" />
                {steps.map((step, idx) => {
                    const Icon = step.icon;
                    const isActive = currentStep === idx;
                    const isCompleted = currentStep > idx;
                    return (
                        <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${isActive ? 'bg-[#0c101b] border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : isCompleted ? 'bg-blue-500 border-blue-500 text-[#0c101b]' : 'bg-[#0c101b] border-slate-700 text-slate-500'}`}>
                                {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${isActive ? 'text-blue-400' : isCompleted ? 'text-slate-300' : 'text-slate-600'}`}>
                                {step.title}
                            </span>
                        </div>
                    )
                })}
            </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 relative">
            <AnimatePresence mode="wait">
                {isGenerated ? (
                    <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 mb-6">
                            <Check size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">Agreement Drafted!</h3>
                        <p className="text-slate-400 text-sm max-w-md mb-8">The agreement has been successfully drafted and is ready for signatures from all parties involved.</p>
                        <div className="flex gap-4">
                            <button className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors">Download PDF</button>
                            <button onClick={onClose} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-105">Finish</button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                        
                        {currentStep === 0 && (
                            <div className="space-y-4 max-w-md mx-auto">
                                <h3 className="text-lg font-bold text-white mb-6 text-center">Parties</h3>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Party One (You)</label>
                                    <input 
                                        type="text" 
                                        value={formData.partyOneName}
                                        onChange={e => setFormData({...formData, partyOneName: e.target.value})}
                                        placeholder="Full Legal Name or Entity" 
                                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-blue-500/50 focus:outline-none text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Party Two</label>
                                    <input 
                                        type="text" 
                                        value={formData.partyTwoName}
                                        onChange={e => setFormData({...formData, partyTwoName: e.target.value})}
                                        placeholder="Full Legal Name or Entity" 
                                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-blue-500/50 focus:outline-none text-white text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="space-y-4 max-w-md mx-auto">
                                <h3 className="text-lg font-bold text-white mb-6 text-center">Terms & Conditions</h3>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description of Agreement</label>
                                    <textarea 
                                        value={formData.agreementDescription}
                                        onChange={e => setFormData({...formData, agreementDescription: e.target.value})}
                                        placeholder="Describe the nature of the agreement, deliverables, and obligations..."
                                        rows={4}
                                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-blue-500/50 focus:outline-none text-white text-sm resize-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Governing Law</label>
                                    <input 
                                        type="text" 
                                        value={formData.governingLaw}
                                        onChange={e => setFormData({...formData, governingLaw: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-blue-500/50 focus:outline-none text-white text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-6 max-w-lg mx-auto">
                                <h3 className="text-lg font-bold text-white mb-6 text-center">Review & Sign</h3>
                                
                                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-slate-500">Party 1:</span><span className="text-white font-medium">{formData.partyOneName || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Party 2:</span><span className="text-white font-medium">{formData.partyTwoName || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Jurisdiction:</span><span className="text-white font-medium">{formData.governingLaw}</span></div>
                                    <div className="mt-2 pt-2 border-t border-slate-800"><span className="text-slate-500 block mb-1">Summary:</span><span className="text-white font-medium italic text-xs">{formData.agreementDescription || 'No description provided.'}</span></div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your Signature (Party One)</label>
                                    <SignaturePad onSave={setSignature} />
                                    {signature && <p className="text-emerald-400 text-xs mt-2 flex items-center gap-1"><Check size={12} /> Signature captured</p>}
                                </div>
                            </div>
                        )}

                    </motion.div>
                )}
            </AnimatePresence>
        </div>

        {/* Footer */}
        {!isGenerated && (
            <div className="p-6 border-t border-[#243041]/60 flex justify-between bg-slate-950/40">
                <button 
                    onClick={handleBack}
                    disabled={currentStep === 0 || isGenerating}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
                >
                    Back
                </button>
                <button 
                    onClick={handleNext}
                    disabled={isGenerating}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                    {isGenerating ? (
                         <><Loader2 size={16} className="animate-spin" /> Generating...</>
                    ) : currentStep === steps.length - 1 ? (
                         'Draft Agreement'
                    ) : (
                         <>Next <ChevronRight size={16} /></>
                    )}
                </button>
            </div>
        )}
      </motion.div>
    </div>
  );
}
