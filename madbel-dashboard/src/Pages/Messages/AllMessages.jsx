import { Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  listThreads,
  listThreadMessages,
  markThreadSeen,
  sendThreadMessage,
} from "../../services/chatApi";
import { getAdminSession } from "../../utils/auth";

const FALLBACK_AVATAR = "https://i.pravatar.cc/100";
const POLL_INTERVAL_MS = 4000;

const parseJwtPayload = (token) => {
  try {
    const payloadPart = token?.split(".")?.[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized));
  } catch {
    return null;
  }
};

const pickData = (payload) => payload?.data ?? payload;

const asArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

const getUserName = (user) =>
  user?.fullName || user?.name || user?.email || "Unknown user";

const getUserTitle = (user) => {
  const role = user?.role ? String(user.role).toLowerCase() : "";
  if (!role) return "";
  return role.replaceAll("_", " ");
};

const getUserAvatar = (user) =>
  user?.profileImage || user?.profilePhoto || user?.avatar || FALLBACK_AVATAR;

const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const normalizeThread = (thread) => ({
  id: thread?._id || "",
  raw: thread,
  peer: thread?.directPeer || null,
  unreadCount: Number(thread?.unreadCount || 0),
  updatedAt: thread?.updatedAt || thread?.createdAt || null,
  lastMessage: thread?.lastMessage || null,
});

const normalizeMessage = (message, currentUserId) => {
  const senderId = String(message?.senderUserId || "");
  return {
    id: message?._id || `${senderId}-${message?.createdAt || Date.now()}`,
    senderId,
    type: message?.type || "text",
    text: message?.text || "",
    imageUrl: message?.imageUrl || "",
    createdAt: message?.createdAt || null,
    updatedAt: message?.updatedAt || null,
    isSentByMe: Boolean(currentUserId) && senderId === currentUserId,
  };
};

