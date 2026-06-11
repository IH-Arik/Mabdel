import { useCallback, useEffect, useState } from 'react';
import { Activity, BrainCircuit, DollarSign, Users } from 'lucide-react';
import { adminApi } from '../api/services';

export default function AdminPanel() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [aiStats, setAiStats] = useState(null);
  const [error, setError] = useState('');

  const fetchAdmin = useCallback(async () => {
    try {
      const [summaryRes, usersRes, txRes, aiRes] = await Promise.all([
        adminApi.getSummary(),
        adminApi.getUsers({ page_size: 10 }),
        adminApi.getTransactions({ page_size: 10 }),
        adminApi.getAIStats(),
      ]);
      setSummary(summaryRes.data.data);
      setUsers(usersRes.data.data.items || []);
      setTransactions(txRes.data.data.items || []);
      setAiStats(aiRes.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Admin data requires an admin account.');
    }
  }, []);

  useEffect(() => {
    fetchAdmin();
  }, [fetchAdmin]);

  const cards = [
    { label: 'Users', value: summary?.total_users ?? users.length, icon: Users },
    { label: 'Revenue', value: `$${summary?.total_revenue ?? 0}`, icon: DollarSign },
    { label: 'AI Requests', value: aiStats?.total_requests ?? aiStats?.total_commands ?? 0, icon: BrainCircuit },
    { label: 'Transactions', value: transactions.length, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-teal-900">Admin Panel</h1>
        <p className="text-teal-700/70">Operational overview for users, earnings, AI logs, reports, and admin controls.</p>
      </div>
      {error && <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-yellow-800 text-sm">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-card p-5">
              <Icon className="text-teal-700" size={22} />
              <p className="text-sm text-teal-700/60 mt-4">{card.label}</p>
              <p className="text-2xl font-bold text-teal-900">{card.value}</p>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-teal-100 font-bold text-teal-900">Recent Users</div>
          {users.map((user) => (
            <div key={user.id} className="p-4 border-b border-teal-50 flex items-center justify-between">
              <div>
                <p className="font-bold text-teal-900">{user.full_name || user.name}</p>
                <p className="text-sm text-teal-700/60">{user.email}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-teal-50 text-teal-700">{user.status || user.role || 'user'}</span>
            </div>
          ))}
        </div>
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-teal-100 font-bold text-teal-900">Transactions</div>
          {transactions.length ? transactions.map((item) => (
            <div key={item.id} className="p-4 border-b border-teal-50 flex items-center justify-between">
              <div>
                <p className="font-bold text-teal-900">{item.customer_name || item.user_name || item.id}</p>
                <p className="text-sm text-teal-700/60">{item.status || 'transaction'}</p>
              </div>
              <span className="font-bold text-teal-900">${item.amount || item.total || 0}</span>
            </div>
          )) : <div className="p-12 text-center text-teal-700/60">No transactions found.</div>}
        </div>
      </div>
    </div>
  );
}
