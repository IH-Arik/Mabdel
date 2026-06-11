import { buildApiRequest } from "../../../apiUtils.js";

export const buildInvoiceUtilityEndpoints = (builder) => ({
  madbelListInvoices: builder.query({
    query: buildApiRequest({
      path: "/api/v1/invoices",
      method: "GET",
      queryParams: ["page", "page_size", "search", "status"],
    }),
    providesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelCreateInvoice: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/invoices",
      method: "POST",
      hasBody: true,
    }),
    invalidatesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelGetInvoice: builder.query({
    query: buildApiRequest({
      path: "/api/v1/invoices/{invoice_id}",
      method: "GET",
      pathParams: ["invoice_id"],
    }),
    providesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelUpdateInvoice: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/invoices/{invoice_id}",
      method: "PATCH",
      pathParams: ["invoice_id"],
      hasBody: true,
    }),
    invalidatesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelDeleteInvoice: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/invoices/{invoice_id}",
      method: "DELETE",
      pathParams: ["invoice_id"],
    }),
    invalidatesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelSendInvoice: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/invoices/{invoice_id}/send",
      method: "POST",
      pathParams: ["invoice_id"],
      hasBody: true,
    }),
    invalidatesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelShareInvoice: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/invoices/{invoice_id}/share",
      method: "POST",
      pathParams: ["invoice_id"],
      hasBody: true,
    }),
    invalidatesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelSendInvoiceReminder: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/invoices/{invoice_id}/remind",
      method: "POST",
      pathParams: ["invoice_id"],
      hasBody: true,
    }),
    invalidatesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelUpdateInvoiceStatus: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/invoices/{invoice_id}/status",
      method: "POST",
      pathParams: ["invoice_id"],
      hasBody: true,
    }),
    invalidatesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelGetInvoiceTimeline: builder.query({
    query: buildApiRequest({
      path: "/api/v1/invoices/{invoice_id}/timeline",
      method: "GET",
      pathParams: ["invoice_id"],
    }),
    providesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelDownloadInvoicePdf: builder.query({
    query: buildApiRequest({
      path: "/api/v1/invoices/{invoice_id}/pdf",
      method: "GET",
      pathParams: ["invoice_id"],
    }),
    providesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelDownloadSharedInvoicePdf: builder.query({
    query: buildApiRequest({
      path: "/api/v1/invoices/shared/{share_token}/pdf",
      method: "GET",
      pathParams: ["share_token"],
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelInvoices", id: "LIST" }],
  }),

  madbelDraftEmail: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/email/draft",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelEmail", id: "LIST" }],
  }),

  madbelScheduleMeeting: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/calendar/schedule",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelCalendar", id: "LIST" }],
  }),

  madbelCreateGroupGroups: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/groups",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelGroups", id: "LIST" }],
  }),

  madbelIncomingCall: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/calls/incoming",
      method: "POST",
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelCalls", id: "LIST" }],
  }),

  madbelCallStatus: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/calls/status",
      method: "POST",
      queryParams: ["user_id", "call_log_id"],
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelCalls", id: "LIST" }],
  }),

  madbelGetPermissions: builder.query({
    query: buildApiRequest({
      path: "/api/v1/app/permissions",
      method: "GET",
      queryParams: ["user_id", "device_id"],
      skipAuth: true,
    }),
    providesTags: [{ type: "MadbelPermissions", id: "LIST" }],
  }),

  madbelUpdatePermissions: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/app/permissions",
      method: "PUT",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelPermissions", id: "LIST" }],
  }),

  madbelAcceptAllPermissions: builder.mutation({
    query: buildApiRequest({
      path: "/api/v1/app/permissions/accept-all",
      method: "POST",
      hasBody: true,
      skipAuth: true,
    }),
    invalidatesTags: [{ type: "MadbelPermissions", id: "LIST" }],
  }),
});
