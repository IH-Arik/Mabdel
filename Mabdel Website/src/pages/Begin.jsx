import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '../assets/gocustify-mark.png';

export default function Begin() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      // Check if onboarding is already completed
      const completed = localStorage.getItem('onboarding_completed');
      if (completed) {
        navigate('/login');
      } else {
        navigate('/onboarding');
      }
    }, 1700);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="w-full h-full min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-[#031017] via-[#02080B] to-[#010304] text-[#11C7E5] p-6 relative select-none">
      
      {/* Glow Effect behind logo */}
      <div className="absolute w-60 h-60 bg-[#11C7E5]/10 rounded-full blur-[80px] pointer-events-none" />

      {/* Brand logo & title */}
      <div className="flex flex-col items-center gap-6 z-10 animate-fade-in">
        <img 
          src={logoImg} 
          alt="GoCustify logo" 
          className="w-40 h-40 object-contain drop-shadow-[0_0_35px_rgba(17,199,229,0.3)] animate-pulse"
        />
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#11C7E5] uppercase drop-shadow-[0_2px_10px_rgba(17,199,229,0.2)]">
            GoCustify
          </h1>
          <p className="text-xs font-bold tracking-[0.4em] text-[#11C7E5]/80 uppercase pl-1.5">
            AI CRM PLATFORM
          </p>
        </div>
      </div>

    </div>
  );
}
