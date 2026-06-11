# Frontend Declared But Unused APIs Report

This report lists the exact files, line numbers, and function/hook names of backend APIs that are declared in the frontend code but never imported or used in screen components.

## `frontend/src/api/services.js`

| Line | Method | API Path | JS Function / RTK Endpoint | Generated Hooks (for RTK Query) |
| :--- | :--- | :--- | :--- | :--- |
| 4 | `GET` | `/api/v1/smartflow/home` | `smartflowApi.getHome` | N/A (Axios) |
| 12 | `POST` | `/api/v1/smartflow/contacts/{contact_id}/avatar` | `smartflowApi.uploadContactAvatar` | N/A (Axios) |
| 18 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `smartflowApi.getMessages` | N/A (Axios) |
| 18 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}/messages` | `smartflowApi.getMessages` | N/A (Axios) |
| 20 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `smartflowApi.markRead` | N/A (Axios) |
| 20 | `POST` | `/api/v1/smartflow/conversations/{conversation_id}/mark-read` | `smartflowApi.markRead` | N/A (Axios) |
| 21 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `smartflowApi.archiveConversation` | N/A (Axios) |
| 21 | `PATCH` | `/api/v1/smartflow/conversations/{conversation_id}/archive` | `smartflowApi.archiveConversation` | N/A (Axios) |
| 22 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `smartflowApi.getTypingStatus` | N/A (Axios) |
| 22 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}/typing` | `smartflowApi.getTypingStatus` | N/A (Axios) |
| 22 | `POST` | `/api/v1/smartflow/conversations/{conversation_id}/typing` | `smartflowApi.getTypingStatus` | N/A (Axios) |
| 23 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `smartflowApi.setTypingStatus` | N/A (Axios) |
| 23 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}/typing` | `smartflowApi.setTypingStatus` | N/A (Axios) |
| 23 | `POST` | `/api/v1/smartflow/conversations/{conversation_id}/typing` | `smartflowApi.setTypingStatus` | N/A (Axios) |
| 36 | `POST` | `/api/v1/smartflow/ai/chat` | `smartflowApi.aiChat` | N/A (Axios) |
| 41 | `GET` | `/api/v1/smartflow/ai/voices` | `smartflowApi.getAIVoices` | N/A (Axios) |
| 42 | `GET` | `/api/v1/smartflow/ai/history` | `smartflowApi.getAIHistory` | N/A (Axios) |
| 43 | `GET` | `/api/v1/smartflow/ai/history` | `smartflowApi.replayAIResponse` | N/A (Axios) |
| 43 | `POST` | `/api/v1/smartflow/ai/history/{history_id}/replay` | `smartflowApi.replayAIResponse` | N/A (Axios) |
| 47 | `POST` | `/api/v1/smartflow/ai/voice-chat` | `None` | N/A (Axios) |
| 47 | `POST` | `/api/v1/smartflow/ai/voice-chat-upload` | `None` | N/A (Axios) |
| 56 | `POST` | `/api/v1/smartflow/bulk-messages/{bulk_message_id}/cancel` | `smartflowApi.cancelBulkMessage` | N/A (Axios) |
| 59 | `GET` | `/api/v1/smartflow/documents` | `smartflowApi.getDocuments` | N/A (Axios) |
| 59 | `POST` | `/api/v1/smartflow/documents` | `smartflowApi.getDocuments` | N/A (Axios) |
| 60 | `GET` | `/api/v1/smartflow/documents` | `smartflowApi.createDocument` | N/A (Axios) |
| 60 | `POST` | `/api/v1/smartflow/documents` | `smartflowApi.createDocument` | N/A (Axios) |
| 61 | `GET` | `/api/v1/smartflow/documents` | `smartflowApi.deleteDocument` | N/A (Axios) |
| 61 | `POST` | `/api/v1/smartflow/documents` | `smartflowApi.deleteDocument` | N/A (Axios) |
| 61 | `DELETE` | `/api/v1/smartflow/documents/{document_id}` | `smartflowApi.deleteDocument` | N/A (Axios) |
| 61 | `PATCH` | `/api/v1/smartflow/documents/{document_id}` | `smartflowApi.deleteDocument` | N/A (Axios) |
| 65 | `POST` | `/api/v1/smartflow/leases/enhance-terms` | `smartflowApi.enhanceLeaseTerms` | N/A (Axios) |
| 66 | `POST` | `/api/v1/smartflow/leases/review` | `smartflowApi.reviewLease` | N/A (Axios) |
| 70 | `POST` | `/api/v1/smartflow/agreements/review` | `smartflowApi.reviewAgreement` | N/A (Axios) |
| 79 | `GET` | `/api/v1/smartflow/calls` | `smartflowApi.getCalls` | N/A (Axios) |
| 79 | `POST` | `/api/v1/smartflow/calls` | `smartflowApi.getCalls` | N/A (Axios) |
| 80 | `GET` | `/api/v1/smartflow/calls` | `smartflowApi.createCall` | N/A (Axios) |
| 80 | `POST` | `/api/v1/smartflow/calls` | `smartflowApi.createCall` | N/A (Axios) |
| 81 | `GET` | `/api/v1/smartflow/calls` | `smartflowApi.createOutboundCall` | N/A (Axios) |
| 81 | `POST` | `/api/v1/smartflow/calls` | `smartflowApi.createOutboundCall` | N/A (Axios) |
| 81 | `POST` | `/api/v1/smartflow/calls/outbound` | `smartflowApi.createOutboundCall` | N/A (Axios) |
| 81 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `smartflowApi.createOutboundCall` | N/A (Axios) |
| 81 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `smartflowApi.createOutboundCall` | N/A (Axios) |
| 82 | `GET` | `/api/v1/smartflow/calls` | `smartflowApi.getCallRecording` | N/A (Axios) |
| 82 | `POST` | `/api/v1/smartflow/calls` | `smartflowApi.getCallRecording` | N/A (Axios) |
| 82 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `smartflowApi.getCallRecording` | N/A (Axios) |
| 82 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `smartflowApi.getCallRecording` | N/A (Axios) |
| 85 | `GET` | `/api/v1/smartflow/integrations` | `smartflowApi.getIntegrations` | N/A (Axios) |
| 85 | `POST` | `/api/v1/smartflow/integrations` | `smartflowApi.getIntegrations` | N/A (Axios) |
| 86 | `GET` | `/api/v1/smartflow/integrations` | `smartflowApi.getIntegrationCatalog` | N/A (Axios) |
| 86 | `POST` | `/api/v1/smartflow/integrations` | `smartflowApi.getIntegrationCatalog` | N/A (Axios) |
| 86 | `GET` | `/api/v1/smartflow/integrations/catalog` | `smartflowApi.getIntegrationCatalog` | N/A (Axios) |
| 86 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `smartflowApi.getIntegrationCatalog` | N/A (Axios) |
| 87 | `GET` | `/api/v1/smartflow/integrations` | `smartflowApi.syncIntegration` | N/A (Axios) |
| 87 | `POST` | `/api/v1/smartflow/integrations` | `smartflowApi.syncIntegration` | N/A (Axios) |
| 87 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `smartflowApi.syncIntegration` | N/A (Axios) |
| 87 | `POST` | `/api/v1/smartflow/integrations/{platform}/sync` | `smartflowApi.syncIntegration` | N/A (Axios) |
| 88 | `GET` | `/api/v1/smartflow/integrations` | `smartflowApi.disconnectIntegration` | N/A (Axios) |
| 88 | `POST` | `/api/v1/smartflow/integrations` | `smartflowApi.disconnectIntegration` | N/A (Axios) |
| 88 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `smartflowApi.disconnectIntegration` | N/A (Axios) |
| 89 | `GET` | `/api/v1/smartflow/integrations` | `smartflowApi.startIntegrationOAuth` | N/A (Axios) |
| 89 | `POST` | `/api/v1/smartflow/integrations` | `smartflowApi.startIntegrationOAuth` | N/A (Axios) |
| 89 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `smartflowApi.startIntegrationOAuth` | N/A (Axios) |
| 89 | `GET` | `/api/v1/smartflow/integrations/{platform}/oauth/start` | `smartflowApi.startIntegrationOAuth` | N/A (Axios) |
| 92 | `GET` | `/api/v1/smartflow/notifications` | `smartflowApi.getNotifications` | N/A (Axios) |
| 93 | `GET` | `/api/v1/smartflow/notifications` | `smartflowApi.markAllNotificationsRead` | N/A (Axios) |
| 93 | `POST` | `/api/v1/smartflow/notifications/mark-all-read` | `smartflowApi.markAllNotificationsRead` | N/A (Axios) |
| 93 | `DELETE` | `/api/v1/smartflow/notifications/{notification_id}` | `smartflowApi.markAllNotificationsRead` | N/A (Axios) |
| 94 | `GET` | `/api/v1/smartflow/notifications` | `smartflowApi.markNotificationRead` | N/A (Axios) |
| 94 | `DELETE` | `/api/v1/smartflow/notifications/{notification_id}` | `smartflowApi.markNotificationRead` | N/A (Axios) |
| 94 | `PATCH` | `/api/v1/smartflow/notifications/{notification_id}/read` | `smartflowApi.markNotificationRead` | N/A (Axios) |
| 95 | `GET` | `/api/v1/smartflow/notifications` | `smartflowApi.deleteNotification` | N/A (Axios) |
| 95 | `DELETE` | `/api/v1/smartflow/notifications/{notification_id}` | `smartflowApi.deleteNotification` | N/A (Axios) |
| 100 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `smartflowApi.downloadInvoice` | N/A (Axios) |
| 100 | `GET` | `/api/v1/invoices/{invoice_id}` | `smartflowApi.downloadInvoice` | N/A (Axios) |
| 100 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `smartflowApi.downloadInvoice` | N/A (Axios) |
| 100 | `GET` | `/api/v1/invoices/{invoice_id}/pdf` | `smartflowApi.downloadInvoice` | N/A (Axios) |
| 105 | `GET` | `/api/v1/smartflow/settings/notifications` | `smartflowApi.getNotificationSettings` | N/A (Axios) |
| 105 | `PATCH` | `/api/v1/smartflow/settings/notifications` | `smartflowApi.getNotificationSettings` | N/A (Axios) |
| 106 | `GET` | `/api/v1/smartflow/settings/notifications` | `smartflowApi.updateNotificationSettings` | N/A (Axios) |
| 106 | `PATCH` | `/api/v1/smartflow/settings/notifications` | `smartflowApi.updateNotificationSettings` | N/A (Axios) |
| 107 | `GET` | `/api/v1/smartflow/business-profile` | `smartflowApi.getBusinessProfile` | N/A (Axios) |
| 107 | `PATCH` | `/api/v1/smartflow/business-profile` | `smartflowApi.getBusinessProfile` | N/A (Axios) |
| 108 | `GET` | `/api/v1/smartflow/business-profile` | `smartflowApi.updateBusinessProfile` | N/A (Axios) |
| 108 | `PATCH` | `/api/v1/smartflow/business-profile` | `smartflowApi.updateBusinessProfile` | N/A (Axios) |
| 109 | `GET` | `/api/v1/smartflow/subscription/plans` | `smartflowApi.getSubscriptionPlans` | N/A (Axios) |
| 110 | `GET` | `/api/v1/smartflow/subscription/current` | `smartflowApi.getCurrentSubscription` | N/A (Axios) |
| 111 | `POST` | `/api/v1/smartflow/support/tickets` | `smartflowApi.createSupportTicket` | N/A (Axios) |
| 112 | `GET` | `/api/v1/smartflow/support/session` | `smartflowApi.getSupportSession` | N/A (Axios) |
| 112 | `POST` | `/api/v1/smartflow/support/session` | `smartflowApi.getSupportSession` | N/A (Axios) |
| 113 | `GET` | `/api/v1/smartflow/support/messages` | `smartflowApi.getSupportMessages` | N/A (Axios) |
| 113 | `POST` | `/api/v1/smartflow/support/messages` | `smartflowApi.getSupportMessages` | N/A (Axios) |
| 114 | `GET` | `/api/v1/smartflow/support/messages` | `smartflowApi.sendSupportMessage` | N/A (Axios) |
| 114 | `POST` | `/api/v1/smartflow/support/messages` | `smartflowApi.sendSupportMessage` | N/A (Axios) |
| 120 | `GET` | `/api/v1/dashboard/admin/users/{user_id}` | `smartflowApi.getUserDetails` | N/A (Axios) |
| 121 | `GET` | `/api/v1/dashboard/admin/users/{user_id}` | `smartflowApi.updateUserStatus` | N/A (Axios) |
| 122 | `GET` | `/api/v1/dashboard/admin/users-growth` | `smartflowApi.getUsersGrowth` | N/A (Axios) |
| 126 | `GET` | `/api/v1/dashboard/admin/ai/logs` | `smartflowApi.getAILogs` | N/A (Axios) |
| 127 | `GET` | `/api/v1/dashboard/admin/reports` | `smartflowApi.getReports` | N/A (Axios) |
| 128 | `GET` | `/api/v1/dashboard/admin/admins` | `smartflowApi.getAdmins` | N/A (Axios) |
| 129 | `GET` | `/api/v1/dashboard/admin/subscriptions` | `smartflowApi.getSubscriptions` | N/A (Axios) |
| 129 | `POST` | `/api/v1/dashboard/admin/subscriptions` | `smartflowApi.getSubscriptions` | N/A (Axios) |
| 130 | `GET` | `/api/v1/dashboard/admin/chats` | `smartflowApi.getChats` | N/A (Axios) |

## `madbel-mobile/src/redux/slices/authSlice.js`

| Line | Method | API Path | JS Function / RTK Endpoint | Generated Hooks (for RTK Query) |
| :--- | :--- | :--- | :--- | :--- |
| 179 | `GET` | `/api/v1/smartflow/notifications` | `getMyNotifications` | `useGetMyNotificationsQuery`, `useGetMyNotificationsMutation`, `useLazyGetMyNotificationsQuery` |
| 186 | `POST` | `/api/v1/smartflow/reports` | `getCategories` | `useGetCategoriesQuery`, `useGetCategoriesMutation`, `useLazyGetCategoriesQuery` |
| 186 | `GET` | `/api/v1/smartflow/reports/categories` | `getCategories` | `useGetCategoriesQuery`, `useGetCategoriesMutation`, `useLazyGetCategoriesQuery` |

## `madbel-mobile/src/redux/slices/madbelApi/endpoints/appContentEndpoints.js`

| Line | Method | API Path | JS Function / RTK Endpoint | Generated Hooks (for RTK Query) |
| :--- | :--- | :--- | :--- | :--- |
| 6 | `GET` | `/api/v1/app/config` | `madbelGetAppConfig` | `useMadbelGetAppConfigQuery`, `useMadbelGetAppConfigMutation`, `useLazyMadbelGetAppConfigQuery` |
| 65 | `POST` | `/api/v1/onboarding/reset` | `madbelResetOnboarding` | `useMadbelResetOnboardingQuery`, `useMadbelResetOnboardingMutation`, `useLazyMadbelResetOnboardingQuery` |
| 75 | `GET` | `/api/v1/content/pages/{slug}` | `madbelGetContentPage` | `useMadbelGetContentPageQuery`, `useMadbelGetContentPageMutation`, `useLazyMadbelGetContentPageQuery` |
| 85 | `GET` | `/api/v1/content/about-us` | `madbelGetAboutUs` | `useMadbelGetAboutUsQuery`, `useMadbelGetAboutUsMutation`, `useLazyMadbelGetAboutUsQuery` |
| 94 | `GET` | `/api/v1/content/terms-and-conditions` | `madbelGetTermsAndConditions` | `useMadbelGetTermsAndConditionsQuery`, `useMadbelGetTermsAndConditionsMutation`, `useLazyMadbelGetTermsAndConditionsQuery` |
| 103 | `GET` | `/api/v1/content/privacy-policy` | `madbelGetPrivacyPolicy` | `useMadbelGetPrivacyPolicyQuery`, `useMadbelGetPrivacyPolicyMutation`, `useLazyMadbelGetPrivacyPolicyQuery` |
| 112 | `GET` | `/api/v1/content/help-support` | `madbelGetHelpSupport` | `useMadbelGetHelpSupportQuery`, `useMadbelGetHelpSupportMutation`, `useLazyMadbelGetHelpSupportQuery` |
| 121 | `POST` | `/api/v1/ai/command` | `madbelRunAiCommand` | `useMadbelRunAiCommandQuery`, `useMadbelRunAiCommandMutation`, `useLazyMadbelRunAiCommandQuery` |

## `madbel-mobile/src/redux/slices/madbelApi/endpoints/authEndpoints.js`

| Line | Method | API Path | JS Function / RTK Endpoint | Generated Hooks (for RTK Query) |
| :--- | :--- | :--- | :--- | :--- |
| 54 | `POST` | `/api/v1/auth/send-otp` | `madbelSendOtp` | `useMadbelSendOtpQuery`, `useMadbelSendOtpMutation`, `useLazyMadbelSendOtpQuery` |
| 64 | `POST` | `/api/v1/auth/resend-otp` | `madbelResendOtp` | `useMadbelResendOtpQuery`, `useMadbelResendOtpMutation`, `useLazyMadbelResendOtpQuery` |
| 104 | `POST` | `/api/v1/auth/refresh-token` | `madbelRefreshToken` | `useMadbelRefreshTokenQuery`, `useMadbelRefreshTokenMutation`, `useLazyMadbelRefreshTokenQuery` |
| 121 | `POST` | `/api/v1/auth/google` | `madbelGoogleLogin` | `useMadbelGoogleLoginQuery`, `useMadbelGoogleLoginMutation`, `useLazyMadbelGoogleLoginQuery` |

## `madbel-mobile/src/redux/slices/madbelApi/endpoints/compatibilityEndpoints.js`

| Line | Method | API Path | JS Function / RTK Endpoint | Generated Hooks (for RTK Query) |
| :--- | :--- | :--- | :--- | :--- |
| 6 | `GET` | `/api/inbox` | `madbelGetInbox` | `useMadbelGetInboxQuery`, `useMadbelGetInboxMutation`, `useLazyMadbelGetInboxQuery` |
| 15 | `GET` | `/api/contacts` | `madbelGetContacts` | `useMadbelGetContactsQuery`, `useMadbelGetContactsMutation`, `useLazyMadbelGetContactsQuery` |
| 24 | `GET` | `/api/calendar/events` | `madbelGetCalendarEvents` | `useMadbelGetCalendarEventsQuery`, `useMadbelGetCalendarEventsMutation`, `useLazyMadbelGetCalendarEventsQuery` |
| 33 | `POST` | `/api/calendar/connect` | `madbelConnectCalendar` | `useMadbelConnectCalendarQuery`, `useMadbelConnectCalendarMutation`, `useLazyMadbelConnectCalendarQuery` |
| 42 | `GET` | `/api/integrations` | `madbelGetIntegrations` | `useMadbelGetIntegrationsQuery`, `useMadbelGetIntegrationsMutation`, `useLazyMadbelGetIntegrationsQuery` |
| 50 | `GET` | `/api/integrations` | `madbelConnectIntegrationCompatibility` | `useMadbelConnectIntegrationCompatibilityQuery`, `useMadbelConnectIntegrationCompatibilityMutation`, `useLazyMadbelConnectIntegrationCompatibilityQuery` |
| 50 | `POST` | `/api/integrations/connect` | `madbelConnectIntegrationCompatibility` | `useMadbelConnectIntegrationCompatibilityQuery`, `useMadbelConnectIntegrationCompatibilityMutation`, `useLazyMadbelConnectIntegrationCompatibilityQuery` |
| 59 | `GET` | `/api/ai-call-analytics` | `madbelGetAiCallAnalytics` | `useMadbelGetAiCallAnalyticsQuery`, `useMadbelGetAiCallAnalyticsMutation`, `useLazyMadbelGetAiCallAnalyticsQuery` |
| 67 | `GET` | `/api/documents/types` | `madbelGetDocumentTypes` | `useMadbelGetDocumentTypesQuery`, `useMadbelGetDocumentTypesMutation`, `useLazyMadbelGetDocumentTypesQuery` |
| 75 | `POST` | `/api/calls/{callId}/callback` | `madbelRequestCallCallbackCompatibility` | `useMadbelRequestCallCallbackCompatibilityQuery`, `useMadbelRequestCallCallbackCompatibilityMutation`, `useLazyMadbelRequestCallCallbackCompatibilityQuery` |

## `madbel-mobile/src/redux/slices/madbelApi/endpoints/invoiceUtilityEndpoints.js`

| Line | Method | API Path | JS Function / RTK Endpoint | Generated Hooks (for RTK Query) |
| :--- | :--- | :--- | :--- | :--- |
| 24 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelGetInvoice` | `useMadbelGetInvoiceQuery`, `useMadbelGetInvoiceMutation`, `useLazyMadbelGetInvoiceQuery` |
| 24 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelGetInvoice` | `useMadbelGetInvoiceQuery`, `useMadbelGetInvoiceMutation`, `useLazyMadbelGetInvoiceQuery` |
| 24 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelGetInvoice` | `useMadbelGetInvoiceQuery`, `useMadbelGetInvoiceMutation`, `useLazyMadbelGetInvoiceQuery` |
| 33 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelUpdateInvoice` | `useMadbelUpdateInvoiceQuery`, `useMadbelUpdateInvoiceMutation`, `useLazyMadbelUpdateInvoiceQuery` |
| 33 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelUpdateInvoice` | `useMadbelUpdateInvoiceQuery`, `useMadbelUpdateInvoiceMutation`, `useLazyMadbelUpdateInvoiceQuery` |
| 33 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelUpdateInvoice` | `useMadbelUpdateInvoiceQuery`, `useMadbelUpdateInvoiceMutation`, `useLazyMadbelUpdateInvoiceQuery` |
| 43 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelDeleteInvoice` | `useMadbelDeleteInvoiceQuery`, `useMadbelDeleteInvoiceMutation`, `useLazyMadbelDeleteInvoiceQuery` |
| 43 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelDeleteInvoice` | `useMadbelDeleteInvoiceQuery`, `useMadbelDeleteInvoiceMutation`, `useLazyMadbelDeleteInvoiceQuery` |
| 43 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelDeleteInvoice` | `useMadbelDeleteInvoiceQuery`, `useMadbelDeleteInvoiceMutation`, `useLazyMadbelDeleteInvoiceQuery` |
| 52 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelSendInvoice` | `useMadbelSendInvoiceQuery`, `useMadbelSendInvoiceMutation`, `useLazyMadbelSendInvoiceQuery` |
| 52 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelSendInvoice` | `useMadbelSendInvoiceQuery`, `useMadbelSendInvoiceMutation`, `useLazyMadbelSendInvoiceQuery` |
| 52 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelSendInvoice` | `useMadbelSendInvoiceQuery`, `useMadbelSendInvoiceMutation`, `useLazyMadbelSendInvoiceQuery` |
| 52 | `POST` | `/api/v1/invoices/{invoice_id}/send` | `madbelSendInvoice` | `useMadbelSendInvoiceQuery`, `useMadbelSendInvoiceMutation`, `useLazyMadbelSendInvoiceQuery` |
| 62 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelShareInvoice` | `useMadbelShareInvoiceQuery`, `useMadbelShareInvoiceMutation`, `useLazyMadbelShareInvoiceQuery` |
| 62 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelShareInvoice` | `useMadbelShareInvoiceQuery`, `useMadbelShareInvoiceMutation`, `useLazyMadbelShareInvoiceQuery` |
| 62 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelShareInvoice` | `useMadbelShareInvoiceQuery`, `useMadbelShareInvoiceMutation`, `useLazyMadbelShareInvoiceQuery` |
| 72 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelSendInvoiceReminder` | `useMadbelSendInvoiceReminderQuery`, `useMadbelSendInvoiceReminderMutation`, `useLazyMadbelSendInvoiceReminderQuery` |
| 72 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelSendInvoiceReminder` | `useMadbelSendInvoiceReminderQuery`, `useMadbelSendInvoiceReminderMutation`, `useLazyMadbelSendInvoiceReminderQuery` |
| 72 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelSendInvoiceReminder` | `useMadbelSendInvoiceReminderQuery`, `useMadbelSendInvoiceReminderMutation`, `useLazyMadbelSendInvoiceReminderQuery` |
| 82 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelUpdateInvoiceStatus` | `useMadbelUpdateInvoiceStatusQuery`, `useMadbelUpdateInvoiceStatusMutation`, `useLazyMadbelUpdateInvoiceStatusQuery` |
| 82 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelUpdateInvoiceStatus` | `useMadbelUpdateInvoiceStatusQuery`, `useMadbelUpdateInvoiceStatusMutation`, `useLazyMadbelUpdateInvoiceStatusQuery` |
| 82 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelUpdateInvoiceStatus` | `useMadbelUpdateInvoiceStatusQuery`, `useMadbelUpdateInvoiceStatusMutation`, `useLazyMadbelUpdateInvoiceStatusQuery` |
| 92 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelGetInvoiceTimeline` | `useMadbelGetInvoiceTimelineQuery`, `useMadbelGetInvoiceTimelineMutation`, `useLazyMadbelGetInvoiceTimelineQuery` |
| 92 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelGetInvoiceTimeline` | `useMadbelGetInvoiceTimelineQuery`, `useMadbelGetInvoiceTimelineMutation`, `useLazyMadbelGetInvoiceTimelineQuery` |
| 92 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelGetInvoiceTimeline` | `useMadbelGetInvoiceTimelineQuery`, `useMadbelGetInvoiceTimelineMutation`, `useLazyMadbelGetInvoiceTimelineQuery` |
| 101 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelDownloadInvoicePdf` | `useMadbelDownloadInvoicePdfQuery`, `useMadbelDownloadInvoicePdfMutation`, `useLazyMadbelDownloadInvoicePdfQuery` |
| 101 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelDownloadInvoicePdf` | `useMadbelDownloadInvoicePdfQuery`, `useMadbelDownloadInvoicePdfMutation`, `useLazyMadbelDownloadInvoicePdfQuery` |
| 101 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelDownloadInvoicePdf` | `useMadbelDownloadInvoicePdfQuery`, `useMadbelDownloadInvoicePdfMutation`, `useLazyMadbelDownloadInvoicePdfQuery` |
| 101 | `GET` | `/api/v1/invoices/{invoice_id}/pdf` | `madbelDownloadInvoicePdf` | `useMadbelDownloadInvoicePdfQuery`, `useMadbelDownloadInvoicePdfMutation`, `useLazyMadbelDownloadInvoicePdfQuery` |
| 110 | `GET` | `/api/v1/invoices/shared/{share_token}/pdf` | `madbelDownloadSharedInvoicePdf` | `useMadbelDownloadSharedInvoicePdfQuery`, `useMadbelDownloadSharedInvoicePdfMutation`, `useLazyMadbelDownloadSharedInvoicePdfQuery` |
| 110 | `DELETE` | `/api/v1/invoices/{invoice_id}` | `madbelDownloadSharedInvoicePdf` | `useMadbelDownloadSharedInvoicePdfQuery`, `useMadbelDownloadSharedInvoicePdfMutation`, `useLazyMadbelDownloadSharedInvoicePdfQuery` |
| 110 | `GET` | `/api/v1/invoices/{invoice_id}` | `madbelDownloadSharedInvoicePdf` | `useMadbelDownloadSharedInvoicePdfQuery`, `useMadbelDownloadSharedInvoicePdfMutation`, `useLazyMadbelDownloadSharedInvoicePdfQuery` |
| 110 | `PATCH` | `/api/v1/invoices/{invoice_id}` | `madbelDownloadSharedInvoicePdf` | `useMadbelDownloadSharedInvoicePdfQuery`, `useMadbelDownloadSharedInvoicePdfMutation`, `useLazyMadbelDownloadSharedInvoicePdfQuery` |
| 110 | `GET` | `/api/v1/invoices/{invoice_id}/pdf` | `madbelDownloadSharedInvoicePdf` | `useMadbelDownloadSharedInvoicePdfQuery`, `useMadbelDownloadSharedInvoicePdfMutation`, `useLazyMadbelDownloadSharedInvoicePdfQuery` |
| 120 | `POST` | `/api/v1/email/draft` | `madbelDraftEmail` | `useMadbelDraftEmailQuery`, `useMadbelDraftEmailMutation`, `useLazyMadbelDraftEmailQuery` |
| 130 | `POST` | `/api/v1/calendar/schedule` | `madbelScheduleMeeting` | `useMadbelScheduleMeetingQuery`, `useMadbelScheduleMeetingMutation`, `useLazyMadbelScheduleMeetingQuery` |
| 140 | `POST` | `/api/v1/groups` | `madbelCreateGroupGroups` | `useMadbelCreateGroupGroupsQuery`, `useMadbelCreateGroupGroupsMutation`, `useLazyMadbelCreateGroupGroupsQuery` |

