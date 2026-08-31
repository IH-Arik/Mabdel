import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Apple,
  ArrowRight,
  Bot,
  CalendarClock,
  Check,
  CheckCircle,
  CreditCard,
  Cpu,
  FileSignature,
  FileText,
  Inbox,
  Loader2,
  Lock,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Mic,
  PhoneCall,
  Play,
  Send,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import heroImage from '../assets/hero-3d.png';
import logoMark from '../assets/gocustify-mark.png';
import { publicApi } from '../api/services';
import { useLanguage } from '../context/LanguageContext';
import LanguageSwitcher from '../components/LanguageSwitcher';

// TODO: paste your YouTube/Vimeo embed URL here, e.g. 'https://www.youtube.com/embed/VIDEO_ID'
const DEMO_VIDEO_EMBED_URL = '';

function StoreBadge({ icon: Icon, eyebrow, label, compact = false, t }) {
  return (
    <button
      type="button"
      onClick={() => window.alert(t('coming_soon_alert', { label }))}
      className={`flex items-center gap-2.5 bg-gray-900/60 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl transition-all cursor-pointer text-left ${
        compact ? 'px-3.5 py-2' : 'px-4 py-2.5'
      }`}
    >
      <Icon size={compact ? 18 : 22} className="text-white shrink-0" />
      <span className="leading-tight">
        <span className={`block font-medium text-gray-400 uppercase tracking-wide ${compact ? 'text-[8px]' : 'text-[9px]'}`}>{eyebrow}</span>
        <span className={`block font-bold text-white ${compact ? 'text-xs' : 'text-sm'}`}>{label}</span>
      </span>
      <span className="ml-1 text-[9px] font-bold uppercase tracking-wider text-purple-400 border border-purple-500/30 bg-purple-950/30 rounded-full px-2 py-0.5">
        {t('soon_badge')}
      </span>
    </button>
  );
}

const journeyIcons = {
  capture: { tab: PhoneCall, panel: Mic },
  engage: { tab: MessageSquare, panel: Inbox },
  close: { tab: FileSignature, panel: CreditCard },
  grow: { tab: TrendingUp, panel: Share2 },
};

