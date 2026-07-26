import { apiRequest, createPath } from "./httpClient";

export const listDemoRequests = (query = {}) =>
  apiRequest("/dashboard/demo-requests", { query });

export const getDemoRequest = (requestId) =>
  apiRequest(createPath("/dashboard/demo-requests/:requestId", { requestId }));

export const replyToDemoRequest = ({ requestId, message }) =>
  apiRequest(createPath("/dashboard/demo-requests/:requestId/reply", { requestId }), {
    method: "POST",
    body: { message },
  });

export const updateDemoRequestStatus = ({ requestId, status }) =>
  apiRequest(createPath("/dashboard/demo-requests/:requestId/status", { requestId }), {
    method: "PATCH",
    body: { status },
  });
