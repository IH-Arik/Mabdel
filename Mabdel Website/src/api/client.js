import axios from 'axios';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL;
const isLocalHost = typeof window !== 'undefined' && ['127.0.0.1', 'localhost'].includes(window.location.hostname);
const API_BASE_URL = isLocalHost && configuredBaseUrl?.includes(':18000')
  ? 'http://127.0.0.1:8001'
  : (configuredBaseUrl || 'http://127.0.0.1:8001');

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Access tokens are short-lived (30 min); silently exchange the refresh token
// for a new one on a 401 instead of just logging the user out mid-session.
let refreshInFlight = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token available.');
  const response = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh-token`, { refresh_token: refreshToken });
  const { access_token, refresh_token } = response.data.data;
  localStorage.setItem('access_token', access_token);
  if (refresh_token) localStorage.setItem('refresh_token', refresh_token);
  return access_token;
}

// Response interceptor for handling common errors
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh-token');
    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      originalRequest._retry = true;
      try {
        refreshInFlight = refreshInFlight || refreshAccessToken();
        const newAccessToken = await refreshInFlight;
        refreshInFlight = null;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return client(originalRequest);
      } catch {
        refreshInFlight = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default client;
