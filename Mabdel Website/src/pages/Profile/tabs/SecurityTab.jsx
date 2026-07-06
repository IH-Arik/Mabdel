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

function SecurityTab() {
  const { logout } = useAuthStore();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changing, setChanging] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function changePassword() {
    setError(''); setSuccess('');
    if (!oldPw || !newPw || !confirmPw) { setError('All fields are required.'); return; }
    if (newPw !== confirmPw) { setError('New passwords do not match.'); return; }
    if (newPw.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setChanging(true);
    try {
      await smartflowApi.changePassword({ current_password: oldPw, new_password: newPw });
      setSuccess('Password changed successfully!');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch(err) { setError(err.response?.data?.message || 'Password change failed.'); }
    finally { setChanging(false); }
  }

  async function revokeSessions() {
    setRevoking(true);
    try { await smartflowApi.revokeSessions(); setSuccess('All sessions revoked. Please log in again.'); setTimeout(()=>logout(), 2000); }
    catch(err) { setError(err.response?.data?.message || 'Revoke failed.'); }
    finally { setRevoking(false); }
  }

  async function deleteAccount() {
    if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
    setDeleting(true);
    try { await smartflowApi.deleteAccount(); logout(); }
    catch(err) { setError(err.response?.data?.message || 'Delete account failed.'); setDeleting(false); }
  }

  const PwInput = ({ label, value, onChange, show, onToggle }) => (
    <Field label={label}>
      <div className="relative">
        <input type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} className={`${INPUT} pr-11`} placeholder="••••••••"/>
        <button type="button" onClick={onToggle} className="absolute right-3 top-3.5 text-[#A4B0B7] hover:text-white">
          {show ? <EyeOff size={16}/> : <Eye size={16}/>}
        </button>
      </div>
    </Field>
  );

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl text-rose-300 text-sm flex gap-2"><AlertTriangle size={14}/>{error}</div>}
      {success && <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm flex gap-2"><CheckCircle2 size={14}/>{success}</div>}

      {/* Change Password */}
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Key size={16} className="text-[#11C7E5]"/>Change Password</h3>
        <PwInput label="Current Password" value={oldPw} onChange={setOldPw} show={showOld} onToggle={()=>setShowOld(s=>!s)}/>
        <PwInput label="New Password" value={newPw} onChange={setNewPw} show={showNew} onToggle={()=>setShowNew(s=>!s)}/>
        <Field label="Confirm New Password">
          <input type="password" value={confirmPw} onChange={e=>setConfirmPw(e.target.value)} className={INPUT} placeholder="••••••••"/>
        </Field>
        <button onClick={changePassword} disabled={changing}
          className="px-6 py-3 bg-[#11C7E5] text-[#02080B] rounded-xl font-bold flex items-center gap-2 hover:bg-[#0fd0f0] transition-colors cursor-pointer disabled:opacity-60">
          {changing ? <Loader2 size={16} className="animate-spin"/> : <Lock size={16}/>}
          {changing ? 'Changing…' : 'Change Password'}
        </button>
      </div>

      {/* Session Management */}
      <div className="bg-[#0A1019] border border-[#243041] rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white flex items-center gap-2"><Shield size={16} className="text-[#11C7E5]"/>Session Management</h3>
        <p className="text-[#A4B0B7] text-sm">Revoke all active sessions and force re-authentication on all devices.</p>
        <button onClick={revokeSessions} disabled={revoking}
          className="px-6 py-3 bg-amber-900/20 border border-amber-500/30 text-amber-400 rounded-xl font-bold flex items-center gap-2 hover:bg-amber-900/30 transition-colors cursor-pointer disabled:opacity-60">
          {revoking ? <Loader2 size={16} className="animate-spin"/> : <LogOut size={16}/>}
          {revoking ? 'Revoking…' : 'Revoke All Sessions'}
        </button>
      </div>

      {/* Delete Account */}
      <div className="bg-rose-950/20 border border-rose-500/20 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-rose-300 flex items-center gap-2"><AlertTriangle size={16}/>Danger Zone</h3>
        <p className="text-[#A4B0B7] text-sm">Once you delete your account, all data will be permanently removed. This action cannot be undone.</p>
        <button onClick={deleteAccount} disabled={deleting}
          className="px-6 py-3 bg-rose-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-rose-700 transition-colors cursor-pointer disabled:opacity-60">
          {deleting ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16}/>}
          {deleting ? 'Deleting…' : 'Delete My Account'}
        </button>
      </div>
    </div>
  );
}


export default SecurityTab;
