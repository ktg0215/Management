"use client";
import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Bell, Clock } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import apiClient, { ActivityLog } from '@/lib/api';

const Information: React.FC = () => {
  const { user } = useAuthStore();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<ActivityLog[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActivityLogs = async (limit?: number) => {
    setIsLoading(true);
    try {
      const response = await apiClient.getActivityLogs(limit);
      
      if (response.success && response.data) {
        if (limit) {
          setExpandedLogs(response.data);
        } else {
          setLogs(response.data);
        }
      }
    } catch (error) {
      console.error('活動ログ取得エラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 一般ユーザーの場合はAPIを呼び出さない
    if (user && user.role !== 'user') {
      fetchActivityLogs(5); // 初期表示は5件
    }
  }, [user]);

  // 一般ユーザーは表示しない
  if (!user || user.role === 'user') {
    return null;
  }

  const handleToggleExpand = async () => {
    if (!isExpanded) {
      // 展開時に詳細データを取得
      // 管理者: 10件、総管理者: 20件
      const limit = user.role === 'super_admin' ? 20 : 10;
      await fetchActivityLogs(limit);
    }
    setIsExpanded(!isExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return 'たった今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}時間前`;
    return date.toLocaleDateString('ja-JP', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionIcon = (actionType: string) => {
    const iconClass = "h-3 w-3";
    switch (actionType) {
      case 'create': return <span className={`${iconClass} bg-green-500 rounded-full`} />;
      case 'update': return <span className={`${iconClass} bg-blue-500 rounded-full`} />;
      case 'delete': return <span className={`${iconClass} bg-red-500 rounded-full`} />;
      default: return <span className={`${iconClass} bg-gray-500 rounded-full`} />;
    }
  };

  const displayLogs = isExpanded ? expandedLogs : logs;

  // ログが存在しない場合の表示
  if (displayLogs.length === 0 && !isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-4">
          <div className="flex items-center text-gray-500">
            <Bell className="h-5 w-5 mr-2" />
            <span className="text-sm">更新履歴はありません</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Bell className="h-5 w-5 mr-2 text-blue-600" />
            <h3 className="text-sm font-medium text-gray-900">Information</h3>
            {logs.length > 0 && (
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                {logs.length}
              </span>
            )}
          </div>
          {logs.length > 0 && (
            <button
              onClick={handleToggleExpand}
              className="flex items-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
              disabled={isLoading}
            >
              {isExpanded ? (
                <>
                  <span className="mr-1">閉じる</span>
                  <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span className="mr-1">詳細</span>
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="mt-3 flex items-center text-gray-500">
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            <span className="text-sm">読み込み中...</span>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {displayLogs.map((log) => (
              <div key={log.id} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-md transition-colors">
                <div className="flex-shrink-0 mt-1">
                  {getActionIcon(log.actionType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 break-words">
                    {log.description}
                  </p>
                  <div className="flex items-center mt-1 text-xs text-gray-500">
                    <span>{log.storeName}</span>
                    <span className="mx-1">•</span>
                    <span>{formatDate(log.createdAt)}</span>
                    {log.userName && (
                      <>
                        <span className="mx-1">•</span>
                        <span>{log.userName}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Information; 