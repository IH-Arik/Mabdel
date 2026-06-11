import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { clearAuth, setCredentials } from "./reducers/authReducer.js";
import { API_BASE_URL, getAuthTokens } from "./apiUtils.js";

export const baseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers, { getState }) => {
    const skipAuth = headers.get("x-skip-auth") === "true";
    headers.delete("x-skip-auth");
    headers.set("Accept", "application/json");
    headers.set("ngrok-skip-browser-warning", "true");

    if (!skipAuth) {
      const token = getState().auth.accessToken || getState().auth.token;

      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
    }

    return headers;
  },
  credentials: "include",
});

const normalizeApiPath = (url) => {
  if (typeof url !== "string" || !url.startsWith("/")) return url;
  if (url.startsWith("/api/") || url === "/health" || url === "/ready") {
    return url;
  }
  return `/api/v1${url}`;
};

const normalizeBaseQueryArgs = (args) => {
  if (typeof args === "string") return normalizeApiPath(args);
  if (!args || typeof args !== "object") return args;
  return {
    ...args,
    url: normalizeApiPath(args.url),
  };
};

export const baseQueryWithReauth = async (args, api, extraOptions) => {
  const requestArgs = normalizeBaseQueryArgs(args);
  let result = await baseQuery(requestArgs, api, extraOptions);

  if (result.error && result.error.status === 401) {
    const refreshToken = api.getState().auth.refreshToken;

    if (!refreshToken) {
      api.dispatch(clearAuth());
      return result;
    }

    const refreshResult = await baseQuery(
      {
        url: "/api/v1/auth/refresh-token",
        method: "POST",
        body: { refresh_token: refreshToken },
        headers: { "x-skip-auth": "true" },
      },
      api,
      extraOptions,
    );

    const tokens = getAuthTokens(refreshResult.data);

    if (tokens.accessToken) {
      api.dispatch(
        setCredentials({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || refreshToken,
          user: tokens.user || api.getState().auth.user,
        }),
      );

      result = await baseQuery(requestArgs, api, extraOptions);
    } else {
      api.dispatch(clearAuth());
    }
  }

  return result;
};
