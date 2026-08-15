import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ArrowLeft, Home, Briefcase, TrendingUp, Check, Building2, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const steps = [
  { id: 'role', title: 'Your Role' },
  { id: 'goals', title: 'Main Goals' },
  { id: 'setup', title: 'Profile Setup' },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [formData, setFormData] = useState({
    role: '',
    goals: [],
    company: '',
    experience: '1-3 years'
  });

  const roles = [
    { id: 'investor', labelKey: 'onboard_role_investor', descKey: 'onboard_role_investor_desc', icon: TrendingUp },
    { id: 'realtor', labelKey: 'onboard_role_realtor', descKey: 'onboard_role_realtor_desc', icon: Briefcase },
    { id: 'landlord', labelKey: 'onboard_role_landlord', descKey: 'onboard_role_landlord_desc', icon: Building2 },
    { id: 'buyer', labelKey: 'onboard_role_buyer', descKey: 'onboard_role_buyer_desc', icon: Home }
  ];

  const goalsList = [
    t('onboard_goal_expand'),
    t('onboard_goal_leads'),
    t('onboard_goal_automate'),
    t('onboard_goal_network'),
    t('onboard_goal_deals'),
    t('onboard_goal_maintenance')
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      setIsFinishing(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const toggleGoal = (goal) => {
    if (formData.goals.includes(goal)) {
      setFormData({ ...formData, goals: formData.goals.filter(g => g !== goal) });
    } else {
      setFormData({ ...formData, goals: [...formData.goals, goal] });
    }
  };

  return (
    <div className="min-h-screen bg-[#070a13] flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none translate-x-1/3 translate-y-1/3" />
      
      {/* Header */}
      <div className="absolute top-8 left-8 text-white font-black text-2xl tracking-tighter">
        GOCUSTIFY<span className="text-purple-400">.</span>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl bg-[#0c101b]/80 backdrop-blur-2xl border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl relative z-10"
      >
        {/* Stepper */}
        <div className="flex items-center justify-between mb-12 relative">
           <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-800 -translate-y-1/2 z-0 rounded-full overflow-hidden">
              <motion.div 
                 className="h-full bg-purple-500"
                 initial={{ width: '0%' }}
                 animate={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                 transition={{ duration: 0.3 }}
              />
           </div>
           {steps.map((step, idx) => {
             const isActive = currentStep === idx;
             const isCompleted = currentStep > idx;
             return (
               <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-bold text-sm transition-colors ${isActive ? 'bg-[#0c101b] border-purple-500 text-purple-400' : isCompleted ? 'bg-purple-500 border-purple-500 text-[#070a13]' : 'bg-[#0c101b] border-slate-800 text-slate-500'}`}>
                    {isCompleted ? <Check size={18} /> : idx + 1}
                 </div>
                 <span className={`absolute -bottom-6 text-xs font-bold whitespace-nowrap ${isActive ? 'text-purple-400' : isCompleted ? 'text-slate-300' : 'text-slate-600'}`}>{step.title}</span>
               </div>
             )
           })}
        </div>

        {/* Content */}
        <div className="min-h-[350px]">
           <AnimatePresence mode="wait">
               <motion.div
                 key={currentStep}
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -20 }}
                 transition={{ duration: 0.2 }}
               >
                 {/* Step 1: Role */}
                 {currentStep === 0 && (
                   <div className="space-y-6">
                     <div className="text-center mb-8">
                       <h2 className="text-3xl font-extrabold text-white mb-2">{t('onboard_step1_title')}</h2>
                       <p className="text-slate-400">{t('onboard_step1_sub')}</p>
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {roles.map(role => {
                          const Icon = role.icon;
                          const isSelected = formData.role === role.id;
                          return (
                            <button
                               key={role.id}
                               onClick={() => setFormData({ ...formData, role: role.id })}
                               className={`p-5 rounded-2xl border text-left flex items-start gap-4 transition-all ${isSelected ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'bg-slate-900/50 border-slate-800 hover:border-slate-600 hover:bg-slate-900'}`}
                            >
                               <div className={`p-3 rounded-xl ${isSelected ? 'bg-purple-500 text-[#070a13]' : 'bg-slate-800 text-slate-400'}`}>
                                 <Icon size={24} />
                               </div>
                               <div>
                                 <h3 className={`font-bold text-lg mb-1 ${isSelected ? 'text-purple-400' : 'text-white'}`}>{t(role.labelKey)}</h3>
                                 <p className="text-slate-500 text-sm">{t(role.descKey)}</p>
                               </div>
                            </button>
                          )
                        })}
                     </div>
                   </div>
                 )}

                 {/* Step 2: Goals */}
                 {currentStep === 1 && (
                   <div className="space-y-6">
                     <div className="text-center mb-8">
                       <h2 className="text-3xl font-extrabold text-white mb-2">{t('onboard_step2_title')}</h2>
                       <p className="text-slate-400">{t('onboard_step2_sub')}</p>
                     </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {goalsList.map(goal => {
                          const isSelected = formData.goals.includes(goal);
                          return (
                            <button
                               key={goal}
                               onClick={() => toggleGoal(goal)}
                               className={`px-4 py-4 rounded-xl border text-left font-semibold text-sm transition-all flex items-center justify-between ${isSelected ? 'bg-purple-500/10 border-purple-500 text-purple-400' : 'bg-slate-900/50 border-slate-800 text-slate-300 hover:border-slate-600'}`}
                            >
                               {goal}
                               {isSelected && <Check size={16} />}
                            </button>
                          )
                        })}
                     </div>
                   </div>
                 )}

                 {/* Step 3: Setup */}
                 {currentStep === 2 && (
                   <div className="space-y-6">
                     <div className="text-center mb-8">
                       <h2 className="text-3xl font-extrabold text-white mb-2">{t('onboard_step3_title')}</h2>
                       <p className="text-slate-400">{t('onboard_step3_sub')}</p>
                     </div>
                     <div className="space-y-5 max-w-md mx-auto">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('onboard_lbl_company')}</label>
                          <div className="relative">
                            <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input 
                              type="text" 
                              value={formData.company}
                              onChange={e => setFormData({ ...formData, company: e.target.value })}
                              placeholder={t('onboard_ph_company')}
                              className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-purple-500/50 focus:outline-none text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{t('onboard_lbl_experience')}</label>
                          <div className="relative">
                            <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                            <select 
                              value={formData.experience}
                              onChange={e => setFormData({ ...formData, experience: e.target.value })}
                              className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-purple-500/50 focus:outline-none text-white appearance-none"
                            >
                              <option value="Less than 1 year">{t('onboard_exp_lt1')}</option>
                              <option value="1-3 years">{t('onboard_exp_1_3')}</option>
                              <option value="3-5 years">{t('onboard_exp_3_5')}</option>
                              <option value="5-10 years">{t('onboard_exp_5_10')}</option>
                              <option value="10+ years">{t('onboard_exp_10plus')}</option>
                            </select>
                          </div>
                        </div>
                     </div>
                   </div>
                 )}
               </motion.div>
           </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="mt-12 flex items-center justify-between pt-6 border-t border-slate-800">
           <button
             onClick={handleBack}
             className={`px-6 py-3 font-semibold rounded-xl flex items-center gap-2 transition-colors ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
           >
             <ArrowLeft size={18} /> {t('onboard_btn_back')}
           </button>
           <button
             onClick={handleNext}
             disabled={
                (currentStep === 0 && !formData.role) || 
                (currentStep === 1 && formData.goals.length === 0) ||
                isFinishing
             }
             className="px-8 py-3 bg-purple-500 hover:bg-purple-400 text-[#070a13] font-bold rounded-xl flex items-center gap-2 transition-all hover:scale-105 shadow-lg shadow-purple-500/20 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
           >
             {isFinishing ? (
                 <><Loader2 size={18} className="animate-spin" /> {t('onboard_finishing')}</>
             ) : currentStep === steps.length - 1 ? (
                 t('onboard_btn_dashboard')
             ) : (
                 <>{t('onboard_btn_continue')} <ChevronRight size={18} /></>
             )}
           </button>
        </div>
      </motion.div>
    </div>
  );
}
