import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { X, Save, Calendar, TrendingUp, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react';
import { EDW_SALES_FIELDS, EDWDailySalesData } from '../../types/sales';
import { useSalesDataMutation } from '@/hooks/queries/useSalesQueries';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useErrorHandler } from '@/components/errorBoundary/ErrorBoundary';

interface OptimizedSalesFormProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  initialData?: EDWDailySalesData;
  storeId: string;
  year: number;
  month: number;
}

interface FormStatus {
  isSubmitting: boolean;
  hasOptimisticUpdate: boolean;
  error: string | null;
  success: boolean;
}

const OptimizedSalesForm: React.FC<OptimizedSalesFormProps> = memo(({
  isOpen,
  onClose,
  selectedDate,
  initialData,
  storeId,
  year,
  month,
}) => {
  const [formData, setFormData] = useState<EDWDailySalesData>({});
  const [status, setStatus] = useState<FormStatus>({
    isSubmitting: false,
    hasOptimisticUpdate: false,
    error: null,
    success: false,
  });
  
  const firstInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Hooks
  const { throwError } = useErrorHandler();
  const { isConnected, sendMessage } = useWebSocket();
  const mutation = useSalesDataMutation();

  // Initialize form data
  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({});
    }
    
    // Reset status when opening form
    if (isOpen) {
      setStatus({
        isSubmitting: false,
        hasOptimisticUpdate: false,
        error: null,
        success: false,
      });
    }
  }, [initialData, isOpen]);

  // Focus first input when form opens
  useEffect(() => {
    if (isOpen && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle form submission with optimistic updates
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!storeId || status.isSubmitting) return;

    setStatus(prev => ({ ...prev, isSubmitting: true, error: null }));

    try {
      // Perform optimistic mutation
      await mutation.mutateAsync({
        storeId,
        year,
        month,
        date: selectedDate,
        formData,
      });

      // Send WebSocket update for real-time sync
      if (isConnected) {
        sendMessage({
          type: 'sales_update',
          data: {
            storeId,
            year,
            month,
            date: selectedDate,
            data: formData,
          },
          timestamp: new Date().toISOString(),
        });
      }

      setStatus(prev => ({ 
        ...prev, 
        isSubmitting: false, 
        success: true, 
        hasOptimisticUpdate: true 
      }));

      // Close form after successful submit with delay
      submitTimeoutRef.current = setTimeout(() => {
        onClose();
      }, 1000);

    } catch (error) {
      console.error('Form submission error:', error);
      
      setStatus(prev => ({ 
        ...prev, 
        isSubmitting: false, 
        error: error instanceof Error ? error.message : '保存に失敗しました',
        hasOptimisticUpdate: false 
      }));

      // If it's a critical error, throw it to be caught by error boundary
      if (error instanceof Error && error.message.includes('network')) {
        throwError(error);
      }
    }
  }, [storeId, status.isSubmitting, mutation, year, month, selectedDate, formData, isConnected, sendMessage, onClose, throwError]);

  // Handle input changes with debouncing
  const handleInputChange = useCallback((field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    
    // Reset error state when user starts typing
    if (status.error) {
      setStatus(prev => ({ ...prev, error: null }));
    }
  }, [status.error]);

  // Handle form close
  const handleClose = useCallback(() => {
    if (submitTimeoutRef.current) {
      clearTimeout(submitTimeoutRef.current);
    }
    onClose();
  }, [onClose]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  // Auto-save draft functionality
  useEffect(() => {
    if (isOpen && Object.keys(formData).length > 0) {
      const draftKey = `sales-draft-${storeId}-${selectedDate}`;
      localStorage.setItem(draftKey, JSON.stringify(formData));
    }
  }, [formData, isOpen, storeId, selectedDate]);

  // Load draft on form open
  useEffect(() => {
    if (isOpen && !initialData) {
      const draftKey = `sales-draft-${storeId}-${selectedDate}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const draftData = JSON.parse(savedDraft);
          setFormData(draftData);
        } catch (error) {
          console.error('Failed to load draft:', error);
        }
      }
    }
  }, [isOpen, initialData, storeId, selectedDate]);

  if (!isOpen) return null;

  const formatDateDisplay = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = dayNames[date.getDay()];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}日（${dayOfWeek}）`;
  }, []);

  // Memoize grouped fields to prevent recalculation on every render
  const groupedFields = useMemo(() => {
    return EDW_SALES_FIELDS.reduce((groups, field) => {
      const category = field.category || 'その他';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(field);
      return groups;
    }, {} as Record<string, Array<typeof EDW_SALES_FIELDS[number]>>);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-8 py-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-white/20 rounded-lg">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  売上データ入力
                </h2>
                <div className="flex items-center space-x-4 text-blue-100">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">{formatDateDisplay(selectedDate)}</span>
                  </div>
                  
                  {/* Connection status indicator */}
                  <div className="flex items-center space-x-1">
                    {isConnected ? (
                      <>
                        <Wifi className="h-4 w-4 text-green-300" />
                        <span className="text-xs">接続中</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-4 w-4 text-yellow-300" />
                        <span className="text-xs">オフライン</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={status.isSubmitting}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Status Messages */}
        {status.error && (
          <div className="mx-8 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            <span className="text-red-700 text-sm">{status.error}</span>
          </div>
        )}

        {status.success && (
          <div className="mx-8 mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            <span className="text-green-700 text-sm">
              {status.hasOptimisticUpdate ? '保存しました（リアルタイム更新中...）' : '保存しました'}
            </span>
          </div>
        )}

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto">
          <form ref={formRef} onSubmit={handleSubmit} className="p-8">
            {Object.entries(groupedFields).map(([category, fields]) => (
              <div key={category} className="mb-8 last:mb-0">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {category}
                  </h3>
                  <div className="h-px bg-gradient-to-r from-blue-200 to-transparent"></div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {fields.map((field, index) => {
                    const isFirstField = index === 0 && category === Object.keys(groupedFields)[0];
                    const isAutoField = field.type === 'auto';
                    const value = formData[field.key as keyof EDWDailySalesData];
                    
                    // 自動計算項目は入力フォームでは非表示
                    if (isAutoField) {
                      return null;
                    }
                    
                    return (
                      <div key={field.key} className="group">
                        <label className="block text-sm font-medium text-gray-700 mb-3 group-hover:text-blue-600 transition-colors">
                          {field.label}
                        </label>
                        
                        <div className="relative">
                          <input
                            ref={isFirstField ? firstInputRef : undefined}
                            type={typeof value === 'number' ? 'number' : 'text'}
                            step={typeof value === 'number' ? '0.01' : undefined}
                            value={value || ''}
                            onChange={(e) => {
                              const inputValue = e.target.type === 'number' ? 
                                (e.target.value === '' ? undefined : parseFloat(e.target.value)) : 
                                e.target.value;
                              handleInputChange(field.key, inputValue ?? '');
                            }}
                            disabled={status.isSubmitting}
                            className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 hover:border-gray-400 placeholder-gray-400 text-gray-900 font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                              status.hasOptimisticUpdate ? 'border-green-300' : 'border-gray-300'
                            }`}
                            placeholder={`${field.label}を入力`}
                            style={{
                              minWidth: '120px',
                              maxWidth: '100%',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl pointer-events-none"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </form>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-6 rounded-b-2xl border-t border-gray-200">
          <div className="flex justify-between items-center">
            {/* Connection and draft status */}
            <div className="text-sm text-gray-600">
              {!isConnected && (
                <span className="text-yellow-600">オフラインモード - データはローカルに保存されます</span>
              )}
            </div>
            
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={status.isSubmitting}
                className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                キャンセル
              </button>
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={status.isSubmitting || !storeId}
                className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 border border-transparent rounded-xl hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center space-x-2 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status.isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>保存中...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>保存</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

OptimizedSalesForm.displayName = 'OptimizedSalesForm';

export { OptimizedSalesForm };