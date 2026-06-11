import { baseApi } from "../../baseApi";

const unwrapData = (response) => response?.data ?? response;

const normalizeConversation = (conversation = {}) => ({
  ...conversation,
  _id: conversation._id || conversation.id,
  id: conversation.id || conversation._id,
  directPeer: {
    fullName:
      conversation.contact_name ||
      conversation.title ||
      conversation.directPeer?.fullName,
    name:
      conversation.contact_name ||
      conversation.title ||
      conversation.directPeer?.name,
    profileImage:
      conversation.avatar_url || conversation.directPeer?.profileImage,
    avatar: conversation.avatar_url || conversation.directPeer?.avatar,
    isOnline:
      conversation.presence === "online" ||
      conversation.directPeer?.isOnline ||
      false,
  },
  lastMessage: {
    text:
      conversation.last_message_preview ||
      conversation.lastMessage?.text ||
      "No messages yet",
    createdAt:
      conversation.updated_at ||
      conversation.updatedAt ||
      conversation.lastMessage?.createdAt,
  },
  unreadCount: conversation.unread_count ?? conversation.unreadCount ?? 0,
  channel: conversation.platform || conversation.channel,
});

const normalizeMessage = (message = {}) => ({
  ...message,
  _id: message._id || message.id,
  id: message.id || message._id,
  text: message.text || message.content || "",
  createdAt: message.createdAt || message.timestamp || message.created_at,
  updatedAt: message.updatedAt || message.updated_at,
  senderIsSelf: message.sender_is_self ?? message.senderIsSelf,
});

export const chatSlice = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    fetchConversations: builder.query({
      query: (params) => ({
        url: "/api/v1/smartflow/conversations",
        method: "GET",
        params,
      }),
      transformResponse: (response) => {
        const data = unwrapData(response);
        const items = Array.isArray(data) ? data : data?.items || [];
        return items.map(normalizeConversation);
      },
      providesTags: ["Conversations"],
    }),

    createChatMessages: builder.mutation({
      query: (payload = {}) => ({
        url: "/api/v1/smartflow/conversations",
        method: "POST",
        body: {
          title: payload.title || payload.name,
          contact_id: payload.contact_id || payload.contactId,
          member_ids: payload.member_ids || payload.memberIds || [],
          type: payload.type || "direct",
          platform: payload.platform || "ai",
        },
      }),
      transformResponse: (response) => normalizeConversation(unwrapData(response)),
      invalidatesTags: ["Conversations"],
    }),

    fetchMessages: builder.query({
      query: (threadIdOrArgs) => {
        const args =
          typeof threadIdOrArgs === "object"
            ? threadIdOrArgs
            : { conversation_id: threadIdOrArgs };
        const conversationId =
          args.conversation_id || args.conversationId || args.threadId;

        return {
          url: `/api/v1/smartflow/conversations/${conversationId}/messages`,
          method: "GET",
          params: args.params || {
            page: args.page,
            page_size: args.page_size || args.pageSize,
            search: args.search,
            platform: args.platform,
          },
        };
      },
      transformResponse: (response, meta, threadIdOrArgs) => {
        const data = unwrapData(response) || {};
        const rawMessages = Array.isArray(data) ? data : data?.items || [];
        const conversationId =
          typeof threadIdOrArgs === "object"
            ? threadIdOrArgs.conversation_id ||
              threadIdOrArgs.conversationId ||
              threadIdOrArgs.threadId
            : threadIdOrArgs;

        return {
          threadId: data?.threadId || data?.conversation_id || conversationId,
          messages: rawMessages.map(normalizeMessage),
          pagination: data?.pagination,
        };
      },
      providesTags: (result, error, threadId) => [{ type: "Messages", id: threadId }],
    }),

    sendMessage: builder.mutation({
      query: ({ threadId, conversation_id, conversationId, text, imageUrl, platform = "ai" }) => ({
        url: "/api/v1/smartflow/messages",
        method: "POST",
        body: {
          conversation_id: conversation_id || conversationId || threadId,
          platform,
          direction: "outbound",
          content: text,
          media_url: imageUrl,
        },
      }),
      transformResponse: (response) => normalizeMessage(unwrapData(response)),
      invalidatesTags: (result, error, { threadId, conversation_id, conversationId }) => [
        { type: "Messages", id: threadId || conversation_id || conversationId },
        "Conversations",
      ],
    }),

    createGroupMessages: builder.mutation({
      query: (payload = {}) => ({
        url: "/api/v1/smartflow/conversations",
        method: "POST",
        body: {
          ...payload,
          type: "group",
          platform: payload.platform || "ai",
        },
      }),
      transformResponse: (response) => normalizeConversation(unwrapData(response)),
      invalidatesTags: ["Conversations"],
    }),

    getChatThreads: builder.query({
      query: (params) => ({
        url: "/api/v1/smartflow/conversations",
        method: "GET",
        params,
      }),
      transformResponse: (response) => {
        const data = unwrapData(response);
        const items = Array.isArray(data) ? data : data?.items || [];
        return items.map(normalizeConversation);
      },
      providesTags: ["Conversations"],
    }),

    markThreadSeen: builder.mutation({
      query: (threadId) => ({
        url: `/api/v1/smartflow/conversations/${threadId}/mark-read`,
        method: "POST",
      }),
      transformResponse: (response) => unwrapData(response),
      invalidatesTags: (result, error, threadId) => [
        { type: "Messages", id: threadId },
        "Conversations",
      ],
    }),
  }),
  overrideExisting: true,
});

export const {
  useFetchConversationsQuery,
  useCreateChatMessagesMutation,
  useFetchMessagesQuery,
  useSendMessageMutation,
  useCreateGroupMessagesMutation,
  useGetChatThreadsQuery,
  useMarkThreadSeenMutation,
} = chatSlice;
