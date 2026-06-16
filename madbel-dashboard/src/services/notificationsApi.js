import { apiRequest, createPath } from "./httpClient";

const toListQuery = (query = {}) => ({
  ...query,
  pageSize: query.pageSize ?? query.limit,
});

export const getNotificationsPreview = (query = {}) =>
  apiRequest("/admin/notifications", {
    query: { context: "preview", ...toListQuery(query) },
  });

export const listNotifications = (query = {}) =>
  apiRequest("/admin/notifications", {
    query: { context: "full", ...toListQuery(query) },
  });

const patchOrPost = (path, options = {}) =>
  apiRequest(path, { method: "PATCH", ...options }).catch((error) => {
    if (error?.status === 405 || error?.status === 404) {
      return apiRequest(path, { method: "POST", ...options });
    }
    throw error;
  });

export const markNotificationsRead = (body = {}) => {
  if (body?.all || body?.markAll) {
    return patchOrPost("/admin/notifications/read-all");
  }

  const ids = Array.isArray(body?.ids)
    ? body.ids.filter(Boolean)
    : body?.id
      ? [body.id]
      : [];

  if (ids.length === 1) {
    return patchOrPost(createPath("/admin/notifications/:id/read", { id: ids[0] }));
  }

  if (ids.length > 1) {
    return Promise.all(
      ids.map((id) =>
        patchOrPost(createPath("/admin/notifications/:id/read", { id }))
      )
    );
  }

  return patchOrPost("/admin/notifications/read-all");
};

export const listAdminNotifications = (query = {}) => listNotifications(query);

export const getUnreadNotificationCount = async () => {
  try {
    const payload = await apiRequest("/admin/notifications/unread-count");
    const data = payload?.data || payload;
    return { data: { count: Number(data?.count || data || 0) } };
  } catch {
    const payload = await listNotifications({ page: 1, limit: 100 });
    const data = payload?.data || payload;
    const items = Array.isArray(data) ? data : data?.items || data?.rows || [];
    const unread = Array.isArray(items)
      ? items.filter((item) => !(item?.isRead || item?.read)).length
      : 0;
    return { data: { count: unread } };
  }
};

export const markNotificationRead = ({ id }) =>
  markNotificationsRead({ id });

export const markAllNotificationsRead = () =>
  markNotificationsRead({ all: true });
