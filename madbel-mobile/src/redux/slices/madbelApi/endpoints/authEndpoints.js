import { buildApiRequest, getAuthTokens } from "../../../apiUtils.js";
import {
  clearAuth,
  setCredentials,
  setToken,
} from "../../../reducers/authReducer.js";

const storeAuthTokens = async (queryFulfilled, dispatch, getState) => {
  const { data } = await queryFulfilled;
  const tokens = getAuthTokens(data);

  if (tokens.accessToken) {
    dispatch(setToken(tokens.accessToken));
    dispatch(
      setCredentials({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken || getState()?.auth?.refreshToken,
        user: tokens.user || getState()?.auth?.user,
      }),
    );
  }
};

export const buildAuthEndpoints = (builder) => ({
  madbelRegister: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/register",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelLogin: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/login",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
      try {
        await storeAuthTokens(queryFulfilled, dispatch, getState);
      } catch {
        // The mutation result already carries the API error for the caller.
      }
    },
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelSendOtp: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/send-otp",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelResendOtp: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/resend-otp",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelVerifyOtp: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/verify-otp",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelForgotPassword: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/forgot-password",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelResetPassword: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/reset-password",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelRefreshToken: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/refresh-token",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
      try {
        await storeAuthTokens(queryFulfilled, dispatch, getState);
      } catch {
        // The mutation result already carries the API error for the caller.
      }
    },
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelGoogleLogin: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/google",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    async onQueryStarted(arg, { dispatch, getState, queryFulfilled }) {
      try {
        await storeAuthTokens(queryFulfilled, dispatch, getState);
      } catch {
        // The mutation result already carries the API error for the caller.
      }
    },
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelMe: builder.query({
    query: buildApiRequest({
      path: "/api/v1/auth/me",
      method: "GET",
    }),
    providesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),

  madbelLogout: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/auth/logout",
      method: "POST",
    }),
    async onQueryStarted(arg, { dispatch, queryFulfilled }) {
      try {
        await queryFulfilled;
      } finally {
        dispatch(clearAuth());
      }
    },
    invalidatesTags: [{ type: "MadbelAuthentication", id: "LIST" }],
  }),
});
