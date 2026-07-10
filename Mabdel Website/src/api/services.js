import client from './client';

export const smartflowApi = {
  getHome: () => client.get('/api/v1/smartflow/home'),
  
  // Contacts
  getContacts: () => client.get('/api/v1/smartflow/contacts'),
  getContact: (id) => client.get(`/api/v1/smartflow/contacts/${id}`),
  createContact: (data) => client.post('/api/v1/smartflow/contacts', data),
  updateContact: (id, data) => client.patch(`/api/v1/smartflow/contacts/${id}`, data),
  deleteContact: (id) => client.delete(`/api/v1/smartflow/contacts/${id}`),
  uploadContactAvatar: (id, formData) => client.post(`/api/v1/smartflow/contacts/${id}/avatar`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  createOutboundCall: (data) => client.post('/api/v1/smartflow/calls/outbound', data),

  // Conversations
  getConversations: () => client.get('/api/v1/smartflow/conversations'),
  getMessages: (id) => client.get(`/api/v1/smartflow/conversations/${id}/messages`),
  sendMessage: (data) => client.post('/api/v1/smartflow/messages', data),
  markRead: (id) => client.post(`/api/v1/smartflow/conversations/${id}/mark-read`),
  archiveConversation: (id) => client.patch(`/api/v1/smartflow/conversations/${id}/archive`),
  getTypingStatus: (id) => client.get(`/api/v1/smartflow/conversations/${id}/typing`),
  setTypingStatus: (id, typing) => client.post(`/api/v1/smartflow/conversations/${id}/typing`, { typing }),

  // AI & Voice
  processAI: (data) => client.post('/api/v1/smartflow/ai/workflow-prefill', {
    transcript: data.prompt || data.transcript,
    workflow_intent: data.workflow_intent,
    current_values: data.current_values || {},
  }),
  getAIWorkflowPrefill: (transcript, options = {}) => client.post('/api/v1/smartflow/ai/workflow-prefill', {
    transcript,
    workflow_intent: options.workflow_intent,
    current_values: options.current_values || {},
  }),
  aiChat: (content, options = {}) => client.post('/api/v1/smartflow/ai/chat', {
    content,
    response_mode: options.response_mode || 'text',
    voice_id: options.voice_id,
  }),
  getAIVoices: () => client.get('/api/v1/smartflow/ai/voices'),
  getAIHistory: () => client.get('/api/v1/smartflow/ai/history'),
  replayAIResponse: (id) => client.post(`/api/v1/smartflow/ai/history/${id}/replay`),
  voiceChat: (audioBlob) => {
    const formData = new FormData();
    formData.append('audio_file', audioBlob);
    return client.post('/api/v1/smartflow/ai/voice-chat-upload', formData);
  },


  // Bulk Messaging
  validateBulkRecipients: (data) => client.post('/api/v1/smartflow/bulk-messages/recipients/validate', data),
  getBulkMessages: (params) => client.get('/api/v1/smartflow/bulk-messages', { params }),
  createBulkMessage: (data) => client.post('/api/v1/smartflow/bulk-messages', data),
  sendBulkMessage: (id) => client.post(`/api/v1/smartflow/bulk-messages/${id}/send`),
  cancelBulkMessage: (id) => client.post(`/api/v1/smartflow/bulk-messages/${id}/cancel`),

  // Documents & Leases
  getDocuments: () => client.get('/api/v1/smartflow/documents'),
  createDocument: (data) => client.post('/api/v1/smartflow/documents', data),
  deleteDocument: (id) => client.delete(`/api/v1/smartflow/documents/${id}`),
  getLeases: () => client.get('/api/v1/smartflow/leases'),
  createLease: (data) => client.post('/api/v1/smartflow/leases', data),
  generateLease: (data) => client.post('/api/v1/smartflow/leases/generate', data),
  enhanceLeaseTerms: (data) => client.post('/api/v1/smartflow/leases/enhance-terms', data),
  reviewLease: (data) => client.post('/api/v1/smartflow/leases/review', data),
  getAgreements: () => client.get('/api/v1/smartflow/agreements'),
  createAgreement: (data) => client.post('/api/v1/smartflow/agreements', data),
  generateAgreement: (data) => client.post('/api/v1/smartflow/agreements/generate', data),
  reviewAgreement: (data) => client.post('/api/v1/smartflow/agreements/review', data),

  // Calendar
  getCalendarEvents: (params) => client.get('/api/v1/smartflow/calendar/events', { params }),
  createCalendarEvent: (data) => client.post('/api/v1/smartflow/calendar/events', data),
  updateCalendarEvent: (id, data) => client.patch(`/api/v1/smartflow/calendar/events/${id}`, data),
  deleteCalendarEvent: (id) => client.delete(`/api/v1/smartflow/calendar/events/${id}`),
  
  // Calls
  getCalls: (params) => client.get('/api/v1/smartflow/calls', { params }),
  createCall: (data) => client.post('/api/v1/smartflow/calls', data),
  createOutboundCall: (data) => client.post('/api/v1/smartflow/calls/outbound', data),
  getCallRecording: (id) => client.get(`/api/v1/smartflow/calls/${id}/recording`, { responseType: 'blob' }),

  // Integrations
  getIntegrations: () => client.get('/api/v1/smartflow/integrations'),
  getIntegrationCatalog: () => client.get('/api/v1/smartflow/integrations/catalog'),
  syncIntegration: (platform) => client.post(`/api/v1/smartflow/integrations/${platform}/sync`),
  disconnectIntegration: (platform) => client.delete(`/api/v1/smartflow/integrations/${platform}`),
  startIntegrationOAuth: (platform) => client.get(`/api/v1/smartflow/integrations/${platform}/oauth/start`),


  // Notifications
  getNotifications: (params) => client.get('/api/v1/smartflow/notifications', { params }),
  markAllNotificationsRead: () => client.post('/api/v1/smartflow/notifications/mark-all-read'),
  markNotificationRead: (id) => client.patch(`/api/v1/smartflow/notifications/${id}/read`),
  deleteNotification: (id) => client.delete(`/api/v1/smartflow/notifications/${id}`),

  // Invoices
  getInvoices: (params) => client.get('/api/v1/invoices', { params }),
  getInvoice: (id) => client.get(`/api/v1/invoices/${id}`),
  createInvoice: (data) => client.post('/api/v1/invoices', data),
  updateInvoice: (id, data) => client.patch(`/api/v1/invoices/${id}`, data),
  deleteInvoice: (id) => client.delete(`/api/v1/invoices/${id}`),
  sendInvoice: (id, data) => client.post(`/api/v1/invoices/${id}/send`, data),
  shareInvoice: (id, data) => client.post(`/api/v1/invoices/${id}/share`, data),
  sendInvoiceReminder: (id, data) => client.post(`/api/v1/invoices/${id}/remind`, data),
  updateInvoiceStatus: (id, data) => client.post(`/api/v1/invoices/${id}/status`, data),
  getInvoiceTimeline: (id) => client.get(`/api/v1/invoices/${id}/timeline`),
  downloadInvoice: (id) => client.get(`/api/v1/invoices/${id}/pdf`, { responseType: 'blob' }),

  // Settings
  getSettings: () => client.get('/api/v1/smartflow/settings'),
  updateSettings: (data) => client.patch('/api/v1/smartflow/settings', data),
  getNotificationSettings: () => client.get('/api/v1/smartflow/settings/notifications'),
  updateNotificationSettings: (data) => client.patch('/api/v1/smartflow/settings/notifications', data),
  getBusinessProfile: () => client.get('/api/v1/smartflow/business-profile'),
  updateBusinessProfile: (data) => client.patch('/api/v1/smartflow/business-profile', data),
  getSubscriptionPlans: () => client.get('/api/v1/smartflow/subscription/plans'),
  getCurrentSubscription: () => client.get('/api/v1/smartflow/subscription/current'),
  createSupportTicket: (data) => client.post('/api/v1/smartflow/support/tickets', data),
  getSupportSession: () => client.get('/api/v1/smartflow/support/session'),
  getSupportMessages: (params) => client.get('/api/v1/smartflow/support/messages', { params }),
  sendSupportMessage: (data) => client.post('/api/v1/smartflow/support/messages', data),

  // Shop
  listShopProducts: (params) => client.get('/api/v1/shop/products', { params }),
  getShopProduct: (id) => client.get(`/api/v1/shop/products/${id}`),

  // Activities & Events
  listActivities: (params) => client.get('/api/v1/activities', { params }),
  createActivity: (data) => client.post('/api/v1/activities', data),
  joinActivity: (id) => client.post(`/api/v1/activities/${id}/join`),
  listEvents: (params) => client.get('/api/v1/events', { params }),
  createEvent: (data) => client.post('/api/v1/events', data),
  joinEvent: (id) => client.post(`/api/v1/events/${id}/join`),

  // Voice History (alias for AI history in settings)
  getVoiceHistory: () => client.get('/api/v1/smartflow/ai/history'),
  replayVoiceHistory: (id) => client.post(`/api/v1/smartflow/ai/history/${id}/replay`),

  // Earnings & Withdrawals
  getUserEarnings: () => client.get('/api/v1/smartflow/earnings'),
  requestWithdrawal: (data) => client.post('/api/v1/smartflow/earnings/withdraw', data),

  // ── Settings extras ──────────────────────────────────────────────────────────
  changePassword: (data) => client.post('/api/v1/smartflow/settings/change-password', data),
  revokeSessions: () => client.post('/api/v1/smartflow/settings/revoke-sessions'),
  uploadAvatar: (formData) => client.post('/api/v1/smartflow/settings/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteAccount: () => client.delete('/api/v1/smartflow/account'),
  uploadBusinessLogo: (formData) => client.post('/api/v1/smartflow/business-profile/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  // ── Calls extras ─────────────────────────────────────────────────────────────
  getCallSummary: () => client.get('/api/v1/smartflow/calls/summary'),
  getCallTranscript: (id) => client.get(`/api/v1/smartflow/calls/${id}/transcript`),
  getCallAISummary: (id) => client.get(`/api/v1/smartflow/calls/${id}/ai-summary`),
  getCallRecordingUrl: (id) => client.get(`/api/v1/smartflow/calls/${id}/recording`),
  updateCall: (id, data) => client.patch(`/api/v1/smartflow/calls/${id}`, data),

  // ── Leases extras ─────────────────────────────────────────────────────────────
  getLease: (id) => client.get(`/api/v1/smartflow/leases/${id}`),
  deleteLease: (id) => client.delete(`/api/v1/smartflow/leases/${id}`),
  patchLease: (id, data) => client.patch(`/api/v1/smartflow/leases/${id}`, data),
  leaseReview: (id, data) => client.post(`/api/v1/smartflow/leases/${id}/review`, data),
  leaseEnhanceTerms: (id, data) => client.post(`/api/v1/smartflow/leases/${id}/enhance-terms`, data),
  leaseSendSignature: (id, data) => client.post(`/api/v1/smartflow/leases/${id}/send-signature`, data),
  leaseSign: (id, data) => client.post(`/api/v1/smartflow/leases/${id}/sign`, data),
  leaseRenew: (id, data) => client.post(`/api/v1/smartflow/leases/${id}/renew`, data),
  downloadLeasePdf: (id) => client.get(`/api/v1/smartflow/leases/${id}/pdf`, { responseType: 'blob' }),
  getLeaseMetadata: () => client.get('/api/v1/smartflow/leases/metadata'),

  // ── Agreements extras ─────────────────────────────────────────────────────────
  getAgreement: (id) => client.get(`/api/v1/smartflow/agreements/${id}`),
  deleteAgreement: (id) => client.delete(`/api/v1/smartflow/agreements/${id}`),
  patchAgreement: (id, data) => client.patch(`/api/v1/smartflow/agreements/${id}`, data),
  agreementImprove: (id, data) => client.post(`/api/v1/smartflow/agreements/${id}/improve`, data),
  agreementReview: (id, data) => client.post(`/api/v1/smartflow/agreements/${id}/review`, data),
  agreementSendSignature: (id, data) => client.post(`/api/v1/smartflow/agreements/${id}/send-signature`, data),
  agreementSign: (id, data) => client.post(`/api/v1/smartflow/agreements/${id}/sign`, data),
  agreementRenew: (id, data) => client.post(`/api/v1/smartflow/agreements/${id}/renew`, data),
  downloadAgreementPdf: (id) => client.get(`/api/v1/smartflow/agreements/${id}/pdf`, { responseType: 'blob' }),
  improveAgreementDraft: (data) => client.post('/api/v1/smartflow/agreements/improve', data),

  // ── Messages extras ───────────────────────────────────────────────────────────
  replyToMessage: (id, data) => client.post(`/api/v1/smartflow/messages/${id}/reply`, data),
  forwardMessage: (id, data) => client.post(`/api/v1/smartflow/messages/${id}/forward`, data),
  getUnreadSummary: () => client.get('/api/v1/smartflow/messages/unread-summary'),
  editMessage: (id, data) => client.patch(`/api/v1/smartflow/messages/${id}`, data),

  // ── Integrations extras ───────────────────────────────────────────────────────
  connectWhatsAppManual: (data) => client.post('/api/v1/smartflow/integrations/whatsapp/manual-connect', data),
  connectTelegramManual: (data) => client.post('/api/v1/smartflow/integrations/telegram/manual-connect', data),
  getIntegrationStatus: () => client.get('/api/v1/smartflow/integrations/status'),
  getIntegrationCatalog: () => client.get('/api/v1/smartflow/integrations/catalog'),
  startIntegrationOAuth: (platform) => client.get(`/api/v1/smartflow/integrations/${platform}/oauth/start`),
  createSocialPost: (data) => client.post('/api/v1/smartflow/social-posts', data),
  listSocialPosts: (params) => client.get('/api/v1/smartflow/social-posts', { params }),
  getSocialPost: (id) => client.get(`/api/v1/smartflow/social-posts/${id}`),
  disconnectIntegration: (platform) => client.delete(`/api/v1/smartflow/integrations/${platform}`),

  // ── Calendar extras ───────────────────────────────────────────────────────────
  shareCalendarEvent: (id, data) => client.post(`/api/v1/smartflow/calendar/events/${id}/share`, data),
  getCalendarEvent: (id) => client.get(`/api/v1/smartflow/calendar/events/${id}`),

  // ── Bulk messaging extras ─────────────────────────────────────────────────────
  getBulkMessage: (id) => client.get(`/api/v1/smartflow/bulk-messages/${id}`),
  updateBulkMessage: (id, data) => client.patch(`/api/v1/smartflow/bulk-messages/${id}`, data),
  listBulkMessages: (params) => client.get('/api/v1/smartflow/bulk-messages', { params }),
  createBulkMessage: (data) => client.post('/api/v1/smartflow/bulk-messages', data),
  sendBulkMessage: (id) => client.post(`/api/v1/smartflow/bulk-messages/${id}/send`),
  cancelBulkMessage: (id) => client.post(`/api/v1/smartflow/bulk-messages/${id}/cancel`),
  validateBulkRecipients: (data) => client.post('/api/v1/smartflow/bulk-messages/recipients/validate', data),

  // ── Conversations & Messages ──────────────────────────────────────────────────
  getConversations: (params) => client.get('/api/v1/smartflow/conversations', { params }),
  getConversation: (id) => client.get(`/api/v1/smartflow/conversations/${id}`),
  createConversation: (data) => client.post('/api/v1/smartflow/conversations', data),
  archiveConversation: (id) => client.patch(`/api/v1/smartflow/conversations/${id}/archive`, { archived: true }),
  markConversationRead: (id) => client.post(`/api/v1/smartflow/conversations/${id}/mark-read`),
  getMessages: (id, params) => client.get(`/api/v1/smartflow/conversations/${id}/messages`, { params }),
  sendMessage: (data) => client.post('/api/v1/smartflow/messages', data),

  // ── AI & Voice ────────────────────────────────────────────────────────────────
  aiChat: (text, context) => {
    if (context?.workflow_intent) {
      return client.post('/api/v1/smartflow/ai/workflow-prefill', {
        intent: context.workflow_intent,
        context: context.current_values,
        user_prompt: text
      });
    }
    return client.post('/api/v1/smartflow/ai/chat', { content: text, ...context });
  },
  voiceChat: (blob) => {
    const fd = new FormData();
    fd.append('audio_file', blob, 'voice.webm');
    fd.append('response_mode', 'text');
    return client.post('/api/v1/smartflow/ai/voice-chat-upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },

  // ── Reports ───────────────────────────────────────────────────────────────────
  getReportCategories: () => client.get('/api/v1/smartflow/reports/categories'),
  createReport: (data) => client.post('/api/v1/smartflow/reports', data),

  // ── Groups extras ─────────────────────────────────────────────────────────────
  getGroup: (id) => client.get(`/api/v1/smartflow/groups/${id}`),
  deleteGroup: (id) => client.delete(`/api/v1/smartflow/groups/${id}`),
  updateGroup: (id, data) => client.patch(`/api/v1/smartflow/groups/${id}`, data),
  updateGroupMember: (gid, mid, data) => client.patch(`/api/v1/smartflow/groups/${gid}/members/${mid}`, data),
  removeGroupMember: (gid, mid) => client.delete(`/api/v1/smartflow/groups/${gid}/members/${mid}`),
  leaveGroup: (id) => client.post(`/api/v1/smartflow/groups/${id}/leave`),
  createGroupInvite: (id, data) => client.post(`/api/v1/smartflow/groups/${id}/invites`, data),
  deleteGroupInvite: (gid, iid) => client.delete(`/api/v1/smartflow/groups/${gid}/invites/${iid}`),

  // ── AI extras ─────────────────────────────────────────────────────────────────
  generateAIImage: (data) => client.post('/api/v1/smartflow/ai/generate-image', data),
  voiceChatText: (data) => client.post('/api/v1/smartflow/ai/voice-chat', data),
  transcribeVoice: (formData) => client.post('/api/v1/smartflow/voice/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  // ── Notifications extras ──────────────────────────────────────────────────────
  dispatchPendingNotifications: () => client.post('/api/v1/smartflow/notifications/dispatch-pending'),
};

export const adminApi = {
  getSummary: () => client.get('/api/v1/dashboard/admin/summary'),
  getUsers: (params) => client.get('/api/v1/dashboard/admin/users', { params }),
  getUserDetails: (id) => client.get(`/api/v1/dashboard/admin/users/${id}`),
  updateUserStatus: (id, status) => client.patch(`/api/v1/dashboard/admin/users/${id}/status`, null, { params: { status } }),
  getUsersGrowth: () => client.get('/api/v1/dashboard/admin/users-growth'),
  getEarnings: () => client.get('/api/v1/dashboard/admin/earnings'),
  getTransactions: (params) => client.get('/api/v1/dashboard/admin/earnings/transactions', { params }),
  getAIStats: () => client.get('/api/v1/dashboard/admin/ai/stats'),
  getAILogs: (limit = 50) => client.get('/api/v1/dashboard/admin/ai/logs', { params: { limit } }),
  getReports: (params) => client.get('/api/v1/dashboard/admin/reports', { params }),
  getAdmins: () => client.get('/api/v1/dashboard/admin/admins'),
  getSubscriptions: () => client.get('/api/v1/dashboard/admin/subscriptions'),
  getChats: () => client.get('/api/v1/dashboard/admin/chats'),
};




