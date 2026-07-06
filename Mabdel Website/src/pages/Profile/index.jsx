import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Building2, Bell, CreditCard, Mic, TrendingUp, LifeBuoy, Cpu, Shield, Calendar } from 'lucide-react';

import ProfileTab from './tabs/ProfileTab';
import BusinessProfileTab from './tabs/BusinessProfileTab';
import VoiceHistoryTab from './tabs/VoiceHistoryTab';
import EarningsTab from './tabs/EarningsTab';
import NotificationsTab from './tabs/NotificationsTab';
import SubscriptionTab from './tabs/SubscriptionTab';
import PrivacyTab from './tabs/PrivacyTab';
import SupportTab from './tabs/SupportTab';
import AIConfigTab from './tabs/AIConfigTab';
import SecurityTab from './tabs/SecurityTab';
import HostedEventsTab from './tabs/HostedEventsTab';
import EventParticipantsTab from './tabs/EventParticipantsTab';
import AddBankTab from './tabs/AddBankTab';

export default function Profile() {
  const [active, setActive] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Personal Info', icon: User },
    { id: 'business', label: 'Business Profile', icon: Building2 },
    { id: 'bank', label: 'Bank Accounts', icon: CreditCard },
    { id: 'earnings', label: 'Earnings', icon: TrendingUp },
    { id: 'hosted', label: 'Hosted Events', icon: Calendar },
    { id: 'participants', label: 'Event Participants', icon: Calendar },
    { id: 'subscription', label: 'Subscription', icon: CreditCard },
    { id: 'voice', label: 'Voice History', icon: Mic },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'support', label: 'Support', icon: LifeBuoy },
    { id: 'ai', label: 'AI Configuration', icon: Cpu },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  const components = {
    profile: ProfileTab,
    business: BusinessProfileTab,
    bank: AddBankTab,
    notifications: NotificationsTab,
    subscription: SubscriptionTab,
    voice: VoiceHistoryTab,
    earnings: EarningsTab,
    hosted: HostedEventsTab,
    participants: EventParticipantsTab,
    privacy: PrivacyTab,
    support: SupportTab,
    ai: AIConfigTab,
    security: SecurityTab,
  };

  const ActiveComponent = components[active] || ProfileTab;

  return (
    <div className="space-y-6">
      <div className="border-b border-[#243041]/40 pb-4 text-left">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Settings</h1>
        <p className="text-[#A4B0B7] text-xs mt-1">Manage your profile, business, security, and integrations.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-56 shrink-0">
          <nav className="bg-[#131A24] border border-[#243041] rounded-2xl p-2 space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={()=>setActive(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left ${active===tab.id ? 'bg-[#11C7E5]/10 text-white border border-[#11C7E5]/20' : 'text-[#A4B0B7] hover:bg-slate-900/40 hover:text-white border border-transparent'}`}>
                  <Icon size={15} className={active===tab.id ? 'text-[#11C7E5]' : ''}/>
                  {tab.label}
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
