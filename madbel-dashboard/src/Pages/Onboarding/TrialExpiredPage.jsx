import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Timer, CreditCard, Eye, AlertTriangle, LogOut } from "lucide-react";
import { completeOnboarding } from "../../services/subscriptionApi";
import { clearAdminSession } from "../../utils/auth";

const TrialExpiredPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleExplore = async () => {
    setLoading(true);
    try {
      await completeOnboarding();
    } catch (_) {
      // already past onboarding, ignore
    } finally {
      setLoading(false);
      navigate("/owner");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg text-center">
        {/* Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/15 border border-red-400/30 mb-6">
          <Timer className="w-10 h-10 text-red-400" />
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-white mb-3">Your Trial Has Ended</h1>
        <p className="text-slate-400 mb-2">
          Your 7-day free trial is over. Upgrade to continue using all CRM features.
        </p>
        <div className="flex items-center justify-center gap-2 text-amber-400 text-sm mb-8">
          <AlertTriangle className="w-4 h-4" />
          <span>Read-only access is available while unsubscribed.</span>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
          <button
            onClick={() => navigate("/settings/billing")}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 hover:scale-[1.02] transition-all duration-200"
          >
            <CreditCard className="w-5 h-5" />
            Upgrade Now
          </button>

          <button
            onClick={handleExplore}
            disabled={loading}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-white/10 border border-white/20 text-slate-300 font-medium rounded-xl hover:bg-white/15 hover:text-white transition-all duration-200 disabled:opacity-50"
          >
            <Eye className="w-5 h-5" />
            {loading ? "Loading…" : "Continue in Read-Only"}
          </button>
        </div>

        <p className="text-slate-600 text-xs mb-4">
          You can always upgrade from Settings → Billing.
        </p>

        <button
          onClick={() => { clearAdminSession(); window.location.replace("/sign-in"); }}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-300 text-xs transition-colors"
        >
          <LogOut className="w-3 h-3" />
          Sign out
        </button>
      </div>
    </div>
  );
};

export default TrialExpiredPage;
