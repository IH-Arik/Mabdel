import { apiRequest, createPath } from "./httpClient";

const toListQuery = (query = {}) => ({
  ...query,
});

export const listAdminActivities = (query = {}) =>
  apiRequest("/admin/activities", { query: toListQuery(query) });

export const getAdminActivityById = ({ id }) =>
  apiRequest(createPath("/admin/activities/:id", { id }));

export const approveAdminActivity = ({ id, body = {} }) =>
  apiRequest(createPath("/admin/activities/:id/approve", { id }), {
    method: "POST",
    body,
  });

export const cancelAdminActivity = ({ id, body = {} }) =>
  apiRequest(createPath("/admin/activities/:id/cancel", { id }), {
    method: "POST",
    body,
  });

export const deleteAdminActivity = ({ id }) =>
  apiRequest(createPath("/admin/activities/:id", { id }), {
    method: "DELETE",
  });

export const searchAdminActivities = (query = {}) =>
  apiRequest("/admin/activities/search", { query: toListQuery(query) });
