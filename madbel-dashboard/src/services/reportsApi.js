import { apiRequest, apiRequestWithFallback, createPath } from "./httpClient";

const toListQuery = (query = {}) => ({ ...query });

export const listAdminReports = async (query = {}) => {
  const queryCandidates = [
    { ...toListQuery(query) },
    { page: query.page, limit: query.limit },
    { page: query.page, pageSize: query.limit ?? query.pageSize },
  ];

  for (const candidateQuery of queryCandidates) {
    try {
      return await apiRequestWithFallback(
        ["/admin/reports", "/reports/admin"],
        { query: candidateQuery }
      );
    } catch (error) {
      if (error?.status !== 404 && error?.status !== 400) {
        throw error;
      }
    }
  }

  return apiRequest("/reports/admin", { query: { page: 1, limit: 10 } });
};

export const resolveAdminReport = ({ reportId, body = {} }) =>
  apiRequest(createPath("/admin/reports/:reportId/resolve", { reportId }), {
    method: "POST",
    body,
  }).catch((error) => {
    if (error?.status === 404 || error?.status === 405) {
      return apiRequest(createPath("/reports/admin/:reportId/status", { reportId }), {
        method: "PATCH",
        body: { status: "resolved", ...body },
      });
    }
    throw error;
  });

export const dismissAdminReport = ({ reportId, body = {} }) =>
  apiRequest(createPath("/admin/reports/:reportId/dismiss", { reportId }), {
    method: "POST",
    body,
  });

export const applyAdminReportAction = ({ reportId, action, note }) =>
  apiRequest(createPath("/admin/reports/:reportId/action", { reportId }), {
    method: "POST",
    body: { action, ...(note ? { note } : {}) },
  });

export const updateAdminReportStatus = ({ reportId, status, body = {} }) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "dismissed") return dismissAdminReport({ reportId, body });
  return resolveAdminReport({ reportId, body: { status, ...body } });
};
