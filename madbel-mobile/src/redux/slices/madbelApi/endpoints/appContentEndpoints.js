import { buildApiRequest } from "../../../apiUtils.js";

export const buildAppContentEndpoints = (builder) => ({
  madbelGetAppConfig: builder.query({
    query: buildApiRequest({
      path: "/api/v1/app/config",
      method: "GET",
      queryParams: ["current_version", "user_id", "device_id"],
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelAppConfig", id: "LIST" }],
  }),

  madbelGetOnboardingSlides: builder.query({
    query: buildApiRequest({
      path: "/api/v1/onboarding/slides",
      method: "GET",
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelOnboarding", id: "LIST" }],
  }),

  madbelGetOnboardingProgress: builder.query({
    query: buildApiRequest({
      path: "/api/v1/onboarding/progress",
      method: "GET",
      queryParams: ["user_id", "device_id"],
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelOnboarding", id: "LIST" }],
  }),

  madbelSaveOnboardingProgress: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/onboarding/progress",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelOnboarding", id: "LIST" }],
  }),

  madbelSkipOnboarding: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/onboarding/skip",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelOnboarding", id: "LIST" }],
  }),

  madbelCompleteOnboarding: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/onboarding/complete",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelOnboarding", id: "LIST" }],
  }),

  madbelResetOnboarding: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/onboarding/reset",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelOnboarding", id: "LIST" }],
  }),

  madbelGetContentPage: builder.query({
    query: buildApiRequest({
      path: "/api/v1/content/pages/{slug}",
      method: "GET",
      pathParams: ["slug"],
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelContent", id: "LIST" }],
  }),

  madbelGetAboutUs: builder.query({
    query: buildApiRequest({
      path: "/api/v1/content/about-us",
      method: "GET",
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelContent", id: "LIST" }],
  }),

  madbelGetTermsAndConditions: builder.query({
    query: buildApiRequest({
      path: "/api/v1/content/terms-and-conditions",
      method: "GET",
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelContent", id: "LIST" }],
  }),

  madbelGetPrivacyPolicy: builder.query({
    query: buildApiRequest({
      path: "/api/v1/content/privacy-policy",
      method: "GET",
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelContent", id: "LIST" }],
  }),

  madbelGetHelpSupport: builder.query({
    query: buildApiRequest({
      path: "/api/v1/content/help-support",
      method: "GET",
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelContent", id: "LIST" }],
  }),

  madbelRunAiCommand: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/ai/command",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelAI", id: "LIST" }],
  }),
});
