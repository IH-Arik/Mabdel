import {
  apiRequest,
  apiRequestWithFallback,
  createPath,
} from "./httpClient";

const toListQuery = (query = {}) => ({
  ...query,
});

export const getMyProfile = () =>
  apiRequestWithFallback(["/admin/profile", "/admin/settings/profile"]);

export const updateMyProfile = (body) =>
  apiRequestWithFallback(["/admin/profile", "/admin/settings/profile"], {
    method: "PUT",
    body,
    contentType: body instanceof FormData ? null : "application/json",
  });

export const getDashboardOverview = () =>
  apiRequestWithFallback([
    "/admin/dashboard/overview",
    "/dashboard/overview"
  ]);

export const getDashboardAnalytics = async (query = {}) => {
  const queryCandidates = [
    { ...toListQuery(query) },
    {},
  ];

  for (const candidateQuery of queryCandidates) {
    try {
      return await apiRequestWithFallback(
        ["/admin/dashboard/analytics", "/dashboard/analytics"],
        { query: candidateQuery }
      );
    } catch (error) {
      if (error?.status !== 404 && error?.status !== 400) {
        throw error;
      }
    }
  }

  return apiRequest("/admin/dashboard/overview");
};

export const listRecentUsers = (query = {}) =>
  apiRequest("/admin/dashboard/recent-users", { query: toListQuery(query) });

export const getDashboardNotificationPreview = () =>
  apiRequest("/admin/dashboard/notifications/preview");

export const listUsers = (query = {}) =>
  apiRequestWithFallback(["/admin/users"], { query: toListQuery(query) });

const pickFirst = (...values) => values.find((v) => v !== undefined && v !== null);

const buildUserListVariants = (query = {}) => {
  const page = pickFirst(query.page, 1);
  const limit = pickFirst(query.limit, query.pageSize, 10);
  const keyword = pickFirst(query.search, query.query, query.q, "");

  return [
    { page, limit, search: keyword || undefined },
    { page, limit, query: keyword || undefined },
    { page, pageSize: limit, query: keyword || undefined },
    { page, pageSize: limit, q: keyword || undefined },
  ];
};

export const listUsersSafe = async (query = {}) => {
  const variants = buildUserListVariants(query);

  for (const q of variants) {
    try {
      return await apiRequest("/admin/users", { query: q });
    } catch (error) {
      if (error?.status !== 400 && error?.status !== 404 && error?.status !== 422) {
        throw error;
      }
    }
  }

  return apiRequest("/admin/users/search", {
    query: {
      q: pickFirst(query.search, query.query, query.q, ""),
      limit: pickFirst(query.limit, query.pageSize, 10),
    },
  });
};

export const searchUsers = (query = {}) =>
  apiRequest("/admin/users/search", {
    query: {
      q: pickFirst(query.q, query.search, query.query, ""),
      limit: pickFirst(query.limit, query.pageSize, 10),
    },
  });

export const listBlockedUsers = (query = {}) =>
  apiRequest("/admin/users/blocked", {
    query: {
      page: pickFirst(query.page, 1),
      limit: pickFirst(query.limit, query.pageSize, 10),
      search: pickFirst(query.search, query.query, query.q, ""),
    },
  });

export const getUserById = ({ id }) =>
  apiRequest(createPath("/admin/users/:id", { id }));

export const blockUser = ({ id }) =>
  apiRequestWithFallback(
    [
      createPath("/admin/users/:id/block", { id }),
      createPath("/admin/users/:id/ban", { id }),
    ],
    { method: "POST", body: {} }
  );

export const unblockUser = ({ id }) =>
  apiRequestWithFallback(
    [
      createPath("/admin/users/:id/unblock", { id }),
      createPath("/admin/users/:id/unban", { id }),
    ],
    { method: "POST", body: {} }
  );

export const addUserNote = ({ id, body }) =>
  apiRequest(createPath("/admin/users/:id/notes", { id }), {
    method: "POST",
    body,
  });

export const updateUserStatus = ({ id, status }) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "blocked" || normalized === "inactive") {
    return blockUser({ id }).catch((error) => {
      if (error?.status === 404 || error?.status === 405) {
        return apiRequestWithFallback(
          [
            createPath("/admin/users/:id/status", { id }),
            createPath("/admin/users/:id", { id }),
          ],
          {
            method: "PATCH",
            body: { status: "blocked", isBlocked: true, blocked: true },
          }
        );
      }
      throw error;
    });
  }

  if (normalized === "active" || normalized === "unblocked") {
    return unblockUser({ id }).catch((error) => {
      if (error?.status === 404 || error?.status === 405) {
        return apiRequestWithFallback(
          [
            createPath("/admin/users/:id/status", { id }),
            createPath("/admin/users/:id", { id }),
          ],
          {
            method: "PATCH",
            body: { status: "active", isBlocked: false, blocked: false },
          }
        );
      }
      throw error;
    });
  }

  return apiRequestWithFallback(
    [createPath("/admin/users/:id/status", { id })],
    {
      method: "PATCH",
      body: { status },
    }
  );
};

