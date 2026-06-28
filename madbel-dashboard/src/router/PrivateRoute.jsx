import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAdminAuthenticated, isOnboardingComplete } from "../utils/auth";

const EXEMPT_PATHS = ["/onboarding", "/trial-expired"];

const PrivateRoute = () => {
  const location = useLocation();

  if (!isAdminAuthenticated()) {
    return <Navigate to="/sign-in" state={{ from: location }} replace />;
  }

  const exempt = EXEMPT_PATHS.includes(location.pathname);

  if (!exempt && !isOnboardingComplete()) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
