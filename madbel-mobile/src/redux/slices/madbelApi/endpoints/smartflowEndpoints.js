import { buildApiRequest } from "../../../apiUtils.js";

export const buildSmartflowEndpoints = (builder) => ({
    madbelGetHomeDashboard: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/home",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListContacts: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/contacts",
        method: "GET",
        queryParams: ["page","page_size","search"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateContact: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/contacts",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetContact: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/contacts/{contact_id}",
        method: "GET",
        pathParams: ["contact_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateContact: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/contacts/{contact_id}",
        method: "PATCH",
        pathParams: ["contact_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDeleteContact: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/contacts/{contact_id}",
        method: "DELETE",
        pathParams: ["contact_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUploadContactAvatar: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/contacts/{contact_id}/avatar",
        method: "POST",
        pathParams: ["contact_id"],
        hasBody: true,
        multipart: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListConversations: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/conversations",
        method: "GET",
        queryParams: ["page","page_size","search","platform","platforms","archived","unread_only","type"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateConversation: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/conversations",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetConversation: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/conversations/{conversation_id}",
        method: "GET",
        pathParams: ["conversation_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelArchiveConversation: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/conversations/{conversation_id}/archive",
        method: "PATCH",
        pathParams: ["conversation_id"],
        queryParams: ["archived"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelMarkConversationRead: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/conversations/{conversation_id}/mark-read",
        method: "POST",
        pathParams: ["conversation_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListMessages: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/conversations/{conversation_id}/messages",
        method: "GET",
        pathParams: ["conversation_id"],
        queryParams: ["page","page_size","search","platform"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateMessage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/messages",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateMessage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/messages/{message_id}",
        method: "PATCH",
        pathParams: ["message_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelReplyToMessage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/messages/{message_id}/reply",
        method: "POST",
        pathParams: ["message_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelForwardMessage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/messages/{message_id}/forward",
        method: "POST",
        pathParams: ["message_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUnreadSummary: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/messages/unread-summary",
        method: "GET",
        queryParams: ["platform"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetTypingState: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/conversations/{conversation_id}/typing",
        method: "GET",
        pathParams: ["conversation_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelSetTypingState: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/conversations/{conversation_id}/typing",
        method: "POST",
        pathParams: ["conversation_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelAiChat: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/ai/chat",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelAiGenerateImage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/ai/generate-image",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListAiVoices: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/ai/voices",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListAiHistory: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/ai/history",
        method: "GET",
        queryParams: ["page","page_size","search","command_type","status","date_from","date_to","replayable_only","group_by"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelValidateBulkRecipients: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/bulk-messages/recipients/validate",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListBulkMessages: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/bulk-messages",
        method: "GET",
        queryParams: ["page","page_size","search","status","channel"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateBulkMessage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/bulk-messages",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetBulkMessage: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/bulk-messages/{bulk_message_id}",
        method: "GET",
        pathParams: ["bulk_message_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateBulkMessage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/bulk-messages/{bulk_message_id}",
        method: "PATCH",
        pathParams: ["bulk_message_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelSendBulkMessage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/bulk-messages/{bulk_message_id}/send",
        method: "POST",
        pathParams: ["bulk_message_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCancelBulkMessage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/bulk-messages/{bulk_message_id}/cancel",
        method: "POST",
        pathParams: ["bulk_message_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelReplayAiHistory: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/ai/history/{history_id}/replay",
        method: "POST",
        pathParams: ["history_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelTranscribeVoice: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/voice/transcribe",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelAiVoiceChat: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/ai/voice-chat",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelAiVoiceChatUpload: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/ai/voice-chat-upload",
        method: "POST",
        hasBody: true,
        multipart: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelAiWorkflowPrefill: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/ai/workflow-prefill",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListCalendarEvents: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calendar/events",
        method: "GET",
        queryParams: ["page","page_size","search","upcoming_only","date_from","date_to","contact_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateCalendarEvent: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calendar/events",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetCalendarEvent: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calendar/events/{event_id}",
        method: "GET",
        pathParams: ["event_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateCalendarEvent: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calendar/events/{event_id}",
        method: "PATCH",
        pathParams: ["event_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDeleteCalendarEvent: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calendar/events/{event_id}",
        method: "DELETE",
        pathParams: ["event_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelShareCalendarEvent: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calendar/events/{event_id}/share",
        method: "POST",
        pathParams: ["event_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListDocuments: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/documents",
        method: "GET",
        queryParams: ["page","page_size","search","doc_type"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateDocument: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/documents",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateDocument: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/documents/{document_id}",
        method: "PATCH",
        pathParams: ["document_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDeleteDocument: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/documents/{document_id}",
        method: "DELETE",
        pathParams: ["document_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetLeaseMetadata: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/metadata",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGenerateLeaseDraft: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/generate",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelEnhanceLeaseTerms: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/enhance-terms",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelReviewLeaseDraft: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/review",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetPublicSigningLease: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/signing/{signature_token}",
        method: "GET",
        pathParams: ["signature_token"],
        skipAuth: true,
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelSignPublicLease: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/signing/{signature_token}",
        method: "POST",
        pathParams: ["signature_token"],
        hasBody: true,
        skipAuth: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListLeases: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases",
        method: "GET",
        queryParams: ["page","page_size","search","status"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateLease: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetLease: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/{lease_id}",
        method: "GET",
        pathParams: ["lease_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateLease: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/{lease_id}",
        method: "PATCH",
        pathParams: ["lease_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDeleteLease: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/{lease_id}",
        method: "DELETE",
        pathParams: ["lease_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelReviewLease: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/{lease_id}/review",
        method: "POST",
        pathParams: ["lease_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelEnhanceSavedLeaseTerms: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/{lease_id}/enhance-terms",
        method: "POST",
        pathParams: ["lease_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelSendLeaseForSignature: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/{lease_id}/send-signature",
        method: "POST",
        pathParams: ["lease_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelSignLease: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/{lease_id}/sign",
        method: "POST",
        pathParams: ["lease_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelRenewLease: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/{lease_id}/renew",
        method: "POST",
        pathParams: ["lease_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDownloadLeasePdf: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/leases/{lease_id}/pdf",
        method: "GET",
        pathParams: ["lease_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetAgreementMetadata: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/metadata",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetAgreementTypes: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/types",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetAgreementPriorities: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/priorities",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGenerateAgreementDraft: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/generate",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelImproveAgreementDraft: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/improve",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelReviewAgreementDraft: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/review",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetPublicSigningAgreement: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/signing/{signature_token}",
        method: "GET",
        pathParams: ["signature_token"],
        skipAuth: true,
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelSignPublicAgreement: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/signing/{signature_token}",
        method: "POST",
        pathParams: ["signature_token"],
        hasBody: true,
        skipAuth: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListAgreements: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements",
        method: "GET",
        queryParams: ["page","page_size","search","status","agreement_type"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateAgreement: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements",
        method: "POST",
        hasBody: true,
        // skipAuth: true,

      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetAgreement: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/{agreement_id}",
        method: "GET",
        pathParams: ["agreement_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateAgreement: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/{agreement_id}",
        method: "PATCH",
        pathParams: ["agreement_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDeleteAgreement: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/{agreement_id}",
        method: "DELETE",
        pathParams: ["agreement_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelImproveAgreement: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/{agreement_id}/improve",
        method: "POST",
        pathParams: ["agreement_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelReviewAgreement: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/{agreement_id}/review",
        method: "POST",
        pathParams: ["agreement_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelSendAgreementForSignature: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/{agreement_id}/send-signature",
        method: "POST",
        pathParams: ["agreement_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelSignAgreement: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/{agreement_id}/sign",
        method: "POST",
        pathParams: ["agreement_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelRenewAgreement: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/{agreement_id}/renew",
        method: "POST",
        pathParams: ["agreement_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDownloadAgreementPdf: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/agreements/{agreement_id}/pdf",
        method: "GET",
        pathParams: ["agreement_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListCalls: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls",
        method: "GET",
        queryParams: ["page","page_size","status","search","contact_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateCallLog: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateOutboundCall: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/outbound",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetCallSummary: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/summary",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetCallLog: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/{call_id}",
        method: "GET",
        pathParams: ["call_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateCallLog: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/{call_id}",
        method: "PATCH",
        pathParams: ["call_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetCallTranscript: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/{call_id}/transcript",
        method: "GET",
        pathParams: ["call_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateCallTranscript: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/{call_id}/transcript",
        method: "PUT",
        pathParams: ["call_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetCallAiSummary: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/{call_id}/ai-summary",
        method: "GET",
        pathParams: ["call_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateCallAiSummary: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/{call_id}/ai-summary",
        method: "PUT",
        pathParams: ["call_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelRequestCallCallbackSmartFlow: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/{call_id}/callback",
        method: "POST",
        pathParams: ["call_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetCallRecording: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/{call_id}/recording",
        method: "GET",
        pathParams: ["call_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateCallRecording: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/calls/{call_id}/recording",
        method: "PUT",
        pathParams: ["call_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListIntegrations: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelConnectIntegrationSmartFlow: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListIntegrationCatalog: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/catalog",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetIntegrationStatus: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/status",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelSyncIntegration: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/{platform}/sync",
        method: "POST",
        pathParams: ["platform"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelConnectTelegramManual: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/telegram/manual-connect",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelConnectWhatsAppManual: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/whatsapp/manual-connect",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelStartIntegrationOauth: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/{platform}/oauth/start",
        method: "GET",
        pathParams: ["platform"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCompleteIntegrationOauth: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/{platform}/oauth/callback",
        method: "GET",
        pathParams: ["platform"],
        queryParams: ["code","state"],
        skipAuth: true,
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDisconnectIntegration: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/{platform}",
        method: "DELETE",
        pathParams: ["platform"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelVerifyPlatformWebhook: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/{platform}/webhook",
        method: "GET",
        pathParams: ["platform"],
        queryParams: ["hub.mode","hub.verify_token","hub.challenge"],
        skipAuth: true,
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelReceivePlatformWebhook: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/integrations/{platform}/webhook",
        method: "POST",
        pathParams: ["platform"],
        queryParams: ["user_id"],
        skipAuth: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListNotifications: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/notifications",
        method: "GET",
        queryParams: ["page","page_size","unread_only"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelMarkAllNotificationsRead: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/notifications/mark-all-read",
        method: "POST",
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelMarkNotificationRead: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/notifications/{notification_id}/read",
        method: "PATCH",
        pathParams: ["notification_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDeleteNotification: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/notifications/{notification_id}",
        method: "DELETE",
        pathParams: ["notification_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDispatchPendingNotifications: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/notifications/dispatch-pending",
        method: "POST",
        queryParams: ["limit"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListGroups: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups",
        method: "GET",
        queryParams: ["page","page_size","search"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateGroupSmartFlow: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetGroup: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups/{group_id}",
        method: "GET",
        pathParams: ["group_id"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateGroup: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups/{group_id}",
        method: "PATCH",
        pathParams: ["group_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDeleteGroup: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups/{group_id}",
        method: "DELETE",
        pathParams: ["group_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelAddGroupMembers: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups/{group_id}/members",
        method: "POST",
        pathParams: ["group_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateGroupMemberRole: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups/{group_id}/members/{member_id}",
        method: "PATCH",
        pathParams: ["group_id","member_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelRemoveGroupMember: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups/{group_id}/members/{member_id}",
        method: "DELETE",
        pathParams: ["group_id","member_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelInviteGroupMember: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups/{group_id}/invites",
        method: "POST",
        pathParams: ["group_id"],
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCancelGroupInvite: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups/{group_id}/invites/{invite_id}",
        method: "DELETE",
        pathParams: ["group_id","invite_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelLeaveGroup: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/groups/{group_id}/leave",
        method: "POST",
        pathParams: ["group_id"],
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetBusinessProfile: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/business-profile",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateBusinessProfile: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/business-profile",
        method: "PATCH",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUploadBusinessLogo: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/business-profile/logo",
        method: "POST",
        hasBody: true,
        multipart: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListSubscriptionPlans: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/subscription/plans",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetCurrentSubscription: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/subscription/current",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListReportCategories: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/reports/categories",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateUserReport: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/reports",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateSupportTicket: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/support/tickets",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetSupportSession: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/support/session",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelStartSupportSession: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/support/session",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListSupportMessages: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/support/messages",
        method: "GET",
        queryParams: ["session_id","page","page_size"],
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelCreateSupportMessage: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/support/messages",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelDeleteAccount: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/account",
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetSettings: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/settings",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateSettings: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/settings",
        method: "PATCH",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUploadProfileAvatar: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/settings/avatar",
        method: "POST",
        hasBody: true,
        multipart: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetNotificationSettings: builder.query({
      query: buildApiRequest({
        path: "/api/v1/smartflow/settings/notifications",
        method: "GET",
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelUpdateNotificationSettings: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/settings/notifications",
        method: "PATCH",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelRegisterPushToken: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/devices/push-token",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelChangePassword: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/settings/change-password",
        method: "POST",
        hasBody: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelRevokeSessions: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/smartflow/settings/revoke-sessions",
        method: "POST",
      }),
    }),

    madbelCallAction: builder.mutation({
      query: buildApiRequest({
        path: "/api/v1/calls/{call_sid}/action",
        method: "POST",
        pathParams: ["call_sid"],
        hasBody: true,
        skipAuth: true,
      }),
      invalidatesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelListShopProducts: builder.query({
      query: buildApiRequest({
        path: "/api/v1/shop/products",
        method: "GET",
        queryParams: ["page", "limit", "search", "q"],
        skipAuth: true,
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelGetShopProduct: builder.query({
      query: buildApiRequest({
        path: "/api/v1/shop/products/{product_id}",
        method: "GET",
        pathParams: ["product_id"],
        skipAuth: true,
      }),
      providesTags: [{ type: "MadbelSmartFlow", id: "LIST" }],
    }),

    madbelHealthCheckHealthGet: builder.query({
      query: buildApiRequest({
        path: "/health",
        method: "GET",
        skipAuth: true,
      }),
      providesTags: [{ type: "MadbelHealth", id: "LIST" }],
    }),

    madbelReadinessCheckReadyGet: builder.query({
      query: buildApiRequest({
        path: "/ready",
        method: "GET",
        skipAuth: true,
      }),
      providesTags: [{ type: "MadbelHealth", id: "LIST" }],
    }),
});
