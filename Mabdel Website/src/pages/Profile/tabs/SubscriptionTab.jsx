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

import { useProfileStore } from '../../../store/useProfileStore';

function SubscriptionTab() {
  const { subscription, upgradePlan } = useProfileStore();
  const plans = subscription.plans;
  const current = subscription.current;

  return (
    <div className="space-y-6">
      {current && (
        <div className="bg-[#0A1019] border border-[#11C7E5]/20 rounded-2xl p-5">
          <p className="text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider mb-1">Current Plan</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xl font-black text-white">{current.plan_name || 'Free'}</p>
              <p className="text-[#A4B0B7] text-sm">{current.status === 'active' ? 'Active' : current.status}</p>
            </div>
            <Badge color={current.status==='active'?'green':'yellow'}>{current.status || 'free'}</Badge>
          </div>
        </div>
      )}
      {plans.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.id} className={`bg-[#0A1019] border rounded-2xl p-5 ${plan.is_popular ? 'border-[#11C7E5]/30' : 'border-[#243041]'}`}>
              {plan.is_popular && <Badge>Popular</Badge>}
              <h3 className="font-bold text-white text-lg mt-2">{plan.name}</h3>
              <p className="text-3xl font-black text-[#11C7E5] mt-1">${plan.price}<span className="text-sm text-[#A4B0B7]">/{plan.period||'mo'}</span></p>
              <ul className="mt-3 space-y-1.5">
                {(plan.features||[]).map((f,i) => <li key={i} className="text-[#A4B0B7] text-xs flex items-center gap-1.5"><CheckCircle2 size={12} className="text-[#11C7E5]"/>{f}</li>)}
              </ul>
              <button onClick={() => upgradePlan(plan.id)} className="mt-4 w-full py-2.5 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold text-sm hover:bg-[#0fd0f0] transition-colors cursor-pointer">
                {current?.plan_id===plan.id ? 'Current Plan' : 'Upgrade'}
              </button>
            </div>
          ))}
        </div>
      )}
      {!plans.length && (
        <div className="p-12 text-center text-[#A4B0B7]">No subscription plans available at the moment.</div>
      )}
    </div>
  );
}


export default SubscriptionTab;
