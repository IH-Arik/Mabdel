import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  Sparkles,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";
import {
  getSubscriptionStatus,
  startTrial,
  activateSubscription,
} from "../../../services/subscriptionApi";

const STATUS_CONFIG = {
  active: {
    label: "Active",
    color: "text-green-400",
    bg: "bg-green-400/10 border-green-400/25",
    icon: <CheckCircle className="w-5 h-5 text-green-400" />,
  },
  trial: {
    label: "Free Trial",
    color: "text-cyan-400",
    bg: "bg-cyan-400/10 border-cyan-400/25",
    icon: <Sparkles className="w-5 h-5 text-cyan-400" />,
  },
  expired: {
    label: "Expired",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/25",
    icon: <XCircle className="w-5 h-5 text-red-400" />,
  },
  none: {
    label: "No Subscription",
    color: "text-slate-400",
    bg: "bg-slate-400/10 border-slate-400/25",
    icon: <Clock className="w-5 h-5 text-slate-400" />,
  },
};

const BillingPage = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await getSubscriptionStatus();
      setStatus(res?.data);
    } catch (e) {
      setError("Failed to load subscription status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTrial = async () => {
    setActionLoading("trial");
    setError(null);
    setSuccess(null);
    try {
      await startTrial();
      setSuccess("7-day free trial started successfully!");
      await fetchStatus();
    } catch (e) {
      setError(e?.payload?.message || "Failed to start trial.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async () => {
    setActionLoading("activate");
    setError(null);
    setSuccess(null);
    try {
      await activateSubscription();
      setSuccess("Subscription activated!");
      await fetchStatus();
    } catch (e) {
      setError(e?.payload?.message || "Failed to activate subscription.");
    } finally {
      setActionLoading(null);
    }
  };

  const cfg = STATUS_CONFIG[status?.status] ?? STATUS_CONFIG.none;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Back */}
      <button
        onClick={() => navigate("/settings")}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Settings
      </button>

      <h1 className="text-2xl font-bold text-slate-800 mb-6">
        Billing & Subscription
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-cyan-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Current Status Card */}
          <div className={`border rounded-2xl p-6 mb-6 ${cfg.bg}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {cfg.icon}
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                    Current Plan
                  </p>
                  <p className={`text-lg font-bold ${cfg.color}`}>
                    {cfg.label}
                  </p>
                </div>
              </div>
              {status?.status === "trial" && status?.days_left !== null && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-cyan-400">
                    {status.days_left}
                  </p>
                  <p className="text-xs text-slate-500">days left</p>
                </div>
              )}
            </div>

            {status?.trial_ends_at && status?.status === "trial" && (
              <p className="text-sm text-slate-500">
                Trial ends:{" "}
                <span className="font-medium text-slate-700">
                  {new Date(status.trial_ends_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </p>
            )}

            {status?.status === "active" && (
              <p className="text-sm text-slate-500">
                Your subscription is active and all features are unlocked.
              </p>
            )}

            {status?.status === "expired" && (
              <p className="text-sm text-red-400">
                Your subscription has expired. Upgrade to restore full access.
              </p>
            )}

            {status?.status === "none" && (
              <p className="text-sm text-slate-500">
                You don't have an active subscription. Choose a plan below to
                get started.
              </p>
            )}
          </div>

          {/* Feedback */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm mb-4">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-600 text-sm mb-4">
              {success}
            </div>
          )}

          {/* Actions */}
          {status?.status !== "active" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Buy Subscription */}
              <button
                onClick={handleActivate}
                disabled={!!actionLoading}
                className="flex flex-col items-start p-5 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl text-white shadow-lg hover:shadow-cyan-500/25 hover:scale-[1.02] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <CreditCard className="w-6 h-6 mb-3" />
                <h3 className="font-bold text-lg mb-1">Buy Subscription</h3>
                <p className="text-blue-100 text-sm">
                  Full access, unlimited features.
                </p>
                {actionLoading === "activate" && (
                  <RefreshCw className="w-4 h-4 mt-3 animate-spin" />
                )}
              </button>

              {/* Start Trial */}
              {["none", "expired"].includes(status?.status) && (
                <button
                  onClick={handleTrial}
                  disabled={!!actionLoading}
                  className="flex flex-col items-start p-5 bg-white border border-slate-200 rounded-2xl text-slate-800 hover:border-cyan-300 hover:shadow-md transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-6 h-6 text-cyan-500 mb-3" />
                  <h3 className="font-bold text-lg mb-1">7-Day Free Trial</h3>
                  <p className="text-slate-500 text-sm">
                    Try all features free for 7 days.
                  </p>
                  {actionLoading === "trial" && (
                    <RefreshCw className="w-4 h-4 mt-3 animate-spin text-cyan-500" />
                  )}
                </button>
              )}
            </div>
          )}

          {status?.status === "active" && (
            <div className="border border-slate-200 rounded-2xl p-5">
              <h3 className="font-semibold text-slate-700 mb-2">
                Manage Subscription
              </h3>
              <p className="text-slate-500 text-sm">
                To cancel or change your plan, please contact support.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default BillingPage;
