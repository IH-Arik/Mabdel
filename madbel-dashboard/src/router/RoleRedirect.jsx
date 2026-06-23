import { Navigate } from "react-router-dom";
import { getAdminRole } from "../utils/auth";

const OWNER_ROLES = new Set(["owner", "supervisor", "staff"]);

const RoleRedirect = () => {
  const role = getAdminRole();
  if (OWNER_ROLES.has(role)) {
    return <Navigate to="/owner" replace />;
  }
  return <Navigate to="/dashboard" replace />;
};

export default RoleRedirect;
