import { buildApiRequest } from "../../../apiUtils.js";

export const buildCompatibilityEndpoints = (builder) => ({
  madbelGetInbox: builder.query({
    query: buildApiRequest({
      path: "/api/inbox",
      method: "GET",
      queryParams: ["page", "page_size", "search", "platform", "archived"],
    }),
    providesTags: [{ type: "MadbelCompatibility", id: "LIST" }],
  }),

  madbelGetContacts: builder.query({
    query: buildApiRequest({
      path: "/api/contacts",
      method: "GET",
      queryParams: ["page", "page_size", "search"],
    }),
    providesTags: [{ type: "MadbelCompatibility", id: "LIST" }],
  }),

  madbelGetCalendarEvents: builder.query({
    query: buildApiRequest({
      path: "/api/calendar/events",
      method: "GET",
      queryParams: ["page", "page_size", "search", "upcoming_only"],
    }),
    providesTags: [{ type: "MadbelCompatibility", id: "LIST" }],
  }),

  madbelConnectCalendar: builder.mutation({
    query: buildApiRequest({
      path: "/api/calendar/connect",
      method: "POST",
      hasBody: true,
    }),
    invalidatesTags: [{ type: "MadbelCompatibility", id: "LIST" }],
  }),

  madbelGetIntegrations: builder.query({
    query: buildApiRequest({
      path: "/api/integrations",
      method: "GET",
    }),
    providesTags: [{ type: "MadbelCompatibility", id: "LIST" }],
  }),

  madbelConnectIntegrationCompatibility: builder.mutation({
    query: buildApiRequest({
      path: "/api/integrations/connect",
      method: "POST",
      hasBody: true,
    }),
    invalidatesTags: [{ type: "MadbelCompatibility", id: "LIST" }],
  }),

  madbelGetAiCallAnalytics: builder.query({
    query: buildApiRequest({
      path: "/api/ai-call-analytics",
      method: "GET",
    }),
    providesTags: [{ type: "MadbelCompatibility", id: "LIST" }],
  }),

  madbelGetDocumentTypes: builder.query({
    query: buildApiRequest({
      path: "/api/documents/types",
      method: "GET",
    }),
    providesTags: [{ type: "MadbelCompatibility", id: "LIST" }],
  }),

  madbelRequestCallCallbackCompatibility: builder.mutation({
    query: buildApiRequest({
      path: "/api/calls/{callId}/callback",
      method: "POST",
      pathParams: ["callId"],
    }),
    invalidatesTags: [{ type: "MadbelCompatibility", id: "LIST" }],
  }),
});
