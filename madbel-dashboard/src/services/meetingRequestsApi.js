import { apiRequest, createPath } from "./httpClient";

export const listMeetingRequests = (query = {}) =>
  apiRequest("/dashboard/meeting-requests", { query });

export const getMeetingRequest = (requestId) =>
  apiRequest(createPath("/dashboard/meeting-requests/:requestId", { requestId }));

export const acceptMeetingRequest = (requestId) =>
  apiRequest(createPath("/dashboard/meeting-requests/:requestId/accept", { requestId }), {
    method: "POST",
  });

export const proposeMeetingTime = ({ requestId, proposedStart, proposedEnd, note }) =>
  apiRequest(createPath("/dashboard/meeting-requests/:requestId/propose", { requestId }), {
    method: "POST",
    body: { proposed_start: proposedStart, proposed_end: proposedEnd, note },
  });

export const declineMeetingRequest = (requestId) =>
  apiRequest(createPath("/dashboard/meeting-requests/:requestId/decline", { requestId }), {
    method: "POST",
  });
