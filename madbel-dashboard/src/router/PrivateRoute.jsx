import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAdminAuthenticated, isOnboardingComplete } from "../utils/auth";

const EXEMPT_PATHS = ["/onboarding", "/trial-expired"];

const PrivateRoute = () => {
  const location = useLocation();

  if (!isAdminAuthenticated()) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  // Subscriptions/Trials are now handled externally, so no onboarding force redirect needed.

  return <Outlet />;
};

export default PrivateRoute;
