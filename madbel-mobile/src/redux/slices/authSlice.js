import {
  clearAuth,
  setCredentials,
  setResetOtp,
  setToken,
} from "../reducers/authReducer.js";
import { baseApi } from "../baseApi.js";
import { getApiData, getAuthTokens } from "../apiUtils.js";

const skipAuthHeaders = { "x-skip-auth": "true" };

const normalizeLoginPayload = (credentials = {}) => ({
  email: credentials.email || credentials.loginEmail,
  password: credentials.password || credentials.loginPassword,
});

const normalizeRegisterPayload = (credentials = {}) => ({
  full_name: credentials.full_name || credentials.fullName,
  email: credentials.email || credentials.regEmail,
  password: credentials.password || credentials.regPassword,
});

const normalizeOtpPayload = (credentials = {}, fallbackPurpose = "signup") => ({
  email: credentials.email,
  code: credentials.code || credentials.otp,
  purpose: credentials.purpose || fallbackPurpose,
});

export const authSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/auth/login",
        method: "POST",
        body: normalizeLoginPayload(credentials),
        headers: skipAuthHeaders,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const tokens = getAuthTokens(data);

          if (tokens.accessToken) {
            dispatch(setToken(tokens.accessToken));
          }

          dispatch(
            setCredentials({
              accessToken: tokens.accessToken,
              refreshToken: tokens.refreshToken,
              user: tokens.user,
            }),
          );
        } catch (error) {
          console.log(error);
        }
      },
    }),

    register: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/auth/register",
        method: "POST",
        body: normalizeRegisterPayload(credentials),
        headers: skipAuthHeaders,
      }),
      // async onQueryStarted(arg, { dispatch, queryFulfilled }) {
      //   try {
      //     const { data } = await queryFulfilled;
      //     console.log("Login data:", data?.data);
      //     // dispatch(setToken(data.refresh));
      //     // dispatch(setUser(jwtDecode(data?.data?.accessToken)));
      //     // dispatch(setToken(data?.data?.accessToken)); // ✅ store ACCESS token, not refresh
      //     // dispatch(setUser(jwtDecode(data.access))); // optional

      //     dispatch(
      //       setCredentials({
      //         accessToken: data?.data?.accessToken,
      //         user: jwtDecode(data?.data?.accessToken),
      //       })
      //     );
      //   } catch (error) {
      //     console.log(error);
      //   }
      // },
    }),

    verifyCode: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/auth/verify-otp",
        method: "POST",
        body: normalizeOtpPayload(credentials, "signup"),
        headers: skipAuthHeaders,
      }),
    }),

    logout: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/auth/logout",
        method: "POST",
        body: credentials,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch(clearAuth());
        }
      },
    }),

    forgotPassword: builder.mutation({
      query: (credentials = {}) => ({
        url: "/api/v1/auth/forgot-password",
        method: "POST",
        body: {
          email: credentials.email || credentials.forgotEmail,
        },
        headers: skipAuthHeaders,
      }),
    }),

    forgotPasswordVerifyCode: builder.mutation({
      query: (credentials) => ({
        url: "/api/v1/auth/verify-otp",
        method: "POST",
        body: normalizeOtpPayload(credentials, "forgot_password"),
        headers: skipAuthHeaders,
      }),
      async onQueryStarted(arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          const resetToken = data?.data?.reset_token || data?.reset_token;
          if (resetToken) {
            dispatch(setResetOtp(resetToken));
          }
        } catch (error) {
          console.log(error);
        }
      },
    }),

    resetPassword: builder.mutation({
      query: (credentials = {}) => ({
        url: "/api/v1/auth/reset-password",
        method: "POST",
        body: {
          email: credentials.email,
          reset_token:
            credentials.reset_token || credentials.resetToken || credentials.otp,
          new_password: credentials.new_password || credentials.newPassword,
          confirm_password:
            credentials.confirm_password ||
            credentials.confirmPassword ||
            credentials.newConfirmPassword ||
            credentials.new_password ||
            credentials.newPassword,
        },
        headers: skipAuthHeaders,
      }),
    }),

    changePassword: builder.mutation({
      query: (credentials = {}) => ({
        url: "/api/v1/smartflow/settings/change-password",
        method: "POST",
        body: {
          current_password:
            credentials.current_password || credentials.currentPassword,
          new_password: credentials.new_password || credentials.newPassword,
          confirm_password:
            credentials.confirm_password || credentials.confirmPassword,
        },
      }),
    }),

    getMyNotifications: builder.query({
      query: (params) => ({
        url: "/api/v1/smartflow/notifications",
        params,
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "NOTIFICATIONS" }],
    }),

    getCategories: builder.query({
      query: () => "/api/v1/smartflow/reports/categories",
      providesTags: [{ type: "MadbelSmartFlow", id: "REPORT_CATEGORIES" }],
    }),

    getLocations: builder.query({
      query: (params) => ({
        url: "/api/v1/smartflow/calendar/events",
        params,
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "CALENDAR_EVENTS" }],
    }),

    getUserProfile: builder.query({
      query: () => ({ url: "/api/v1/auth/me" }),
      providesTags: [{ type: "UserProfile", id: "ME" }],
    }),

    lazyGetUserProfile: builder.query({
      query: () => "/api/v1/auth/me",
      transformResponse: (response) => response,
      providesTags: [{ type: "UserProfile", id: "ME" }],
    }),

    editProfile: builder.mutation({
      query: (credentials = {}) => ({
        url: "/api/v1/smartflow/settings",
        method: "PATCH",
        body: {
          full_name:
            credentials.full_name ||
            credentials.fullName ||
            credentials.profileFullName,
          email: credentials.email,
          avatar_url:
            credentials.avatar_url ||
            credentials.avatarUrl ||
            credentials.profileImage,
          date_of_birth:
            credentials.date_of_birth ||
            credentials.dateOfBirth ||
            credentials.dob,
          country: credentials.country,
          language_preference:
            credentials.language_preference || credentials.languagePreference,
          notification_preferences:
            credentials.notification_preferences ||
            credentials.notificationPreferences,
        },
      }),
      // async onQueryStarted(arg, { dispatch, queryFulfilled }) {
      //   try {
      //     const { data } = await queryFulfilled;
      //     console.log("Profile updated successfully:", data);

      //     // Update the cached profile data
      //     dispatch(
      //       authSlice.util.updateQueryData("getProfile", undefined, (draft) => {
      //         Object.assign(draft, data?.data);
      //       }),
      //     );

      //     // Also update user in credentials if needed
      //     if (data?.data) {
      //       dispatch(
      //         setCredentials({
      //           accessToken: data?.data?.accessToken || undefined,
      //           user: data?.data,
      //         }),
      //       );
      //     }
      //   } catch (error) {
      //     console.error("Error updating profile:", error);
      //     throw error;
      //   }
      // },
      invalidatesTags: [{ type: "UserProfile", id: "ME" }],
    }),

    getProfile: builder.query({
      query: () => `/api/v1/auth/me`,
      async onQueryStarted(arg, { dispatch, queryFulfilled, getState }) {
        try {
          const { data } = await queryFulfilled;
          const profile = getApiData(data);

          if (profile) {
            dispatch(
              setCredentials({
                accessToken: getState()?.auth?.accessToken,
                refreshToken: getState()?.auth?.refreshToken,
                user: profile,
              }),
            );
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
          throw error;
        }
      },
      providesTags: [{ type: "UserProfile", id: "ME" }],
    }),
  }),

  overrideExisting: true,
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useVerifyCodeMutation,
  useForgotPasswordMutation,
  useForgotPasswordVerifyCodeMutation,
  useLogoutMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useGetMyNotificationsQuery,
  useGetCategoriesQuery,
  useEditProfileMutation,
  useGetProfileQuery,
  useGetLocationsQuery,

  useGetUserProfileQuery,
  useLazyGetUserProfileQuery,
} = authSlice;
