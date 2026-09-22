import { create } from 'zustand';

// Populated by api/client.js's response interceptor whenever a request comes
// back with error.code SUBSCRIPTION_EXPIRED or PLAN_UPGRADE_REQUIRED (see
// app/core/exceptions.py's AppException shape on the backend). MainLayout
// renders a persistent banner from this instead of every page having to
// special-case those two error codes itself.
export const useSubscriptionStore = create((set) => ({
  lockNotice: null, // { code, message, details } | null

  setLockNotice: (notice) => set({ lockNotice: notice }),
  clearLockNotice: () => set({ lockNotice: null }),
}));
