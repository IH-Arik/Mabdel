import { apiRequest } from "./httpClient";

export const listTelnyxNumbers = () => apiRequest("/admin/telnyx-numbers");
export const releaseTelnyxNumber = (phoneNumberId) =>
  apiRequest(`/admin/telnyx-numbers/${encodeURIComponent(phoneNumberId)}`, { method: "DELETE" });
export const assignTelnyxNumber = (phoneNumberId, organizationId) =>
  apiRequest(`/admin/telnyx-numbers/${encodeURIComponent(phoneNumberId)}/assign`, {
    method: "PATCH",
    body: { organization_id: organizationId },
  });
