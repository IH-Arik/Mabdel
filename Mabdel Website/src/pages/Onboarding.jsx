import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ChevronRight, 
  Mic, 
  Bell, 
  IdCard, 
  ShieldCheck 
} from 'lucide-react';
import img1 from '../assets/img1.png';
import img2 from '../assets/img2.png';
import img3 from '../assets/img3.png';

const slides = [
  {
    id: "assistant",
    title: "Meet Your AI Assistant",
    highlight: "AI Assistant",
    description: "Automate your business, invoices, and scheduling with the power of AI.",
    image: img1
  },
  {
    id: "invoice",
    title: "Smart Invoicing",
    highlight: "Smart Invoicing",
    description: "Create, send, and track invoices effortlessly with AI-powered data entry.",
    image: img2
  },
  {
    id: "payment",
    title: "Secure Payment",
    highlight: "Secure Payment",
    description: "Integrated Stripe, Apple Pay, and Google Pay for fast and secure transactions.",
    image: img3
  }
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [slideIndex, setSlideIndex] = useState(0);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permissions, setPermissions] = useState({
    microphone: true,
    notifications: true,
    contacts: true
  });

  const currentSlide = slides[slideIndex];

  const goNext = () => {
    if (slideIndex === slides.length - 1) {
      setShowPermissions(true);
    } else {
      setSlideIndex(prev => prev + 1);
    }
  };

  const goBack = () => {
    if (showPermissions) {
      setShowPermissions(false);
    } else if (slideIndex > 0) {
      setSlideIndex(prev => prev - 1);
    } else {
      navigate('/begin');
    }
  };

  const handleSkip = () => {
    setShowPermissions(true);
  };

  const handleAcceptAll = () => {
    localStorage.setItem('onboarding_completed', 'true');
    localStorage.setItem('onboarding_permissions', JSON.stringify(permissions));
    navigate('/login');
  };

  const togglePermission = (key) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const renderTitle = (slide) => {
    const text = slide.title;
    const highlight = slide.highlight;
    if (highlight && text.includes(highlight)) {
      const parts = text.split(highlight);
      return (
        <h2 className="text-2xl font-extrabold text-white text-center tracking-tight leading-snug">
          {parts[0]}
          <span className="text-[#11C7E5]">{highlight}</span>
          {parts[1]}
        </h2>
      );
    }
    return <h2 className="text-2xl font-extrabold text-white text-center tracking-tight leading-snug">{text}</h2>;
  };

  if (showPermissions) {
    return (
      <div className="w-full h-full min-h-screen bg-gradient-to-b from-[#02080B] to-[#010405] text-white flex flex-col p-6 text-left select-none overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between pt-2">
          <button onClick={goBack} className="text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Setup Setup</span>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Permissions Content */}
        <div className="flex-1 flex flex-col mt-6 space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Permissions</h1>
            <p className="text-xs text-[#A4B0B7] leading-relaxed max-w-sm mx-auto">
              Mabdel AI needs access to some features to provide the best business assistance experience.
            </p>
          </div>

          {/* Cards */}
          <div className="space-y-4">
            {/* Microphone */}
            <div className="bg-[#171D22] border border-[#222A33] rounded-[22px] p-4 flex items-center justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center text-[#11C7E5] shrink-0">
                <Mic size={22} strokeWidth={2.3} />
              </div>
              <div className="flex-1 space-y-0.5">
                <h3 className="text-sm font-extrabold text-white">Microphone</h3>
                <p className="text-[11px] text-[#A4B0B7] leading-tight">
                  Enable voice commands and AI dictation for hands-free assistance.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={permissions.microphone} 
                  onChange={() => togglePermission('microphone')} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#2A3C55] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#11C7E5]" />
              </label>
            </div>

            {/* Notifications */}
            <div className="bg-[#171D22] border border-[#222A33] rounded-[22px] p-4 flex items-center justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center text-[#11C7E5] shrink-0">
                <Bell size={22} strokeWidth={2.3} />
              </div>
              <div className="flex-1 space-y-0.5">
                <h3 className="text-sm font-extrabold text-white">Notifications</h3>
                <p className="text-[11px] text-[#A4B0B7] leading-tight">
                  Receive real-time updates on business insights and task completions.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={permissions.notifications} 
                  onChange={() => togglePermission('notifications')} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#2A3C55] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#11C7E5]" />
              </label>
            </div>

            {/* Contacts */}
            <div className="bg-[#171D22] border border-[#222A33] rounded-[22px] p-4 flex items-center justify-between gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#11C7E5]/10 flex items-center justify-center text-[#11C7E5] shrink-0">
                <IdCard size={22} strokeWidth={2.3} />
              </div>
              <div className="flex-1 space-y-0.5">
                <h3 className="text-sm font-extrabold text-white">Contacts</h3>
                <p className="text-[11px] text-[#A4B0B7] leading-tight">
                  Allow the assistant to help schedule meetings and manage client relations.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={permissions.contacts} 
                  onChange={() => togglePermission('contacts')} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#2A3C55] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#11C7E5]" />
              </label>
            </div>
          </div>

          {/* Privacy Secured Card */}
          <div className="border border-[#11C7E5]/20 rounded-[24px] overflow-hidden bg-gradient-to-br from-[#11C7E5]/10 to-[#11C7E5]/0 mt-2">
            <div className="p-5 flex flex-col items-center gap-2 text-center">
              <ShieldCheck size={36} className="text-[#11C7E5]" strokeWidth={2.3} />
              <h4 className="text-xs font-bold tracking-wider text-[#11C7E5] uppercase">PRIVACY SECURED</h4>
              <p className="text-[10px] text-[#A4B0B7] leading-normal max-w-xs pl-1">
                Mabdel uses end-to-end encryption for all shared data.
              </p>
            </div>
          </div>

          {/* Submit */}
          <button 
            onClick={handleAcceptAll}
            className="w-full py-4.5 bg-[#11C7E5] text-[#02080B] font-extrabold text-sm rounded-2xl shadow-lg shadow-[#11C7E5]/15 hover:bg-[#0fd0f0] transition-colors mt-auto active:scale-99"
          >
            Accept All
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-screen bg-gradient-to-b from-[#031218] via-[#02080B] to-[#010406] text-white flex flex-col justify-between p-6 select-none overflow-y-auto no-scrollbar">
      
      {/* Top Header */}
      <div className="flex items-center justify-between pt-2 shrink-0">
        <button onClick={goBack} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </button>
        <button onClick={handleSkip} className="text-xs font-bold text-[#F2F6F8] hover:text-[#11C7E5]">
          Skip
        </button>
      </div>

      {/* Illustration Area */}
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        <img 
          src={currentSlide.image} 
          alt={currentSlide.title} 
          className="w-56 h-56 object-contain drop-shadow-[0_0_20px_rgba(17,199,229,0.15)] animate-fade-in"
        />
      </div>

      {/* Texts section */}
      <div className="flex flex-col items-center gap-3 py-4 shrink-0">
        {renderTitle(currentSlide)}
        <p className="text-xs text-[#A4B0B7] text-center max-w-xs leading-normal">
          {currentSlide.description}
        </p>
      </div>

      {/* Footer controls */}
      <div className="flex flex-col gap-6 pt-4 pb-2 shrink-0">
        <button 
          onClick={goNext}
          className="w-full py-4 bg-[#11C7E5] text-[#02080B] font-extrabold text-sm rounded-2xl shadow-lg shadow-[#11C7E5]/15 hover:bg-[#0fd0f0] flex items-center justify-center gap-1 active:scale-99 transition-all"
        >
          <span>{slideIndex === slides.length - 1 ? 'Get Started' : 'Next'}</span>
          <ChevronRight size={16} strokeWidth={2.5} />
        </button>

        {/* Page Dots Indicator */}
        <div className="flex items-center justify-center gap-2">
          {slides.map((_, idx) => (
            <span 
              key={idx}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                idx === slideIndex ? 'w-8 bg-[#11C7E5]' : 'w-2.5 bg-[#2F3C52]'
              }`}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
