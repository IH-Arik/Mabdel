import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, Building2, Camera, CheckCircle2, ChevronDown, ChevronUp, 
  CreditCard, Cpu, Globe, Key, LifeBuoy, Loader2, LogOut, Mail, Mic, 
  Phone, Play, Save, Shield, Trash2, TrendingUp, Upload, User, Lock,
  ArrowUpRight, Wallet, Clock, DollarSign, Bell, Eye, EyeOff, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { smartflowApi } from '../../../api/services';
import { useAuthStore } from '../../../store/useAuthStore';
import { INPUT, LABEL, Field, Badge, StatCard } from '../shared';
import { AI_LANGUAGE_OPTIONS, getStoredAiLanguage, setStoredAiLanguage } from '../../../utils/voiceAgentConfig';
import { useLanguage } from '../../../context/LanguageContext';

function AIConfigTab() {
  const { t } = useLanguage();
  const [voices, setVoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLanguage, setAiLanguage] = useState(() => getStoredAiLanguage());

  useEffect(() => {
    smartflowApi.getAIVoices()
      .then(r => setVoices(r.data?.data || []))
      .catch(() => setVoices([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setStoredAiLanguage(aiLanguage);
  }, [aiLanguage]);

  return (
    <div className="space-y-5">
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Globe size={16} className="text-[#9333ea]"/>{t('aiprof_hdr_lang')}</h3>
        <select
          value={aiLanguage}
          onChange={(event) => setAiLanguage(event.target.value)}
          className="w-full bg-[#131A24] border border-[#243041] rounded-xl text-sm text-white px-3 py-3 outline-none"
        >
          {AI_LANGUAGE_OPTIONS.map((language) => (
            <option key={language.code} value={language.code}>{language.name}</option>
          ))}
        </select>
        <p className="text-[#A4B0B7] text-xs mt-3">
          {t('aiprof_lang_desc')}
        </p>
      </div>

      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5">
        <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Mic size={16} className="text-[#9333ea]"/>{t('aiprof_hdr_voices')}</h3>
        {loading ? <div className="flex items-center justify-center h-24"><Loader2 className="animate-spin text-[#9333ea]"/></div>
          : voices.length ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {voices.map(v => (
                <div key={v.id||v.voice_id||v.name} className="p-3 bg-[#131A24] border border-[#243041] rounded-xl">
                  <p className="text-white font-semibold text-sm">{v.label||v.name||v.voice_name}</p>
                  {(v.style || v.language) && <p className="text-[#A4B0B7] text-xs mt-0.5 capitalize">{v.style||v.language}</p>}
                </div>
              ))}
            </div>
          ) : <p className="text-[#A4B0B7] text-sm">{t('aiprof_no_voices')}</p>
        }
      </div>
    </div>
  );
}


export default AIConfigTab;
