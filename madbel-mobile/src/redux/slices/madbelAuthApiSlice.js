import { baseApi } from "../baseApi.js";
import { buildAuthEndpoints } from "./madbelApi/endpoints/authEndpoints.js";

export const madbelAuthApiSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    ...buildAuthEndpoints(builder),
  }),
  overrideExisting: false,
});

export const {
  useMadbelRegisterMutation,
  useMadbelLoginMutation,
  useMadbelSendOtpMutation,
  useMadbelResendOtpMutation,
  useMadbelVerifyOtpMutation,
  useMadbelForgotPasswordMutation,
  useMadbelResetPasswordMutation,
  useMadbelRefreshTokenMutation,
  useMadbelGoogleLoginMutation,
  useMadbelMeQuery,
  useLazyMadbelMeQuery,
  useMadbelLogoutMutation,
} = madbelAuthApiSlice;
