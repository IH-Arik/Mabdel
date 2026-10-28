import { Platform } from "react-native";

export const formatTime = (dateValue) => {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.round((ms || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

export const getMessageSortTime = (message) => {
  const candidates = [
    message?.raw?.createdAt,
    message?.raw?.created_at,
    message?.raw?.timestamp,
    message?.raw?.updatedAt,
    message?.raw?.updated_at,
  ];

  for (const value of candidates) {
    if (!value) continue;
    const time = new Date(value).getTime();
    if (!Number.isNaN(time)) return time;
  }

  return 0;
};

export const toUiMessage = (message, myUserId) => {
  const senderId = String(message?.senderUserId || "");
  const isSelf = Boolean(message?.sender_is_self || message?.senderIsSelf);
  return {
    id: message?._id || message?.id || `${Date.now()}-${Math.random()}`,
    text: message?.text || message?.content || "",
    time: formatTime(
      message?.createdAt ||
        message?.created_at ||
        message?.timestamp ||
        message?.updatedAt ||
        message?.updated_at,
    ),
    sender: isSelf || senderId === String(myUserId || "") ? "me" : "them",
    senderUserId: senderId,
    status: message?.status || message?.delivery_status || null,
    raw: message,
  };
};

export const upsertMessages = (prev, nextMessage) => {
  if (!nextMessage?.id) return prev;
  const exists = prev.some(
    (item) => String(item.id) === String(nextMessage.id),
  );
  if (exists) return prev;
  return [...prev, nextMessage];
};

export const ADMIN_SUPPORT_SUGGESTIONS = [
  "billing_issue",
  "technical_help",
  "account_problem",
];

export const DEFAULT_HEADER_HEIGHT = Platform.OS === "ios" ? 90 : 0;
