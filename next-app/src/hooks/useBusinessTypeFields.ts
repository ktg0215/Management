import { useState, useEffect, useCallback } from 'react';
import { SalesFieldConfig, getDefaultFieldConfigs } from '@/types/sales-field-config';

// API Base URLを取得
const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3001/api';
  }
  // 本番環境かどうかを判定
  const hostname = window.location.hostname;
  const isProduction = hostname !== 'localhost' && hostname !== '127.0.0.1';
  if (isProduction) {
    return '/bb/api';
  }
  // ローカル開発環境
  return 'http://localhost:3001/api';
};

interface UseBusinessTypeFieldsResult {
  fields: SalesFieldConfig[];
  isLoading: boolean;
  error: string | null;
  saveFields: (fields: SalesFieldConfig[]) => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function useBusinessTypeFields(businessTypeId: string | undefined): UseBusinessTypeFieldsResult {
  const [fields, setFields] = useState<SalesFieldConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFields = useCallback(async () => {
    if (!businessTypeId) {
      setFields(getDefaultFieldConfigs('cafe'));
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('auth_token');
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/business-type-fields?businessTypeId=${businessTypeId}`, {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('フィールド設定APIがJSONを返していません。デフォルト設定を使用します。', {
          status: response.status,
          contentType,
          url: `${apiBase}/business-type-fields?businessTypeId=${businessTypeId}`
        });
        setFields(getDefaultFieldConfigs('cafe'));
        setIsLoading(false);
        return;
      }

      const result = await response.json();

      if (result.success) {
        if (result.data && result.data.length > 0) {
          // 保存された設定がある場合はそれを使用
          setFields(result.data);
        } else {
          // 保存された設定がない場合はデフォルトを使用
          setFields(getDefaultFieldConfigs('cafe'));
        }
      } else {
        setError(result.error || 'フィールド設定の取得に失敗しました');
        setFields(getDefaultFieldConfigs('cafe'));
      }
    } catch (err) {
      console.error('フィールド設定取得エラー:', err);
      setError('フィールド設定の取得に失敗しました');
      setFields(getDefaultFieldConfigs('cafe'));
    } finally {
      setIsLoading(false);
    }
  }, [businessTypeId]);

  const saveFields = useCallback(async (newFields: SalesFieldConfig[]): Promise<boolean> => {
    if (!businessTypeId) {
      setError('業態IDが指定されていません');
      return false;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const apiBase = getApiBaseUrl();
      const response = await fetch(`${apiBase}/business-type-fields`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          businessTypeId,
          fields: newFields,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('フィールド設定保存APIがJSONを返していません。', {
          status: response.status,
          contentType
        });
        setError('フィールド設定の保存に失敗しました（APIエンドポイントが存在しません）');
        return false;
      }

      const result = await response.json();

      if (result.success) {
        setFields(newFields);
        return true;
      } else {
        setError(result.error || 'フィールド設定の保存に失敗しました');
        return false;
      }
    } catch (err) {
      console.error('フィールド設定保存エラー:', err);
      setError('フィールド設定の保存に失敗しました');
      return false;
    }
  }, [businessTypeId]);

  useEffect(() => {
    fetchFields();
  }, [fetchFields]);

  return {
    fields,
    isLoading,
    error,
    saveFields,
    refetch: fetchFields,
  };
}
