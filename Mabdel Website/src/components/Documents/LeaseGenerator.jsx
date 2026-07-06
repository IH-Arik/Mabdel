import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Check, ChevronRight, X, Building, Users, Calendar, DollarSign, Loader2 } from 'lucide-react';
import SignaturePad from './SignaturePad';

const steps = [
  { id: 'details', title: 'Property Details', icon: Building },
  { id: 'parties', title: 'Parties', icon: Users },
  { id: 'terms', title: 'Terms & Rent', icon: DollarSign },
  { id: 'review', title: 'Review & Sign', icon: FileText }
];

export default function LeaseGenerator({ onClose }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    propertyAddress: '',
    landlordName: '',
    tenantName: '',
    rentAmount: '',
    leaseStart: '',
    leaseEnd: '',
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
        className="w-full max-w-3xl bg-[#0c101b] border border-cyan-500/20 rounded-3xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl shadow-cyan-500/10"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#243041]/60 flex items-center justify-between bg-slate-950/40">
           <div>
               <h2 className="text-xl font-bold text-white flex items-center gap-2">
                   <FileText className="text-cyan-400" /> Lease Generator
               </h2>
               <p className="text-slate-400 text-xs mt-1">Create a standard residential lease agreement.</p>
           </div>
           <button onClick={onClose} className="p-2 hover:bg-slate-900 rounded-full text-slate-500 hover:text-white transition-colors">
               <X size={20} />
           </button>
        </div>

        {/* Stepper */}
        {!isGenerated && (
            <div className="px-8 py-4 bg-[#131A24] border-b border-[#243041]/40 flex justify-between relative">
                <div className="absolute top-1/2 left-8 right-8 h-[2px] bg-slate-800 -translate-y-1/2 z-0" />
                {steps.map((step, idx) => {
                    const Icon = step.icon;
                    const isActive = currentStep === idx;
                    const isCompleted = currentStep > idx;
                    return (
                        <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${isActive ? 'bg-[#0c101b] border-cyan-500 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.5)]' : isCompleted ? 'bg-cyan-500 border-cyan-500 text-[#0c101b]' : 'bg-[#0c101b] border-slate-700 text-slate-500'}`}>
                                {isCompleted ? <Check size={14} /> : <Icon size={14} />}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:block ${isActive ? 'text-cyan-400' : isCompleted ? 'text-slate-300' : 'text-slate-600'}`}>
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
                        <h3 className="text-2xl font-bold text-white mb-2">Lease Generated!</h3>
                        <p className="text-slate-400 text-sm max-w-md mb-8">The residential lease agreement has been generated successfully and is ready to be shared with the tenant.</p>
                        <div className="flex gap-4">
                            <button className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl transition-colors">Download PDF</button>
                            <button onClick={onClose} className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#070a13] font-bold rounded-xl shadow-lg shadow-cyan-500/20 transition-all hover:scale-105">Finish</button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
                        
                        {currentStep === 0 && (
                            <div className="space-y-4 max-w-md mx-auto">
                                <h3 className="text-lg font-bold text-white mb-6 text-center">Property Details</h3>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Property Address</label>
                                    <input 
                                        type="text" 
                                        value={formData.propertyAddress}
                                        onChange={e => setFormData({...formData, propertyAddress: e.target.value})}
                                        placeholder="e.g. 123 Main St, Apt 4B" 
                                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-cyan-500/50 focus:outline-none text-white text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {currentStep === 1 && (
                            <div className="space-y-4 max-w-md mx-auto">
                                <h3 className="text-lg font-bold text-white mb-6 text-center">Parties Involved</h3>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Landlord Name</label>
                                    <input 
                                        type="text" 
                                        value={formData.landlordName}
                                        onChange={e => setFormData({...formData, landlordName: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-cyan-500/50 focus:outline-none text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 mt-4">Tenant Name</label>
                                    <input 
                                        type="text" 
                                        value={formData.tenantName}
                                        onChange={e => setFormData({...formData, tenantName: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-cyan-500/50 focus:outline-none text-white text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {currentStep === 2 && (
                            <div className="space-y-4 max-w-md mx-auto">
                                <h3 className="text-lg font-bold text-white mb-6 text-center">Terms & Rent</h3>
                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Monthly Rent ($)</label>
                                    <input 
                                        type="number" 
                                        value={formData.rentAmount}
                                        onChange={e => setFormData({...formData, rentAmount: e.target.value})}
                                        className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-cyan-500/50 focus:outline-none text-white text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Start Date</label>
                                        <input 
                                            type="date" 
                                            value={formData.leaseStart}
                                            onChange={e => setFormData({...formData, leaseStart: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-cyan-500/50 focus:outline-none text-white text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">End Date</label>
                                        <input 
                                            type="date" 
                                            value={formData.leaseEnd}
                                            onChange={e => setFormData({...formData, leaseEnd: e.target.value})}
                                            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-cyan-500/50 focus:outline-none text-white text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {currentStep === 3 && (
                            <div className="space-y-6 max-w-lg mx-auto">
                                <h3 className="text-lg font-bold text-white mb-6 text-center">Review & Sign</h3>
                                
                                <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-2xl space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-slate-500">Property:</span><span className="text-white font-medium">{formData.propertyAddress || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Landlord:</span><span className="text-white font-medium">{formData.landlordName || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Tenant:</span><span className="text-white font-medium">{formData.tenantName || 'N/A'}</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Rent:</span><span className="text-white font-medium">${formData.rentAmount || '0'}/mo</span></div>
                                    <div className="flex justify-between"><span className="text-slate-500">Duration:</span><span className="text-white font-medium">{formData.leaseStart} to {formData.leaseEnd}</span></div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Your Signature</label>
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
                    className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-[#070a13] font-bold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                    {isGenerating ? (
                         <><Loader2 size={16} className="animate-spin" /> Generating...</>
                    ) : currentStep === steps.length - 1 ? (
                         'Generate Lease'
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
