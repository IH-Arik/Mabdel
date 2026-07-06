import { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function PrivacyTab() {
  const [settings, setSettings] = useState({
    profileVisibility: 'public',
    showActivity: true,
    dataCollection: true,
    twoFactor: false
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Shield className="text-blue-400" /> Privacy & Data
        </h2>
        <p className="text-sm text-slate-400 mt-1">Manage who can see your profile and how your data is used.</p>
      </div>

      <div className="bg-[#131A24] border border-[#243041] rounded-2xl p-6 space-y-6">
        
        {/* Profile Visibility */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Profile Visibility</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button 
              onClick={() => setSettings({...settings, profileVisibility: 'public'})}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.profileVisibility === 'public' ? 'bg-blue-500/10 border-blue-500/50 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
            >
              <Eye size={24} className={settings.profileVisibility === 'public' ? 'text-blue-400' : ''} />
              <span className="font-semibold text-sm">Public</span>
              <span className="text-xs text-center opacity-70">Anyone can see your profile and hosted events.</span>
            </button>
            <button 
              onClick={() => setSettings({...settings, profileVisibility: 'private'})}
              className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.profileVisibility === 'private' ? 'bg-blue-500/10 border-blue-500/50 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
            >
              <EyeOff size={24} className={settings.profileVisibility === 'private' ? 'text-blue-400' : ''} />
              <span className="font-semibold text-sm">Private</span>
              <span className="text-xs text-center opacity-70">Only you can see your profile details.</span>
            </button>
          </div>
        </div>

        <hr className="border-[#243041]" />

        {/* Toggles */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Data & Security</h3>
          
          <label className="flex items-center justify-between cursor-pointer p-3 hover:bg-slate-900/50 rounded-xl transition-colors">
            <div>
              <p className="text-white font-semibold text-sm">Show Activity Status</p>
              <p className="text-slate-400 text-xs">Let others know when you are online.</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings.showActivity ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" animate={{ x: settings.showActivity ? 24 : 0 }} />
            </div>
            {/* hidden checkbox */}
            <input type="checkbox" className="hidden" checked={settings.showActivity} onChange={e => setSettings({...settings, showActivity: e.target.checked})} />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-3 hover:bg-slate-900/50 rounded-xl transition-colors">
            <div>
              <p className="text-white font-semibold text-sm">Data Collection & Analytics</p>
              <p className="text-slate-400 text-xs">Allow Mabdel AI to collect usage data to improve services.</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings.dataCollection ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" animate={{ x: settings.dataCollection ? 24 : 0 }} />
            </div>
            <input type="checkbox" className="hidden" checked={settings.dataCollection} onChange={e => setSettings({...settings, dataCollection: e.target.checked})} />
          </label>

          <label className="flex items-center justify-between cursor-pointer p-3 hover:bg-slate-900/50 rounded-xl transition-colors">
            <div>
              <p className="text-white font-semibold text-sm flex items-center gap-2">Two-Factor Authentication <Lock size={14} className="text-emerald-400"/></p>
              <p className="text-slate-400 text-xs">Require an extra security code when logging in.</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${settings.twoFactor ? 'bg-blue-600' : 'bg-slate-700'}`}>
              <motion.div layout className="w-4 h-4 rounded-full bg-white shadow-sm" animate={{ x: settings.twoFactor ? 24 : 0 }} />
            </div>
            <input type="checkbox" className="hidden" checked={settings.twoFactor} onChange={e => setSettings({...settings, twoFactor: e.target.checked})} />
          </label>
        </div>

        <div className="pt-4 flex justify-end">
          <button className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
            <CheckCircle2 size={16} /> Save Privacy Settings
          </button>
        </div>
      </div>
      
      {/* Danger Zone */}
      <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6">
        <h3 className="text-rose-400 font-bold text-sm uppercase tracking-wider mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Danger Zone</h3>
        <p className="text-slate-400 text-sm mb-4">Once you delete your account, there is no going back. Please be certain.</p>
        <button className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold rounded-xl border border-rose-500/20 transition-colors text-sm">
          Delete Account
        </button>
      </div>

    </div>
  );
}
