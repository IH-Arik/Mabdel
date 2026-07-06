import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, ArrowRight, Sparkles, Building2, User, Mail } from 'lucide-react';

export default function Subscription() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    organizationName: ''
  });

  const handleOpenModal = (plan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
    setIsSubmitted(false);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedPlan(null);
      setIsSubmitted(false);
      setFormData({ fullName: '', email: '', organizationName: '' });
    }, 300);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch("http://localhost:8000/api/v1/auth/subscription-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.fullName,
          original_email: formData.email,
          organization_name: formData.organizationName,
          plan: selectedPlan
        }),
      });
      
      if (!response.ok) {
        throw new Error("Signup failed");
      }
      setIsSubmitted(true);
    } catch (error) {
      console.error(error);
      alert("Failed to request access. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen bg-[#070a13] text-white flex flex-col items-center py-20 px-6 font-sans selection:bg-cyan-500/30">
      {/* Background glow effects */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/20 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-teal-900/10 blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl mb-16 relative z-10"
      >
        <button 
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white transition-colors mb-8 flex items-center gap-2 mx-auto text-sm font-medium"
        >
          &larr; Back to Home
        </button>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
          Choose Your <span className="bg-gradient-to-r from-cyan-400 to-teal-300 bg-clip-text text-transparent">Journey</span>
        </h1>
        <p className="text-lg text-gray-400">Select a plan to elevate your business with AI intelligence.</p>
      </motion.div>

      <div className="flex flex-col md:flex-row gap-8 w-full max-w-5xl relative z-10 justify-center">
        
        {/* Subscribe Card */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 bg-gray-900/40 backdrop-blur-md border border-gray-800 rounded-3xl p-8 flex flex-col hover:border-cyan-500/30 transition-all group"
        >
          <div className="mb-6">
            <h3 className="text-2xl font-bold mb-2">Pro Access</h3>
            <p className="text-gray-400 text-sm">Full power of SmartFlow AI for growing businesses.</p>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-extrabold">$49</span>
            <span className="text-gray-400">/month</span>
          </div>
          <ul className="space-y-4 mb-10 flex-1">
            {['Unlimited AI workflows', 'Custom integrations', 'Priority 24/7 support', 'Advanced analytics'].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-gray-300">
                <CheckCircle className="text-cyan-400 shrink-0 mt-0.5" size={18} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <button 
            onClick={() => handleOpenModal('subscribe')}
            className="w-full py-4 rounded-xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] hover:shadow-lg hover:shadow-cyan-500/20 active:scale-[0.98] transition-all"
          >
            Subscribe Now
          </button>
        </motion.div>

        {/* Free Trial Card */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex-1 bg-gradient-to-b from-gray-800/80 to-gray-900/40 backdrop-blur-md border border-cyan-500/30 rounded-3xl p-8 flex flex-col relative overflow-hidden"
        >
          {/* Highlight Badge */}
          <div className="absolute top-0 right-0 bg-cyan-500 text-[#070a13] text-xs font-bold px-4 py-1.5 rounded-bl-xl tracking-wider uppercase">
            Most Popular
          </div>
          
          <div className="mb-6 mt-2">
            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
              <Sparkles className="text-cyan-400" size={24} /> 7-Day Free Trial
            </h3>
            <p className="text-gray-400 text-sm">Experience the magic before you commit.</p>
          </div>
          <div className="mb-8">
            <span className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">$0</span>
            <span className="text-gray-400"> for 7 days</span>
          </div>
          <ul className="space-y-4 mb-10 flex-1">
            {['Full access to all Pro features', 'No credit card required*', 'Cancel anytime', 'Guided onboarding'].map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-gray-300">
                <CheckCircle className="text-teal-400 shrink-0 mt-0.5" size={18} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <button 
            onClick={() => handleOpenModal('trial')}
            className="w-full py-4 rounded-xl font-bold bg-gray-800 text-white hover:bg-gray-700 border border-gray-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            Start Free Trial <ArrowRight size={18} />
          </button>
          <p className="text-center text-xs text-gray-500 mt-4">*No payment info required upfront.</p>
        </motion.div>

      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-gray-900 border border-gray-800 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden relative"
            >
              <button 
                onClick={handleCloseModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="p-8">
                {isSubmitted ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-cyan-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="text-cyan-400" size={32} />
                    </div>
                    <h3 className="text-2xl font-bold mb-3 text-white">Request Received!</h3>
                    <p className="text-gray-400 mb-8 leading-relaxed">
                      Thanks! Our team will review your request and email you login credentials shortly.
                    </p>
                    <button 
                      onClick={handleCloseModal}
                      className="w-full py-3 rounded-xl font-semibold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-2xl font-bold mb-2">
                      {selectedPlan === 'trial' ? 'Start Free Trial' : 'Subscribe to Pro'}
                    </h3>
                    <p className="text-gray-400 text-sm mb-6">
                      Please provide your details below. Our team will set up your workspace.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Full Name</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                          <input 
                            type="text" 
                            required
                            value={formData.fullName}
                            onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                            placeholder="John Doe"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Work Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                          <input 
                            type="email" 
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                            placeholder="john@company.com"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1.5">Organization Name</label>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                          <input 
                            type="text" 
                            required
                            value={formData.organizationName}
                            onChange={(e) => setFormData({...formData, organizationName: e.target.value})}
                            className="w-full bg-gray-950 border border-gray-800 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                            placeholder="Acme Corp"
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        className="w-full py-3.5 mt-4 rounded-xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.98] transition-all"
                      >
                        Request Access
                      </button>
                    </form>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
