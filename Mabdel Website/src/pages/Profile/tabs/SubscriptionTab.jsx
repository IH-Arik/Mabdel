import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

import { smartflowApi } from '../../../api/services';
import { Badge } from '../shared';

const formatPrice = (plan) => {
  const amount = Number(plan?.price_cents || 0) / 100;
  if (!amount) return 'Free';
  return `$${amount.toFixed(2)}`;
};

function SubscriptionTab() {
  const [plans, setPlans] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    Promise.all([
      smartflowApi.getSubscriptionPlans(),
      smartflowApi.getCurrentSubscription(),
    ])
      .then(([plansResponse, currentResponse]) => {
        if (ignore) return;
        setPlans(plansResponse?.data?.data?.items || []);
        setCurrent(currentResponse?.data?.data || null);
      })
      .catch((loadError) => {
        if (ignore) return;
        setError(loadError?.response?.data?.message || 'Could not load subscription details.');
        setPlans([]);
        setCurrent(null);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="animate-spin text-[#11C7E5]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 text-sm text-rose-300">
          <AlertTriangle size={14} />
          {error}
        </div>
      ) : null}

      {current ? (
        <div className="rounded-2xl border border-[#11C7E5]/20 bg-[#0A1019] p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#A4B0B7]">Current Plan</p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xl font-black text-white">{current.plan?.name || 'Free'}</p>
              <p className="text-sm text-[#A4B0B7]">
                {current.status === 'active' ? 'Active' : current.status}
                {current.renews_at ? ` · Renews ${new Date(current.renews_at).toLocaleDateString()}` : ''}
              </p>
            </div>
            <Badge color={current.status === 'active' ? 'green' : 'yellow'}>{current.status || 'free'}</Badge>
          </div>
        </div>
      ) : null}

      {plans.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = current?.plan?.code === plan.code;
            return (
              <div key={plan.code} className={`rounded-2xl border bg-[#0A1019] p-5 ${plan.is_popular ? 'border-[#11C7E5]/30' : 'border-[#243041]'}`}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  {plan.is_popular ? <Badge>Popular</Badge> : null}
                </div>
                <p className="mt-1 text-sm text-[#A4B0B7]">{plan.description}</p>
                <p className="mt-3 text-3xl font-black text-[#11C7E5]">
                  {formatPrice(plan)}
                  {Number(plan.price_cents || 0) > 0 ? <span className="text-sm text-[#A4B0B7]">/{plan.billing_interval || 'month'}</span> : null}
                </p>
                <ul className="mt-4 space-y-2">
                  {(plan.features || []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-[#A4B0B7]">
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-[#11C7E5]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className={`mt-4 rounded-xl border px-4 py-2.5 text-center text-sm font-bold ${isCurrent ? 'border-emerald-500/20 bg-emerald-950/20 text-emerald-300' : 'border-[#243041] bg-[#131A24] text-[#A4B0B7]'}`}>
                  {isCurrent ? 'Current Plan' : 'View Only'}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-[#A4B0B7]">No subscription plans available at the moment.</div>
      )}
    </div>
  );
}

export default SubscriptionTab;
