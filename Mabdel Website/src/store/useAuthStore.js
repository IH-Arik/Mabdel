import { create } from 'zustand';
import client from '../api/client';

export const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('access_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await client.post('/api/v1/auth/login', { email, password });
      const { access_token, user } = response.data.data;
      
      localStorage.setItem('access_token', access_token);
      set({ user, token: access_token, isAuthenticated: true, isLoading: false });
      return true;
    } catch (error) {
      const message = error.response?.data?.message
        || (error.request ? 'Backend is not reachable. Start the API server and try again.' : 'Login failed');
      set({ error: message, isLoading: false });
      return false;
    }
  },

  register: async (userData) => {
    set({ isLoading: true, error: null });
    try {
      await client.post('/api/v1/auth/register', userData);
      set({ isLoading: false });
      return true;
    } catch (error) {
      set({ error: error.response?.data?.message || 'Registration failed', isLoading: false });
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    if (!localStorage.getItem('access_token')) return;
    try {
      const response = await client.get('/api/v1/auth/me');
      set({ user: response.data.data, isAuthenticated: true });
    } catch {
      localStorage.removeItem('access_token');
      set({ isAuthenticated: false });
    }
  }
}));