const bentoIcons = [Mic, FileText, MessageSquare, Send, FileSignature, Cpu];

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [videoOpen, setVideoOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [footerContactForm, setFooterContactForm] = useState({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    message: '',
  });
  const [footerContactSubmitting, setFooterContactSubmitting] = useState(false);
  const [footerContactSubmitted, setFooterContactSubmitted] = useState(false);
  const [footerContactError, setFooterContactError] = useState('');

  const handleFooterContactSubmit = async (e) => {
    e.preventDefault();
    if (!footerContactForm.firstName || !footerContactForm.lastName || !footerContactForm.email || !footerContactForm.message) {
      setFooterContactError(t('sub_err_demo_fill'));
      return;
    }
    setFooterContactSubmitting(true);
    setFooterContactError('');
    try {
      await publicApi.submitDemoRequest({
        first_name: footerContactForm.firstName,
        last_name: footerContactForm.lastName,
        phone: footerContactForm.phoneNumber,
        email: footerContactForm.email,
        message: footerContactForm.message,
      });
      setFooterContactSubmitted(true);
      setFooterContactForm({ firstName: '', lastName: '', phoneNumber: '', email: '', message: '' });
    } catch (error) {
      console.error(error);
      setFooterContactError(error.response?.data?.message || t('sub_err_demo_failed'));
    } finally {
      setFooterContactSubmitting(false);
    }
  };

  const stats = [
    { value: t('landing_stat_1_value'), label: t('landing_stat_1_label') },
    { value: t('landing_stat_2_value'), label: t('landing_stat_2_label') },
    { value: t('landing_stat_3_value'), label: t('landing_stat_3_label') },
    { value: t('landing_stat_4_value'), label: t('landing_stat_4_label') },
  ];

  const journeyTabs = ['capture', 'engage', 'close', 'grow'].map((id) => ({
    id,
    label: t(`journey_${id}_label`),
    icon: journeyIcons[id].tab,
    title: t(`journey_${id}_title`),
    description: t(`journey_${id}_description`),
    bullets: [1, 2, 3, 4].map((n) => t(`journey_${id}_bullet_${n}`)),
    panel: {
      icon: journeyIcons[id].panel,
      eyebrow: t(`journey_${id}_panel_eyebrow`),
      headline: t(`journey_${id}_panel_headline`),
      detail: t(`journey_${id}_panel_detail`),
    },
  }));

  const bentoCards = [1, 2, 3, 4, 5, 6].map((n, i) => ({
    title: t(`feature_${n}_title`),
    description: t(`feature_${n}_description`),
    icon: bentoIcons[i],
  }));

  const pricingPlans = [
    {
      key: 'starter',
      name: t('plan_starter_name'),
      price: '$299',
      subtitle: t('plan_starter_subtitle'),
      features: [1, 2, 3, 4, 5, 6].map((n) => t(`plan_starter_feature_${n}`)),
    },
    {
      key: 'growth',
      name: t('plan_growth_name'),
      price: '$699',
      subtitle: t('plan_growth_subtitle'),
      isPopular: true,
      features: [1, 2, 3, 4, 5, 6].map((n) => t(`plan_growth_feature_${n}`)),
    },
    {
      key: 'pro',
      name: t('plan_pro_name'),
      price: '$999',
      subtitle: t('plan_pro_subtitle'),
      features: [1, 2, 3, 4, 5, 6].map((n) => t(`plan_pro_feature_${n}`)),
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  };

  const TrialButton = ({ className = '' }) => (
    <button
      onClick={() => navigate('/subscription')}
      className={`px-8 py-4 bg-gradient-to-r from-purple-400 to-blue-400 text-[#070a13] font-bold rounded-xl shadow-lg shadow-purple-500/20 hover:opacity-95 hover:shadow-purple-500/35 transition-all active:scale-[0.98] inline-flex items-center justify-center gap-2 group ${className}`}
    >
      {t('landing_trial_button')}
      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#070a13] text-gray-100 font-sans antialiased overflow-x-hidden selection:bg-purple-500 selection:text-[#070a13]">

      {/* Background Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[20%] w-[60%] h-[80%] bg-gradient-to-tr from-purple-500/10 to-blue-500/5 rounded-full blur-[120px] opacity-75" />
        <div className="absolute top-[20%] right-[10%] w-[40%] h-[60%] bg-purple-600/5 rounded-full blur-[100px] opacity-50" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md border-b border-gray-900 bg-[#070a13]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <img src={logoMark} alt="GoCustify logo" className="w-9 h-9 rounded-lg shadow-lg shadow-purple-500/20" />
            <span className="text-xl font-bold tracking-tight text-white bg-clip-text">GoCustify</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-400">
            <a href="#journey" className="hover:text-white transition-colors">{t('nav_how_it_works')}</a>
            <a href="#features" className="hover:text-white transition-colors">{t('nav_features')}</a>
            <a href="#pricing" className="hover:text-white transition-colors">{t('nav_pricing')}</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 text-sm font-semibold text-gray-300 hover:text-white border border-gray-800 hover:border-gray-700 rounded-xl transition-all"
            >
              {t('nav_login')}
            </button>
            <button
              onClick={() => navigate('/subscription')}
              className="px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-purple-400 to-blue-400 text-[#070a13] rounded-xl hover:opacity-90 transition-all shadow-lg shadow-purple-500/10 hover:shadow-purple-500/25 active:scale-[0.98]"
            >
              {t('nav_start_trial')}
            </button>
          </div>

          {/* Mobile menu toggle */}
          <div className="flex md:hidden items-center gap-2">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 rounded-xl transition-colors cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="md:hidden border-b border-gray-800 bg-[#070a13]/95 backdrop-blur-xl px-6 py-6 space-y-6 overflow-hidden"
            >
              <nav className="flex flex-col space-y-4 text-base font-semibold text-gray-300">
                <a
                  href="#journey"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-purple-400 transition-colors py-1"
                >
                  {t('nav_how_it_works')}
                </a>
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-purple-400 transition-colors py-1"
                >
                  {t('nav_features')}
                </a>
                <a
                  href="#pricing"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-purple-400 transition-colors py-1"
                >
                  {t('nav_pricing')}
                </a>
              </nav>

              <div className="pt-4 border-t border-gray-800 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full py-3 text-center text-sm font-semibold text-gray-200 border border-gray-800 hover:border-gray-700 rounded-xl transition-colors"
                >
                  {t('nav_login')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/subscription');
                  }}
                  className="w-full py-3 text-center text-sm font-bold bg-gradient-to-r from-purple-400 to-blue-400 text-[#070a13] rounded-xl shadow-lg shadow-purple-500/10 hover:opacity-95 transition-opacity"
                >
                  {t('nav_start_trial')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Hero Section */}
      <section className="relative pt-8 pb-16 sm:pt-12 sm:pb-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">

          {/* Left Text */}
          <div className="lg:col-span-7 flex flex-col items-start text-left space-y-6 sm:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/20 text-purple-400 text-xs font-semibold uppercase tracking-wider"
            >
              <Sparkles size={12} className="animate-pulse" /> {t('landing_hero_badge')}
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.15] text-white"
            >
              {t('landing_hero_title_1')} <br />
              <span className="bg-gradient-to-r from-purple-400 via-blue-300 to-purple-400 bg-clip-text text-transparent">
                {t('landing_hero_title_2')}
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-base sm:text-lg md:text-xl text-gray-400 max-w-xl font-normal leading-relaxed"
            >
              {t('landing_hero_description')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto"
            >
              <TrialButton className="w-full sm:w-auto" />
              <a
                href="#journey"
                className="px-8 py-4 bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 font-bold rounded-xl text-white transition-all text-center w-full sm:w-auto"
              >
                {t('landing_hero_secondary_cta')}
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.45 }}
              className="text-xs text-gray-600 font-semibold uppercase tracking-wider"
            >
              {t('landing_hero_trial_note')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="flex flex-col sm:flex-row flex-wrap gap-3 w-full sm:w-auto"
            >
              <StoreBadge icon={Apple} eyebrow={t('app_store_eyebrow')} label={t('app_store_label')} compact t={t} />
              <StoreBadge icon={Play} eyebrow={t('play_store_eyebrow')} label={t('play_store_label')} compact t={t} />
            </motion.div>
          </div>

          {/* Right Visual (Glowing 3D Mesh & Floating Labels) */}
          <div className="lg:col-span-5 relative flex items-center justify-center mt-6 lg:mt-0">

            {/* Ambient Backlight */}
            <div className="absolute w-64 h-64 sm:w-80 sm:h-80 bg-gradient-to-tr from-cyan-500/25 to-purple-500/25 rounded-full blur-[80px] sm:blur-[100px] -z-10 animate-pulse" />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative w-full max-w-[320px] sm:max-w-[400px] aspect-square rounded-full flex items-center justify-center"
            >
              <img
                src={heroImage}
                alt="GoCustify AI Graphic"
                className="w-full h-full object-contain filter drop-shadow-[0_0_50px_rgba(6,182,212,0.15)]"
              />

              {/* Floating Tag 1: Call Answered */}
              <motion.div
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute top-2 sm:top-12 left-0 sm:-left-8 px-3 sm:px-4 py-2 sm:py-3 bg-[#0d1222]/90 backdrop-blur-md border border-gray-800 rounded-xl flex items-center gap-2.5 sm:gap-3 shadow-xl"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-950 flex items-center justify-center text-purple-400 shrink-0">
                  <PhoneCall size={14} className="sm:hidden" />
                  <PhoneCall size={16} className="hidden sm:block" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('landing_tag_receptionist_label')}</p>
                  <p className="text-[11px] sm:text-xs font-bold text-white">{t('landing_tag_receptionist_value')}</p>
                </div>
              </motion.div>

              {/* Floating Tag 2: Invoice Paid */}
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                className="absolute bottom-14 sm:bottom-20 right-0 sm:-right-8 px-3 sm:px-4 py-2 sm:py-3 bg-[#0d1222]/90 backdrop-blur-md border border-gray-800 rounded-xl flex items-center gap-2.5 sm:gap-3 shadow-xl"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-950 flex items-center justify-center text-purple-400 shrink-0">
                  <CreditCard size={14} className="sm:hidden" />
                  <CreditCard size={16} className="hidden sm:block" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('landing_tag_invoicing_label')}</p>
                  <p className="text-[11px] sm:text-xs font-bold text-white">{t('landing_tag_invoicing_value')}</p>
                </div>
              </motion.div>

              {/* Floating Tag 3: AI Replied */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="absolute -bottom-2 sm:-bottom-4 left-4 sm:left-10 px-3 sm:px-4 py-2 sm:py-3 bg-[#0d1222]/90 backdrop-blur-md border border-gray-800 rounded-xl flex items-center gap-2.5 sm:gap-3 shadow-xl"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-950 flex items-center justify-center text-purple-400 shrink-0">
                  <Bot size={14} className="sm:hidden" />
                  <Bot size={16} className="hidden sm:block" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('landing_tag_inbox_label')}</p>
                  <p className="text-[11px] sm:text-xs font-bold text-white">{t('landing_tag_inbox_value')}</p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Demo Video Section */}
      <section className="pb-16 sm:pb-24 md:pb-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8 sm:mb-10 space-y-3">
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              {t('landing_demo_title')}
            </h2>
            <p className="text-sm sm:text-base text-gray-400 max-w-xl mx-auto">
              {t('landing_demo_description')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="group relative w-full aspect-video rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-800 hover:border-purple-500/40 transition-all shadow-2xl shadow-black/40 cursor-pointer"
          >
            <img
              src={heroImage}
              alt="GoCustify product demo"
              className="w-full h-full object-cover opacity-40 group-hover:opacity-50 transition-opacity"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#070a13]/40 via-[#070a13]/60 to-[#070a13]/80" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-purple-400 text-[#02080B] flex items-center justify-center shadow-xl shadow-purple-500/30 group-hover:scale-110 transition-transform">
                <Play size={20} fill="currentColor" className="sm:hidden ml-0.5" />
                <Play size={28} fill="currentColor" className="hidden sm:block ml-1" />
              </div>
            </div>
            <span className="absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-300">
              {t('landing_demo_watch')}
            </span>
          </button>
        </div>
      </section>

      {/* Video Modal */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm px-4"
            onClick={() => setVideoOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="relative w-full max-w-4xl aspect-video bg-[#0a0e1a] rounded-2xl overflow-hidden border border-gray-800"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setVideoOpen(false)}
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
              {DEMO_VIDEO_EMBED_URL ? (
                <iframe
                  src={DEMO_VIDEO_EMBED_URL}
                  title="GoCustify demo video"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
                  <div className="w-16 h-16 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600">
                    <Play size={22} fill="currentColor" />
                  </div>
                  <p className="text-gray-400 font-semibold">{t('landing_demo_coming_soon')}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Bar */}
      <section className="border-y border-gray-900 bg-[#0a0e1a]/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center space-y-1 sm:space-y-2">
              <p className="text-2xl sm:text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-purple-400 to-blue-300 bg-clip-text text-transparent">
                {stat.value}
              </p>
              <p className="text-[11px] sm:text-xs md:text-sm text-gray-500 font-medium leading-snug max-w-[200px] mx-auto">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works (Capture → Engage → Close → Grow) */}
      <section id="journey" className="py-16 sm:py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-14 sm:space-y-20 md:space-y-28">
          <div className="text-center space-y-3 sm:space-y-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {t('landing_journey_title')}
            </h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto font-normal">
              {t('landing_journey_subtitle')}
            </p>
          </div>

          <div className="space-y-14 sm:space-y-20 md:space-y-28">
            {journeyTabs.map((step, index) => {
              const reversed = index % 2 === 1;
              return (
                <motion.div
                  key={step.id}
                  variants={itemVariants}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: '-100px' }}
                  className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 items-center"
                >
                  <div className={`space-y-5 sm:space-y-6 text-left ${reversed ? 'lg:order-2' : 'lg:order-1'}`}>
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-purple-400 to-blue-400 text-[#070a13] font-extrabold flex items-center justify-center text-xs sm:text-sm shrink-0">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-purple-400">
                        <step.icon size={13} /> {step.label}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
                      {step.description}
                    </p>
                    <ul className="space-y-2.5 sm:space-y-3">
                      {step.bullets.map((bullet) => (
                        <li key={bullet} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-gray-300">
                          <span className="mt-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-950 border border-purple-500/30 flex items-center justify-center shrink-0">
                            <Check size={11} className="text-purple-400" />
                          </span>
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Illustrative panel */}
                  <div className={`relative flex items-center justify-center py-2 sm:py-4 ${reversed ? 'lg:order-1' : 'lg:order-2'}`}>
                    <div className="absolute w-48 h-48 sm:w-56 sm:h-56 bg-purple-500/10 rounded-full blur-[60px] sm:blur-[70px] -z-0" />
                    <div className="relative z-10 w-full max-w-sm bg-[#0d1222]/90 backdrop-blur-md border border-gray-800 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-3 sm:space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-950 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                          <step.panel.icon size={18} />
                        </div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          {step.panel.eyebrow}
                        </p>
                      </div>
                      <p className="text-base sm:text-lg font-bold text-white">{step.panel.headline}</p>
                      <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{step.panel.detail}</p>
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-800">
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        <p className="text-[10px] sm:text-[11px] font-semibold text-purple-400">{t('landing_automatic_handle') || 'Handled automatically by GoCustify AI'}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center pt-4">
            <TrialButton className="w-full sm:w-auto" />
          </div>
        </div>
      </section>

      {/* Pain Point Section */}
      <section className="py-14 sm:py-20 border-t border-gray-950 bg-gradient-to-b from-[#070a13] to-[#0a0e1a]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6 sm:space-y-8">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            {t('landing_pain_title')}
          </h2>
          <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto font-normal leading-relaxed">
            {t('landing_pain_description')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 pt-2 sm:pt-4">
            {[t('landing_pain_tag_1'), t('landing_pain_tag_2'), t('landing_pain_tag_3'), t('landing_pain_tag_4')].map((pain) => (
              <span
                key={pain}
                className="px-4 sm:px-5 py-2 border border-rose-500/20 bg-rose-950/10 text-rose-400 rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-lg shadow-rose-950/5 cursor-default hover:border-rose-500/35 transition-colors"
              >
                <span className="text-rose-500">✕</span> {pain}
              </span>
            ))}
          </div>

          <p className="text-xs sm:text-sm font-bold text-purple-400 uppercase tracking-widest pt-2">
            {t('landing_pain_footer')}
          </p>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-16 sm:py-24 md:py-32 bg-[#0a0e1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12 sm:space-y-16">

          <div className="text-center space-y-3 sm:space-y-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {t('landing_features_title')}
            </h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto font-normal">
              {t('landing_features_subtitle')}
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8"
          >
            {bentoCards.map((card, i) => (
              <motion.div
                key={i}
                variants={itemVariants}
                whileHover={{ y: -6 }}
                onClick={() => navigate('/login')}
                className="group relative bg-[#111625]/40 backdrop-blur-xl border border-gray-900 hover:border-purple-500/40 p-6 sm:p-8 rounded-3xl cursor-pointer transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)] flex flex-col justify-between min-h-[250px] md:h-72"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/0 to-purple-500/5 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-300" />

                <div>
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gray-900 border border-gray-800 rounded-2xl flex items-center justify-center text-purple-400 group-hover:text-purple-300 group-hover:border-purple-500/30 transition-colors">
                    <card.icon size={22} />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-white mt-5 sm:mt-6 group-hover:text-purple-300 transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-400 mt-2.5 sm:mt-3 font-normal leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-purple-400 group-hover:text-purple-300 mt-5 sm:mt-6 select-none">
                  {t('landing_explore')} <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 sm:py-24 md:py-32 border-t border-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-12 sm:space-y-16">
          <div className="text-center space-y-3 sm:space-y-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {t('landing_pricing_title')}
            </h2>
            <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto font-normal">
              {t('landing_pricing_subtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-stretch">
            {pricingPlans.map((plan) => (
              <div
                key={plan.key}
                className={`relative flex flex-col rounded-3xl p-6 sm:p-8 border transition-all duration-300 ${
                  plan.isPopular
                    ? 'bg-[#0d1626] border-purple-500/40 shadow-[0_0_40px_-10px_rgba(6,182,212,0.25)] my-3 md:my-0 md:-translate-y-3'
                    : 'bg-[#111625]/40 border-gray-900 hover:border-gray-700'
                }`}
              >
                {plan.isPopular && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-400 to-blue-400 text-[#070a13] text-[11px] font-extrabold uppercase tracking-wider rounded-full shadow-lg shadow-purple-500/25">
                    {t('landing_most_popular')}
                  </span>
                )}

                <div className="space-y-2">
                  <h3 className="text-base sm:text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-gray-500 font-medium">{plan.subtitle}</p>
                  <p className="pt-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white">{plan.price}</span>
                    <span className="text-xs sm:text-sm text-gray-500 font-medium"> {t('landing_per_month')}</span>
                  </p>
                </div>

                <ul className="space-y-2.5 sm:space-y-3 mt-6 sm:mt-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-gray-300">
                      <span className="mt-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-950 border border-purple-500/30 flex items-center justify-center shrink-0">
                        <Check size={11} className="text-purple-400" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate('/subscription')}
                  className="mt-6 sm:mt-8 w-full px-6 py-3.5 font-bold rounded-xl transition-all active:scale-[0.98] bg-gradient-to-r from-purple-400 to-blue-400 text-[#070a13] shadow-lg shadow-purple-500/20 hover:opacity-95 cursor-pointer"
                >
                  {t('nav_start_trial')}
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-600 font-medium">
            {t('landing_pricing_footnote')}
          </p>
        </div>
      </section>

      {/* Trust strip */}
      <section className="py-10 sm:py-14 border-t border-gray-950 bg-[#0a0e1a]/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 text-center">
          <div className="flex flex-col items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-purple-400">
              <Lock size={18} className="sm:hidden" />
              <Lock size={20} className="hidden sm:block" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-white">{t('trust_1_title')}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed max-w-[240px]">
              {t('trust_1_description')}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-purple-400">
              <Users size={18} className="sm:hidden" />
              <Users size={20} className="hidden sm:block" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-white">{t('trust_2_title')}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed max-w-[240px]">
              {t('trust_2_description')}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2.5 sm:gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-purple-400">
              <CalendarClock size={18} className="sm:hidden" />
              <CalendarClock size={20} className="hidden sm:block" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-white">{t('trust_3_title')}</p>
            <p className="text-[11px] sm:text-xs text-gray-500 leading-relaxed max-w-[240px]">
              {t('trust_3_description')}
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 md:py-32 relative bg-gradient-to-b from-[#0a0e1a] to-[#070a13] border-t border-gray-950">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 sm:w-96 h-72 sm:h-96 bg-purple-500/5 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none -z-10" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-6 sm:space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/20 text-purple-400 text-xs font-semibold uppercase tracking-wider mx-auto">
            <Megaphone size={12} /> {t('landing_cta_badge')}
          </div>
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {t('landing_cta_title')}
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto font-normal leading-relaxed">
            {t('landing_cta_description')}
          </p>
          <div className="pt-2 sm:pt-4">
            <TrialButton className="w-full sm:w-auto" />
          </div>

          <div className="pt-4 sm:pt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-600">{t('landing_cta_mobile_label')}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <StoreBadge icon={Apple} eyebrow={t('app_store_eyebrow')} label={t('app_store_label')} t={t} />
              <StoreBadge icon={Play} eyebrow={t('play_store_eyebrow')} label={t('play_store_label')} t={t} />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-950 bg-[#05070d] py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          {/* Contact Us */}
          <div className="mb-12 sm:mb-16 rounded-3xl border border-gray-800 bg-gradient-to-b from-gray-900/60 to-[#070a13] p-5 sm:p-8">
            <div className="mx-auto max-w-xl text-center mb-6 sm:mb-8">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300">
                <Mail size={22} />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">{t('footer_contact_heading')}</h2>
              <p className="mt-2 text-xs sm:text-sm text-gray-400">{t('footer_contact_subheading')}</p>
            </div>

            {footerContactSubmitted ? (
              <div className="mx-auto max-w-md text-center py-6">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-900/30">
                  <CheckCircle className="text-purple-400" size={28} />
                </div>
                <h3 className="mb-2 text-base sm:text-lg font-bold text-white">{t('footer_contact_success_title')}</h3>
                <p className="mb-6 text-xs sm:text-sm text-gray-400">{t('footer_contact_success_desc')}</p>
                <button
                  type="button"
                  onClick={() => setFooterContactSubmitted(false)}
                  className="rounded-xl border border-gray-700 bg-transparent px-5 py-2.5 text-xs sm:text-sm font-semibold text-gray-300 transition-colors hover:bg-gray-800 hover:text-white cursor-pointer"
                >
                  {t('footer_contact_btn_send_another')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleFooterContactSubmit} className="mx-auto max-w-2xl space-y-3.5 sm:space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                      {t('footer_contact_lbl_first_name')}
                    </label>
                    <input
                      type="text"
                      value={footerContactForm.firstName}
                      onChange={(e) => setFooterContactForm((current) => ({ ...current, firstName: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60"
                      placeholder={t('footer_contact_ph_first_name')}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                      {t('footer_contact_lbl_last_name')}
                    </label>
                    <input
                      type="text"
                      value={footerContactForm.lastName}
                      onChange={(e) => setFooterContactForm((current) => ({ ...current, lastName: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60"
                      placeholder={t('footer_contact_ph_last_name')}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                      {t('footer_contact_lbl_phone')}
                    </label>
                    <input
                      type="tel"
                      value={footerContactForm.phoneNumber}
                      onChange={(e) => setFooterContactForm((current) => ({ ...current, phoneNumber: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60"
                      placeholder={t('footer_contact_ph_phone')}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                      {t('footer_contact_lbl_email')}
                    </label>
                    <input
                      type="email"
                      value={footerContactForm.email}
                      onChange={(e) => setFooterContactForm((current) => ({ ...current, email: e.target.value }))}
                      className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60"
                      placeholder={t('footer_contact_ph_email')}
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-[0.18em] text-gray-500">
                    {t('footer_contact_lbl_message')}
                  </label>
                  <textarea
                    value={footerContactForm.message}
                    onChange={(e) => setFooterContactForm((current) => ({ ...current, message: e.target.value }))}
                    rows={4}
                    className="w-full rounded-2xl border border-gray-800 bg-[#0c1525] px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-white outline-none transition focus:border-purple-500/60 resize-none"
                    placeholder={t('footer_contact_ph_message')}
                  />
                </div>

                {footerContactError ? (
                  <p className="text-xs sm:text-sm text-rose-400">{footerContactError}</p>
                ) : null}

                <div className="flex justify-center pt-1 sm:pt-2">
                  <button
                    type="submit"
                    disabled={footerContactSubmitting}
                    className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-400 to-blue-400 px-10 py-3 text-sm font-bold tracking-wide text-[#070a13] transition-all active:scale-[0.98] hover:shadow-lg hover:shadow-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {footerContactSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        {t('footer_contact_sending')}
                      </>
                    ) : (
                      t('footer_contact_btn_send')
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">

            <div className="flex items-center gap-2">
              <img src={logoMark} alt="GoCustify logo" className="w-8 h-8 rounded-lg" />
              <span className="text-lg font-bold text-white">GoCustify LLC</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 text-xs font-semibold text-gray-500">
              <a href="#journey" className="hover:text-gray-300 transition-colors">{t('nav_how_it_works')}</a>
              <a href="#features" className="hover:text-gray-300 transition-colors">{t('nav_features')}</a>
              <a href="#pricing" className="hover:text-gray-300 transition-colors">{t('nav_pricing')}</a>
              <button type="button" onClick={() => navigate('/privacy-policy')} className="hover:text-gray-300 transition-colors cursor-pointer">{t('footer_privacy')}</button>
              <button type="button" onClick={() => navigate('/sms-messaging-policy')} className="hover:text-gray-300 transition-colors cursor-pointer">{t('footer_sms_policy')}</button>
              <button type="button" onClick={() => navigate('/terms-and-conditions')} className="hover:text-gray-300 transition-colors cursor-pointer">{t('footer_terms')}</button>
              <button type="button" onClick={() => navigate('/acceptable-use-policy')} className="hover:text-gray-300 transition-colors cursor-pointer">{t('footer_acceptable_use')}</button>
              <button type="button" onClick={() => navigate('/refund-policy')} className="hover:text-gray-300 transition-colors cursor-pointer">{t('footer_refund_policy')}</button>
              <button type="button" onClick={() => navigate('/protocols-for-law-enforcement')} className="hover:text-gray-300 transition-colors cursor-pointer">{t('footer_law_enforcement')}</button>
            </div>

            <p className="text-xs text-gray-600 text-center md:text-right">
              {t('footer_copyright_long')}
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
