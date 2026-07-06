const fs = require('fs');
const path = require('path');

const src = fs.readFileSync('src/pages/Profile/index.jsx', 'utf8');

// We will split the file by regex `// ── `
const parts = src.split(/\/\/\s*──\s*/);

let imports = parts[0];
// fix imports for relative path
imports = imports.replace(/\'\.\.\/api/g, "'../../api");
imports = imports.replace(/\'\.\.\/store/g, "'../../store");

// Export shared components in a new file
const sharedContent = `import { Loader2 } from 'lucide-react';
export const INPUT = 'w-full px-4 py-3 bg-[#0A1019] border border-[#243246] text-white rounded-xl outline-none focus:border-[#11C7E5]/50 transition-colors text-sm placeholder:text-[#4A5568]';
export const LABEL = 'block text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1.5';
export function Field({ label, children }) { return <div><label className={LABEL}>{label}</label>{children}</div>; }
export function Badge({ children, color='cyan' }) {
  const p = { cyan:'bg-[#11C7E5]/10 text-[#11C7E5] border-[#11C7E5]/20', green:'bg-emerald-950/30 text-emerald-400 border-emerald-500/20', yellow:'bg-amber-950/30 text-amber-400 border-amber-500/20', red:'bg-rose-950/30 text-rose-400 border-rose-500/20' };
  return <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border \${p[color]}\`}>{children}</span>;
}
export function StatCard({ label, value, sub, icon: Icon, accent='#11C7E5' }) {
  return (
    <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 flex items-start gap-4">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{background:\`\${accent}18\`}}>
        <Icon size={20} style={{color:accent}}/>
      </div>
      <div>
        <p className="text-[#A4B0B7] text-xs">{label}</p>
        <p className="text-2xl font-black text-white mt-0.5">{value}</p>
        {sub && <p className="text-[#A4B0B7] text-xs mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
`;

fs.writeFileSync('src/pages/Profile/shared.jsx', sharedContent);

let newIndexContent = `import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Building2, Bell, CreditCard, Mic, TrendingUp, LifeBuoy, Cpu, Shield, Calendar } from 'lucide-react';
`;

let tabImports = [];
let tabExports = {};

for (let i = 1; i < parts.length; i++) {
  const lines = parts[i].split('\n');
  const title = lines[0].replace(/─/g, '').trim();
  const body = lines.slice(1).join('\n');
  
  if (title === 'Main') {
    // This is the index.jsx content
    let mainBody = body.replace('export default function Settings', 'export default function Profile');
    
    // Replace components map
    mainBody = mainBody.replace(/const components = \{[\s\S]*?\};/, `const components = {
    profile: ProfileTab,
    business: BusinessProfileTab,
    notifications: NotificationsTab,
    subscription: SubscriptionTab,
    voice: VoiceHistoryTab,
    earnings: EarningsTab,
    hosted: HostedEventsTab,
    privacy: PrivacySupportTab,
    ai: AIConfigTab,
    security: SecurityTab,
  };`);

    // Add calendar to tabs and update names
    mainBody = mainBody.replace(/const tabs = \[.*?\];/s, `const tabs = [
  { id: 'profile',        label: 'Profile',          icon: User },
  { id: 'business',       label: 'Business Profile',  icon: Building2 },
  { id: 'notifications',  label: 'Notifications',    icon: Bell },
  { id: 'subscription',   label: 'Subscription',      icon: CreditCard },
  { id: 'voice',          label: 'Voice History',     icon: Mic },
  { id: 'earnings',       label: 'Earnings',          icon: TrendingUp },
  { id: 'hosted',         label: 'Hosted Events',     icon: Calendar },
  { id: 'privacy',        label: 'Privacy & Support', icon: LifeBuoy },
  { id: 'ai',             label: 'AI Config',         icon: Cpu },
  { id: 'security',       label: 'Security',          icon: Shield },
];`);

    newIndexContent += mainBody;
  } else {
    // It's a tab
    let componentNameMatch = body.match(/function\s+(\w+Tab)/);
    if (!componentNameMatch) continue;
    let componentName = componentNameMatch[1];
    
    let originalImports = `import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, Camera, CheckCircle2, ChevronDown, ChevronUp, 
  CreditCard, Cpu, Globe, Key, LifeBuoy, Loader2, LogOut, Mail, Mic, 
  Phone, Play, Save, Shield, Trash2, TrendingUp, Upload, User, Lock,
  ArrowUpRight, Wallet, Clock, DollarSign, Bell, Eye, EyeOff, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../../api/services';
import { useAuthStore } from '../../store/useAuthStore';
import { INPUT, LABEL, Field, Badge, StatCard } from '../shared';
`;

    let fileBody = body;
    // specific rename for BillingTab -> SubscriptionTab
    if (componentName === 'BillingTab') {
        componentName = 'SubscriptionTab';
        fileBody = fileBody.replace(/function BillingTab/, 'function SubscriptionTab');
    }
    // specific rename for SupportTab -> PrivacySupportTab
    if (componentName === 'SupportTab') {
        componentName = 'PrivacySupportTab';
        fileBody = fileBody.replace(/function SupportTab/, 'function PrivacySupportTab');
    }

    const tabFileName = `src/pages/Profile/tabs/${componentName}.jsx`;
    const tabFileContent = originalImports + '\n' + fileBody + `\nexport default ${componentName};\n`;
    fs.writeFileSync(tabFileName, tabFileContent);
    
    tabImports.push(`import ${componentName} from './tabs/${componentName}';`);
  }
}

// Write the mock tabs for HostedEvents
const hostedContent = `import { useState } from 'react';
import { Calendar } from 'lucide-react';
export default function HostedEventsTab() {
  return (
    <div className="space-y-6">
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Calendar size={16} className="text-[#11C7E5]"/>Hosted Events & Activities</h3>
        <p className="text-[#A4B0B7] text-sm">Manage your created events and track participants here.</p>
        <div className="p-12 text-center text-[#A4B0B7] border border-dashed border-[#243041] rounded-xl">No events hosted yet.</div>
      </div>
    </div>
  );
}`;
fs.writeFileSync('src/pages/Profile/tabs/HostedEventsTab.jsx', hostedContent);
tabImports.push(`import HostedEventsTab from './tabs/HostedEventsTab';`);


const finalIndexContent = `import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Building2, Bell, CreditCard, Mic, TrendingUp, LifeBuoy, Cpu, Shield, Calendar } from 'lucide-react';

${tabImports.join('\n')}

${newIndexContent.substring(newIndexContent.indexOf('export default function Profile'))}`;

fs.writeFileSync('src/pages/Profile/index.jsx', finalIndexContent);
