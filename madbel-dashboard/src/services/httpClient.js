import {
  clearAdminSession,
  getAdminSession,
  isTokenExpired,
} from "../utils/auth";
import { getStaticMockResponse } from "./staticMockApi";

const DEFAULT_API_BASE_URL = "http://localhost:5191";
const DEFAULT_API_PREFIX = "/api/v1";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
const API_PREFIX = import.meta.env.VITE_API_PREFIX?.trim() || DEFAULT_API_PREFIX;
const STATIC_MODE = import.meta.env.VITE_STATIC_MODE !== "false";

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export const buildApiUrl = (path, { skipPrefix = false } = {}) => {
  let mappedPath = path.startsWith("/") ? path : `/${path}`;

  // Path translation mapper for FastAPI backend dashboard compatibility
  // Backend runs at /api/v1/admin/... and /api/v1/rbac/... (no /dashboard/ infix)
  if (mappedPath.startsWith("/admin/notifications")) {
    mappedPath = mappedPath.replace("/admin/notifications", "/notifications");
  } else if (mappedPath === "/admin/password" || mappedPath === "/auth/admin/change-password") {
    mappedPath = "/admin/change-password";
  } else if (mappedPath.startsWith("/auth/admin/logout")) {
    mappedPath = "/admin/logout";
  } else if (mappedPath.startsWith("/auth/admin/")) {
    mappedPath = mappedPath.replace("/auth/admin/", "/admin/auth/");
  } else if (mappedPath.startsWith("/cms/admin/")) {
    mappedPath = "/admin/settings/content";
  } else if (mappedPath.startsWith("/reports/admin")) {
    mappedPath = mappedPath.replace("/reports/admin", "/admin/reports");
  } else if (mappedPath.startsWith("/billing/admin/transactions")) {
    mappedPath = "/admin/earnings/transactions";
  } else if (mappedPath.startsWith("/admin/dashboard/overview") || mappedPath.startsWith("/dashboard/overview")) {
    mappedPath = "/admin/summary";
  } else if (mappedPath.startsWith("/admin/dashboard/analytics") || mappedPath.startsWith("/dashboard/analytics")) {
    mappedPath = "/admin/summary";
  } else if (mappedPath.startsWith("/admin/dashboard/recent-users")) {
    mappedPath = "/admin/users";
  } else if (mappedPath.startsWith("/admin/dashboard/notifications/preview")) {
    mappedPath = "/notifications";
  }

  const prefixedPath = skipPrefix || mappedPath.startsWith("/api/")
    ? mappedPath
    : `${API_PREFIX.replace(/\/+$/, "")}${mappedPath}`;

  return `${API_BASE_URL.replace(/\/+$/, "")}${prefixedPath}`;
};

export const createPath = (template, params = {}) => {
  return Object.entries(params).reduce((acc, [key, value]) => {
    const encoded = encodeURIComponent(String(value));
    return acc.replaceAll(`:${key}`, encoded);
  }, template);
};

const appendQuery = (path, query = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        searchParams.append(key, String(entry));
      });
      return;
    }

    searchParams.append(key, String(value));
  });

  const queryString = searchParams.toString();
  if (!queryString) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${queryString}`;
};

const parseResponse = async (response) => {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : {};
};

export const extractApiErrorMessage = (payload) => {
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    return payload.errors[0]?.message;
  }

  return payload?.message || payload?.error;
};

export const apiRequest = async (
  path,
  {
    method = "GET",
    query,
    body,
    headers = {},
    auth = true,
    contentType = "application/json",
  } = {}
) => {
  if (STATIC_MODE) {
    return getStaticMockResponse(path, { method, query, body });
  }

  const redirectToSignIn = () => {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/sign-in") {
      window.location.replace("/sign-in");
    }
  };

  const finalPath = appendQuery(path, query);
  const session = getAdminSession();
  const token = session?.accessToken;

  const requestHeaders = { ...headers };

  if (auth && !token) {
    clearAdminSession();
    redirectToSignIn();
    throw new ApiError("Unauthorized. Please sign in again.", 401, {
      message: "Missing access token",
    });
  }

  if (auth && isTokenExpired(token)) {
    clearAdminSession();
    redirectToSignIn();
    throw new ApiError("Session expired. Please sign in again.", 401, {
      message: "Token expired",
    });
  }

  if (auth && token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  const hasFormDataBody = body instanceof FormData;
  if (!hasFormDataBody && body !== undefined && contentType) {
    requestHeaders["Content-Type"] = contentType;
  }

  const performFetch = async (skipPrefix = false) =>
    fetch(buildApiUrl(finalPath, { skipPrefix }), {
      method,
      headers: requestHeaders,
      body:
        body === undefined
          ? undefined
          : hasFormDataBody || contentType !== "application/json"
            ? body
            : JSON.stringify(body),
    });

  let response = await performFetch(false);
  let payload = await parseResponse(response);

  // Local backends sometimes expose routes without /api/v1 prefix.
  if (
    !response.ok &&
    response.status === 404 &&
    API_PREFIX &&
    !finalPath.startsWith("/api/")
  ) {
    response = await performFetch(true);
    payload = await parseResponse(response);
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearAdminSession();
      redirectToSignIn();
    }

    if (response.status === 403 && payload?.code === "SUBSCRIPTION_REQUIRED") {
      window.dispatchEvent(new CustomEvent("subscription-required", { detail: payload }));
    }

    throw new ApiError(
      extractApiErrorMessage(payload) || "Request failed",
      response.status,
      payload
    );
  }

  return payload;
};

export const apiRequestWithFallback = async (paths, options = {}) => {
  const candidates = Array.isArray(paths) ? paths : [paths];
  let lastError = null;

  for (const candidate of candidates) {
    try {
      return await apiRequest(candidate, options);
    } catch (error) {
      lastError = error;
      if (error?.status !== 404 && error?.status !== 405) {
        throw error;
      }
    }
  }

  throw lastError || new Error("Request failed");
};
