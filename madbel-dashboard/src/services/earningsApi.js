import { apiRequestWithFallback, createPath } from "./httpClient";

const toListQuery = (query = {}) => ({
  ...query,
  pageSize: query.pageSize ?? query.limit,
});

export const listEarningTransactions = (query = {}) =>
  apiRequestWithFallback(
    ["/admin/earnings/transactions", "/billing/admin/transactions"],
    { query: toListQuery(query) }
  );

export const getEarningTransactionById = ({ id }) =>
  apiRequestWithFallback([
    createPath("/admin/earnings/transactions/:id", { id }),
  ]);

export const generateEarningInvoice = ({ id, body = {} }) =>
  apiRequestWithFallback(
    [createPath("/admin/earnings/transactions/:id/invoice", { id })],
    {
      method: "POST",
      body,
    }
  );
