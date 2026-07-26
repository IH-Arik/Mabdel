import { apiRequest, createPath } from "./httpClient";

export const listMyAvailabilitySlots = (query = {}) =>
  apiRequest("/dashboard/availability-slots", { query });

export const createAvailabilitySlots = (slots) =>
  apiRequest("/dashboard/availability-slots", { method: "POST", body: { slots } });

export const deleteAvailabilitySlot = (slotId) =>
  apiRequest(createPath("/dashboard/availability-slots/:slotId", { slotId }), { method: "DELETE" });