## `madbel-mobile/src/redux/slices/madbelApi/endpoints/smartflowEndpoints.js`

| Line | Method | API Path | JS Function / RTK Endpoint | Generated Hooks (for RTK Query) |
| :--- | :--- | :--- | :--- | :--- |
| 6 | `GET` | `/api/v1/smartflow/home` | `madbelGetHomeDashboard` | `useMadbelGetHomeDashboardQuery`, `useMadbelGetHomeDashboardMutation`, `useLazyMadbelGetHomeDashboardQuery` |
| 60 | `POST` | `/api/v1/smartflow/contacts/{contact_id}/avatar` | `madbelUploadContactAvatar` | `useMadbelUploadContactAvatarQuery`, `useMadbelUploadContactAvatarMutation`, `useLazyMadbelUploadContactAvatarQuery` |
| 89 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `madbelGetConversation` | `useMadbelGetConversationQuery`, `useMadbelGetConversationMutation`, `useLazyMadbelGetConversationQuery` |
| 98 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `madbelArchiveConversation` | `useMadbelArchiveConversationQuery`, `useMadbelArchiveConversationMutation`, `useLazyMadbelArchiveConversationQuery` |
| 98 | `PATCH` | `/api/v1/smartflow/conversations/{conversation_id}/archive` | `madbelArchiveConversation` | `useMadbelArchiveConversationQuery`, `useMadbelArchiveConversationMutation`, `useLazyMadbelArchiveConversationQuery` |
| 108 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `madbelMarkConversationRead` | `useMadbelMarkConversationReadQuery`, `useMadbelMarkConversationReadMutation`, `useLazyMadbelMarkConversationReadQuery` |
| 108 | `POST` | `/api/v1/smartflow/conversations/{conversation_id}/mark-read` | `madbelMarkConversationRead` | `useMadbelMarkConversationReadQuery`, `useMadbelMarkConversationReadMutation`, `useLazyMadbelMarkConversationReadQuery` |
| 117 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `madbelListMessages` | `useMadbelListMessagesQuery`, `useMadbelListMessagesMutation`, `useLazyMadbelListMessagesQuery` |
| 117 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}/messages` | `madbelListMessages` | `useMadbelListMessagesQuery`, `useMadbelListMessagesMutation`, `useLazyMadbelListMessagesQuery` |
| 136 | `PATCH` | `/api/v1/smartflow/messages/{message_id}` | `madbelUpdateMessage` | `useMadbelUpdateMessageQuery`, `useMadbelUpdateMessageMutation`, `useLazyMadbelUpdateMessageQuery` |
| 146 | `PATCH` | `/api/v1/smartflow/messages/{message_id}` | `madbelReplyToMessage` | `useMadbelReplyToMessageQuery`, `useMadbelReplyToMessageMutation`, `useLazyMadbelReplyToMessageQuery` |
| 146 | `POST` | `/api/v1/smartflow/messages/{message_id}/reply` | `madbelReplyToMessage` | `useMadbelReplyToMessageQuery`, `useMadbelReplyToMessageMutation`, `useLazyMadbelReplyToMessageQuery` |
| 156 | `PATCH` | `/api/v1/smartflow/messages/{message_id}` | `madbelForwardMessage` | `useMadbelForwardMessageQuery`, `useMadbelForwardMessageMutation`, `useLazyMadbelForwardMessageQuery` |
| 156 | `POST` | `/api/v1/smartflow/messages/{message_id}/forward` | `madbelForwardMessage` | `useMadbelForwardMessageQuery`, `useMadbelForwardMessageMutation`, `useLazyMadbelForwardMessageQuery` |
| 166 | `GET` | `/api/v1/smartflow/messages/unread-summary` | `madbelUnreadSummary` | `useMadbelUnreadSummaryQuery`, `useMadbelUnreadSummaryMutation`, `useLazyMadbelUnreadSummaryQuery` |
| 166 | `PATCH` | `/api/v1/smartflow/messages/{message_id}` | `madbelUnreadSummary` | `useMadbelUnreadSummaryQuery`, `useMadbelUnreadSummaryMutation`, `useLazyMadbelUnreadSummaryQuery` |
| 175 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `madbelGetTypingState` | `useMadbelGetTypingStateQuery`, `useMadbelGetTypingStateMutation`, `useLazyMadbelGetTypingStateQuery` |
| 175 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}/typing` | `madbelGetTypingState` | `useMadbelGetTypingStateQuery`, `useMadbelGetTypingStateMutation`, `useLazyMadbelGetTypingStateQuery` |
| 175 | `POST` | `/api/v1/smartflow/conversations/{conversation_id}/typing` | `madbelGetTypingState` | `useMadbelGetTypingStateQuery`, `useMadbelGetTypingStateMutation`, `useLazyMadbelGetTypingStateQuery` |
| 184 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}` | `madbelSetTypingState` | `useMadbelSetTypingStateQuery`, `useMadbelSetTypingStateMutation`, `useLazyMadbelSetTypingStateQuery` |
| 184 | `GET` | `/api/v1/smartflow/conversations/{conversation_id}/typing` | `madbelSetTypingState` | `useMadbelSetTypingStateQuery`, `useMadbelSetTypingStateMutation`, `useLazyMadbelSetTypingStateQuery` |
| 184 | `POST` | `/api/v1/smartflow/conversations/{conversation_id}/typing` | `madbelSetTypingState` | `useMadbelSetTypingStateQuery`, `useMadbelSetTypingStateMutation`, `useLazyMadbelSetTypingStateQuery` |
| 194 | `POST` | `/api/v1/smartflow/ai/chat` | `madbelAiChat` | `useMadbelAiChatQuery`, `useMadbelAiChatMutation`, `useLazyMadbelAiChatQuery` |
| 203 | `GET` | `/api/v1/smartflow/ai/voices` | `madbelListAiVoices` | `useMadbelListAiVoicesQuery`, `useMadbelListAiVoicesMutation`, `useLazyMadbelListAiVoicesQuery` |
| 211 | `GET` | `/api/v1/smartflow/ai/history` | `madbelListAiHistory` | `useMadbelListAiHistoryQuery`, `useMadbelListAiHistoryMutation`, `useLazyMadbelListAiHistoryQuery` |
| 275 | `POST` | `/api/v1/smartflow/bulk-messages/{bulk_message_id}/cancel` | `madbelCancelBulkMessage` | `useMadbelCancelBulkMessageQuery`, `useMadbelCancelBulkMessageMutation`, `useLazyMadbelCancelBulkMessageQuery` |
| 284 | `GET` | `/api/v1/smartflow/ai/history` | `madbelReplayAiHistory` | `useMadbelReplayAiHistoryQuery`, `useMadbelReplayAiHistoryMutation`, `useLazyMadbelReplayAiHistoryQuery` |
| 284 | `POST` | `/api/v1/smartflow/ai/history/{history_id}/replay` | `madbelReplayAiHistory` | `useMadbelReplayAiHistoryQuery`, `useMadbelReplayAiHistoryMutation`, `useLazyMadbelReplayAiHistoryQuery` |
| 302 | `POST` | `/api/v1/smartflow/ai/voice-chat` | `madbelAiVoiceChat` | `useMadbelAiVoiceChatQuery`, `useMadbelAiVoiceChatMutation`, `useLazyMadbelAiVoiceChatQuery` |
| 311 | `POST` | `/api/v1/smartflow/ai/voice-chat` | `madbelAiVoiceChatUpload` | `useMadbelAiVoiceChatUploadQuery`, `useMadbelAiVoiceChatUploadMutation`, `useLazyMadbelAiVoiceChatUploadQuery` |
| 311 | `POST` | `/api/v1/smartflow/ai/voice-chat-upload` | `madbelAiVoiceChatUpload` | `useMadbelAiVoiceChatUploadQuery`, `useMadbelAiVoiceChatUploadMutation`, `useLazyMadbelAiVoiceChatUploadQuery` |
| 386 | `GET` | `/api/v1/smartflow/documents` | `madbelListDocuments` | `useMadbelListDocumentsQuery`, `useMadbelListDocumentsMutation`, `useLazyMadbelListDocumentsQuery` |
| 386 | `POST` | `/api/v1/smartflow/documents` | `madbelListDocuments` | `useMadbelListDocumentsQuery`, `useMadbelListDocumentsMutation`, `useLazyMadbelListDocumentsQuery` |
| 395 | `GET` | `/api/v1/smartflow/documents` | `madbelCreateDocument` | `useMadbelCreateDocumentQuery`, `useMadbelCreateDocumentMutation`, `useLazyMadbelCreateDocumentQuery` |
| 395 | `POST` | `/api/v1/smartflow/documents` | `madbelCreateDocument` | `useMadbelCreateDocumentQuery`, `useMadbelCreateDocumentMutation`, `useLazyMadbelCreateDocumentQuery` |
| 404 | `GET` | `/api/v1/smartflow/documents` | `madbelUpdateDocument` | `useMadbelUpdateDocumentQuery`, `useMadbelUpdateDocumentMutation`, `useLazyMadbelUpdateDocumentQuery` |
| 404 | `POST` | `/api/v1/smartflow/documents` | `madbelUpdateDocument` | `useMadbelUpdateDocumentQuery`, `useMadbelUpdateDocumentMutation`, `useLazyMadbelUpdateDocumentQuery` |
| 404 | `DELETE` | `/api/v1/smartflow/documents/{document_id}` | `madbelUpdateDocument` | `useMadbelUpdateDocumentQuery`, `useMadbelUpdateDocumentMutation`, `useLazyMadbelUpdateDocumentQuery` |
| 404 | `PATCH` | `/api/v1/smartflow/documents/{document_id}` | `madbelUpdateDocument` | `useMadbelUpdateDocumentQuery`, `useMadbelUpdateDocumentMutation`, `useLazyMadbelUpdateDocumentQuery` |
| 414 | `GET` | `/api/v1/smartflow/documents` | `madbelDeleteDocument` | `useMadbelDeleteDocumentQuery`, `useMadbelDeleteDocumentMutation`, `useLazyMadbelDeleteDocumentQuery` |
| 414 | `POST` | `/api/v1/smartflow/documents` | `madbelDeleteDocument` | `useMadbelDeleteDocumentQuery`, `useMadbelDeleteDocumentMutation`, `useLazyMadbelDeleteDocumentQuery` |
| 414 | `DELETE` | `/api/v1/smartflow/documents/{document_id}` | `madbelDeleteDocument` | `useMadbelDeleteDocumentQuery`, `useMadbelDeleteDocumentMutation`, `useLazyMadbelDeleteDocumentQuery` |
| 414 | `PATCH` | `/api/v1/smartflow/documents/{document_id}` | `madbelDeleteDocument` | `useMadbelDeleteDocumentQuery`, `useMadbelDeleteDocumentMutation`, `useLazyMadbelDeleteDocumentQuery` |
| 423 | `GET` | `/api/v1/smartflow/leases/metadata` | `madbelGetLeaseMetadata` | `useMadbelGetLeaseMetadataQuery`, `useMadbelGetLeaseMetadataMutation`, `useLazyMadbelGetLeaseMetadataQuery` |
| 440 | `POST` | `/api/v1/smartflow/leases/enhance-terms` | `madbelEnhanceLeaseTerms` | `useMadbelEnhanceLeaseTermsQuery`, `useMadbelEnhanceLeaseTermsMutation`, `useLazyMadbelEnhanceLeaseTermsQuery` |
| 449 | `POST` | `/api/v1/smartflow/leases/review` | `madbelReviewLeaseDraft` | `useMadbelReviewLeaseDraftQuery`, `useMadbelReviewLeaseDraftMutation`, `useLazyMadbelReviewLeaseDraftQuery` |
| 458 | `GET` | `/api/v1/smartflow/leases/signing/{signature_token}` | `madbelGetPublicSigningLease` | `useMadbelGetPublicSigningLeaseQuery`, `useMadbelGetPublicSigningLeaseMutation`, `useLazyMadbelGetPublicSigningLeaseQuery` |
| 458 | `POST` | `/api/v1/smartflow/leases/signing/{signature_token}` | `madbelGetPublicSigningLease` | `useMadbelGetPublicSigningLeaseQuery`, `useMadbelGetPublicSigningLeaseMutation`, `useLazyMadbelGetPublicSigningLeaseQuery` |
| 468 | `GET` | `/api/v1/smartflow/leases/signing/{signature_token}` | `madbelSignPublicLease` | `useMadbelSignPublicLeaseQuery`, `useMadbelSignPublicLeaseMutation`, `useLazyMadbelSignPublicLeaseQuery` |
| 468 | `POST` | `/api/v1/smartflow/leases/signing/{signature_token}` | `madbelSignPublicLease` | `useMadbelSignPublicLeaseQuery`, `useMadbelSignPublicLeaseMutation`, `useLazyMadbelSignPublicLeaseQuery` |
| 534 | `POST` | `/api/v1/smartflow/leases/{lease_id}/enhance-terms` | `madbelEnhanceSavedLeaseTerms` | `useMadbelEnhanceSavedLeaseTermsQuery`, `useMadbelEnhanceSavedLeaseTermsMutation`, `useLazyMadbelEnhanceSavedLeaseTermsQuery` |
| 554 | `POST` | `/api/v1/smartflow/leases/{lease_id}/sign` | `madbelSignLease` | `useMadbelSignLeaseQuery`, `useMadbelSignLeaseMutation`, `useLazyMadbelSignLeaseQuery` |
| 564 | `POST` | `/api/v1/smartflow/leases/{lease_id}/renew` | `madbelRenewLease` | `useMadbelRenewLeaseQuery`, `useMadbelRenewLeaseMutation`, `useLazyMadbelRenewLeaseQuery` |
| 583 | `GET` | `/api/v1/smartflow/agreements/metadata` | `madbelGetAgreementMetadata` | `useMadbelGetAgreementMetadataQuery`, `useMadbelGetAgreementMetadataMutation`, `useLazyMadbelGetAgreementMetadataQuery` |
| 599 | `GET` | `/api/v1/smartflow/agreements/priorities` | `madbelGetAgreementPriorities` | `useMadbelGetAgreementPrioritiesQuery`, `useMadbelGetAgreementPrioritiesMutation`, `useLazyMadbelGetAgreementPrioritiesQuery` |
| 616 | `POST` | `/api/v1/smartflow/agreements/improve` | `madbelImproveAgreementDraft` | `useMadbelImproveAgreementDraftQuery`, `useMadbelImproveAgreementDraftMutation`, `useLazyMadbelImproveAgreementDraftQuery` |
| 625 | `POST` | `/api/v1/smartflow/agreements/review` | `madbelReviewAgreementDraft` | `useMadbelReviewAgreementDraftQuery`, `useMadbelReviewAgreementDraftMutation`, `useLazyMadbelReviewAgreementDraftQuery` |
| 634 | `GET` | `/api/v1/smartflow/agreements/signing/{signature_token}` | `madbelGetPublicSigningAgreement` | `useMadbelGetPublicSigningAgreementQuery`, `useMadbelGetPublicSigningAgreementMutation`, `useLazyMadbelGetPublicSigningAgreementQuery` |
| 634 | `POST` | `/api/v1/smartflow/agreements/signing/{signature_token}` | `madbelGetPublicSigningAgreement` | `useMadbelGetPublicSigningAgreementQuery`, `useMadbelGetPublicSigningAgreementMutation`, `useLazyMadbelGetPublicSigningAgreementQuery` |
| 644 | `GET` | `/api/v1/smartflow/agreements/signing/{signature_token}` | `madbelSignPublicAgreement` | `useMadbelSignPublicAgreementQuery`, `useMadbelSignPublicAgreementMutation`, `useLazyMadbelSignPublicAgreementQuery` |
| 644 | `POST` | `/api/v1/smartflow/agreements/signing/{signature_token}` | `madbelSignPublicAgreement` | `useMadbelSignPublicAgreementQuery`, `useMadbelSignPublicAgreementMutation`, `useLazyMadbelSignPublicAgreementQuery` |
| 703 | `POST` | `/api/v1/smartflow/agreements/{agreement_id}/improve` | `madbelImproveAgreement` | `useMadbelImproveAgreementQuery`, `useMadbelImproveAgreementMutation`, `useLazyMadbelImproveAgreementQuery` |
| 713 | `POST` | `/api/v1/smartflow/agreements/{agreement_id}/review` | `madbelReviewAgreement` | `useMadbelReviewAgreementQuery`, `useMadbelReviewAgreementMutation`, `useLazyMadbelReviewAgreementQuery` |
| 732 | `POST` | `/api/v1/smartflow/agreements/{agreement_id}/sign` | `madbelSignAgreement` | `useMadbelSignAgreementQuery`, `useMadbelSignAgreementMutation`, `useLazyMadbelSignAgreementQuery` |
| 742 | `POST` | `/api/v1/smartflow/agreements/{agreement_id}/renew` | `madbelRenewAgreement` | `useMadbelRenewAgreementQuery`, `useMadbelRenewAgreementMutation`, `useLazyMadbelRenewAgreementQuery` |
| 761 | `GET` | `/api/v1/smartflow/calls` | `madbelListCalls` | `useMadbelListCallsQuery`, `useMadbelListCallsMutation`, `useLazyMadbelListCallsQuery` |
| 761 | `POST` | `/api/v1/smartflow/calls` | `madbelListCalls` | `useMadbelListCallsQuery`, `useMadbelListCallsMutation`, `useLazyMadbelListCallsQuery` |
| 770 | `GET` | `/api/v1/smartflow/calls` | `madbelCreateCallLog` | `useMadbelCreateCallLogQuery`, `useMadbelCreateCallLogMutation`, `useLazyMadbelCreateCallLogQuery` |
| 770 | `POST` | `/api/v1/smartflow/calls` | `madbelCreateCallLog` | `useMadbelCreateCallLogQuery`, `useMadbelCreateCallLogMutation`, `useLazyMadbelCreateCallLogQuery` |
| 779 | `GET` | `/api/v1/smartflow/calls` | `madbelCreateOutboundCall` | `useMadbelCreateOutboundCallQuery`, `useMadbelCreateOutboundCallMutation`, `useLazyMadbelCreateOutboundCallQuery` |
| 779 | `POST` | `/api/v1/smartflow/calls` | `madbelCreateOutboundCall` | `useMadbelCreateOutboundCallQuery`, `useMadbelCreateOutboundCallMutation`, `useLazyMadbelCreateOutboundCallQuery` |
| 779 | `POST` | `/api/v1/smartflow/calls/outbound` | `madbelCreateOutboundCall` | `useMadbelCreateOutboundCallQuery`, `useMadbelCreateOutboundCallMutation`, `useLazyMadbelCreateOutboundCallQuery` |
| 779 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelCreateOutboundCall` | `useMadbelCreateOutboundCallQuery`, `useMadbelCreateOutboundCallMutation`, `useLazyMadbelCreateOutboundCallQuery` |
| 779 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelCreateOutboundCall` | `useMadbelCreateOutboundCallQuery`, `useMadbelCreateOutboundCallMutation`, `useLazyMadbelCreateOutboundCallQuery` |
| 788 | `GET` | `/api/v1/smartflow/calls` | `madbelGetCallSummary` | `useMadbelGetCallSummaryQuery`, `useMadbelGetCallSummaryMutation`, `useLazyMadbelGetCallSummaryQuery` |
| 788 | `POST` | `/api/v1/smartflow/calls` | `madbelGetCallSummary` | `useMadbelGetCallSummaryQuery`, `useMadbelGetCallSummaryMutation`, `useLazyMadbelGetCallSummaryQuery` |
| 788 | `GET` | `/api/v1/smartflow/calls/summary` | `madbelGetCallSummary` | `useMadbelGetCallSummaryQuery`, `useMadbelGetCallSummaryMutation`, `useLazyMadbelGetCallSummaryQuery` |
| 788 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallSummary` | `useMadbelGetCallSummaryQuery`, `useMadbelGetCallSummaryMutation`, `useLazyMadbelGetCallSummaryQuery` |
| 788 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallSummary` | `useMadbelGetCallSummaryQuery`, `useMadbelGetCallSummaryMutation`, `useLazyMadbelGetCallSummaryQuery` |
| 796 | `GET` | `/api/v1/smartflow/calls` | `madbelGetCallLog` | `useMadbelGetCallLogQuery`, `useMadbelGetCallLogMutation`, `useLazyMadbelGetCallLogQuery` |
| 796 | `POST` | `/api/v1/smartflow/calls` | `madbelGetCallLog` | `useMadbelGetCallLogQuery`, `useMadbelGetCallLogMutation`, `useLazyMadbelGetCallLogQuery` |
| 796 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallLog` | `useMadbelGetCallLogQuery`, `useMadbelGetCallLogMutation`, `useLazyMadbelGetCallLogQuery` |
| 796 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallLog` | `useMadbelGetCallLogQuery`, `useMadbelGetCallLogMutation`, `useLazyMadbelGetCallLogQuery` |
| 805 | `GET` | `/api/v1/smartflow/calls` | `madbelUpdateCallLog` | `useMadbelUpdateCallLogQuery`, `useMadbelUpdateCallLogMutation`, `useLazyMadbelUpdateCallLogQuery` |
| 805 | `POST` | `/api/v1/smartflow/calls` | `madbelUpdateCallLog` | `useMadbelUpdateCallLogQuery`, `useMadbelUpdateCallLogMutation`, `useLazyMadbelUpdateCallLogQuery` |
| 805 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelUpdateCallLog` | `useMadbelUpdateCallLogQuery`, `useMadbelUpdateCallLogMutation`, `useLazyMadbelUpdateCallLogQuery` |
| 805 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelUpdateCallLog` | `useMadbelUpdateCallLogQuery`, `useMadbelUpdateCallLogMutation`, `useLazyMadbelUpdateCallLogQuery` |
| 815 | `GET` | `/api/v1/smartflow/calls` | `madbelGetCallTranscript` | `useMadbelGetCallTranscriptQuery`, `useMadbelGetCallTranscriptMutation`, `useLazyMadbelGetCallTranscriptQuery` |
| 815 | `POST` | `/api/v1/smartflow/calls` | `madbelGetCallTranscript` | `useMadbelGetCallTranscriptQuery`, `useMadbelGetCallTranscriptMutation`, `useLazyMadbelGetCallTranscriptQuery` |
| 815 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallTranscript` | `useMadbelGetCallTranscriptQuery`, `useMadbelGetCallTranscriptMutation`, `useLazyMadbelGetCallTranscriptQuery` |
| 815 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallTranscript` | `useMadbelGetCallTranscriptQuery`, `useMadbelGetCallTranscriptMutation`, `useLazyMadbelGetCallTranscriptQuery` |
| 815 | `GET` | `/api/v1/smartflow/calls/{call_id}/transcript` | `madbelGetCallTranscript` | `useMadbelGetCallTranscriptQuery`, `useMadbelGetCallTranscriptMutation`, `useLazyMadbelGetCallTranscriptQuery` |
| 815 | `PUT` | `/api/v1/smartflow/calls/{call_id}/transcript` | `madbelGetCallTranscript` | `useMadbelGetCallTranscriptQuery`, `useMadbelGetCallTranscriptMutation`, `useLazyMadbelGetCallTranscriptQuery` |
| 824 | `GET` | `/api/v1/smartflow/calls` | `madbelUpdateCallTranscript` | `useMadbelUpdateCallTranscriptQuery`, `useMadbelUpdateCallTranscriptMutation`, `useLazyMadbelUpdateCallTranscriptQuery` |
| 824 | `POST` | `/api/v1/smartflow/calls` | `madbelUpdateCallTranscript` | `useMadbelUpdateCallTranscriptQuery`, `useMadbelUpdateCallTranscriptMutation`, `useLazyMadbelUpdateCallTranscriptQuery` |
| 824 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelUpdateCallTranscript` | `useMadbelUpdateCallTranscriptQuery`, `useMadbelUpdateCallTranscriptMutation`, `useLazyMadbelUpdateCallTranscriptQuery` |
| 824 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelUpdateCallTranscript` | `useMadbelUpdateCallTranscriptQuery`, `useMadbelUpdateCallTranscriptMutation`, `useLazyMadbelUpdateCallTranscriptQuery` |
| 824 | `GET` | `/api/v1/smartflow/calls/{call_id}/transcript` | `madbelUpdateCallTranscript` | `useMadbelUpdateCallTranscriptQuery`, `useMadbelUpdateCallTranscriptMutation`, `useLazyMadbelUpdateCallTranscriptQuery` |
| 824 | `PUT` | `/api/v1/smartflow/calls/{call_id}/transcript` | `madbelUpdateCallTranscript` | `useMadbelUpdateCallTranscriptQuery`, `useMadbelUpdateCallTranscriptMutation`, `useLazyMadbelUpdateCallTranscriptQuery` |
| 834 | `GET` | `/api/v1/smartflow/calls` | `madbelGetCallAiSummary` | `useMadbelGetCallAiSummaryQuery`, `useMadbelGetCallAiSummaryMutation`, `useLazyMadbelGetCallAiSummaryQuery` |
| 834 | `POST` | `/api/v1/smartflow/calls` | `madbelGetCallAiSummary` | `useMadbelGetCallAiSummaryQuery`, `useMadbelGetCallAiSummaryMutation`, `useLazyMadbelGetCallAiSummaryQuery` |
| 834 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallAiSummary` | `useMadbelGetCallAiSummaryQuery`, `useMadbelGetCallAiSummaryMutation`, `useLazyMadbelGetCallAiSummaryQuery` |
| 834 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallAiSummary` | `useMadbelGetCallAiSummaryQuery`, `useMadbelGetCallAiSummaryMutation`, `useLazyMadbelGetCallAiSummaryQuery` |
| 834 | `GET` | `/api/v1/smartflow/calls/{call_id}/ai-summary` | `madbelGetCallAiSummary` | `useMadbelGetCallAiSummaryQuery`, `useMadbelGetCallAiSummaryMutation`, `useLazyMadbelGetCallAiSummaryQuery` |
| 834 | `PUT` | `/api/v1/smartflow/calls/{call_id}/ai-summary` | `madbelGetCallAiSummary` | `useMadbelGetCallAiSummaryQuery`, `useMadbelGetCallAiSummaryMutation`, `useLazyMadbelGetCallAiSummaryQuery` |
| 843 | `GET` | `/api/v1/smartflow/calls` | `madbelUpdateCallAiSummary` | `useMadbelUpdateCallAiSummaryQuery`, `useMadbelUpdateCallAiSummaryMutation`, `useLazyMadbelUpdateCallAiSummaryQuery` |
| 843 | `POST` | `/api/v1/smartflow/calls` | `madbelUpdateCallAiSummary` | `useMadbelUpdateCallAiSummaryQuery`, `useMadbelUpdateCallAiSummaryMutation`, `useLazyMadbelUpdateCallAiSummaryQuery` |
| 843 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelUpdateCallAiSummary` | `useMadbelUpdateCallAiSummaryQuery`, `useMadbelUpdateCallAiSummaryMutation`, `useLazyMadbelUpdateCallAiSummaryQuery` |
| 843 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelUpdateCallAiSummary` | `useMadbelUpdateCallAiSummaryQuery`, `useMadbelUpdateCallAiSummaryMutation`, `useLazyMadbelUpdateCallAiSummaryQuery` |
| 843 | `GET` | `/api/v1/smartflow/calls/{call_id}/ai-summary` | `madbelUpdateCallAiSummary` | `useMadbelUpdateCallAiSummaryQuery`, `useMadbelUpdateCallAiSummaryMutation`, `useLazyMadbelUpdateCallAiSummaryQuery` |
| 843 | `PUT` | `/api/v1/smartflow/calls/{call_id}/ai-summary` | `madbelUpdateCallAiSummary` | `useMadbelUpdateCallAiSummaryQuery`, `useMadbelUpdateCallAiSummaryMutation`, `useLazyMadbelUpdateCallAiSummaryQuery` |
| 853 | `GET` | `/api/v1/smartflow/calls` | `madbelRequestCallCallbackSmartFlow` | `useMadbelRequestCallCallbackSmartFlowQuery`, `useMadbelRequestCallCallbackSmartFlowMutation`, `useLazyMadbelRequestCallCallbackSmartFlowQuery` |
| 853 | `POST` | `/api/v1/smartflow/calls` | `madbelRequestCallCallbackSmartFlow` | `useMadbelRequestCallCallbackSmartFlowQuery`, `useMadbelRequestCallCallbackSmartFlowMutation`, `useLazyMadbelRequestCallCallbackSmartFlowQuery` |
| 853 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelRequestCallCallbackSmartFlow` | `useMadbelRequestCallCallbackSmartFlowQuery`, `useMadbelRequestCallCallbackSmartFlowMutation`, `useLazyMadbelRequestCallCallbackSmartFlowQuery` |
| 853 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelRequestCallCallbackSmartFlow` | `useMadbelRequestCallCallbackSmartFlowQuery`, `useMadbelRequestCallCallbackSmartFlowMutation`, `useLazyMadbelRequestCallCallbackSmartFlowQuery` |
| 853 | `POST` | `/api/v1/smartflow/calls/{call_id}/callback` | `madbelRequestCallCallbackSmartFlow` | `useMadbelRequestCallCallbackSmartFlowQuery`, `useMadbelRequestCallCallbackSmartFlowMutation`, `useLazyMadbelRequestCallCallbackSmartFlowQuery` |
| 862 | `GET` | `/api/v1/smartflow/calls` | `madbelGetCallRecording` | `useMadbelGetCallRecordingQuery`, `useMadbelGetCallRecordingMutation`, `useLazyMadbelGetCallRecordingQuery` |
| 862 | `POST` | `/api/v1/smartflow/calls` | `madbelGetCallRecording` | `useMadbelGetCallRecordingQuery`, `useMadbelGetCallRecordingMutation`, `useLazyMadbelGetCallRecordingQuery` |
| 862 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallRecording` | `useMadbelGetCallRecordingQuery`, `useMadbelGetCallRecordingMutation`, `useLazyMadbelGetCallRecordingQuery` |
| 862 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelGetCallRecording` | `useMadbelGetCallRecordingQuery`, `useMadbelGetCallRecordingMutation`, `useLazyMadbelGetCallRecordingQuery` |
| 871 | `GET` | `/api/v1/smartflow/calls` | `madbelUpdateCallRecording` | `useMadbelUpdateCallRecordingQuery`, `useMadbelUpdateCallRecordingMutation`, `useLazyMadbelUpdateCallRecordingQuery` |
| 871 | `POST` | `/api/v1/smartflow/calls` | `madbelUpdateCallRecording` | `useMadbelUpdateCallRecordingQuery`, `useMadbelUpdateCallRecordingMutation`, `useLazyMadbelUpdateCallRecordingQuery` |
| 871 | `GET` | `/api/v1/smartflow/calls/{call_id}` | `madbelUpdateCallRecording` | `useMadbelUpdateCallRecordingQuery`, `useMadbelUpdateCallRecordingMutation`, `useLazyMadbelUpdateCallRecordingQuery` |
| 871 | `PATCH` | `/api/v1/smartflow/calls/{call_id}` | `madbelUpdateCallRecording` | `useMadbelUpdateCallRecordingQuery`, `useMadbelUpdateCallRecordingMutation`, `useLazyMadbelUpdateCallRecordingQuery` |
| 881 | `GET` | `/api/v1/smartflow/integrations` | `madbelListIntegrations` | `useMadbelListIntegrationsQuery`, `useMadbelListIntegrationsMutation`, `useLazyMadbelListIntegrationsQuery` |
| 881 | `POST` | `/api/v1/smartflow/integrations` | `madbelListIntegrations` | `useMadbelListIntegrationsQuery`, `useMadbelListIntegrationsMutation`, `useLazyMadbelListIntegrationsQuery` |
| 889 | `GET` | `/api/v1/smartflow/integrations` | `madbelConnectIntegrationSmartFlow` | `useMadbelConnectIntegrationSmartFlowQuery`, `useMadbelConnectIntegrationSmartFlowMutation`, `useLazyMadbelConnectIntegrationSmartFlowQuery` |
| 889 | `POST` | `/api/v1/smartflow/integrations` | `madbelConnectIntegrationSmartFlow` | `useMadbelConnectIntegrationSmartFlowQuery`, `useMadbelConnectIntegrationSmartFlowMutation`, `useLazyMadbelConnectIntegrationSmartFlowQuery` |
| 898 | `GET` | `/api/v1/smartflow/integrations` | `madbelListIntegrationCatalog` | `useMadbelListIntegrationCatalogQuery`, `useMadbelListIntegrationCatalogMutation`, `useLazyMadbelListIntegrationCatalogQuery` |
| 898 | `POST` | `/api/v1/smartflow/integrations` | `madbelListIntegrationCatalog` | `useMadbelListIntegrationCatalogQuery`, `useMadbelListIntegrationCatalogMutation`, `useLazyMadbelListIntegrationCatalogQuery` |
| 898 | `GET` | `/api/v1/smartflow/integrations/catalog` | `madbelListIntegrationCatalog` | `useMadbelListIntegrationCatalogQuery`, `useMadbelListIntegrationCatalogMutation`, `useLazyMadbelListIntegrationCatalogQuery` |
| 898 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `madbelListIntegrationCatalog` | `useMadbelListIntegrationCatalogQuery`, `useMadbelListIntegrationCatalogMutation`, `useLazyMadbelListIntegrationCatalogQuery` |
| 906 | `GET` | `/api/v1/smartflow/integrations` | `madbelGetIntegrationStatus` | `useMadbelGetIntegrationStatusQuery`, `useMadbelGetIntegrationStatusMutation`, `useLazyMadbelGetIntegrationStatusQuery` |
| 906 | `POST` | `/api/v1/smartflow/integrations` | `madbelGetIntegrationStatus` | `useMadbelGetIntegrationStatusQuery`, `useMadbelGetIntegrationStatusMutation`, `useLazyMadbelGetIntegrationStatusQuery` |
| 906 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `madbelGetIntegrationStatus` | `useMadbelGetIntegrationStatusQuery`, `useMadbelGetIntegrationStatusMutation`, `useLazyMadbelGetIntegrationStatusQuery` |
| 914 | `GET` | `/api/v1/smartflow/integrations` | `madbelSyncIntegration` | `useMadbelSyncIntegrationQuery`, `useMadbelSyncIntegrationMutation`, `useLazyMadbelSyncIntegrationQuery` |
| 914 | `POST` | `/api/v1/smartflow/integrations` | `madbelSyncIntegration` | `useMadbelSyncIntegrationQuery`, `useMadbelSyncIntegrationMutation`, `useLazyMadbelSyncIntegrationQuery` |
| 914 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `madbelSyncIntegration` | `useMadbelSyncIntegrationQuery`, `useMadbelSyncIntegrationMutation`, `useLazyMadbelSyncIntegrationQuery` |
| 914 | `POST` | `/api/v1/smartflow/integrations/{platform}/sync` | `madbelSyncIntegration` | `useMadbelSyncIntegrationQuery`, `useMadbelSyncIntegrationMutation`, `useLazyMadbelSyncIntegrationQuery` |
| 923 | `GET` | `/api/v1/smartflow/integrations` | `madbelConnectTelegramManual` | `useMadbelConnectTelegramManualQuery`, `useMadbelConnectTelegramManualMutation`, `useLazyMadbelConnectTelegramManualQuery` |
| 923 | `POST` | `/api/v1/smartflow/integrations` | `madbelConnectTelegramManual` | `useMadbelConnectTelegramManualQuery`, `useMadbelConnectTelegramManualMutation`, `useLazyMadbelConnectTelegramManualQuery` |
| 923 | `POST` | `/api/v1/smartflow/integrations/telegram/manual-connect` | `madbelConnectTelegramManual` | `useMadbelConnectTelegramManualQuery`, `useMadbelConnectTelegramManualMutation`, `useLazyMadbelConnectTelegramManualQuery` |
| 923 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `madbelConnectTelegramManual` | `useMadbelConnectTelegramManualQuery`, `useMadbelConnectTelegramManualMutation`, `useLazyMadbelConnectTelegramManualQuery` |
| 932 | `GET` | `/api/v1/smartflow/integrations` | `madbelStartIntegrationOauth` | `useMadbelStartIntegrationOauthQuery`, `useMadbelStartIntegrationOauthMutation`, `useLazyMadbelStartIntegrationOauthQuery` |
| 932 | `POST` | `/api/v1/smartflow/integrations` | `madbelStartIntegrationOauth` | `useMadbelStartIntegrationOauthQuery`, `useMadbelStartIntegrationOauthMutation`, `useLazyMadbelStartIntegrationOauthQuery` |
| 932 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `madbelStartIntegrationOauth` | `useMadbelStartIntegrationOauthQuery`, `useMadbelStartIntegrationOauthMutation`, `useLazyMadbelStartIntegrationOauthQuery` |
| 932 | `GET` | `/api/v1/smartflow/integrations/{platform}/oauth/start` | `madbelStartIntegrationOauth` | `useMadbelStartIntegrationOauthQuery`, `useMadbelStartIntegrationOauthMutation`, `useLazyMadbelStartIntegrationOauthQuery` |
| 941 | `GET` | `/api/v1/smartflow/integrations` | `madbelCompleteIntegrationOauth` | `useMadbelCompleteIntegrationOauthQuery`, `useMadbelCompleteIntegrationOauthMutation`, `useLazyMadbelCompleteIntegrationOauthQuery` |
| 941 | `POST` | `/api/v1/smartflow/integrations` | `madbelCompleteIntegrationOauth` | `useMadbelCompleteIntegrationOauthQuery`, `useMadbelCompleteIntegrationOauthMutation`, `useLazyMadbelCompleteIntegrationOauthQuery` |
| 941 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `madbelCompleteIntegrationOauth` | `useMadbelCompleteIntegrationOauthQuery`, `useMadbelCompleteIntegrationOauthMutation`, `useLazyMadbelCompleteIntegrationOauthQuery` |
| 941 | `GET` | `/api/v1/smartflow/integrations/{platform}/oauth/callback` | `madbelCompleteIntegrationOauth` | `useMadbelCompleteIntegrationOauthQuery`, `useMadbelCompleteIntegrationOauthMutation`, `useLazyMadbelCompleteIntegrationOauthQuery` |
| 952 | `GET` | `/api/v1/smartflow/integrations` | `madbelDisconnectIntegration` | `useMadbelDisconnectIntegrationQuery`, `useMadbelDisconnectIntegrationMutation`, `useLazyMadbelDisconnectIntegrationQuery` |
| 952 | `POST` | `/api/v1/smartflow/integrations` | `madbelDisconnectIntegration` | `useMadbelDisconnectIntegrationQuery`, `useMadbelDisconnectIntegrationMutation`, `useLazyMadbelDisconnectIntegrationQuery` |
| 952 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `madbelDisconnectIntegration` | `useMadbelDisconnectIntegrationQuery`, `useMadbelDisconnectIntegrationMutation`, `useLazyMadbelDisconnectIntegrationQuery` |
| 961 | `GET` | `/api/v1/smartflow/integrations` | `madbelVerifyPlatformWebhook` | `useMadbelVerifyPlatformWebhookQuery`, `useMadbelVerifyPlatformWebhookMutation`, `useLazyMadbelVerifyPlatformWebhookQuery` |
| 961 | `POST` | `/api/v1/smartflow/integrations` | `madbelVerifyPlatformWebhook` | `useMadbelVerifyPlatformWebhookQuery`, `useMadbelVerifyPlatformWebhookMutation`, `useLazyMadbelVerifyPlatformWebhookQuery` |
| 961 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `madbelVerifyPlatformWebhook` | `useMadbelVerifyPlatformWebhookQuery`, `useMadbelVerifyPlatformWebhookMutation`, `useLazyMadbelVerifyPlatformWebhookQuery` |
| 972 | `GET` | `/api/v1/smartflow/integrations` | `madbelReceivePlatformWebhook` | `useMadbelReceivePlatformWebhookQuery`, `useMadbelReceivePlatformWebhookMutation`, `useLazyMadbelReceivePlatformWebhookQuery` |
| 972 | `POST` | `/api/v1/smartflow/integrations` | `madbelReceivePlatformWebhook` | `useMadbelReceivePlatformWebhookQuery`, `useMadbelReceivePlatformWebhookMutation`, `useLazyMadbelReceivePlatformWebhookQuery` |
| 972 | `DELETE` | `/api/v1/smartflow/integrations/{platform}` | `madbelReceivePlatformWebhook` | `useMadbelReceivePlatformWebhookQuery`, `useMadbelReceivePlatformWebhookMutation`, `useLazyMadbelReceivePlatformWebhookQuery` |
| 983 | `GET` | `/api/v1/smartflow/notifications` | `madbelListNotifications` | `useMadbelListNotificationsQuery`, `useMadbelListNotificationsMutation`, `useLazyMadbelListNotificationsQuery` |
| 992 | `GET` | `/api/v1/smartflow/notifications` | `madbelMarkAllNotificationsRead` | `useMadbelMarkAllNotificationsReadQuery`, `useMadbelMarkAllNotificationsReadMutation`, `useLazyMadbelMarkAllNotificationsReadQuery` |
| 992 | `POST` | `/api/v1/smartflow/notifications/mark-all-read` | `madbelMarkAllNotificationsRead` | `useMadbelMarkAllNotificationsReadQuery`, `useMadbelMarkAllNotificationsReadMutation`, `useLazyMadbelMarkAllNotificationsReadQuery` |
| 992 | `DELETE` | `/api/v1/smartflow/notifications/{notification_id}` | `madbelMarkAllNotificationsRead` | `useMadbelMarkAllNotificationsReadQuery`, `useMadbelMarkAllNotificationsReadMutation`, `useLazyMadbelMarkAllNotificationsReadQuery` |
| 1000 | `GET` | `/api/v1/smartflow/notifications` | `madbelMarkNotificationRead` | `useMadbelMarkNotificationReadQuery`, `useMadbelMarkNotificationReadMutation`, `useLazyMadbelMarkNotificationReadQuery` |
| 1000 | `DELETE` | `/api/v1/smartflow/notifications/{notification_id}` | `madbelMarkNotificationRead` | `useMadbelMarkNotificationReadQuery`, `useMadbelMarkNotificationReadMutation`, `useLazyMadbelMarkNotificationReadQuery` |
| 1000 | `PATCH` | `/api/v1/smartflow/notifications/{notification_id}/read` | `madbelMarkNotificationRead` | `useMadbelMarkNotificationReadQuery`, `useMadbelMarkNotificationReadMutation`, `useLazyMadbelMarkNotificationReadQuery` |
| 1009 | `GET` | `/api/v1/smartflow/notifications` | `madbelDeleteNotification` | `useMadbelDeleteNotificationQuery`, `useMadbelDeleteNotificationMutation`, `useLazyMadbelDeleteNotificationQuery` |
| 1009 | `DELETE` | `/api/v1/smartflow/notifications/{notification_id}` | `madbelDeleteNotification` | `useMadbelDeleteNotificationQuery`, `useMadbelDeleteNotificationMutation`, `useLazyMadbelDeleteNotificationQuery` |
| 1018 | `GET` | `/api/v1/smartflow/notifications` | `madbelDispatchPendingNotifications` | `useMadbelDispatchPendingNotificationsQuery`, `useMadbelDispatchPendingNotificationsMutation`, `useLazyMadbelDispatchPendingNotificationsQuery` |
| 1018 | `POST` | `/api/v1/smartflow/notifications/dispatch-pending` | `madbelDispatchPendingNotifications` | `useMadbelDispatchPendingNotificationsQuery`, `useMadbelDispatchPendingNotificationsMutation`, `useLazyMadbelDispatchPendingNotificationsQuery` |
| 1018 | `DELETE` | `/api/v1/smartflow/notifications/{notification_id}` | `madbelDispatchPendingNotifications` | `useMadbelDispatchPendingNotificationsQuery`, `useMadbelDispatchPendingNotificationsMutation`, `useLazyMadbelDispatchPendingNotificationsQuery` |
| 1112 | `DELETE` | `/api/v1/smartflow/groups/{group_id}/invites/{invite_id}` | `madbelCancelGroupInvite` | `useMadbelCancelGroupInviteQuery`, `useMadbelCancelGroupInviteMutation`, `useLazyMadbelCancelGroupInviteQuery` |
| 1130 | `GET` | `/api/v1/smartflow/business-profile` | `madbelGetBusinessProfile` | `useMadbelGetBusinessProfileQuery`, `useMadbelGetBusinessProfileMutation`, `useLazyMadbelGetBusinessProfileQuery` |
| 1130 | `PATCH` | `/api/v1/smartflow/business-profile` | `madbelGetBusinessProfile` | `useMadbelGetBusinessProfileQuery`, `useMadbelGetBusinessProfileMutation`, `useLazyMadbelGetBusinessProfileQuery` |
| 1138 | `GET` | `/api/v1/smartflow/business-profile` | `madbelUpdateBusinessProfile` | `useMadbelUpdateBusinessProfileQuery`, `useMadbelUpdateBusinessProfileMutation`, `useLazyMadbelUpdateBusinessProfileQuery` |
| 1138 | `PATCH` | `/api/v1/smartflow/business-profile` | `madbelUpdateBusinessProfile` | `useMadbelUpdateBusinessProfileQuery`, `useMadbelUpdateBusinessProfileMutation`, `useLazyMadbelUpdateBusinessProfileQuery` |
| 1147 | `GET` | `/api/v1/smartflow/business-profile` | `madbelUploadBusinessLogo` | `useMadbelUploadBusinessLogoQuery`, `useMadbelUploadBusinessLogoMutation`, `useLazyMadbelUploadBusinessLogoQuery` |
| 1147 | `PATCH` | `/api/v1/smartflow/business-profile` | `madbelUploadBusinessLogo` | `useMadbelUploadBusinessLogoQuery`, `useMadbelUploadBusinessLogoMutation`, `useLazyMadbelUploadBusinessLogoQuery` |
| 1157 | `GET` | `/api/v1/smartflow/subscription/plans` | `madbelListSubscriptionPlans` | `useMadbelListSubscriptionPlansQuery`, `useMadbelListSubscriptionPlansMutation`, `useLazyMadbelListSubscriptionPlansQuery` |
| 1165 | `GET` | `/api/v1/smartflow/subscription/current` | `madbelGetCurrentSubscription` | `useMadbelGetCurrentSubscriptionQuery`, `useMadbelGetCurrentSubscriptionMutation`, `useLazyMadbelGetCurrentSubscriptionQuery` |
| 1173 | `POST` | `/api/v1/smartflow/reports` | `madbelListReportCategories` | `useMadbelListReportCategoriesQuery`, `useMadbelListReportCategoriesMutation`, `useLazyMadbelListReportCategoriesQuery` |
| 1173 | `GET` | `/api/v1/smartflow/reports/categories` | `madbelListReportCategories` | `useMadbelListReportCategoriesQuery`, `useMadbelListReportCategoriesMutation`, `useLazyMadbelListReportCategoriesQuery` |
| 1181 | `POST` | `/api/v1/smartflow/reports` | `madbelCreateUserReport` | `useMadbelCreateUserReportQuery`, `useMadbelCreateUserReportMutation`, `useLazyMadbelCreateUserReportQuery` |
| 1190 | `POST` | `/api/v1/smartflow/support/tickets` | `madbelCreateSupportTicket` | `useMadbelCreateSupportTicketQuery`, `useMadbelCreateSupportTicketMutation`, `useLazyMadbelCreateSupportTicketQuery` |
| 1199 | `GET` | `/api/v1/smartflow/support/session` | `madbelGetSupportSession` | `useMadbelGetSupportSessionQuery`, `useMadbelGetSupportSessionMutation`, `useLazyMadbelGetSupportSessionQuery` |
| 1199 | `POST` | `/api/v1/smartflow/support/session` | `madbelGetSupportSession` | `useMadbelGetSupportSessionQuery`, `useMadbelGetSupportSessionMutation`, `useLazyMadbelGetSupportSessionQuery` |
| 1207 | `GET` | `/api/v1/smartflow/support/session` | `madbelStartSupportSession` | `useMadbelStartSupportSessionQuery`, `useMadbelStartSupportSessionMutation`, `useLazyMadbelStartSupportSessionQuery` |
| 1207 | `POST` | `/api/v1/smartflow/support/session` | `madbelStartSupportSession` | `useMadbelStartSupportSessionQuery`, `useMadbelStartSupportSessionMutation`, `useLazyMadbelStartSupportSessionQuery` |
| 1216 | `GET` | `/api/v1/smartflow/support/messages` | `madbelListSupportMessages` | `useMadbelListSupportMessagesQuery`, `useMadbelListSupportMessagesMutation`, `useLazyMadbelListSupportMessagesQuery` |
| 1216 | `POST` | `/api/v1/smartflow/support/messages` | `madbelListSupportMessages` | `useMadbelListSupportMessagesQuery`, `useMadbelListSupportMessagesMutation`, `useLazyMadbelListSupportMessagesQuery` |
| 1225 | `GET` | `/api/v1/smartflow/support/messages` | `madbelCreateSupportMessage` | `useMadbelCreateSupportMessageQuery`, `useMadbelCreateSupportMessageMutation`, `useLazyMadbelCreateSupportMessageQuery` |
| 1225 | `POST` | `/api/v1/smartflow/support/messages` | `madbelCreateSupportMessage` | `useMadbelCreateSupportMessageQuery`, `useMadbelCreateSupportMessageMutation`, `useLazyMadbelCreateSupportMessageQuery` |
| 1234 | `DELETE` | `/api/v1/smartflow/account` | `madbelDeleteAccount` | `useMadbelDeleteAccountQuery`, `useMadbelDeleteAccountMutation`, `useLazyMadbelDeleteAccountQuery` |
| 1269 | `GET` | `/api/v1/smartflow/settings/notifications` | `madbelGetNotificationSettings` | `useMadbelGetNotificationSettingsQuery`, `useMadbelGetNotificationSettingsMutation`, `useLazyMadbelGetNotificationSettingsQuery` |
| 1269 | `PATCH` | `/api/v1/smartflow/settings/notifications` | `madbelGetNotificationSettings` | `useMadbelGetNotificationSettingsQuery`, `useMadbelGetNotificationSettingsMutation`, `useLazyMadbelGetNotificationSettingsQuery` |
| 1277 | `GET` | `/api/v1/smartflow/settings/notifications` | `madbelUpdateNotificationSettings` | `useMadbelUpdateNotificationSettingsQuery`, `useMadbelUpdateNotificationSettingsMutation`, `useLazyMadbelUpdateNotificationSettingsQuery` |
| 1277 | `PATCH` | `/api/v1/smartflow/settings/notifications` | `madbelUpdateNotificationSettings` | `useMadbelUpdateNotificationSettingsQuery`, `useMadbelUpdateNotificationSettingsMutation`, `useLazyMadbelUpdateNotificationSettingsQuery` |
| 1286 | `POST` | `/api/v1/smartflow/devices/push-token` | `madbelRegisterPushToken` | `useMadbelRegisterPushTokenQuery`, `useMadbelRegisterPushTokenMutation`, `useLazyMadbelRegisterPushTokenQuery` |
| 1304 | `POST` | `/api/v1/smartflow/settings/revoke-sessions` | `madbelRevokeSessions` | `useMadbelRevokeSessionsQuery`, `useMadbelRevokeSessionsMutation`, `useLazyMadbelRevokeSessionsQuery` |
| 1312 | `GET` | `/health` | `madbelHealthCheckHealthGet` | `useMadbelHealthCheckHealthGetQuery`, `useMadbelHealthCheckHealthGetMutation`, `useLazyMadbelHealthCheckHealthGetQuery` |
| 1321 | `GET` | `/ready` | `madbelReadinessCheckReadyGet` | `useMadbelReadinessCheckReadyGetQuery`, `useMadbelReadinessCheckReadyGetMutation`, `useLazyMadbelReadinessCheckReadyGetQuery` |

