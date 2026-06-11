import { apiRequest } from "./httpClient";

const getThreadIdOrThrow = (threadId) => {
  const value = String(threadId || "").trim();
  if (!value) {
    throw new Error("Missing thread id.");
  }
  return encodeURIComponent(value);
};

export const listThreads = async () => {
  const res = await apiRequest("/admin/chats"); // HttpClient maps this to /dashboard/admin/chats
  const payload = res?.data ?? res ?? [];
  const conversations = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.rows)
        ? payload.rows
        : Array.isArray(payload?.threads)
          ? payload.threads
          : [];
  return {
    data: conversations.map((c) => ({
      _id: c.id,
      unreadCount: c.unread_count || 0,
      updatedAt: c.timestamp || null,
      lastMessage: { text: c.last_message || "", type: "text" },
      directPeer: {
        id: c.id,
        fullName: c.user_name || "Unknown User",
        avatar: c.avatar_url || null,
        role: "user",
      },
    })),
  };
};

export const ensureAdminThread = () => Promise.resolve({ success: true });

export const listThreadMessages = async ({ threadId }) => {
  const res = await apiRequest(`/admin/chats/${getThreadIdOrThrow(threadId)}/messages`);
  const payload = res?.data ?? res ?? [];
  const messages = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.rows)
        ? payload.rows
        : Array.isArray(payload?.messages)
          ? payload.messages
          : [];
  return {
    data: messages.map((m) => ({
      _id: m.id,
      senderUserId: m.sender_id,
      text: m.message || "",
      imageUrl: m.image_url || null,
      createdAt: m.timestamp || null,
      type: m.image_url ? "image" : "text",
    })),
  };
};

export const sendThreadMessage = async ({ threadId, body }) => {
  return apiRequest(`/admin/chats/${getThreadIdOrThrow(threadId)}/messages`, {
    method: "POST",
    query: {
      text: body.text || "",
      image_url: body.imageUrl || "",
    },
  });
};

export const markThreadSeen = ({ threadId }) => Promise.resolve({ success: true });

// Backward compatible names in case any old imports still exist.
export const listConversations = listThreads;
export const listMessages = ({ threadId }) => listThreadMessages({ threadId });
export const sendMessage = ({ threadId, body }) =>
  sendThreadMessage({ threadId, body });
