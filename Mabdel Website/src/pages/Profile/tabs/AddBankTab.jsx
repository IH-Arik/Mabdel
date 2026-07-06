import { useState } from 'react';
import { motion } from 'framer-motion';
import { Landmark, Plus, Check, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';

export default function AddBankTab() {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({
    accountName: '',
    routingNumber: '',
    accountNumber: '',
    accountType: 'checking'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Mock linked banks
  const [banks, setBanks] = useState([
    { id: 1, name: 'Chase Bank', type: 'Checking', last4: '4567', isPrimary: true },
    { id: 2, name: 'Bank of America', type: 'Savings', last4: '8901', isPrimary: false }
  ]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
        setIsSubmitting(false);
        setSuccess(true);
        setBanks([...banks, {
            id: Date.now(),
            name: 'New Bank Account',
            type: formData.accountType === 'checking' ? 'Checking' : 'Savings',
            last4: formData.accountNumber.slice(-4) || '0000',
            isPrimary: false
        }]);
        setTimeout(() => {
            setSuccess(false);
            setIsAdding(false);
            setFormData({ accountName: '', routingNumber: '', accountNumber: '', accountType: 'checking' });
        }, 2000);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Landmark className="text-blue-400" /> Bank Accounts
          </h2>
          <p className="text-sm text-slate-400 mt-1">Manage your linked bank accounts for withdrawals and payments.</p>
        </div>
        {!isAdding && (
            <button 
                onClick={() => setIsAdding(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center gap-2 transition-all"
            >
                <Plus size={18} /> Add Bank
            </button>
        )}
      </div>

      {isAdding ? (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-[#131A24] border border-[#243041] rounded-2xl p-6"
          >
              <h3 className="text-lg font-bold text-white mb-4">Link New Account</h3>
              
              {success ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 mb-4">
                          <Check size={32} />
                      </div>
                      <h4 className="text-xl font-bold text-white">Bank Linked Successfully</h4>
                      <p className="text-slate-400 text-sm mt-1">Your account is now ready to use.</p>
                  </div>
              ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Name on Account</label>
                          <input 
                              type="text" 
                              required
                              value={formData.accountName}
                              onChange={e => setFormData({...formData, accountName: e.target.value})}
                              placeholder="e.g. John Doe"
                              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-blue-500/50 focus:outline-none text-white text-sm"
                          />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Routing Number</label>
                              <input 
                                  type="text" 
                                  required
                                  value={formData.routingNumber}
                                  onChange={e => setFormData({...formData, routingNumber: e.target.value})}
                                  placeholder="9 Digit Routing Number"
                                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-blue-500/50 focus:outline-none text-white text-sm"
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Account Number</label>
                              <input 
                                  type="text" 
                                  required
                                  value={formData.accountNumber}
                                  onChange={e => setFormData({...formData, accountNumber: e.target.value})}
                                  placeholder="Account Number"
                                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-blue-500/50 focus:outline-none text-white text-sm"
                              />
                          </div>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Account Type</label>
                          <select 
                              value={formData.accountType}
                              onChange={e => setFormData({...formData, accountType: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:border-blue-500/50 focus:outline-none text-white text-sm"
                          >
                              <option value="checking">Checking</option>
                              <option value="savings">Savings</option>
                              <option value="business">Business</option>
                          </select>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-900/50 p-3 rounded-lg border border-slate-800/50 mt-4">
                          <ShieldCheck size={16} className="text-emerald-500" />
                          <span>Your bank information is encrypted and securely stored.</span>
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                          <button 
                              type="button"
                              onClick={() => setIsAdding(false)}
                              disabled={isSubmitting}
                              className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
                          >
                              Cancel
                          </button>
                          <button 
                              type="submit"
                              disabled={isSubmitting}
                              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                              {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Linking...</> : <>Link Account <ArrowRight size={16} /></>}
                          </button>
                      </div>
                  </form>
              )}
          </motion.div>
      ) : (
          <div className="grid gap-4">
              {banks.map(bank => (
                  <div key={bank.id} className="p-5 bg-[#131A24] border border-[#243041] rounded-2xl flex items-center justify-between hover:border-slate-600 transition-colors">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800 text-blue-400">
                              <Landmark size={24} />
                          </div>
                          <div>
                              <h4 className="text-white font-bold text-base flex items-center gap-2">
                                  {bank.name}
                                  {bank.isPrimary && <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-500/10 text-blue-400 rounded-md border border-blue-500/20 uppercase tracking-wider">Primary</span>}
                              </h4>
                              <p className="text-slate-400 text-sm">{bank.type} •••• {bank.last4}</p>
                          </div>
                      </div>
                      <div className="flex gap-2">
                          {!bank.isPrimary && (
                              <button className="px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors">
                                  Make Primary
                              </button>
                          )}
                          <button className="px-3 py-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20 transition-colors">
                              Remove
                          </button>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
}
