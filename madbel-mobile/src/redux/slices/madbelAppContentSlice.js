import { baseApi } from "../baseApi.js";
import { buildAppContentEndpoints } from "./madbelApi/endpoints/appContentEndpoints.js";

export const madbelAppContentSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    ...buildAppContentEndpoints(builder),
  }),
  overrideExisting: false,
});

export const {
  useMadbelGetAppConfigQuery,
  useLazyMadbelGetAppConfigQuery,
  useMadbelGetOnboardingSlidesQuery,
  useLazyMadbelGetOnboardingSlidesQuery,
  useMadbelGetOnboardingProgressQuery,
  useLazyMadbelGetOnboardingProgressQuery,
  useMadbelSaveOnboardingProgressMutation,
  useMadbelSkipOnboardingMutation,
  useMadbelCompleteOnboardingMutation,
  useMadbelResetOnboardingMutation,
  useMadbelGetContentPageQuery,
  useLazyMadbelGetContentPageQuery,
  useMadbelGetAboutUsQuery,
  useLazyMadbelGetAboutUsQuery,
  useMadbelGetTermsAndConditionsQuery,
  useLazyMadbelGetTermsAndConditionsQuery,
  useMadbelGetPrivacyPolicyQuery,
  useLazyMadbelGetPrivacyPolicyQuery,
  useMadbelGetHelpSupportQuery,
  useLazyMadbelGetHelpSupportQuery,
  useMadbelRunAiCommandMutation,
} = madbelAppContentSlice;
