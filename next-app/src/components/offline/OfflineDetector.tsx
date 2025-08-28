'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CloudOff, RefreshCw } from 'lucide-react';

interface OfflineDetectorProps {
  onStatusChange?: (isOnline: boolean) => void;
  showNotification?: boolean;
  className?: string;
}

export const OfflineDetector: React.FC<OfflineDetectorProps> = ({
  onStatusChange,
  showNotification = true,
  className = '',
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const [retryAttempts, setRetryAttempts] = useState(0);

  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      onStatusChange?.(online);
      
      if (!online && showNotification) {
        setShowOfflineMessage(true);
      } else if (online) {
        setShowOfflineMessage(false);
        setRetryAttempts(0);
      }
    };

    // Initial check
    updateOnlineStatus();

    // Add event listeners
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [onStatusChange, showNotification]);

  // Periodic connectivity check
  useEffect(() => {
    if (!isOnline) {
      const checkConnectivity = async () => {
        try {
          const response = await fetch('/api/health', {
            method: 'HEAD',
            cache: 'no-cache',
          });
          
          if (response.ok && !isOnline) {
            setIsOnline(true);
            setShowOfflineMessage(false);
            onStatusChange?.(true);
          }
        } catch (error) {
          setRetryAttempts(prev => prev + 1);
        }
      };

      const interval = setInterval(checkConnectivity, 30000); // Check every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isOnline, onStatusChange]);

  const handleRetry = async () => {
    try {
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
      });
      
      if (response.ok) {
        setIsOnline(true);
        setShowOfflineMessage(false);
        setRetryAttempts(0);
        onStatusChange?.(true);
      } else {
        setRetryAttempts(prev => prev + 1);
      }
    } catch (error) {
      setRetryAttempts(prev => prev + 1);
    }
  };

  const dismissMessage = () => {
    setShowOfflineMessage(false);
  };

  if (!showNotification) {
    return null;
  }

  return (
    <>
      {/* Status indicator */}
      <div className={`flex items-center space-x-2 ${className}`}>
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-600">オンライン</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-600">オフライン</span>
          </>
        )}
      </div>

      {/* Offline notification */}
      {showOfflineMessage && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-4 transition-all duration-300">
          <div className="flex items-start space-x-3">
            <CloudOff className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                インターネット接続がありません
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                オフラインモードで動作しています。データはローカルに保存され、接続が復旧次第同期されます。
              </p>
              
              {retryAttempts > 0 && (
                <p className="mt-2 text-xs text-yellow-600">
                  再試行回数: {retryAttempts}
                </p>
              )}
              
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={handleRetry}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-yellow-800 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 transition-colors"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  再試行
                </button>
                <button
                  onClick={dismissMessage}
                  className="inline-flex items-center px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200 transition-colors"
                >
                  非表示
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Back online notification */}
      {isOnline && retryAttempts > 0 && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full bg-green-50 border border-green-200 rounded-lg shadow-lg p-4 transition-all duration-300">
          <div className="flex items-center space-x-3">
            <Wifi className="h-5 w-5 text-green-600" />
            <div>
              <h3 className="text-sm font-medium text-green-800">
                接続が復旧しました
              </h3>
              <p className="mt-1 text-sm text-green-700">
                データを同期しています...
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};