import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, CreditCard, Eye, CheckCircle, LogOut } from "lucide-react";
import {
  startTrial,
  completeOnboarding,
} from "../../services/subscriptionApi";
import { clearAdminSession } from "../../utils/auth";

const FEATURES = [
  "Unlimited contacts & conversations",
  "AI-powered tools & voice agent",
  "Bulk messaging campaigns",
  "Team management & permissions",
  "Invoice & appointment tracking",
  "Social media integrations",
];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const handleTrial = async () => {
    setLoading("trial");
    setError(null);
    try {
      await startTrial();
      navigate("/owner");
    } catch (e) {
      setError(e?.payload?.message || "Failed to start trial. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleExplore = async () => {
    setLoading("explore");
    setError(null);
    try {
      await completeOnboarding();
      navigate("/owner");
    } catch (e) {
      setError(e?.payload?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleBuySubscription = () => {
    navigate("/settings/billing");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Logo / Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 mb-4">
            <Sparkles className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Mabdel</h1>
          <p className="text-slate-400 text-base">
            Your all-in-one CRM & communication platform.
            <br />
            Choose how you'd like to get started.
          </p>
        </div>

        {/* Feature List */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-8">
          <p className="text-slate-300 text-sm font-medium mb-3">Everything included:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                <span className="text-slate-300 text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          {/* Buy Subscription */}
          <button
            onClick={handleBuySubscription}
            disabled={!!loading}
            className="group relative flex flex-col items-start p-6 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl text-white shadow-xl hover:shadow-cyan-500/30 hover:scale-[1.02] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-wide opacity-80">
                Best Value
              </span>
            </div>
            <h2 className="text-xl font-bold mb-1">Buy Subscription</h2>
            <p className="text-blue-100 text-sm">
              Unlock full access with a paid plan. Billed monthly or annually.
            </p>
            <span className="mt-4 text-xs font-medium bg-white/20 px-3 py-1 rounded-full">
              Upgrade →
            </span>
          </button>

          {/* 7-Day Trial */}
          <button
            onClick={handleTrial}
            disabled={!!loading}
            className="group flex flex-col items-start p-6 bg-white/10 border border-white/20 hover:bg-white/15 hover:border-cyan-400/50 rounded-2xl text-white transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              <span className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
                Free
              </span>
            </div>
            <h2 className="text-xl font-bold mb-1">7-Day Free Trial</h2>
            <p className="text-slate-300 text-sm">
              Try all features free for 7 days. No credit card required.
            </p>
            {loading === "trial" ? (
              <span className="mt-4 text-xs font-medium text-cyan-400">Starting trial…</span>
            ) : (
              <span className="mt-4 text-xs font-medium text-cyan-400">Start now →</span>
            )}
          </button>
        </div>

        {/* Explore / Skip */}
        <div className="text-center">
          <button
            onClick={handleExplore}
            disabled={!!loading}
            className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye className="w-4 h-4" />
            {loading === "explore" ? "Loading…" : "Explore without subscribing"}
          </button>
          <p className="text-slate-600 text-xs mt-1">
            View-only mode — write actions require an active subscription.
          </p>
        </div>

        {error && (
          <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => { clearAdminSession(); window.location.replace("/sign-in"); }}
            className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-300 text-xs transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingPage;
