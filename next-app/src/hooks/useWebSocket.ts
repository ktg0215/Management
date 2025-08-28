'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, invalidateQueries } from '@/lib/queryClient';

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
  url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080',
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
  
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

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
          console.log('System message:', message.data);
          break;
        case 'heartbeat':
          // Respond to heartbeat
          sendMessage({ type: 'heartbeat', timestamp: new Date().toISOString() });
          break;
        default:
          console.log('Unknown message type:', message.type);
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

      console.log('Sales data updated via WebSocket:', { storeId, year, month, date });
    }
  }, [queryClient]);

  // Handle store updates from WebSocket
  const handleStoreUpdate = useCallback((message: WebSocketMessage) => {
    if (message.storeId) {
      // Invalidate store queries
      invalidateQueries.stores.byId(message.storeId);
      invalidateQueries.stores.all();
      
      console.log('Store data updated via WebSocket:', message.storeId);
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
    if (ws.current?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setIsReconnecting(false);
        reconnectCount.current = 0;
        startHeartbeat();
        onConnectionChange?.(true);
      };

      ws.current.onmessage = handleMessage;

      ws.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        stopHeartbeat();
        onConnectionChange?.(false);

        // Attempt to reconnect if it wasn't a clean close
        if (!event.wasClean && reconnectCount.current < reconnectAttempts) {
          attemptReconnect();
        }
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      attemptReconnect();
    }
  }, [url, handleMessage, startHeartbeat, stopHeartbeat, onConnectionChange, onError]);

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

    console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectCount.current}/${reconnectAttempts})`);

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

  // Initialize connection on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

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