export const listActivities = (query = {}) =>
  apiRequestWithFallback(["/admin/activities"], { query: toListQuery(query) });

export const listEvents = (query = {}) =>
  apiRequestWithFallback(["/admin/events"], { query: toListQuery(query) });

export const getActivityById = ({ id }) =>
  apiRequest(createPath("/admin/activities/:id", { id }));

export const approveActivity = ({ id, body }) =>
  apiRequest(createPath("/admin/activities/:id/approve", { id }), {
    method: "POST",
    body,
  });

export const cancelActivity = ({ id, body }) =>
  apiRequest(createPath("/admin/activities/:id/cancel", { id }), {
    method: "POST",
    body,
  });

export const deleteActivity = ({ id }) =>
  apiRequest(createPath("/admin/activities/:id", { id }), { method: "DELETE" });

export const searchActivities = (query = {}) =>
  apiRequest("/admin/activities/search", { query: toListQuery(query) });

export const updateActivityStatus = ({ id, status, body = {} }) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "approved") return approveActivity({ id, body });
  if (normalized === "cancelled" || normalized === "canceled") {
    return cancelActivity({ id, body });
  }
  return apiRequestWithFallback(
    [createPath("/admin/activities/:id/status", { id })],
    {
      method: "PATCH",
      body: { status, ...body },
    }
  );
};

export const updateEventStatus = ({ id, status, body = {} }) =>
  apiRequestWithFallback(
    [createPath("/admin/events/:id/status", { id })],
    {
      method: "PATCH",
      body: { status, ...body },
    }
  );

export const listSubscriptions = (query = {}) =>
  apiRequestWithFallback(["/admin/subscriptions"], { query: toListQuery(query) });

export const getSubscriptionFees = () => apiRequest("/admin/subscriptions/fees");

export const updateSubscriptionFees = (body) =>
  apiRequestWithFallback(
    ["/admin/subscriptions/fees"],
    { method: "PATCH", body }
  ).catch((error) => {
    if (error?.status === 404 || error?.status === 405) {
      return apiRequest("/admin/subscriptions/fees", { method: "PUT", body });
    }
    throw error;
  });

export const getSubscriptionById = ({ id }) =>
  apiRequest(createPath("/admin/subscriptions/:id", { id }));

export const searchSubscriptions = (body) =>
  apiRequest("/admin/subscriptions/search", { method: "POST", body });

export const listAdminNotifications = (query = {}) =>
  apiRequestWithFallback(["/admin/notifications"], {
    query: toListQuery(query),
  });

export const getUnreadNotificationCount = async () => {
  try {
    const payload = await apiRequestWithFallback(["/admin/notifications/unread-count"]);
    const data = payload?.data || payload;
    return { data: { count: Number(data?.count || 0) } };
  } catch {
    const payload = await apiRequestWithFallback(["/admin/notifications"], {
      query: { page: 1, limit: 100 },
    });
    const data = payload?.data || payload;
    const items = Array.isArray(data) ? data : data?.items || data?.rows || [];
    const unread = Array.isArray(items)
      ? items.filter((item) => !(item?.isRead || item?.read)).length
      : 0;
    return { data: { count: unread } };
  }
};

export const markNotificationRead = ({ id }) =>
  apiRequestWithFallback(
    [createPath("/admin/notifications/:id/read", { id })],
    { method: "PATCH" }
  );

export const markAllNotificationsRead = () =>
  apiRequestWithFallback(["/admin/notifications/read-all"], {
    method: "PATCH",
  });

export const getSettingsProfile = () =>
  apiRequestWithFallback(["/admin/settings/profile", "/admin/profile"]);

export const updateSettingsProfile = (body) =>
  apiRequestWithFallback(["/admin/settings/profile", "/admin/profile"], {
    method: "PUT",
    body,
  });

export const getSettingsSecurity = () =>
  apiRequestWithFallback(["/admin/settings/security"]);

export const updateSettingsSecurity = (body) =>
  apiRequestWithFallback(["/admin/settings/security", "/admin/password"], {
    method: "PUT",
    body,
  });

// Newly integrated API functions for FastAPI backend compatibility
export const listAdmins = () => apiRequest("/admin/admins");

export const createAdmin = (body) =>
  apiRequest("/admin/create-admin", {
    method: "POST",
    body,
  });

export const getAiStats = () => apiRequest("/admin/ai/stats");

export const getAiLogs = (limit = 50) =>
  apiRequest("/admin/ai/logs", {
    query: { limit },
  });

export const getSuperPlatformSummary = () => apiRequest("/super/platform-summary");

export const getSuperGlobalGrowth = () => apiRequest("/super/global-growth");

export const getUserGrowth = () => apiRequest("/admin/users-growth");

export const getSettingsContent = (type) =>
  apiRequest("/admin/settings/content", {
    query: { type },
  });

export const updateSettingsContent = (body) =>
  apiRequest("/admin/settings/content", {
    method: "POST",
    body,
  });

