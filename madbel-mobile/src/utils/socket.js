import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../redux/apiUtils";

let socketInstance = null;
let activeConversationId = null;
let connectionPromise = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 2000;
const MAX_RECONNECT_DELAY = 30000;

const eventListeners = new Map();
const connectionCallbacks = new Set();

let connectionState = {
  isConnected: false,
  isConnecting: false,
  lastError: null,
  lastUpdate: null,
};

const getStoredToken = async () => {
  const keys = ["accessToken", "token", "authToken"];
  for (const key of keys) {
    const value = await AsyncStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

const resolveSocketOrigin = () => {
  const rawUrl =
    process.env.EXPO_PUBLIC_SOCKET_BASE_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    API_BASE_URL;

  try {
    const parsed = new URL(rawUrl);
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return String(rawUrl)
      .replace(/^https:\/\//, "wss://")
      .replace(/^http:\/\//, "ws://")
      .replace(/\/api.*$/, "")
      .replace(/\/$/, "");
  }
};

const buildConversationUrl = (conversationId, token) => {
  const origin = resolveSocketOrigin();
  const encodedConversationId = encodeURIComponent(String(conversationId));
  const encodedToken = encodeURIComponent(token);
  return `${origin}/api/v1/smartflow/ws/conversations/${encodedConversationId}?token=${encodedToken}`;
};

const updateConnectionState = (updates) => {
  connectionState = {
    ...connectionState,
    ...updates,
    lastUpdate: new Date().toISOString(),
  };
  notifyConnectionStateChange();
};

const notifyConnectionStateChange = () => {
  const state = { ...connectionState };
  connectionCallbacks.forEach((callback) => {
    try {
      callback(state);
    } catch (error) {
    }
  });
};

const emitLocalEvent = (event, payload) => {
  const callbacks = eventListeners.get(event);
  if (!callbacks) return;

  callbacks.forEach((callback) => {
    try {
      callback(payload);
    } catch (error) {
    }
  });
};

const normalizeEnvelopePayload = (envelope) => {
  const data = envelope?.data ?? envelope;
  if (!data || typeof data !== "object") return data;

  return {
    ...data,
    conversation_id:
      data.conversation_id ||
      data.conversationId ||
      envelope?.conversation_id ||
      envelope?.conversationId ||
      envelope?.conversation_id ||
      envelope?.channel ||
      activeConversationId,
    channel: envelope?.channel || data.channel || activeConversationId,
    event: envelope?.event || data.event,
  };
};

const dispatchSocketMessage = (rawMessage) => {
  let envelope;
  try {
    envelope = JSON.parse(rawMessage);
  } catch {
    envelope = { event: "message", data: rawMessage };
  }

  const event = envelope?.event || "message";
  const payload = normalizeEnvelopePayload(envelope);

  emitLocalEvent(event, payload);

  if (event === "message.created") {
    emitLocalEvent("chat:message:new", payload);
    emitLocalEvent("chat:thread:message:new", payload);
  }

  if (event === "message.updated") {
    emitLocalEvent("chat:message:updated", payload);
  }

  if (event === "typing.updated") {
    emitLocalEvent("chat:typing:updated", payload);
  }

  if (event === "presence.updated") {
    emitLocalEvent("chat:presence:updated", payload);
  }

  if (event === "connected") {
    emitLocalEvent("connect", payload);
  }
};

const cleanupSocket = () => {
  if (socketInstance) {
    socketInstance.onopen = null;
    socketInstance.onmessage = null;
    socketInstance.onerror = null;
    socketInstance.onclose = null;
    try {
      socketInstance.close();
    } catch {
      // Ignore close failures from already-closed sockets.
    }
  }
  socketInstance = null;
  connectionPromise = null;
};

const scheduleReconnect = () => {
  if (!activeConversationId || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    return;
  }

  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectAttempts += 1;
  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
    MAX_RECONNECT_DELAY,
  );
  reconnectTimer = setTimeout(() => {
    initSocket({ conversationId: activeConversationId }).catch(() => {});
  }, delay);
};

export const initSocket = async (options = {}) => {
  const conversationId = options.conversationId || activeConversationId;

  if (!conversationId) {
    updateConnectionState({
      isConnected: false,
      isConnecting: false,
      lastError: "Conversation ID is required",
    });
    throw new Error("Conversation ID is required before opening a chat socket");
  }

  if (
    socketInstance &&
    socketInstance.readyState === WebSocket.OPEN &&
    String(activeConversationId) === String(conversationId)
  ) {
    return socketInstance;
  }

  if (
    connectionPromise &&
    String(activeConversationId) === String(conversationId)
  ) {
    return connectionPromise;
  }

  activeConversationId = String(conversationId);
  cleanupSocket();

  connectionPromise = (async () => {
    updateConnectionState({
      isConnected: false,
      isConnecting: true,
      lastError: null,
    });

    const token = await getStoredToken();
    if (!token) {
      updateConnectionState({
        isConnected: false,
        isConnecting: false,
        lastError: "No authentication token found",
      });
      throw new Error("No authentication token found");
    }

    const socketUrl = buildConversationUrl(activeConversationId, token);

    return await new Promise((resolve, reject) => {
      const socket = new WebSocket(socketUrl);
      socketInstance = socket;

      const connectionTimeout = setTimeout(() => {
        updateConnectionState({
          isConnected: false,
          isConnecting: false,
          lastError: "Connection timeout",
        });
        cleanupSocket();
        reject(new Error("Socket connection timeout"));
      }, 15000);

      socket.onopen = () => {
        clearTimeout(connectionTimeout);
        reconnectAttempts = 0;
        updateConnectionState({
          isConnected: true,
          isConnecting: false,
          lastError: null,
        });
        emitLocalEvent("connect", { conversation_id: activeConversationId });
        resolve(socket);
      };

      socket.onmessage = (event) => {
        dispatchSocketMessage(event.data);
      };

      socket.onerror = (event) => {
        const message = event?.message || "Socket error";
        updateConnectionState({
          isConnected: false,
          isConnecting: false,
          lastError: message,
        });
        emitLocalEvent("error", event);
      };

      socket.onclose = (event) => {
        clearTimeout(connectionTimeout);
        const wasConnected = connectionState.isConnected;
        socketInstance = null;
        connectionPromise = null;
        updateConnectionState({
          isConnected: false,
          isConnecting: false,
          lastError: event?.reason || null,
        });
        emitLocalEvent("disconnect", event);
        if (wasConnected && event?.code !== 1000) {
          scheduleReconnect();
        }
      };
    });
  })();

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
};

export const getSocket = () => socketInstance;

export const isSocketConnected = () => {
  const connected = socketInstance?.readyState === WebSocket.OPEN;
  if (connected !== connectionState.isConnected) {
    updateConnectionState({ isConnected: connected });
  }
  return connected;
};

export const getConnectionState = () => ({ ...connectionState });

export const disconnectSocket = () => {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  reconnectAttempts = 0;
  activeConversationId = null;
  cleanupSocket();
  updateConnectionState({
    isConnected: false,
    isConnecting: false,
    lastError: null,
  });
};

export const reconnectSocket = async () => {
  if (!activeConversationId) {
    throw new Error("No active conversation to reconnect");
  }
  cleanupSocket();
  return initSocket({ conversationId: activeConversationId });
};

export const joinConversation = async (conversationId) => {
  if (!conversationId) {
    throw new Error("Conversation ID is required");
  }
  await initSocket({ conversationId });
  return true;
};

export const sendMessage = (messageData) => {
  if (!socketInstance || socketInstance.readyState !== WebSocket.OPEN) {
    throw new Error("Socket not connected");
  }

  socketInstance.send(JSON.stringify(messageData));
  return Promise.resolve({
    ...messageData,
    sentAt: new Date().toISOString(),
  });
};

export const onNewMessage = (callback) => {
  const offCreated = addEventListener("message.created", callback);
  return () => {
    offCreated?.();
  };
};

export const onSocketError = (callback) => addEventListener("error", callback);

export const onConnectionStateChange = (callback) => {
  if (typeof callback !== "function") return () => {};

  connectionCallbacks.add(callback);
  callback({ ...connectionState });

  return () => {
    connectionCallbacks.delete(callback);
  };
};

export const addEventListener = (event, callback) => {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event).add(callback);

  return () => {
    removeEventListener(event, callback);
  };
};

export const removeEventListener = (event, callback) => {
  const callbacks = eventListeners.get(event);
  if (!callbacks) return;

  callbacks.delete(callback);
  if (callbacks.size === 0) {
    eventListeners.delete(event);
  }
};

export const removeAllEventListeners = () => {
  eventListeners.clear();
};

export const pingServer = () => {
  if (!socketInstance || socketInstance.readyState !== WebSocket.OPEN) {
    return Promise.resolve(false);
  }

  socketInstance.send(JSON.stringify({ event: "ping" }));
  return Promise.resolve(true);
};

export const getSocketStats = () => ({
  connected: socketInstance?.readyState === WebSocket.OPEN,
  readyState: socketInstance?.readyState ?? null,
  reconnectAttempts,
  activeConversationId,
  lastError: connectionState.lastError,
  lastUpdate: connectionState.lastUpdate,
  state: { ...connectionState },
});

export default {
  initSocket,
  getSocket,
  isSocketConnected,
  getConnectionState,
  disconnectSocket,
  reconnectSocket,
  joinConversation,
  sendMessage,
  onNewMessage,
  onSocketError,
  onConnectionStateChange,
  addEventListener,
  removeEventListener,
  removeAllEventListeners,
  pingServer,
  getSocketStats,
};
