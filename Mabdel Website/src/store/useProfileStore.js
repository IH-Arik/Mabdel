import { create } from 'zustand';

export const useProfileStore = create((set) => ({
  earnings: {
    total_earned: '12,450.00',
    available_balance: '3,240.00',
    total_withdrawn: '9,210.00',
    recent_transactions: [
      { id: 1, description: 'Ticket Sale - Web Dev Workshop', amount: '45.00', type: 'credit', created_at: new Date().toISOString() },
      { id: 2, description: 'Withdrawal to Bank', amount: '1200.00', type: 'debit', created_at: new Date(Date.now() - 86400000).toISOString() },
      { id: 3, description: 'Ticket Sale - Web Dev Workshop', amount: '45.00', type: 'credit', created_at: new Date(Date.now() - 172800000).toISOString() },
    ]
  },
  
  hostedEvents: [
    { id: 1, title: 'Web Dev Workshop', date: 'Oct 15, 2026', participants: 45, revenue: '$2,025' },
    { id: 2, title: 'AI Startup Meetup', date: 'Oct 20, 2026', participants: 120, revenue: '$0 (Free)' },
  ],

  subscription: {
    current: {
      plan_name: 'Pro',
      status: 'active',
      plan_id: 'plan_pro'
    },
    plans: [
      { id: 'plan_free', name: 'Free', price: '0', period: 'mo', features: ['Basic AI Voice', 'Standard Support', 'Up to 2 Groups'] },
      { id: 'plan_pro', name: 'Pro', price: '29', period: 'mo', is_popular: true, features: ['Advanced AI Models', 'Priority Support', 'Unlimited Groups', 'Lease Generator'] },
      { id: 'plan_business', name: 'Business', price: '99', period: 'mo', features: ['Custom Branding', 'API Access', 'Dedicated Account Manager'] }
    ]
  },

  // Actions (Mock updates)
  requestWithdrawal: (amount) => set((state) => ({
    earnings: {
      ...state.earnings,
      available_balance: (parseFloat(state.earnings.available_balance.replace(/,/g, '')) - amount).toLocaleString('en-US', {minimumFractionDigits: 2}),
      recent_transactions: [
        { id: Date.now(), description: 'Withdrawal Request', amount: amount.toFixed(2), type: 'debit', created_at: new Date().toISOString() },
        ...state.earnings.recent_transactions
      ]
    }
  })),

  upgradePlan: (planId) => set((state) => ({
    subscription: {
      ...state.subscription,
      current: {
        plan_name: state.subscription.plans.find(p => p.id === planId)?.name || 'Pro',
        status: 'active',
        plan_id: planId
      }
    }
  }))
}));
