import { useEffect, useRef, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAdminAuthenticated, getAdminRole } from "../utils/auth";
import { getSubscriptionStatus } from "../services/subscriptionApi";

const EXEMPT_PATHS = ["/onboarding", "/trial-expired"];

const PrivateRoute = () => {
  const location = useLocation();
  const role = getAdminRole();
  const isOwner = role === "owner";

  const [subStatus, setSubStatus] = useState(null);
  const [loading, setLoading] = useState(isOwner);
  const fetched = useRef(false);

  useEffect(() => {
    if (!isOwner || fetched.current) return;
    fetched.current = true;

    const timeout = setTimeout(() => setLoading(false), 5000);

    getSubscriptionStatus()
      .then((res) => setSubStatus(res?.data ?? null))
      .catch(() => setSubStatus(null))
      .finally(() => {
        clearTimeout(timeout);
        setLoading(false);
      });

    return () => clearTimeout(timeout);
  }, [isOwner]);

  // Not authenticated → sign in
  if (!isAdminAuthenticated()) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // Non-owner roles (admin, super_admin, manager, staff, assistant):
  // no subscription gate on frontend — backend enforces for team members
  if (!isOwner) {
    return <Outlet />;
  }

  // Wait for subscription status fetch
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-slate-400 text-sm">Loading your workspace…</span>
        </div>
      </div>
    );
  }

  const exempt = EXEMPT_PATHS.includes(location.pathname);

  // First-time owner: force onboarding
  if (subStatus && !subStatus.onboarding_complete && !exempt) {
    return <Navigate to="/onboarding" replace />;
  }

  // Trial expired: force trial-expired page (but not if on onboarding)
  if (
    subStatus &&
    subStatus.status === "expired" &&
    !exempt
  ) {
    return <Navigate to="/trial-expired" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
