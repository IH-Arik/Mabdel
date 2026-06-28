import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Zap, CreditCard, Sparkles } from "lucide-react";
import { getAdminRole } from "../../utils/auth";
import { startTrial } from "../../services/subscriptionApi";

const UpgradeModal = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [trialLoading, setTrialLoading] = useState(false);
  const role = getAdminRole();
  const isAssigned = ["manager", "staff", "assistant"].includes(role);

  useEffect(() => {
    const handler = (e) => {
      setMessage(e.detail?.message || null);
      setOpen(true);
    };
    window.addEventListener("subscription-required", handler);
    return () => window.removeEventListener("subscription-required", handler);
  }, []);

  const handleUpgrade = () => {
    setOpen(false);
    navigate("/settings/billing");
  };

  const handleTrial = async () => {
    setTrialLoading(true);
    try {
      await startTrial();
      setOpen(false);
      window.location.reload();
    } catch (e) {
      // Trial already started or failed — send to billing
      setOpen(false);
      navigate("/settings/billing");
    } finally {
      setTrialLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-gradient-to-br from-slate-900 to-slate-800 border border-white/10 rounded-2xl shadow-2xl p-8">
        {/* Close */}
        <button
          onClick={() => setOpen(false)}
          className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-400/25 mb-5 mx-auto">
          <Zap className="w-7 h-7 text-cyan-400" />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          {isAssigned ? "Feature Unavailable" : "Subscription Required"}
        </h2>

        <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">
          {isAssigned
            ? message ||
              "Your company's subscription has expired or is inactive. Please contact your administrator to restore access."
            : message ||
              "An active subscription is required to use this feature. Upgrade your plan or start a free 7-day trial."}
        </p>

        {/* Actions */}
        {isAssigned ? (
          <button
            onClick={() => setOpen(false)}
            className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={handleUpgrade}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
            >
              <CreditCard className="w-4 h-4" />
              Buy Subscription
            </button>
            <button
              onClick={handleTrial}
              disabled={trialLoading}
              className="flex items-center justify-center gap-2 w-full py-3 bg-white/10 border border-white/15 text-slate-200 font-medium rounded-xl hover:bg-white/15 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              {trialLoading ? "Starting…" : "Start 7-Day Free Trial"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-500 hover:text-slate-300 text-sm text-center py-1 transition-colors"
            >
              Maybe later
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpgradeModal;