const AllMessages = () => {
  const session = getAdminSession();
  const currentUserId = useMemo(
    () => String(parseJwtPayload(session?.accessToken)?.userId || ""),
    [session?.accessToken]
  );

  const [threads, setThreads] = useState([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [threadMessages, setThreadMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const messagesViewportRef = useRef(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  const loadThreads = useCallback(async () => {
    const payload = await listThreads();
    const data = pickData(payload);
    const mapped = asArray(data)
      .map(normalizeThread)
      .filter((thread) => Boolean(thread.id));

    setThreads(mapped);
    setSelectedThreadId((previousSelectedId) => {
      if (mapped.length === 0) return "";
      if (previousSelectedId && mapped.some((t) => t.id === previousSelectedId)) {
        return previousSelectedId;
      }
      return mapped[0].id;
    });
  }, []);

  const loadMessages = useCallback(
    async (threadId) => {
      if (!threadId) {
        setThreadMessages([]);
        return;
      }

      setLoadingMessages(true);
      try {
        const payload = await listThreadMessages({ threadId });
        const data = pickData(payload);
        const mapped = asArray(data?.messages ?? data).map((message) =>
          normalizeMessage(message, currentUserId)
        );

        setThreadMessages(mapped);
        await markThreadSeen({ threadId });
      } finally {
        setLoadingMessages(false);
      }
    },
    [currentUserId]
  );

  const refreshSelectedMessages = useCallback(async () => {
    if (!selectedThreadId) return;

    const payload = await listThreadMessages({ threadId: selectedThreadId });
    const data = pickData(payload);
    const mapped = asArray(data?.messages ?? data).map((message) =>
      normalizeMessage(message, currentUserId)
    );
    setThreadMessages(mapped);
  }, [currentUserId, selectedThreadId]);

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      setLoadingThreads(true);
      setError("");
      try {
        await loadThreads();
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || "Failed to load inbox.");
      } finally {
        if (mounted) setLoadingThreads(false);
      }
    };

    initialize();
    return () => {
      mounted = false;
    };
  }, [loadThreads]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!selectedThreadId) {
        setThreadMessages([]);
        return;
      }

      try {
        await loadMessages(selectedThreadId);
        if (!active) return;
        setThreads((previous) =>
          previous.map((thread) =>
            thread.id === selectedThreadId ? { ...thread, unreadCount: 0 } : thread
          )
        );
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || "Failed to load messages.");
      }
    };

    run();

    return () => {
      active = false;
    };
  }, [loadMessages, selectedThreadId]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await loadThreads();
        await refreshSelectedMessages();
      } catch {
        // Silent polling failure to avoid noisy UI.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [loadThreads, refreshSelectedMessages]);

  useEffect(() => {
    if (!messagesViewportRef.current) return;
    messagesViewportRef.current.scrollTop = messagesViewportRef.current.scrollHeight;
  }, [threadMessages]);

  const handleSendMessage = async () => {
    if (!selectedThreadId || !newMessage.trim() || sending) return;

    setSending(true);
    setError("");
    try {
      await sendThreadMessage({
        threadId: selectedThreadId,
        body: {
          type: "text",
          text: newMessage.trim(),
        },
      });

      setNewMessage("");
      await Promise.all([refreshSelectedMessages(), loadThreads()]);
    } catch (sendError) {
      setError(sendError?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen mx-auto">
      <div
        style={{ boxShadow: "0px 1px 6px 0px rgba(0, 0, 0, 0.24)" }}
        className="w-full mx-auto mt-20 rounded-md flex h-[900px]"
      >
        <div className="w-1/3 border-r">
          <div className="p-4 text-lg font-semibold text-white bg-[#17b4c9] rounded-t-md">Inbox</div>

          {loadingThreads ? (
            <div className="p-4 text-sm text-center text-gray-500">Loading conversations...</div>
          ) : threads.length === 0 ? (
            <div className="p-4 text-sm text-center text-gray-500">
              No conversations found.
            </div>
          ) : (
            <div>
              {threads.map((thread) => {
                const peer = thread.peer;
                const lastText =
                  thread.lastMessage?.type === "image"
                    ? "Image"
                    : thread.lastMessage?.text || "No messages yet";

                return (
                  <div
                    key={thread.id}
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={`flex items-center gap-2 p-4 border-b cursor-pointer hover:bg-gray-100 ${
                      selectedThreadId === thread.id ? "bg-blue-50 border-l-4 border-l-sky-500" : ""
                    }`}
                  >
                    <img
                      src={getUserAvatar(peer)}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{getUserName(peer)}</div>
                      <div className="text-sm text-gray-500 capitalize truncate">{getUserTitle(peer)}</div>
                      <div className="text-xs text-gray-400 truncate">{lastText}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-gray-400">{formatTime(thread.updatedAt)}</span>
                      {thread.unreadCount > 0 ? (
                        <div className="flex justify-end mt-1">
                          <span className="min-w-5 h-5 px-1 rounded-full bg-sky-500 text-white text-xs flex items-center justify-center">
                            {thread.unreadCount}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between w-2/3">
          {selectedThread ? (
            <>
              <div className="flex items-center gap-2 p-4 border-b bg-gray-50">
                <img
                  src={getUserAvatar(selectedThread.peer)}
                  alt="Avatar"
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{getUserName(selectedThread.peer)}</div>
                  <div className="text-sm text-gray-500 capitalize truncate">
                    {getUserTitle(selectedThread.peer)}
                  </div>
                </div>
              </div>

              <div ref={messagesViewportRef} className="flex-1 p-4 space-y-4 overflow-y-auto bg-gray-50">
                {loadingMessages ? (
                  <div className="text-sm text-center text-gray-500">Loading messages...</div>
                ) : threadMessages.length === 0 ? (
                  <div className="text-sm text-center text-gray-500">No messages yet.</div>
                ) : (
                  threadMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isSentByMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-xs p-3 rounded-lg text-sm ${
                          message.isSentByMe
                            ? "bg-sky-500 text-white rounded-br-none"
                            : "bg-white text-gray-800 rounded-bl-none shadow-sm"
                        }`}
                      >
                        {message.type === "image" && message.imageUrl ? (
                          <img
                            src={message.imageUrl}
                            alt="Shared"
                            className="w-44 h-auto rounded mb-2"
                          />
                        ) : null}
                        {message.text ? <p>{message.text}</p> : null}
                        <div
                          className={`mt-1 text-xs text-right ${
                            message.isSentByMe ? "text-sky-100" : "text-gray-400"
                          }`}
                        >
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="relative flex items-center gap-3 p-4 bg-white border-t">
                <textarea
                  rows={1}
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 w-full p-3 text-sm border rounded-full resize-none focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                />

                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-3 text-sm text-blue-600 transition-colors border border-gray-300 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send size={18} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 p-4 text-sm text-center text-gray-500 bg-gray-50">
              <div>Select a conversation to start chatting</div>
            </div>
          )}
        </div>
      </div>

      {error ? (
        <div className="mt-4 text-sm text-red-600">
          {error}
        </div>
      ) : null}
    </div>
  );
};

export default AllMessages;
