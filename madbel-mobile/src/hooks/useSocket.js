import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  joinConversation,
  onConnectionStateChange,
  onNewMessage,
  sendMessage as socketSendMessage,
  getConnectionState,
  reconnectSocket,
} from "../utils/socket";

const readThreadId = (payload) =>
  payload?.threadId ||
  payload?.convId ||
  payload?.conversationId ||
  payload?.conversation_id ||
  payload?.message?.threadId ||
  payload?.message?.convId ||
  payload?.message?.conversation_id ||
  payload?.message?.conversationId ||
  null;

export const useSocket = ({ threadId, enabled = true, onMessage }) => {
  const [connectionState, setConnectionState] = useState(getConnectionState());
  const onMessageRef = useRef(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const handleIncomingMessage = useCallback(
    (payload) => {
      if (!payload || !threadId) return;
      const incomingThreadId = readThreadId(payload);
      if (incomingThreadId && String(incomingThreadId) !== String(threadId)) return;

      const normalized = payload?.message ? payload.message : payload;
      onMessageRef.current?.(normalized);
    },
    [threadId],
  );

  useEffect(() => {
    if (!enabled) return undefined;

    let isMounted = true;
    let unsubscribeConnection;
    let unsubscribeNewMessage;

    const connect = async () => {
      try {
        if (!isMounted) return;
        if (threadId) {
          await joinConversation(String(threadId));
        }
      } catch (error) {
        if (!isMounted) return;
        console.log("Socket init/join failed:", error?.message || error);
      }
    };

    connect();
    unsubscribeConnection = onConnectionStateChange((state) => {
      if (isMounted) setConnectionState(state);
    });
    unsubscribeNewMessage = onNewMessage(handleIncomingMessage);

    return () => {
      isMounted = false;
      unsubscribeConnection?.();
      unsubscribeNewMessage?.();
    };
  }, [enabled, handleIncomingMessage, threadId]);

  useEffect(() => {
    if (!enabled || !threadId || !connectionState?.isConnected) return;
    joinConversation(String(threadId)).catch((error) => {
      console.log("Socket re-join failed:", error?.message || error);
    });
  }, [connectionState?.isConnected, enabled, threadId]);

  const sendViaSocket = useCallback(
    (payload) => socketSendMessage(payload),
    [],
  );

  return useMemo(
    () => ({
      connectionState,
      isConnected: !!connectionState?.isConnected,
      sendViaSocket,
      reconnect: reconnectSocket,
    }),
    [connectionState, sendViaSocket],
  );
};

export default useSocket;
