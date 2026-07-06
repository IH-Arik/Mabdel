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

function EarningsTab() {
  const { earnings, requestWithdrawal } = useProfileStore();
  const [amount, setAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function withdraw() {
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount.'); return; }
    setWithdrawing(true); setError(''); setSuccess('');
    try {
      requestWithdrawal(Number(amount));
      setSuccess('Withdrawal request submitted!');
      setAmount('');
    } catch(err) { setError('Withdrawal failed.'); }
    finally { setWithdrawing(false); }
  }

  const data = earnings;

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2"><AlertTriangle size={14}/>{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex gap-2"><CheckCircle2 size={14}/>{success}</div>}
      
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Earned" value={`$${data?.total_earned || '0.00'}`} icon={DollarSign} accent="#10B981"/>
        <StatCard label="Available Balance" value={`$${data?.available_balance || '0.00'}`} icon={Wallet} accent="#11C7E5"/>
        <StatCard label="Total Withdrawn" value={`$${data?.total_withdrawn || '0.00'}`} icon={ArrowUpRight} accent="#8B5CF6"/>
      </div>

      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white">Request Withdrawal</h3>
        <div className="flex gap-3">
          <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount (USD)"
            className={`${INPUT} flex-1`}/>
          <button onClick={withdraw} disabled={withdrawing}
            className="px-5 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60">
            {withdrawing ? <Loader2 size={16} className="animate-spin"/> : <Wallet size={16}/>}
            Withdraw
          </button>
        </div>
        {data?.recent_transactions?.length > 0 && (
          <div className="space-y-2">
            <p className="text-[#A4B0B7] text-xs font-semibold uppercase tracking-wider">Recent Transactions</p>
            {data.recent_transactions.map((tx, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-[#131A24] border border-[#243041] rounded-xl">
                <div><p className="text-white text-sm font-semibold">{tx.description || 'Transaction'}</p><p className="text-[#A4B0B7] text-xs">{tx.created_at ? new Date(tx.created_at).toLocaleDateString() : ''}</p></div>
                <span className={`font-bold text-sm ${tx.type==='credit'?'text-emerald-400':'text-rose-400'}`}>{tx.type==='credit'?'+':'-'}${tx.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


export default EarningsTab;
