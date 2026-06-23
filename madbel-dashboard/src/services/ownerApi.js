import { apiRequest } from "./httpClient";

export const getOwnerProfile = () =>
  apiRequest("/owner/me");

export const listTeamMembers = ({ page = 1, limit = 20, roleFilter } = {}) =>
  apiRequest("/owner/team", {
    query: { page, limit, ...(roleFilter ? { role_filter: roleFilter } : {}) },
  });

export const searchUsers = (q) =>
  apiRequest("/owner/search", { query: { q } });

export const assignTeamRole = ({ user_id, role_slug, allowed_permissions }) =>
  apiRequest("/owner/assign", {
    method: "POST",
    body: { user_id, role_slug, ...(allowed_permissions ? { allowed_permissions } : {}) },
  });

export const revokeTeamRole = ({ user_id, role_slug }) =>
  apiRequest("/owner/revoke", {
    method: "DELETE",
    body: { user_id, role_slug },
  });

export const getUserPermissions = (userId) =>
  apiRequest(`/owner/team/${userId}/permissions`);

export const setUserPermissions = (userId, allowed_permissions) =>
  apiRequest(`/owner/team/${userId}/permissions`, {
    method: "PUT",
    body: { allowed_permissions },
  });

export const listPermissionModules = () =>
  apiRequest("/owner/modules");
