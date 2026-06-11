import {
  adminCreateProduct,
  adminDeleteProduct,
  adminListProducts,
  adminToggleProductStatus,
  adminUpdateProduct,
} from "./shopApi";

export const listAds = (query = {}) => adminListProducts(query);

export const createAd = (body) => adminCreateProduct(body);

export const updateAd = ({ id, body }) =>
  adminUpdateProduct({ productId: id, body });

export const deleteAd = ({ id }) =>
  adminDeleteProduct({ productId: id });

export const updateAdStatus = ({ id, body }) =>
  adminToggleProductStatus({
    productId: id,
    status: body?.status ?? body?.isActive ?? body,
  });
