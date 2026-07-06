import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, 
  ArrowRight, 
  FileText, 
  ShieldCheck, 
  Bot, 
  Cpu, 
  MessageSquare, 
  Lock, 
  Sparkles,
  CreditCard
} from 'lucide-react';
import heroImage from '../assets/hero-3d.png';

export default function Landing() {
  const navigate = useNavigate();

  // Stagger animation container
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  // Card fade-up animation
  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: "easeOut" }
    }
  };

  const bentoCards = [
    {
      title: "Smart Invoicing",
      description: "AI auto-fills client details, generates line items, and sends automatically. Track status in real-time.",
      icon: FileText,
      link: "/login"
    },
    {
      title: "Secure Payments",
      description: "Bank-grade encryption for fast checkouts via Stripe, Apple Pay, and Google Pay.",
      icon: CreditCard,
      link: "/login"
    },
    {
      title: "AI Assistant",
      description: "Drafts messages, provides business updates, and manages task reminders automatically.",
      icon: Bot,
      link: "/login"
    },
    {
      title: "Workflow Automation",
      description: "Capture tasks, let AI process the context, and SmartFlow completes the action seamlessly.",
      icon: Cpu,
      link: "/login"
    },
    {
      title: "Client Communication",
      description: "Unified inbox powered by AI to draft responses and keep client context in one place.",
      icon: MessageSquare,
      link: "/login"
    },
    {
      title: "Privacy First",
      description: "End-to-end encrypted data, secure integrations, and user-controlled AI access permissions.",
      icon: Lock,
      link: "/login"
    }
  ];

  return (
    <div className="min-h-screen bg-[#070a13] text-gray-100 font-sans antialiased overflow-x-hidden selection:bg-cyan-500 selection:text-[#070a13]">
      
      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[60%] h-[80%] bg-gradient-to-tr from-cyan-500/10 to-teal-500/5 rounded-full blur-[120px] opacity-75" />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[60%] bg-cyan-600/5 rounded-full blur-[100px] opacity-50" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-gray-900 bg-[#070a13]/70">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-cyan-400 to-teal-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Zap size={20} className="text-[#070a13] fill-current" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white bg-clip-text">SmartFlow</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#features" className="hover:text-white transition-colors">Solutions</a>
            <a href="#features" className="hover:text-white transition-colors">Security</a>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/login')} 
              className="px-5 py-2.5 text-sm font-semibold text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-xl transition-all"
            >
              Login
            </button>
            <button 
              onClick={() => navigate('/subscription')} 
              className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] rounded-xl hover:opacity-90 transition-all shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.98]"
            >
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-12 pb-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Left Text */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-8">
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-950/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider"
            >
              <Sparkles size={12} className="animate-pulse" /> Introducing SmartFlow AI
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.1] text-white"
            >
              Your Complete <br />
              <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                AI Business Assistant
              </span>
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg md:text-xl text-gray-400 max-w-xl font-normal leading-relaxed"
            >
              Automate invoicing, payments, client communication, and daily business workflows with high-performance AI intelligence. Focus on growth, we handle the admin.
            </motion.p>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4 w-full sm:w-auto"
            >
              <button 
                onClick={() => navigate('/subscription')}
                className="px-8 py-4 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] font-bold rounded-xl shadow-lg shadow-cyan-500/20 hover:opacity-95 hover:shadow-cyan-500/35 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group w-full sm:w-auto"
              >
                Get Started
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <a 
                href="#features"
                className="px-8 py-4 bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 font-bold rounded-xl text-white transition-all text-center w-full sm:w-auto"
              >
                See How It Works
              </a>
            </motion.div>
          </div>

          {/* Right Visual (Glowing 3D Mesh & Floating Labels) */}
          <div className="lg:col-span-5 relative flex items-center justify-center">
            
            {/* Ambient Backlight */}
            <div className="absolute w-72 h-72 bg-cyan-500/10 rounded-full blur-[80px] -z-10 animate-pulse" />

            {/* Glowing mesh visual */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative w-full max-w-[400px] aspect-square rounded-full flex items-center justify-center"
            >
              <img 
                src={heroImage} 
                alt="SmartFlow AI Graphic" 
                className="w-full h-full object-contain filter drop-shadow-[0_0_50px_rgba(6,182,212,0.15)]"
              />

              {/* Floating Tag 1: Auto-Invoice Generated */}
              <motion.div 
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-12 -left-8 px-4 py-3 bg-[#0d1222]/80 backdrop-blur-md border border-gray-800 rounded-xl flex items-center gap-3 shadow-xl"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400">
                  <FileText size={16} />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">SmartFlow AI</p>
                  <p className="text-xs font-bold text-white">Auto-Invoice Generated</p>
                </div>
              </motion.div>

              {/* Floating Tag 2: Payment Secured */}
              <motion.div 
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute bottom-20 -right-8 px-4 py-3 bg-[#0d1222]/80 backdrop-blur-md border border-gray-800 rounded-xl flex items-center gap-3 shadow-xl"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-950 flex items-center justify-center text-teal-400">
                  <CreditCard size={16} />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Secured Gateway</p>
                  <p className="text-xs font-bold text-white">Payment Secured</p>
                </div>
              </motion.div>

              {/* Floating Tag 3: AI Assistant Active */}
              <motion.div 
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute -bottom-4 left-10 px-4 py-3 bg-[#0d1222]/80 backdrop-blur-md border border-gray-800 rounded-xl flex items-center gap-3 shadow-xl"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-950 flex items-center justify-center text-cyan-400">
                  <Bot size={16} />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">System State</p>
                  <p className="text-xs font-bold text-white">AI Assistant Active</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pain Point Section */}
      <section className="py-20 border-t border-gray-950 bg-gradient-to-b from-[#070a13] to-[#0a0e1a]">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Drowning in Admin?
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Manual work kills momentum. Hours lost to time-consuming invoices, tracking payments, and scattered communication means less time focusing on what actually matters.
          </p>
          
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <span className="px-5 py-2 border border-rose-500/20 bg-rose-950/10 text-rose-400 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg shadow-rose-950/5 cursor-default hover:border-rose-500/35 transition-colors">
              <span className="text-rose-500">✕</span> Manual Data Entry
            </span>
            <span className="px-5 py-2 border border-rose-500/20 bg-rose-950/10 text-rose-400 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg shadow-rose-950/5 cursor-default hover:border-rose-500/35 transition-colors">
              <span className="text-rose-500">✕</span> Late Payments
            </span>
            <span className="px-5 py-2 border border-rose-500/20 bg-rose-950/10 text-rose-400 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg shadow-rose-950/5 cursor-default hover:border-rose-500/35 transition-colors">
              <span className="text-rose-500">✕</span> Scattered Emails
            </span>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-24 md:py-32 bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          
          {/* Header */}
          <div className="text-center space-y-4">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Intelligent Automation Core
            </h2>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto font-normal">
              Everything you need to run your business autonomously.
            </p>
          </div>

          {/* Grid */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {bentoCards.map((card, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ y: -6 }}
                onClick={() => navigate(card.link)}
                className="group relative bg-[#111625]/40 backdrop-blur-xl border border-gray-900 hover:border-cyan-500/40 p-8 rounded-3xl cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)] flex flex-col justify-between h-72"
              >
                {/* Background Card Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/0 to-cyan-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-300" />
                
                <div>
                  <div className="w-12 h-12 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center text-cyan-400 group-hover:text-cyan-300 group-hover:border-cyan-500/30 transition-colors">
                    <card.icon size={22} />
                  </div>
                  <h3 className="text-xl font-bold text-white mt-6 group-hover:text-cyan-300 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-gray-400 mt-3 font-normal leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 text-sm font-bold text-cyan-400 group-hover:text-cyan-300 mt-6 select-none">
                  Explore <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 md:py-32 relative bg-gradient-to-b from-[#0a0e1a] to-[#070a13] border-t border-gray-950">
        
        {/* Background glow in CTA */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto px-6 text-center space-y-8">
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Start automating your business today.
          </h2>
          <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Join thousands of modern professionals who have upgraded their workflow with SmartFlow AI.
          </p>
          <div className="pt-4">
            <button 
              onClick={() => navigate('/subscription')}
              className="px-8 py-4 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] font-bold rounded-xl shadow-lg shadow-cyan-500/20 hover:opacity-95 hover:shadow-cyan-500/35 transition-all active:scale-[0.98] inline-flex items-center gap-2"
            >
              Get Started
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-950 bg-[#05070d] py-16">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-400 to-teal-500 flex items-center justify-center">
              <Zap size={18} className="text-[#070a13] fill-current" />
            </div>
            <span className="text-lg font-bold text-white">SmartFlow</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-xs font-semibold text-gray-500">
            <a href="#features" className="hover:text-gray-300 transition-colors">Features</a>
            <a href="#features" className="hover:text-gray-300 transition-colors">Solutions</a>
            <a href="#features" className="hover:text-gray-300 transition-colors">Security</a>
            <a href="#features" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
            <a href="#features" className="hover:text-gray-300 transition-colors">Terms of Service</a>
          </div>

          <p className="text-xs text-gray-600 text-center md:text-right">
            © 2026 SmartFlow AI. High-performance automation for the modern enterprise.
          </p>
        </div>
      </footer>

    </div>
  );
}
