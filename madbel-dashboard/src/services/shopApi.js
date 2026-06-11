import { apiRequest, createPath } from "./httpClient";

export const adminListProducts = (query = {}) =>
  apiRequest("/shop/admin/products", { query });

export const adminListProductsTable = (query = {}) =>
  apiRequest("/shop/admin/products/table", { query });

export const adminCreateProduct = (body) =>
  apiRequest("/shop/admin/products", {
    method: "POST",
    body,
    contentType: body instanceof FormData ? null : "application/json",
  });

export const adminUpdateProduct = ({ productId, body }) =>
  apiRequest(createPath("/shop/admin/products/:productId", { productId }), {
    method: "PATCH",
    body,
    contentType: body instanceof FormData ? null : "application/json",
  });

export const adminToggleProductStatus = ({ productId, status }) =>
  apiRequest(
    createPath("/shop/admin/products/:productId/status", { productId }),
    { method: "PATCH", body: { isActive: Boolean(status) } }
  );

export const adminDeleteProduct = ({ productId }) =>
  apiRequest(createPath("/shop/admin/products/:productId", { productId }), {
    method: "DELETE",
  });

export const listShopProducts = (query = {}) =>
  apiRequest("/shop/products", { query, auth: false });

export const getShopProduct = ({ id }) =>
  apiRequest(createPath("/shop/products/:id", { id }), { auth: false });

export const createShopProduct = (body) =>
  apiRequest("/shop/products", { method: "POST", body });

export const updateShopProduct = ({ id, body }) =>
  apiRequest(createPath("/shop/products/:id", { id }), {
    method: "PATCH",
    body,
  });

export const deleteShopProduct = ({ id }) =>
  apiRequest(createPath("/shop/products/:id", { id }), { method: "DELETE" });

export const getCart = () => apiRequest("/shop/cart");

export const addCartItem = (body) =>
  apiRequest("/shop/cart/items", { method: "POST", body });

export const updateCartItem = ({ productId, body }) =>
  apiRequest(createPath("/shop/cart/items/:productId", { productId }), {
    method: "PATCH",
    body,
  });

export const removeCartItem = ({ productId }) =>
  apiRequest(createPath("/shop/cart/items/:productId", { productId }), {
    method: "DELETE",
  });

export const checkout = (body) =>
  apiRequest("/shop/checkout", { method: "POST", body });
