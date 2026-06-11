import { apiRequest, apiRequestWithFallback, createPath } from "./httpClient";

export const createCategory = (body) =>
  apiRequest("/admin/categories", { method: "POST", body });

export const listCategories = (query = {}) =>
  apiRequest("/admin/categories", { query });

export const updateCategory = ({ id, body }) =>
  apiRequestWithFallback(
    [createPath("/admin/categories/:id", { id })],
    { method: "PATCH", body }
  ).catch((error) => {
    if (error?.status === 404 || error?.status === 405) {
      return apiRequest(createPath("/admin/categories/:id", { id }), {
        method: "PUT",
        body,
      });
    }
    throw error;
  });

export const deleteCategory = ({ id }) =>
  apiRequest(createPath("/admin/categories/:id", { id }), {
    method: "DELETE",
  });
