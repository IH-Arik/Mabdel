import { useEffect, useRef } from 'react';
import { buildWebSocketUrl } from '../../api/client';

// A WebSocket that comes back after a drop (deploys, sleeping laptops, flaky Wi-Fi),
// with backoff. The access token is read at each connect, so a refreshed token is used.
export default function useReconnectingSocket(path, onEvent) {
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  });

  useEffect(() => {
    if (!path) return undefined;
    let socket = null;
    let retryTimer = null;
    let attempt = 0;
    let closedByUs = false;

    const connect = () => {
      const token = window.localStorage.getItem('access_token');
      if (!token) return;
      socket = new WebSocket(buildWebSocketUrl(path, token));
      socket.onopen = () => {
        attempt = 0;
      };
      socket.onmessage = (event) => {
        try {
          onEventRef.current(JSON.parse(event.data));
        } catch {
          // A malformed frame must not break the page.
        }
      };
      socket.onclose = () => {
        if (closedByUs) return;
        attempt += 1;
        retryTimer = window.setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)));
      };
    };

    connect();
    return () => {
      closedByUs = true;
      window.clearTimeout(retryTimer);
      socket?.close();
    };
  }, [path]);
}
