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

export const getMyDashboard = (days = 30) =>
  apiRequest("/owner/my-dashboard", { query: { days } });

export const getTeamDashboard = () =>
  apiRequest("/owner/team/dashboard");

export const getTeamAnalysis = (days = 30) =>
  apiRequest("/owner/team/analysis", { query: { days } });

export const getMemberAnalysis = (userId, days = 30) =>
  apiRequest(`/owner/team/${userId}/analysis`, { query: { days } });

export const banTeamMember = (userId) =>
  apiRequest(`/owner/team/${userId}/ban`, { method: "POST" });

export const unbanTeamMember = (userId) =>
  apiRequest(`/owner/team/${userId}/unban`, { method: "POST" });

export const createSubordinate = (body) =>
  apiRequest("/rbac/roles/create-subordinate", {
    method: "POST",
    body,
  });
