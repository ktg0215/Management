'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, invalidateQueries } from '@/lib/queryClient';
import { useAuthStore } from '@/stores/authStore';

interface WebSocketMessage {
  type: 'sales_update' | 'store_update' | 'system_message' | 'heartbeat';
  data?: any;
  timestamp?: string;
  storeId?: string;
  userId?: string;
}

interface UseWebSocketOptions {
  url?: string;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onConnectionChange?: (isConnected: boolean) => void;
  onError?: (error: Event) => void;
}

export const useWebSocket = ({
  url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  reconnectAttempts = 5,
  reconnectInterval = 5000,
  heartbeatInterval = 30000,
  onMessage,
  onConnectionChange,
  onError,
}: UseWebSocketOptions = {}) => {
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutId = useRef<NodeJS.Timeout | null>(null);
  const reconnectCount = useRef(0);
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  // Construct WebSocket URL (WebSocket is optional)
  const wsUrl = user ? `${url}/ws?userId=${user.id}` : null;

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      setLastMessage(message);

      // Handle different message types
      switch (message.type) {
        case 'sales_update':
          handleSalesUpdate(message);
          break;
        case 'store_update':
          handleStoreUpdate(message);
          break;
        case 'system_message':
          // System message received
          break;
        case 'heartbeat':
          // Respond to heartbeat
          sendMessage({ type: 'heartbeat', timestamp: new Date().toISOString() });
          break;
        default:
          // Unknown message type
          break;
      }

      // Call custom message handler
      onMessage?.(message);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [onMessage, queryClient]);

  // Handle sales data updates from WebSocket
  const handleSalesUpdate = useCallback((message: WebSocketMessage) => {
    if (message.storeId && message.data) {
      const { storeId, year, month, date, data } = message.data;
      
      // Invalidate relevant queries to trigger refetch
      invalidateQueries.sales.byStore(storeId);
      
      if (year && month) {
        invalidateQueries.sales.byMonth(storeId, year, month);
      }
    }
  }, [queryClient]);

  // Handle store updates from WebSocket
  const handleStoreUpdate = useCallback((message: WebSocketMessage) => {
    if (message.storeId) {
      // Invalidate store queries
      invalidateQueries.stores.byId(message.storeId);
      invalidateQueries.stores.all();
    }
  }, [queryClient]);

  // Send message through WebSocket
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Start heartbeat mechanism
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutId.current) {
      clearTimeout(heartbeatTimeoutId.current);
    }

    heartbeatTimeoutId.current = setTimeout(() => {
      if (sendMessage({ type: 'heartbeat', timestamp: new Date().toISOString() })) {
        startHeartbeat(); // Schedule next heartbeat
      }
    }, heartbeatInterval);
  }, [sendMessage, heartbeatInterval]);

  // Stop heartbeat mechanism
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutId.current) {
      clearTimeout(heartbeatTimeoutId.current);
      heartbeatTimeoutId.current = null;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Don't connect if no user is authenticated
    if (!wsUrl) {
      console.log('WebSocket connection skipped: No user authenticated');
      return;
    }

    if (ws.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setIsReconnecting(false);
        reconnectCount.current = 0;
        startHeartbeat();
        onConnectionChange?.(true);
      };

      ws.current.onmessage = handleMessage;

      ws.current.onclose = (event) => {
        setIsConnected(false);
        stopHeartbeat();
        onConnectionChange?.(false);

        // クリーンな切断でない場合のみ再接続を試みる
        // （初回接続失敗はcatchブロックで処理され、再接続しない）
        if (!event.wasClean && reconnectCount.current < reconnectAttempts) {
          attemptReconnect();
        }
      };

      ws.current.onerror = (error) => {
        // WebSocketサーバーが起動していない場合は警告レベルに（予期される動作）
        console.warn('WebSocket connection unavailable. Real-time updates disabled.');
        onError?.(error);
      };
    } catch (error) {
      // 初回接続失敗は警告レベル（WebSocketサーバーがオプショナル）
      console.warn('WebSocket server not available. Continuing without real-time updates.');
      // 初回接続失敗時は再接続を試みない
      setIsConnected(false);
      setIsReconnecting(false);
    }
  }, [wsUrl, handleMessage, startHeartbeat, stopHeartbeat, onConnectionChange, onError]);

  // Attempt to reconnect with exponential backoff
  const attemptReconnect = useCallback(() => {
    if (reconnectCount.current >= reconnectAttempts) {
      console.log('Max reconnection attempts reached');
      setIsReconnecting(false);
      return;
    }

    setIsReconnecting(true);
    reconnectCount.current += 1;

    const delay = Math.min(
      reconnectInterval * Math.pow(1.5, reconnectCount.current - 1),
      30000 // Max 30 seconds
    );

    reconnectTimeoutId.current = setTimeout(() => {
      connect();
    }, delay);
  }, [reconnectAttempts, reconnectInterval, connect]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutId.current) {
      clearTimeout(reconnectTimeoutId.current);
      reconnectTimeoutId.current = null;
    }
    
    stopHeartbeat();
    
    if (ws.current) {
      ws.current.close(1000, 'Client disconnect');
      ws.current = null;
    }
    
    setIsConnected(false);
    setIsReconnecting(false);
  }, [stopHeartbeat]);

  // Manually trigger reconnection
  const reconnect = useCallback(() => {
    disconnect();
    reconnectCount.current = 0;
    setTimeout(connect, 1000);
  }, [disconnect, connect]);

  // Initialize connection on mount and when user changes
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Handle page visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, reduce activity
        stopHeartbeat();
      } else {
        // Page is visible, resume activity
        if (isConnected) {
          startHeartbeat();
        } else {
          // Try to reconnect if not connected
          connect();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, startHeartbeat, stopHeartbeat, connect]);

  return {
    isConnected,
    isReconnecting,
    lastMessage,
    sendMessage,
    reconnect,
    disconnect,
    connectionState: ws.current?.readyState,
  };
};