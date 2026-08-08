import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Building2, Bell, CreditCard, Mic, LifeBuoy, Cpu, Shield } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { useAuthStore } from '../../store/useAuthStore';

import ProfileTab from './tabs/ProfileTab';
import BusinessProfileTab from './tabs/BusinessProfileTab';
import VoiceHistoryTab from './tabs/VoiceHistoryTab';
import NotificationsTab from './tabs/NotificationsTab';
import SubscriptionTab from './tabs/SubscriptionTab';
import SupportTab from './tabs/SupportTab';
import AIConfigTab from './tabs/AIConfigTab';
import SecurityTab from './tabs/SecurityTab';
import AccountSettingsTab from './tabs/AccountSettingsTab';

export default function Profile() {
  const { t } = useLanguage();
  const location = useLocation();
  const [active, setActive] = useState('profile');
  const { user } = useAuthStore();

  const isOwner = user?.role === 'owner' || user?.primary_role === 'owner';

  const tabs = [
    { id: 'profile', labelKey: 'prof_tab_personal', icon: User },
    { id: 'business', labelKey: 'prof_tab_business', icon: Building2 },
    ...(isOwner ? [{ id: 'subscription', labelKey: 'prof_tab_subscription', icon: CreditCard }] : []),
    { id: 'voice', labelKey: 'prof_tab_voice', icon: Mic },
    { id: 'notifications', labelKey: 'prof_tab_notifications', icon: Bell },
    { id: 'account', labelKey: 'prof_tab_account', icon: Shield },
    { id: 'support', labelKey: 'prof_tab_support', icon: LifeBuoy },
    { id: 'ai', labelKey: 'prof_tab_ai', icon: Cpu },
    { id: 'security', labelKey: 'prof_tab_security', icon: Shield },
  ];

  const components = {
    profile: ProfileTab,
    business: BusinessProfileTab,
    notifications: NotificationsTab,
    subscription: SubscriptionTab,
    voice: VoiceHistoryTab,
    account: AccountSettingsTab,
    support: SupportTab,
    ai: AIConfigTab,
    security: SecurityTab,
  };

  const ActiveComponent = components[active] || ProfileTab;

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');
    if (!requestedTab) return;

    if (requestedTab === 'voice-history') {
      setActive('voice');
      return;
    }

    if (requestedTab in components) {
      setActive(requestedTab);
    }
  }, [location.search]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[#243041]/40 pb-4 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{t('prof_title')}</h1>
        <p className="text-[#A4B0B7] text-xs mt-1">{t('prof_subtitle')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 shrink-0">
          <nav className="bg-[#131A24] border border-[#243041] rounded-2xl p-2 space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={()=>setActive(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left ${active===tab.id ? 'bg-[#9333ea]/10 text-white border border-[#9333ea]/20' : 'text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border border-transparent'}`}>
                  <Icon size={15} className={active===tab.id ? 'text-[#9333ea]' : ''}/>
                  {t(tab.labelKey)}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-6 text-left">
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.15}}>
                <ActiveComponent/>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
