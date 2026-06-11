import { baseApi } from "../baseApi.js";
import { buildCompatibilityEndpoints } from "./madbelApi/endpoints/compatibilityEndpoints.js";

export const madbelCompatibilitySlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    ...buildCompatibilityEndpoints(builder),
  }),
  overrideExisting: false,
});

export const {
  useMadbelGetInboxQuery,
  useLazyMadbelGetInboxQuery,
  useMadbelGetContactsQuery,
  useLazyMadbelGetContactsQuery,
  useMadbelGetCalendarEventsQuery,
  useLazyMadbelGetCalendarEventsQuery,
  useMadbelConnectCalendarMutation,
  useMadbelGetIntegrationsQuery,
  useLazyMadbelGetIntegrationsQuery,
  useMadbelConnectIntegrationCompatibilityMutation,
  useMadbelGetAiCallAnalyticsQuery,
  useLazyMadbelGetAiCallAnalyticsQuery,
  useMadbelGetDocumentTypesQuery,
  useLazyMadbelGetDocumentTypesQuery,
  useMadbelRequestCallCallbackCompatibilityMutation,
} = madbelCompatibilitySlice;
