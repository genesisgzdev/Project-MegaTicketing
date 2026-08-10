import { useEffect, useRef, useCallback, useState } from 'react';

export interface WebSocketConfig {
  url: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
}

export interface WebSocketState {
  isConnected: boolean;
  isReconnecting: boolean;
  lastMessageTime: number | null;
  connectionAttempts: number;
}

export function useWebSocketReconnect(config: WebSocketConfig) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    isReconnecting: false,
    lastMessageTime: null,
    connectionAttempts: 0,
  });

  const reconnectDelay = config.reconnectDelay || 1000;
  const maxReconnectDelay = config.maxReconnectDelay || 30000;
  const maxAttempts = config.reconnectAttempts || 10;

  const calculateBackoffDelay = useCallback((attempt: number): number => {
    const exponentialDelay = reconnectDelay * Math.pow(2, attempt);
    return Math.min(exponentialDelay, maxReconnectDelay);
  }, [reconnectDelay, maxReconnectDelay]);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setState((prev) => ({
      ...prev,
      isReconnecting: true,
      connectionAttempts: prev.connectionAttempts + 1,
    }));

    try {
      ws.current = new WebSocket(config.url);

      ws.current.onopen = () => {
        console.log('[WebSocket] Connected');
        setState((prev) => ({
          ...prev,
          isConnected: true,
          isReconnecting: false,
        }));
        reconnectAttempts.current = 0;
      };

      ws.current.onmessage = (event) => {
        setState((prev) => ({
          ...prev,
          lastMessageTime: Date.now(),
        }));
      };

      ws.current.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      ws.current.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setState((prev) => ({
          ...prev,
          isConnected: false,
        }));

        if (reconnectAttempts.current < maxAttempts) {
          const delay = calculateBackoffDelay(reconnectAttempts.current);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);
          reconnectAttempts.current++;

          reconnectTimer.current = setTimeout(() => {
            connect();
          }, delay);
        } else {
          console.error('[WebSocket] Max reconnection attempts exceeded');
          setState((prev) => ({
            ...prev,
            isReconnecting: false,
          }));
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
      setState((prev) => ({
        ...prev,
        isReconnecting: false,
      }));
    }
  }, [config.url, calculateBackoffDelay, maxAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
    }
    if (ws.current) {
      ws.current.close();
    }
  }, []);

  const send = useCallback((data: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Not connected, message not sent');
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    send,
    disconnect,
  };
}
