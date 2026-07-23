import { create } from 'zustand';
import { smartflowApi } from '../api/services';

function getNotificationSummary(response) {
  return response?.data?.data?.summary || response?.data?.summary || {};
}

export const useNotificationStore = create((set) => ({
  unreadCount: 0,
  isSyncing: false,
  error: null,

  setUnreadCount: (value) =>
    set({
      unreadCount: Math.max(0, Number(value) || 0),
      error: null,
    }),

  syncUnreadCount: async () => {
    set({ isSyncing: true, error: null });
    try {
      const response = await smartflowApi.getNotifications({ page: 1, page_size: 1 });
      const summary = getNotificationSummary(response);
      const unreadCount = Number(summary.unread_count ?? summary.new_count ?? 0) || 0;
      set({ unreadCount, isSyncing: false, error: null });
      return unreadCount;
    } catch (error) {
      set({ isSyncing: false, error: error?.response?.data?.message || 'Could not sync notifications.' });
      throw error;
    }
  },
}));
