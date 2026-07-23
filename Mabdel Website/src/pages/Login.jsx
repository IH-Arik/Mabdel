import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Lock, 
  Loader2, 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  User, 
  Phone, 
  Eye, 
  EyeOff, 
  KeyRound, 
  Check,
  ChevronRight,
  Clock,
  Unlock
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import client from '../api/client';
import { useNavigate } from 'react-router-dom';
import logoImg from '../assets/gocustify-mark.png';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, isLoading: authLoading, error: authError } = useAuthStore();

  // Multi-state configuration
  // Modes: 'login', 'register', 'choose_method', 'enter_code', 'reset', 'success_register', 'success_reset'
  const [authMode, setAuthMode] = useState('login');
  
  // Track previous step to route properly
  const [flowType, setFlowType] = useState('signup'); // 'signup' or 'forgot_password'
  
  // Local state for actions
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [localMessage, setLocalMessage] = useState(null);
  
  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneVal, setPhoneVal] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Verification states
  const [verifyMethod, setVerifyMethod] = useState('email'); // 'email' or 'sms'
  const [otpArray, setOtpArray] = useState(['', '', '', '']);
  const [activeOtpIndex, setActiveOtpIndex] = useState(0);
  const [resendTimer, setResendTimer] = useState(45);
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Forgot Password / Reset Password states
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Masking helpers
  const maskEmail = (emailStr) => {
    if (!emailStr) return 's***@flow.com';
    const [name, domain] = emailStr.split('@');
    if (!name || !domain) return 's***@flow.com';
    return `${name[0]}***@${domain}`;
  };

  const maskPhone = (phoneStr) => {
    if (!phoneStr) return '+1 *** *** 1234';
    return `+1 *** *** ${phoneStr.slice(-4)}`;
  };

  // Password strength helper
  const getPasswordStrength = (pass) => {
    if (!pass) return { score: 0, text: 'Empty', color: 'bg-gray-800' };
    if (pass.length < 8) return { score: 1, text: 'Weak', color: 'bg-rose-500' };
    const hasLetters = /[a-zA-Z]/.test(pass);
    const hasNumbers = /[0-9]/.test(pass);
    const hasSpecial = /[^a-zA-Z0-9]/.test(pass);
    if (hasLetters && hasNumbers && hasSpecial && pass.length >= 10) {
      return { score: 3, text: 'Strong', color: 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' };
    }
    return { score: 2, text: 'Medium', color: 'bg-amber-400 shadow-[0_0_10px_#fbbf24]' };
  };

  const strength = getPasswordStrength(newPassword);

  // Timer countdown hook
  useEffect(() => {
    let interval = null;
    if (authMode === 'enter_code' && resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [authMode, resendTimer]);

  // Handle OTP focus adjustments
  const handleOtpChange = (value, index) => {
    if (isNaN(value)) return;
    const newOtp = [...otpArray];
    newOtp[index] = value;
    setOtpArray(newOtp);

    // Move to next field if value is entered
    if (value && index < 3) {
      otpRefs[index + 1].current.focus();
      setActiveOtpIndex(index + 1);
    }
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      if (!otpArray[index] && index > 0) {
        otpRefs[index - 1].current.focus();
        setActiveOtpIndex(index - 1);
      } else {
        const newOtp = [...otpArray];
        newOtp[index] = '';
        setOtpArray(newOtp);
      }
    }
  };

  // Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setLocalMessage(null);
    const success = await login(email, password);
    if (success) {
      navigate('/dashboard');
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setLocalError(null);
    setFlowType('signup');
    setAuthMode('choose_method');
  };

  const handleForgotPasswordSubmit = (e) => {
    e.preventDefault();
    setLocalError(null);
    setFlowType('forgot_password');
    setAuthMode('choose_method');
  };

  // Dispatch OTP code request
  const handleSendVerificationCode = async () => {
    setLocalError(null);
    setLocalLoading(true);
    try {
      if (flowType === 'signup') {
        // Triggers initial user registration payload
        await register({
          full_name: fullName,
          email: email,
          password: password
        });
        setResendTimer(45);
        setOtpArray(['', '', '', '']);
        setAuthMode('enter_code');
      } else {
        // Triggers forgot password OTP
        await client.post('/api/v1/auth/forgot-password', {
          email: forgotEmail
        });
        setResendTimer(45);
        setOtpArray(['', '', '', '']);
        setAuthMode('enter_code');
      }
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to dispatch verification code.');
    } finally {
      setLocalLoading(false);
    }
  };

  // Verify OTP submit action
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLocalError(null);
    const code = otpArray.join('');
    if (code.length < 4) {
      setLocalError('Please enter a 4-digit code.');
      return;
    }
    setLocalLoading(true);
    
    const targetEmail = flowType === 'signup' ? email : forgotEmail;
    const purpose = flowType === 'signup' ? 'signup' : 'forgot_password';

    try {
      const res = await client.post('/api/v1/auth/verify-otp', {
        email: targetEmail,
        code: code,
        purpose: purpose
      });

      if (flowType === 'signup') {
        setLocalMessage('Account created and verified successfully!');
        setAuthMode('success_register');
      } else {
        const token = res.data.data?.reset_token;
        if (token) {
          setResetToken(token);
          setAuthMode('reset');
        } else {
          setLocalError('Reset token was not returned by verification.');
        }
      }
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Verification failed. Please check your code.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    setLocalLoading(true);
    try {
      await client.post('/api/v1/auth/reset-password', {
        email: forgotEmail,
        reset_token: resetToken,
        new_password: newPassword,
        confirm_password: confirmPassword
      });
      setAuthMode('success_reset');
    } catch (err) {
      setLocalError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setLocalLoading(false);
    }
  };

  const handleResendCode = () => {
    setResendTimer(45);
    handleSendVerificationCode();
  };

  const activeError = authError || localError;

  return (
    <div className="min-h-screen bg-[#02080B] text-gray-100 flex flex-col justify-between p-6 relative overflow-hidden font-sans antialiased">
      
      {/* Background radial glow */}
      <div className="absolute w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px] pointer-events-none -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* Spacer to push card center */}
      <div className="flex-1 flex items-center justify-center z-10">
        <AnimatePresence mode="wait">
          <motion.div 
            key={authMode}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-md animate-fade-in"
          >
            <div className="bg-[#0c101b]/95 border border-[#243041] rounded-3xl p-8 md:p-10 shadow-2xl relative overflow-hidden hover:shadow-[0_0_40px_rgba(17,199,229,0.03)] transition-all">
              
              {/* Header Logo */}
              {authMode !== 'success_register' && authMode !== 'success_reset' && (
                <div className="text-center mb-6 flex flex-col items-center">
                  <div className="flex flex-col items-center gap-1.5 cursor-pointer" onClick={() => {
                    setAuthMode('login');
                    setLocalError(null);
                    setLocalMessage(null);
                  }}>
                    <img src={logoImg} alt="GoCustify logo" className="w-12 h-12 object-contain drop-shadow-[0_0_15px_rgba(17,199,229,0.2)]" />
                    <span className="text-xs font-black tracking-[0.2em] text-[#11C7E5] uppercase">GoCustify</span>
                  </div>
                </div>
              )}

              {/* API and local error feedback */}
              {activeError && (
                <div className="mb-6 p-4 bg-rose-950/20 border border-rose-500/25 rounded-xl text-rose-300 text-sm flex items-center gap-2 font-medium">
                  <ShieldCheck size={18} className="text-rose-500 flex-shrink-0" />
                  <span>{activeError}</span>
                </div>
              )}

              {/* Local status message feedback */}
              {localMessage && (
                <div className="mb-6 p-4 bg-cyan-950/20 border border-cyan-500/25 rounded-xl text-cyan-300 text-sm flex items-center gap-2 font-medium">
                  <Check size={18} className="text-cyan-400 flex-shrink-0" />
                  <span>{localMessage}</span>
                </div>
              )}

              {/* 1. LOGIN MODE */}
              {authMode === 'login' && (
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h2>
                    <p className="text-gray-400 mt-2 text-sm">Log in to your GoCustify workspace.</p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 tracking-wide uppercase">Email / Phone</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type="email" 
                          placeholder="Enter your email or phone"
                          className="w-full pl-12 pr-4 py-3.5 bg-[#121625]/60 border border-gray-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-medium text-white placeholder:text-gray-600"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-gray-400 tracking-wide uppercase">Password</label>
                        <button 
                          type="button" 
                          onClick={() => {
                            setAuthMode('forgot');
                            setLocalError(null);
                            setLocalMessage(null);
                          }} 
                          className="text-xs font-bold text-cyan-400 hover:underline"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type={showPass ? "text" : "password"} 
                          placeholder="Enter your password"
                          className="w-full pl-12 pr-12 py-3.5 bg-[#121625]/60 border border-gray-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-medium text-white placeholder:text-gray-600"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPass(!showPass)} 
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={authLoading}
                      className="w-full py-3.5 mt-2 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.99] transition-all disabled:opacity-70 flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      {authLoading ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        "Log In"
                      )}
                    </button>
                  </form>

                  <p className="mt-8 text-center text-gray-400 text-sm">
                    Don't have an account?{' '}
                    <button 
                      onClick={() => {
                        setAuthMode('register');
                        setLocalError(null);
                        setLocalMessage(null);
                      }} 
                      className="text-cyan-400 font-bold hover:underline"
                    >
                      Sign Up
                    </button>
                  </p>
                </div>
              )}

              {/* 2. REGISTER MODE */}
              {authMode === 'register' && (
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Create Account</h2>
                    <p className="text-gray-400 mt-2 text-sm">Create your GoCustify account and get started.</p>
                  </div>

                  <form onSubmit={handleRegisterSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 tracking-wide uppercase">Full Name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type="text" 
                          placeholder="John Doe"
                          className="w-full pl-12 pr-4 py-3.5 bg-[#121625]/60 border border-gray-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-medium text-white placeholder:text-gray-600"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 tracking-wide uppercase">Email Address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type="email" 
                          placeholder="john@example.com"
                          className="w-full pl-12 pr-4 py-3.5 bg-[#121625]/60 border border-gray-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-medium text-white placeholder:text-gray-600"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 tracking-wide uppercase">Phone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type="text" 
                          placeholder="+1 (555) 000-0000"
                          className="w-full pl-12 pr-4 py-3.5 bg-[#121625]/60 border border-gray-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-medium text-white placeholder:text-gray-600"
                          value={phoneVal}
                          onChange={(e) => setPhoneVal(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 tracking-wide uppercase">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type={showPass ? "text" : "password"} 
                          placeholder="Enter your password"
                          className="w-full pl-12 pr-12 py-3.5 bg-[#121625]/60 border border-gray-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-medium text-white placeholder:text-gray-600"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowPass(!showPass)} 
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 pt-1">
                      <input type="checkbox" id="agree" required className="mt-1 rounded bg-[#121625]/60 border border-gray-900 text-cyan-500 focus:ring-cyan-500/20" />
                      <label htmlFor="agree" className="text-xs text-gray-400 leading-normal font-medium cursor-pointer">
                        I agree to the <a href="/terms-and-conditions" className="text-cyan-400 hover:underline">Terms & Conditions</a> and <a href="/privacy-policy" className="text-cyan-400 hover:underline">Privacy Policy</a>.
                      </label>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full py-3.5 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      Sign Up
                    </button>
                  </form>

                  <p className="mt-8 text-center text-gray-400 text-sm">
                    Already have an account?{' '}
                    <button 
                      onClick={() => {
                        setAuthMode('login');
                        setLocalError(null);
                        setLocalMessage(null);
                      }} 
                      className="text-cyan-400 font-bold hover:underline"
                    >
                      Log In
                    </button>
                  </p>
                </div>
              )}

              {/* 3. CHOOSE VERIFICATION METHOD */}
              {authMode === 'choose_method' && (
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Choose Verification Method</h2>
                    <p className="text-gray-400 mt-2 text-sm">Select where you want to receive your verification code.</p>
                  </div>

                  <div className="space-y-4">
                    {/* Email Option */}
                    <div 
                      onClick={() => setVerifyMethod('email')}
                      className={`p-5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        verifyMethod === 'email' 
                          ? 'border-cyan-500/80 bg-[#0e1322]/80 shadow-[0_0_15px_rgba(6,182,212,0.08)]' 
                          : 'border-gray-900 bg-[#121625]/20 hover:bg-[#121625]/40 hover:border-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${verifyMethod === 'email' ? 'bg-cyan-950 text-cyan-400' : 'bg-gray-900 text-gray-500'}`}>
                          <Mail size={18} />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Send via Email</p>
                          <p className="text-sm font-bold text-white">{maskEmail(flowType === 'signup' ? email : forgotEmail)}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${verifyMethod === 'email' ? 'border-cyan-400' : 'border-gray-700'}`}>
                        {verifyMethod === 'email' && <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />}
                      </div>
                    </div>

                    {/* SMS Option */}
                    <div 
                      onClick={() => setVerifyMethod('sms')}
                      className={`p-5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        verifyMethod === 'sms' 
                          ? 'border-cyan-500/80 bg-[#0e1322]/80 shadow-[0_0_15px_rgba(6,182,212,0.08)]' 
                          : 'border-gray-900 bg-[#121625]/20 hover:bg-[#121625]/40 hover:border-gray-800'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${verifyMethod === 'sms' ? 'bg-cyan-950 text-cyan-400' : 'bg-gray-900 text-gray-500'}`}>
                          <Phone size={18} />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Send via SMS</p>
                          <p className="text-sm font-bold text-white">{maskPhone(phoneVal)}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${verifyMethod === 'sms' ? 'border-cyan-400' : 'border-gray-700'}`}>
                        {verifyMethod === 'sms' && <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />}
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={handleSendVerificationCode}
                    disabled={localLoading}
                    className="w-full py-4 mt-8 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.99] transition-all disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {localLoading ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      "Send Code"
                    )}
                  </button>

                  <button 
                    onClick={() => {
                      setAuthMode(flowType === 'signup' ? 'register' : 'forgot');
                      setLocalError(null);
                    }}
                    className="w-full text-center text-sm font-bold text-gray-500 hover:text-white mt-5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* 4. ENTER VERIFICATION CODE (4 individual input boxes) */}
              {authMode === 'enter_code' && (
                <div>
                  <div className="text-center mb-8 flex flex-col items-center">
                    <div className="flex items-center gap-1.5 justify-center mb-4">
                      <img src={logoImg} alt="GoCustify logo" className="w-6 h-6 object-contain" />
                      <span className="text-sm font-bold text-white">GoCustify</span>
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Enter Verification Code</h2>
                    <p className="text-gray-400 mt-2 text-sm max-w-xs mx-auto">
                      Enter the 4-digit code sent to your {verifyMethod === 'email' ? 'email' : 'phone'}.
                    </p>
                  </div>

                  <form onSubmit={handleVerifyCode} className="space-y-6">
                    <div className="flex justify-center gap-4 py-2">
                      {otpArray.map((digit, idx) => (
                        <input
                          key={idx}
                          id={`otp-${idx}`}
                          ref={otpRefs[idx]}
                          type="text"
                          maxLength={1}
                          pattern="[0-9]*"
                          inputMode="numeric"
                          className={`w-16 h-16 bg-[#131929] border rounded-2xl text-center text-3xl font-bold text-white focus:outline-none transition-all ${
                            activeOtpIndex === idx || digit
                              ? 'border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                              : 'border-gray-900'
                          }`}
                          value={digit}
                          onFocus={() => setActiveOtpIndex(idx)}
                          onChange={(e) => handleOtpChange(e.target.value, idx)}
                          onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                          required
                        />
                      ))}
                    </div>

                    <button 
                      type="submit" 
                      disabled={localLoading}
                      className="w-full py-3.5 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.99] transition-all disabled:opacity-70 flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      {localLoading ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <>
                          Verify Code
                          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>
                  </form>

                  <div className="mt-8 text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-500">
                      <Clock size={16} />
                      <span>
                        {resendTimer > 0 
                          ? `Resend code in 00:${resendTimer.toString().padStart(2, '0')}`
                          : 'Code expired'
                        }
                      </span>
                    </div>

                    <button 
                      type="button"
                      disabled={resendTimer > 0 || localLoading}
                      onClick={handleResendCode}
                      className={`text-sm font-bold transition-colors block mx-auto ${
                        resendTimer > 0 
                          ? 'text-gray-700 cursor-not-allowed' 
                          : 'text-cyan-400 hover:text-cyan-300'
                      }`}
                    >
                      I didn't receive a code
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 text-xs text-gray-600 font-bold uppercase tracking-wider mt-8 pt-4 border-t border-gray-950">
                    <Lock size={12} /> Quantum Secured Access
                  </div>
                </div>
              )}

              {/* 5. FORGOT PASSWORD MODE */}
              {authMode === 'forgot' && (
                <div>
                  <div className="text-center mb-8 flex flex-col items-center">
                    <div className="w-14 h-14 rounded-full bg-cyan-950/45 border border-cyan-500/25 flex items-center justify-center text-cyan-400 mb-4 shadow-lg shadow-cyan-500/5">
                      <KeyRound size={24} />
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Forgot Password?</h2>
                    <p className="text-gray-400 mt-2 text-sm max-w-xs mx-auto">
                      Enter your email or phone number and we'll send a verification code to reset your password.
                    </p>
                  </div>

                  <form onSubmit={handleForgotPasswordSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 tracking-wide uppercase">Email / Phone</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type="email" 
                          placeholder="Enter your details"
                          className="w-full pl-12 pr-4 py-3.5 bg-[#121625]/60 border border-gray-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-medium text-white placeholder:text-gray-600"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full py-3.5 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                    >
                      Send Verification Code
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </form>

                  <p className="mt-8 text-center text-gray-400 text-sm">
                    Remember your password?{' '}
                    <button 
                      onClick={() => {
                        setAuthMode('login');
                        setLocalError(null);
                        setLocalMessage(null);
                      }} 
                      className="text-cyan-400 font-bold hover:underline"
                    >
                      Back to Login
                    </button>
                  </p>
                </div>
              )}

              {/* 6. RESET PASSWORD MODE */}
              {authMode === 'reset' && (
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white tracking-tight">Set New Password</h2>
                    <p className="text-gray-400 mt-2 text-sm">Create a secure password for your GoCustify account.</p>
                  </div>

                  <form onSubmit={handleResetPassword} className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 tracking-wide uppercase">New Password</label>
                      <div className="relative">
                        <input 
                          type={showNewPass ? "text" : "password"} 
                          placeholder="Enter new password"
                          className="w-full pl-4 pr-12 py-3.5 bg-[#121625]/60 border border-gray-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-medium text-white placeholder:text-gray-600"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowNewPass(!showNewPass)} 
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showNewPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 tracking-wide uppercase">Confirm Password</label>
                      <div className="relative">
                        <input 
                          type={showConfirmPass ? "text" : "password"} 
                          placeholder="Confirm new password"
                          className="w-full pl-4 pr-12 py-3.5 bg-[#121625]/60 border border-gray-900 focus:border-cyan-500/40 rounded-xl focus:outline-none transition-all font-medium text-white placeholder:text-gray-600"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                        />
                        <button 
                          type="button" 
                          onClick={() => setShowConfirmPass(!showConfirmPass)} 
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                        >
                          {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    {/* Password strength meter */}
                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-center text-xs font-bold">
                        <span className="text-gray-500">Password strength</span>
                        <span className={
                          strength.score === 3 ? "text-cyan-400" :
                          strength.score === 2 ? "text-amber-400" :
                          strength.score === 1 ? "text-rose-400" : "text-gray-600"
                        }>{strength.text}</span>
                      </div>
                      <div className="flex gap-2">
                        <div className={`h-1.5 flex-1 rounded-full ${strength.score >= 1 ? strength.color : 'bg-gray-900'}`} />
                        <div className={`h-1.5 flex-1 rounded-full ${strength.score >= 2 ? strength.color : 'bg-gray-900'}`} />
                        <div className={`h-1.5 flex-1 rounded-full ${strength.score >= 3 ? strength.color : 'bg-gray-900'}`} />
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={localLoading}
                      className="w-full py-3.5 mt-4 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.99] transition-all disabled:opacity-70 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {localLoading ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        "Update Password"
                      )}
                    </button>
                  </form>

                  <p className="mt-8 text-center text-gray-400 text-sm">
                    Remember password?{' '}
                    <button 
                      onClick={() => {
                        setAuthMode('login');
                        setLocalError(null);
                        setLocalMessage(null);
                      }} 
                      className="text-cyan-400 font-bold hover:underline"
                    >
                      Back to Login
                    </button>
                  </p>
                </div>
              )}

              {/* 7. REGISTRATION SUCCESS MODE */}
              {authMode === 'success_register' && (
                <div className="text-center py-4 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-cyan-950/80 border-2 border-cyan-400 flex items-center justify-center text-cyan-400 mb-6 shadow-lg shadow-cyan-400/30">
                    <Check size={32} strokeWidth={3} />
                  </div>
                  
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    Account Created <br />Successfully
                  </h2>
                  
                  <p className="text-gray-400 mt-4 text-sm leading-relaxed max-w-xs mx-auto">
                    Welcome to the future of business automation. Your workspace is ready for configuration.
                  </p>

                  <button 
                    onClick={() => {
                      setAuthMode('login');
                      setLocalError(null);
                      setLocalMessage(null);
                    }}
                    className="w-full py-3.5 mt-8 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer"
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* 8. PASSWORD RESET SUCCESS MODE */}
              {authMode === 'success_reset' && (
                <div className="text-center py-4 flex flex-col items-center">
                  <div className="w-16 h-16 rounded-full bg-cyan-950/80 border-2 border-cyan-400 flex items-center justify-center text-cyan-400 mb-6 shadow-lg shadow-cyan-400/30">
                    <Check size={32} strokeWidth={3} />
                  </div>
                  
                  <h2 className="text-3xl font-extrabold text-white tracking-tight">
                    Password Updated <br />Successfully
                  </h2>
                  
                  <p className="text-gray-400 mt-4 text-sm leading-relaxed max-w-xs mx-auto">
                    Your account is now secure.
                  </p>

                  <button 
                    onClick={() => {
                      setAuthMode('login');
                      setLocalError(null);
                      setLocalMessage(null);
                    }}
                    className="w-full py-3.5 mt-8 bg-gradient-to-r from-cyan-400 to-teal-400 text-[#070a13] rounded-xl font-bold shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group cursor-pointer"
                  >
                    Back to Log In
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Login Screen Footer */}
      <footer className="w-full max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 py-6 text-xs text-gray-600 font-bold border-t border-slate-900 mt-12 bg-transparent select-none z-10">
        <p>© 2026 GoCustify. All rights reserved.</p>
        <div className="flex items-center gap-6">
          <a href="/privacy-policy" className="hover:text-gray-400 transition-colors">Privacy Policy</a>
          <a href="/terms-and-conditions" className="hover:text-gray-400 transition-colors">Terms & Conditions</a>
        </div>
      </footer>

    </div>
  );
}
